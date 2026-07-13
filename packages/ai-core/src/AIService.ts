import { z } from 'zod';
import { requestCacheKey } from './cache/hash.js';
import { RequestDeduplicator } from './cache/RequestDeduplicator.js';
import { ResponseCache } from './cache/ResponseCache.js';
import {
  AllProvidersFailedError,
  AIError,
  ProviderRequestError,
} from './errors.js';
import { getLogger } from './logger.js';
import { withRetry, type RetryOptions } from './retry.js';
import { PromptGuard } from './security/PromptGuard.js';
import type {
  AIProvider,
  CompletionChunk,
  CompletionRequest,
  CompletionResponse,
  ProviderMetrics,
  ProviderName,
} from './types.js';

/**
 * Circuit breaker per provider. After N consecutive failures the circuit opens
 * and the provider is skipped for a cooldown window, so a dead vendor doesn't
 * add latency to every request. After cooldown it goes half-open and is tried
 * once; success closes it, failure re-opens it.
 */
class CircuitBreaker {
  private failures = 0;
  private openedAt = 0;
  state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private readonly threshold: number,
    private readonly cooldownMs: number,
    private readonly now: () => number,
  ) {}

  canRequest(): boolean {
    if (this.state === 'open' && this.now() - this.openedAt >= this.cooldownMs) {
      this.state = 'half-open';
    }
    return this.state !== 'open';
  }

  recordSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  recordFailure(): void {
    this.failures++;
    if (this.failures >= this.threshold) {
      this.state = 'open';
      this.openedAt = this.now();
    }
  }
}

export interface AIServiceOptions {
  /** Providers in priority order. The chain fails over left-to-right. */
  providers: AIProvider[];
  cache?: ResponseCache<CompletionResponse>;
  promptGuard?: PromptGuard;
  retry?: Partial<RetryOptions>;
  circuit?: { threshold: number; cooldownMs: number };
  now?: () => number;
  /** Only cache responses whose request temperature is <= this. */
  maxCacheableTemperature?: number;
}

interface MetricAccumulator {
  requests: number;
  failures: number;
  cacheHits: number;
  totalTokens: number;
  latencySum: number;
  latencyCount: number;
}

/**
 * The single entry point every business feature uses to talk to "the AI".
 *
 * Responsibilities (each delegated to a focused collaborator):
 *  - route across providers in priority order with automatic failover
 *  - retry transient failures per provider with exponential backoff
 *  - short-circuit dead providers with a circuit breaker
 *  - serve identical requests from an LRU/TTL cache (quota protection)
 *  - coalesce concurrent identical requests (dedup)
 *  - screen input through the prompt-injection guard
 *  - expose metrics for the ops dashboard
 */
export class AIService {
  private readonly providers: AIProvider[];
  private readonly cache: ResponseCache<CompletionResponse>;
  private readonly dedup = new RequestDeduplicator<CompletionResponse>();
  private readonly guard: PromptGuard;
  private readonly retry: Partial<RetryOptions>;
  private readonly breakers = new Map<ProviderName, CircuitBreaker>();
  private readonly metrics = new Map<ProviderName, MetricAccumulator>();
  private readonly maxCacheableTemperature: number;
  private readonly now: () => number;

  constructor(options: AIServiceOptions) {
    if (options.providers.length === 0) {
      throw new Error('AIService requires at least one provider');
    }
    this.providers = options.providers;
    this.cache = options.cache ?? new ResponseCache<CompletionResponse>();
    this.guard = options.promptGuard ?? new PromptGuard();
    this.retry = options.retry ?? {};
    this.now = options.now ?? Date.now;
    this.maxCacheableTemperature = options.maxCacheableTemperature ?? 0.3;

    const circuit = options.circuit ?? { threshold: 3, cooldownMs: 30_000 };
    for (const provider of this.providers) {
      this.breakers.set(
        provider.name,
        new CircuitBreaker(circuit.threshold, circuit.cooldownMs, this.now),
      );
      this.metrics.set(provider.name, {
        requests: 0,
        failures: 0,
        cacheHits: 0,
        totalTokens: 0,
        latencySum: 0,
        latencyCount: 0,
      });
    }
  }

  /**
   * Complete a request, serving from cache when possible, otherwise routing
   * through the failover chain. Concurrent identical requests are coalesced.
   */
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    this.guard.inspect(request.messages);

    const cacheable =
      (request.cacheable ?? true) && (request.temperature ?? 0.2) <= this.maxCacheableTemperature;
    const key = requestCacheKey(request);

