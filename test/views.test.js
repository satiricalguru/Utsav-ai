import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createPlannerService } from '../src/service.js';
import { installFakeDom, root } from './fake-dom.js';
import { TODAY, aiPlanResponse, eventInput, fakeAi, silentLogger } from './helpers.js';

/** @typedef {import('../types/plan.js').Plan} Plan */
/** @typedef {import('./fake-dom.js').FakeElement} FakeElement */

let restore = () => {};
/** @type {typeof import('../public/js/views/index.js')} */
let views;
/** @type {typeof import('../public/js/charts.js')} */
let charts;
/** @type {Plan} */
let plan;

before(async () => {
  restore = installFakeDom();
  views = await import('../public/js/views/index.js');
  charts = await import('../public/js/charts.js');
  const now = () => Date.parse(`${TODAY}T09:00:00Z`);
  const service = createPlannerService({ ai: fakeAi(() => aiPlanResponse()), logger: silentLogger, now });
  plan = await service.plan(eventInput());
});

after(() => restore());

const noop = () => {};

describe('charts', () => {
  it('draws a donut with one segment per slice and a text alternative', () => {
    const svg = /** @type {FakeElement} */ (
      /** @type {unknown} */ (
        charts.donut(
          [
            { value: 3, color: 'red' },
            { value: 1, color: 'blue' },
          ],
          'Split',
          { center: '₹4', sub: 'total' },
        )
      )
    );
    assert.equal(svg.getAttribute('role'), 'img');
    assert.equal(svg.getAttribute('aria-label'), 'Split');
    assert.equal(svg.byClass('donut-seg').length, 2);
    assert.equal(svg.byClass('donut-seg')[0].style.stroke, 'red');
    assert.equal(
      svg
        .byTag('text')
        .map((t) => t.textContent)
        .join('|'),
      '₹4|total',
    );
  });

  it('hides an empty ring arc so no stray dot is drawn', () => {
    const empty = /** @type {FakeElement} */ (
      /** @type {unknown} */ (charts.ring(0, 10, 'None yet', 'green'))
    );
    assert.equal(empty.byClass('ring-arc')[0].getAttribute('opacity'), '0');
    const half = /** @type {FakeElement} */ (/** @type {unknown} */ (charts.ring(5, 10, 'Half', 'green')));
    assert.equal(half.byClass('ring-arc')[0].getAttribute('stroke-dasharray'), '50.0 100');
    assert.equal(half.byClass('ring-arc')[0].getAttribute('opacity'), null);
  });

  it('references sprite icons', () => {
    const svg = /** @type {FakeElement} */ (/** @type {unknown} */ (charts.icon('budget')));
    assert.equal(svg.getAttribute('aria-hidden'), 'true');
    assert.equal(svg.byTag('use')[0].getAttribute('href'), '#i-budget');
  });
});

