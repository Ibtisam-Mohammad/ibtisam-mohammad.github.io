// The turtle follows an authored document-space path. Scroll determines its exact
// arc position, so the body, heading, pen state, and ink always stay synchronized.

import { clamp01, seg, smooth } from './engine.js';

// Entry and exit lanes follow each scene's first and last drawing points. This keeps
// pen-up travel short now that the turtle remains visible between sections.
const ROUTE = [
  ['hero', 'L', 'R'],
  ['foundations', 'R', 'R'],
  ['ml', 'R', 'R'],
  ['vision', 'R', 'L'],
  ['generative', 'L', 'L'],
  ['mlops', 'L', 'L'],
  ['work', 'L', 'L'],
  ['notes', 'L', 'L'],
  ['contact', 'L', 'R'],
];

const PLATE_SECTIONS = ['foundations', 'ml', 'vision', 'generative', 'mlops'];
const state = {
  layer: null,
  vineLayer: null,
  guide: null,
  turtle: null,
  inner: null,
  pen: null,
  feet: [],
  plates: [],
  waypoints: [],
  cum: [],
  samples: null,
  scrolls: [],
  total: 0,
  penNow: null,
  visibleNow: null,
  penRanges: [],
  milestones: [],
  extraWaypoints: {},
};

// Scene callbacks return document-space waypoints in traversal order. Their first
// and last points also define the visible pen-up approach and departure lanes.
export function registerWaypoints(sectionId, fn) {
  state.extraWaypoints[sectionId] = fn;
}

function docRect(el) {
  const r = el.getBoundingClientRect();
  const y = window.scrollY;
  return { top: r.top + y, bottom: r.bottom + y, left: r.left, right: r.right, width: r.width, height: r.height };
}

// How far outside the text column the travel lane sits on desktop. The lane used to
// be the gutter's midpoint, which scales with the window: ~174px out at 1800px and
// ~360px at 2560px, so on a wide monitor the vine detached from the writing and read
// as a stray rule at the edge of the screen. A bounded gap keeps it beside the text
// at every width; the inset clamp still applies when the gutter is narrower than this.
const LANE_GAP = 104;

function laneX(side, docW, contentRect, mobile) {
  const inset = mobile ? 40 : 36;
  if (mobile) return docW - inset;
  if (side === 'L') return Math.max(contentRect.left - LANE_GAP, inset);
  if (side === 'R') return Math.min(contentRect.right + LANE_GAP, docW - inset);
  return docW / 2;
}

