import { h } from './dom.js';
import { localToday } from './format.js';

/**
 * The planner form: reading and restoring values, instant client-side
 * validation that mirrors the server, and an accessible error summary.
 */

/** @typedef {import('../../types/plan.js').EventInput} EventInput */
/** @typedef {{ fieldId: string, message: string }} FieldError */

const NOTES_MAX = 500;
const DEFAULT_LEAD_DAYS = 60;
const MAX_DAYS_AHEAD = 3 * 365;

/** @param {number} days */
function isoInDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localToday(d);
}

/**
 * @param {HTMLFormElement} form
 * @param {HTMLElement} errorsBox the role="alert" summary above the fields
 */
export function createPlannerForm(form, errorsBox) {
  const submitBtn = /** @type {HTMLButtonElement} */ (form.querySelector('[type="submit"]'));
  const notes = /** @type {HTMLTextAreaElement} */ (form.elements.namedItem('notes'));
  const notesCount = /** @type {HTMLElement} */ (document.getElementById('notes-count'));
  const submitLabel = submitBtn.textContent ?? '';

  const updateNotesCount = () => {
    notesCount.textContent = `${notes.value.length} / ${NOTES_MAX} characters`;
  };
  notes.addEventListener('input', updateNotesCount);

  const dateInput = /** @type {HTMLInputElement} */ (form.elements.namedItem('date'));
  dateInput.min = isoInDays(0);
  dateInput.max = isoInDays(MAX_DAYS_AHEAD);
  dateInput.value = isoInDays(DEFAULT_LEAD_DAYS);

  /** The request body for POST /api/plan. */
  function read() {
    const data = new FormData(form);
    const text = (/** @type {string} */ name) => String(data.get(name) ?? '');
    return {
      eventType: text('eventType'),
      title: text('title'),
      date: text('date'),
      city: text('city'),
      guests: Number(data.get('guests')),
      budget: Number(data.get('budget')),
      currency: text('currency'),
      style: text('style'),
      venueType: text('venueType'),
      language: text('language'),
      dietary: data.getAll('dietary').map(String),
      notes: text('notes'),
    };
  }

  /**
   * Restores a saved plan's inputs into the form.
   * @param {EventInput} input
   */
  function fill(input) {
    for (const [name, value] of Object.entries(input)) {
      if (name === 'dietary') continue;
      const field = /** @type {HTMLInputElement | null} */ (form.elements.namedItem(name));
      if (field) field.value = String(value);
    }
    for (const box of form.querySelectorAll('input[name="dietary"]')) {
      const checkbox = /** @type {HTMLInputElement} */ (box);
      checkbox.checked = input.dietary.includes(checkbox.value);
    }
    updateNotesCount();
  }

  /** @param {HTMLElement} el */
  function labelFor(el) {
    const label = form.querySelector(`label[for="${el.id}"]`)?.textContent ?? el.getAttribute('name') ?? '';
    return label.replace(/\(optional\)/, '').trim();
  }

  /**
   * Marks invalid fields and returns one problem per field.
   * @returns {FieldError[]}
   */
  function validate() {
    /** @type {FieldError[]} */
    const problems = [];
    const fields = /** @type {NodeListOf<HTMLInputElement>} */ (
      form.querySelectorAll('input, select, textarea')
    );
    for (const el of fields) {
      if (el.type === 'checkbox' || el.checkValidity()) continue;
      el.setAttribute('aria-invalid', 'true');
      problems.push({ fieldId: el.id, message: `${labelFor(el)}: ${el.validationMessage}` });
    }
    return problems;
  }

  /**
   * Shows an error summary. Problems tied to a field link to it, so keyboard
   * and screen-reader users can jump straight to what needs fixing.
   * @param {(FieldError | string)[]} problems
   */
  function showErrors(problems) {
    const items = problems.map((p) => {
      if (typeof p === 'string') return h('li', { text: p });
      const link = h('a', { href: `#${p.fieldId}`, text: p.message });
      link.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById(p.fieldId)?.focus();
      });
      return h('li', null, link);
    });
    errorsBox.replaceChildren(h('strong', { text: 'Please fix the following:' }), h('ul', null, ...items));
    errorsBox.hidden = false;
    errorsBox.focus();
  }

  function clearErrors() {
    errorsBox.hidden = true;
    errorsBox.replaceChildren();
    for (const el of form.querySelectorAll('[aria-invalid]')) el.removeAttribute('aria-invalid');
  }

  /** @param {boolean} busy */
  function setBusy(busy) {
    submitBtn.toggleAttribute('aria-busy', busy);
    submitBtn.disabled = busy;
    submitBtn.textContent = busy ? 'Planning your celebration…' : submitLabel;
  }

  return { read, fill, validate, showErrors, clearErrors, setBusy };
}
