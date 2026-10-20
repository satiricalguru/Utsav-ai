import { googleCalendarUrl } from './calendar.js';
import { donut, icon, ring } from './charts.js';
import { h } from './dom.js';
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  EVENT_LABELS,
  FEASIBILITY_TEXT,
  daysUntil,
  formatDate,
  formatMoney,
  formatMoneyCompact,
  formatShortDate,
  nextTasks,
  relativeDays,
  taskStatus,
} from './format.js';

const RTL = new Set(['ar', 'ur']);

/** Signal colours for budget health, after the Flighty status system. */
const FEASIBILITY_STATUS = { unrealistic: 'overdue', tight: 'soon', comfortable: 'done', generous: 'done' };

/**
 * Language attributes for AI-written content so screen readers pronounce it
 * correctly and right-to-left scripts render properly.
 * @param {string} lang
 */
function langAttrs(lang) {
  return { lang, dir: RTL.has(lang) ? 'rtl' : 'ltr' };
}

/**
 * A dashboard card with a title row.
 * @param {string} title
 * @param {string} iconName
 * @param {(Node | null)[]} body
 * @param {Record<string, string>} [attrs]
 */
function card(title, iconName, body, attrs = {}) {
  return h('section', { class: `panel-card ${attrs.class ?? ''}`.trim(), 'aria-label': title }, h('h3', { class: 'card-title' }, icon(iconName), title), ...body);
}

/** @param {string} key @param {string} label */
function pill(key, label) {
  return h('span', { class: `pill pill-${key}`, text: label });
}

/** @param {string} title @param {string[]} items @param {Record<string, string>} attrs */
function listSection(title, items, attrs) {
  if (!items?.length) return null;
  return card(title, 'ideas', [h('ul', { class: 'clean-list', ...attrs }, ...items.map((i) => h('li', { text: i })))]);
}

/**
 * @param {string} label
 * @param {string} value
 * @param {string} sub
 * @param {Node | null} visual a ring beside the text, or a pill beneath it
 * @param {boolean} [stack] place the visual under the text instead of beside it
 */
function kpi(label, value, sub, visual, stack = false) {
  return h(
    'div',
    { class: 'kpi' },
    h('div', { class: 'kpi-text' }, h('p', { class: 'kpi-label', text: label }), h('p', { class: 'kpi-value', text: value }), h('p', { class: 'kpi-sub', text: sub }), stack ? visual : null),
    stack ? null : visual,
  );
}

/**
 * A task row with checkbox, signal-light status and calendar link.
 * @param {any} m milestone
 * @param {{ done: Record<string, boolean>, today: string, lang: string, eventName: string, eventDate: string, idPrefix: string, onToggle: (key: string, value: boolean) => void }} ctx
 */
function taskRow(m, ctx) {
  const key = `task:${m.id}`;
  const id = `${ctx.idPrefix}-${m.id}`;
  const isDone = Boolean(ctx.done[key]);
  const status = taskStatus(m, isDone, ctx.today);
  const box = h('input', { type: 'checkbox', id, checked: isDone });
  box.addEventListener('change', () => ctx.onToggle(key, /** @type {HTMLInputElement} */ (box).checked));
  return h(
    'li',
    { class: `task status-${status.key}${isDone ? ' done' : ''}` },
    box,
    h(
      'div',
      null,
      h('label', { for: id, class: 'task-title', ...(m.ai ? langAttrs(ctx.lang) : {}) }, m.title),
      m.ai ? h('span', { class: 'tag tag-ai', text: 'AI suggested' }) : null,
      h('p', { class: 'task-meta', text: `${formatDate(m.due)} · ${relativeDays(m.daysBefore)} · ${CATEGORY_LABELS[m.category]}` }),
    ),
    h(
      'div',
      { class: 'task-side' },
      pill(status.key, status.label),
      h('a', {
        href: googleCalendarUrl(`${m.title} · ${ctx.eventName}`, m.due, `Planned with Utsav AI for ${ctx.eventName} on ${formatDate(ctx.eventDate)}.`),
        target: '_blank',
        rel: 'noopener noreferrer',
        class: 'task-cal',
        'aria-label': `Add "${m.title}" to Google Calendar (opens in a new tab)`,
      }, icon('calendar'), h('span', { class: 'task-cal-text', text: 'Add to Google Calendar' })),
    ),
  );
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
    { class: 'progress-wrap' },
    h('p', { class: 'task-meta', id: `${label}-progress-label`, text: `${doneCount} of ${total} done · ${pct}%` }),
    h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-valuenow': String(doneCount), 'aria-labelledby': `${label}-progress-label` }, bar),
  );
}

