import { addDays, daysBetween } from '../dates.js';

/**
 * @typedef {object} MilestoneTemplate
 * @property {string} id
 * @property {string} title
 * @property {number} lead days before the event (negative = after)
 * @property {string} category budget category the task relates to
 * @property {'high' | 'medium' | 'low'} priority
 * @property {boolean} [ai] suggested by the model rather than the template
 */

/** @type {MilestoneTemplate[]} */
const COMMON = [
  { id: 'budget', title: 'Agree the budget and guest list with co-hosts', lead: 120, category: 'contingency', priority: 'high' },
  { id: 'venue', title: 'Shortlist and book the venue', lead: 100, category: 'venue', priority: 'high' },
  { id: 'caterer', title: 'Book the caterer and confirm dietary needs', lead: 75, category: 'catering', priority: 'high' },
  { id: 'invites', title: 'Send invitations', lead: 30, category: 'stationery', priority: 'high' },
  { id: 'decor', title: 'Finalise decor theme and order supplies', lead: 21, category: 'decor', priority: 'medium' },
  { id: 'rsvp', title: 'Chase RSVPs and lock the headcount', lead: 10, category: 'catering', priority: 'high' },
  { id: 'confirm', title: 'Reconfirm every vendor: time, address, payment', lead: 5, category: 'logistics', priority: 'high' },
  { id: 'runsheet', title: 'Share the day-of run sheet with helpers', lead: 2, category: 'logistics', priority: 'medium' },
  { id: 'kit', title: 'Pack an emergency kit (tape, pins, chargers, first aid)', lead: 1, category: 'contingency', priority: 'low' },
  { id: 'day', title: 'Event day: enjoy it, delegate the rest', lead: 0, category: 'entertainment', priority: 'high' },
  { id: 'thanks', title: 'Send thank-you notes and settle final payments', lead: -5, category: 'stationery', priority: 'medium' },
];

/** Extra milestones per event type; lead times reflect typical booking windows. */
/** @type {Record<string, MilestoneTemplate[]>} */
const BY_TYPE = {
  wedding: [
    { id: 'savedate', title: 'Send save-the-dates', lead: 150, category: 'stationery', priority: 'medium' },
    { id: 'photo', title: 'Book photographer and videographer', lead: 140, category: 'photography', priority: 'high' },
    { id: 'attire', title: 'Order wedding attire and schedule fittings', lead: 90, category: 'attire', priority: 'high' },
    { id: 'rituals', title: 'Confirm officiant or priest and ceremony rituals', lead: 60, category: 'entertainment', priority: 'medium' },
    { id: 'stay', title: 'Block hotel rooms and plan guest transport', lead: 60, category: 'logistics', priority: 'medium' },
    { id: 'tasting', title: 'Menu tasting with the caterer', lead: 30, category: 'catering', priority: 'medium' },
    { id: 'beauty', title: 'Trial run with makeup and mehendi artists', lead: 20, category: 'attire', priority: 'low' },
  ],
  engagement: [
    { id: 'rings', title: 'Choose and size the rings', lead: 45, category: 'attire', priority: 'high' },
    { id: 'photo', title: 'Book a photographer', lead: 40, category: 'photography', priority: 'medium' },
  ],
  birthday: [
    { id: 'cake', title: 'Order the cake', lead: 10, category: 'catering', priority: 'high' },
    { id: 'fun', title: 'Book entertainment (DJ, magician, games host)', lead: 30, category: 'entertainment', priority: 'medium' },
    { id: 'favors', title: 'Prepare return gifts', lead: 7, category: 'favors', priority: 'low' },
  ],
  anniversary: [
    { id: 'memories', title: 'Collect photos and messages for a memory wall', lead: 21, category: 'decor', priority: 'medium' },
    { id: 'cake', title: 'Order the cake', lead: 10, category: 'catering', priority: 'medium' },
  ],
  baby_shower: [
    { id: 'games', title: 'Plan games and a gift-opening slot', lead: 14, category: 'entertainment', priority: 'medium' },
    { id: 'registry', title: 'Share the gift registry with the invite', lead: 30, category: 'stationery', priority: 'low' },
  ],
  housewarming: [
    { id: 'puja', title: 'Fix the ceremony or puja time and book the priest', lead: 21, category: 'entertainment', priority: 'medium' },
    { id: 'neighbours', title: 'Inform neighbours and arrange parking', lead: 3, category: 'logistics', priority: 'low' },
  ],
  community: [
    { id: 'permits', title: 'Apply for permits and police or society permission', lead: 45, category: 'logistics', priority: 'high' },
    { id: 'volunteers', title: 'Recruit volunteers and assign roles', lead: 30, category: 'logistics', priority: 'high' },
    { id: 'sponsors', title: 'Approach local sponsors', lead: 60, category: 'contingency', priority: 'medium' },
    { id: 'promo', title: 'Promote on social media and notice boards', lead: 21, category: 'stationery', priority: 'medium' },
    { id: 'safety', title: 'Plan first aid, exits and lost-and-found', lead: 7, category: 'logistics', priority: 'high' },
  ],
  festival: [
    { id: 'sound', title: 'Book sound, lights and stage', lead: 30, category: 'entertainment', priority: 'high' },
    { id: 'volunteers', title: 'Recruit volunteers and assign roles', lead: 21, category: 'logistics', priority: 'medium' },
    { id: 'sweets', title: 'Order sweets and prasad', lead: 7, category: 'catering', priority: 'medium' },
  ],
};

