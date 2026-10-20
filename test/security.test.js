import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RateLimiter, SECURITY_HEADERS, clientKey } from '../src/security.js';

describe('RateLimiter', () => {
  it('allows up to capacity then refills over time', () => {
    let t = 0;
    const limiter = new RateLimiter({ capacity: 2, windowMs: 1000, now: () => t });
    assert.equal(limiter.take('a').allowed, true);
    assert.equal(limiter.take('a').allowed, true);
    const denied = limiter.take('a');
    assert.equal(denied.allowed, false);
    assert.ok(denied.retryAfterSec >= 1);
    assert.equal(limiter.take('b').allowed, true, 'buckets are per client');
    t = 500;
    assert.equal(limiter.take('a').allowed, true);
  });

  it('keeps memory bounded under a flood of unique clients', () => {
    const limiter = new RateLimiter({ capacity: 1, maxKeys: 10, now: () => 0 });
    for (let i = 0; i < 100; i++) limiter.take(`ip-${i}`);
    assert.ok(limiter.buckets.size <= 10);
  });

  it('prunes idle buckets first', () => {
    let t = 0;
    const limiter = new RateLimiter({ capacity: 1, windowMs: 100, maxKeys: 2, now: () => t });
    limiter.take('old');
    t = 200;
    limiter.take('mid');
    limiter.take('new');
    assert.equal(limiter.buckets.has('old'), false);
    assert.equal(limiter.buckets.has('mid'), true);
  });
});

describe('clientKey', () => {
  const req = (headers, remoteAddress = '10.0.0.1') => ({ headers, socket: { remoteAddress } });

  it('uses the socket address unless the proxy is trusted', () => {
    assert.equal(clientKey(req({ 'x-forwarded-for': '1.2.3.4' }), false), '10.0.0.1');
    assert.equal(clientKey(req({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }), true), '1.2.3.4');
    assert.equal(clientKey(req({}), true), '10.0.0.1');
    assert.equal(clientKey({ headers: {}, socket: {} }, false), 'unknown');
  });
});

describe('SECURITY_HEADERS', () => {
  it('locks scripts to same origin and forbids framing', () => {
    const csp = SECURITY_HEADERS['content-security-policy'];
    assert.match(csp, /script-src 'self'/);
    assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.equal(SECURITY_HEADERS['x-content-type-options'], 'nosniff');
  });
});
