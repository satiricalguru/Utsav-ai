import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HttpError, isCrossSite } from '../src/http.js';

/** @param {Record<string, string>} headers */
const req = (headers) => /** @type {import('node:http').IncomingMessage} */ ({ headers });

describe('isCrossSite', () => {
  it('trusts Fetch Metadata when present', () => {
    assert.equal(isCrossSite(req({ 'sec-fetch-site': 'same-origin' })), false);
    assert.equal(isCrossSite(req({ 'sec-fetch-site': 'none' })), false);
    assert.equal(isCrossSite(req({ 'sec-fetch-site': 'cross-site' })), true);
    assert.equal(isCrossSite(req({ 'sec-fetch-site': 'same-site' })), true);
  });

  it('compares Origin with Host otherwise', () => {
    assert.equal(isCrossSite(req({ origin: 'https://app.test', host: 'app.test' })), false);
    assert.equal(isCrossSite(req({ origin: 'https://evil.test', host: 'app.test' })), true);
    assert.equal(isCrossSite(req({ origin: 'not a url', host: 'app.test' })), true);
  });

  it('lets non-browser clients without these headers through', () => {
    assert.equal(isCrossSite(req({})), false);
  });
});

describe('HttpError', () => {
  it('carries a status and a public message', () => {
    const err = new HttpError(418, 'Short and stout');
    assert.equal(err.status, 418);
    assert.equal(err.message, 'Short and stout');
    assert.equal(err.name, 'HttpError');
  });
});
