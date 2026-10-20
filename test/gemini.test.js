import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadConfig } from '../src/config.js';
import { DEFAULT_MODELS, GeminiError, createGeminiClient, thinkingConfigFor } from '../src/gemini.js';

/**
 * @param {Array<{ status?: number, body?: unknown } | Error>} responses
 */
function fakeFetch(responses) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return {
      ok: (next.status ?? 200) < 400,
      status: next.status ?? 200,
      json: async () => next.body,
    };
  };
  return { impl, calls };
}

const ok = (obj) => ({ body: { candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] } });
const noSleep = async () => {};
const request = { system: 'sys', prompt: 'hi', schema: { type: 'OBJECT' } };
const modelOf = (call) => call.url.match(/models\/(.+):generateContent/)[1];

describe('createGeminiClient', () => {
  it('requires an API key and at least one model', () => {
    assert.throws(() => createGeminiClient({ apiKey: '' }));
    assert.throws(() => createGeminiClient({ apiKey: 'k', models: [] }));
  });

  it('defaults to the model chain', () => {
    const client = createGeminiClient({ apiKey: 'k' });
    assert.deepEqual(client.models, [...DEFAULT_MODELS]);
    assert.equal(client.model, DEFAULT_MODELS[0]);
  });

  it('sends the key in a header, never the URL, with structured output config', async () => {
    const { impl, calls } = fakeFetch([ok({ a: 1 })]);
    const client = createGeminiClient({ apiKey: 'secret-key', models: ['gemini-3.6-flash'], fetchImpl: impl });
    const result = await client.generateJson({ ...request, history: [{ role: 'assistant', text: 'prev' }] });
    assert.deepEqual(result, { a: 1 });
    const { url, init } = calls[0];
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent');
    assert.ok(!url.includes('secret-key'));
    assert.equal(init.headers['x-goog-api-key'], 'secret-key');
    const body = JSON.parse(init.body);
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.deepEqual(body.generationConfig.responseSchema, { type: 'OBJECT' });
    assert.deepEqual(body.generationConfig.thinkingConfig, { thinkingLevel: 'low' });
    assert.equal(body.systemInstruction.parts[0].text, 'sys');
    assert.deepEqual(body.contents.map((c) => c.role), ['model', 'user']);
  });

  it('falls through the chain when a model is overloaded', async () => {
    const { impl, calls } = fakeFetch([{ status: 503 }, { status: 429 }, ok({ ok: true })]);
    const client = createGeminiClient({ apiKey: 'k', models: ['a', 'b', 'c'], fetchImpl: impl, sleep: noSleep });
    assert.deepEqual(await client.generateJson(request), { ok: true });
    assert.deepEqual(calls.map(modelOf), ['a', 'b', 'c']);
  });

  it('retries a single model once on a transient error', async () => {
    let slept = 0;
    const { impl, calls } = fakeFetch([{ status: 503 }, ok({ ok: true })]);
    const client = createGeminiClient({ apiKey: 'k', models: ['only'], fetchImpl: impl, sleep: async () => void slept++ });
    assert.deepEqual(await client.generateJson(request), { ok: true });
    assert.equal(calls.length, 2);
    assert.equal(slept, 1);
  });

  it('gives up after every model fails on the network', async () => {
    const timeout = Object.assign(new Error('t'), { name: 'TimeoutError' });
    const { impl, calls } = fakeFetch([timeout, new Error('reset')]);
    const client = createGeminiClient({ apiKey: 'k', models: ['a', 'b'], fetchImpl: impl, sleep: noSleep });
    await assert.rejects(client.generateJson(request), /request failed/);
    assert.equal(calls.length, 2);
  });

  it('stops when the overall time budget is spent', async () => {
    let t = 0;
    const impl = async () => {
      t += 30_000;
      return { ok: false, status: 503, json: async () => ({}) };
    };
    const client = createGeminiClient({ apiKey: 'k', models: ['a', 'b', 'c'], budgetMs: 45_000, fetchImpl: impl, now: () => t });
    await assert.rejects(client.generateJson(request), (err) => err instanceof GeminiError && err.status === 503);
    assert.equal(t, 60_000, 'third model is skipped');
  });

  it('reports an exhausted budget before any attempt', async () => {
    const client = createGeminiClient({ apiKey: 'k', models: ['a'], budgetMs: 500, fetchImpl: fakeFetch([]).impl });
    await assert.rejects(client.generateJson(request), /budget exhausted/);
  });

  it('does not retry client errors', async () => {
    const { impl, calls } = fakeFetch([{ status: 400 }]);
    const client = createGeminiClient({ apiKey: 'k', models: ['a', 'b'], fetchImpl: impl, sleep: noSleep });
    await assert.rejects(client.generateJson(request), (err) => err instanceof GeminiError && err.status === 400);
    assert.equal(calls.length, 1);
  });

  it('ignores thought parts and reports blocked, empty and malformed responses', async () => {
    const withThought = { body: { candidates: [{ content: { parts: [{ text: 'thinking…', thought: true }, { text: '{"x":1}' }] } }] } };
    const { impl } = fakeFetch([withThought]);
    assert.deepEqual(await createGeminiClient({ apiKey: 'k', fetchImpl: impl }).generateJson(request), { x: 1 });

    const cases = [
      [{ body: { promptFeedback: { blockReason: 'SAFETY' } } }, /blocked/],
      [{ body: { candidates: [] } }, /empty/],
      [{ body: { candidates: [{ content: { parts: [{ text: '{oops' }] } }] } }, /malformed/],
    ];
    for (const [response, pattern] of cases) {
      const { impl: f } = fakeFetch([response]);
      await assert.rejects(createGeminiClient({ apiKey: 'k', fetchImpl: f }).generateJson(request), pattern);
    }
  });
});

describe('thinkingConfigFor', () => {
  it('uses a zero budget on 2.5 models and a low level on 3+ models', () => {
    assert.deepEqual(thinkingConfigFor('gemini-2.5-flash'), { thinkingBudget: 0 });
    assert.deepEqual(thinkingConfigFor('gemini-3.6-flash'), { thinkingLevel: 'low' });
    assert.equal(thinkingConfigFor('gemini-flash-latest'), undefined);
  });
});

describe('loadConfig', () => {
  it('parses the model chain and ignores unsafe names', () => {
    const config = loadConfig({ GEMINI_MODEL: 'gemini-3.6-flash, gemini-2.5-flash ,../evil,', PORT: '3000', TRUST_PROXY: '1' });
    assert.deepEqual(config.geminiModels, ['gemini-3.6-flash', 'gemini-2.5-flash']);
    assert.equal(config.port, 3000);
    assert.equal(config.trustProxy, true);
  });

  it('falls back to safe defaults', () => {
    const config = loadConfig({ PORT: 'abc' });
    assert.equal(config.port, 8080);
    assert.deepEqual(config.geminiModels, []);
    assert.equal(config.geminiApiKey, '');
    assert.equal(config.aiRatePerMinute, 12);
  });
});
