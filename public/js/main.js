import { ApiError, getHealth, postJson } from './api.js';
import { buildIcs } from './calendar.js';
import { h, initTabs } from './dom.js';
import { EVENT_LABELS, daysUntil, formatDate, localToday, planToText } from './format.js';
import { chatMessage, renderBudget, renderIdeas, renderOverview, renderTimeline, renderVendors, sidebarTip } from './render.js';
import { loadState, saveState } from './store.js';

const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));

const form = /** @type {HTMLFormElement} */ ($('event-form'));
const submitBtn = /** @type {HTMLButtonElement} */ ($('submit-btn'));
const errorsBox = $('form-errors');
const results = $('results');
const announcer = $('announcer');
const chatForm = /** @type {HTMLFormElement} */ ($('chat-form'));
const chatInput = /** @type {HTMLInputElement} */ ($('chat-input'));
const chatLog = $('chat-log');

const state = loadState();
/** @type {{ role: 'user' | 'assistant', text: string }[]} */
let chatHistory = [];
const tabs = initTabs($('tablist'));

/** @param {string} message */
function announce(message) {
  announcer.textContent = '';
  // A fresh text node after clearing makes screen readers re-announce.
  requestAnimationFrame(() => (announcer.textContent = message));
}

/** @param {number} days */
function isoInDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function readForm() {
  const data = new FormData(form);
  return {
    eventType: data.get('eventType'),
    title: data.get('title'),
    date: data.get('date'),
    city: data.get('city'),
    guests: Number(data.get('guests')),
    budget: Number(data.get('budget')),
    currency: data.get('currency'),
    style: data.get('style'),
    venueType: data.get('venueType'),
    language: data.get('language'),
    dietary: data.getAll('dietary'),
    notes: data.get('notes'),
  };
}

/** @param {any} input */
function fillForm(input) {
  for (const [name, value] of Object.entries(input)) {
    if (name === 'dietary') {
      for (const box of form.querySelectorAll('input[name="dietary"]')) {
        /** @type {HTMLInputElement} */ (box).checked = value.includes(/** @type {HTMLInputElement} */ (box).value);
      }
    } else {
      const field = /** @type {HTMLInputElement | null} */ (form.elements.namedItem(name));
      if (field) field.value = String(value);
    }
  }
  updateNotesCount();
}

/** @param {string[]} messages */
function showErrors(messages) {
  errorsBox.replaceChildren(h('strong', { text: 'Please fix the following:' }), h('ul', null, ...messages.map((m) => h('li', { text: m }))));
  errorsBox.hidden = false;
  errorsBox.focus();
}

function clearErrors() {
  errorsBox.hidden = true;
  errorsBox.replaceChildren();
  for (const el of form.querySelectorAll('[aria-invalid]')) el.removeAttribute('aria-invalid');
}

/** Client-side checks mirror the server so users get instant feedback. */
function validateForm() {
  const messages = [];
  for (const el of /** @type {NodeListOf<HTMLInputElement>} */ (form.querySelectorAll('input, select, textarea'))) {
    if (el.type === 'checkbox' || el.checkValidity()) continue;
    el.setAttribute('aria-invalid', 'true');
    const label = form.querySelector(`label[for="${el.id}"]`)?.textContent?.replace(/\(optional\)/, '').trim() ?? el.name;
    messages.push(`${label}: ${el.validationMessage}`);
  }
  return messages;
}

function updateNotesCount() {
  const notes = /** @type {HTMLTextAreaElement} */ ($('notes'));
  $('notes-count').textContent = `${notes.value.length} / 500 characters`;
}

function persist() {
  saveState(state);
}

/** @param {any} plan */
function renderPlan(plan) {
  const { input, ideas } = plan;
  $('results-meta').textContent = `${EVENT_LABELS[input.eventType]} · ${formatDate(input.date)} · ${input.city} · ${input.guests} guests`;
  const title = $('results-title');
  title.textContent = ideas.headline;
  title.setAttribute('lang', input.language);
  const summary = $('results-summary');
  summary.textContent = ideas.summary;
  summary.setAttribute('lang', input.language);
  const dir = input.language === 'ar' || input.language === 'ur' ? 'rtl' : 'ltr';
  title.setAttribute('dir', dir);
  summary.setAttribute('dir', dir);

  const source = $('results-source');
  source.className = `badge ${plan.source === 'gemini' ? 'badge-ai' : 'badge-fallback'}`;
  source.textContent = plan.source === 'gemini' ? 'Personalised by Google Gemini' : 'AI offline: showing template ideas';

  const days = daysUntil(input.date, localToday());
  $('countdown').textContent = days > 1 ? `${days} days to go` : days === 1 ? 'Tomorrow!' : days === 0 ? 'Today is the day!' : 'Celebrated';
  const tip = sidebarTip(plan);
  const tipBox = $('dash-tip');
  tipBox.hidden = !tip;
  tipBox.replaceChildren(...(tip ?? []));

  $('panel-ideas').replaceChildren(...renderIdeas(plan).filter(Boolean));
  renderBudgetPanel();
  renderChecklists();
  results.hidden = false;
}

function renderBudgetPanel() {
  $('panel-budget').replaceChildren(
    ...renderBudget(state.plan, state.actuals, (category, value) => {
      if (value === null) delete state.actuals[category];
      else state.actuals[category] = value;
      persist();
      renderBudgetPanel();
      renderOverviewPanel();
      /** @type {HTMLInputElement | null} */ (document.getElementById(`actual-${category}`))?.focus();
    }).filter(Boolean),
  );
}

