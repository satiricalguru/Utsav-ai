import { BUDGET_CATEGORIES } from '../constants.js';

/**
 * Gemini response schemas (OpenAPI subset). Structured output makes every
 * response machine-checkable before `sanitise.js` validates it field by field.
 */

const STRING = { type: 'STRING' };
const STRINGS = { type: 'ARRAY', items: STRING };
const CATEGORY = { type: 'STRING', enum: [...BUDGET_CATEGORIES] };

/**
 * An object schema in which every listed property is required.
 * @param {Record<string, object>} properties
 */
const objectOf = (properties) => ({ type: 'OBJECT', properties, required: Object.keys(properties) });

/** @param {object} items */
const listOf = (items) => ({ type: 'ARRAY', items });

export const PLAN_SCHEMA = objectOf({
  headline: STRING,
  summary: STRING,
  themes: listOf(
    objectOf({
      name: STRING,
      description: STRING,
      palette: STRINGS,
      decorIdeas: STRINGS,
      signatureMoment: STRING,
    }),
  ),
  menu: objectOf({ concept: STRING, dishes: STRINGS, dietaryNotes: STRING }),
  guestExperience: STRINGS,
  budgetTips: listOf(objectOf({ category: CATEGORY, tip: STRING, savingPercent: { type: 'NUMBER' } })),
  extraTasks: listOf(objectOf({ title: STRING, daysBefore: { type: 'INTEGER' }, category: CATEGORY })),
  risks: listOf(objectOf({ risk: STRING, mitigation: STRING })),
  daySchedule: listOf(objectOf({ time: STRING, activity: STRING })),
});

export const CHAT_SCHEMA = objectOf({ answer: STRING, followUps: STRINGS });
