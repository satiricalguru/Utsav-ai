import { h } from '../dom.js';
import { EVENT_LABELS, daysUntil, formatShortDate } from '../format.js';
import { card, checklistProgress, taskRow } from './ui.js';

/**
 * The Timeline tab: a month-axis Gantt of planning phases, then every task
 * grouped by phase with status pills and calendar links.
 */

/** @typedef {import('../../../types/plan.js').Plan} Plan */
/** @typedef {import('../../../types/plan.js').Milestone} Milestone */
/** @typedef {{ from: string, to: string }} DateRange */

const GANTT_COLOURS = 6;

/**
 * @template T
 * @param {T[]} items
 * @param {(item: T) => string} keyOf
 * @returns {Map<string, T[]>} groups in first-seen order
 */
function groupBy(items, keyOf) {
  /** @type {Map<string, T[]>} */
  const groups = new Map();
  for (const item of items) {
    const key = keyOf(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}

/**
 * Earliest and latest of a set of `YYYY-MM-DD` dates.
 * @param {string[]} dates
 * @returns {DateRange}
 */
function rangeOf(dates) {
  const sorted = [...dates].sort();
  return { from: sorted[0], to: sorted[sorted.length - 1] };
}

/**
 * Month-axis Gantt of the planning phases. Rendered as a list, so every phase
 * and date range is real text; the bars are decorative.
 * @param {Milestone[]} milestones
 * @param {string} today
 * @param {string} eventDate
 */
function gantt(milestones, today, eventDate) {
  const all = rangeOf([today, eventDate, ...milestones.map((m) => m.due)]);
  const span = Math.max(1, daysUntil(all.to, all.from));
  const pos = (/** @type {string} */ date) => (daysUntil(date, all.from) / span) * 100;

  /** @param {string} className @param {string} date */
  const marker = (className, date) => {
    const mark = h('span', { class: className, 'aria-hidden': 'true' });
    mark.style.left = `${pos(date)}%`;
    return mark;
  };

  const rows = [...groupBy(milestones, (m) => m.phase)].map(([phase, items], i) => {
    const range = rangeOf(items.map((m) => m.due));
    const bar = h('span', { class: `gantt-bar g${i % GANTT_COLOURS}`, 'aria-hidden': 'true' });
    // Keep short bars (single-day phases) inside the track at the far end.
    bar.style.left = `min(${pos(range.from)}%, calc(100% - 10px))`;
    bar.style.width = `max(10px, ${pos(range.to) - pos(range.from)}%)`;
    const dates =
      range.from === range.to
        ? formatShortDate(range.from)
        : `${formatShortDate(range.from)} – ${formatShortDate(range.to)}`;
    return h(
      'li',
      null,
      h('span', { class: 'gantt-label' }, h('b', { text: phase }), h('small', { text: dates })),
      h('span', { class: 'gantt-track' }, bar),
    );
  });

  return card('Planning at a glance', 'timeline', [
    h('ol', { class: 'gantt' }, ...rows),
    h(
      'div',
      { class: 'gantt-axis', 'aria-hidden': 'true' },
      marker('gantt-today', today),
      marker('gantt-event', eventDate),
      h('span', { text: formatShortDate(all.from) }),
      h('span', { text: formatShortDate(all.to) }),
    ),
    h(
      'p',
      { class: 'gantt-legend hint' },
      h('span', { class: 'key-today', 'aria-hidden': 'true' }),
      'Today ',
      h('span', { class: 'key-event', 'aria-hidden': 'true' }),
      'Event day',
    ),
  ]);
}

/**
 * @param {Plan} plan
 * @param {Record<string, boolean>} done
 * @param {import('./ui.js').ToggleHandler} onToggle
 * @param {string} today
 */
export function renderTimeline(plan, done, onToggle, today) {
  const { timeline, input } = plan;
  const { milestones } = timeline;
  const daysLeft = Math.max(daysUntil(input.date, today), 0);
  const doneCount = milestones.filter((m) => done[`task:${m.id}`]).length;
  const ctx = {
    done,
    today,
    lang: input.language,
    eventName: input.title || EVENT_LABELS[input.eventType],
    eventDate: input.date,
    idPrefix: 'cb',
    onToggle,
  };

  const notice = timeline.compressed
    ? h('p', {
        class: 'notice notice-warn',
        text:
          `Only ${daysLeft} days to go, so the usual schedule has been compressed. ` +
          'Tasks marked "Do now" are already behind a typical timeline.',
      })
    : h('p', {
        class: 'notice notice-ok',
        text: `${daysLeft} days to go. Every task below is scheduled with a comfortable buffer.`,
      });

  const phases = [...groupBy(milestones, (m) => m.phase)].map(([phase, items]) =>
    h(
      'section',
      { class: 'phase', 'aria-label': phase },
      h('h3', { text: phase }),
      h('ul', { class: 'task-list' }, ...items.map((m) => taskRow(m, ctx))),
    ),
  );

  return [
    notice,
    gantt(milestones, today, input.date),
    h('div', { class: 'panel-card' }, checklistProgress(doneCount, milestones.length, 'timeline'), ...phases),
  ];
}
