import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TtlCache } from '../src/cache.js';
import { createPlannerService } from '../src/service.js';
import { TODAY, aiPlanResponse, eventInput, fakeAi, silentLogger } from './helpers.js';

const now = () => Date.parse(`${TODAY}T10:00:00Z`);

describe('TtlCache', () => {
  it('expires entries after the TTL', () => {
    let t = 0;
    const cache = new TtlCache({ ttlMs: 100, now: () => t });
    cache.set('a', 1);
    assert.equal(cache.get('a'), 1);
    t = 100;
    assert.equal(cache.get('a'), undefined);
  });

  it('evicts the least recently used entry', () => {
    const cache = new TtlCache({ max: 2 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a');
    cache.set('c', 3);
    assert.equal(cache.get('b'), undefined);
    assert.equal(cache.get('a'), 1);
  });

  it('shares in-flight work and does not cache failures', async () => {
    const cache = new TtlCache();
    let runs = 0;
    const slow = () => new Promise((resolve) => setTimeout(() => resolve(++runs), 5));
    const [x, y] = await Promise.all([cache.getOrCompute('k', slow), cache.getOrCompute('k', slow)]);
    assert.equal(x, 1);
    assert.equal(y, 1);
    await assert.rejects(cache.getOrCompute('bad', () => Promise.reject(new Error('boom'))));
    assert.equal(await cache.getOrCompute('bad', async () => 'ok'), 'ok');
  });
});

describe('createPlannerService.plan', () => {
  it('combines engine output with sanitised Gemini ideas', async () => {
    const ai = fakeAi(() => aiPlanResponse());
    const service = createPlannerService({ ai, logger: silentLogger, now });
    const plan = await service.plan(eventInput());
    assert.equal(plan.source, 'gemini');
    assert.equal(plan.ideas.themes.length, 2);
    assert.equal('extraTasks' in plan.ideas, false);
    assert.ok(plan.timeline.milestones.some((m) => m.ai && m.title.includes('wheelchair')));
    assert.equal(plan.budget.lines.reduce((s, l) => s + l.amount, 0), 1_500_000);
    assert.match(ai.calls[0].prompt, /<computed_plan>/);
  });

  it('caches identical requests so the model is called once', async () => {
    const ai = fakeAi(() => aiPlanResponse());
    const service = createPlannerService({ ai, logger: silentLogger, now });
    await Promise.all([service.plan(eventInput()), service.plan(eventInput())]);
    await service.plan(eventInput());
    assert.equal(ai.calls.length, 1);
  });

  it('falls back to templates when the model fails', async () => {
    const warnings = [];
    const ai = fakeAi(() => {
      throw new Error('quota');
    });
    const service = createPlannerService({ ai, logger: { warn: (m) => warnings.push(m) }, now });
    const plan = await service.plan(eventInput());
    assert.equal(plan.source, 'fallback');
    assert.equal(plan.ideas.themes.length, 3);
    assert.equal(warnings.length, 1);
  });

  it('works without any AI client', async () => {
    const service = createPlannerService({ ai: null, now });
    assert.equal(service.aiEnabled, false);
    const plan = await service.plan(eventInput());
    assert.equal(plan.source, 'fallback');
  });
});

describe('createPlannerService.chat', () => {
  const request = { event: eventInput(), question: 'How do I save money?', history: [{ role: 'user', text: 'hi' }] };

  it('returns grounded Gemini answers', async () => {
    const ai = fakeAi(() => ({ answer: 'Cut decor by 20%.', followUps: ['What else?'] }));
    const service = createPlannerService({ ai, logger: silentLogger, now });
    const reply = await service.chat(request);
    assert.deepEqual(reply, { source: 'gemini', answer: 'Cut decor by 20%.', followUps: ['What else?'] });
    assert.match(ai.calls[0].system, /"total":1500000/);
    assert.equal(ai.calls[0].history.length, 1);
  });

  it('degrades gracefully on failure or without AI', async () => {
    const failing = createPlannerService({ ai: fakeAi(() => ({ answer: '' })), logger: silentLogger, now });
    assert.equal((await failing.chat(request)).source, 'fallback');
    const offline = createPlannerService({ ai: null, now });
    assert.match((await offline.chat(request)).answer, /not configured/);
  });
});
