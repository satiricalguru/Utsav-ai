import { buildIcs } from './calendar.js';
import { h } from './dom.js';
import { planToText } from './format.js';

/**
 * The dashboard's action buttons: calendar export, copy summary, print and
 * jump back to the form.
 */

/** @typedef {import('../../types/plan.js').Plan} Plan */

const OBJECT_URL_LIFETIME_MS = 1000;

/**
 * Triggers a download of `content` as a file.
 * @param {string} content
 * @param {string} filename
 * @param {string} type
 */
function download(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = h('a', { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), OBJECT_URL_LIFETIME_MS);
}

/**
 * @param {{ getPlan: () => Plan | null, announce: (message: string) => void }} deps
 */
export function wireActions({ getPlan, announce }) {
  /** @param {string} id @param {() => void | Promise<void>} handler */
  const on = (id, handler) => document.getElementById(id)?.addEventListener('click', handler);

  on('btn-ics', () => {
    const plan = getPlan();
    if (!plan) return;
    download(buildIcs(plan), 'utsav-plan.ics', 'text/calendar;charset=utf-8');
    announce('Calendar file downloaded.');
  });

  on('btn-copy', async () => {
    const plan = getPlan();
    if (!plan) return;
    try {
      await navigator.clipboard.writeText(planToText(plan));
      announce('Plan summary copied to clipboard.');
    } catch {
      announce('Copy failed. Your browser blocked clipboard access.');
    }
  });

  on('btn-print', () => window.print());

  on('btn-edit', () => {
    document.getElementById('planner')?.scrollIntoView();
    document.getElementById('eventType')?.focus();
  });
}
