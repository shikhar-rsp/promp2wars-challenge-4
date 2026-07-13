import type { CompletionRequest } from '../types.js';

/**
 * Stable FNV-1a 64-bit hash (as hex). Fast, dependency-free and deterministic
 * across processes — good enough to key a response cache. Not cryptographic.
 */
export function fnv1a(input: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < input.length; i++) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, '0');
}

/**
 * Derive a cache key from the semantically meaningful fields of a request.
 * Streaming flag and abort signal are deliberately excluded — a streamed and a
 * buffered completion of the same prompt are the same answer. Non-deterministic
 * requests (temperature > 0.3) are not cached by the caller, but we still key
 * them faithfully so identical in-flight ones can be deduplicated.
 */
export function requestCacheKey(request: CompletionRequest): string {
  const canonical = JSON.stringify({
    ns: request.cacheNamespace ?? 'default',
    model: request.model ?? 'auto',
    temperature: request.temperature ?? 0.2,
    maxTokens: request.maxTokens ?? 0,
    messages: request.messages.map((m) => [m.role, m.content]),
  });
  return fnv1a(canonical);
}
