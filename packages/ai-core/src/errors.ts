import type { ProviderName } from './types.js';

/** Base class for every error the AI layer raises, so callers can `instanceof`. */
export class AIError extends Error {
  constructor(
    message: string,
    readonly provider: ProviderName,
    readonly options: { retryable: boolean; status?: number } = { retryable: false },
  ) {
    super(message);
    this.name = new.target.name;
  }

  get retryable(): boolean {
    return this.options.retryable;
  }
}

/** The provider signalled rate limiting (HTTP 429). Always retryable/failover-able. */
export class RateLimitError extends AIError {
  constructor(
    provider: ProviderName,
    /** Seconds to wait, parsed from `Retry-After` when present. */
    readonly retryAfterMs?: number,
  ) {
    super(`Provider "${provider}" is rate limited`, provider, { retryable: true, status: 429 });
  }
}

/** Transient upstream failure (5xx, network, timeout). Retryable. */
export class ProviderUnavailableError extends AIError {
  constructor(provider: ProviderName, status?: number, cause?: unknown) {
    super(`Provider "${provider}" is temporarily unavailable`, provider, {
      retryable: true,
      ...(status !== undefined ? { status } : {}),
    });
    if (cause !== undefined) this.cause = cause;
  }
}

/** The request was rejected on its merits (4xx auth/validation). Not retryable. */
export class ProviderRequestError extends AIError {
  constructor(provider: ProviderName, message: string, status?: number) {
    super(`Provider "${provider}" rejected the request: ${message}`, provider, {
      retryable: false,
      ...(status !== undefined ? { status } : {}),
    });
  }
}

/** No configured provider could serve the request. Terminal. */
export class AllProvidersFailedError extends AIError {
  constructor(readonly attempts: ReadonlyArray<{ provider: ProviderName; reason: string }>) {
    super(
      `All providers failed: ${attempts.map((a) => `${a.provider}(${a.reason})`).join(', ')}`,
      'simulator',
      { retryable: false },
    );
  }
}

/** Input tripped the prompt-injection / safety guard. Never reaches a model. */
export class PromptSafetyError extends AIError {
  constructor(readonly reason: string) {
    super(`Request blocked by prompt safety guard: ${reason}`, 'simulator', { retryable: false });
  }
}
