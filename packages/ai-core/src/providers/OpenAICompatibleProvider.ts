import {
  ProviderRequestError,
  ProviderUnavailableError,
  RateLimitError,
} from '../errors.js';
import type {
  AIProvider,
  CompletionChunk,
  CompletionRequest,
  CompletionResponse,
  ProviderName,
  TokenUsage,
} from '../types.js';

export interface OpenAICompatibleConfig {
  name: ProviderName;
  baseUrl: string;
  apiKey: string | undefined;
  defaultModel: string;
  /** Extra headers (e.g. OpenRouter attribution). */
  headers?: Record<string, string>;
  /** Injectable fetch for testing; defaults to global fetch. */
  fetchImpl?: typeof fetch;
  requestTimeoutMs?: number;
}

interface ChatCompletionChoice {
  message?: { content?: string | null };
  delta?: { content?: string | null };
  finish_reason?: string | null;
}
interface ChatCompletionBody {
  choices?: ChatCompletionChoice[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  model?: string;
}

/**
 * Shared implementation for every OpenAI-`/chat/completions`-compatible vendor
 * (OpenRouter, Groq, Cerebras). Concrete providers only supply configuration —
 * base URL, key, default model — which keeps each vendor file tiny and makes
 * adding another OpenAI-compatible host a two-line change.
 */
export abstract class OpenAICompatibleProvider implements AIProvider {
  readonly name: ProviderName;
  private readonly config: Required<Omit<OpenAICompatibleConfig, 'apiKey' | 'headers'>> & {
    apiKey: string | undefined;
    headers: Record<string, string>;
  };

  protected constructor(config: OpenAICompatibleConfig) {
    this.name = config.name;
    this.config = {
      name: config.name,
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      defaultModel: config.defaultModel,
      headers: config.headers ?? {},
      fetchImpl: config.fetchImpl ?? fetch,
      requestTimeoutMs: config.requestTimeoutMs ?? 20_000,
    };
  }

  isConfigured(): boolean {
    return Boolean(this.config.apiKey);
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const start = performance.now();
    const model = request.model ?? this.config.defaultModel;
    const response = await this.post(model, request, false);
    const body = (await response.json()) as ChatCompletionBody;
    const content = body.choices?.[0]?.message?.content ?? '';
    return {
      content: content.trim(),
      provider: this.name,
      model: body.model ?? model,
      usage: this.toUsage(body.usage),
      cached: false,
      latencyMs: Math.round(performance.now() - start),
    };
  }

  async *stream(request: CompletionRequest): AsyncIterable<CompletionChunk> {
    const model = request.model ?? this.config.defaultModel;
    const response = await this.post(model, request, true);
    const body = response.body;
    if (!body) throw new ProviderUnavailableError(this.name, response.status);

    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Server-Sent Events: split on double newline, parse `data:` lines.
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';
        for (const event of events) {
          const line = event.split('\n').find((l) => l.startsWith('data:'));
          if (!line) continue;
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') {
            yield { delta: '', done: true, provider: this.name, model };
            return;
          }
          const parsed = JSON.parse(payload) as ChatCompletionBody;
          const delta = parsed.choices?.[0]?.delta?.content ?? '';
          if (delta) yield { delta, done: false, provider: this.name, model };
        }
      }
    } finally {
      reader.releaseLock();
    }
    yield { delta: '', done: true, provider: this.name, model };
  }

  private async post(
    model: string,
    request: CompletionRequest,
    stream: boolean,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
    if (request.signal) {
      request.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    let response: Response;
    try {
      response = await this.config.fetchImpl(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.config.apiKey ?? ''}`,
          ...this.config.headers,
        },
        body: JSON.stringify({
          model,
          messages: request.messages,
          temperature: request.temperature ?? 0.2,
          max_tokens: request.maxTokens ?? 1024,
          stream,
        }),
      });
    } catch (error) {
      throw new ProviderUnavailableError(this.name, undefined, error);
    } finally {
      clearTimeout(timeout);
    }

    if (response.ok) return response;
    await this.raiseForStatus(response);
    // `raiseForStatus` always throws; this satisfies the type checker.
    throw new ProviderUnavailableError(this.name, response.status);
  }

  private async raiseForStatus(response: Response): Promise<never> {
    const detail = await response.text().catch(() => '');
    if (response.status === 429) {
      const header = response.headers.get('retry-after');
      const retryAfterMs = header ? Number(header) * 1000 : undefined;
      throw new RateLimitError(this.name, Number.isFinite(retryAfterMs) ? retryAfterMs : undefined);
    }
    if (response.status >= 500) {
      throw new ProviderUnavailableError(this.name, response.status);
    }
    throw new ProviderRequestError(this.name, detail.slice(0, 200), response.status);
  }

  private toUsage(usage: ChatCompletionBody['usage']): TokenUsage {
    return {
      promptTokens: usage?.prompt_tokens ?? 0,
      completionTokens: usage?.completion_tokens ?? 0,
      totalTokens: usage?.total_tokens ?? 0,
    };
  }
}
