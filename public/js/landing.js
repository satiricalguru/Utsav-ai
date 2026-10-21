import { initHeroGl } from './hero-gl.js';

/**
 * Landing-page motion: scroll reveals, the pinned "how it works" story, hero
 * parallax, counters and the language cycler. Everything is progressive
 * enhancement: without JavaScript the content is fully visible, and with
 * reduced motion the page shows final states without animating.
 */

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
document.documentElement.classList.add('js');
if (reducedMotion) document.documentElement.classList.add('reduced-motion');

const hero = /** @type {HTMLElement | null} */ (document.querySelector('.hero'));
const canvas = /** @type {HTMLCanvasElement | null} */ (document.querySelector('.hero-gl'));
const nav = document.querySelector('.site-header');
const heroGl = canvas ? initHeroGl(canvas, { reducedMotion }) : null;

// --- Hero parallax and nav state (one rAF-throttled scroll handler) --------
let ticking = false;
function onScroll() {
  ticking = false;
  const height = hero?.clientHeight || window.innerHeight;
  const progress = Math.min(1, Math.max(0, window.scrollY / height));
  hero?.style.setProperty('--hero-progress', progress.toFixed(3));
  heroGl?.setScroll(progress);
  nav?.classList.toggle('is-solid', window.scrollY > height - 80);
}
window.addEventListener(
  'scroll',
  () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(onScroll);
    }
  },
  { passive: true },
);
onScroll();

// --- Reveal on scroll -------------------------------------------------------
const revealer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-visible');
      revealer.unobserve(entry.target);
      const counter = entry.target.querySelector('[data-count-to]');
      if (counter) countUp(/** @type {HTMLElement} */ (counter));
    }
  },
  { rootMargin: '0px 0px -12% 0px' },
);
for (const el of document.querySelectorAll('.reveal')) revealer.observe(el);

/** @param {HTMLElement} el */
function countUp(el) {
  const target = Number(el.dataset.countTo);
  const format = new Intl.NumberFormat('en-IN');
  if (reducedMotion) {
    el.textContent = format.format(target);
    return;
  }
  const start = performance.now();
  const duration = 1400;
  const step = (/** @type {number} */ now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = format.format(Math.round(target * eased));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// --- Pinned story: the active step drives the mock plan card ---------------
const mock = document.querySelector('.mock-plan');
const steps = [...document.querySelectorAll('.story-step')];
/** @param {number} stage */
function setStage(stage) {
  if (!mock) return;
  mock.setAttribute('data-stage', String(stage));
  for (const el of mock.querySelectorAll('[data-from]')) {
    el.classList.toggle('is-on', Number(/** @type {HTMLElement} */ (el).dataset.from) <= stage);
  }
  steps.forEach((s, i) => s.classList.toggle('is-active', i + 1 === stage));
}
const storyObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) setStage(steps.indexOf(entry.target) + 1);
    }
  },
  { rootMargin: '-45% 0px -45% 0px' },
);
for (const step of steps) storyObserver.observe(step);
setStage(reducedMotion ? 4 : 1);

// --- Language cycler (decorative; the real list is in the planner form) ----
const cycler = document.querySelector('.lang-cycle');
if (cycler && !reducedMotion) {
  const words = [...cycler.querySelectorAll('span')];
  let i = 0;
  setInterval(() => {
    if (document.hidden) return;
    words[i].classList.remove('is-on');
    i = (i + 1) % words.length;
    words[i].classList.add('is-on');
  }, 1800);
}

// --- Occasion cards prefill the planner ------------------------------------
for (const card of document.querySelectorAll('[data-occasion]')) {
  card.addEventListener('click', (e) => {
    e.preventDefault();
    const select = /** @type {HTMLSelectElement | null} */ (document.getElementById('eventType'));
    if (select) select.value = /** @type {HTMLElement} */ (card).dataset.occasion ?? select.value;
    document.getElementById('planner')?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
    select?.focus({ preventScroll: true });
  });
}

// --- Statement: words light up as the section scrolls through -------------
const statement = document.querySelector('[data-words]');
if (statement) {
  /** @type {HTMLElement[]} */
  const words = [];
  // Split text into word spans while keeping <em> phrases as accent words.
  for (const node of [...statement.childNodes]) {
    const accent = node.nodeType === Node.ELEMENT_NODE;
    const frag = document.createDocumentFragment();
    for (const part of (node.textContent ?? '').split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        frag.append(part);
        continue;
      }
      const span = document.createElement('span');
      span.className = accent ? 'w is-accent' : 'w';
      span.textContent = part;
      words.push(span);
      frag.append(span);
    }
    node.replaceWith(frag);
  }

  const section = /** @type {HTMLElement} */ (statement.closest('section'));
  let lit = -1;
  const update = () => {
    const r = section.getBoundingClientRect();
    // Starts as the section enters (top at 90% of the viewport) and finishes
    // when its middle reaches 40%, so the reader scrubs through the sentence.
    const vh = window.innerHeight;
    const p = Math.min(1, Math.max(0, (vh * 0.9 - r.top) / (vh * 0.5 + r.height / 2)));
    const n = reducedMotion ? words.length : Math.round(p * words.length);
    if (n === lit) return;
    lit = n;
    words.forEach((w, i) => w.classList.toggle('is-lit', i < n));
  };
  let pending = false;
  window.addEventListener('scroll', () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      update();
    });
  }, { passive: true });
  update();
}
