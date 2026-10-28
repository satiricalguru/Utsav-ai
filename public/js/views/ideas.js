import { h } from '../dom.js';
import { formatDate } from '../format.js';
import { card, langAttrs, moodSwatches, riskList, scheduleList } from './ui.js';

/**
 * The Ideas tab: theme moodboards, menu, guest touches, run sheet and risks,
 * all written by Gemini in the plan's language.
 */

/** @typedef {import('../../../types/plan.js').Plan} Plan */
/** @typedef {import('../../../types/plan.js').Theme} Theme */

/**
 * @param {Theme} theme
 * @param {string} lang
 */
function themeTile(theme, lang) {
  return h(
    'article',
    { class: 'tile mood-tile', ...langAttrs(lang) },
    theme.palette.length ? moodSwatches(theme.palette) : null,
    h('h3', { text: theme.name }),
    h('p', { text: theme.description }),
    theme.decorIdeas.length ? h('ul', null, ...theme.decorIdeas.map((d) => h('li', { text: d }))) : null,
    theme.signatureMoment
      ? h('p', null, h('strong', { text: 'Signature moment: ' }), theme.signatureMoment)
      : null,
  );
}

/** @param {Plan} plan */
function menuCard({ ideas, input }) {
  if (!ideas.menu.dishes.length) return null;
  return card('Menu idea', 'ideas', [
    h(
      'div',
      langAttrs(input.language),
      h('p', null, h('strong', { text: ideas.menu.concept })),
      h('ul', { class: 'dish-list' }, ...ideas.menu.dishes.map((d) => h('li', { text: d }))),
      ideas.menu.dietaryNotes ? h('p', { class: 'hint', text: ideas.menu.dietaryNotes }) : null,
    ),
  ]);
}

/** @param {Plan} plan */
function guestCard({ ideas, input }) {
  if (!ideas.guestExperience.length) return null;
  return card('Guest experience touches', 'ideas', [
    h(
      'ul',
      { class: 'clean-list', ...langAttrs(input.language) },
      ...ideas.guestExperience.map((g) => h('li', { text: g })),
    ),
  ]);
}

/** @param {Plan} plan */
export function renderIdeas(plan) {
  const { ideas, input } = plan;
  const schedule = ideas.daySchedule.length
    ? card(`Event-day run sheet · ${formatDate(input.date)}`, 'calendar', [
        scheduleList(ideas.daySchedule, input.language),
      ])
    : null;
  const risks = ideas.risks.length
    ? card('Watch out for', 'bulb', [riskList(ideas.risks, input.language)])
    : null;

  return [
    h('h3', { class: 'panel-heading', text: 'Three theme concepts' }),
    h('div', { class: 'cards' }, ...ideas.themes.map((t) => themeTile(t, input.language))),
    h('div', { class: 'dash-grid' }, menuCard(plan), guestCard(plan)),
    h('div', { class: 'dash-grid' }, schedule, risks),
  ];
}