describe('dashboard views', () => {
  it('renders the overview with four KPI tiles, the budget card and up-next tasks', () => {
    const progress = { done: { 'task:budget': true }, actuals: { venue: 1000 } };
    const navigated = [];
    const view = root(
      /** @type {any} */ (
        views.renderOverview(plan, progress, {
          today: TODAY,
          onToggle: noop,
          onNavigate: (id) => navigated.push(id),
        })
      ),
    );
    assert.equal(view.byClass('kpi').length, 4);
    assert.match(view.textContent, /Budget overview/);
    assert.match(view.textContent, /Up next/);
    assert.ok(view.byClass('task').length > 0 && view.byClass('task').length <= 5);
    assert.ok(
      !view.byClass('task').some((t) => t.textContent.includes('Agree the budget')),
      'done tasks are not up next',
    );
    view.byClass('link-btn')[0].dispatch('click');
    assert.deepEqual(navigated, ['tab-budget']);
  });

  it('renders every theme, the menu and the run sheet in the plan language', () => {
    const view = root(/** @type {any} */ (views.renderIdeas(plan)));
    assert.equal(view.byClass('mood-tile').length, plan.ideas.themes.length);
    assert.equal(view.byClass('mood-tile')[0].getAttribute('lang'), 'en');
    assert.match(view.textContent, /Jain-friendly Rajasthani thali/);
    assert.deepEqual(
      view.byTag('time').map((t) => t.textContent),
      ['17:30', '19:00'],
    );
  });

  it('renders the budget table and reports actual spend changes', () => {
    /** @type {[string, number | null][]} */
    const changes = [];
    const view = root(
      /** @type {any} */ (views.renderBudget(plan, { venue: 999_999 }, (c, v) => changes.push([c, v]))),
    );
    assert.equal(view.byTag('tbody')[0].byTag('tr').length, plan.budget.lines.length);
    assert.match(view.textContent, /over/, 'overspend is flagged');
    const field = view.findAll((el) => el.getAttribute('id') === 'actual-catering')[0];
    Object.assign(field, { valueAsNumber: 1234 });
    field.dispatch('change');
    Object.assign(field, { valueAsNumber: Number.NaN });
    field.dispatch('change');
    assert.deepEqual(changes, [
      ['catering', 1234],
      ['catering', null],
    ]);
  });

  it('renders the Gantt and groups tasks by phase', () => {
    const toggles = [];
    const view = root(
      /** @type {any} */ (views.renderTimeline(plan, {}, (key, value) => toggles.push([key, value]), TODAY)),
    );
    const phases = new Set(plan.timeline.milestones.map((m) => m.phase));
    assert.equal(view.byClass('gantt')[0].byTag('li').length, phases.size);
    assert.equal(view.byClass('phase').length, phases.size);
    assert.equal(view.byClass('task').length, plan.timeline.milestones.length);
    const box = view.byClass('task')[0].byTag('input')[0];
    Object.assign(box, { checked: true });
    box.dispatch('change');
    assert.deepEqual(toggles, [[`task:${plan.timeline.milestones[0].id}`, true]]);
  });

  it('renders a card per vendor with booking status and a maps link', () => {
    const first = plan.vendors[0];
    const view = root(
      /** @type {any} */ (views.renderVendors(plan, { [`vendor:${first.id}`]: true }, noop, TODAY)),
    );
    assert.equal(view.byClass('vendor').length, plan.vendors.length);
    assert.match(view.byClass('vendor')[0].className, /is-booked/);
    assert.equal(view.byClass('pill')[0].textContent, 'Booked');
    assert.ok(view.byTag('a').every((a) => a.getAttribute('rel') === 'noopener noreferrer'));
  });

  it('labels chat bubbles for screen readers', () => {
    const user = /** @type {FakeElement} */ (/** @type {unknown} */ (views.chatMessage('user', 'Hi')));
    const bot = /** @type {FakeElement} */ (
      /** @type {unknown} */ (views.chatMessage('assistant', 'नमस्ते', 'hi'))
    );
    assert.equal(user.textContent, 'You said: Hi');
    assert.equal(bot.textContent, 'Utsav said: नमस्ते');
    assert.equal(bot.getAttribute('lang'), 'hi');
  });
});

describe('view edge cases', () => {
  it('explains a compressed schedule for short-notice events', async () => {
    const now = () => Date.parse(`${TODAY}T09:00:00Z`);
    const service = createPlannerService({ ai: null, now });
    const soon = await service.plan(eventInput({ date: '2026-11-01' }));
    const view = root(/** @type {any} */ (views.renderTimeline(soon, {}, noop, TODAY)));
    assert.match(view.byClass('notice')[0].textContent, /compressed/);
  });

  it('shows risks on the overview when there is no run sheet, and nothing when there are neither', () => {
    const noSchedule = { ...plan, ideas: { ...plan.ideas, daySchedule: [] } };
    const ctx = { today: TODAY, onToggle: noop, onNavigate: noop };
    const progress = { done: {}, actuals: {} };
    assert.match(
      root(/** @type {any} */ (views.renderOverview(noSchedule, progress, ctx))).textContent,
      /Watch out for/,
    );
    const bare = { ...plan, ideas: { ...plan.ideas, daySchedule: [], risks: [], themes: [] } };
    const view = root(/** @type {any} */ (views.renderOverview(bare, progress, ctx)));
    assert.doesNotMatch(view.textContent, /Watch out for|Moodboard/);
  });

  it('celebrates when every task is done', () => {
    const done = Object.fromEntries(plan.timeline.milestones.map((m) => [`task:${m.id}`, true]));
    const view = root(
      /** @type {any} */ (
        views.renderOverview(plan, { done, actuals: {} }, { today: TODAY, onToggle: noop, onNavigate: noop })
      ),
    );
    assert.match(view.textContent, /Every task is done/);
  });
});
