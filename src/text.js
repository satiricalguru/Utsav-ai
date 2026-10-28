/**
 * Text hygiene shared by request validation and model-output sanitising.
 */

// C0/C1 control characters (except tab and newline), zero-width characters
// and bidirectional overrides, which can hide or reorder text on screen.
// eslint-disable-next-line no-control-regex -- matching control characters is the point.
const UNSAFE_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202E\u2066-\u2069]/g;

/**
 * Removes control, zero-width and bidi-override characters.
 * @param {string} text
 */
export function stripUnsafe(text) {
  return text.replace(UNSAFE_CHARS, '');
}

/**
 * Normalises free text from users: strips unsafe characters, collapses runs of
 * spaces and blank lines, trims and enforces a maximum length.
 * @param {unknown} value
 * @param {number} max
 * @returns {string}
 */
export function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  return stripUnsafe(value)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

/**
 * Normalises one string from model output; anything else becomes ''.
 * @param {unknown} value
 * @param {number} max
 */
export function str(value, max) {
  if (typeof value !== 'string') return '';
  return stripUnsafe(value).trim().slice(0, max);
}

/**
 * Normalises a list of strings from model output, dropping empty entries.
 * @param {unknown} value
 * @param {number} maxItems
 * @param {number} maxLen
 * @returns {string[]}
 */
export function strList(value, maxItems, maxLen) {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => str(v, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

/**
 * The UI renders answers as plain text, so markdown emphasis and headings
 * the model sometimes adds would show up as raw symbols. Bullets ("- ") stay.
 * @param {string} text
 */
export function plainText(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/(^|[\s(])\*(\S[^*\n]*?)\*(?=[\s).,!?:;]|$)/g, '$1$2')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[*•]\s+/gm, '- ');
}
