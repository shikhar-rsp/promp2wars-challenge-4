/**
 * Coalesces concurrent identical requests into a single upstream call.
 *
 * When 200 fans ask the copilot the same question in the same second, only one
 * request reaches a provider; the other 199 await the same in-flight promise.
 * This is distinct from the response cache: dedup covers the window *before*
 * the first response exists, the cache covers *after*.
 */
export class RequestDeduplicator<V> {
  private readonly inFlight = new Map<string, Promise<V>>();

  /**
   * Returns the shared in-flight promise for `key`, creating it via `factory`
   * if none exists. The entry is cleared once settled so future calls re-run.
   */
  async dedupe(key: string, factory: () => Promise<V>): Promise<V> {
    const existing = this.inFlight.get(key);
    if (existing) return existing;

    const promise = factory().finally(() => {
      this.inFlight.delete(key);
    });
    this.inFlight.set(key, promise);
    return promise;
  }

  get pending(): number {
    return this.inFlight.size;
  }
}