/**
 * Budget donut with a legend of every category.
 * @param {any} budget
 */
function budgetDonut(budget) {
  const slices = budget.lines.map((/** @type {any} */ l) => ({ value: l.amount, color: CATEGORY_COLORS[l.category] }));
  const label = `Budget split: ${budget.lines.map((/** @type {any} */ l) => `${CATEGORY_LABELS[l.category]} ${l.percent}%`).join(', ')}`;
  const legend = h(
    'ul',
    { class: 'legend' },
    ...budget.lines.map((/** @type {any} */ l) => {
      const dot = h('span', { class: 'legend-dot', 'aria-hidden': 'true' });
      dot.style.background = CATEGORY_COLORS[l.category];
      return h('li', null, dot, h('span', { class: 'legend-name', text: CATEGORY_LABELS[l.category] }), h('span', { class: 'legend-val', text: `${l.percent}%` }));
    }),
  );
  return h('div', { class: 'donut-wrap' }, donut(slices, label, { center: formatMoneyCompact(budget.total, budget.currency), sub: 'total' }), legend);
}

/**
 * Overview tab: the dashboard at a glance.
 * @param {any} plan
 * @param {{ done: Record<string, boolean>, actuals: Record<string, number> }} state
 * @param {{ today: string, onToggle: (key: string, value: boolean) => void, onNavigate: (tabId: string) => void }} ctx
 */
export function renderOverview(plan, state, ctx) {
  const { input, budget, timeline, vendors, ideas } = plan;
  const la = langAttrs(input.language);
  const daysLeft = daysUntil(input.date, ctx.today);
  const planningWindow = Math.max(1, daysUntil(input.date, plan.generatedAt.slice(0, 10)));
  const tasksDone = timeline.milestones.filter((/** @type {any} */ m) => state.done[`task:${m.id}`]).length;
  const booked = vendors.filter((/** @type {any} */ v) => state.done[`vendor:${v.id}`]).length;
  const spent = budget.lines.reduce((/** @type {number} */ s, /** @type {any} */ l) => s + (state.actuals[l.category] ?? 0), 0);
  const health = budget.feasibility.level;

  const countdownLabel = daysLeft > 0 ? `${daysLeft}` : daysLeft === 0 ? 'Today' : 'Done';
  const kpis = h(
    'div',
    { class: 'kpi-grid' },
    kpi('Countdown', countdownLabel, daysLeft > 0 ? `days to ${formatDate(input.date)}` : formatDate(input.date), ring(planningWindow - Math.max(daysLeft, 0), planningWindow, `Planning time used: ${Math.round(((planningWindow - Math.max(daysLeft, 0)) / planningWindow) * 100)}%`, 'var(--saffron)')),
    kpi('Budget health', FEASIBILITY_TEXT[health], `${formatMoney(budget.perGuest, budget.currency)} per guest`, pill(FEASIBILITY_STATUS[health], health === 'unrealistic' ? 'Review' : health === 'tight' ? 'Watch' : 'On track'), true),
    kpi('Tasks', `${tasksDone}/${timeline.milestones.length}`, 'checklist done', ring(tasksDone, timeline.milestones.length, `Tasks done: ${tasksDone} of ${timeline.milestones.length}`, 'var(--ok-strong)')),
    kpi('Vendors', `${booked}/${vendors.length}`, 'booked and confirmed', ring(booked, vendors.length, `Vendors booked: ${booked} of ${vendors.length}`, 'var(--primary)')),
  );

  const spentBar = h('span');
  spentBar.style.width = `${Math.min(100, Math.round((spent / budget.total) * 100))}%`;
  const budgetCard = card('Budget overview', 'budget', [
    budgetDonut(budget),
    h(
      'div',
      { class: 'spent' },
      h('p', { class: 'task-meta', id: 'ov-spent-label', text: `Spent ${formatMoney(spent, budget.currency)} of ${formatMoney(budget.total, budget.currency)}` }),
      h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(budget.total), 'aria-valuenow': String(spent), 'aria-labelledby': 'ov-spent-label' }, spentBar),
    ),
    h('button', { type: 'button', class: 'link-btn', onclick: () => ctx.onNavigate('tab-budget'), text: 'Track spending →' }),
  ]);

  const eventName = input.title || EVENT_LABELS[input.eventType];
  const upcoming = nextTasks(timeline.milestones, state.done, 5);
  const upNext = card('Up next', 'timeline', [
    upcoming.length
      ? h('ul', { class: 'task-list compact' }, ...upcoming.map((m) => taskRow(m, { ...ctx, done: state.done, lang: input.language, eventName, eventDate: input.date, idPrefix: 'ov' })))
      : h('p', { class: 'notice notice-ok', text: 'Every task is done. Time to celebrate!' }),
    h('button', { type: 'button', class: 'link-btn', onclick: () => ctx.onNavigate('tab-timeline'), text: 'See full timeline →' }),
  ]);

  const theme = ideas.themes?.[0];
  const mood = theme
    ? card('Moodboard', 'ideas', [
        moodSwatches(theme.palette),
        h('div', la, h('p', { class: 'mood-name', text: theme.name }), h('p', { class: 'muted', text: theme.description }), theme.signatureMoment ? h('p', null, h('strong', { text: 'Signature moment: ' }), theme.signatureMoment) : null),
        h('button', { type: 'button', class: 'link-btn', onclick: () => ctx.onNavigate('tab-ideas'), text: 'All ideas →' }),
      ])
    : null;

  const schedule = ideas.daySchedule?.length
    ? card(`Run sheet · ${formatShortDate(input.date)}`, 'calendar', [
        h('ol', { class: 'schedule', ...la }, ...ideas.daySchedule.map((/** @type {any} */ s) => h('li', null, h('time', { text: s.time }), h('span', { text: s.activity })))),
      ])
    : ideas.risks?.length
      ? card('Watch out for', 'bulb', [h('ul', { class: 'clean-list', ...la }, ...ideas.risks.map((/** @type {any} */ r) => h('li', null, h('strong', { text: `${r.risk}: ` }), r.mitigation)))])
      : null;

  return [kpis, h('div', { class: 'dash-grid' }, budgetCard, upNext), h('div', { class: 'dash-grid' }, mood, schedule)];
}

