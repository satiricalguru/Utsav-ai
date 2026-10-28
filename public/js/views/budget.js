import { h } from '../dom.js';
import { CATEGORY_COLORS, FEASIBILITY_TEXT, formatMoney } from '../format.js';
import { budgetDonut, card, categoryDot, categoryLabel, langAttrs, pill } from './ui.js';

/**
 * The Budget tab: headline stats, the category split, savings tips and a
 * planned-vs-actual table where the host logs what they really spent.
 */

/** @typedef {import('../../../types/plan.js').Plan} Plan */
/** @typedef {import('../../../types/plan.js').BudgetLine} BudgetLine */
/** @typedef {(category: string, value: number | null) => void} ActualHandler */
/** @typedef {(n: number) => string} MoneyFormat */

/**
 * @param {string} label
 * @param {string} value
 */
function stat(label, value) {
  return h(
    'div',
    { class: 'stat' },
    h('p', { class: 'stat-label', text: label }),
    h('p', { class: 'stat-value', text: value }),
  );
}

/**
 * "₹5,000 over" or "₹5,000 left" against a planned amount.
 * @param {number} planned
 * @param {number} actual
 * @param {MoneyFormat} money
 */
function balancePill(planned, actual, money) {
  const diff = planned - actual;
  return diff < 0 ? pill('overdue', `${money(-diff)} over`) : pill('done', `${money(diff)} left`);
}

/**
 * Number field for the actual spend on one category.
 * @param {string} category
 * @param {number | undefined} actual
 * @param {ActualHandler} onActual
 */
function actualField(category, actual, onActual) {
  const field = /** @type {HTMLInputElement} */ (
    h('input', {
      id: `actual-${category}`,
      type: 'number',
      inputmode: 'numeric',
      min: '0',
      step: '1',
      value: actual ?? '',
      placeholder: '0',
      'aria-label': `Actual spend on ${categoryLabel(category)}`,
    })
  );
  field.addEventListener('change', () => {
    const v = field.valueAsNumber;
    onActual(category, Number.isFinite(v) && v >= 0 ? v : null);
  });
  return field;
}

/**
 * @param {BudgetLine} line
 * @param {number} maxAmount largest line, for scaling the share bar
 * @param {number | undefined} actual
 * @param {{ money: MoneyFormat, onActual: ActualHandler }} ctx
 */
function budgetRow(line, maxAmount, actual, { money, onActual }) {
  const bar = h('span');
  bar.style.width = `${Math.round((line.amount / maxAmount) * 100)}%`;
  bar.style.background = CATEGORY_COLORS[line.category];
  return h(
    'tr',
    null,
    h('th', { scope: 'row' }, categoryDot(line.category), categoryLabel(line.category)),
    h('td', { class: 'num', text: `${line.percent}%` }),
    h('td', { 'aria-hidden': 'true' }, h('div', { class: 'bar' }, bar)),
    h('td', { class: 'num', text: money(line.amount) }),
    h('td', { class: 'num' }, actualField(line.category, actual, onActual)),
    h('td', { class: 'num' }, actual === undefined ? '-' : balancePill(line.amount, actual, money)),
  );
}

/**
 * @param {Plan} plan
 * @param {Record<string, number>} actuals
 * @param {{ money: MoneyFormat, onActual: ActualHandler }} ctx
 */
function budgetTable({ budget }, actuals, ctx) {
  const maxAmount = Math.max(...budget.lines.map((l) => l.amount));
  const spent = budget.lines.reduce((sum, l) => sum + (actuals[l.category] ?? 0), 0);
  const columns = ['Category', 'Share', '', 'Planned', 'Actual', 'Status'];
  const head = h(
    'tr',
    null,
    ...columns.map((c, i) =>
      h(
        'th',
        { scope: 'col', class: i === 0 || i === 2 ? null : 'num' },
        c || h('span', { class: 'visually-hidden', text: 'Share bar' }),
      ),
    ),
  );
  const foot = h(
    'tr',
    null,
    h('td', { text: 'Total' }),
    h('td', { class: 'num', text: '100%' }),
    h('td'),
    h('td', { class: 'num', text: ctx.money(budget.total) }),
    h('td', { class: 'num', text: ctx.money(spent) }),
    h('td', { class: 'num' }, balancePill(budget.total, spent, ctx.money)),
  );
  return h(
    'div',
    { class: 'table-wrap' },
    h(
      'table',
      null,
      h('caption', { text: 'Planned vs actual by category' }),
      h('thead', null, head),
      h('tbody', null, ...budget.lines.map((l) => budgetRow(l, maxAmount, actuals[l.category], ctx))),
      h('tfoot', null, foot),
    ),
  );
}

/**
 * @param {Plan} plan
 * @param {MoneyFormat} money
 */
function tipsCard({ ideas, input }, money) {
  if (!ideas.budgetTips.length) return null;
  return card('Smart ways to save', 'bulb', [
    h(
      'ul',
      { class: 'clean-list', ...langAttrs(input.language) },
      ...ideas.budgetTips.map((t) =>
        h(
          'li',
          null,
          h('strong', { text: `${categoryLabel(t.category)}: ` }),
          t.tip,
          ' ',
          h('span', { lang: 'en', dir: 'ltr' }, pill('done', `saves ~${money(t.estimatedSaving)}`)),
        ),
      ),
    ),
  ]);
}

/**
 * @param {Plan} plan
 * @param {Record<string, number>} actuals
 * @param {ActualHandler} onActual
 */
export function renderBudget(plan, actuals, onActual) {
  const { budget } = plan;
  /** @type {MoneyFormat} */
  const money = (n) => formatMoney(n, budget.currency);
  return [
    h(
      'div',
      { class: 'stat-row' },
      stat('Total budget', money(budget.total)),
      stat('Per guest', money(budget.perGuest)),
      stat('Catering per plate', money(budget.feasibility.perPlate)),
      stat('Budget health', FEASIBILITY_TEXT[budget.feasibility.level]),
    ),
    ...budget.warnings.map((w) => h('p', { class: 'notice notice-warn', text: w })),
    h(
      'div',
      { class: 'dash-grid' },
      card('Where the money goes', 'budget', [budgetDonut(budget)]),
      tipsCard(plan, money),
    ),
    h('div', { class: 'panel-card' }, budgetTable(plan, actuals, { money, onActual })),
  ];
}
