// The turtle (plan.md §3). Position and orientation are a pure function of scroll:
// a guide path is built through per-section lane waypoints (Catmull-Rom -> cubic
// beziers), scroll maps piecewise-linearly to arc length via per-waypoint anchors,
// and the SVG samples getPointAtLength. Pen state, plate fills, and the boundary
// flourish all derive from the same scroll position.

import { clamp01, seg, smooth } from './engine.js';

// route: section id -> lane side. Crossings happen in the gaps between sections.
const ROUTE = [
  ['hero', 'L'],
  ['foundations', 'L'],
  ['ml', 'R'],
  ['vision', 'L'],
  ['generative', 'R'],
  ['mlops', 'L'],
  ['work', 'R'],
  ['notes', 'L'],
  ['contact', 'R'], // enters right, then curves in to rest beside the actions
];

// plate fill: domain section id -> plate index (scroll order, plan.md §3)
const PLATE_SECTIONS = ['foundations', 'ml', 'vision', 'generative', 'mlops'];

const state = {
  layer: null,
  guide: null,
  turtle: null,
  inner: null,
  plates: [],
  waypoints: [],   // {x, y, anchor, pen} — pen applies to the interval starting here
  cum: [],         // cumulative path length at each waypoint
  total: 0,
  penNow: null,
  extraWaypoints: {}, // sectionId -> fn(rect) -> [{x, y, pen}]
};

// scenes register in-section waypoints (e.g. hero's sine run) before measure()
export function registerWaypoints(sectionId, fn) {
  state.extraWaypoints[sectionId] = fn;
}

function docRect(el) {
  const r = el.getBoundingClientRect();
  const y = window.scrollY;
  return { top: r.top + y, bottom: r.bottom + y, left: r.left, right: r.right, width: r.width, height: r.height };
}

function laneX(side, docW, contentRect, mobile) {
  if (mobile) return docW - 32; // clear of the viewport edge at 24px turtle size
  if (side === 'L') return Math.max(contentRect.left / 2, 26);
  if (side === 'R') return Math.min((docW + contentRect.right) / 2, docW - 26);
  return docW / 2;
}

export function measureTurtle() {
  const docW = document.documentElement.clientWidth;
  const docH = document.documentElement.scrollHeight;
  const vh = window.innerHeight;
  const mobile = docW < 720;
  const content = document.querySelector('.container').getBoundingClientRect();

  state.layer.style.height = `${docH}px`;
  if (state.vineLayer) state.vineLayer.style.height = `${docH}px`;
  state.guide.ownerSVGElement.setAttribute('viewBox', `0 0 ${docW} ${docH}`);

  const wps = [];
  const last = ROUTE.length - 1;
  ROUTE.forEach(([id, side], i) => {
    const el = document.getElementById(id);
    if (!el) return;
    const r = docRect(el);
    const x = laneX(side, docW, content, mobile);
    // tight insets keep lane-to-lane crossings inside the inter-section gaps
    wps.push({ x, y: r.top + 28, pen: 'up', boundary: i > 0 });
    const extra = state.extraWaypoints[id];
    if (extra && !mobile) {
      for (const w of extra(r)) wps.push({ ...w, boundary: false });
    } else if (extra && mobile) {
      // mobile keeps the lane but honors pen-down windows at the same heights
      for (const w of extra(r)) wps.push({ x, y: w.y, pen: w.pen, boundary: false });
    }
    if (i === last && !mobile) {
      // final rest: beside the contact actions, below the text (plan.md §10.9)
      wps.push({ x: content.left + content.width * 0.38, y: r.bottom - 72, pen: 'up', boundary: false });
    } else {
      wps.push({ x, y: r.bottom - 28, pen: 'up', boundary: false });
    }
  });

  // scroll anchor: the turtle sits at a waypoint when that point rides ~42% down the
  // viewport. Waypoints inside pinned (sticky) scenes carry `vy` — the exact viewport
  // y they should hold — so the turtle tracks pinned content instead of scrolling past.
  const maxScroll = docH - vh;
  for (const w of wps) w.anchor = clamp01((w.y - (w.vy ?? vh * 0.42)) / maxScroll) * maxScroll;
  // anchors must be monotonic for piecewise mapping
  for (let i = 1; i < wps.length; i++) wps[i].anchor = Math.max(wps[i].anchor, wps[i - 1].anchor + 1);

  state.waypoints = wps;
  state.guide.setAttribute('d', catmullRomPath(wps));
  state.total = state.guide.getTotalLength();
  state.cum = cumulativeLengths(wps);
}

