/**
 * Display formatting helpers. Pure functions so they run in Node tests too.
 */

export const EVENT_LABELS = Object.freeze({
  wedding: 'Wedding',
  engagement: 'Engagement',
  birthday: 'Birthday',
  anniversary: 'Anniversary',
  baby_shower: 'Baby shower',
  housewarming: 'Housewarming',
  community: 'Community event',
  festival: 'Festival celebration',
});

export const CATEGORY_LABELS = Object.freeze({
  venue: 'Venue',
  catering: 'Food & catering',
  decor: 'Decor & flowers',
  attire: 'Attire & styling',
  photography: 'Photo & video',
  entertainment: 'Entertainment & rituals',
  stationery: 'Invites & stationery',
  favors: 'Gifts & favours',
  logistics: 'Logistics & rentals',
  contingency: 'Contingency buffer',
});

export const FEASIBILITY_TEXT = Object.freeze({
  unrealistic: 'Very tight for this guest count',
  tight: 'Tight but workable',
  comfortable: 'Comfortable',
  generous: 'Generous',
});

/** One colour per budget category, shared by the donut, legend and bars. */
export const CATEGORY_COLORS = Object.freeze({
  venue: '#6e1a37',
  catering: '#d49653',
  decor: '#f2b544',
  attire: '#c46f7e',
  photography: '#3c6e71',
  entertainment: '#8e6bbf',
  stationery: '#7a9e7e',
  favors: '#e07a5f',
  logistics: '#5b7db1',
  contingency: '#a39382',
});

/**
 * Whole days from `fromIso` to `toIso` (both `YYYY-MM-DD`). Computed in the
 * browser so a plan saved days ago still shows a correct countdown.
 * @param {string} toIso
 * @param {string} fromIso
 */
export function daysUntil(toIso, fromIso) {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);
}

/** Today's local date as `YYYY-MM-DD`. @param {Date} [d] */
export function localToday(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Signal-light status for a task, after the Flighty reference: one colour
 * per state so the dashboard reads at a glance.
 * @param {{ due: string, urgent?: boolean }} task
 * @param {boolean} done
 * @param {string} today `YYYY-MM-DD`
 * @returns {{ key: 'done' | 'overdue' | 'now' | 'soon' | 'later', label: string }}
 */
export function taskStatus(task, done, today) {
  if (done) return { key: 'done', label: 'Done' };
  const days = daysUntil(task.due, today);
  if (days < 0) return { key: 'overdue', label: 'Overdue' };
  if (task.urgent || days === 0) return { key: 'now', label: 'Do now' };
  if (days <= 7) return { key: 'soon', label: days === 1 ? 'Tomorrow' : `In ${days} days` };
  return { key: 'later', label: `In ${days} days` };
}

/**
 * The next open tasks, most pressing first.
 * @template {{ id: string, due: string }} T
 * @param {T[]} milestones
 * @param {Record<string, boolean>} done keyed `task:<id>`
 * @param {number} [limit]
 * @returns {T[]}
 */
export function nextTasks(milestones, done, limit = 5) {
  return milestones
    .filter((m) => !done[`task:${m.id}`])
    .sort((a, b) => a.due.localeCompare(b.due))
    .slice(0, limit);
}

/** Intl formatters are expensive to build, so they are cached per currency. */
const moneyFormatters = new Map();

/**
 * @param {number} amount
 * @param {string} currency ISO code
 */
export function formatMoney(amount, currency) {
  let fmt = moneyFormatters.get(currency);
  if (!fmt) {
    fmt = new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    });
    moneyFormatters.set(currency, fmt);
  }
  return fmt.format(amount);
}

const compactFormatters = new Map();

/**
 * Short money for chart centres, e.g. ₹15L or $25K.
 * @param {number} amount
 * @param {string} currency
 */
export function formatMoneyCompact(amount, currency) {
  let fmt = compactFormatters.get(currency);
  if (!fmt) {
    fmt = new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en', { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 });
    compactFormatters.set(currency, fmt);
  }
  return fmt.format(amount);
}

const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** @param {string} iso */
export function formatShortDate(iso) {
  return shortDate.format(new Date(`${iso}T00:00:00Z`));
}

const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** @param {string} iso YYYY-MM-DD */
export function formatDate(iso) {
  return dateFormatter.format(new Date(`${iso}T00:00:00Z`));
}

/**
 * @param {number} days
 */
export function relativeDays(days) {
  if (days === 0) return 'on the day';
  if (days === 1) return '1 day before';
  if (days === -1) return '1 day after';
  return days > 0 ? `${days} days before` : `${-days} days after`;
}

/**
 * Plain-text summary used by "Copy summary".
 * @param {any} plan
 */
export function planToText(plan) {
  const { input, budget, timeline, vendors, ideas } = plan;
  const lines = [
    `${ideas.headline}`,
    `${EVENT_LABELS[input.eventType]} · ${formatDate(input.date)} · ${input.city} · ${input.guests} guests`,
    '',
    `Budget: ${formatMoney(budget.total, budget.currency)} (${FEASIBILITY_TEXT[budget.feasibility.level]})`,
    ...budget.lines.map((l) => `- ${CATEGORY_LABELS[l.category]}: ${formatMoney(l.amount, budget.currency)} (${l.percent}%)`),
    '',
    'Timeline:',
    ...timeline.milestones.map((m) => `- ${formatDate(m.due)}: ${m.title}`),
    '',
    'Vendors to book:',
    ...vendors.map((v) => `- ${v.name} by ${formatDate(v.bookBy)}`),
  ];
  if (ideas.themes?.length) {
    lines.push('', 'Theme ideas:', ...ideas.themes.map((t) => `- ${t.name}: ${t.description}`));
  }
  return lines.join('\n');
}
