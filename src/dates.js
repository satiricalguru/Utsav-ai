/**
 * Calendar-date helpers. All dates are plain `YYYY-MM-DD` strings handled in
 * UTC so that results never shift with the server's time zone.
 */

const DAY_MS = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parses a `YYYY-MM-DD` string into a UTC timestamp, or returns null when the
 * string is malformed or names a date that does not exist (e.g. 2026-02-30).
 * @param {unknown} value
 * @returns {number | null}
 */
export function parseIsoDate(value) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const ms = Date.UTC(y, m - 1, d);
  const check = new Date(ms);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    return null;
  }
  return ms;
}

/**
 * @param {number} ms UTC timestamp
 * @returns {string} `YYYY-MM-DD`
 */
export function toIsoDate(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Today's date as `YYYY-MM-DD` (UTC).
 * @param {number} [now]
 */
export function todayIso(now = Date.now()) {
  return toIsoDate(now);
}

/**
 * @param {string} iso
 * @param {number} days may be negative
 */
export function addDays(iso, days) {
  const ms = parseIsoDate(iso);
  if (ms === null) throw new RangeError(`Invalid date: ${iso}`);
  return toIsoDate(ms + days * DAY_MS);
}

/**
 * Whole days from `fromIso` to `toIso` (positive when `toIso` is later).
 * @param {string} fromIso
 * @param {string} toIso
 */
export function daysBetween(fromIso, toIso) {
  const a = parseIsoDate(fromIso);
  const b = parseIsoDate(toIso);
  if (a === null || b === null) throw new RangeError('Invalid date');
  return Math.round((b - a) / DAY_MS);
}
