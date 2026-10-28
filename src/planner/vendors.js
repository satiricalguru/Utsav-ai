import { addDays, daysBetween } from '../dates.js';

/**
 * @typedef {object} VendorTemplate
 * @property {string} id
 * @property {string} name
 * @property {string} category budget category
 * @property {number} lead typical days-before-event to book
 * @property {string[]} ask questions to ask before booking
 * @property {string} search Google Maps search phrase
 */

/** @type {Record<string, VendorTemplate>} */
const VENDORS = {
  venue: {
    id: 'venue',
    name: 'Venue',
    category: 'venue',
    lead: 100,
    search: 'banquet hall',
    ask: [
      'What is included in the rental (chairs, AC, power backup)?',
      'What are the curfew and noise rules?',
      'What is the cancellation and refund policy?',
    ],
  },
  caterer: {
    id: 'caterer',
    name: 'Caterer',
    category: 'catering',
    lead: 75,
    search: 'caterers',
    ask: [
      'What is the per-plate price and what does it include?',
      'Can you handle our dietary needs separately?',
      'Do you supply servers, crockery and cleanup?',
    ],
  },
  decorator: {
    id: 'decorator',
    name: 'Decorator',
    category: 'decor',
    lead: 45,
    search: 'event decorators',
    ask: [
      'Can we see photos of a setup at a similar budget?',
      'Are flowers fresh or artificial, and who removes everything after?',
      'How long does setup take?',
    ],
  },
  photographer: {
    id: 'photographer',
    name: 'Photographer',
    category: 'photography',
    lead: 60,
    search: 'event photographer',
    ask: [
      'How many edited photos and how soon are they delivered?',
      'Is a second shooter or video included?',
      'Who owns the raw files?',
    ],
  },
  entertainment: {
    id: 'entertainment',
    name: 'DJ / performers',
    category: 'entertainment',
    lead: 30,
    search: 'DJ for events',
    ask: [
      'Do you bring your own sound system and backup?',
      'Can we share a must-play and do-not-play list?',
      'What are the overtime charges?',
    ],
  },
  attire: {
    id: 'attire',
    name: 'Attire & styling',
    category: 'attire',
    lead: 60,
    search: 'bridal wear and makeup artist',
    ask: [
      'How many fittings or trials are included?',
      'What is the alteration turnaround?',
      'Do you travel to the venue on the day?',
    ],
  },
  printer: {
    id: 'printer',
    name: 'Invitations & printing',
    category: 'stationery',
    lead: 40,
    search: 'invitation card printers',
    ask: [
      'Can you share a proof before printing?',
      'Do you offer a digital version for WhatsApp?',
      'Are recycled or plantable papers available?',
    ],
  },
  cake: {
    id: 'cake',
    name: 'Cake & desserts',
    category: 'catering',
    lead: 10,
    search: 'custom cake bakery',
    ask: [
      'Can you make it eggless or vegan?',
      'Do you deliver and set up?',
      'How many servings does each size give?',
    ],
  },
  rentals: {
    id: 'rentals',
    name: 'Tent, sound & rentals',
    category: 'logistics',
    lead: 30,
    search: 'tent house and sound rental',
    ask: [
      'Is a generator or power backup included?',
      'What is the plan if it rains?',
      'Who handles setup and teardown?',
    ],
  },
  priest: {
    id: 'priest',
    name: 'Priest / officiant',
    category: 'entertainment',
    lead: 45,
    search: 'pandit for puja',
    ask: [
      'What items should we arrange for the ceremony?',
      'How long does the ceremony take?',
      'What is the dakshina or fee?',
    ],
  },
  transport: {
    id: 'transport',
    name: 'Guest transport',
    category: 'logistics',
    lead: 30,
    search: 'tempo traveller and car rental',
    ask: [
      'Are the driver and fuel included?',
      'What are the waiting charges?',
      'Can you provide a backup vehicle?',
    ],
  },
  security: {
    id: 'security',
    name: 'Security & first aid',
    category: 'logistics',
    lead: 21,
    search: 'event security services',
    ask: [
      'How many guards for our crowd size?',
      'Can you provide a first-aid desk?',
      'Do you coordinate with local police?',
    ],
  },
};

/**
 * Which vendors each event type needs, in rough booking order.
 * @type {Record<string, string[]>}
 */
const BY_TYPE = {
  wedding: [
    'venue',
    'caterer',
    'photographer',
    'attire',
    'decorator',
    'priest',
    'entertainment',
    'printer',
    'transport',
  ],
  engagement: ['venue', 'caterer', 'photographer', 'decorator', 'attire', 'entertainment'],
  birthday: ['venue', 'caterer', 'cake', 'decorator', 'entertainment', 'photographer'],
  anniversary: ['venue', 'caterer', 'cake', 'decorator', 'photographer'],
  baby_shower: ['venue', 'caterer', 'cake', 'decorator', 'photographer'],
  housewarming: ['caterer', 'priest', 'decorator', 'rentals'],
  community: ['venue', 'rentals', 'caterer', 'security', 'entertainment', 'printer', 'photographer'],
  festival: ['venue', 'rentals', 'decorator', 'caterer', 'priest', 'entertainment', 'security'],
};

/**
 * Builds a Google Maps search link for a vendor near the event city.
 * @param {string} phrase
 * @param {string} city
 */
export function mapsSearchUrl(phrase, city) {
  const url = new URL('https://www.google.com/maps/search/');
  url.searchParams.set('api', '1');
  url.searchParams.set('query', `${phrase} in ${city}`);
  return url.toString();
}

/**
 * Builds the vendor checklist with a "book by" date for each vendor.
 * @param {import('../validation.js').EventInput} input
 * @param {string} today
 */
export function buildVendors(input, today) {
  const daysLeft = daysBetween(today, input.date);
  const ids = BY_TYPE[input.eventType].filter((id) => {
    if (input.venueType === 'home' && id === 'venue') return false;
    return true;
  });
  // Outdoor events always need rentals (tent, power) even if the type does not list them.
  if (input.venueType === 'outdoor' && !ids.includes('rentals')) ids.push('rentals');
  // Large gatherings need crowd safety regardless of event type.
  if (input.guests >= 300 && !ids.includes('security')) ids.push('security');

  return ids.map((id) => {
    const v = VENDORS[id];
    const lead = Math.min(v.lead, Math.max(daysLeft - 1, 0));
    return {
      id: v.id,
      name: v.name,
      category: v.category,
      bookBy: addDays(input.date, -lead),
      lateBooking: v.lead > daysLeft,
      questions: [...v.ask],
      mapsUrl: mapsSearchUrl(v.search, input.city),
    };
  });
}
