import {
  CURRENCIES,
  DIETARY,
  EVENT_TYPES,
  LANGUAGES,
  LIMITS,
  STYLES,
  VENUE_TYPES,
} from './constants.js';
import { daysBetween, parseIsoDate, todayIso } from './dates.js';

/** Thrown for client errors; `details` lists every problem found. */
export class ValidationError extends Error {
  /** @param {string[]} details */
  constructor(details) {
    super('Invalid request');
    this.name = 'ValidationError';
    this.details = details;
  }
}

// Control characters except tab and newline.
const CONTROL_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202E\u2066-\u2069]/g;

/**
 * Normalises free text: removes control and bidi-override characters,
 * collapses runs of whitespace and enforces a maximum length.
 * @param {unknown} value
 * @param {number} max
 * @returns {string}
 */
export function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(CONTROL_CHARS, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
}

/**
 * @typedef {object} EventInput
 * @property {string} eventType
 * @property {string} title
 * @property {string} date
 * @property {string} city
 * @property {number} guests
 * @property {number} budget
 * @property {string} currency
 * @property {string} style
 * @property {string} venueType
 * @property {string[]} dietary
 * @property {string} language
 * @property {string} notes
 */

/**
 * Validates and normalises the event-planning form. Unknown fields are dropped.
 * @param {unknown} body
 * @param {{ today?: string }} [options]
 * @returns {EventInput}
 */
export function validateEventInput(body, { today = todayIso() } = {}) {
  /** @type {string[]} */
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError(['Request body must be a JSON object.']);
  }
  const b = /** @type {Record<string, unknown>} */ (body);

  const eventType = String(b.eventType ?? '');
  if (!EVENT_TYPES.includes(eventType)) errors.push('eventType is not supported.');

  const date = String(b.date ?? '');
  if (parseIsoDate(date) === null) {
    errors.push('date must be a valid YYYY-MM-DD date.');
  } else {
    const ahead = daysBetween(today, date);
    if (ahead < 0) errors.push('date cannot be in the past.');
    if (ahead > LIMITS.maxDaysAhead) errors.push('date must be within the next 3 years.');
  }

  const city = cleanText(b.city, LIMITS.cityMax);
  if (city.length < 2) errors.push('city is required.');

  const guests = Number(b.guests);
  if (!Number.isInteger(guests) || guests < LIMITS.guestsMin || guests > LIMITS.guestsMax) {
    errors.push(`guests must be a whole number between ${LIMITS.guestsMin} and ${LIMITS.guestsMax}.`);
  }

  const budget = Number(b.budget);
  if (!Number.isFinite(budget) || budget < LIMITS.budgetMin || budget > LIMITS.budgetMax) {
    errors.push(`budget must be between ${LIMITS.budgetMin} and ${LIMITS.budgetMax}.`);
  }

  const currency = String(b.currency ?? 'INR');
  if (!Object.hasOwn(CURRENCIES, currency)) errors.push('currency is not supported.');

  const style = String(b.style ?? 'modern');
  if (!STYLES.includes(style)) errors.push('style is not supported.');

  const venueType = String(b.venueType ?? 'undecided');
  if (!VENUE_TYPES.includes(venueType)) errors.push('venueType is not supported.');

  const language = String(b.language ?? 'en');
  if (!Object.hasOwn(LANGUAGES, language)) errors.push('language is not supported.');

  let dietary = /** @type {string[]} */ ([]);
  if (b.dietary !== undefined) {
    if (!Array.isArray(b.dietary) || b.dietary.some((d) => !DIETARY.includes(d))) {
      errors.push('dietary contains an unsupported option.');
    } else {
      dietary = [...new Set(b.dietary)];
    }
  }

  if (errors.length) throw new ValidationError(errors);

  return {
    eventType,
    title: cleanText(b.title, LIMITS.titleMax),
    date,
    city,
    guests,
    budget: Math.round(budget),
    currency,
    style,
    venueType,
    dietary,
    language,
    notes: cleanText(b.notes, LIMITS.notesMax),
  };
}

/**
 * @typedef {{ role: 'user' | 'assistant', text: string }} ChatTurn
 */

/**
 * Validates a chat request: the event input plus a question and short history.
 * @param {unknown} body
 * @param {{ today?: string }} [options]
 * @returns {{ event: EventInput, question: string, history: ChatTurn[] }}
 */
export function validateChatInput(body, options) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError(['Request body must be a JSON object.']);
  }
  const b = /** @type {Record<string, unknown>} */ (body);
  const event = validateEventInput(b.event, options);

  const question = cleanText(b.question, LIMITS.questionMax);
  if (question.length < 2) throw new ValidationError(['question is required.']);

  /** @type {ChatTurn[]} */
  const history = [];
  if (Array.isArray(b.history)) {
    for (const turn of b.history.slice(-LIMITS.historyTurns)) {
      if (turn && (turn.role === 'user' || turn.role === 'assistant')) {
        const text = cleanText(turn.text, 1200);
        if (text) history.push({ role: turn.role, text });
      }
    }
  }
  return { event, question, history };
}
