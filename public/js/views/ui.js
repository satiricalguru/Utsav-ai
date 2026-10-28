import { googleCalendarUrl } from '../calendar.js';
import { donut, icon } from '../charts.js';
import { h } from '../dom.js';
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  formatDate,
  formatMoneyCompact,
  relativeDays,
  taskStatus,
} from '../format.js';

/**
 * Shared building blocks for the dashboard views. Everything is built with
 * `h()`, which only ever sets text through textContent.
 */

/** @typedef {import('../../../types/plan.js').Budget} Budget */
/** @typedef {import('../../../types/plan.js').Milestone} Milestone */
/** @typedef {import('../../../types/plan.js').Risk} Risk */
/** @typedef {import('../../../types/plan.js').ScheduleItem} ScheduleItem */
/** @typedef {(key: string, value: boolean) => void} ToggleHandler */

/**
 * @typedef {object} TaskContext
 * @property {Record<string, boolean>} done ticked items, keyed `task:<id>` / `vendor:<id>`
 * @property {string} today `YYYY-MM-DD`
 * @property {string} lang language of AI-written text
 * @property {string} eventName
 * @property {string} eventDate
 * @property {string} idPrefix keeps element ids unique when a task appears twice
 * @property {ToggleHandler} onToggle
 */

const RTL_LANGUAGES = new Set(['ar', 'ur']);

/**
 * Language attributes for AI-written content so screen readers pronounce it
 * correctly and right-to-left scripts render properly.
 * @param {string} lang
 */
export function langAttrs(lang) {
  return { lang, dir: RTL_LANGUAGES.has(lang) ? 'rtl' : 'ltr' };
}

/**
 * A dashboard card with an icon title.
 * @param {string} title
 * @param {string} iconName symbol id from the sprite in index.html
 * @param {(Node | null)[]} body
 */
export function card(title, iconName, body) {
  return h(
    'section',
    { class: 'panel-card', 'aria-label': title },
    h('h3', { class: 'card-title' }, icon(iconName), title),
    ...body,
  );
}

/**
 * A signal-light status label (done, soon, now, overdue, later).
 * @param {string} key
 * @param {string} label
 */
export function pill(key, label) {
  return h('span', { class: `pill pill-${key}`, text: label });
}

/**
 * A text button that switches to another dashboard tab.
 * @param {string} text
 * @param {() => void} onClick
 */
export function linkButton(text, onClick) {
  return h('button', { type: 'button', class: 'link-btn', onclick: onClick, text });
}

/**
 * An accessible progress bar with a visible label.
 * @param {number} value
 * @param {number} max
 * @param {string} id unique id for the label
 * @param {string} labelText
 */
export function progressBar(value, max, id, labelText) {
  const bar = h('span');
  bar.style.width = `${max ? Math.min(100, Math.round((value / max) * 100)) : 0}%`;
  return h(
    'div',
    { class: 'progress-wrap' },
    h('p', { class: 'task-meta', id, text: labelText }),
    h(
      'div',
      {
        class: 'progress',
        role: 'progressbar',
        'aria-valuemin': '0',
        'aria-valuemax': String(max),
        'aria-valuenow': String(value),
        'aria-labelledby': id,
      },
      bar,
    ),
  );
}

/**
 * "4 of 18 done · 22%" progress for a checklist.
 * @param {number} done
 * @param {number} total
 * @param {string} name
 */
export function checklistProgress(done, total, name) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return progressBar(done, total, `${name}-progress-label`, `${done} of ${total} done · ${pct}%`);
}

/**
 * A small coloured square that keys a budget category.
 * @param {string} category
 */
export function categoryDot(category) {
  const dot = h('span', { class: 'legend-dot', 'aria-hidden': 'true' });
  dot.style.background = CATEGORY_COLORS[category];
  return dot;
}

/** @param {string} category */
export const categoryLabel = (category) => CATEGORY_LABELS[category];

/**
 * Budget donut with a legend of every category.
 * @param {Budget} budget
 */
