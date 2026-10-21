import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { fileURLToPath } from 'node:url';
import { after, before, describe, it } from 'node:test';
import { createApp } from '../src/app.js';
import { addDays, todayIso } from '../src/dates.js';
import { createPlannerService } from '../src/service.js';
import { loadStaticAssets } from '../src/static.js';
import { aiPlanResponse, eventInput, fakeAi, silentLogger } from './helpers.js';

const publicDir = fileURLToPath(new URL('../public', import.meta.url));
const futureDate = addDays(todayIso(), 90);

/** @type {import('node:http').Server} */
let server;
let base = '';
let failNext = false;

before(async () => {
  const ai = fakeAi((req) => {
    if (failNext) {
      failNext = false;
      throw new Error('model down');
    }
    return req.schema.properties.answer ? { answer: 'Book the caterer first.', followUps: [] } : aiPlanResponse();
  });
  const service = createPlannerService({ ai, logger: silentLogger });
  const assets = await loadStaticAssets(publicDir);
  const app = createApp({ service, assets, logger: silentLogger, rateLimits: { ai: 100 } });
  server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${/** @type {import('node:net').AddressInfo} */ (server.address()).port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

/** @param {string} path @param {unknown} body @param {Record<string, string>} [headers] */
const post = (path, body, headers = {}) =>
  fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });

describe('static assets', () => {
  it('serves the app shell with security headers', async () => {
    const res = await fetch(`${base}/`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    assert.match(res.headers.get('content-security-policy'), /default-src 'self'/);
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.match(await res.text(), /Plan your celebration/);
  });

  it('supports compression and conditional requests', async () => {
    const res = await fetch(`${base}/styles.css`, { headers: { 'accept-encoding': 'br' } });
    assert.equal(res.status, 200);
    const etag = res.headers.get('etag');
    assert.ok(etag);
    await res.arrayBuffer();
    const again = await fetch(`${base}/styles.css`, { headers: { 'if-none-match': etag } });
    assert.equal(again.status, 304);
  });

  it('serves gzip when brotli is not accepted', async () => {
    const res = await new Promise((resolve) => {
      httpRequest(`${base}/js/main.js`, { headers: { 'accept-encoding': 'gzip' } }, resolve).end();
    });
    assert.equal(res.headers['content-encoding'], 'gzip');
    res.resume();
  });

  it('answers HEAD without a body', async () => {
    const res = await fetch(`${base}/index.html`, { method: 'HEAD' });
    assert.equal(res.status, 200);
    assert.equal((await res.text()).length, 0);
  });

  it('cannot escape the public folder', async () => {
    for (const path of ['/../package.json', '/%2e%2e/server.js', '/src/app.js', '/.env']) {
      const res = await fetch(base + path);
      assert.equal(res.status, 404, path);
    }
  });

  it('rejects unsupported methods on static paths', async () => {
    const res = await fetch(`${base}/`, { method: 'DELETE' });
    assert.equal(res.status, 405);
  });
});

describe('API', () => {
  it('reports health', async () => {
    const res = await fetch(`${base}/api/health`);
    assert.deepEqual(await res.json(), { status: 'ok', ai: true });
    assert.equal(res.headers.get('cache-control'), 'no-store');
  });

  it('creates a full plan', async () => {
    const res = await post('/api/plan', eventInput({ date: futureDate }));
    assert.equal(res.status, 200);
    const plan = await res.json();
    assert.equal(plan.source, 'gemini');
    assert.ok(plan.budget.lines.length > 5);
    assert.ok(plan.timeline.milestones.length > 10);
    assert.ok(plan.vendors.length > 5);
    assert.equal(plan.input.city, 'Jaipur');
  });

  it('falls back when the model is down', async () => {
    failNext = true;
    const res = await post('/api/plan', eventInput({ date: futureDate, city: 'Pune' }));
    assert.equal((await res.json()).source, 'fallback');
  });

  it('answers chat questions', async () => {
    const res = await post('/api/chat', { event: eventInput({ date: futureDate }), question: 'What first?' });
    assert.equal((await res.json()).answer, 'Book the caterer first.');
  });

  it('returns validation details for bad input', async () => {
    const res = await post('/api/plan', { eventType: 'rave' });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.details.length > 1);
  });

  it('rejects malformed JSON, wrong content type and oversized bodies', async () => {
    assert.equal((await post('/api/plan', '{bad')).status, 400);
    assert.equal((await fetch(`${base}/api/plan`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'x' })).status, 415);
    assert.equal((await post('/api/plan', 'x'.repeat(20_000))).status, 413);
  });

  it('enforces methods and unknown routes', async () => {
    const wrong = await fetch(`${base}/api/plan`);
    assert.equal(wrong.status, 405);
    assert.equal(wrong.headers.get('allow'), 'POST');
    assert.equal((await fetch(`${base}/api/nope`)).status, 404);
  });

  it('rate-limits AI endpoints per client', async () => {
    const service = createPlannerService({ ai: null });
    const s = createServer(createApp({ service, assets: new Map(), logger: silentLogger, rateLimits: { ai: 2 } }));
    await new Promise((resolve) => s.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${s.address().port}/api/chat`;
    const statuses = [];
    let retryAfter = 0;
    for (let i = 0; i < 3; i++) {
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ event: eventInput({ date: futureDate }), question: `Q${i}` }) });
      await res.arrayBuffer();
      statuses.push(res.status);
      retryAfter = Number(res.headers.get('retry-after') ?? 0);
    }
    await new Promise((resolve) => s.close(resolve));
    assert.deepEqual(statuses, [200, 200, 429]);
    assert.ok(retryAfter >= 1);
  });
});

describe('error handling', () => {
  it('hides internal errors from clients', async () => {
    const errors = [];
    const service = { aiEnabled: false, plan: async () => { throw new Error('secret stack'); }, chat: async () => ({}) };
    const app = createApp({ service, assets: new Map(), logger: { error: (m, meta) => errors.push(meta) } });
    const s = createServer(app);
    await new Promise((resolve) => s.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${s.address().port}/api/plan`;
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(eventInput({ date: futureDate })) });
    const body = await res.json();
    await new Promise((resolve) => s.close(resolve));
    assert.equal(res.status, 500);
    assert.doesNotMatch(JSON.stringify(body), /secret/);
    assert.equal(errors[0].error, 'secret stack');
  });
});

describe('asset caching', () => {
  it('long-caches fonts and photos, revalidates code', async () => {
    const font = await fetch(`${base}/assets/fonts/cormorant-garamond.woff2`);
    assert.equal(font.status, 200);
    assert.equal(font.headers.get('content-type'), 'font/woff2');
    assert.match(font.headers.get('cache-control'), /immutable/);
    await font.arrayBuffer();
    const photo = await fetch(`${base}/assets/img/wedding.webp`);
    assert.equal(photo.headers.get('content-type'), 'image/webp');
    await photo.arrayBuffer();
    const js = await fetch(`${base}/js/landing.js`);
    assert.equal(js.headers.get('cache-control'), 'no-cache');
    await js.arrayBuffer();
  });
});