/** @param {string[]} palette */
function moodSwatches(palette) {
  const strip = h('div', { class: 'mood-strip', role: 'img', 'aria-label': `Colour palette: ${palette.join(', ')}` });
  for (const c of palette) {
    const sw = h('span');
    sw.style.backgroundColor = c;
    strip.append(sw);
  }
  return strip;
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
    ...ideas.themes.map((/** @type {any} */ t) =>
      h(
        'article',
        { class: 'tile mood-tile', ...la },
        t.palette.length ? moodSwatches(t.palette) : null,
        h('h3', { text: t.name }),
        h('p', { text: t.description }),
        t.decorIdeas.length ? h('ul', null, ...t.decorIdeas.map((/** @type {string} */ d) => h('li', { text: d }))) : null,
        t.signatureMoment ? h('p', null, h('strong', { text: 'Signature moment: ' }), t.signatureMoment) : null,
      ),
    ),
  );

  const menu = ideas.menu?.dishes?.length
    ? card('Menu idea', 'ideas', [
        h('div', la, h('p', null, h('strong', { text: ideas.menu.concept })), h('ul', { class: 'dish-list' }, ...ideas.menu.dishes.map((/** @type {string} */ d) => h('li', { text: d }))), ideas.menu.dietaryNotes ? h('p', { class: 'hint', text: ideas.menu.dietaryNotes }) : null),
      ])
    : null;

  const schedule = ideas.daySchedule?.length
    ? card(`Event-day run sheet · ${formatDate(input.date)}`, 'calendar', [
        h('ol', { class: 'schedule', ...la }, ...ideas.daySchedule.map((/** @type {any} */ s) => h('li', null, h('time', { text: s.time }), h('span', { text: s.activity })))),
      ])
    : null;

  const risks = ideas.risks?.length
    ? card('Watch out for', 'bulb', [h('ul', { class: 'clean-list', ...la }, ...ideas.risks.map((/** @type {any} */ r) => h('li', null, h('strong', { text: `${r.risk}: ` }), r.mitigation)))])
    : null;

  return [h('h3', { class: 'panel-heading', text: 'Three theme concepts' }), themes, h('div', { class: 'dash-grid' }, menu, listSection('Guest experience touches', ideas.guestExperience, la)), h('div', { class: 'dash-grid' }, schedule, risks)];
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
    bar.style.background = CATEGORY_COLORS[l.category];
    const dot = h('span', { class: 'legend-dot', 'aria-hidden': 'true' });
    dot.style.background = CATEGORY_COLORS[l.category];
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
      h('th', { scope: 'row' }, dot, CATEGORY_LABELS[l.category]),
      h('td', { class: 'num', text: `${l.percent}%` }),
      h('td', { 'aria-hidden': 'true' }, h('div', { class: 'bar' }, bar)),
      h('td', { class: 'num', text: money(l.amount) }),
      h('td', { class: 'num' }, field),
      h('td', { class: 'num' }, diff === null ? '-' : diff < 0 ? pill('overdue', `${money(-diff)} over`) : pill('done', `${money(diff)} left`)),
    );
  });

  const table = h(
    'div',
    { class: 'table-wrap' },
    h(
      'table',
      null,
      h('caption', { text: 'Planned vs actual by category' }),
      h(
        'thead',
        null,
        h('tr', null, h('th', { scope: 'col', text: 'Category' }), h('th', { scope: 'col', class: 'num', text: 'Share' }), h('th', { scope: 'col' }, h('span', { class: 'visually-hidden', text: 'Share bar' })), h('th', { scope: 'col', class: 'num', text: 'Planned' }), h('th', { scope: 'col', class: 'num', text: 'Actual' }), h('th', { scope: 'col', class: 'num', text: 'Status' })),
      ),
      h('tbody', null, ...rows),
      h('tfoot', null, h('tr', null, h('td', { text: 'Total' }), h('td', { class: 'num', text: '100%' }), h('td'), h('td', { class: 'num', text: money(budget.total) }), h('td', { class: 'num', text: money(spent) }), h('td', { class: 'num' }, spent > budget.total ? pill('overdue', `${money(spent - budget.total)} over`) : pill('done', `${money(budget.total - spent)} left`)))),
    ),
  );

  const tips = ideas.budgetTips?.length
    ? card('Smart ways to save', 'bulb', [
        h(
          'ul',
          { class: 'clean-list', ...langAttrs(input.language) },
          ...ideas.budgetTips.map((/** @type {any} */ t) =>
            h('li', null, h('strong', { text: `${CATEGORY_LABELS[t.category]}: ` }), t.tip, ' ', h('span', { lang: 'en', dir: 'ltr' }, pill('done', `saves ~${money(t.estimatedSaving)}`))),
          ),
        ),
      ])
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
    h('div', { class: 'dash-grid' }, card('Where the money goes', 'budget', [budgetDonut(budget)]), tips),
    h('div', { class: 'panel-card' }, table),
  ];
}

