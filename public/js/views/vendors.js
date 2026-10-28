import { h } from '../dom.js';
import { daysUntil, formatDate, formatMoney, formatShortDate } from '../format.js';
import { categoryLabel, checklistProgress, pill, toggleBox } from './ui.js';

/**
 * The Vendors tab: who to book and by when, the questions to ask, and a
 * Google Maps search in the event's city.
 */

/** @typedef {import('../../../types/plan.js').Plan} Plan */
/** @typedef {import('../../../types/plan.js').Vendor} Vendor */

const SOON_DAYS = 14;

/**
 * Signal-light booking status for one vendor.
 * @param {Vendor} vendor
 * @param {boolean} isBooked
 * @param {string} today
 */
function bookingPill(vendor, isBooked, today) {
  if (isBooked) return pill('done', 'Booked');
  const days = daysUntil(vendor.bookBy, today);
  if (vendor.lateBooking || days <= 0) return pill('overdue', 'Book now');
  if (days <= SOON_DAYS) return pill('soon', `Book in ${days} days`);
  return pill('later', `Book by ${formatShortDate(vendor.bookBy)}`);
}

/**
 * @param {Vendor} vendor
 * @param {Plan} plan
 * @param {{ done: Record<string, boolean>, onToggle: import('./ui.js').ToggleHandler, today: string }} ctx
 */
function vendorCard(vendor, plan, { done, onToggle, today }) {
  const key = `vendor:${vendor.id}`;
  const id = `vb-${vendor.id}`;
  const isBooked = Boolean(done[key]);
  const line = plan.budget.lines.find((l) => l.category === vendor.category);
  return h(
    'article',
    { class: `tile vendor${isBooked ? ' is-booked' : ''}`, 'aria-labelledby': `${id}-name` },
    h(
      'div',
      { class: 'vendor-head' },
      h('h3', { id: `${id}-name`, text: vendor.name }),
      bookingPill(vendor, isBooked, today),
    ),
    h('p', { class: 'task-meta', text: `Book by ${formatDate(vendor.bookBy)}` }),
    line
      ? h('p', {
          class: 'task-meta',
          text: `Budget line: ${categoryLabel(line.category)} · ${formatMoney(line.amount, plan.budget.currency)}`,
        })
      : null,
    h('p', { class: 'ask-title' }, h('strong', { text: 'Ask before booking:' })),
    h('ul', { class: 'clean-list' }, ...vendor.questions.map((q) => h('li', { text: q }))),
    h(
      'div',
      { class: 'vendor-foot' },
      h('label', { class: 'check-pill' }, toggleBox(id, key, isBooked, onToggle), ' Booked and confirmed'),
      h('a', {
        href: vendor.mapsUrl,
        target: '_blank',
        rel: 'noopener noreferrer',
        'aria-label': `Find ${vendor.name} near ${plan.input.city} on Google Maps (opens in a new tab)`,
        text: 'Find on Google Maps',
      }),
    ),
  );
}

/**
 * @param {Plan} plan
 * @param {Record<string, boolean>} done
 * @param {import('./ui.js').ToggleHandler} onToggle
 * @param {string} today
 */
export function renderVendors(plan, done, onToggle, today) {
  const booked = plan.vendors.filter((v) => done[`vendor:${v.id}`]).length;
  return [
    h('div', { class: 'panel-card' }, checklistProgress(booked, plan.vendors.length, 'vendors')),
    h('div', { class: 'cards' }, ...plan.vendors.map((v) => vendorCard(v, plan, { done, onToggle, today }))),
  ];
}
