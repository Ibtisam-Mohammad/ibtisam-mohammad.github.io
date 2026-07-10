// The turtle follows an authored document-space path. Scroll determines the exact
// target arc position; a short critically damped spring affects only the rendered
// turtle, while section drawings remain deterministic functions of scroll.

import { clamp01, seg, smooth } from './engine.js';

// Hidden travel still alternates margins, but visible work is supplied by each scene.
const ROUTE = [
  ['hero', 'L'],
  ['foundations', 'L'],
  ['ml', 'R'],
  ['vision', 'L'],
  ['generative', 'R'],
  ['mlops', 'L'],
  ['work', 'R'],
  ['notes', 'L'],
  ['contact', 'R'],
];

const PLATE_SECTIONS = ['foundations', 'ml', 'vision', 'generative', 'mlops'];
const SPRING_OMEGA = 26;

const state = {
  layer: null,
  vineLayer: null,
  guide: null,
  turtle: null,
  inner: null,
  body: null,
  pen: null,
  feet: [],
  plates: [],
  waypoints: [],
  cum: [],
  samples: null,
  total: 0,
  displayLen: Number.NaN,
  velocity: 0,
  penNow: null,
  visibleNow: null,
  penRanges: [],
  milestones: [],
  extraWaypoints: {},
};

// Scene callbacks return document-space waypoints in traversal order. Waypoints are
// visible by default; hidden lane travel is inserted around them automatically.
export function registerWaypoints(sectionId, fn) {
  state.extraWaypoints[sectionId] = fn;
}

function docRect(el) {
  const r = el.getBoundingClientRect();
  const y = window.scrollY;
  return { top: r.top + y, bottom: r.bottom + y, left: r.left, right: r.right, width: r.width, height: r.height };
}

function laneX(side, docW, contentRect, mobile) {
  if (mobile) return docW - 26;
  if (side === 'L') return Math.max(contentRect.left / 2, 26);
  if (side === 'R') return Math.min((docW + contentRect.right) / 2, docW - 26);
  return docW / 2;
}

function targetForY(y) {
  const wps = state.waypoints;
  if (wps.length < 2) return { index: 0, len: 0 };
  let i = 0;
  while (i < wps.length - 2 && y > wps[i + 1].anchor) i++;
  const t = seg(y, wps[i].anchor, wps[i + 1].anchor);
  return { index: i, len: state.cum[i] + (state.cum[i + 1] - state.cum[i]) * t };
}

function intervalAtArc(arc) {
  let i = 0;
  while (i < state.cum.length - 2 && arc > state.cum[i + 1]) i++;
  return i;
}

function pointAtArc(arc) {
  const { xs, ys, cum } = state.samples;
  const a = Math.max(0, Math.min(arc, state.total));
  let lo = 0;
  let hi = cum.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] < a) lo = mid + 1;
    else hi = mid;
  }
  const i = Math.max(lo, 1);
  const t = (a - cum[i - 1]) / (cum[i] - cum[i - 1] + 1e-9);
  return {
    x: xs[i - 1] + (xs[i] - xs[i - 1]) * t,
    y: ys[i - 1] + (ys[i] - ys[i - 1]) * t,
  };
}

function tangentAt(arc, span = 12) {
  const a = pointAtArc(arc - span);
  const b = pointAtArc(arc + span);
  return Math.atan2(b.y - a.y, b.x - a.x);
}

