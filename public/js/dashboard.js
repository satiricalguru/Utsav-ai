import { enter } from './dom.js';
import { EVENT_LABELS, daysUntil, formatDate, localToday } from './format.js';
import { renderBudget, renderIdeas, renderOverview, renderTimeline, renderVendors } from './views/index.js';

/**
 * The results dashboard: header, countdown and the five tab panels. Owns
 * re-rendering when the host ticks a task, books a vendor or logs spend.
 */

/** @typedef {import('../../types/plan.js').Plan} Plan */
/** @typedef {import('../../types/plan.js').SavedState} SavedState */

const RTL_LANGUAGES = new Set(['ar', 'ur']);

/** @param {string} id */
const byId = (id) => /** @type {HTMLElement} */ (document.getElementById(id));

/** @param {number} days */
function countdownText(days) {
  if (days > 1) return `${days} days to go`;
  if (days === 1) return 'Tomorrow!';
  return days === 0 ? 'Today is the day!' : 'Celebrated';
}

/**
 * Sets AI-written text with the right language and direction.
 * @param {HTMLElement} el
 * @param {string} text
 * @param {string} lang
 */
function setLocalisedText(el, text, lang) {
  el.textContent = text;
  el.setAttribute('lang', lang);
  el.setAttribute('dir', RTL_LANGUAGES.has(lang) ? 'rtl' : 'ltr');
}

/**
 * @param {{
 *   state: SavedState,
 *   persist: () => void,
 *   selectTab: (id: string, focus?: boolean) => void,
 * }} deps
 */
export function createDashboard({ state, persist, selectTab }) {
  const results = byId('results');

  /** @param {Plan} plan */
  function renderHeader(plan) {
    const { input, ideas } = plan;
    const occasion = EVENT_LABELS[input.eventType];
    byId('results-meta').textContent =
      `${occasion} · ${formatDate(input.date)} · ${input.city} · ${input.guests} guests`;
    setLocalisedText(byId('results-title'), ideas.headline, input.language);
    setLocalisedText(byId('results-summary'), ideas.summary, input.language);

    const source = byId('results-source');
    const live = plan.source === 'gemini';
    source.className = `badge ${live ? 'badge-ai' : 'badge-fallback'}`;
    source.textContent = live ? 'Personalised by Google Gemini' : 'AI offline: showing template ideas';
    byId('countdown').textContent = countdownText(daysUntil(input.date, localToday()));
  }

  /**
   * Re-renders after a checkbox change without losing keyboard focus. When the
   * focused row disappears (a done task leaves "Up next"), focus moves to the
   * next checkbox in the same panel, or the panel itself.
   * @param {() => void} rerender
   */
  function keepFocus(rerender) {
    const active = document.activeElement;
    const focusId = active?.id;
    const panel = active?.closest('[role="tabpanel"]');
    rerender();
    const target =
      (focusId && document.getElementById(focusId)) ||
      panel?.querySelector('input[type="checkbox"]:not(:checked)') ||
      panel;
    if (target instanceof HTMLElement) target.focus();
  }

  /** @param {string} key @param {boolean} value */
  function toggle(key, value) {
    state.done[key] = value;
    persist();
    keepFocus(renderChecklists);
  }

  /** @param {string} category @param {number | null} value */
  function setActual(category, value) {
    if (value === null) delete state.actuals[category];
    else state.actuals[category] = value;
    persist();
    renderBudgetPanel();
    renderOverviewPanel();
    document.getElementById(`actual-${category}`)?.focus();
  }

  function renderOverviewPanel() {
    if (!state.plan) return;
    const ctx = {
      today: localToday(),
      onToggle: toggle,
      onNavigate: (/** @type {string} */ id) => selectTab(id, true),
    };
    byId('panel-overview').replaceChildren(...renderOverview(state.plan, state, ctx));
  }

  function renderBudgetPanel() {
    if (!state.plan) return;
    byId('panel-budget').replaceChildren(...renderBudget(state.plan, state.actuals, setActual));
  }

  function renderChecklists() {
    if (!state.plan) return;
    const today = localToday();
    byId('panel-timeline').replaceChildren(...renderTimeline(state.plan, state.done, toggle, today));
    byId('panel-vendors').replaceChildren(...renderVendors(state.plan, state.done, toggle, today));
    renderOverviewPanel();
  }

  /** @param {Plan} plan */
  function render(plan) {
    renderHeader(plan);
    byId('panel-ideas').replaceChildren(...renderIdeas(plan));
    renderBudgetPanel();
    renderChecklists();
    results.hidden = false;
  }

  /** Brings a freshly generated plan into view and focus. */
  function reveal() {
    selectTab('tab-overview');
    enter(byId('panel-overview'));
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    results.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
    byId('results-title').focus({ preventScroll: true });
  }

  return { render, reveal };
}
