// ============================================================
// Simple in-memory cache with TTL
// Used to avoid Next.js 2MB fetch-cache limit on bulk Binance responses
// ============================================================

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class SimpleCache {
  private store = new Map<string, CacheEntry<unknown>>();

  set<T>(key: string, data: T, ttlMs: number): void {
    // Sweep expired entries on each write to prevent unbounded growth
    const now = Date.now();
    for (const [k, v] of this.store) {
      if (now > v.expiresAt) this.store.delete(k);
    }
    this.store.set(key, { data, expiresAt: now + ttlMs });
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  delete(key: string): void {
    this.store.delete(key);
  }
}

export const memCache = new SimpleCache();