function angleDelta(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function buildRanges() {
  const penRanges = [];
  for (let i = 0; i < state.waypoints.length - 1; i++) {
    const w = state.waypoints[i];
    if (w.pen !== 'down') continue;
    const previous = penRanges[penRanges.length - 1];
    if (previous && previous.section === w.section && Math.abs(previous.end - state.cum[i]) < 0.5) {
      previous.end = state.cum[i + 1];
    } else {
      penRanges.push({ start: state.cum[i], end: state.cum[i + 1], section: w.section });
    }
  }
  state.penRanges = penRanges.filter((r) => r.end - r.start > 4);
  state.milestones = state.waypoints
    .map((w, i) => (w.milestone ? { x: w.x, y: w.y, arc: state.cum[i], section: w.section } : null))
    .filter(Boolean);
}

export function measureTurtle() {
  const docW = document.documentElement.clientWidth;
  const docH = document.documentElement.scrollHeight;
  const vh = window.innerHeight;
  const mobile = docW < 720;
  const contentEl = document.querySelector('.container');
  if (!contentEl) return;
  const content = contentEl.getBoundingClientRect();

  state.layer.style.height = `${docH}px`;
  if (state.vineLayer) state.vineLayer.style.height = `${docH}px`;
  state.guide.ownerSVGElement.setAttribute('viewBox', `0 0 ${docW} ${docH}`);

  const wps = [];
  const last = ROUTE.length - 1;
  ROUTE.forEach(([id, side], routeIndex) => {
    const section = document.getElementById(id);
    if (!section) return;
    const r = docRect(section);
    const lane = laneX(side, docW, content, mobile);

    wps.push({ x: lane, y: r.top + 24, pen: 'up', visible: true, viewport: 0.92, boundary: routeIndex > 0, section: id });
    const extra = state.extraWaypoints[id];
    if (extra) {
      for (const waypoint of extra(r, { mobile, docW, vh })) {
        const x = mobile ? Math.max(4, Math.min(docW - 26, waypoint.x)) : waypoint.x;
        wps.push({
          ...waypoint,
          x,
          pen: waypoint.pen || 'up',
          visible: waypoint.visible ?? true,
          boundary: false,
          section: id,
        });
      }
    }

    if (routeIndex === last && !mobile) {
      wps.push({ x: lane, y: r.bottom - 104, pen: 'up', visible: true, viewport: 0.58, milestone: true, section: id });
      wps.push({ x: content.left + content.width * 0.38, y: r.bottom - 62, pen: 'up', visible: true, section: id });
    } else {
      wps.push({ x: lane, y: r.bottom - 28, pen: 'up', visible: true, viewport: 0.58, milestone: true, section: id });
    }
  });

  const maxScroll = Math.max(docH - vh, 1);
  for (const w of wps) {
    const derived = w.y - (w.vy ?? vh * (w.viewport ?? 0.42));
    w.anchor = Number.isFinite(w.scrollAnchor)
      ? Math.max(0, Math.min(maxScroll, w.scrollAnchor))
      : clamp01(derived / maxScroll) * maxScroll;
  }
  for (let i = 1; i < wps.length; i++) wps[i].anchor = Math.max(wps[i].anchor, wps[i - 1].anchor + 1);

  state.waypoints = wps;
  const path = catmullRomPath(wps);
  state.guide.setAttribute('d', path.d);
  state.samples = path;
  state.total = path.total;
  state.cum = path.wpCum;
  buildRanges();

  state.displayLen = targetForY(window.scrollY).len;
  state.velocity = 0;
}

// Build the Catmull-Rom path and a dense mathematical arc-length lookup in one pass.
function catmullRomPath(pts) {
  if (pts.length < 2) return { d: '', xs: [0], ys: [0], cum: [0], wpCum: [0], total: 0 };
  const p = (i) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  const SUB = 28;
  const xs = [pts[0].x];
  const ys = [pts[0].y];
  const cum = [0];
  const wpCum = [0];
  let arc = 0;
  let px = pts[0].x;
  let py = pts[0].y;

  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = p(i - 1), p1 = p(i), p2 = p(i + 1), p3 = p(i + 2);
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    for (let k = 1; k <= SUB; k++) {
      const t = k / SUB, u = 1 - t;
      const x = u ** 3 * p1.x + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t ** 3 * p2.x;
      const y = u ** 3 * p1.y + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t ** 3 * p2.y;
      arc += Math.hypot(x - px, y - py);
      px = x;
      py = y;
      xs.push(x);
      ys.push(y);
      cum.push(arc);
    }
    wpCum.push(arc);
  }
  return { d, xs, ys, cum, wpCum, total: arc };
}

function plateRanges() {
  const vh = window.innerHeight;
  return PLATE_SECTIONS.map((id) => {
    const el = document.getElementById(id);
    if (!el) return [0, 1];
    const r = docRect(el);
    return [r.top - vh * 0.5, r.bottom - vh * 0.85];
  });
}

let ranges = [];

