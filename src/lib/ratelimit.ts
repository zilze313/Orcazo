// In-memory sliding-window rate limiter. For multi-instance deploys, swap to
// Redis with a Lua script. Interface unchanged.

import { LRUCache } from 'lru-cache';

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new LRUCache<string, Bucket>({ max: 50_000, ttl: 1000 * 60 * 60 });

export interface RateLimitOpts {
  capacity: number; // max tokens
  refillPerSecond: number;
}

/**
 * Token bucket. Returns { ok, retryAfterMs }.
 *   - ok=true → request allowed, token consumed.
 *   - ok=false → throttle; retryAfterMs is when the next token is available.
 */
export function rateLimit(key: string, opts: RateLimitOpts): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b) {
    b = { tokens: opts.capacity - 1, lastRefill: now };
    buckets.set(key, b);
    return { ok: true, retryAfterMs: 0 };
  }

  // Refill
  const elapsed = (now - b.lastRefill) / 1000;
  const refill = elapsed * opts.refillPerSecond;
  if (refill > 0) {
    b.tokens = Math.min(opts.capacity, b.tokens + refill);
    b.lastRefill = now;
  }

  if (b.tokens >= 1) {
    b.tokens -= 1;
    return { ok: true, retryAfterMs: 0 };
  }
  const retryAfterMs = Math.ceil(((1 - b.tokens) / opts.refillPerSecond) * 1000);
  return { ok: false, retryAfterMs };
}

export const limits = {
  // Per IP, unauthenticated
  ipUnauth:    { capacity: 30,  refillPerSecond: 0.5 },   // 30 burst, 30/min sustained
  // Per IP, OTP requests (defensive: someone could try to spam OTPs)
  ipSendCode:  { capacity: 5,   refillPerSecond: 1 / 60 }, // 5 burst, 1/min sustained
  // Per employee, authenticated
  employee:    { capacity: 120, refillPerSecond: 4 },     // 120 burst, 240/min sustained
  // Submitting posts: tighter, cheap protection against runaway bugs
  submitPost:  { capacity: 10,  refillPerSecond: 1 / 6 }, // 10 burst, 10/min sustained
  // Public marketing signup forms — defense in depth alongside Turnstile.
  publicSignup: { capacity: 5,  refillPerSecond: 1 / 60 }, // 5 burst, 1/min sustained
} satisfies Record<string, RateLimitOpts>;
