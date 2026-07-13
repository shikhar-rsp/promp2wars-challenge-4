/**
 * @atlas/ai-core — the only surface business logic should import to use AI.
 *
 * Never import a concrete provider from feature code. Depend on {@link AIService}
 * (or the factory) and the exported types; the provider chain, failover,
 * caching and safety are all handled behind this boundary.
 */
export { AIService } from './AIService.js';
export type { AIServiceOptions } from './AIService.js';
export { createAIServiceFromEnv, hasLiveProvider } from './factory.js';
export type { AIEnv } from './factory.js';

export { PromptGuard } from './security/PromptGuard.js';
export { ResponseCache } from './cache/ResponseCache.js';
export { RequestDeduplicator } from './cache/RequestDeduplicator.js';
export { requestCacheKey, fnv1a } from './cache/hash.js';
export { withRetry } from './retry.js';
export { setLogger, getLogger } from './logger.js';
export type { Logger } from './logger.js';

export { OpenRouterProvider } from './providers/OpenRouterProvider.js';
export { GroqProvider } from './providers/GroqProvider.js';
export { CerebrasProvider } from './providers/CerebrasProvider.js';
export { GeminiProvider } from './providers/GeminiProvider.js';
export { SimulatorProvider } from './providers/SimulatorProvider.js';

export {
  AIError,
  RateLimitError,
  ProviderUnavailableError,
  ProviderRequestError,
  AllProvidersFailedError,
  PromptSafetyError,
} from './errors.js';

export type {
  AIProvider,
  ChatMessage,
  ChatRole,
  CompletionRequest,
  CompletionResponse,
  CompletionChunk,
  ProviderName,
  ProviderMetrics,
  TokenUsage,
} from './types.js';
