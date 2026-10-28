import { HttpError, isCrossSite, readJson, sendJson } from './http.js';
import { RateLimiter, applySecurityHeaders, clientKey } from './security.js';
import { sendAsset } from './static.js';
import { ValidationError, validateChatInput, validateEventInput } from './validation.js';

/** @typedef {import('node:http').IncomingMessage} Request */
/** @typedef {import('node:http').ServerResponse} Response */
/** @typedef {ReturnType<typeof import('./service.js').createPlannerService>} PlannerService */

/**
 * @typedef {object} Route
 * @property {'GET' | 'POST'} method
 * @property {boolean} [ai] uses the stricter AI rate limit
 * @property {(req: Request) => Promise<unknown>} handler returns the JSON payload
 */

/**
 * @typedef {object} AppDeps
 * @property {PlannerService} service
 * @property {Map<string, import('./static.js').StaticAsset>} assets
 * @property {boolean} [trustProxy]
 * @property {{ error: (msg: string, meta?: object) => void }} [logger]
 * @property {{ ai?: number, general?: number }} [rateLimits] requests per minute
 * @property {() => number} [now]
 */

const DEFAULT_AI_RATE = 12;
const DEFAULT_GENERAL_RATE = 240;

/**
 * The API surface: an explicit table, so nothing is routed by accident.
 * @param {PlannerService} service
 * @returns {Record<string, Route>}
 */
function apiRoutes(service) {
  return {
    '/api/health': {
      method: 'GET',
      handler: async () => ({ status: 'ok', ai: service.aiEnabled }),
    },
    '/api/plan': {
      method: 'POST',
      ai: true,
      handler: async (req) => service.plan(validateEventInput(await readJson(req))),
    },
    '/api/chat': {
      method: 'POST',
      ai: true,
      handler: async (req) => service.chat(validateChatInput(await readJson(req))),
    },
  };
}

/**
 * Sends the right response for any error without leaking internals.
 * @param {Response} res
 * @param {unknown} err
 * @param {string} path
 * @param {{ error: (msg: string, meta?: object) => void }} logger
 */
function sendError(res, err, path, logger) {
  if (res.headersSent) return;
  if (err instanceof ValidationError) {
    sendJson(res, 400, { error: 'Please check the form.', details: err.details });
  } else if (err instanceof HttpError) {
    sendJson(res, err.status, { error: err.message });
  } else {
    logger.error('Unhandled request error', {
      path,
      error: err instanceof Error ? err.message : String(err),
    });
    sendJson(res, 500, { error: 'Something went wrong. Please try again.' });
  }
}

/**
 * Creates the request handler: API routes from the table above, otherwise a
 * preloaded static asset, otherwise 404.
 * @param {AppDeps} deps
 */
export function createApp({
  service,
  assets,
  trustProxy = false,
  logger = console,
  rateLimits = {},
  now = Date.now,
}) {
  const aiLimiter = new RateLimiter({ capacity: rateLimits.ai ?? DEFAULT_AI_RATE, now });
  const generalLimiter = new RateLimiter({ capacity: rateLimits.general ?? DEFAULT_GENERAL_RATE, now });
  const routes = apiRoutes(service);

  /**
   * @param {Route} route
   * @param {Request} req
   * @param {Response} res
   * @param {string} key client key for rate limiting
   */
  async function handleApi(route, req, res, key) {
    if (req.method !== route.method) {
      res.setHeader('allow', route.method);
      throw new HttpError(405, 'Method not allowed');
    }
    if (route.method === 'POST' && isCrossSite(req)) {
      throw new HttpError(403, 'Cross-site requests are not allowed');
    }
    const limit = (route.ai ? aiLimiter : generalLimiter).take(key);
    if (!limit.allowed) {
      res.setHeader('retry-after', String(limit.retryAfterSec));
      throw new HttpError(429, 'Too many requests. Please wait a moment.');
    }
    sendJson(res, 200, await route.handler(req));
  }

  /**
   * @param {Request} req
   * @param {Response} res
   * @param {string} path
   * @param {string} key
   */
  function handleStatic(req, res, path, key) {
    if (path.startsWith('/api/')) throw new HttpError(404, 'Not found');
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('allow', 'GET, HEAD');
      throw new HttpError(405, 'Method not allowed');
    }
    if (!generalLimiter.take(key).allowed) throw new HttpError(429, 'Too many requests');
    const asset = assets.get(path);
    if (!asset) throw new HttpError(404, 'Not found');
    sendAsset(req, res, asset);
  }

  /**
   * @param {Request} req
   * @param {Response} res
   */
  return async function handle(req, res) {
    applySecurityHeaders(res);
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    const key = clientKey(req, trustProxy);
    try {
      const route = routes[path];
      if (route) await handleApi(route, req, res, key);
      else handleStatic(req, res, path, key);
    } catch (err) {
      sendError(res, err, path, logger);
    }
  };
}
