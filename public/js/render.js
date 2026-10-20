import { googleCalendarUrl } from './calendar.js';
import { h } from './dom.js';
import { CATEGORY_LABELS, EVENT_LABELS, FEASIBILITY_TEXT, formatDate, formatMoney, relativeDays } from './format.js';

const RTL = new Set(['ar', 'ur']);

/**
 * Language attributes for AI-written content so screen readers pronounce it
 * correctly and right-to-left scripts render properly.
 * @param {string} lang
 */
function langAttrs(lang) {
  return { lang, dir: RTL.has(lang) ? 'rtl' : 'ltr' };
}

/** @param {string} title @param {string[]} items @param {Record<string, string>} attrs */
function listSection(title, items, attrs) {
  if (!items?.length) return null;
  return h('section', { class: 'section', 'aria-label': title }, h('h3', { text: title }), h('ul', attrs, ...items.map((i) => h('li', { text: i }))));
}

/**
 * @param {any} plan
 */
export function renderIdeas(plan) {
  const { ideas, input } = plan;
  const la = langAttrs(input.language);

  const themes = h(
    'div',
    { class: 'cards' },
    ...ideas.themes.map((t) =>
      h(
        'article',
        { class: 'tile', ...la },
        h('h3', { text: t.name }),
        t.palette.length
          ? h(
              'div',
              { class: 'palette', role: 'img', 'aria-label': `Colour palette: ${t.palette.join(', ')}` },
              ...t.palette.map((c) => {
                const sw = h('span', { class: 'swatch' });
                sw.style.backgroundColor = c;
                return sw;
              }),
            )
          : null,
        h('p', { text: t.description }),
        t.decorIdeas.length ? h('ul', null, ...t.decorIdeas.map((d) => h('li', { text: d }))) : null,
        t.signatureMoment ? h('p', null, h('strong', { text: 'Signature moment: ' }), t.signatureMoment) : null,
      ),
    ),
  );

  const menu = ideas.menu?.dishes?.length
    ? h(
        'section',
        { class: 'section', ...la },
        h('h3', { text: 'Menu idea' }),
        h('p', null, h('strong', { text: ideas.menu.concept })),
        h('ul', null, ...ideas.menu.dishes.map((d) => h('li', { text: d }))),
        ideas.menu.dietaryNotes ? h('p', { class: 'hint', text: ideas.menu.dietaryNotes }) : null,
      )
    : null;

  const schedule = ideas.daySchedule?.length
    ? h(
        'section',
        { class: 'section' },
        h('h3', { text: `Event-day run sheet · ${formatDate(input.date)}` }),
        h('ol', { class: 'schedule', ...la }, ...ideas.daySchedule.map((s) => h('li', null, h('time', { text: s.time }), h('span', { text: s.activity })))),
      )
    : null;

  const risks = ideas.risks?.length
    ? h(
        'section',
        { class: 'section' },
        h('h3', { text: 'Watch out for' }),
        h('ul', la, ...ideas.risks.map((r) => h('li', null, h('strong', { text: `${r.risk}: ` }), r.mitigation))),
      )
    : null;

  return [h('h3', { text: 'Three theme concepts' }), themes, menu, listSection('Guest experience touches', ideas.guestExperience, la), schedule, risks];
}

/**
 * @param {any} plan
 * @param {Record<string, number>} actuals
 * @param {(category: string, value: number | null) => void} onActual
 */
