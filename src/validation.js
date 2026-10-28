import { CURRENCIES, DIETARY, EVENT_TYPES, LANGUAGES, LIMITS, STYLES, VENUE_TYPES } from './constants.js';
import { daysBetween, parseIsoDate, todayIso } from './dates.js';
import { cleanText } from './text.js';

export { cleanText };

/** @typedef {import('../types/plan.js').EventInput} EventInput */
/** @typedef {import('../types/plan.js').ChatRequest} ChatRequest */
/** @typedef {import('../types/plan.js').ChatTurn} ChatTurn */
/** @typedef {Record<string, unknown>} Body */

/** Thrown for client errors; `details` lists every problem found. */
export class ValidationError extends Error {
  /** @param {string[]} details */
  constructor(details) {
    super('Invalid request');
    this.name = 'ValidationError';
    this.details = details;
  }
}

const CURRENCY_CODES = Object.keys(CURRENCIES);
const LANGUAGE_CODES = Object.keys(LANGUAGES);
const HISTORY_TEXT_MAX = 1200;

/**
 * @param {unknown} body
 * @returns {Body}
 */
function asObject(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError(['Request body must be a JSON object.']);
  }
  return /** @type {Body} */ (body);
}

/**
 * Reads a field that must be one of `allowed`, recording an error otherwise.
 * `allowed` is a plain list, so prototype keys such as "__proto__" never match.
 * @param {Body} body
 * @param {string} key
 * @param {{ allowed: readonly string[], errors: string[], fallback?: string }} rule
 *   `fallback` is used when the field is absent
 */
function enumField(body, key, { allowed, errors, fallback = '' }) {
  const value = String(body[key] ?? fallback);
  if (!allowed.includes(value)) errors.push(`${key} is not supported.`);
  return value;
}

/**
 * @param {unknown} raw
 * @param {string} today
 * @param {string[]} errors
 */
function dateField(raw, today, errors) {
  const date = String(raw ?? '');
  if (parseIsoDate(date) === null) {
    errors.push('date must be a valid YYYY-MM-DD date.');
    return date;
  }
  const ahead = daysBetween(today, date);
  if (ahead < 0) errors.push('date cannot be in the past.');
  if (ahead > LIMITS.maxDaysAhead) errors.push('date must be within the next 3 years.');
  return date;
}

/**
 * @param {unknown} raw
 * @param {string[]} errors
 */
function guestsField(raw, errors) {
  const guests = Number(raw);
  if (!Number.isInteger(guests) || guests < LIMITS.guestsMin || guests > LIMITS.guestsMax) {
    errors.push(`guests must be a whole number between ${LIMITS.guestsMin} and ${LIMITS.guestsMax}.`);
  }
  return guests;
}

/**
 * @param {unknown} raw
 * @param {string[]} errors
 */
function budgetField(raw, errors) {
  const budget = Number(raw);
  if (!Number.isFinite(budget) || budget < LIMITS.budgetMin || budget > LIMITS.budgetMax) {
    errors.push(`budget must be between ${LIMITS.budgetMin} and ${LIMITS.budgetMax}.`);
  }
  return Math.round(budget);
}

/**
 * @param {unknown} raw
 * @param {string[]} errors
 * @returns {string[]}
 */
function dietaryField(raw, errors) {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.some((d) => !DIETARY.includes(d))) {
    errors.push('dietary contains an unsupported option.');
    return [];
  }
  return [...new Set(/** @type {string[]} */ (raw))];
}

/**
 * Validates and normalises the event-planning form. Every problem is
 * collected so the user can fix them all at once; unknown fields are dropped.
 * @param {unknown} body
 * @param {{ today?: string }} [options]
 * @returns {EventInput}
 */
export function validateEventInput(body, { today = todayIso() } = {}) {
  const b = asObject(body);
  /** @type {string[]} */
  const errors = [];

  const eventType = enumField(b, 'eventType', { allowed: EVENT_TYPES, errors });
  const date = dateField(b.date, today, errors);
  const city = cleanText(b.city, LIMITS.cityMax);
  if (city.length < 2) errors.push('city is required.');
  const guests = guestsField(b.guests, errors);
  const budget = budgetField(b.budget, errors);
  const currency = enumField(b, 'currency', { allowed: CURRENCY_CODES, errors, fallback: 'INR' });
  const style = enumField(b, 'style', { allowed: STYLES, errors, fallback: 'modern' });
  const venueType = enumField(b, 'venueType', { allowed: VENUE_TYPES, errors, fallback: 'undecided' });
  const language = enumField(b, 'language', { allowed: LANGUAGE_CODES, errors, fallback: 'en' });
  const dietary = dietaryField(b.dietary, errors);

  if (errors.length) throw new ValidationError(errors);

  return {
    eventType,
    title: cleanText(b.title, LIMITS.titleMax),
    date,
    city,
    guests,
    budget,
    currency,
    style,
    venueType,
    dietary,
    language,
    notes: cleanText(b.notes, LIMITS.notesMax),
  };
}

/**
 * Keeps the most recent well-formed turns of chat history.
 * @param {unknown} raw
 * @returns {ChatTurn[]}
 */
function chatHistory(raw) {
  if (!Array.isArray(raw)) return [];
  /** @type {ChatTurn[]} */
  const history = [];
  for (const turn of raw.slice(-LIMITS.historyTurns)) {
    if (turn?.role !== 'user' && turn?.role !== 'assistant') continue;
    const text = cleanText(turn.text, HISTORY_TEXT_MAX);
    if (text) history.push({ role: turn.role, text });
  }
  return history;
}

/**
 * Validates a chat request: the event input plus a question and short history.
 * @param {unknown} body
 * @param {{ today?: string }} [options]
 * @returns {ChatRequest}
 */
export function validateChatInput(body, options) {
  const b = asObject(body);
  const event = validateEventInput(b.event, options);
  const question = cleanText(b.question, LIMITS.questionMax);
  if (question.length < 2) throw new ValidationError(['question is required.']);
  return { event, question, history: chatHistory(b.history) };
}
