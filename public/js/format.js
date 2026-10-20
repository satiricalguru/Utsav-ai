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
