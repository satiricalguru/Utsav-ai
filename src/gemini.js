/**
 * Minimal Gemini REST client (generateContent) with structured JSON output.
 * Resilience: each attempt has a timeout, and when a model is overloaded
 * (429/5xx) the next model in the chain is tried, within an overall time
 * budget so the user never waits indefinitely. The API key is sent in a
 * header, never in the URL, and never leaves the server.
 */

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

export const DEFAULT_MODELS = Object.freeze(['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-3.5-flash']);

export class GeminiError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number, retryable?: boolean }} [info]
   */
  constructor(message, { status, retryable = false } = {}) {
    super(message);
    this.name = 'GeminiError';
    this.status = status;
    this.retryable = retryable;
  }
}

/**
 * Keeps latency low: structured planning output gains little from long
 * reasoning. Gemini 2.5 takes a token budget; Gemini 3+ takes a level.
 * @param {string} model
 */
export function thinkingConfigFor(model) {
  if (/^gemini-2\.5-/.test(model)) return { thinkingBudget: 0 };
  if (/^gemini-[3-9]/.test(model)) return { thinkingLevel: 'low' };
  return undefined;
}

/**
 * @typedef {object} GeminiOptions
 * @property {string} apiKey
 * @property {string[]} [models] tried in order when one is unavailable
 * @property {number} [timeoutMs] per attempt
 * @property {number} [budgetMs] overall time budget across attempts
 * @property {typeof fetch} [fetchImpl] injectable for tests
 * @property {(ms: number) => Promise<void>} [sleep] injectable for tests
 * @property {() => number} [now] injectable for tests
 */

/**
 * @param {GeminiOptions} options
 */
export function createGeminiClient({
  apiKey,
  models = [...DEFAULT_MODELS],
  timeoutMs = 25_000,
  budgetMs = 45_000,
  fetchImpl = globalThis.fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = Date.now,
}) {
  if (!apiKey) throw new Error('A Gemini API key is required');
  if (!models.length) throw new Error('At least one Gemini model is required');
  // A single model gets one retry; a chain tries each model once.
  const attempts = models.length === 1 ? [models[0], models[0]] : [...models];

  /**
   * @param {string} model
   * @param {object} body
   * @param {number} timeout
   */
  async function post(model, body, timeout) {
    let response;
    try {
      response = await fetchImpl(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeout),
      });
    } catch (err) {
      const timedOut = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
      throw new GeminiError(timedOut ? 'Gemini request timed out' : 'Gemini request failed', { retryable: true });
    }
    if (!response.ok) {
      throw new GeminiError(`Gemini returned HTTP ${response.status}`, {
        status: response.status,
        retryable: RETRYABLE.has(response.status),
      });
    }
    return response.json();
  }

  /**
   * Generates a JSON object that conforms to `schema`.
   * @param {{ system: string, prompt: string, schema: object, temperature?: number, history?: {role: string, text: string}[] }} request
   * @returns {Promise<unknown>}
   */
  async function generateJson({ system, prompt, schema, temperature = 0.8, history = [] }) {
    const contents = [
      ...history.map((turn) => ({ role: turn.role === 'assistant' ? 'model' : 'user', parts: [{ text: turn.text }] })),
      { role: 'user', parts: [{ text: prompt }] },
    ];
    const started = now();

    /** @type {unknown} */
    let lastError;
    for (let i = 0; i < attempts.length; i++) {
      const model = attempts[i];
      const remaining = budgetMs - (now() - started);
      if (remaining < 1000) break;
      if (i > 0 && attempts[i - 1] === model) await sleep(600);

      const thinkingConfig = thinkingConfigFor(model);
      const body = {
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: {
          temperature,
          responseMimeType: 'application/json',
          responseSchema: schema,
          ...(thinkingConfig && { thinkingConfig }),
        },
      };

      let data;
      try {
        data = await post(model, body, Math.min(timeoutMs, remaining));
      } catch (err) {
        lastError = err;
        if (err instanceof GeminiError && err.retryable) continue;
        throw err;
      }
      return parseResponse(data);
    }
    throw lastError ?? new GeminiError('Gemini time budget exhausted', { retryable: true });
  }

  return { model: models[0], models: [...models], generateJson };
}

/**
 * @param {any} data
 */
function parseResponse(data) {
  if (data?.promptFeedback?.blockReason) {
    throw new GeminiError(`Prompt blocked: ${data.promptFeedback.blockReason}`);
  }
  const text = data?.candidates?.[0]?.content?.parts?.map((/** @type {any} */ p) => (p.thought ? '' : p.text ?? '')).join('');
  if (!text) throw new GeminiError('Gemini returned an empty response');
  try {
    return JSON.parse(text);
  } catch {
    throw new GeminiError('Gemini returned malformed JSON');
  }
}
