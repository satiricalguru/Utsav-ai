/**
 * Shared enumerations. The server validates every request against these lists,
 * and a test asserts that the <select> options in public/index.html match them.
 */

export const EVENT_TYPES = Object.freeze([
  'wedding',
  'engagement',
  'birthday',
  'anniversary',
  'baby_shower',
  'housewarming',
  'community',
  'festival',
]);

export const STYLES = Object.freeze(['traditional', 'modern', 'minimal', 'luxury', 'eco', 'playful']);

export const VENUE_TYPES = Object.freeze(['indoor', 'outdoor', 'home', 'undecided']);

export const DIETARY = Object.freeze([
  'vegetarian',
  'vegan',
  'jain',
  'halal',
  'gluten_free',
  'nut_free',
  'non_vegetarian',
]);

/** Language codes the AI can answer in, with their text direction. */
export const LANGUAGES = Object.freeze({
  en: { name: 'English', dir: 'ltr' },
  hi: { name: 'Hindi', dir: 'ltr' },
  bn: { name: 'Bengali', dir: 'ltr' },
  ta: { name: 'Tamil', dir: 'ltr' },
  te: { name: 'Telugu', dir: 'ltr' },
  mr: { name: 'Marathi', dir: 'ltr' },
  gu: { name: 'Gujarati', dir: 'ltr' },
  kn: { name: 'Kannada', dir: 'ltr' },
  ml: { name: 'Malayalam', dir: 'ltr' },
  pa: { name: 'Punjabi', dir: 'ltr' },
  ur: { name: 'Urdu', dir: 'rtl' },
  es: { name: 'Spanish', dir: 'ltr' },
  fr: { name: 'French', dir: 'ltr' },
  ar: { name: 'Arabic', dir: 'rtl' },
});

/**
 * Supported currencies. `plateFloor` is a rough minimum cost of one catered
 * plate, used only to flag budgets that are unrealistic per guest.
 * `step` is the rounding unit for allocated amounts.
 */
export const CURRENCIES = Object.freeze({
  INR: { symbol: '₹', plateFloor: 350, step: 100 },
  USD: { symbol: '$', plateFloor: 18, step: 5 },
  EUR: { symbol: '€', plateFloor: 18, step: 5 },
  GBP: { symbol: '£', plateFloor: 15, step: 5 },
  AED: { symbol: 'AED ', plateFloor: 60, step: 10 },
});

export const BUDGET_CATEGORIES = Object.freeze([
  'venue',
  'catering',
  'decor',
  'attire',
  'photography',
  'entertainment',
  'stationery',
  'favors',
  'logistics',
  'contingency',
]);

export const LIMITS = Object.freeze({
  guestsMin: 1,
  guestsMax: 5000,
  budgetMin: 1000,
  budgetMax: 1_000_000_000,
  titleMax: 80,
  cityMax: 60,
  notesMax: 500,
  questionMax: 400,
  historyTurns: 6,
  maxDaysAhead: 3 * 366,
});
