// Two-tier caching:
//   1. In-memory LRU per Node process (fastest, suitable for v1)
//   2. Single-flight: dedupes concurrent calls so 1000 users hitting fetch-campaigns
//      result in ONE upstream call, not 1000.
//
// When you outgrow this (multi-instance deploy), swap getCache for Redis and
// inFlight for a Redis-backed lock. The interface stays the same.

import { LRUCache } from 'lru-cache';
import { log } from './logger';

const cache = new LRUCache<string, { value: unknown; expiresAt: number }>({
  max: 5000,
  ttl: 1000 * 60 * 10, // 10m absolute ceiling; per-entry TTL respected via expiresAt
});

const inFlight = new Map<string, Promise<unknown>>();

export interface CacheOpts {
  /** TTL in ms. 0 disables caching. */
  ttl: number;
  /** When true, bypass read but still write. */
  bypass?: boolean;
}

/**
 * Memoize an async producer with TTL + single-flight.
 * Returns the cached value if fresh, otherwise calls `producer()` once even
 * across concurrent callers, and shares the result.
 */
export async function memo<T>(
  key: string,
  opts: CacheOpts,
  producer: () => Promise<T>,
): Promise<T> {
  if (opts.ttl <= 0) return producer();

  if (!opts.bypass) {
    const hit = cache.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      return hit.value as T;
    }
  }

  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = (async () => {
    try {
      const value = await producer();
      cache.set(key, { value, expiresAt: Date.now() + opts.ttl });
      return value;
    } catch (err) {
      log.warn('cache.producer_failed', { key, err: String(err) });
      throw err;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);
  return promise;
}

export function invalidate(key: string) {
  cache.delete(key);
}

/** Invalidate keys matching a prefix (e.g. all caches for an employee). */
export function invalidatePrefix(prefix: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

export const cacheStats = () => ({ size: cache.size, calculatedSize: cache.calculatedSize });
