/** Shared fixtures for tests. */

export const TODAY = '2026-10-20';

/**
 * A valid event input; override any field per test.
 * @param {Partial<import('../src/validation.js').EventInput>} [overrides]
 * @returns {import('../src/validation.js').EventInput}
 */
export function eventInput(overrides = {}) {
  return {
    eventType: 'wedding',
    title: 'Riya & Kabir',
    date: '2027-04-18',
    city: 'Jaipur',
    guests: 200,
    budget: 1_500_000,
    currency: 'INR',
    style: 'traditional',
    venueType: 'outdoor',
    dietary: ['vegetarian', 'jain'],
    language: 'en',
    notes: 'Grandparents attending',
    ...overrides,
  };
}

/** A well-formed AI plan response, as Gemini would return it. */
export function aiPlanResponse() {
  return {
    headline: 'A golden-hour Rajasthani celebration',
    summary: 'Your budget is comfortable for 200 guests and you have plenty of time.',
    themes: [
      { name: 'Marigold Mahal', description: 'Warm marigold courtyard.', palette: ['#F2A007', '#B5121B', 'red'], decorIdeas: ['Torans', 'Diyas'], signatureMoment: 'Lantern release' },
      { name: 'Blue City', description: 'Indigo and white.', palette: ['#1D3557', '#F1FAEE', '#E63946'], decorIdeas: ['Block-print runners'], signatureMoment: 'Folk dance' },
      { name: '', description: 'Missing a name, should be dropped.', palette: [], decorIdeas: [], signatureMoment: '' },
    ],
    menu: { concept: 'Jain-friendly Rajasthani thali', dishes: ['Gatte (Jain)', 'Ker sangri'], dietaryNotes: 'No onion or garlic.' },
    guestExperience: ['Shaded seating for elders'],
    budgetTips: [
      { category: 'decor', tip: 'Reuse ceremony flowers.', savingPercent: 90 },
      { category: 'not_a_category', tip: 'Ignored.', savingPercent: 10 },
    ],
    extraTasks: [{ title: 'Book wheelchair-accessible transport for grandparents', daysBefore: 400, category: 'logistics' }],
    risks: [{ risk: 'April heat', mitigation: 'Evening ceremony with misting fans.' }],
    daySchedule: [
      { time: '19:00', activity: 'Varmala' },
      { time: '17:30', activity: 'Guest arrival' },
      { time: '7pm', activity: 'Invalid time, dropped' },
    ],
  };
}

/**
 * A fake AI client that records calls.
 * @param {(req: any) => unknown} respond
 */
export function fakeAi(respond) {
  const calls = [];
  return {
    calls,
    model: 'fake-model',
    async generateJson(req) {
      calls.push(req);
      return respond(req);
    },
  };
}

export const silentLogger = { info() {}, warn() {}, error() {} };