export function renderBudget(plan, actuals, onActual) {
  const { budget, input, ideas } = plan;
  const money = (/** @type {number} */ n) => formatMoney(n, budget.currency);
  const maxAmount = Math.max(...budget.lines.map((/** @type {any} */ l) => l.amount));
  const spent = budget.lines.reduce((/** @type {number} */ sum, /** @type {any} */ l) => sum + (actuals[l.category] ?? 0), 0);

  const stat = (/** @type {string} */ label, /** @type {string} */ value) =>
    h('div', { class: 'stat' }, h('p', { class: 'stat-label', text: label }), h('p', { class: 'stat-value', text: value }));

  const rows = budget.lines.map((/** @type {any} */ l) => {
    const bar = h('span');
    bar.style.width = `${Math.round((l.amount / maxAmount) * 100)}%`;
    const actual = actuals[l.category];
    const inputId = `actual-${l.category}`;
    const field = h('input', {
      id: inputId,
      type: 'number',
      inputmode: 'numeric',
      min: '0',
      step: '1',
      value: actual ?? '',
      placeholder: '0',
      'aria-label': `Actual spend on ${CATEGORY_LABELS[l.category]}`,
    });
    field.addEventListener('change', () => {
      const v = /** @type {HTMLInputElement} */ (field).valueAsNumber;
      onActual(l.category, Number.isFinite(v) && v >= 0 ? v : null);
    });
    const diff = actual === undefined ? null : l.amount - actual;
    return h(
      'tr',
      null,
      h('th', { scope: 'row', text: CATEGORY_LABELS[l.category] }),
      h('td', { class: 'num', text: `${l.percent}%` }),
      h('td', { 'aria-hidden': 'true' }, h('div', { class: 'bar' }, bar)),
      h('td', { class: 'num', text: money(l.amount) }),
      h('td', { class: 'num' }, field),
      h('td', { class: `num${diff !== null && diff < 0 ? ' over' : ''}`, text: diff === null ? '-' : diff < 0 ? `${money(-diff)} over` : `${money(diff)} left` }),
    );
  });

  const table = h(
    'div',
    { class: 'table-wrap' },
    h(
      'table',
      null,
      h('caption', { text: 'Budget split by category' }),
      h(
        'thead',
        null,
        h('tr', null, h('th', { scope: 'col', text: 'Category' }), h('th', { scope: 'col', class: 'num', text: 'Share' }), h('th', { scope: 'col' }, h('span', { class: 'visually-hidden', text: 'Share bar' })), h('th', { scope: 'col', class: 'num', text: 'Planned' }), h('th', { scope: 'col', class: 'num', text: 'Actual' }), h('th', { scope: 'col', class: 'num', text: 'Status' })),
      ),
      h('tbody', null, ...rows),
      h('tfoot', null, h('tr', null, h('td', { text: 'Total' }), h('td', { class: 'num', text: '100%' }), h('td'), h('td', { class: 'num', text: money(budget.total) }), h('td', { class: 'num', text: money(spent) }), h('td', { class: `num${spent > budget.total ? ' over' : ''}`, text: spent > budget.total ? `${money(spent - budget.total)} over` : `${money(budget.total - spent)} left` }))),
    ),
  );

  const tips = ideas.budgetTips?.length
    ? h(
        'section',
        { class: 'section' },
        h('h3', { text: 'Smart ways to save' }),
        h(
          'ul',
          langAttrs(input.language),
          ...ideas.budgetTips.map((/** @type {any} */ t) =>
            h('li', null, h('strong', { text: `${CATEGORY_LABELS[t.category]}: ` }), t.tip, h('span', { class: 'hint', lang: 'en', dir: 'ltr', text: ` (saves about ${money(t.estimatedSaving)})` })),
          ),
        ),
      )
    : null;

  return [
    h(
      'div',
      { class: 'stat-row' },
      stat('Total budget', money(budget.total)),
      stat('Per guest', money(budget.perGuest)),
      stat('Catering per plate', money(budget.feasibility.perPlate)),
      stat('Budget health', FEASIBILITY_TEXT[budget.feasibility.level]),
    ),
    ...budget.warnings.map((/** @type {string} */ w) => h('p', { class: 'notice notice-warn', text: w })),
    table,
    tips,
  ];
}

/**
 * @param {string} doneCount
 * @param {number} total
 * @param {string} label
 */
function progress(doneCount, total, label) {
  const pct = total ? Math.round((Number(doneCount) / total) * 100) : 0;
  const bar = h('span');
  bar.style.width = `${pct}%`;
  return h(
    'div',
    null,
    h('p', { class: 'task-meta', id: `${label}-progress-label`, text: `${doneCount} of ${total} done` }),
    h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-valuenow': String(doneCount), 'aria-labelledby': `${label}-progress-label` }, bar),
  );
}

/**
 * @param {any} plan
 * @param {Record<string, boolean>} done
 * @param {(key: string, value: boolean) => void} onToggle
 */
