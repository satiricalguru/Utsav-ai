import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { buildIcs, escapeIcsText, foldLine, googleCalendarUrl } from '../public/js/calendar.js';
import { CATEGORY_LABELS, EVENT_LABELS, formatDate, formatMoney, planToText, relativeDays } from '../public/js/format.js';
import { BUDGET_CATEGORIES, CURRENCIES, DIETARY, EVENT_TYPES, LANGUAGES, STYLES, VENUE_TYPES } from '../src/constants.js';
import { createPlannerService } from '../src/service.js';
import { TODAY, eventInput } from './helpers.js';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');

/** @param {string} name */
function optionValues(name) {
  const select = html.match(new RegExp(`<select id="${name}"[\\s\\S]*?</select>`))?.[0] ?? '';
  return [...select.matchAll(/value="([^"]+)"/g)].map((m) => m[1]);
}

describe('index.html stays in sync with server enums', () => {
  it('offers exactly the supported options', () => {
    assert.deepEqual(optionValues('eventType'), [...EVENT_TYPES]);
    assert.deepEqual(optionValues('style'), [...STYLES]);
    assert.deepEqual(optionValues('venueType'), [...VENUE_TYPES]);
    assert.deepEqual(optionValues('currency'), Object.keys(CURRENCIES));
    assert.deepEqual(optionValues('language'), Object.keys(LANGUAGES));
    const dietary = [...html.matchAll(/name="dietary" value="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(dietary, [...DIETARY]);
  });

  it('has labels for every category and event type', () => {
    assert.deepEqual(Object.keys(CATEGORY_LABELS), [...BUDGET_CATEGORIES]);
    assert.deepEqual(Object.keys(EVENT_LABELS), [...EVENT_TYPES]);
  });

  it('meets basic accessibility structure', () => {
    assert.match(html, /<html lang="en">/);
    assert.match(html, /class="skip-link" href="#main"/);
    assert.match(html, /<main id="main"/);
    assert.match(html, /role="tablist"/);
    assert.match(html, /role="log" aria-live="polite"/);
    // Every visible form control has a matching <label for>.
    const ids = [...html.matchAll(/<(?:input|select|textarea) id="([^"]+)"/g)].map((m) => m[1]);
    for (const id of ids) assert.match(html, new RegExp(`<label for="${id}"`), `label for ${id}`);
    assert.doesNotMatch(html, /<script(?![^>]*src=)/, 'no inline scripts (CSP)');
    assert.doesNotMatch(html, /style="/, 'no inline styles (CSP)');
  });
});

describe('format helpers', () => {
  it('formats money per locale and dates in UTC', () => {
    assert.equal(formatMoney(150000, 'INR'), '₹1,50,000');
    assert.equal(formatMoney(2500, 'USD'), '$2,500');
    assert.equal(formatDate('2027-04-18'), '18 Apr 2027');
  });

  it('describes relative days', () => {
    assert.equal(relativeDays(0), 'on the day');
    assert.equal(relativeDays(1), '1 day before');
    assert.equal(relativeDays(-1), '1 day after');
    assert.equal(relativeDays(30), '30 days before');
    assert.equal(relativeDays(-5), '5 days after');
  });

  it('builds a plain-text summary', async () => {
    const service = createPlannerService({ ai: null, now: () => Date.parse(`${TODAY}T00:00:00Z`) });
    const text = planToText(await service.plan(eventInput()));
    assert.match(text, /Wedding · 18 Apr 2027 · Jaipur · 200 guests/);
    assert.match(text, /Food & catering: ₹/);
    assert.match(text, /Theme ideas:/);
  });
});

describe('calendar export', () => {
  it('escapes and folds per RFC 5545', () => {
    assert.equal(escapeIcsText('a,b;c\\d\ne'), 'a\\,b\\;c\\\\d\\ne');
    const folded = foldLine(`SUMMARY:${'x'.repeat(200)}`);
    for (const line of folded.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75);
    assert.equal(foldLine('short'), 'short');
  });

  it('folds multi-byte text without splitting characters', () => {
    const folded = foldLine(`SUMMARY:${'शादी'.repeat(40)}`);
    assert.ok(!folded.includes('�'));
    assert.equal(folded.replace(/\r\n /g, ''), `SUMMARY:${'शादी'.repeat(40)}`);
  });

  it('exports every milestone as an all-day event', async () => {
    const service = createPlannerService({ ai: null, now: () => Date.parse(`${TODAY}T00:00:00Z`) });
    const plan = await service.plan(eventInput());
    const ics = buildIcs(plan, '20261020T000000Z');
    assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
    assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
    assert.equal(ics.match(/BEGIN:VEVENT/g).length, plan.timeline.milestones.length);
    assert.match(ics, /DTSTART;VALUE=DATE:20270418\r\nDTEND;VALUE=DATE:20270419/);
  });

  it('builds Google Calendar links', () => {
    const url = new URL(googleCalendarUrl('Book venue', '2026-12-31', 'details'));
    assert.equal(url.hostname, 'calendar.google.com');
    assert.equal(url.searchParams.get('dates'), '20261231/20270101');
    assert.equal(url.searchParams.get('text'), 'Book venue');
  });
});