function targetForY(y) {
  const anchors = state.scrolls;
  const arcs = state.samples?.cum;
  if (!anchors.length || !arcs?.length) return { len: 0 };
  if (y <= anchors[0]) return { len: arcs[0] };
  if (y >= anchors[anchors.length - 1]) return { len: arcs[arcs.length - 1] };

  let lo = 1;
  let hi = anchors.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (anchors[mid] < y) lo = mid + 1;
    else hi = mid;
  }
  const i = lo;
  const t = seg(y, anchors[i - 1], anchors[i]);
  return { len: arcs[i - 1] + (arcs[i] - arcs[i - 1]) * t };
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
  // release the layers before measuring: their previous height would otherwise hold
  // the document open, so a reflow that SHORTENS content (rotation, window widening)
  // could never be observed — the page would ratchet longer forever
  state.layer.style.height = '0px';
  if (state.vineLayer) state.vineLayer.style.height = '0px';

  const docW = document.documentElement.clientWidth;
  const docH = document.documentElement.scrollHeight;
  const vh = window.innerHeight;
  const mobile = docW < 720;
  const contentEl = document.querySelector('.container');
  if (!contentEl) return;
  const content = contentEl.getBoundingClientRect();
  const routeInset = mobile ? 40 : 36;

  state.layer.style.height = `${docH}px`;
  if (state.vineLayer) state.vineLayer.style.height = `${docH}px`;
  state.guide.ownerSVGElement.setAttribute('viewBox', `0 0 ${docW} ${docH}`);

  const wps = [];
  const last = ROUTE.length - 1;
  ROUTE.forEach(([id, entrySide, exitSide], routeIndex) => {
    const section = document.getElementById(id);
    if (!section) return;
    const r = docRect(section);
    const sceneWaypoints = [];
    const extra = state.extraWaypoints[id];
    if (extra) {
      for (const waypoint of extra(r, { mobile, docW, vh })) {
        const x = Math.max(routeInset, Math.min(docW - routeInset, waypoint.x));
        sceneWaypoints.push({
          ...waypoint,
          x,
          pen: waypoint.pen || 'up',
          visible: waypoint.visible ?? true,
          boundary: false,
          section: id,
        });
      }
    }
    const entryLane = sceneWaypoints[0]?.x ?? laneX(entrySide, docW, content, mobile);
    const exitLane = sceneWaypoints[sceneWaypoints.length - 1]?.x ?? laneX(exitSide, docW, content, mobile);

    wps.push({ x: entryLane, y: r.top + 24, pen: 'up', visible: true, viewport: 0.92, boundary: routeIndex > 0, section: id });
    wps.push(...sceneWaypoints);

    if (routeIndex === last && !mobile) {
      wps.push({ x: exitLane, y: r.bottom - 104, pen: 'up', visible: true, viewport: 0.58, milestone: true, section: id });
      wps.push({ x: content.left + content.width * 0.38, y: r.bottom - 62, pen: 'up', visible: true, section: id });
    } else {
      wps.push({ x: exitLane, y: r.bottom - 28, pen: 'up', visible: true, viewport: 0.58, milestone: true, section: id });
    }
  });

  const maxScroll = Math.max(docH - vh, 1);
  const headerBottom = document.querySelector('.topbar')?.getBoundingClientRect().bottom || 64;
  const safeTop = headerBottom + 10;
  const safeBottom = vh - (mobile ? 40 : 52);
  for (const w of wps) {
    const derived = w.y - (w.vy ?? vh * (w.viewport ?? 0.42));
    const preferred = Number.isFinite(w.scrollAnchor)
      ? Math.max(0, Math.min(maxScroll, w.scrollAnchor))
      : clamp01(derived / maxScroll) * maxScroll;
    const earliest = Math.max(0, Math.min(maxScroll, w.y - safeBottom));
    const latest = Math.max(0, Math.min(maxScroll, w.y - safeTop));
    w.preferredAnchor = Math.max(earliest, Math.min(latest, preferred));
    w.earliestAnchor = w.lockAnchor ? w.preferredAnchor : earliest;
    w.latestAnchor = w.lockAnchor ? w.preferredAnchor : latest;
  }
  scheduleWaypointAnchors(wps);

  state.waypoints = wps;
  const path = catmullRomPath(wps, routeInset, docW - routeInset);
  state.guide.setAttribute('d', path.d);
  state.samples = path;
  state.total = path.total;
  state.cum = path.wpCum;
  state.scrolls = buildScrollMap(wps, path, maxScroll);
  buildRanges();
}

// Build the Catmull-Rom path and a dense mathematical arc-length lookup in one pass.
function catmullRomPath(pts, minX, maxX) {
  const SUB = 28;
  if (pts.length < 2) {
    return { d: '', xs: [0], ys: [0], cum: [0], wpCum: [0], total: 0, subdivisions: SUB };
  }
  const p = (i) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  const xs = [pts[0].x];
  const ys = [pts[0].y];
  const cum = [0];
  const wpCum = [0];
  let arc = 0;
  let px = pts[0].x;
  let py = pts[0].y;

  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = p(i - 1), p1 = p(i), p2 = p(i + 1), p3 = p(i + 2);
    const lowY = Math.min(p1.y, p2.y);
    const highY = Math.max(p1.y, p2.y);
    const c1x = Math.max(minX, Math.min(maxX, p1.x + (p2.x - p0.x) / 6));
    const c1y = Math.max(lowY, Math.min(highY, p1.y + (p2.y - p0.y) / 6));
    const c2x = Math.max(minX, Math.min(maxX, p2.x - (p3.x - p1.x) / 6));
    const c2y = Math.max(lowY, Math.min(highY, p2.y - (p3.y - p1.y) / 6));
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
  return { d, xs, ys, cum, wpCum, total: arc, subdivisions: SUB };
}