/**
 * Month-axis Gantt of the planning phases (after the wedding UI kit reference).
 * Rendered as a list, so every phase and date range is real text.
 * @param {any[]} milestones
 * @param {string} today
 * @param {string} eventDate
 */
function gantt(milestones, today, eventDate) {
  const start = [today, ...milestones.map((m) => m.due)].sort()[0];
  const end = [eventDate, ...milestones.map((m) => m.due)].sort().at(-1) ?? eventDate;
  const span = Math.max(1, daysUntil(end, start));
  /** @type {Map<string, { from: string, to: string }>} */
  const phases = new Map();
  for (const m of milestones) {
    const p = phases.get(m.phase);
    if (!p) phases.set(m.phase, { from: m.due, to: m.due });
    else {
      if (m.due < p.from) p.from = m.due;
      if (m.due > p.to) p.to = m.due;
    }
  }
  const pos = (/** @type {string} */ d) => (daysUntil(d, start) / span) * 100;
  const todayMark = h('span', { class: 'gantt-today', 'aria-hidden': 'true' });
  todayMark.style.left = `${pos(today)}%`;
  const eventMark = h('span', { class: 'gantt-event', 'aria-hidden': 'true' });
  eventMark.style.left = `${pos(eventDate)}%`;

  return card('Planning at a glance', 'timeline', [
    h(
      'ol',
      { class: 'gantt' },
      ...[...phases.entries()].map(([name, r], i) => {
        const bar = h('span', { class: `gantt-bar g${i % 6}`, 'aria-hidden': 'true' });
        // Keep short bars (single-day phases) inside the track at the far end.
        bar.style.left = `min(${pos(r.from)}%, calc(100% - 10px))`;
        bar.style.width = `max(10px, ${pos(r.to) - pos(r.from)}%)`;
        return h('li', null, h('span', { class: 'gantt-label' }, h('b', { text: name }), h('small', { text: r.from === r.to ? formatShortDate(r.from) : `${formatShortDate(r.from)} – ${formatShortDate(r.to)}` })), h('span', { class: 'gantt-track' }, bar));
      }),
    ),
    h('div', { class: 'gantt-axis', 'aria-hidden': 'true' }, todayMark, eventMark, h('span', { text: formatShortDate(start) }), h('span', { text: formatShortDate(end) })),
    h('p', { class: 'gantt-legend hint' }, h('span', { class: 'key-today', 'aria-hidden': 'true' }), 'Today ', h('span', { class: 'key-event', 'aria-hidden': 'true' }), 'Event day'),
  ]);
}

