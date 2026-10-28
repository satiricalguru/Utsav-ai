import { h } from '../dom.js';
import { langAttrs } from './ui.js';

/**
 * One chat bubble. A visually hidden prefix tells screen-reader users who is
 * speaking, since the bubbles' sides are only a visual cue.
 * @param {'user' | 'assistant'} role
 * @param {string} text
 * @param {string} [lang] language of the assistant's reply
 */
export function chatMessage(role, text, lang) {
  const speaker = role === 'user' ? 'You said: ' : 'Utsav said: ';
  return h(
    'div',
    { class: `msg msg-${role}`, ...(role === 'assistant' && lang ? langAttrs(lang) : {}) },
    h('span', { class: 'visually-hidden', text: speaker }),
    text,
  );
}
