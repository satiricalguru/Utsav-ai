import { RateLimiter, applySecurityHeaders, clientKey } from './security.js';
import { sendAsset } from './static.js';
import { ValidationError, validateChatInput, validateEventInput } from './validation.js';

const MAX_BODY_BYTES = 16 * 1024;

class HttpError extends Error {
  /**
   * @param {number} status
   * @param {string} message
   */
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {unknown} payload
 */
function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

/**
 * Reads a JSON request body, enforcing content type and a size cap.
 * @param {import('node:http').IncomingMessage} req
 * @returns {Promise<unknown>}
 */
async function readJson(req) {
  const type = String(req.headers['content-type'] ?? '');
  if (!type.toLowerCase().startsWith('application/json')) {
    throw new HttpError(415, 'Content-Type must be application/json');
  }
  const declared = Number(req.headers['content-length']);
  if (declared > MAX_BODY_BYTES) throw new HttpError(413, 'Request body too large');

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'Request body too large');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Body is not valid JSON');
  }
}

/**
 * @typedef {object} AppDeps
 * @property {ReturnType<typeof import('./service.js').createPlannerService>} service
 * @property {Map<string, import('./static.js').StaticAsset>} assets
 * @property {boolean} [trustProxy]
 * @property {{ error: (msg: string, meta?: object) => void }} [logger]
 * @property {{ ai?: number, general?: number }} [rateLimits] requests per minute
 * @property {() => number} [now]
 */

/**
 * Creates the request handler. Routing is a small explicit table: anything not
 * listed is either a preloaded static asset or a 404.
 * @param {AppDeps} deps
 */
export function createApp({ service, assets, trustProxy = false, logger = console, rateLimits = {}, now = Date.now }) {
  const aiLimiter = new RateLimiter({ capacity: rateLimits.ai ?? 12, now });
  const generalLimiter = new RateLimiter({ capacity: rateLimits.general ?? 240, now });

  /** @type {Record<string, { method: string, ai?: boolean, handler: (req: import('node:http').IncomingMessage) => Promise<[number, unknown]> }>} */
  const routes = {
    '/api/health': {
      method: 'GET',
      handler: async () => [200, { status: 'ok', ai: service.aiEnabled }],
    },
    '/api/plan': {
      method: 'POST',
      ai: true,
      handler: async (req) => {
        const input = validateEventInput(await readJson(req));
        return [200, await service.plan(input)];
      },
    },
    '/api/chat': {
      method: 'POST',
      ai: true,
      handler: async (req) => {
        const request = validateChatInput(await readJson(req));
        return [200, await service.chat(request)];
      },
    },
  };

  /**
   * @param {import('node:http').IncomingMessage} req
   * @param {import('node:http').ServerResponse} res
   */
  return async function handle(req, res) {
    applySecurityHeaders(res);
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    const key = clientKey(req, trustProxy);

    try {
      const route = routes[path];
      if (route) {
        if (req.method !== route.method) {
          res.setHeader('allow', route.method);
          throw new HttpError(405, 'Method not allowed');
        }
        const limit = (route.ai ? aiLimiter : generalLimiter).take(key);
        if (!limit.allowed) {
          res.setHeader('retry-after', String(limit.retryAfterSec));
          throw new HttpError(429, 'Too many requests. Please wait a moment.');
        }
        const [status, payload] = await route.handler(req);
        sendJson(res, status, payload);
        return;
      }

      if (path.startsWith('/api/')) throw new HttpError(404, 'Not found');
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.setHeader('allow', 'GET, HEAD');
        throw new HttpError(405, 'Method not allowed');
      }
      if (!generalLimiter.take(key).allowed) throw new HttpError(429, 'Too many requests');
      const asset = assets.get(path);
      if (!asset) throw new HttpError(404, 'Not found');
      sendAsset(req, res, asset);
    } catch (err) {
      if (res.headersSent) return;
      if (err instanceof ValidationError) {
        sendJson(res, 400, { error: 'Please check the form.', details: err.details });
      } else if (err instanceof HttpError) {
        sendJson(res, err.status, { error: err.message });
      } else {
        // Never leak internals; log server-side only.
        logger.error('Unhandled request error', { path, error: err instanceof Error ? err.message : String(err) });
        sendJson(res, 500, { error: 'Something went wrong. Please try again.' });
      }
    }
  };
}
