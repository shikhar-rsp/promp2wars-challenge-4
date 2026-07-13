/**
 * Core contracts for the ATLAS AI layer.
 *
 * Business logic depends ONLY on these types and on {@link AIService}. It must
 * never import a concrete provider or a vendor SDK. This is what keeps the
 * platform decoupled from any single AI vendor and lets us fail over between
 * them transparently.
 */

/** Canonical chat role, provider-agnostic. */
export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** Identifiers for the providers ATLAS can route to, in priority order. */
export type ProviderName = 'openrouter' | 'groq' | 'cerebras' | 'gemini' | 'simulator';

/**
 * A single, fully-specified completion request. `cacheKey` is derived
 * automatically from the semantic fields when omitted.
 */
export interface CompletionRequest {
  messages: ChatMessage[];
  /** 0..1. Lower = more deterministic. Deterministic requests cache better. */
  temperature?: number;
  maxTokens?: number;
  /** Advisory model override; each provider maps to its own default otherwise. */
  model?: string;
  /**
   * When true (default) identical requests are served from cache / coalesced.
   * Set false for requests that must always hit a live model.
   */
  cacheable?: boolean;
  /** Optional caller-supplied namespace so unrelated features never collide. */
  cacheNamespace?: string;
  /** Abort signal propagated to the underlying fetch. */
  signal?: AbortSignal;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface CompletionResponse {
  content: string;
  provider: ProviderName;
  model: string;
  usage: TokenUsage;
  /** True when served from the response cache (no upstream call was made). */
  cached: boolean;
  /** Wall-clock latency in milliseconds for the served response. */
  latencyMs: number;
}

/** One streamed delta. `done` marks the terminal chunk with final metadata. */
export interface CompletionChunk {
  delta: string;
  done: boolean;
  provider: ProviderName;
  model: string;
}

/**
 * The provider abstraction. Every concrete vendor integration implements this
 * and nothing else. Adding a provider = adding one file that satisfies this
 * interface and registering it — no change to callers.
 */
export interface AIProvider {
  readonly name: ProviderName;
  /** Cheap, side-effect-free check used for routing (does it have credentials?). */
  isConfigured(): boolean;
  complete(request: CompletionRequest): Promise<CompletionResponse>;
  stream(request: CompletionRequest): AsyncIterable<CompletionChunk>;
}

export interface ProviderMetrics {
  provider: ProviderName;
  requests: number;
  failures: number;
  cacheHits: number;
  totalTokens: number;
  avgLatencyMs: number;
  /** Circuit-breaker state for operational visibility. */
  circuit: 'closed' | 'open' | 'half-open';
}
