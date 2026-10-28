import { ApiError, getHealth, postJson } from './api.js';
import { wireActions } from './actions.js';
import { createChat } from './assistant.js';
import { createDashboard } from './dashboard.js';
import { createAnnouncer, initTabs } from './dom.js';
import { createPlannerForm } from './form.js';
import { loadState, saveState } from './store.js';

/**
 * Entry point: wires the planner form, the dashboard, the assistant and the
 * action buttons around one saved state object.
 */

/** @typedef {import('../../types/plan.js').Plan} Plan */

/** @param {string} id */
const byId = (id) => /** @type {HTMLElement} */ (document.getElementById(id));

const state = loadState();
const persist = () => saveState(state);
const announce = createAnnouncer(byId('announcer'));
const tabs = initTabs(byId('tablist'));
const form = createPlannerForm(/** @type {HTMLFormElement} */ (byId('event-form')), byId('form-errors'));
const dashboard = createDashboard({ state, persist, selectTab: tabs.select });
const chat = createChat({ getEvent: () => state.plan?.input ?? null });
wireActions({ getPlan: () => state.plan, announce });

/**
 * Stores a newly generated plan; ticks and spend reset only when the event
 * details changed, so regenerating ideas keeps the host's progress.
 * @param {Plan} plan
 */
function adoptPlan(plan) {
  const isNewEvent = JSON.stringify(state.plan?.input) !== JSON.stringify(plan.input);
  state.plan = plan;
  if (isNewEvent) {
    state.done = {};
    state.actuals = {};
  }
  persist();
}

/** @param {unknown} err */
function errorMessages(err) {
  if (err instanceof ApiError && err.details.length) return err.details;
  return [err instanceof Error ? err.message : 'Something went wrong.'];
}

byId('event-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  form.clearErrors();
  const problems = form.validate();
  if (problems.length) {
    form.showErrors(problems);
    return;
  }
  form.setBusy(true);
  announce('Creating your plan. This can take a few seconds.');
  try {
    /** @type {Plan} */
    const plan = await postJson('/api/plan', form.read());
    adoptPlan(plan);
    chat.reset();
    dashboard.render(plan);
    dashboard.reveal();
    announce('Your plan is ready.');
  } catch (err) {
    form.showErrors(errorMessages(err));
  } finally {
    form.setBusy(false);
  }
});

// Restore the last plan, if any, so a returning host picks up where they left off.
if (state.plan) {
  form.fill(state.plan.input);
  chat.reset();
  dashboard.render(state.plan);
}

getHealth().then((health) => {
  byId('ai-status').textContent = health?.ai
    ? 'Google Gemini is ready.'
    : 'AI is offline right now. You will still get a full budget, timeline and vendor plan.';
});
