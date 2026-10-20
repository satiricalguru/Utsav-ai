/**
 * Small LRU cache with per-entry TTL and in-flight request de-duplication:
 * concurrent callers asking for the same key share a single promise, so an
 * identical plan request never triggers two model calls.
 */
export class TtlCache {
  /**
   * @param {{ max?: number, ttlMs?: number, now?: () => number }} [options]
   */
  constructor({ max = 100, ttlMs = 10 * 60_000, now = Date.now } = {}) {
    this.max = max;
    this.ttlMs = ttlMs;
    this.now = now;
    /** @type {Map<string, { value: unknown, expires: number }>} */
    this.entries = new Map();
    /** @type {Map<string, Promise<unknown>>} */
    this.pending = new Map();
  }

  /** @param {string} key */
  get(key) {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expires <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    // Re-insert to mark as most recently used.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  /**
   * @param {string} key
   * @param {unknown} value
   */
  set(key, value) {
    this.entries.delete(key);
    this.entries.set(key, { value, expires: this.now() + this.ttlMs });
    while (this.entries.size > this.max) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  /**
   * Returns the cached value or computes it once, sharing the in-flight work.
   * Failed computations are not cached.
   * @template T
   * @param {string} key
   * @param {() => Promise<T>} compute
   * @returns {Promise<T>}
   */
  async getOrCompute(key, compute) {
    const hit = this.get(key);
    if (hit !== undefined) return /** @type {T} */ (hit);
    const inFlight = this.pending.get(key);
    if (inFlight) return /** @type {Promise<T>} */ (inFlight);

    const promise = compute()
      .then((value) => {
        this.set(key, value);
        return value;
      })
      .finally(() => this.pending.delete(key));
    this.pending.set(key, promise);
    return promise;
  }
}