function catmullRomPath(pts) {
  if (pts.length < 2) return '';
  const p = (i) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = p(i - 1), p1 = p(i), p2 = p(i + 1), p3 = p(i + 2);
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

// approximate cumulative arc length at each waypoint by sampling the path
function cumulativeLengths(wps) {
  const N = 420;
  const samples = [];
  for (let i = 0; i <= N; i++) {
    const pt = state.guide.getPointAtLength((i / N) * state.total);
    samples.push(pt);
  }
  return wps.map((w) => {
    let best = 0, bd = Infinity;
    for (let i = 0; i <= N; i++) {
      const dx = samples[i].x - w.x, dy = samples[i].y - w.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bd) { bd = d2; best = i; }
    }
    return (best / N) * state.total;
  });
}

function plateRanges() {
  const vhNow = window.innerHeight;
  return PLATE_SECTIONS.map((id) => {
    const el = document.getElementById(id);
    if (!el) return [0, 1];
    const r = docRect(el);
    return [r.top - vhNow * 0.5, r.bottom - vhNow * 0.85];
  });
}

let ranges = [];

export function updateTurtle(y) {
  const wps = state.waypoints;
  if (wps.length < 2) return;

  // piecewise-linear scroll -> arc length
  let i = 0;
  while (i < wps.length - 2 && y > wps[i + 1].anchor) i++;
  const t = seg(y, wps[i].anchor, wps[i + 1].anchor);
  const len = state.cum[i] + (state.cum[i + 1] - state.cum[i]) * t;

  const pt = state.guide.getPointAtLength(len);
  const ahead = state.guide.getPointAtLength(Math.min(len + 2, state.total));
  const behind = state.guide.getPointAtLength(Math.max(len - 2, 0));
  let deg = (Math.atan2(ahead.y - behind.y, ahead.x - behind.x) * 180) / Math.PI;

  // boundary flourish: a small in-place rotation as the turtle crosses into a section
  if (wps[i + 1].boundary) deg += Math.sin(t * Math.PI) * 40;

  state.turtle.style.transform = `translate(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px) rotate(${deg.toFixed(1)}deg)`;

  const pen = wps[i].pen;
  if (pen !== state.penNow) {
    state.inner.classList.toggle('pen-down', pen === 'down');
    state.penNow = pen;
  }

  // shell plates fill as each domain section is traversed; scrolling up un-fills
  for (let k = 0; k < state.plates.length; k++) {
    const [a, b] = ranges[k] || [0, 1];
    state.plates[k].style.fillOpacity = smooth(seg(y, a, b)).toFixed(3);
  }

  return len; // arc position — the vine grows exactly to here
}

export function guideInfo() {
  return { guide: state.guide, total: state.total };
}

export function initTurtle() {
  state.layer = document.getElementById('turtle-layer');
  state.vineLayer = document.getElementById('vine-layer');
  state.guide = document.getElementById('turtle-guide');
  state.turtle = document.getElementById('turtle');
  state.inner = document.getElementById('turtle-inner');
  state.plates = [...state.turtle.querySelectorAll('[data-plate]')];
  if (!state.layer || !state.guide) return false;
  measureTurtle();
  ranges = plateRanges();
  return true;
}

export function remeasure() {
  measureTurtle();
  ranges = plateRanges();
}
