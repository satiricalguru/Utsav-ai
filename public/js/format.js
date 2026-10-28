/**
 * Display formatting helpers. Pure functions so they run in Node tests too.
 */

/** @type {Readonly<Record<string, string>>} */
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

/** @type {Readonly<Record<string, string>>} */
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

/** @type {Readonly<Record<string, string>>} */
export const FEASIBILITY_TEXT = Object.freeze({
  unrealistic: 'Very tight for this guest count',
  tight: 'Tight but workable',
  comfortable: 'Comfortable',
  generous: 'Generous',
});

/**
 * One colour per budget category, shared by the donut, legend and bars. The
 * values are CSS variables: a tonal ramp tuned separately for light and dark.
 * @type {Readonly<Record<string, string>>}
 */
export const CATEGORY_COLORS = Object.freeze({
  venue: 'var(--cat-venue)',
  catering: 'var(--cat-catering)',
  decor: 'var(--cat-decor)',
  attire: 'var(--cat-attire)',
  photography: 'var(--cat-photography)',
  entertainment: 'var(--cat-entertainment)',
  stationery: 'var(--cat-stationery)',
  favors: 'var(--cat-favors)',
  logistics: 'var(--cat-logistics)',
  contingency: 'var(--cat-contingency)',
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
  const pad = (/** @type {number} */ n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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
      minimumFractionDigits: 0,
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
    fmt = new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en', {
      style: 'currency',
      currency,
      notation: 'compact',
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    });
    compactFormatters.set(currency, fmt);
  }
  return fmt.format(amount);
}

const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** @param {string} iso */
export function formatShortDate(iso) {
  return shortDate.format(new Date(`${iso}T00:00:00Z`));
}

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

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
 * @param {import('../../types/plan.js').Plan} plan
 */
export function planToText(plan) {
  const { input, budget, timeline, vendors, ideas } = plan;
  const lines = [
    `${ideas.headline}`,
    `${EVENT_LABELS[input.eventType]} · ${formatDate(input.date)} · ${input.city} · ${input.guests} guests`,
    '',
    `Budget: ${formatMoney(budget.total, budget.currency)} (${FEASIBILITY_TEXT[budget.feasibility.level]})`,
    ...budget.lines.map(
      (l) => `- ${CATEGORY_LABELS[l.category]}: ${formatMoney(l.amount, budget.currency)} (${l.percent}%)`,
    ),
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
