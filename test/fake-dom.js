/**
 * A minimal, dependency-free DOM for rendering tests in Node. It implements
 * only what the view code uses: element creation, attributes, children, text,
 * inline styles and event listeners, plus a small query helper for asserts.
 */

class FakeNode {}

export class FakeElement extends FakeNode {
  /** @param {string} tagName */
  constructor(tagName) {
    super();
    this.tagName = tagName.toUpperCase();
    /** @type {Map<string, string>} */
    this.attributes = new Map();
    /** @type {(FakeElement | string)[]} */
    this.children = [];
    /** @type {Record<string, string>} */
    this.style = {};
    /** @type {Record<string, Function[]>} */
    this.listeners = {};
    /** @type {FakeElement | null} */
    this.parentElement = null;
    this.hidden = false;
    this.tabIndex = 0;
    const el = this;
    this.classList = {
      /** @param {string} c */
      add: (c) => el.setAttribute('class', [...new Set([...el.classes(), c])].join(' ')),
      /** @param {string} c */
      remove: (c) =>
        el.setAttribute(
          'class',
          el
            .classes()
            .filter((x) => x !== c)
            .join(' '),
        ),
      /** @param {string} c */
      contains: (c) => el.classes().includes(c),
    };
  }

  classes() {
    return this.className.split(/\s+/).filter(Boolean);
  }

  focus() {
    /** @type {any} */ (globalThis.document).activeElement = this;
  }

  get className() {
    return this.attributes.get('class') ?? '';
  }

  set className(value) {
    this.attributes.set('class', value);
  }

  get id() {
    return this.attributes.get('id') ?? '';
  }

  get textContent() {
    return this.children.map((c) => (typeof c === 'string' ? c : c.textContent)).join('');
  }

  set textContent(value) {
    this.children = [String(value)];
  }

  /** @param {string} name @param {string} value */
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  /** @param {string} name */
  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  /** @param {...(FakeElement | string)} nodes */
  append(...nodes) {
    for (const node of nodes) if (typeof node !== 'string') node.parentElement = this;
    this.children.push(...nodes);
  }

  /**
   * Supports the only selector form the app uses: `[attr="value"]`.
   * @param {string} selector
   */
  matches(selector) {
    const m = /^\[([\w-]+)="([^"]*)"\]$/.exec(selector);
    if (!m) throw new Error(`Unsupported selector in fake DOM: ${selector}`);
    return this.getAttribute(m[1]) === m[2];
  }

  /** @param {string} selector */
  querySelectorAll(selector) {
    return this.findAll((el) => el.matches(selector));
  }

  /** @param {string} selector */
  closest(selector) {
    /** @type {FakeElement | null} */
    let el = this;
    while (el && !el.matches(selector)) el = el.parentElement;
    return el;
  }

  /** @param {string} type @param {Function} fn */
  addEventListener(type, fn) {
    (this.listeners[type] ??= []).push(fn);
  }

  /** @param {string} type */
  dispatch(type) {
    for (const fn of this.listeners[type] ?? []) fn({ type, target: this });
  }

  /**
   * Every descendant matching a predicate, depth first.
   * @param {(el: FakeElement) => boolean} predicate
   * @returns {FakeElement[]}
   */
  findAll(predicate) {
    const found = [];
    for (const child of this.children) {
      if (typeof child === 'string') continue;
      if (predicate(child)) found.push(child);
      found.push(...child.findAll(predicate));
    }
    return found;
  }

  /** @param {string} cls */
  byClass(cls) {
    return this.findAll((el) => el.className.split(/\s+/).includes(cls));
  }

  /** @param {string} tag */
  byTag(tag) {
    return this.findAll((el) => el.tagName === tag.toUpperCase());
  }
}

/**
 * Installs the fake `document`, `Node`, `matchMedia` and `requestAnimationFrame`
 * as globals and returns a cleanup function. `body` is searched by
 * getElementById; `media` decides which media queries match.
 * @param {{ media?: Record<string, boolean> }} [options]
 */
export function installFakeDom({ media = {} } = {}) {
  const keys = /** @type {const} */ (['document', 'Node', 'matchMedia', 'requestAnimationFrame']);
  const previous = Object.fromEntries(keys.map((k) => [k, /** @type {any} */ (globalThis)[k]]));
  const body = new FakeElement('body');
  const g = /** @type {any} */ (globalThis);
  g.Node = FakeNode;
  g.document = {
    body,
    activeElement: null,
    createElement: (/** @type {string} */ tag) => new FakeElement(tag),
    createElementNS: (/** @type {string} */ _ns, /** @type {string} */ tag) => new FakeElement(tag),
    getElementById: (/** @type {string} */ id) => body.findAll((el) => el.id === id)[0] ?? null,
  };
  g.matchMedia = (/** @type {string} */ query) => ({ matches: Boolean(media[query]), addEventListener() {} });
  g.requestAnimationFrame = (/** @type {Function} */ fn) => fn();
  return () => {
    for (const k of keys) g[k] = previous[k];
  };
}

/**
 * Wraps rendered nodes in a root element so tests can query them together.
 * @param {(FakeElement | null)[]} nodes
 */
export function root(nodes) {
  const el = new FakeElement('div');
  el.append(...nodes.filter((n) => n !== null));
  return el;
}
