/**
 * WebGL hero: a warm night sky over a glowing saffron "diya horizon", with
 * marigold petals and bokeh drifting down. Two tiny shader programs, no
 * library. Rendering pauses whenever the hero is off-screen or the tab is
 * hidden, draws a single still frame for reduced-motion users, and the CSS
 * gradient behind the canvas remains as the fallback when WebGL is missing.
 */

const SKY_VS = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const SKY_FS = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;
uniform float uScroll;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec3 saffron = vec3(0.96, 0.58, 0.22);
  vec3 marigold = vec3(1.0, 0.78, 0.32);
  vec3 rose = vec3(0.72, 0.18, 0.30);

  vec3 col = mix(vec3(0.17, 0.07, 0.05), vec3(0.06, 0.04, 0.035), vUv.y);

  // A vast glowing horizon that rises slightly with the pointer and sinks on scroll.
  float R = 1.15;
  vec2 c = vec2((uMouse.x - 0.5) * 0.22, -1.52 + (uMouse.y - 0.5) * 0.05 - uScroll * 0.45);
  float edge = length(p - c) - R;
  float body = 1.0 - smoothstep(-0.004, 0.004, edge);
  float rim = exp(-abs(edge) * 42.0);
  float halo = exp(-max(edge, 0.0) * 2.6);

  float smoke = fbm(p * 2.4 + vec2(uTime * 0.03, -uTime * 0.05));
  col += saffron * halo * 0.55;
  col += mix(rose, saffron, vUv.x) * smoothstep(0.35, 0.95, smoke) * halo * 0.45;

  vec3 ground = mix(vec3(0.05, 0.03, 0.025), vec3(0.12, 0.05, 0.03), smoothstep(-0.25, 0.0, edge));
  col = mix(col, ground, body);
  col += saffron * 0.35 * exp(-max(-edge, 0.0) * 10.0) * body;
  col += marigold * rim * (1.05 + 0.12 * sin(uTime * 1.4));

  col *= 1.0 - 0.38 * length(vUv - 0.5);
  col += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) * 0.02;
  gl_FragColor = vec4(col, 1.0);
}`;

const PETAL_VS = `
attribute vec4 aSeed;
uniform float uTime;
uniform float uScroll;
uniform float uDpr;
varying float vKind;
varying float vRot;
varying vec3 vColor;
void main() {
  float speed = mix(0.02, 0.06, aSeed.y);
  float y = 1.2 - mod(aSeed.x * 2.4 + uTime * speed, 2.4);
  float x = (aSeed.z * 2.0 - 1.0) * 1.05 + sin(uTime * (0.25 + aSeed.w * 0.5) + aSeed.x * 6.283) * 0.07;
  y += uScroll * 0.7 * aSeed.w;
  gl_Position = vec4(x, y, 0.0, 1.0);
  vKind = step(0.6, aSeed.w);
  gl_PointSize = (vKind > 0.5 ? mix(3.0, 12.0, aSeed.y) : mix(9.0, 20.0, aSeed.z)) * uDpr;
  vRot = uTime * (aSeed.y - 0.5) * 1.6 + aSeed.x * 6.283;
  vColor = mix(vec3(1.0, 0.58, 0.1), vec3(1.0, 0.82, 0.32), aSeed.z);
  if (aSeed.y > 0.82) vColor = vec3(0.88, 0.3, 0.38);
}`;

const PETAL_FS = `
precision mediump float;
varying float vKind;
varying float vRot;
varying vec3 vColor;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  if (vKind > 0.5) {
    float a = smoothstep(0.5, 0.0, length(q)) * 0.38;
    gl_FragColor = vec4(vColor * a, a);
    return;
  }
  float c = cos(vRot), s = sin(vRot);
  q = mat2(c, -s, s, c) * q;
  float d = length(q * vec2(2.3, 1.0));
  float a = smoothstep(0.5, 0.4, d) * 0.9;
  float shade = 0.7 + 0.6 * (0.5 - q.y);
  gl_FragColor = vec4(vColor * shade * a, a);
}`;

/**
 * @param {WebGLRenderingContext} gl
 * @param {string} vs
 * @param {string} fs
 */
function program(gl, vs, fs) {
  const prog = gl.createProgram();
  /** @type {Array<[number, string]>} */
  const stages = [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]];
  for (const [type, src] of stages) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'shader');
    gl.attachShader(prog, shader);
  }
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link');
  return prog;
}

/**
 * Starts the hero animation. Returns a controller, or null when WebGL is
 * unavailable (the CSS fallback then stays visible).
 * @param {HTMLCanvasElement} canvas
 * @param {{ reducedMotion: boolean }} options
 */
export function initHeroGl(canvas, { reducedMotion }) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power', premultipliedAlpha: true });
  if (!gl) return null;

  let sky;
  let petals;
  try {
    sky = program(gl, SKY_VS, SKY_FS);
    petals = program(gl, PETAL_VS, PETAL_FS);
  } catch {
    return null;
  }

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  const count = matchMedia('(max-width: 700px)').matches ? 55 : 110;
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
  const seedBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, seedBuf);
  gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);

  const u = (/** @type {WebGLProgram} */ prog, /** @type {string} */ name) => gl.getUniformLocation(prog, name);
  const skyU = { res: u(sky, 'uRes'), time: u(sky, 'uTime'), mouse: u(sky, 'uMouse'), scroll: u(sky, 'uScroll') };
  const petalU = { time: u(petals, 'uTime'), scroll: u(petals, 'uScroll'), dpr: u(petals, 'uDpr') };
  const aPos = gl.getAttribLocation(sky, 'aPos');
  const aSeed = gl.getAttribLocation(petals, 'aSeed');

  const state = { mouseX: 0.5, mouseY: 0.5, targetX: 0.5, targetY: 0.5, scroll: 0, visible: true, raf: 0, start: performance.now() };
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

  function resize() {
    const w = Math.round(canvas.clientWidth * dpr);
    const h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }

  function draw(/** @type {number} */ t) {
    resize();
    state.mouseX += (state.targetX - state.mouseX) * 0.05;
    state.mouseY += (state.targetY - state.mouseY) * 0.05;

    gl.disable(gl.BLEND);
    gl.useProgram(sky);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(skyU.res, canvas.width, canvas.height);
    gl.uniform1f(skyU.time, t);
    gl.uniform2f(skyU.mouse, state.mouseX, state.mouseY);
    gl.uniform1f(skyU.scroll, state.scroll);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disableVertexAttribArray(aPos);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(petals);
    gl.bindBuffer(gl.ARRAY_BUFFER, seedBuf);
    gl.enableVertexAttribArray(aSeed);
    gl.vertexAttribPointer(aSeed, 4, gl.FLOAT, false, 0, 0);
    gl.uniform1f(petalU.time, t);
    gl.uniform1f(petalU.scroll, state.scroll);
    gl.uniform1f(petalU.dpr, dpr);
    gl.drawArrays(gl.POINTS, 0, count);
    gl.disableVertexAttribArray(aSeed);
  }

  function loop(/** @type {number} */ now) {
    state.raf = 0;
    if (!state.visible || document.hidden) return;
    draw((now - state.start) / 1000);
    state.raf = requestAnimationFrame(loop);
  }

  function play() {
    if (reducedMotion) {
      draw(12);
      return;
    }
    if (!state.raf) state.raf = requestAnimationFrame(loop);
  }

  new IntersectionObserver(([entry]) => {
    state.visible = entry.isIntersecting;
    if (state.visible) play();
  }).observe(canvas);
  document.addEventListener('visibilitychange', () => !document.hidden && play());
  new ResizeObserver(() => reducedMotion && draw(12)).observe(canvas);

  if (!reducedMotion) {
    window.addEventListener(
      'pointermove',
      (e) => {
        state.targetX = e.clientX / window.innerWidth;
        state.targetY = 1 - e.clientY / window.innerHeight;
      },
      { passive: true },
    );
  }

  canvas.classList.add('is-ready');
  play();

  return {
    /** @param {number} progress 0 at top of hero, 1 when scrolled past */
    setScroll(progress) {
      state.scroll = progress;
      if (reducedMotion) draw(12);
    },
  };
}
