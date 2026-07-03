// Scroll engine core (plan.md §4). The page is a pure function of scroll position:
// one rAF loop reads scrollY; every animated property is written as f(p) or f(s_local).
// No timers drive visible animation. Scenes activate via IntersectionObserver one
// viewport early / late; inactive scenes cost zero work per frame.

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
// local progress of s within [a, b]
export const seg = (s, a, b) => clamp01((s - a) / (b - a));
// smoothstep for windows that want soft ends (used sparingly; scrub stays mostly linear)
export const smooth = (t) => t * t * (3 - 2 * t);

const scenes = [];
const active = new Set();
let lastY = -1;
let forceFrame = true;
let vh = 0;
let io = null;
const globalUpdaters = []; // fn(y, p, vh) — turtle, hairline: run every changed frame
const remeasureHooks = []; // run after every measureAll (resize, doc-height change)

export function addGlobal(fn) {
  globalUpdaters.push(fn);
}
export function onRemeasure(fn) {
  remeasureHooks.push(fn);
}

/**
 * scene: {
 *   el: activation element (IntersectionObserver target),
 *   measure(rect, vh): called on init/resize with el's document-space rect -> sets start/end,
 *   start, end: scrollY range mapping to s in [0,1],
 *   update(s): writes styles,
 * }
 */
export function addScene(scene) {
  scenes.push(scene);
}

function docRect(el) {
  const r = el.getBoundingClientRect();
  const y = window.scrollY;
  return { top: r.top + y, bottom: r.bottom + y, height: r.height, left: r.left, width: r.width };
}

export function measureAll() {
  vh = window.innerHeight;
  for (const s of scenes) s.measure(docRect(s.el), vh);
  for (const fn of remeasureHooks) fn();
  forceFrame = true;
}

function frame() {
  const y = window.scrollY;
  if (y !== lastY || forceFrame) {
    const denom = document.documentElement.scrollHeight - vh;
    const p = denom > 0 ? clamp01(y / denom) : 0;
    for (const s of active) s.update(seg(y, s.start, s.end));
    for (const fn of globalUpdaters) fn(y, p, vh);
    lastY = y;
    forceFrame = false;
  }
  requestAnimationFrame(frame);
}

export function start() {
  measureAll();

  io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const scene = scenes.find((s) => s.el === e.target);
        if (!scene) continue;
        if (e.isIntersecting) {
          active.add(scene);
          forceFrame = true;
        } else {
          // pin to a clean end state on exit so reload/deep-link states stay exact
          scene.update(window.scrollY < scene.start ? 0 : 1);
          active.delete(scene);
        }
      }
    },
    { rootMargin: '100% 0%' }
  );
  for (const s of scenes) io.observe(s.el);

  // one full pass so any scroll restore / anchor entry renders the correct mid-state
  for (const s of scenes) s.update(seg(window.scrollY, s.start, s.end));

  let resizeT = 0;
  let lastSize = `${document.documentElement.clientWidth}x${document.documentElement.scrollHeight}`;
  const remeasure = () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      // skip no-op re-measures (the ResizeObserver's initial fire would otherwise
      // rebuild the vine a second time at boot — a full long-task for nothing)
      const size = `${document.documentElement.clientWidth}x${document.documentElement.scrollHeight}`;
      if (size === lastSize) return;
      lastSize = size;
      measureAll();
    }, 150);
  };
  window.addEventListener('resize', remeasure, { passive: true });
  // document height changes (lazy images, fonts) shift every mapping
  new ResizeObserver(remeasure).observe(document.body);

  requestAnimationFrame(frame);
}

/* ---------- stroke-reveal helpers ---------- */

// Prepare [data-draw] paths inside root: freeze total length into dasharray.
// Finished state (offset 0) is the no-JS default; callers scrub the offset.
export function preparePaths(root) {
  const paths = root.querySelectorAll('[data-draw]');
  for (const p of paths) {
    const L = p.getTotalLength();
    p.dataset.len = L;
    // 3x off-slack: stretched viewBoxes (preserveAspectRatio="none") can render the
    // path longer on screen than its user-space length — slack keeps the tail hidden
    p.style.strokeDasharray = `${L} ${L * 3}`;
    p.style.strokeDashoffset = `${L}`; // hidden until first update
  }
  return [...paths];
}

export function setDraw(p, t) {
  p.style.strokeDashoffset = String((1 - clamp01(t)) * p.dataset.len);
}

// draw a list of paths sequentially across window [a, b] of s
export function drawSequence(paths, s, a, b) {
  const n = paths.length;
  if (!n) return;
  const w = (b - a) / n;
  for (let i = 0; i < n; i++) setDraw(paths[i], seg(s, a + i * w, a + (i + 1) * w));
}

// pop [data-pop] elements (dots, chips, tapes) in sequence: opacity + scale settle
export function popSequence(els, s, a, b) {
  const n = els.length;
  if (!n) return;
  const w = (b - a) / n;
  for (let i = 0; i < n; i++) {
    const t = smooth(clamp01((s - (a + i * w)) / (w * 2.2 + 1e-9)));
    els[i].style.opacity = t >= 1 ? '' : t.toFixed(3);
    els[i].style.transform = t >= 1 ? '' : `scale(${(0.4 + 0.6 * t).toFixed(3)})`;
  }
}
