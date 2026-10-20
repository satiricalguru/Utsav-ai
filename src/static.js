import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative, sep } from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
};

const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.json', '.svg', '.webmanifest', '.txt']);

/**
 * @typedef {object} StaticAsset
 * @property {Buffer} body
 * @property {Buffer} [gzip]
 * @property {Buffer} [br]
 * @property {string} type
 * @property {string} etag
 * @property {string} cacheControl
 */

/**
 * Loads every file under `root` into memory once at startup, pre-compressed
 * with Brotli and gzip. Only files found here can ever be served, so path
 * traversal is impossible by construction.
 * @param {string} root
 * @returns {Promise<Map<string, StaticAsset>>}
 */
export async function loadStaticAssets(root) {
  /** @type {Map<string, StaticAsset>} */
  const assets = new Map();
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || entry.name.startsWith('.')) continue;
    const full = join(entry.parentPath, entry.name);
    const ext = extname(entry.name).toLowerCase();
    const type = MIME[ext];
    if (!type) continue;
    const body = await readFile(full);
    const urlPath = '/' + relative(root, full).split(sep).join('/');
    const compress = COMPRESSIBLE.has(ext) && body.length > 512;
    assets.set(urlPath, {
      body,
      gzip: compress ? gzipSync(body, { level: 9 }) : undefined,
      br: compress ? brotliCompressSync(body) : undefined,
      type,
      etag: `"${createHash('sha1').update(body).digest('base64url')}"`,
      cacheControl: cacheControlFor(urlPath),
    });
  }
  const index = assets.get('/index.html');
  if (index) assets.set('/', index);
  return assets;
}

/**
 * Fonts and photos under /assets/ never change in place (a changed file gets
 * a new name), so browsers may keep them for a week. HTML, CSS and JS are not
 * content-hashed, so they always revalidate through the ETag (a cheap 304);
 * otherwise a deploy could pair new HTML with stale cached styles or scripts.
 * @param {string} urlPath
 */
export function cacheControlFor(urlPath) {
  if (urlPath.startsWith('/assets/')) return 'public, max-age=604800, immutable';
  return 'no-cache';
}

/**
 * Serves a preloaded asset with conditional GET and content negotiation.
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {StaticAsset} asset
 */
export function sendAsset(req, res, asset) {
  res.setHeader('content-type', asset.type);
  res.setHeader('etag', asset.etag);
  res.setHeader('cache-control', asset.cacheControl);
  res.setHeader('vary', 'accept-encoding');
  if (req.headers['if-none-match'] === asset.etag) {
    res.writeHead(304).end();
    return;
  }
  const accept = String(req.headers['accept-encoding'] ?? '');
  let body = asset.body;
  if (asset.br && /\bbr\b/.test(accept)) {
    res.setHeader('content-encoding', 'br');
    body = asset.br;
  } else if (asset.gzip && /\bgzip\b/.test(accept)) {
    res.setHeader('content-encoding', 'gzip');
    body = asset.gzip;
  }
  res.setHeader('content-length', body.length);
  res.writeHead(200);
  res.end(req.method === 'HEAD' ? undefined : body);
}
