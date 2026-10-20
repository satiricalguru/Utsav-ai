import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createApp } from './src/app.js';
import { loadConfig, logger } from './src/config.js';
import { DEFAULT_MODELS, createGeminiClient } from './src/gemini.js';
import { createPlannerService } from './src/service.js';
import { loadStaticAssets } from './src/static.js';

const config = loadConfig();
const publicDir = fileURLToPath(new URL('./public', import.meta.url));

const models = config.geminiModels.length ? config.geminiModels : [...DEFAULT_MODELS];
const ai = config.geminiApiKey ? createGeminiClient({ apiKey: config.geminiApiKey, models }) : null;
if (!ai) logger.warn('GEMINI_API_KEY is not set; AI features will use offline templates.');

const service = createPlannerService({ ai, logger });
const assets = await loadStaticAssets(publicDir);
const app = createApp({
  service,
  assets,
  trustProxy: config.trustProxy,
  logger,
  rateLimits: { ai: config.aiRatePerMinute },
});

const server = createServer(app);
server.headersTimeout = 15_000;
server.requestTimeout = 60_000;
server.keepAliveTimeout = 65_000;

server.listen(config.port, () => {
  logger.info('Utsav AI listening', { port: config.port, ai: Boolean(ai), models: ai?.models });
});

// Cloud Run sends SIGTERM before stopping an instance; finish in-flight work.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    logger.info('Shutting down', { signal });
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
