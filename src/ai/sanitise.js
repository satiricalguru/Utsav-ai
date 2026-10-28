import { BUDGET_CATEGORIES } from '../constants.js';
import { plainText, str, strList } from '../text.js';

/**
 * Validates model output field by field. Strings are length-capped, colours
 * and times must match strict patterns, categories must be known, numbers are
 * clamped, and any money is computed here from the engine's amounts.
 */

/** @typedef {import('../../types/plan.js').DraftIdeas} DraftIdeas */
/** @typedef {import('../../types/plan.js').MilestoneTemplate} MilestoneTemplate */
/** @typedef {Record<string, any>} Loose untyped model output, checked field by field */

const HEX = /^#[0-9a-f]{6}$/i;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_SAVING_PERCENT = 40;
const MAX_TASK_LEAD_DAYS = 180;

/**
 * @param {unknown} value
 * @param {number} min
 * @param {number} max
 */
function clampNumber(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/** @param {unknown} value @returns {Loose[]} */
const listOf = (value) => (Array.isArray(value) ? value : []);

/** @param {unknown} category */
const isCategory = (category) => typeof category === 'string' && BUDGET_CATEGORIES.includes(category);

/** @param {unknown} raw */
function themes(raw) {
  return listOf(raw)
    .slice(0, 3)
    .map((t) => ({
      name: str(t?.name, 60),
      description: str(t?.description, 300),
      palette: strList(t?.palette, 3, 7).filter((c) => HEX.test(c)),
      decorIdeas: strList(t?.decorIdeas, 4, 160),
      signatureMoment: str(t?.signatureMoment, 200),
    }))
    .filter((t) => t.name && t.description);
}

/**
 * @param {unknown} raw
 * @param {Record<string, number>} categoryAmounts
 */
function budgetTips(raw, categoryAmounts) {
  return listOf(raw)
    .filter((t) => isCategory(t?.category) && categoryAmounts[t.category] > 0)
    .slice(0, 4)
    .map((t) => {
      const savingPercent = Math.round(clampNumber(t.savingPercent, 0, MAX_SAVING_PERCENT));
      return {
        category: String(t.category),
        tip: str(t.tip, 240),
        savingPercent,
        estimatedSaving: Math.round((categoryAmounts[t.category] * savingPercent) / 100),
      };
    })
    .filter((t) => t.tip);
}

/** @param {unknown} raw @returns {MilestoneTemplate[]} */
function extraTasks(raw) {
  return listOf(raw)
    .filter((t) => isCategory(t?.category))
    .slice(0, 4)
    .map((t, i) => ({
      id: `ai-${i + 1}`,
      title: str(t.title, 120),
      lead: Math.round(clampNumber(t.daysBefore, 0, MAX_TASK_LEAD_DAYS)),
      category: String(t.category),
      priority: /** @type {const} */ ('medium'),
      ai: true,
    }))
    .filter((t) => t.title);
}

/** @param {unknown} raw */
function menu(raw) {
  const m = /** @type {Loose} */ (raw && typeof raw === 'object' ? raw : {});
  return {
    concept: str(m.concept, 200),
    dishes: strList(m.dishes, 10, 100),
    dietaryNotes: str(m.dietaryNotes, 300),
  };
}

/** @param {unknown} raw */
function risks(raw) {
  return listOf(raw)
    .slice(0, 4)
    .map((x) => ({ risk: str(x?.risk, 160), mitigation: str(x?.mitigation, 240) }))
    .filter((x) => x.risk && x.mitigation);
}

/** @param {unknown} raw */
function daySchedule(raw) {
  return listOf(raw)
    .map((x) => ({ time: str(x?.time, 5), activity: str(x?.activity, 160) }))
    .filter((x) => TIME.test(x.time) && x.activity)
    .slice(0, 10)
    .sort((a, b) => a.time.localeCompare(b.time));
}

/**
 * Validates the model's plan ideas. Throws when the essentials are missing so
 * that the caller can fall back to template ideas.
 * @param {unknown} raw
 * @param {Record<string, number>} categoryAmounts planned amount per category
 * @returns {DraftIdeas}
 */
export function sanitisePlanIdeas(raw, categoryAmounts) {
  if (!raw || typeof raw !== 'object') throw new Error('AI response is not an object');
  const r = /** @type {Loose} */ (raw);

  const headline = str(r.headline, 120);
  const validThemes = themes(r.themes);
  if (!headline || validThemes.length === 0) throw new Error('AI response is missing essentials');

  return {
    headline,
    summary: str(r.summary, 600),
    themes: validThemes,
    menu: menu(r.menu),
    guestExperience: strList(r.guestExperience, 5, 200),
    budgetTips: budgetTips(r.budgetTips, categoryAmounts),
    extraTasks: extraTasks(r.extraTasks),
    risks: risks(r.risks),
    daySchedule: daySchedule(r.daySchedule),
  };
}

/**
 * @param {unknown} raw
 * @returns {{ answer: string, followUps: string[] }}
 */
export function sanitiseChat(raw) {
  const r = /** @type {Loose} */ (raw && typeof raw === 'object' ? raw : {});
  const answer = plainText(str(r.answer, 1500));
  if (!answer) throw new Error('AI chat response is empty');
  return { answer, followUps: strList(r.followUps, 3, 120) };
}
