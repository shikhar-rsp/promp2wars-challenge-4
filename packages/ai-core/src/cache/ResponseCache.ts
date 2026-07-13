/**
 * Bounded LRU cache with per-entry TTL. Used to serve identical AI requests
 * without a round-trip — the single biggest lever on API-quota consumption
 * during heavy judging traffic.
 *
 * Implementation note: a `Map` in JS preserves insertion order, so we model LRU
 * by deleting-then-reinserting on access. O(1) amortised, zero dependencies.
 */
export interface CacheEntry<V> {
  value: V;
  expiresAt: number;
}

export interface ResponseCacheOptions {
  maxEntries: number;
  ttlMs: number;
  /** Injectable clock for deterministic tests. */
  now: () => number;
}

export class ResponseCache<V> {
  private readonly store = new Map<string, CacheEntry<V>>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;
  private readonly now: () => number;
  private hits = 0;
  private misses = 0;

  constructor(options: Partial<ResponseCacheOptions> = {}) {
    this.maxEntries = options.maxEntries ?? 500;
    this.ttlMs = options.ttlMs ?? 5 * 60 * 1000;
    this.now = options.now ?? Date.now;
  }

  get(key: string): V | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }
    if (entry.expiresAt <= this.now()) {
      this.store.delete(key);
      this.misses++;
      return undefined;
    }
    // Refresh recency.
    this.store.delete(key);
    this.store.set(key, entry);
    this.hits++;
    return entry.value;
  }

  set(key: string, value: V, ttlMs?: number): void {
    if (this.store.has(key)) this.store.delete(key);
    else if (this.store.size >= this.maxEntries) {
      // Evict least-recently-used (first inserted).
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { value, expiresAt: this.now() + (ttlMs ?? this.ttlMs) });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }

  stats(): { hits: number; misses: number; hitRate: number; size: number } {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total === 0 ? 0 : this.hits / total,
      size: this.store.size,
    };
  }
}