export function budgetDonut(budget) {
  const slices = budget.lines.map((l) => ({
    value: l.amount,
    color: CATEGORY_COLORS[l.category],
  }));
  const shares = budget.lines.map((l) => `${categoryLabel(l.category)} ${l.percent}%`);
  const label = `Budget split: ${shares.join(', ')}`;
  const legend = h(
    'ul',
    { class: 'legend' },
    ...budget.lines.map((l) =>
      h(
        'li',
        null,
        categoryDot(l.category),
        h('span', { class: 'legend-name', text: categoryLabel(l.category) }),
        h('span', { class: 'legend-val', text: `${l.percent}%` }),
      ),
    ),
  );
  const centre = { center: formatMoneyCompact(budget.total, budget.currency), sub: 'total' };
  return h('div', { class: 'donut-wrap' }, donut(slices, label, centre), legend);
}

/**
 * A strip of colour swatches with a text alternative.
 * @param {string[]} palette
 */
export function moodSwatches(palette) {
  const strip = h('div', {
    class: 'mood-strip',
    role: 'img',
    'aria-label': `Colour palette: ${palette.join(', ')}`,
  });
  for (const colour of palette) {
    const swatch = h('span');
    swatch.style.backgroundColor = colour;
    strip.append(swatch);
  }
  return strip;
}

/**
 * The event-day run sheet.
 * @param {ScheduleItem[]} items
 * @param {string} lang
 */
export function scheduleList(items, lang) {
  return h(
    'ol',
    { class: 'schedule', ...langAttrs(lang) },
    ...items.map((s) => h('li', null, h('time', { text: s.time }), h('span', { text: s.activity }))),
  );
}

/**
 * Risks with their mitigations.
 * @param {Risk[]} risks
 * @param {string} lang
 */
export function riskList(risks, lang) {
  return h(
    'ul',
    { class: 'clean-list', ...langAttrs(lang) },
    ...risks.map((r) => h('li', null, h('strong', { text: `${r.risk}: ` }), r.mitigation)),
  );
}

/**
 * A checkbox wired to the shared done-state.
 * @param {string} id
 * @param {string} key
 * @param {boolean} checked
 * @param {ToggleHandler} onToggle
 */
export function toggleBox(id, key, checked, onToggle) {
  const box = /** @type {HTMLInputElement} */ (h('input', { type: 'checkbox', id, checked }));
  box.addEventListener('change', () => onToggle(key, box.checked));
  return box;
}

/**
 * Google Calendar link for one task.
 * @param {Milestone} m
 * @param {TaskContext} ctx
 */
function calendarLink(m, ctx) {
  const details = `Planned with Utsav AI for ${ctx.eventName} on ${formatDate(ctx.eventDate)}.`;
  return h(
    'a',
    {
      href: googleCalendarUrl(`${m.title} · ${ctx.eventName}`, m.due, details),
      target: '_blank',
      rel: 'noopener noreferrer',
      class: 'task-cal',
      'aria-label': `Add "${m.title}" to Google Calendar (opens in a new tab)`,
    },
    icon('calendar'),
    h('span', { class: 'task-cal-text', text: 'Add to Google Calendar' }),
  );
}

/**
 * A task row: checkbox, title, due date, status pill and calendar link.
 * @param {Milestone} m
 * @param {TaskContext} ctx
 */
export function taskRow(m, ctx) {
  const key = `task:${m.id}`;
  const id = `${ctx.idPrefix}-${m.id}`;
  const isDone = Boolean(ctx.done[key]);
  const status = taskStatus(m, isDone, ctx.today);
  const meta = `${formatDate(m.due)} · ${relativeDays(m.daysBefore)} · ${categoryLabel(m.category)}`;
  return h(
    'li',
    { class: `task status-${status.key}${isDone ? ' done' : ''}` },
    toggleBox(id, key, isDone, ctx.onToggle),
    h(
      'div',
      null,
      h('label', { for: id, class: 'task-title', ...(m.ai ? langAttrs(ctx.lang) : {}) }, m.title),
      m.ai ? h('span', { class: 'tag tag-ai', text: 'AI suggested' }) : null,
      h('p', { class: 'task-meta', text: meta }),
    ),
    h('div', { class: 'task-side' }, pill(status.key, status.label), calendarLink(m, ctx)),
  );
}
