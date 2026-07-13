import { AIError } from './errors.js';
import { getLogger } from './logger.js';

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  /** Deterministic jitter source in [0,1); injectable for testing. */
  jitter: () => number;
  /** Sleep implementation; injectable so tests run instantly. */
  sleep: (ms: number) => Promise<void>;
}

const DEFAULTS: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 250,
  maxDelayMs: 4_000,
  jitter: Math.random,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/**
 * Full-jitter exponential backoff. Retries only errors that declare themselves
 * retryable (rate limits, 5xx, network). A rate-limit `Retry-After` hint, when
 * present, takes precedence over the computed backoff.
 *
 * This retries a SINGLE provider. Cross-provider failover is orchestrated one
 * level up in {@link AIService}, so the two concerns stay cleanly separated.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  overrides: Partial<RetryOptions> = {},
): Promise<T> {
  const opts = { ...DEFAULTS, ...overrides };
  const log = getLogger();
  let lastError: unknown;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      const retryable = error instanceof AIError ? error.retryable : false;
      const isLast = attempt >= opts.maxAttempts;
      if (!retryable || isLast) throw error;

      const hinted =
        error instanceof AIError && 'retryAfterMs' in error
          ? (error as { retryAfterMs?: number }).retryAfterMs
          : undefined;
      const backoff = Math.min(opts.maxDelayMs, opts.baseDelayMs * 2 ** (attempt - 1));
      const delay = hinted ?? Math.floor(backoff * opts.jitter());

      log.warn('ai.retry', { attempt, delay, error: (error as Error).message });
      await opts.sleep(delay);
    }
  }
  throw lastError;
}