export function updateTurtle(y, dt = 1 / 60) {
  if (state.waypoints.length < 2 || !state.samples) return null;
  const target = targetForY(y).len;
  const jump = Math.abs(target - state.displayLen);
  const snapDistance = Math.max(360, window.innerHeight * 0.55);

  if (!Number.isFinite(state.displayLen) || jump > snapDistance) {
    state.displayLen = target;
    state.velocity = 0;
  } else {
    const step = Math.max(1 / 240, Math.min(dt || 1 / 60, 1 / 30));
    const delta = target - state.displayLen;
    const acceleration = SPRING_OMEGA ** 2 * delta - 2 * SPRING_OMEGA * state.velocity;
    state.velocity += acceleration * step;
    state.displayLen = Math.max(0, Math.min(state.total, state.displayLen + state.velocity * step));
    if (Math.abs(delta) < 0.08 && Math.abs(state.velocity) < 0.08) {
      state.displayLen = target;
      state.velocity = 0;
    }
  }

  const arc = state.displayLen;
  const pt = pointAtArc(arc);
  const heading = tangentAt(arc, 14);
  const curvature = angleDelta(tangentAt(arc + 18, 9), tangentAt(arc - 18, 9));
  const bank = Math.max(-8, Math.min(8, (curvature * 180 / Math.PI) * 0.34));
  const deg = heading * 180 / Math.PI;
  const interval = intervalAtArc(arc);
  const waypoint = state.waypoints[interval];
  const penDown = waypoint.pen === 'down';
  const visible = waypoint.visible !== false;

  // Keep the rendered body in view when distant waypoints, resizing, or fast scrolling
  // would otherwise place the authored route just outside the viewport.
  const mobile = document.documentElement.clientWidth < 720;
  const safeSize = mobile ? 38 : 50;
  const headerBottom = document.querySelector('.topbar')?.getBoundingClientRect().bottom || 64;
  const safeX = Math.max(8, Math.min(document.documentElement.clientWidth - safeSize, pt.x));
  const safeY = Math.max(
    y + headerBottom + 8,
    Math.min(y + window.innerHeight - safeSize, pt.y)
  );
  state.turtle.style.transform = `translate(${safeX.toFixed(1)}px, ${safeY.toFixed(1)}px) rotate(${deg.toFixed(1)}deg)`;
  state.turtle.classList.toggle('is-visible', visible);

  const speed = Math.min(Math.abs(state.velocity) / 900, 1);
  const phase = arc / 7;
  const stride = Math.sin(phase) * (0.7 + speed * 0.8);
  const bob = Math.abs(Math.sin(phase * 0.5)) * (penDown ? 0.25 : 0.65);
  const stretch = speed * 0.025;
  state.body.style.transform = `translateY(${bob.toFixed(2)}px) rotate(${bank.toFixed(2)}deg) scale(${(1 + stretch).toFixed(3)}, ${(1 - stretch).toFixed(3)})`;
  state.feet.forEach((foot, i) => {
    const direction = i === 0 || i === 2 ? 1 : -1;
    foot.style.transform = `translateX(${(stride * direction).toFixed(2)}px)`;
  });

  if (penDown !== state.penNow) {
    state.inner.classList.toggle('pen-down', penDown);
    state.penNow = penDown;
  }
  if (visible !== state.visibleNow) state.visibleNow = visible;

  for (let k = 0; k < state.plates.length; k++) {
    const [a, b] = ranges[k] || [0, 1];
    state.plates[k].style.fillOpacity = smooth(seg(y, a, b)).toFixed(3);
  }

  const moving = Math.abs(target - state.displayLen) > 0.08 || Math.abs(state.velocity) > 0.08;
  return { len: state.displayLen, moving, penDown, visible };
}

export function guideInfo() {
  return {
    guide: state.guide,
    total: state.total,
    samples: state.samples,
    penRanges: state.penRanges,
    milestones: state.milestones,
  };
}

export function initTurtle() {
  state.layer = document.getElementById('turtle-layer');
  state.vineLayer = document.getElementById('vine-layer');
  state.guide = document.getElementById('turtle-guide');
  state.turtle = document.getElementById('turtle');
  state.inner = document.getElementById('turtle-inner');
  if (!state.layer || !state.guide || !state.turtle || !state.inner) return false;
  state.body = document.getElementById('turtle-body');
  state.pen = document.getElementById('turtle-pen');
  state.feet = [...state.turtle.querySelectorAll('.turtle-foot')];
  state.plates = [...state.turtle.querySelectorAll('[data-plate]')];
  state.turtle.classList.add('is-visible');
  measureTurtle();
  ranges = plateRanges();
  return true;
}

export function remeasure() {
  measureTurtle();
  ranges = plateRanges();
}