// Allocate enough scroll distance for visible travel while keeping every waypoint
// inside its safe viewport interval. A backward pass reserves room for later points;
// the forward pass then stays as close as possible to each scene's authored timing.
function scheduleWaypointAnchors(waypoints) {
  if (!waypoints.length) return; // 404/partial pages: no route sections at all
  let rate = 1.8;
  let durations = [];
  let latest = [];
  for (let attempt = 0; attempt < 24; attempt++) {
    durations = [0];
    for (let i = 1; i < waypoints.length; i++) {
      const from = waypoints[i - 1];
      const to = waypoints[i];
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const rate2 = rate * rate;
      const duration = (
        -dy + Math.sqrt(rate2 * dy * dy + (rate2 - 1) * dx * dx)
      ) / (rate2 - 1);
      durations.push(Math.max(4, duration));
    }

    latest = new Array(waypoints.length);
    latest[waypoints.length - 1] = waypoints[waypoints.length - 1].latestAnchor;
    for (let i = waypoints.length - 2; i >= 0; i--) {
      latest[i] = Math.min(
        waypoints[i].latestAnchor,
        latest[i + 1] - durations[i + 1]
      );
    }
    if (latest.every((value, i) => value >= waypoints[i].earliestAnchor - 0.01)) break;
    rate *= 1.12;
  }

  waypoints[0].anchor = Math.max(
    waypoints[0].earliestAnchor,
    Math.min(latest[0], waypoints[0].preferredAnchor)
  );
  for (let i = 1; i < waypoints.length; i++) {
    const earliest = Math.max(
      waypoints[i].earliestAnchor,
      waypoints[i - 1].anchor + durations[i]
    );
    waypoints[i].anchor = Math.max(
      earliest,
      Math.min(latest[i], waypoints[i].preferredAnchor)
    );
  }
}

// Each curve sample gets a scroll anchor that preserves a safe viewport position.
// The turtle still moves on the authored curve; only scroll-to-arc timing is adjusted.
function buildScrollMap(waypoints, path, maxScroll) {
  const anchors = [waypoints[0]?.anchor || 0];
  const sub = path.subdivisions;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const from = waypoints[i];
    const to = waypoints[i + 1];
    const fromViewportY = from.y - from.anchor;
    const toViewportY = to.y - to.anchor;
    for (let k = 1; k <= sub; k++) {
      const t = k / sub;
      const sampleIndex = i * sub + k;
      const viewportY = fromViewportY + (toViewportY - fromViewportY) * t;
      const raw = Math.max(0, Math.min(maxScroll, path.ys[sampleIndex] - viewportY));
      anchors.push(Math.max(anchors[anchors.length - 1], raw));
    }
  }
  return anchors;
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

export function updateTurtle(y) {
  if (state.waypoints.length < 2 || !state.samples) return null;
  const arc = targetForY(y).len;
  const pt = pointAtArc(arc);
  const heading = tangentAt(arc, 52);
  const curvature = angleDelta(tangentAt(arc + 36, 24), tangentAt(arc - 36, 24));
  const bank = Math.max(-8, Math.min(8, (curvature * 180 / Math.PI) * 0.34));
  const deg = heading * 180 / Math.PI;
  const interval = intervalAtArc(arc);
  const waypoint = state.waypoints[interval];
  const penDown = waypoint.pen === 'down';
  const visible = waypoint.visible !== false;

  state.turtle.style.transform = `translate(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px) rotate(${deg.toFixed(1)}deg)`;
  state.turtle.classList.toggle('is-visible', visible);

  const phase = arc / 7;
  const stride = Math.sin(phase) * 0.9;
  const sway = Math.sin(phase * 0.5) * (penDown ? 0.18 : 0.4);
  state.inner.style.transform = `translateY(${sway.toFixed(2)}px) rotate(${bank.toFixed(2)}deg)`;
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

  return { len: arc, moving: false, penDown, visible };
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
  state.pen = document.getElementById('turtle-pen');
  state.feet = [...state.turtle.querySelectorAll('.turtle-foot')];
  state.plates = [...state.turtle.querySelectorAll('[data-plate]')];
  measureTurtle();
  state.turtle.classList.add('is-visible');
  ranges = plateRanges();
  return true;
}

export function remeasure() {
  measureTurtle();
  ranges = plateRanges();
}