export function renderTimeline(plan, done, onToggle) {
  const { timeline, input } = plan;
  const eventName = input.title || EVENT_LABELS[input.eventType];
  const milestones = timeline.milestones;
  const doneCount = milestones.filter((/** @type {any} */ m) => done[`task:${m.id}`]).length;

  /** @type {Map<string, any[]>} */
  const phases = new Map();
  for (const m of milestones) {
    if (!phases.has(m.phase)) phases.set(m.phase, []);
    phases.get(m.phase)?.push(m);
  }

  const notice = timeline.compressed
    ? h('p', { class: 'notice notice-warn', text: `Only ${timeline.daysLeft} days to go, so the usual schedule has been compressed. Tasks marked "Do now" are already behind a typical timeline.` })
    : h('p', { class: 'notice notice-ok', text: `${timeline.daysLeft} days to go. Every task below is scheduled with a comfortable buffer.` });

  return [
    notice,
    progress(String(doneCount), milestones.length, 'timeline'),
    ...[...phases.entries()].map(([phase, items]) =>
      h(
        'section',
        { class: 'phase', 'aria-label': phase },
        h('h3', { text: phase }),
        h(
          'ul',
          { class: 'task-list' },
          ...items.map((m) => {
            const key = `task:${m.id}`;
            const id = `cb-${m.id}`;
            const box = h('input', { type: 'checkbox', id, checked: Boolean(done[key]) });
            box.addEventListener('change', () => onToggle(key, /** @type {HTMLInputElement} */ (box).checked));
            return h(
              'li',
              { class: `task${done[key] ? ' done' : ''}` },
              box,
              h(
                'div',
                null,
                h('label', { for: id, class: 'task-title', ...(m.ai ? langAttrs(input.language) : {}) }, m.title),
                m.urgent ? h('span', { class: 'tag tag-urgent', text: 'Do now' }) : null,
                m.ai ? h('span', { class: 'tag tag-ai', text: 'AI suggested' }) : null,
                h('p', { class: 'task-meta', text: `${formatDate(m.due)} · ${relativeDays(m.daysBefore)} · ${CATEGORY_LABELS[m.category]}` }),
              ),
              h('a', {
                href: googleCalendarUrl(`${m.title} · ${eventName}`, m.due, `Planned with Utsav AI for ${eventName} on ${formatDate(input.date)}.`),
                target: '_blank',
                rel: 'noopener noreferrer',
                'aria-label': `Add "${m.title}" to Google Calendar (opens in a new tab)`,
                text: 'Add to Google Calendar',
              }),
            );
          }),
        ),
      ),
    ),
  ];
}

/**
 * @param {any} plan
 * @param {Record<string, boolean>} done
 * @param {(key: string, value: boolean) => void} onToggle
 */
export function renderVendors(plan, done, onToggle) {
  const { vendors, budget } = plan;
  const amountFor = Object.fromEntries(budget.lines.map((/** @type {any} */ l) => [l.category, l.amount]));
  const booked = vendors.filter((/** @type {any} */ v) => done[`vendor:${v.id}`]).length;

  return [
    progress(String(booked), vendors.length, 'vendors'),
    h(
      'div',
      { class: 'cards' },
      ...vendors.map((/** @type {any} */ v) => {
        const key = `vendor:${v.id}`;
        const id = `vb-${v.id}`;
        const box = h('input', { type: 'checkbox', id, checked: Boolean(done[key]) });
        box.addEventListener('change', () => onToggle(key, /** @type {HTMLInputElement} */ (box).checked));
        return h(
          'article',
          { class: 'tile', 'aria-labelledby': `${id}-name` },
          h('h3', { id: `${id}-name`, text: v.name }),
          h('p', { class: 'task-meta' }, `Book by ${formatDate(v.bookBy)}`, v.lateBooking ? h('span', { class: 'tag tag-urgent', text: 'Book now' }) : null),
          amountFor[v.category] ? h('p', { class: 'task-meta', text: `Budget line: ${CATEGORY_LABELS[v.category]} · ${formatMoney(amountFor[v.category], budget.currency)}` }) : null,
          h('p', null, h('strong', { text: 'Ask before booking:' })),
          h('ul', null, ...v.questions.map((/** @type {string} */ q) => h('li', { text: q }))),
          h('p', { class: 'task' }, box, h('label', { for: id, text: 'Booked and confirmed' })),
          h('a', { href: v.mapsUrl, target: '_blank', rel: 'noopener noreferrer', 'aria-label': `Find ${v.name} near ${plan.input.city} on Google Maps (opens in a new tab)`, text: 'Find on Google Maps' }),
        );
      }),
    ),
  ];
}

/**
 * @param {'user' | 'assistant'} role
 * @param {string} text
 * @param {string} [lang]
 */
export function chatMessage(role, text, lang) {
  return h('div', { class: `msg msg-${role}`, ...(role === 'assistant' && lang ? langAttrs(lang) : {}) }, h('span', { class: 'visually-hidden', text: role === 'user' ? 'You said: ' : 'Utsav said: ' }), text);
}
