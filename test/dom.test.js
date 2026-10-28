import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { FakeElement, installFakeDom } from './fake-dom.js';

let restore = () => {};
/** @type {typeof import('../public/js/dom.js')} */
let dom;

before(async () => {
  restore = installFakeDom({
    media: { '(min-width: 1000px)': true, '(prefers-reduced-motion: reduce)': true },
  });
  dom = await import('../public/js/dom.js');
});

after(() => restore());

/** @param {FakeElement} el */
const asHtml = (el) => /** @type {HTMLElement} */ (/** @type {unknown} */ (el));

describe('h()', () => {
  it('builds elements with text, classes, booleans and listeners, skipping empty values', () => {
    let clicked = 0;
    const el = /** @type {FakeElement} */ (
      /** @type {unknown} */ (
        dom.h(
          'button',
          { class: 'btn', text: 'Go', disabled: true, hidden: false, title: null, onclick: () => clicked++ },
          null,
          false,
          ' now',
        )
      )
    );
    assert.equal(el.className, 'btn');
    assert.equal(el.textContent, 'Go now');
    assert.equal(el.getAttribute('disabled'), '');
    assert.equal(el.getAttribute('hidden'), null);
    assert.equal(el.getAttribute('title'), null);
    el.dispatch('click');
    assert.equal(clicked, 1);
  });

  it('never interprets text as markup', () => {
    const el = /** @type {FakeElement} */ (
      /** @type {unknown} */ (dom.h('p', null, '<img src=x onerror=alert(1)>'))
    );
    assert.deepEqual(el.children, ['<img src=x onerror=alert(1)>']);
  });
});

describe('enter', () => {
  it('animates a panel in unless the user prefers reduced motion', () => {
    const panel = new FakeElement('div');
    /** @type {unknown[]} */
    const calls = [];
    Object.assign(panel, { animate: (/** @type {unknown[]} */ ...args) => calls.push(args) });
    dom.enter(asHtml(panel));
    assert.equal(calls.length, 0, 'reduced motion: no animation');
    assert.ok(panel.classList.contains('is-entering'), 'charts still get their entry state');

    const g = /** @type {any} */ (globalThis);
    const original = g.matchMedia;
    g.matchMedia = () => ({ matches: false, addEventListener() {} });
    try {
      dom.enter(asHtml(panel));
      assert.equal(calls.length, 1);
    } finally {
      g.matchMedia = original;
    }
  });
});

describe('createAnnouncer', () => {
  it('clears then sets the live region so repeats are re-announced', () => {
    const region = new FakeElement('div');
    const announce = dom.createAnnouncer(asHtml(region));
    announce('Saved');
    assert.equal(region.textContent, 'Saved');
    announce('Saved');
    assert.equal(region.textContent, 'Saved');
  });
});

describe('initTabs', () => {
  /** Builds a tablist with three tabs and panels inside the fake body. */
  function setup() {
    const body = /** @type {FakeElement} */ (/** @type {any} */ (globalThis.document).body);
    body.children = [];
    const list = new FakeElement('div');
    const tabs = ['a', 'b', 'c'].map((id) => {
      const tab = new FakeElement('button');
      tab.setAttribute('role', 'tab');
      tab.setAttribute('id', `tab-${id}`);
      tab.setAttribute('aria-controls', `panel-${id}`);
      const panel = new FakeElement('div');
      panel.setAttribute('id', `panel-${id}`);
      panel.hidden = id !== 'a'; // as in index.html: only the first panel starts visible
      list.append(tab);
      body.append(panel);
      return { tab, panel };
    });
    body.append(list);
    return { list, tabs, api: dom.initTabs(asHtml(list)) };
  }

  it('selects by click and shows only the matching panel', () => {
    const { tabs } = setup();
    tabs[1].tab.parentElement?.dispatch('click');
    const listener = /** @type {Function} */ (tabs[1].tab.parentElement?.listeners.click[0]);
    listener({ target: tabs[1].tab });
    assert.equal(tabs[1].tab.getAttribute('aria-selected'), 'true');
    assert.equal(tabs[0].tab.getAttribute('aria-selected'), 'false');
    assert.equal(tabs[1].panel.hidden, false);
    assert.equal(tabs[0].panel.hidden, true);
    assert.equal(tabs[1].tab.tabIndex, 0);
    assert.equal(tabs[0].tab.tabIndex, -1);
    assert.ok(tabs[1].panel.classList.contains('is-entering'), 'newly shown panels animate in');
  });

  it('moves with arrow keys (both axes), Home and End, wrapping around', () => {
    const { list, tabs } = setup();
    const keydown = /** @type {Function} */ (list.listeners.keydown[0]);
    /** @param {string} key */
    const press = (key) => keydown({ key, preventDefault() {} });
    tabs[0].tab.focus();
    press('ArrowDown');
    assert.equal(tabs[1].tab.getAttribute('aria-selected'), 'true');
    press('ArrowRight');
    press('ArrowRight');
    assert.equal(tabs[0].tab.getAttribute('aria-selected'), 'true', 'wraps to the first tab');
    press('ArrowUp');
    assert.equal(tabs[2].tab.getAttribute('aria-selected'), 'true', 'wraps to the last tab');
    press('Home');
    assert.equal(tabs[0].tab.getAttribute('aria-selected'), 'true');
    press('End');
    assert.equal(tabs[2].tab.getAttribute('aria-selected'), 'true');
    press('x');
    assert.equal(tabs[2].tab.getAttribute('aria-selected'), 'true', 'other keys are ignored');
  });

  it('reflects the layout in aria-orientation and selects programmatically', () => {
    const { list, tabs, api } = setup();
    assert.equal(list.getAttribute('aria-orientation'), 'vertical');
    api.select('tab-c', true);
    assert.equal(tabs[2].tab.getAttribute('aria-selected'), 'true');
    assert.equal(/** @type {any} */ (globalThis.document).activeElement, tabs[2].tab);
  });
});