/**
 * @param {any} plan
 * @param {Record<string, boolean>} done
 * @param {(key: string, value: boolean) => void} onToggle
 * @param {string} today
 */
export function renderTimeline(plan, done, onToggle, today) {
  const { timeline, input } = plan;
  const eventName = input.title || EVENT_LABELS[input.eventType];
  const milestones = timeline.milestones;
  const doneCount = milestones.filter((/** @type {any} */ m) => done[`task:${m.id}`]).length;
  const daysLeft = daysUntil(input.date, today);

  /** @type {Map<string, any[]>} */
  const phases = new Map();
  for (const m of milestones) {
    if (!phases.has(m.phase)) phases.set(m.phase, []);
    phases.get(m.phase)?.push(m);
  }

  const notice = timeline.compressed
    ? h('p', { class: 'notice notice-warn', text: `Only ${Math.max(daysLeft, 0)} days to go, so the usual schedule has been compressed. Tasks marked "Do now" are already behind a typical timeline.` })
    : h('p', { class: 'notice notice-ok', text: `${Math.max(daysLeft, 0)} days to go. Every task below is scheduled with a comfortable buffer.` });

  const ctx = { done, today, lang: input.language, eventName, eventDate: input.date, idPrefix: 'cb', onToggle };
  return [
    notice,
    gantt(milestones, today, input.date),
    h(
      'div',
      { class: 'panel-card' },
      progress(String(doneCount), milestones.length, 'timeline'),
      ...[...phases.entries()].map(([phase, items]) =>
        h('section', { class: 'phase', 'aria-label': phase }, h('h3', { text: phase }), h('ul', { class: 'task-list' }, ...items.map((m) => taskRow(m, ctx)))),
      ),
    ),
  ];
}

/**
 * @param {any} plan
 * @param {Record<string, boolean>} done
 * @param {(key: string, value: boolean) => void} onToggle
 * @param {string} today
 */
export function renderVendors(plan, done, onToggle, today) {
  const { vendors, budget } = plan;
  const amountFor = Object.fromEntries(budget.lines.map((/** @type {any} */ l) => [l.category, l.amount]));
  const booked = vendors.filter((/** @type {any} */ v) => done[`vendor:${v.id}`]).length;

  return [
    h('div', { class: 'panel-card' }, progress(String(booked), vendors.length, 'vendors')),
    h(
      'div',
      { class: 'cards' },
      ...vendors.map((/** @type {any} */ v) => {
        const key = `vendor:${v.id}`;
        const id = `vb-${v.id}`;
        const isBooked = Boolean(done[key]);
        const days = daysUntil(v.bookBy, today);
        const status = isBooked
          ? pill('done', 'Booked')
          : v.lateBooking || days <= 0
            ? pill('overdue', 'Book now')
            : days <= 14
              ? pill('soon', `Book in ${days} days`)
              : pill('later', `Book by ${formatShortDate(v.bookBy)}`);
        const box = h('input', { type: 'checkbox', id, checked: isBooked });
        box.addEventListener('change', () => onToggle(key, /** @type {HTMLInputElement} */ (box).checked));
        return h(
          'article',
          { class: `tile vendor${isBooked ? ' is-booked' : ''}`, 'aria-labelledby': `${id}-name` },
          h('div', { class: 'vendor-head' }, h('h3', { id: `${id}-name`, text: v.name }), status),
          h('p', { class: 'task-meta', text: `Book by ${formatDate(v.bookBy)}` }),
          amountFor[v.category] ? h('p', { class: 'task-meta', text: `Budget line: ${CATEGORY_LABELS[v.category]} · ${formatMoney(amountFor[v.category], budget.currency)}` }) : null,
          h('p', { class: 'ask-title' }, h('strong', { text: 'Ask before booking:' })),
          h('ul', { class: 'clean-list' }, ...v.questions.map((/** @type {string} */ q) => h('li', { text: q }))),
          h('div', { class: 'vendor-foot' }, h('label', { class: 'check-pill' }, box, ' Booked and confirmed'), h('a', { href: v.mapsUrl, target: '_blank', rel: 'noopener noreferrer', 'aria-label': `Find ${v.name} near ${plan.input.city} on Google Maps (opens in a new tab)`, text: 'Find on Google Maps' })),
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
