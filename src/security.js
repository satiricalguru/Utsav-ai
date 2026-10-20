/**
 * HTTP hardening: security headers and a per-client token-bucket rate limiter.
 */

export const SECURITY_HEADERS = Object.freeze({
  'content-security-policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; '),
  'strict-transport-security': 'max-age=63072000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
});

/**
 * @param {import('node:http').ServerResponse} res
 */
export function applySecurityHeaders(res) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value);
}

/**
 * Token bucket per key. Each key gets `capacity` tokens that refill evenly over
 * `windowMs`. Idle buckets are pruned so memory stays bounded.
 */
export class RateLimiter {
  /**
   * @param {{ capacity: number, windowMs?: number, now?: () => number, maxKeys?: number }} options
   */
  constructor({ capacity, windowMs = 60_000, now = Date.now, maxKeys = 10_000 }) {
    this.capacity = capacity;
    this.refillPerMs = capacity / windowMs;
    this.windowMs = windowMs;
    this.now = now;
    this.maxKeys = maxKeys;
    /** @type {Map<string, { tokens: number, updated: number }>} */
    this.buckets = new Map();
  }

  /**
   * Consumes one token for `key`.
   * @param {string} key
   * @returns {{ allowed: boolean, retryAfterSec: number }}
   */
  take(key) {
    const t = this.now();
    let bucket = this.buckets.get(key);
    if (!bucket) {
      if (this.buckets.size >= this.maxKeys) this.prune(t);
      bucket = { tokens: this.capacity, updated: t };
      this.buckets.set(key, bucket);
    } else {
      bucket.tokens = Math.min(this.capacity, bucket.tokens + (t - bucket.updated) * this.refillPerMs);
      bucket.updated = t;
    }
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { allowed: true, retryAfterSec: 0 };
    }
    return { allowed: false, retryAfterSec: Math.ceil((1 - bucket.tokens) / this.refillPerMs / 1000) };
  }

  /** @param {number} t */
  prune(t) {
    for (const [key, bucket] of this.buckets) {
      if (t - bucket.updated >= this.windowMs) this.buckets.delete(key);
    }
    // Still full (e.g. a flood of unique keys): drop the oldest half.
    if (this.buckets.size >= this.maxKeys) {
      const drop = Math.ceil(this.buckets.size / 2);
      let i = 0;
      for (const key of this.buckets.keys()) {
        if (i++ >= drop) break;
        this.buckets.delete(key);
      }
    }
  }
}

/**
 * Resolves the client address. Behind a trusted proxy (Cloud Run, Render) the
 * left-most X-Forwarded-For entry is used; otherwise the socket address.
 * @param {import('node:http').IncomingMessage} req
 * @param {boolean} trustProxy
 */
export function clientKey(req, trustProxy) {
  if (trustProxy) {
    const fwd = req.headers['x-forwarded-for'];
    const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.socket.remoteAddress ?? 'unknown';
}
