/**
 * Small HTTP helpers: typed errors, JSON responses, bounded body parsing and
 * a same-origin check for state-changing requests.
 */

/** @typedef {import('node:http').IncomingMessage} Request */
/** @typedef {import('node:http').ServerResponse} Response */

export const MAX_BODY_BYTES = 16 * 1024;

/** An error that maps directly to an HTTP status and a safe public message. */
export class HttpError extends Error {
  /**
   * @param {number} status
   * @param {string} message
   */
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

/**
 * @param {Response} res
 * @param {number} status
 * @param {unknown} payload
 */
export function sendJson(res, status, payload) {
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
 * @param {Request} req
 * @returns {Promise<unknown>}
 */
export async function readJson(req) {
  const type = String(req.headers['content-type'] ?? '');
  if (!type.toLowerCase().startsWith('application/json')) {
    throw new HttpError(415, 'Content-Type must be application/json');
  }
  if (Number(req.headers['content-length']) > MAX_BODY_BYTES) {
    throw new HttpError(413, 'Request body too large');
  }

  /** @type {Buffer[]} */
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

const ALLOWED_FETCH_SITES = new Set(['same-origin', 'none']);

/**
 * True when a browser sent the request from another site. Uses Fetch
 * Metadata where available and falls back to comparing Origin with Host.
 * Requests without either header (curl, server-to-server) are not browser
 * cross-site requests, so they pass; rate limits still apply to them.
 * @param {Request} req
 */
export function isCrossSite(req) {
  const site = req.headers['sec-fetch-site'];
  if (typeof site === 'string') return !ALLOWED_FETCH_SITES.has(site);
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    return new URL(origin).host !== req.headers.host;
  } catch {
    return true;
  }
}
