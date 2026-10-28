import { ring } from '../charts.js';
import { h } from '../dom.js';
import {
  EVENT_LABELS,
  FEASIBILITY_TEXT,
  daysUntil,
  formatDate,
  formatMoney,
  formatShortDate,
  nextTasks,
} from '../format.js';
import {
  budgetDonut,
  card,
  langAttrs,
  linkButton,
  moodSwatches,
  pill,
  progressBar,
  riskList,
  scheduleList,
  taskRow,
} from './ui.js';

/**
 * The Overview tab: countdown, budget health, progress rings, budget donut,
 * the next tasks, a moodboard and the event-day run sheet.
 */

/** @typedef {import('../../../types/plan.js').Plan} Plan */
/** @typedef {import('../../../types/plan.js').FeasibilityLevel} FeasibilityLevel */
/** @typedef {{ done: Record<string, boolean>, actuals: Record<string, number> }} Progress */
/**
 * @typedef {object} OverviewContext
 * @property {string} today `YYYY-MM-DD`
 * @property {import('./ui.js').ToggleHandler} onToggle
 * @property {(tabId: string) => void} onNavigate
 */

const UP_NEXT_COUNT = 5;

/** Signal colours and labels for budget health, after the Flighty status system. */
/** @type {Record<FeasibilityLevel, [string, string]>} */
const HEALTH_PILL = {
  unrealistic: ['overdue', 'Review'],
  tight: ['soon', 'Watch'],
  comfortable: ['done', 'On track'],
  generous: ['done', 'On track'],
};

/**
 * A metric tile. `visual` sits beside the text (a ring) or, with `stack`, under it (a pill).
 * @param {{ label: string, value: string, sub: string, visual: Node, stack?: boolean }} tile
 */
function kpi({ label, value, sub, visual, stack = false }) {
  return h(
    'div',
    { class: 'kpi' },
    h(
      'div',
      { class: 'kpi-text' },
      h('p', { class: 'kpi-label', text: label }),
      h('p', { class: 'kpi-value', text: value }),
      h('p', { class: 'kpi-sub', text: sub }),
      stack ? visual : null,
    ),
    stack ? null : visual,
  );
}

/**
 * @param {Plan} plan
 * @param {Progress} progress
 * @param {string} today
 */
function kpiGrid(plan, progress, today) {
  const { input, budget, timeline, vendors } = plan;
  const daysLeft = daysUntil(input.date, today);
  const window = Math.max(1, daysUntil(input.date, plan.generatedAt.slice(0, 10)));
  const used = window - Math.max(daysLeft, 0);
  const tasksDone = timeline.milestones.filter((m) => progress.done[`task:${m.id}`]).length;
  const booked = vendors.filter((v) => progress.done[`vendor:${v.id}`]).length;
  const [healthKey, healthLabel] = HEALTH_PILL[budget.feasibility.level];
  const taskCount = timeline.milestones.length;

  return h(
    'div',
    { class: 'kpi-grid' },
    kpi({
      label: 'Countdown',
      value: daysLeft > 0 ? String(daysLeft) : daysLeft === 0 ? 'Today' : 'Done',
      sub: daysLeft > 0 ? `days to ${formatDate(input.date)}` : formatDate(input.date),
      visual: ring(
        used,
        window,
        `Planning time used: ${Math.round((used / window) * 100)}%`,
        'var(--accent-soft)',
      ),
    }),
    kpi({
      label: 'Budget health',
      value: FEASIBILITY_TEXT[budget.feasibility.level],
      sub: `${formatMoney(budget.perGuest, budget.currency)} per guest`,
      visual: pill(healthKey, healthLabel),
      stack: true,
    }),
    kpi({
      label: 'Tasks',
      value: `${tasksDone}/${taskCount}`,
      sub: 'checklist done',
      visual: ring(tasksDone, taskCount, `Tasks done: ${tasksDone} of ${taskCount}`, 'var(--ok)'),
    }),
    kpi({
      label: 'Vendors',
      value: `${booked}/${vendors.length}`,
      sub: 'booked and confirmed',
      visual: ring(booked, vendors.length, `Vendors booked: ${booked} of ${vendors.length}`, 'var(--text)'),
    }),
  );
}

/**
 * @param {Plan} plan
 * @param {Progress} progress
 * @param {OverviewContext} ctx
 */
function budgetCard(plan, progress, ctx) {
  const { budget } = plan;
  const spent = budget.lines.reduce((sum, l) => sum + (progress.actuals[l.category] ?? 0), 0);
  const money = (/** @type {number} */ n) => formatMoney(n, budget.currency);
  return card('Budget overview', 'budget', [
    budgetDonut(budget),
    h(
      'div',
      { class: 'spent' },
      progressBar(spent, budget.total, 'ov-spent-label', `Spent ${money(spent)} of ${money(budget.total)}`),
    ),
    linkButton('Track spending →', () => ctx.onNavigate('tab-budget')),
  ]);
}

/**
 * @param {Plan} plan
 * @param {Progress} progress
 * @param {OverviewContext} ctx
 */
function upNextCard(plan, progress, ctx) {
  const { input, timeline } = plan;
  const taskCtx = {
    done: progress.done,
    today: ctx.today,
    lang: input.language,
    eventName: input.title || EVENT_LABELS[input.eventType],
    eventDate: input.date,
    idPrefix: 'ov',
    onToggle: ctx.onToggle,
  };
  const upcoming = nextTasks(timeline.milestones, progress.done, UP_NEXT_COUNT);
  return card('Up next', 'timeline', [
    upcoming.length
      ? h('ul', { class: 'task-list compact' }, ...upcoming.map((m) => taskRow(m, taskCtx)))
      : h('p', { class: 'notice notice-ok', text: 'Every task is done. Time to celebrate!' }),
    linkButton('See full timeline →', () => ctx.onNavigate('tab-timeline')),
  ]);
}

/**
 * The lead theme as a moodboard, if the plan has one.
 * @param {Plan} plan
 * @param {OverviewContext} ctx
 */
function moodCard(plan, ctx) {
  const theme = plan.ideas.themes[0];
  if (!theme) return null;
  return card('Moodboard', 'ideas', [
    moodSwatches(theme.palette),
    h(
      'div',
      langAttrs(plan.input.language),
      h('p', { class: 'mood-name', text: theme.name }),
      h('p', { class: 'muted', text: theme.description }),
      theme.signatureMoment
        ? h('p', null, h('strong', { text: 'Signature moment: ' }), theme.signatureMoment)
        : null,
    ),
    linkButton('All ideas →', () => ctx.onNavigate('tab-ideas')),
  ]);
}

/**
 * The run sheet when there is one, otherwise the risks to watch.
 * @param {Plan} plan
 */
function dayCard(plan) {
  const { ideas, input } = plan;
  if (ideas.daySchedule.length) {
    return card(`Run sheet · ${formatShortDate(input.date)}`, 'calendar', [
      scheduleList(ideas.daySchedule, input.language),
    ]);
  }
  if (ideas.risks.length) return card('Watch out for', 'bulb', [riskList(ideas.risks, input.language)]);
  return null;
}

/**
 * @param {Plan} plan
 * @param {Progress} progress
 * @param {OverviewContext} ctx
 */
export function renderOverview(plan, progress, ctx) {
  return [
    kpiGrid(plan, progress, ctx.today),
    h('div', { class: 'dash-grid' }, budgetCard(plan, progress, ctx), upNextCard(plan, progress, ctx)),
    h('div', { class: 'dash-grid' }, moodCard(plan, ctx), dayCard(plan)),
  ];
}
