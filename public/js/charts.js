/**
 * Tiny SVG chart builders for the dashboard: a donut for the budget split and
 * progress rings for countdown and completion. Each chart carries a text
 * alternative (role="img" + aria-label), so the data is never visual-only.
 */

const SVG = 'http://www.w3.org/2000/svg';

/**
 * @param {string} tag
 * @param {Record<string, string | number>} attrs
 */
function svg(tag, attrs) {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

/**
 * Converts values to donut segments (percent length and start offset), with
 * a small visual gap between slices. Pure, so it is unit-tested.
 * @param {number[]} values
 * @param {number} [gap] percent of the circle left between slices
 * @returns {{ length: number, offset: number }[]}
 */
export function donutSegments(values, gap = 0.6) {
  const total = values.reduce((s, v) => s + Math.max(0, v), 0);
  if (total <= 0) return values.map(() => ({ length: 0, offset: 0 }));
  let start = 0;
  return values.map((v) => {
    const share = (Math.max(0, v) / total) * 100;
    const seg = { length: Math.max(0, share - (share > gap * 2 ? gap : 0)), offset: -start };
    start += share;
    return seg;
  });
}

/**
 * @param {{ value: number, color: string }[]} slices
 * @param {string} label accessible description of the whole chart
 * @param {{ center?: string, sub?: string }} [text]
 */
export function donut(slices, label, text = {}) {
  const root = svg('svg', { viewBox: '0 0 42 42', class: 'donut', role: 'img', 'aria-label': label });
  root.append(svg('circle', { cx: 21, cy: 21, r: 15.915, class: 'donut-track', pathLength: 100 }));
  donutSegments(slices.map((s) => s.value)).forEach((seg, i) => {
    const c = svg('circle', {
      cx: 21,
      cy: 21,
      r: 15.915,
      pathLength: 100,
      class: 'donut-seg',
      'stroke-dasharray': `${seg.length.toFixed(2)} ${(100 - seg.length).toFixed(2)}`,
      'stroke-dashoffset': (seg.offset + 25).toFixed(2),
    });
    c.style.stroke = slices[i].color;
    root.append(c);
  });
  if (text.center) {
    const t = svg('text', {
      x: 21,
      y: text.sub ? 20.5 : 22.5,
      class: 'donut-center',
      'text-anchor': 'middle',
    });
    t.textContent = text.center;
    root.append(t);
  }
  if (text.sub) {
    const t = svg('text', { x: 21, y: 26, class: 'donut-sub', 'text-anchor': 'middle' });
    t.textContent = text.sub;
    root.append(t);
  }
  return root;
}

/**
 * Circular progress ring.
 * @param {number} value
 * @param {number} max
 * @param {string} label accessible label, e.g. "Tasks done: 4 of 18"
 * @param {string} color CSS colour
 */
export function ring(value, max, label, color) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const root = svg('svg', { viewBox: '0 0 42 42', class: 'ring', role: 'img', 'aria-label': label });
  root.append(svg('circle', { cx: 21, cy: 21, r: 17, class: 'ring-track', pathLength: 100 }));
  const arc = svg('circle', {
    cx: 21,
    cy: 21,
    r: 17,
    pathLength: 100,
    class: 'ring-arc',
    'stroke-dasharray': `${pct.toFixed(1)} 100`,
    'stroke-dashoffset': 25,
  });
  arc.style.stroke = color;
  // A zero-length arc would still draw a dot because of the round line cap.
  if (pct === 0) arc.setAttribute('opacity', '0');
  root.append(arc);
  return root;
}

/**
 * Reference to a symbol from the inline sprite in index.html.
 * @param {string} name
 */
export function icon(name) {
  const root = svg('svg', { class: 'ico', viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' });
  root.append(svg('use', { href: `#i-${name}` }));
  return root;
}
