// The turtle leaves a persistent route trace that grows and rewinds with scroll.
// Pen-down ranges add a darker live stroke, while sparse milestone sprigs retain
// the vine character without rebuilding the old recursive DOM-heavy thicket.

import { clamp01, seg, smooth } from './engine.js';

const NS = 'http://www.w3.org/2000/svg';
const SECTION_ACCENT = {
  hero: '#2B59C3',
  foundations: '#2B59C3',
  ml: '#0E8A78',
  vision: '#4E9B35',
  generative: '#7A4FD6',
  mlops: '#E0731D',
  work: '#D4537E',
  notes: '#0E8A78',
  contact: '#E0731D',
};
const LEAF_D = 'M0 0 C 3.2 -2.6, 7 -2.8, 9.4 0 C 7 2.8, 3.2 2.6, 0 0 Z';

const state = {
  routeTrail: null,
  routeStart: 0,
  routeLength: 1,
  trailGroup: null,
  branchGroup: null,
  trails: [],
  branches: [],
};

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function el(name, attrs, parent) {
  const node = document.createElementNS(NS, name);
  for (const key in attrs) node.setAttribute(key, attrs[key]);
  parent.appendChild(node);
  return node;
}

function pointAt(samples, arc) {
  const { xs, ys, cum, total } = samples;
  const target = Math.max(0, Math.min(arc, total));
  let lo = 0;
  let hi = cum.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  const i = Math.max(lo, 1);
  const t = (target - cum[i - 1]) / (cum[i] - cum[i - 1] + 1e-9);
  return {
    x: xs[i - 1] + (xs[i] - xs[i - 1]) * t,
    y: ys[i - 1] + (ys[i] - ys[i - 1]) * t,
  };
}

function rangePath(samples, start, end) {
  const points = [pointAt(samples, start)];
  for (let arc = start + 14; arc < end; arc += 14) points.push(pointAt(samples, arc));
  points.push(pointAt(samples, end));
  return `M ${points.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ')}`;
}

