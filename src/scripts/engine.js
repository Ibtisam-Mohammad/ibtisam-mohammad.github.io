// Scroll engine core. Scene state remains an exact function of scroll position.
// requestAnimationFrame sleeps while idle and stays alive only when a global updater
// explicitly reports settling motion, such as the turtle's short display spring.

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const seg = (s, a, b) => clamp01((s - a) / (b - a));
export const smooth = (t) => t * t * (3 - 2 * t);

const scenes = [];
const active = new Set();
const globalUpdaters = [];
const remeasureHooks = [];
let lastY = -1;
let forceFrame = true;
let vh = 0;
let io = null;
let raf = 0;
let lastTs = 0;

export function addGlobal(fn) {
  globalUpdaters.push(fn);
}

export function onRemeasure(fn) {
  remeasureHooks.push(fn);
}

export function addScene(scene) {
  scenes.push(scene);
}

function docRect(el) {
  const r = el.getBoundingClientRect();
  const y = window.scrollY;
  return { top: r.top + y, bottom: r.bottom + y, height: r.height, left: r.left, width: r.width };
}

function requestFrame() {
  if (!raf) raf = requestAnimationFrame(frame);
}

export function measureAll() {
  vh = window.innerHeight;
  for (const scene of scenes) scene.measure(docRect(scene.el), vh);
  for (const fn of remeasureHooks) fn();
  forceFrame = true;
  requestFrame();
}

function frame(ts) {
  raf = 0;
  const y = window.scrollY;
  const changed = y !== lastY;
  const denom = document.documentElement.scrollHeight - vh;
  const p = denom > 0 ? clamp01(y / denom) : 0;
  const dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.05) : 1 / 60;
  let keepAlive = false;

  if (changed || forceFrame) {
    for (const scene of active) scene.update(seg(y, scene.start, scene.end));
  }
  for (const fn of globalUpdaters) {
    keepAlive = fn(y, p, vh, dt, changed) === true || keepAlive;
  }

  lastY = y;
  lastTs = ts;
  forceFrame = false;
  if (keepAlive) requestFrame();
}

export function start() {
  measureAll();

  io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const scene = scenes.find((candidate) => candidate.el === entry.target);
        if (!scene) continue;
        if (entry.isIntersecting) {
          active.add(scene);
          forceFrame = true;
          requestFrame();
        } else {
          scene.update(window.scrollY < scene.start ? 0 : 1);
          active.delete(scene);
        }
      }
    },
    { rootMargin: '100% 0%' }
  );
  for (const scene of scenes) io.observe(scene.el);

  // Scroll restoration and deep links must render their exact state immediately.
  for (const scene of scenes) scene.update(seg(window.scrollY, scene.start, scene.end));

  let resizeTimer = 0;
  let lastSize = `${document.documentElement.clientWidth}x${document.documentElement.scrollHeight}`;
  const remeasure = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const size = `${document.documentElement.clientWidth}x${document.documentElement.scrollHeight}`;
      if (size === lastSize) return;
      lastSize = size;
      measureAll();
    }, 150);
  };

  window.addEventListener('scroll', requestFrame, { passive: true });
  window.addEventListener('resize', remeasure, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    lastTs = 0;
    forceFrame = true;
    requestFrame();
  });
  new ResizeObserver(remeasure).observe(document.body);

  requestFrame();
}

// Freeze path lengths into dash arrays. Markup defaults to the finished state;
// animated users are rewound here before the first frame.
export function preparePaths(root) {
  const paths = root.querySelectorAll('[data-draw]');
  for (const path of paths) {
    const length = path.getTotalLength();
    path.dataset.len = length;
    path.style.strokeDasharray = `${length} ${length * 3}`;
    path.style.strokeDashoffset = `${length}`;
  }
  return [...paths];
}

export function setDraw(path, t) {
  path.style.strokeDashoffset = String((1 - clamp01(t)) * path.dataset.len);
}

export function drawSequence(paths, s, a, b) {
  const count = paths.length;
  if (!count) return;
  const width = (b - a) / count;
  for (let i = 0; i < count; i++) setDraw(paths[i], seg(s, a + i * width, a + (i + 1) * width));
}

export function popSequence(elements, s, a, b) {
  const count = elements.length;
  if (!count) return;
  const width = (b - a) / count;
  for (let i = 0; i < count; i++) {
    const t = smooth(clamp01((s - (a + i * width)) / (width * 2.2 + 1e-9)));
    elements[i].style.opacity = t >= 1 ? '' : t.toFixed(3);
    elements[i].style.transform = t >= 1 ? '' : `scale(${(0.4 + 0.6 * t).toFixed(3)})`;
  }
}
