import { BUDGET_CATEGORIES, CURRENCIES } from '../constants.js';

/**
 * Baseline share of the total budget (in percent) for each category, per event
 * type. Every row sums to 100. Figures are typical planning splits, used as a
 * starting point that the style and venue adjustments below then reshape.
 * @type {Record<string, Record<string, number>>}
 */
const BASE_SPLITS = {
  wedding:      { venue: 18, catering: 30, decor: 12, attire: 10, photography: 9, entertainment: 5, stationery: 2, favors: 3, logistics: 3, contingency: 8 },
  engagement:   { venue: 18, catering: 32, decor: 12, attire: 8,  photography: 8, entertainment: 6, stationery: 2, favors: 3, logistics: 3, contingency: 8 },
  birthday:     { venue: 15, catering: 35, decor: 14, attire: 2,  photography: 6, entertainment: 12, stationery: 2, favors: 4, logistics: 2, contingency: 8 },
  anniversary:  { venue: 20, catering: 35, decor: 12, attire: 4,  photography: 8, entertainment: 7, stationery: 2, favors: 3, logistics: 2, contingency: 7 },
  baby_shower:  { venue: 12, catering: 35, decor: 18, attire: 2,  photography: 6, entertainment: 8, stationery: 3, favors: 6, logistics: 2, contingency: 8 },
  housewarming: { venue: 0,  catering: 45, decor: 15, attire: 2,  photography: 5, entertainment: 8, stationery: 2, favors: 6, logistics: 7, contingency: 10 },
  community:    { venue: 20, catering: 28, decor: 10, attire: 0,  photography: 5, entertainment: 14, stationery: 5, favors: 3, logistics: 5, contingency: 10 },
  festival:     { venue: 15, catering: 30, decor: 18, attire: 4,  photography: 5, entertainment: 12, stationery: 2, favors: 3, logistics: 3, contingency: 8 },
};

/** Multipliers applied to a category's share for each style. */
const STYLE_WEIGHTS = {
  traditional: { decor: 1.1, attire: 1.15 },
  modern: {},
  minimal: { decor: 0.6, favors: 0.6, stationery: 0.7 },
  luxury: { decor: 1.35, photography: 1.25, entertainment: 1.2, favors: 1.3 },
  eco: { decor: 0.8, favors: 0.7, stationery: 0.3, logistics: 1.1 },
  playful: { entertainment: 1.35, decor: 1.1 },
};

/**
 * Converts a map of weights to whole percentages summing to exactly 100,
 * using the largest-remainder method so rounding never loses a point.
 * @param {Record<string, number>} weights
 * @returns {Record<string, number>}
 */
export function normalisePercentages(weights) {
  const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
  if (total <= 0) throw new RangeError('Weights must sum to a positive number');
  const raw = Object.entries(weights).map(([key, w]) => {
    const exact = (w / total) * 100;
    return { key, floor: Math.floor(exact), rest: exact - Math.floor(exact) };
  });
  let remaining = 100 - raw.reduce((sum, r) => sum + r.floor, 0);
  raw.sort((a, b) => b.rest - a.rest);
  for (const r of raw) {
    if (remaining <= 0) break;
    r.floor += 1;
    remaining -= 1;
  }
  return Object.fromEntries(raw.map((r) => [r.key, r.floor]));
}

/**
 * Splits `total` into amounts proportional to `percentages`, rounded to `step`,
 * with any rounding difference absorbed by the contingency line so that the
 * amounts always add up to the total exactly.
 * @param {number} total
 * @param {Record<string, number>} percentages
 * @param {number} step
 */
export function allocateAmounts(total, percentages, step) {
  /** @type {Record<string, number>} */
  const amounts = {};
  let allocated = 0;
  for (const [key, pct] of Object.entries(percentages)) {
    if (key === 'contingency') continue;
    const amount = Math.round((total * pct) / 100 / step) * step;
    amounts[key] = amount;
    allocated += amount;
  }
  // Rounding up several lines can overshoot a very small total; trim the
  // largest line until the contingency is no longer negative.
  while (total - allocated < 0) {
    const largest = Object.keys(amounts).reduce((a, b) => (amounts[a] >= amounts[b] ? a : b));
    const cut = Math.min(step, amounts[largest], allocated - total);
    amounts[largest] -= cut;
    allocated -= cut;
  }
  amounts.contingency = total - allocated;
  return amounts;
}

/**
 * Classifies how comfortable the budget is for the guest count.
 * @param {number} cateringAmount
 * @param {number} guests
 * @param {number} plateFloor
 */
export function assessFeasibility(cateringAmount, guests, plateFloor) {
  const perPlate = cateringAmount / guests;
  const ratio = perPlate / plateFloor;
  /** @type {'unrealistic' | 'tight' | 'comfortable' | 'generous'} */
  let level = 'comfortable';
  if (ratio < 0.6) level = 'unrealistic';
  else if (ratio < 1.2) level = 'tight';
  else if (ratio > 4) level = 'generous';
  return { level, perPlate: Math.round(perPlate), ratio: Number(ratio.toFixed(2)) };
}

/**
 * Builds the budget plan for an event.
 * @param {import('../validation.js').EventInput} input
 */
export function buildBudget(input) {
  const { eventType, style, venueType, budget, guests, currency } = input;
  const base = { ...BASE_SPLITS[eventType] };

  // Hosting at home frees most of the venue spend for food and decor.
  if (venueType === 'home' && base.venue > 0) {
    const freed = base.venue - 2;
    base.venue = 2;
    base.catering += freed * 0.6;
    base.decor += freed * 0.25;
    base.logistics += freed * 0.15;
  }
  // Outdoor events need tents, power and weather cover.
  if (venueType === 'outdoor') {
    base.logistics += 3;
    base.contingency += 2;
  }

  const weights = /** @type {Record<string, number>} */ ({});
  for (const category of BUDGET_CATEGORIES) {
    const multiplier = STYLE_WEIGHTS[style]?.[category] ?? 1;
    weights[category] = (base[category] ?? 0) * multiplier;
  }

  const percentages = normalisePercentages(weights);
  const { step, plateFloor } = CURRENCIES[currency];
  const amounts = allocateAmounts(budget, percentages, step);
  const feasibility = assessFeasibility(amounts.catering, guests, plateFloor);

  /** @type {string[]} */
  const warnings = [];
  if (feasibility.level === 'unrealistic') {
    warnings.push('The catering share works out below a realistic per-plate cost. Consider fewer guests, a potluck or a snacks-only menu.');
  } else if (feasibility.level === 'tight') {
    warnings.push('The budget per guest is tight. Prioritise food and venue, and keep decor simple.');
  }
  if (amounts.contingency < budget * 0.05) {
    warnings.push('Contingency is under 5%. Try to keep a buffer for last-minute costs.');
  }

  const lines = BUDGET_CATEGORIES.filter((c) => amounts[c] > 0).map((category) => ({
    category,
    percent: percentages[category],
    amount: amounts[category],
  }));

  return {
    total: budget,
    currency,
    perGuest: Math.round(budget / guests),
    lines,
    feasibility,
    warnings,
  };
}