/** Venue booking is skipped when hosting at home. */
const SKIP_FOR_HOME = new Set(['venue']);

const PHASES = [
  { name: 'Plan', minLead: 90 },
  { name: 'Book', minLead: 30 },
  { name: 'Prepare', minLead: 8 },
  { name: 'Final week', minLead: 1 },
  { name: 'Event day', minLead: 0 },
  { name: 'Wrap-up', minLead: -Infinity },
];

/** @param {number} lead */
function phaseFor(lead) {
  return PHASES.find((p) => lead >= p.minLead)?.name ?? 'Wrap-up';
}

/**
 * Returns the milestone templates for an event, honouring the venue choice.
 * @param {string} eventType
 * @param {string} venueType
 */
export function templatesFor(eventType, venueType) {
  const byId = new Map();
  for (const t of [...COMMON, ...(BY_TYPE[eventType] ?? [])]) byId.set(t.id, t);
  if (venueType === 'home') for (const id of SKIP_FOR_HOME) byId.delete(id);
  return [...byId.values()];
}

/**
 * Schedules milestones backwards from the event date. When the event is closer
 * than the longest lead time, pre-event tasks are compressed proportionally
 * into the time available so the order of work is preserved.
 * @param {import('../validation.js').EventInput} input
 * @param {string} today `YYYY-MM-DD`
 * @param {MilestoneTemplate[]} [extra] additional (e.g. AI-suggested) milestones
 */
export function buildTimeline(input, today, extra = []) {
  const templates = [...templatesFor(input.eventType, input.venueType), ...extra];
  const daysLeft = daysBetween(today, input.date);
  const maxLead = Math.max(...templates.map((t) => t.lead));
  const compressed = maxLead > daysLeft;
  // Leave the final day free; scale everything else into the remaining window.
  const scale = compressed && maxLead > 0 ? Math.max(daysLeft - 1, 0) / maxLead : 1;

  const milestones = templates
    .map((t) => {
      const effectiveLead = t.lead > 1 && compressed ? Math.max(1, Math.floor(t.lead * scale)) : t.lead;
      const lead = Math.min(effectiveLead, daysLeft);
      return {
        id: t.id,
        title: t.title,
        category: t.category,
        priority: t.priority,
        ai: Boolean(t.ai),
        due: addDays(input.date, -lead),
        daysBefore: lead,
        phase: phaseFor(t.lead),
        // Behind schedule: this task would normally have started already.
        urgent: t.lead > daysLeft && t.lead > 0,
      };
    })
    .sort((a, b) => b.daysBefore - a.daysBefore || a.title.localeCompare(b.title));

  return { daysLeft, compressed, milestones };
}
