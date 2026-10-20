/**
 * Thin fetch wrapper for the JSON API with a timeout and friendly errors.
 */

export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {string[]} [details]
   */
  constructor(message, details = []) {
    super(message);
    this.details = details;
  }
}

/**
 * @param {string} path
 * @param {unknown} body
 * @param {number} [timeoutMs]
 */
export async function postJson(path, body, timeoutMs = 60_000) {
  let res;
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new ApiError('Could not reach the server. Check your connection and try again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status}).`, data.details);
  return data;
}

export async function getHealth() {
  try {
    const res = await fetch('/api/health', { signal: AbortSignal.timeout(5000) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}
