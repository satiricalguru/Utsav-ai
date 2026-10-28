/**
 * Template ideas so the app stays useful when Gemini is unreachable. The plan
 * is labelled `source: "fallback"` so the UI says the AI is offline.
 */

/** @typedef {import('../../types/plan.js').EventInput} EventInput */
/** @typedef {import('../../types/plan.js').DraftIdeas} DraftIdeas */

/** @typedef {{ name: string, palette: string[], decorIdeas: string[] }} ThemeTemplate */

/** @type {Record<string, ThemeTemplate[]>} */
const THEMES = {
  traditional: [
    {
      name: 'Marigold Heritage',
      palette: ['#F2A007', '#B5121B', '#FFF4D6'],
      decorIdeas: [
        'Marigold and mango-leaf torans',
        'Brass diyas along the entrance',
        'Rangoli at the welcome area',
      ],
    },
    {
      name: 'Royal Rajwada',
      palette: ['#7A1F3D', '#D4AF37', '#F7E7CE'],
      decorIdeas: [
        'Draped fabric canopies',
        'Floor seating with bolsters',
        'Lanterns and jharokha photo frame',
      ],
    },
    {
      name: 'Temple Bells',
      palette: ['#8C1C13', '#E0A458', '#FFFBF0'],
      decorIdeas: ['Banana-leaf place settings', 'Jasmine strings', 'Kolam-inspired table runners'],
    },
  ],
  modern: [
    {
      name: 'Garden Glow',
      palette: ['#2F5D50', '#F4D35E', '#FAF9F6'],
      decorIdeas: ['Fairy-light canopy', 'Potted greens as centrepieces', 'Neon sign photo wall'],
    },
    {
      name: 'Monochrome Chic',
      palette: ['#111111', '#C9A227', '#FFFFFF'],
      decorIdeas: ['Black-and-gold balloons', 'Acrylic signage', 'Candle clusters'],
    },
    {
      name: 'Sunset Pastels',
      palette: ['#F6B8B8', '#F9DC5C', '#A0C4FF'],
      decorIdeas: ['Pastel drapes', 'Polaroid guest wall', 'Paper flower backdrop'],
    },
  ],
};

const TIPS = [
  { category: 'decor', tip: 'Reuse ceremony flowers at the dinner tables.', savingPercent: 15 },
  { category: 'stationery', tip: 'Send digital invitations with a WhatsApp RSVP link.', savingPercent: 30 },
  { category: 'catering', tip: 'Choose a seasonal set menu instead of a large buffet.', savingPercent: 10 },
];

const VEG_DISHES = ['Welcome drink', 'Paneer tikka', 'Dal', 'Seasonal sabzi', 'Pulao', 'Rotis', 'Dessert'];
const MIXED_DISHES = ['Welcome drink', 'Paneer tikka', 'Chicken kebab', 'Dal', 'Biryani', 'Rotis', 'Dessert'];
const VEG_DIETS = ['vegetarian', 'vegan', 'jain'];

const GUEST_EXPERIENCE = [
  'A welcome drink on arrival',
  'Seating and water for elders',
  'A kids corner with simple games',
  'Clear signage for washrooms and exits',
];

const RISKS = [
  {
    risk: 'Vendors arriving late',
    mitigation: 'Ask every vendor to arrive 90 minutes early and share one coordinator number.',
  },
  {
    risk: 'Headcount changes',
    mitigation: 'Confirm the final count with the caterer 3 days before and keep a 5% buffer.',
  },
];

/** @param {string} eventType */
const occasion = (eventType) => eventType.replace('_', ' ');

/**
 * @param {EventInput} input
 * @param {Record<string, number>} categoryAmounts
 * @returns {DraftIdeas}
 */
export function fallbackIdeas(input, categoryAmounts) {
  const themes = (THEMES[input.style] ?? THEMES.modern).map((t) => ({
    ...t,
    description: `A ${input.style} look for your ${occasion(input.eventType)} in ${input.city}.`,
    signatureMoment: 'A short heartfelt toast with everyone gathered for one photo.',
  }));
  const veg = input.dietary.some((d) => VEG_DIETS.includes(d));
  const budgetTips = TIPS.filter((t) => categoryAmounts[t.category] > 0).map((t) => ({
    ...t,
    estimatedSaving: Math.round((categoryAmounts[t.category] * t.savingPercent) / 100),
  }));

  return {
    headline: `Your ${occasion(input.eventType)} plan is ready`,
    summary:
      'These template ideas are shown because the AI assistant is temporarily unavailable. ' +
      'Your budget, timeline and vendor checklist are fully calculated.',
    themes,
    menu: {
      concept: veg ? 'Seasonal vegetarian spread' : 'Seasonal mixed spread',
      dishes: veg ? VEG_DISHES : MIXED_DISHES,
      dietaryNotes: input.dietary.length
        ? `Label dishes clearly for: ${input.dietary.join(', ')}.`
        : 'Label every dish clearly.',
    },
    guestExperience: GUEST_EXPERIENCE,
    budgetTips,
    extraTasks: [],
    risks: RISKS,
    daySchedule: [],
  };
}