    if (cacheable) {
      const hit = this.cache.get(key);
      if (hit) {
        this.recordCacheHit(hit.provider);
        return { ...hit, cached: true };
      }
      // Coalesce concurrent misses onto one upstream call.
      return this.dedup.dedupe(key, async () => {
        const response = await this.routeWithFailover(request);
        this.cache.set(key, response);
        return response;
      });
    }
    return this.routeWithFailover(request);
  }

  /**
   * Complete and parse into a validated shape. Enforces JSON, strips code
   * fences, validates against a zod schema, and retries once with a repair
   * instruction if the model returns malformed JSON. This is what lets the
   * decision engine trust AI output as structured data, not free text.
   */
  async completeJSON<T>(
    request: CompletionRequest,
    schema: z.ZodType<T>,
    options: { repairAttempts?: number } = {},
  ): Promise<{ data: T; response: CompletionResponse }> {
    const repairAttempts = options.repairAttempts ?? 1;
    let lastError = '';
    let workingRequest = request;

    for (let attempt = 0; attempt <= repairAttempts; attempt++) {
      const response = await this.complete(workingRequest);
      const parsed = this.tryParseJson(response.content);
      if (parsed.ok) {
        const validated = schema.safeParse(parsed.value);
        if (validated.success) return { data: validated.data, response };
        lastError = validated.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      } else {
        lastError = parsed.error;
      }
      // Ask for a repair, bypassing cache so we don't re-serve the bad answer.
      workingRequest = {
        ...request,
        cacheable: false,
        messages: [
          ...request.messages,
          { role: 'assistant', content: response.content },
          {
            role: 'user',
            content: `Your previous reply was not valid against the required schema (${lastError}). Reply again with ONLY valid minified JSON, no prose, no code fences.`,
          },
        ],
      };
    }
    throw new ProviderRequestError('simulator', `Model did not produce valid JSON: ${lastError}`);
  }

  /** Stream from the first available provider (no caching for live streams). */
  async *stream(request: CompletionRequest): AsyncIterable<CompletionChunk> {
    this.guard.inspect(request.messages);
    const attempts: Array<{ provider: ProviderName; reason: string }> = [];

    for (const provider of this.eligibleProviders()) {
      try {
        yield* provider.stream(request);
        this.breakers.get(provider.name)?.recordSuccess();
        return;
      } catch (error) {
        this.onProviderFailure(provider.name);
        attempts.push({ provider: provider.name, reason: (error as Error).message });
      }
    }
    throw new AllProvidersFailedError(attempts);
  }

  metricsSnapshot(): ProviderMetrics[] {
    return this.providers.map((provider) => {
      const m = this.metrics.get(provider.name)!;
      return {
        provider: provider.name,
        requests: m.requests,
        failures: m.failures,
        cacheHits: m.cacheHits,
        totalTokens: m.totalTokens,
        avgLatencyMs: m.latencyCount === 0 ? 0 : Math.round(m.latencySum / m.latencyCount),
        circuit: this.breakers.get(provider.name)?.state ?? 'closed',
      };
    });
  }

  cacheStats(): ReturnType<ResponseCache<CompletionResponse>['stats']> {
    return this.cache.stats();
  }

  // --- internals -------------------------------------------------------------

  private async routeWithFailover(request: CompletionRequest): Promise<CompletionResponse> {
    const log = getLogger();
    const attempts: Array<{ provider: ProviderName; reason: string }> = [];

    for (const provider of this.eligibleProviders()) {
      const acc = this.metrics.get(provider.name)!;
      acc.requests++;
      try {
        const response = await withRetry(() => provider.complete(request), this.retry);
        this.breakers.get(provider.name)?.recordSuccess();
        acc.totalTokens += response.usage.totalTokens;
        acc.latencySum += response.latencyMs;
        acc.latencyCount++;
        return response;
      } catch (error) {
        this.onProviderFailure(provider.name);
        attempts.push({ provider: provider.name, reason: this.reason(error) });
        log.warn('ai.failover', { from: provider.name, reason: this.reason(error) });
        // A non-retryable request error (bad auth/validation) still fails over —
        // a bad key on one provider shouldn't sink the whole request.
      }
    }
    throw new AllProvidersFailedError(attempts);
  }

  /** Configured providers whose circuit currently permits a request. */
  private *eligibleProviders(): Iterable<AIProvider> {
    let anyYielded = false;
    for (const provider of this.providers) {
      if (!provider.isConfigured()) continue;
      if (!this.breakers.get(provider.name)?.canRequest()) continue;
      anyYielded = true;
      yield provider;
    }
    // Safety net: if every breaker is open, still try them (half-open probe)
    // rather than failing outright — availability beats strictness here.
    if (!anyYielded) {
      for (const provider of this.providers) {
        if (provider.isConfigured()) yield provider;
      }
    }
  }

  private onProviderFailure(name: ProviderName): void {
    this.breakers.get(name)?.recordFailure();
    const acc = this.metrics.get(name);
    if (acc) acc.failures++;
  }

  private recordCacheHit(name: ProviderName): void {
    const acc = this.metrics.get(name);
    if (acc) acc.cacheHits++;
  }

  private reason(error: unknown): string {
    if (error instanceof AIError) return error.constructor.name;
    return error instanceof Error ? error.name : 'UnknownError';
  }

  private tryParseJson(raw: string): { ok: true; value: unknown } | { ok: false; error: string } {
    // Tolerate ```json fences and leading/trailing prose.
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = (fenced?.[1] ?? raw).trim();
    const start = candidate.search(/[[{]/);
    const end = Math.max(candidate.lastIndexOf('}'), candidate.lastIndexOf(']'));
    if (start === -1 || end === -1 || end < start) {
      return { ok: false, error: 'no JSON object found' };
    }
    try {
      return { ok: true, value: JSON.parse(candidate.slice(start, end + 1)) };
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
  }
}
