/**
 * Reads configuration from the environment once at startup.
 * @param {NodeJS.ProcessEnv} env
 */
export function loadConfig(env = process.env) {
  const port = Number(env.PORT ?? 8080);
  return {
    port: Number.isInteger(port) && port > 0 && port < 65536 ? port : 8080,
    geminiApiKey: env.GEMINI_API_KEY?.trim() || '',
    // Comma-separated fallback chain, e.g. "gemini-3.6-flash,gemini-2.5-flash".
    geminiModels: (env.GEMINI_MODEL ?? '')
      .split(',')
      .map((m) => m.trim())
      .filter((m) => /^[\w.-]+$/.test(m)),
    trustProxy: env.TRUST_PROXY === '1' || env.TRUST_PROXY === 'true',
    aiRatePerMinute: Number(env.AI_RATE_PER_MINUTE) || 12,
  };
}

/**
 * Structured JSON logger compatible with Google Cloud Logging severity fields.
 */
export const logger = {
  /** @param {string} message @param {object} [meta] */
  info: (message, meta = {}) => console.log(JSON.stringify({ severity: 'INFO', message, ...meta })),
  /** @param {string} message @param {object} [meta] */
  warn: (message, meta = {}) => console.warn(JSON.stringify({ severity: 'WARNING', message, ...meta })),
  /** @param {string} message @param {object} [meta] */
  error: (message, meta = {}) => console.error(JSON.stringify({ severity: 'ERROR', message, ...meta })),
};
