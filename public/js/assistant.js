import { ApiError, postJson } from './api.js';
import { h } from './dom.js';
import { chatMessage } from './views/index.js';

/**
 * The "Ask Utsav" conversation: sends questions with the plan's inputs and a
 * short history, renders replies and offers follow-up suggestions.
 */

/** @typedef {import('../../types/plan.js').EventInput} EventInput */
/** @typedef {import('../../types/plan.js').ChatTurn} ChatTurn */
/** @typedef {import('../../types/plan.js').ChatReply} ChatReply */

const HISTORY_TURNS = 6;
const DEFAULT_SUGGESTIONS = [
  'How can I cut costs by 15% without losing the vibe?',
  'What should I do this week?',
  'Suggest a fun activity for guests of all ages',
];

/**
 * @param {{ getEvent: () => EventInput | null }} deps
 */
export function createChat({ getEvent }) {
  const log = /** @type {HTMLElement} */ (document.getElementById('chat-log'));
  const form = /** @type {HTMLFormElement} */ (document.getElementById('chat-form'));
  const input = /** @type {HTMLInputElement} */ (document.getElementById('chat-input'));
  const send = /** @type {HTMLButtonElement} */ (document.getElementById('chat-send'));
  const suggestions = /** @type {HTMLElement} */ (document.getElementById('chat-suggestions'));
  /** @type {ChatTurn[]} */
  let history = [];

  /** @param {string[]} questions */
  function suggest(questions) {
    suggestions.replaceChildren(
      ...questions.map((q) => h('button', { type: 'button', class: 'chip', text: q, onclick: () => ask(q) })),
    );
  }

  /** @param {boolean} busy */
  function setBusy(busy) {
    send.toggleAttribute('aria-busy', busy);
    send.disabled = busy;
  }

  /** @param {string} question */
  async function ask(question) {
    const event = getEvent();
    if (!event || !question.trim()) return;
    log.append(chatMessage('user', question));
    input.value = '';
    setBusy(true);
    try {
      /** @type {ChatReply} */
      const reply = await postJson('/api/chat', { event, question, history });
      log.append(chatMessage('assistant', reply.answer, event.language));
      /** @type {ChatTurn[]} */
      const turns = [
        { role: 'user', text: question },
        { role: 'assistant', text: reply.answer },
      ];
      history = [...history, ...turns].slice(-HISTORY_TURNS);
      suggest(reply.followUps.length ? reply.followUps : DEFAULT_SUGGESTIONS);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
      log.append(chatMessage('assistant', message));
    } finally {
      setBusy(false);
      log.scrollTop = log.scrollHeight;
      input.focus();
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    ask(input.value);
  });

  /** Clears the conversation, e.g. when a new plan is created. */
  function reset() {
    history = [];
    log.replaceChildren();
    suggest(DEFAULT_SUGGESTIONS);
  }

  return { reset };
}
