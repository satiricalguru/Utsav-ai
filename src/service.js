import { createHash } from 'node:crypto';
import {
  CHAT_SCHEMA,
  PLAN_SCHEMA,
  buildChatPrompt,
  buildChatSystemPrompt,
  buildPlanPrompt,
  buildPlanSystemPrompt,
  fallbackIdeas,
  sanitiseChat,
  sanitisePlanIdeas,
} from './ai.js';
import { TtlCache } from './cache.js';
import { todayIso } from './dates.js';
import { buildBasePlan, summarisePlan } from './planner/index.js';
import { buildTimeline } from './planner/timeline.js';

/** @typedef {import('../types/plan.js').AiClient} AiClient */

/**
 * @typedef {object} Logger
 * @property {(msg: string, meta?: object) => void} warn
 */

/**
 * Orchestrates the deterministic planner and the Gemini layer.
 * @param {{ ai: AiClient | null, logger?: Logger, now?: () => number, cache?: TtlCache }} deps
 */
export function createPlannerService({
  ai,
  logger = console,
  now = Date.now,
  cache = new TtlCache({ now }),
}) {
  /**
   * @param {import('./validation.js').EventInput} input
   */
  async function plan(input) {
    const today = todayIso(now());
    const key = createHash('sha256').update(JSON.stringify({ input, today })).digest('hex');
    return cache.getOrCompute(key, () => createPlan(input, today));
  }

  /**
   * @param {import('./validation.js').EventInput} input
   * @param {string} today
   */
  async function createPlan(input, today) {
    const base = buildBasePlan(input, today);
    const amounts = Object.fromEntries(base.budget.lines.map((l) => [l.category, l.amount]));

    /** @type {'gemini' | 'fallback'} */
    let source = 'fallback';
    let ideas;
    if (ai) {
      try {
        const raw = await ai.generateJson({
          system: buildPlanSystemPrompt(input),
          prompt: buildPlanPrompt(input, summarisePlan(input, base)),
          schema: PLAN_SCHEMA,
        });
        ideas = sanitisePlanIdeas(raw, amounts);
        source = 'gemini';
      } catch (err) {
        logger.warn('AI plan generation failed; using fallback', { error: errorMessage(err) });
      }
    }
    ideas ??= fallbackIdeas(input, amounts);

    // Merge AI-suggested tasks into the deterministic timeline so they get real
    // due dates and the same compression rules as every other milestone.
    const timeline = ideas.extraTasks.length ? buildTimeline(input, today, ideas.extraTasks) : base.timeline;
    const { extraTasks: _merged, ...rest } = ideas;

    return {
      input,
      generatedAt: new Date(now()).toISOString(),
      source,
      budget: base.budget,
      timeline,
      vendors: base.vendors,
      ideas: rest,
    };
  }

  /**
   * @param {import('../types/plan.js').ChatRequest} req
   */
  async function chat({ event, question, history }) {
    if (!ai) {
      return {
        source: 'fallback',
        answer:
          'The AI assistant is not configured right now. Your budget, timeline and vendor checklist ' +
          'are still available in the other tabs.',
        followUps: [],
      };
    }
    const base = buildBasePlan(event, todayIso(now()));
    try {
      const raw = await ai.generateJson({
        system: buildChatSystemPrompt(event, summarisePlan(event, base)),
        prompt: buildChatPrompt(question),
        schema: CHAT_SCHEMA,
        temperature: 0.6,
        history,
      });
      return { source: 'gemini', ...sanitiseChat(raw) };
    } catch (err) {
      logger.warn('AI chat failed', { error: errorMessage(err) });
      return {
        source: 'fallback',
        answer: 'Sorry, I could not reach the planning assistant just now. Please try again in a moment.',
        followUps: [],
      };
    }
  }

  return { plan, chat, aiEnabled: Boolean(ai), model: ai?.model ?? null };
}

/** @param {unknown} err */
function errorMessage(err) {
  return err instanceof Error ? err.message : String(err);
}
