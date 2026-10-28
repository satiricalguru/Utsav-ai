/**
 * The Gemini layer: response schemas, prompt construction, output sanitising
 * and the offline fallback. The model supplies creative reasoning; all money
 * and dates come from the deterministic planner engine.
 */
export { CHAT_SCHEMA, PLAN_SCHEMA } from './ai/schemas.js';
export {
  buildChatPrompt,
  buildChatSystemPrompt,
  buildPlanPrompt,
  buildPlanSystemPrompt,
} from './ai/prompts.js';
export { sanitiseChat, sanitisePlanIdeas } from './ai/sanitise.js';
export { fallbackIdeas } from './ai/fallback.js';
export { plainText } from './text.js';
