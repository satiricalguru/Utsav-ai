import { buildBudget } from './budget.js';
import { buildTimeline } from './timeline.js';
import { buildVendors } from './vendors.js';

/**
 * Builds the deterministic core of a plan: budget split, back-scheduled
 * timeline and vendor checklist. These numbers and dates are computed here,
 * never by the model, so the AI layer cannot invent amounts or deadlines.
 * @param {import('../validation.js').EventInput} input
 * @param {string} today `YYYY-MM-DD`
 */
export function buildBasePlan(input, today) {
  return {
    budget: buildBudget(input),
    timeline: buildTimeline(input, today),
    vendors: buildVendors(input, today),
  };
}

/**
 * A compact, prompt-friendly summary of the computed plan. Kept short so the
 * model sees the facts it must respect without wasting tokens.
 * @param {import('../validation.js').EventInput} input
 * @param {ReturnType<typeof buildBasePlan>} plan
 */
export function summarisePlan(input, plan) {
  const { budget, timeline, vendors } = plan;
  return {
    event: {
      type: input.eventType,
      title: input.title || undefined,
      date: input.date,
      daysLeft: timeline.daysLeft,
      city: input.city,
      guests: input.guests,
      style: input.style,
      venue: input.venueType,
      dietary: input.dietary,
    },
    budget: {
      total: budget.total,
      currency: budget.currency,
      perGuest: budget.perGuest,
      feasibility: budget.feasibility.level,
      cateringPerPlate: budget.feasibility.perPlate,
      split: Object.fromEntries(budget.lines.map((l) => [l.category, l.amount])),
    },
    scheduleCompressed: timeline.compressed,
    urgentTasks: timeline.milestones.filter((m) => m.urgent).map((m) => m.title),
    vendors: vendors.map((v) => v.name),
  };
}