function renderChecklists() {
  /** @param {string} key @param {boolean} value */
  const onToggle = (key, value) => {
    state.done[key] = value;
    persist();
    const focusId = /** @type {HTMLElement} */ (document.activeElement)?.id;
    renderChecklists();
    if (focusId) document.getElementById(focusId)?.focus();
  };
  const today = localToday();
  $('panel-timeline').replaceChildren(...renderTimeline(state.plan, state.done, onToggle, today));
  $('panel-vendors').replaceChildren(...renderVendors(state.plan, state.done, onToggle, today));
  renderOverviewPanel(onToggle);
}

/** @param {(key: string, value: boolean) => void} [onToggle] */
function renderOverviewPanel(onToggle) {
  const toggle =
    onToggle ??
    ((/** @type {string} */ key, /** @type {boolean} */ value) => {
      state.done[key] = value;
      persist();
      renderChecklists();
    });
  $('panel-overview').replaceChildren(
    ...renderOverview(state.plan, state, {
      today: localToday(),
      onToggle: toggle,
      onNavigate: (tabId) => tabs.select(tabId, true),
    }).filter(Boolean),
  );
}

/** @param {string[]} questions */
function renderSuggestions(questions) {
  $('chat-suggestions').replaceChildren(
    ...questions.map((q) => h('button', { type: 'button', class: 'chip', text: q, onclick: () => ask(q) })),
  );
}

function defaultSuggestions() {
  return ['How can I cut costs by 15% without losing the vibe?', 'What should I do this week?', 'Suggest a fun activity for guests of all ages'];
}

/** @param {string} question */
async function ask(question) {
  if (!state.plan || !question.trim()) return;
  const send = /** @type {HTMLButtonElement} */ ($('chat-send'));
  chatLog.append(chatMessage('user', question));
  chatInput.value = '';
  send.setAttribute('aria-busy', 'true');
  send.disabled = true;
  try {
    const reply = await postJson('/api/chat', { event: state.plan.input, question, history: chatHistory });
    chatLog.append(chatMessage('assistant', reply.answer, state.plan.input.language));
    chatHistory = [...chatHistory, { role: /** @type {const} */ ('user'), text: question }, { role: /** @type {const} */ ('assistant'), text: reply.answer }].slice(-6);
    renderSuggestions(reply.followUps?.length ? reply.followUps : defaultSuggestions());
  } catch (err) {
    chatLog.append(chatMessage('assistant', err instanceof ApiError ? err.message : 'Something went wrong. Please try again.'));
  } finally {
    send.removeAttribute('aria-busy');
    send.disabled = false;
    chatLog.scrollTop = chatLog.scrollHeight;
    chatInput.focus();
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors();
  const problems = validateForm();
  if (problems.length) {
    showErrors(problems);
    return;
  }
  submitBtn.setAttribute('aria-busy', 'true');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Planning your celebration…';
  announce('Creating your plan. This can take a few seconds.');
  try {
    const plan = await postJson('/api/plan', readForm());
    const isNewEvent = JSON.stringify(state.plan?.input) !== JSON.stringify(plan.input);
    state.plan = plan;
    if (isNewEvent) {
      state.done = {};
      state.actuals = {};
    }
    persist();
    chatHistory = [];
    chatLog.replaceChildren();
    renderSuggestions(defaultSuggestions());
    renderPlan(plan);
    tabs.select('tab-overview');
    const title = $('results-title');
    results.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    title.focus({ preventScroll: true });
    announce('Your plan is ready.');
  } catch (err) {
    showErrors(err instanceof ApiError && err.details.length ? err.details : [err instanceof Error ? err.message : 'Something went wrong.']);
  } finally {
    submitBtn.removeAttribute('aria-busy');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create my plan';
  }
});

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  ask(chatInput.value);
});

$('notes').addEventListener('input', updateNotesCount);

$('btn-ics').addEventListener('click', () => {
  if (!state.plan) return;
  const blob = new Blob([buildIcs(state.plan)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: 'utsav-plan.ics' });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  announce('Calendar file downloaded.');
});

$('btn-copy').addEventListener('click', async () => {
  if (!state.plan) return;
  try {
    await navigator.clipboard.writeText(planToText(state.plan));
    announce('Plan summary copied to clipboard.');
  } catch {
    announce('Copy failed. Your browser blocked clipboard access.');
  }
});

$('btn-print').addEventListener('click', () => window.print());

$('btn-edit').addEventListener('click', () => {
  $('planner').scrollIntoView();
  /** @type {HTMLElement} */ ($('eventType')).focus();
});

// Initial state: sensible defaults, then restore the last plan if any.
const dateInput = /** @type {HTMLInputElement} */ ($('date'));
dateInput.min = isoInDays(0);
dateInput.max = isoInDays(3 * 365);
dateInput.value = isoInDays(60);

if (state.plan?.input) {
  fillForm(state.plan.input);
  renderSuggestions(defaultSuggestions());
  renderPlan(state.plan);
}

getHealth().then((health) => {
  $('ai-status').textContent = health?.ai ? 'Google Gemini is ready.' : 'AI is offline right now. You will still get a full budget, timeline and vendor plan.';
});
