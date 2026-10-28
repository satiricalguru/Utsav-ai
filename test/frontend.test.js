import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { buildIcs, escapeIcsText, foldLine, googleCalendarUrl } from '../public/js/calendar.js';
import { donutSegments } from '../public/js/charts.js';
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  EVENT_LABELS,
  daysUntil,
  formatDate,
  formatMoney,
  formatMoneyCompact,
  formatShortDate,
  localToday,
  nextTasks,
  planToText,
  relativeDays,
  taskStatus,
} from '../public/js/format.js';
import {
  BUDGET_CATEGORIES,
  CURRENCIES,
  DIETARY,
  EVENT_TYPES,
  LANGUAGES,
  STYLES,
  VENUE_TYPES,
} from '../src/constants.js';
import { createPlannerService } from '../src/service.js';
import { TODAY, eventInput } from './helpers.js';

// Collapse whitespace so assertions do not depend on how the markup is wrapped.
const html = (await readFile(new URL('../public/index.html', import.meta.url), 'utf8')).replace(/\s+/g, ' ');

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

const css = await readFile(new URL('../public/landing.css', import.meta.url), 'utf8');
const gl = await readFile(new URL('../public/js/hero-gl.js', import.meta.url), 'utf8');

describe('landing page', () => {
  it('has exactly one h1 and hides decorative layers from assistive tech', () => {
    assert.equal(html.match(/<h1\b/g).length, 1);
    assert.match(html, /<canvas class="hero-gl" aria-hidden="true">/);
    assert.match(html, /<section class="statement" aria-label="What Utsav does">/);
    assert.match(html, /<div class="story-visual" aria-hidden="true">/);
  });

  it('gives every image alt text and intrinsic dimensions, lazy-loading photos', () => {
    const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
    assert.ok(imgs.length >= 9);
    for (const img of imgs) {
      assert.match(img, /\balt="/, img);
      assert.match(img, /\bwidth="\d+"/, img);
      assert.match(img, /\bheight="\d+"/, img);
    }
    for (const img of imgs.filter((i) => i.includes('/assets/img/'))) assert.match(img, /loading="lazy"/);
  });

  it('only links occasion cards to supported event types', () => {
    const occasions = [...html.matchAll(/data-occasion="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual([...occasions].sort(), [...EVENT_TYPES].sort());
  });

  it('respects reduced motion in CSS and WebGL', () => {
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(css, /@media \(forced-colors: active\)/);
    assert.match(css, /@media \(prefers-contrast: more\)/);
    assert.match(gl, /reducedMotion/);
    assert.match(gl, /IntersectionObserver/, 'pauses when off-screen');
  });
});

describe('dashboard helpers', () => {
  it('splits the donut into proportional, gapped segments that start where the last ended', () => {
    const segs = donutSegments([50, 30, 20]);
    assert.deepEqual(
      segs.map((x) => x.offset),
      [-0, -50, -80],
    );
    assert.ok(Math.abs(segs[0].length - 49.4) < 1e-9);
    assert.deepEqual(donutSegments([0, 0]), [
      { length: 0, offset: 0 },
      { length: 0, offset: 0 },
    ]);
    assert.equal(donutSegments([1, 1000])[0].length, 100 / 1001, 'tiny slices skip the gap');
  });

  it('counts days and formats short dates', () => {
    assert.equal(daysUntil('2026-11-01', '2026-10-20'), 12);
    assert.equal(daysUntil('2026-10-19', '2026-10-20'), -1);
    assert.equal(localToday(new Date(2026, 0, 5)), '2026-01-05');
    assert.equal(formatShortDate('2027-02-14'), '14 Feb');
    assert.equal(formatMoneyCompact(1500000, 'INR'), '₹15L');
  });

  it('assigns signal-light statuses', () => {
    const today = '2026-10-20';
    assert.equal(taskStatus({ due: '2026-10-25' }, true, today).key, 'done');
    assert.equal(taskStatus({ due: '2026-10-19' }, false, today).key, 'overdue');
    assert.equal(taskStatus({ due: '2026-11-30', urgent: true }, false, today).key, 'now');
    assert.equal(taskStatus({ due: '2026-10-20' }, false, today).key, 'now');
    assert.deepEqual(taskStatus({ due: '2026-10-21' }, false, today), { key: 'soon', label: 'Tomorrow' });
    assert.equal(taskStatus({ due: '2026-10-27' }, false, today).key, 'soon');
    assert.deepEqual(taskStatus({ due: '2026-12-01' }, false, today), { key: 'later', label: 'In 42 days' });
  });

  it('picks the most pressing open tasks', () => {
    const ms = [
      { id: 'a', due: '2026-12-01' },
      { id: 'b', due: '2026-11-01' },
      { id: 'c', due: '2026-10-25' },
    ];
    assert.deepEqual(
      nextTasks(ms, { 'task:c': true }, 5).map((m) => m.id),
      ['b', 'a'],
    );
    assert.equal(nextTasks(ms, {}, 1)[0].id, 'c');
  });

  it('has a colour for every budget category', () => {
    assert.deepEqual(Object.keys(CATEGORY_COLORS), Object.keys(CATEGORY_LABELS));
  });

  it('exposes an Overview tab first and defines every referenced icon', () => {
    const tabs = [...html.matchAll(/role="tab" id="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(tabs, [
      'tab-overview',
      'tab-ideas',
      'tab-budget',
      'tab-timeline',
      'tab-vendors',
      'tab-assistant',
    ]);
    const defined = new Set([...html.matchAll(/<symbol id="i-([^"]+)"/g)].map((m) => m[1]));
    for (const [, name] of html.matchAll(/href="#i-([^"]+)"/g)) assert.ok(defined.has(name), name);
  });
});
