/**
 * Tiny DOM builder. Text is always inserted with textContent, so model or user
 * output can never be interpreted as HTML.
 *
 * @param {string} tag
 * @param {Record<string, unknown> | null} [attrs]
 * @param {...(Node | string | number | null | undefined | false)} children
 * @returns {HTMLElement}
 */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') el.className = String(value);
    else if (key === 'text') el.textContent = String(value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), /** @type {EventListener} */ (value));
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, String(value));
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

/**
 * Accessible tabs following the WAI-ARIA Authoring Practices: arrow keys
 * (both axes), Home and End move between tabs; only the active tab is in the
 * tab order.
 * @param {HTMLElement} tablist
 */
export function initTabs(tablist) {
  const tabs = /** @type {HTMLButtonElement[]} */ ([...tablist.querySelectorAll('[role="tab"]')]);

  /** @param {HTMLButtonElement} tab @param {boolean} focus */
  function select(tab, focus) {
    for (const t of tabs) {
      const active = t === tab;
      t.setAttribute('aria-selected', String(active));
      t.tabIndex = active ? 0 : -1;
      const panel = document.getElementById(t.getAttribute('aria-controls') ?? '');
      if (panel) panel.hidden = !active;
    }
    if (focus) tab.focus();
  }

  tablist.addEventListener('click', (e) => {
    const tab = /** @type {HTMLElement} */ (e.target).closest('[role="tab"]');
    if (tab) select(/** @type {HTMLButtonElement} */ (tab), false);
  });
  tablist.addEventListener('keydown', (e) => {
    const i = tabs.indexOf(/** @type {HTMLButtonElement} */ (document.activeElement));
    if (i < 0) return;
    const next = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    select(tabs[(next + tabs.length) % tabs.length], true);
  });

  // The sidebar is vertical on wide screens and a horizontal strip on phones.
  const wide = matchMedia('(min-width: 1000px)');
  const syncOrientation = () => tablist.setAttribute('aria-orientation', wide.matches ? 'vertical' : 'horizontal');
  wide.addEventListener('change', syncOrientation);
  syncOrientation();

  return {
    /** @param {string} id @param {boolean} [focus] */
    select: (id, focus = false) => select(/** @type {HTMLButtonElement} */ (document.getElementById(id)), focus),
  };
}
