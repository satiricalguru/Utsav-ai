import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addDays, daysBetween, parseIsoDate, toIsoDate, todayIso } from '../src/dates.js';
import { buildTimeline, templatesFor } from '../src/planner/timeline.js';
import { buildVendors, mapsSearchUrl } from '../src/planner/vendors.js';
import { TODAY, eventInput } from './helpers.js';

describe('dates', () => {
  it('parses valid dates and rejects impossible ones', () => {
    assert.equal(toIsoDate(parseIsoDate('2026-02-28')), '2026-02-28');
    assert.equal(parseIsoDate('2026-02-30'), null);
    assert.equal(parseIsoDate('2026-2-3'), null);
    assert.equal(parseIsoDate(20260101), null);
  });

  it('adds days across month and year boundaries', () => {
    assert.equal(addDays('2026-12-30', 3), '2027-01-02');
    assert.equal(addDays('2027-03-01', -1), '2027-02-28');
    assert.equal(daysBetween('2026-10-20', '2026-10-27'), 7);
    assert.throws(() => addDays('nope', 1), RangeError);
    assert.throws(() => daysBetween('nope', '2026-01-01'), RangeError);
  });

  it('formats today in UTC', () => {
    assert.equal(todayIso(Date.UTC(2026, 9, 20, 23, 30)), '2026-10-20');
  });
});

describe('buildTimeline', () => {
  it('schedules every milestone before the event (except wrap-up) in order', () => {
    const { milestones, compressed, daysLeft } = buildTimeline(eventInput(), TODAY);
    assert.equal(compressed, false);
    assert.equal(daysLeft, 180);
    for (let i = 1; i < milestones.length; i++) {
      assert.ok(milestones[i - 1].daysBefore >= milestones[i].daysBefore);
    }
    const day = milestones.find((m) => m.id === 'day');
    assert.equal(day.due, '2027-04-18');
    const thanks = milestones.find((m) => m.id === 'thanks');
    assert.equal(thanks.due, '2027-04-23');
    assert.ok(milestones.every((m) => m.daysBefore < 0 || m.due >= TODAY));
  });

  it('compresses into the available window for short-notice events', () => {
    const date = addDays(TODAY, 14);
    const { milestones, compressed, daysLeft } = buildTimeline(eventInput({ date }), TODAY);
    assert.equal(compressed, true);
    assert.equal(daysLeft, 14);
    assert.ok(
      milestones.every((m) => m.due >= TODAY),
      'nothing is scheduled in the past',
    );
    assert.ok(milestones.some((m) => m.urgent));
    const venue = milestones.find((m) => m.id === 'venue');
    const rsvp = milestones.find((m) => m.id === 'rsvp');
    assert.ok(venue.daysBefore >= rsvp.daysBefore, 'order of work is preserved');
  });

  it('handles an event happening today', () => {
    const { milestones, daysLeft } = buildTimeline(eventInput({ date: TODAY }), TODAY);
    assert.equal(daysLeft, 0);
    assert.ok(milestones.filter((m) => m.daysBefore >= 0).every((m) => m.due === TODAY));
  });

  it('skips venue booking for events at home', () => {
    assert.ok(!templatesFor('birthday', 'home').some((t) => t.id === 'venue'));
    assert.ok(templatesFor('birthday', 'indoor').some((t) => t.id === 'venue'));
  });

  it('merges extra (AI) milestones with real dates', () => {
    const extra = [
      {
        id: 'ai-1',
        title: 'Book accessible transport',
        lead: 30,
        category: 'logistics',
        priority: 'medium',
        ai: true,
      },
    ];
    const { milestones } = buildTimeline(eventInput(), TODAY, extra);
    const task = milestones.find((m) => m.id === 'ai-1');
    assert.equal(task.due, '2027-03-19');
    assert.equal(task.phase, 'Book');
  });
});

describe('buildVendors', () => {
  it('lists wedding vendors with book-by dates and maps links', () => {
    const vendors = buildVendors(eventInput(), TODAY);
    assert.ok(vendors.some((v) => v.id === 'photographer'));
    assert.ok(
      vendors.some((v) => v.id === 'rentals'),
      'outdoor adds rentals',
    );
    for (const v of vendors) {
      assert.ok(v.bookBy >= TODAY && v.bookBy <= '2027-04-18');
      assert.equal(v.questions.length, 3);
      assert.ok(v.mapsUrl.startsWith('https://www.google.com/maps/search/?api=1&query='));
    }
  });

  it('adds security for large crowds and drops the venue at home', () => {
    const vendors = buildVendors(
      eventInput({ eventType: 'birthday', venueType: 'home', guests: 400 }),
      TODAY,
    );
    assert.ok(vendors.some((v) => v.id === 'security'));
    assert.ok(!vendors.some((v) => v.id === 'venue'));
  });

  it('flags late bookings on short notice', () => {
    const vendors = buildVendors(eventInput({ date: addDays(TODAY, 5) }), TODAY);
    assert.ok(vendors.every((v) => v.lateBooking));
  });

  it('encodes the maps query safely', () => {
    const url = new URL(mapsSearchUrl('caterers', 'Navi Mumbai & <Thane>'));
    assert.equal(url.searchParams.get('query'), 'caterers in Navi Mumbai & <Thane>');
  });
});
