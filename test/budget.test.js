import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BUDGET_CATEGORIES, EVENT_TYPES, STYLES, VENUE_TYPES } from '../src/constants.js';
import {
  allocateAmounts,
  assessFeasibility,
  buildBudget,
  normalisePercentages,
} from '../src/planner/budget.js';
import { eventInput } from './helpers.js';

describe('normalisePercentages', () => {
  it('always sums to exactly 100', () => {
    const result = normalisePercentages({ a: 1, b: 1, c: 1 });
    assert.equal(
      Object.values(result).reduce((s, v) => s + v, 0),
      100,
    );
    assert.deepEqual(Object.values(result).sort(), [33, 33, 34]);
  });

  it('rejects all-zero weights', () => {
    assert.throws(() => normalisePercentages({ a: 0 }), RangeError);
  });
});

describe('allocateAmounts', () => {
  it('rounds to the step and puts the remainder in contingency', () => {
    const amounts = allocateAmounts(100_050, { venue: 50, catering: 40, contingency: 10 }, 100);
    assert.equal(amounts.venue, 50_000);
    assert.equal(amounts.catering, 40_000);
    assert.equal(amounts.contingency, 10_050);
  });

  it('never produces a negative contingency on tiny budgets', () => {
    const pct = { a: 15, b: 15, c: 15, d: 15, e: 15, f: 15, contingency: 10 };
    const amounts = allocateAmounts(1000, pct, 100);
    assert.ok(amounts.contingency >= 0);
    assert.equal(
      Object.values(amounts).reduce((s, v) => s + v, 0),
      1000,
    );
  });
});

describe('assessFeasibility', () => {
  it('classifies budgets by per-plate cost', () => {
    assert.equal(assessFeasibility(10_000, 100, 350).level, 'unrealistic');
    assert.equal(assessFeasibility(35_000, 100, 350).level, 'tight');
    assert.equal(assessFeasibility(100_000, 100, 350).level, 'comfortable');
    assert.equal(assessFeasibility(500_000, 100, 350).level, 'generous');
  });
});

describe('buildBudget', () => {
  it('allocates the whole budget for every type, style and venue combination', () => {
    for (const eventType of EVENT_TYPES) {
      for (const style of STYLES) {
        for (const venueType of VENUE_TYPES) {
          const b = buildBudget(eventInput({ eventType, style, venueType, budget: 237_900 }));
          const sum = b.lines.reduce((s, l) => s + l.amount, 0);
          assert.equal(sum, 237_900, `${eventType}/${style}/${venueType}`);
          assert.equal(
            b.lines.reduce((s, l) => s + l.percent, 0),
            100,
          );
          assert.ok(b.lines.every((l) => BUDGET_CATEGORIES.includes(l.category) && l.amount > 0));
        }
      }
    }
  });

  it('shrinks the venue line when hosting at home', () => {
    const hall = buildBudget(eventInput({ eventType: 'birthday', venueType: 'indoor' }));
    const home = buildBudget(eventInput({ eventType: 'birthday', venueType: 'home' }));
    const venue = (b) => b.lines.find((l) => l.category === 'venue')?.amount ?? 0;
    const catering = (b) => b.lines.find((l) => l.category === 'catering').amount;
    assert.ok(venue(home) < venue(hall) / 4);
    assert.ok(catering(home) > catering(hall));
  });

  it('gives luxury events a bigger decor share than minimal ones', () => {
    const decor = (style) =>
      buildBudget(eventInput({ style })).lines.find((l) => l.category === 'decor').percent;
    assert.ok(decor('luxury') > decor('minimal'));
  });

  it('warns when the budget per guest is unrealistic', () => {
    const b = buildBudget(eventInput({ guests: 500, budget: 50_000 }));
    assert.equal(b.feasibility.level, 'unrealistic');
    assert.match(b.warnings[0], /per-plate/);
  });

  it('warns when rounding leaves less than 5% contingency', () => {
    // ₹3,000 split in ₹100 steps rounds the other lines up, leaving ₹100 (3%).
    const b = buildBudget(
      eventInput({ eventType: 'wedding', style: 'modern', venueType: 'indoor', guests: 1, budget: 3000 }),
    );
    assert.ok(b.warnings.some((w) => w.includes('Contingency is under 5%')));
  });

  it('reports per-guest cost', () => {
    const b = buildBudget(eventInput({ guests: 100, budget: 200_000 }));
    assert.equal(b.perGuest, 2000);
    assert.equal(b.currency, 'INR');
  });
});