function buildSprig(milestone, index, docW, rand) {
  const left = milestone.x < docW / 2;
  const length = 30 + rand() * 20;
  const bend = (rand() - 0.5) * 16;
  const color = SECTION_ACCENT[milestone.section] || '#5B5344';
  const angle = left ? 180 + (rand() - 0.5) * 22 : (rand() - 0.5) * 22;
  const group = el('g', {
    class: 'vine-branch',
    transform: `translate(${milestone.x.toFixed(1)} ${milestone.y.toFixed(1)}) rotate(${angle.toFixed(1)})`,
  }, state.branchGroup);
  const stem = el('path', {
    class: 'vb-stem',
    d: `M0 0 Q ${(length * 0.45).toFixed(1)} ${bend.toFixed(1)}, ${length.toFixed(1)} ${(bend * 0.35).toFixed(1)}`,
    stroke: color,
  }, group);
  const stemLength = stem.getTotalLength();
  stem.style.strokeDasharray = `${stemLength} ${stemLength * 2}`;
  stem.style.strokeDashoffset = `${stemLength}`;

  const leaves = [];
  for (let i = 0; i < 2; i++) {
    const x = length * (0.46 + i * 0.28);
    const y = bend * (0.7 - i * 0.18);
    const leafGroup = el('g', {
      transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${i ? 42 : -46})`,
    }, group);
    const leaf = el('path', {
      class: 'vb-part',
      d: LEAF_D,
      fill: color,
      'fill-opacity': '0.32',
      stroke: color,
      'stroke-width': '0.85',
    }, leafGroup);
    leaf.dataset.s = (0.72 + index * 0.015).toFixed(2);
    leaves.push(leaf);
  }
  const berry = el('circle', {
    class: 'vb-part',
    cx: length.toFixed(1),
    cy: (bend * 0.35).toFixed(1),
    r: '2.3',
    fill: color,
    'fill-opacity': '0.65',
  }, group);
  berry.dataset.s = '1';
  leaves.push(berry);

  return { arc: milestone.arc, stem, stemLength, leaves, last: -1 };
}

export function measureVine(info) {
  if (!state.routeTrail || !state.trailGroup || !state.branchGroup) return;
  state.trailGroup.textContent = '';
  state.branchGroup.textContent = '';
  state.trails = [];
  state.branches = [];

  const heroMilestone = info.milestones.find((milestone) => milestone.section === 'hero');
  state.routeStart = heroMilestone?.arc ?? 0;
  state.routeLength = Math.max(info.total - state.routeStart, 1);
  state.routeTrail.setAttribute('d', rangePath(info.samples, state.routeStart, info.total));
  state.routeTrail.style.strokeDasharray = `${state.routeLength} ${state.routeLength * 3}`;
  state.routeTrail.style.strokeDashoffset = `${state.routeLength}`;

  if (window.innerWidth < 720) return;

  for (const range of info.penRanges) {
    // Sticky hero coordinates are viewport-pinned; the sine itself is the visible ink.
    if (range.section === 'hero') continue;
    const length = Math.max(range.end - range.start, 1);
    const path = el('path', {
      class: 'ink-trail',
      d: rangePath(info.samples, range.start, range.end),
      fill: 'none',
      'data-section': range.section,
    }, state.trailGroup);
    const tail = Math.min(92, length);
    path.style.strokeDasharray = `${tail} ${length + tail + 1}`;
    path.style.strokeDashoffset = `${tail}`;
    path.style.opacity = '0';
    state.trails.push({ path, start: range.start, end: range.end, length, tail, last: -1 });
  }

  const rand = mulberry32(20260710);
  const docW = document.documentElement.clientWidth;
  info.milestones.forEach((milestone, index) => {
    if (milestone.section === 'hero') return;
    state.branches.push(buildSprig(milestone, index, docW, rand));
  });
}

export function updateVine(len) {
  // The visible ink ends at the pen mounted behind the turtle's shell.
  const penArc = Math.max(0, len - 11);
  const routeProgress = clamp01(
    (penArc - state.routeStart) / Math.max(state.routeLength, 1)
  );
  state.routeTrail.style.strokeDashoffset = String(
    state.routeLength * (1 - routeProgress)
  );

  for (const trail of state.trails) {
    const t = clamp01((penArc - trail.start) / Math.max(trail.end - trail.start, 1));
    const presence = smooth(seg(penArc, trail.start, trail.start + 18))
      * (1 - smooth(seg(penArc, trail.end, trail.end + 72)));
    if (t === trail.last && presence === 0) continue;
    trail.last = t;
    trail.path.style.strokeDashoffset = String(trail.tail - t * trail.length);
    trail.path.style.opacity = (presence * 0.34).toFixed(3);
  }

  for (const branch of state.branches) {
    const t = seg(penArc, branch.arc - 24, branch.arc + 88);
    if (t === branch.last) continue;
    branch.last = t;
    branch.stem.style.strokeDashoffset = String((1 - smooth(seg(t, 0, 0.58))) * branch.stemLength);
    branch.leaves.forEach((leaf, index) => {
      const reveal = smooth(seg(t, 0.42 + index * 0.12, 0.72 + index * 0.12));
      leaf.style.opacity = reveal;
      leaf.style.transform = `scale(${(Number(leaf.dataset.s) * (0.35 + reveal * 0.65)).toFixed(3)})`;
    });
  }
}

export function initVine() {
  const svg = document.getElementById('turtle-guide-svg');
  if (!svg) return false;
  state.routeTrail = el('path', { id: 'vine-trail', fill: 'none' }, svg);
  state.trailGroup = el('g', { id: 'ink-trails' }, svg);
  state.branchGroup = el('g', { id: 'vine-branches' }, svg);
  return true;
}
