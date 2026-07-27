// The turtle's full guide path becomes a persistent ink trail. Recursive vine
// branches grow from it with the original depth-based density ramp and rewind as
// scroll moves upward. Branch work is cached and capped by a hard DOM budget.

import { clamp01, seg, smooth } from './engine.js';

const NS = 'http://www.w3.org/2000/svg';
const SPACING_START = 240;
const SPACING_END = 34;
const LEN_START = 20;
const LEN_END = 72;
const GROW_BASE = 110;
const GROW_EXTRA = 190;
const MAX_ELEMENTS = 4400;

const ACCENTS = ['#2B59C3', '#0E8A78', '#4E9B35', '#7A4FD6', '#E0731D'];
const SECTION_ACCENT = {
  hero: ['#2B59C3'],
  foundations: ['#2B59C3'],
  ml: ['#0E8A78'],
  vision: ['#4E9B35'],
  generative: ['#7A4FD6', '#D4537E'],
  mlops: ['#E0731D'],
  work: ACCENTS,
  notes: ACCENTS,
  contact: ACCENTS,
};
const LEAF_D = 'M0 0 C 3.2 -2.6, 7 -2.8, 9.4 0 C 7 2.8, 3.2 2.6, 0 0 Z';

const state = {
  trail: null,
  branchGroup: null,
  branches: [],
  total: 1,
  trailLength: 1,
  count: 0,
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

function sectionRanges() {
  const ranges = [];
  for (const id in SECTION_ACCENT) {
    const section = document.getElementById(id);
    if (!section) continue;
    const rect = section.getBoundingClientRect();
    const top = rect.top + window.scrollY;
    ranges.push({ top, bottom: top + rect.height, palette: SECTION_ACCENT[id] });
  }
  return ranges;
}

function accentAt(ranges, y) {
  let last = ACCENTS;
  for (const range of ranges) {
    if (y >= range.top && y <= range.bottom) return range.palette;
    if (y > range.bottom) last = range.palette;
  }
  return last;
}

function distToText(ranges, contentRect, x, y) {
  if (x < contentRect.left - 40 || x > contentRect.right + 40) return Infinity;
  let best = Infinity;
  for (const range of ranges) {
    const top = range.top + 40;
    const bottom = range.bottom - 30;
    if (y >= top && y <= bottom) return 0;
    best = Math.min(best, y < top ? top - y : y - bottom);
  }
  return best;
}

// hard no-spawn zones: conversion-critical blocks (CTAs, contact links, the notes
// graph) opt out via data-vine-exclude — foliage must never sit on the elements a
// buyer needs to read or click
function excludeRects() {
  return [...document.querySelectorAll('[data-vine-exclude]')].map((element) => {
    const r = element.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top + window.scrollY, bottom: r.bottom + window.scrollY };
  });
}

function inExclusion(rects, x, y, pad) {
  for (const r of rects) {
    if (x > r.left - pad && x < r.right + pad && y > r.top - pad && y < r.bottom + pad) return true;
  }
  return false;
}

function stemD(length, bend) {
  return `M0 0 Q ${(length * 0.45).toFixed(1)} ${(bend * 0.7).toFixed(1)}, ${(length * 0.8).toFixed(1)} ${(bend * 0.4).toFixed(1)} T ${length.toFixed(1)} ${(bend * 0.55).toFixed(1)}`;
}

function stemGeom(length, bend) {
  const a = [length * 0.8, bend * 0.4];
  const c1 = [length * 0.45, bend * 0.7];
  const c2 = [2 * a[0] - c1[0], 2 * a[1] - c1[1]];
  const b = [length, bend * 0.55];
  const q = (p0, c, p1, t) => {
    const u = 1 - t;
    return [
      u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0],
      u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1],
    ];
  };
  const dq = (p0, c, p1, t) => [
    2 * (1 - t) * (c[0] - p0[0]) + 2 * t * (p1[0] - c[0]),
    2 * (1 - t) * (c[1] - p0[1]) + 2 * t * (p1[1] - c[1]),
  ];
  const point = (t) => (
    t < 0.5 ? q([0, 0], c1, a, t * 2) : q(a, c2, b, (t - 0.5) * 2)
  );
  const angle = (t) => {
    const delta = t < 0.5
      ? dq([0, 0], c1, a, t * 2)
      : dq(a, c2, b, (t - 0.5) * 2);
    return Math.atan2(delta[1], delta[0]) * 180 / Math.PI;
  };
  let arc = 0;
  let previous = [0, 0];
  for (let i = 1; i <= 16; i++) {
    const current = point(i / 16);
    arc += Math.hypot(current[0] - previous[0], current[1] - previous[1]);
    previous = current;
  }
  return { arc, point, angle };
}

function buildBranch(group, rand, options) {
  const parts = [];
  const accent = options.palette[options.colorIdx % options.palette.length];
  const bend = (rand() - 0.5) * options.length * 0.9;
  const geometry = stemGeom(options.length, bend);
  const stem = el('path', {
    class: 'vb-stem',
    d: stemD(options.length, bend),
    stroke: accent,
  }, group);
  state.count++;
  stem.style.strokeDasharray = `${geometry.arc} ${geometry.arc * 3}`;
  stem.style.strokeDashoffset = `${geometry.arc}`;
  const stemEnd = options.t0 + (options.t1 - options.t0) * 0.45;
  parts.push({ element: stem, stem: true, a: options.t0, b: stemEnd, length: geometry.arc });

  const leafCount = Math.min(
    1 + Math.round(rand() * (0.5 + options.pageDepth * 3)),
    4
  );
  for (let i = 0; i < leafCount && state.count < MAX_ELEMENTS; i++) {
    const fraction = 0.45 + (i / Math.max(leafCount, 1)) * 0.5;
    const [x, y] = geometry.point(fraction);
    const angle = geometry.angle(fraction) + (i % 2 ? 1 : -1) * (36 + rand() * 32);
    const scale = (
      (0.65 + rand() * 0.5 + options.pageDepth * 0.5)
      * options.scale
      * Math.pow(0.82, options.level)
    );
    const leafGroup = el('g', {
      transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle.toFixed(0)})`,
    }, group);
    const leaf = el('path', {
      class: 'vb-part',
      d: LEAF_D,
      fill: accent,
      'fill-opacity': '0.32',
      stroke: accent,
      'stroke-width': '0.9',
    }, leafGroup);
    state.count++;
    leaf.dataset.s = scale.toFixed(2);
    const start = stemEnd - 0.06 + i * 0.05;
    parts.push({ element: leaf, stem: false, a: start, b: Math.min(start + 0.22, 1) });
  }

  if (rand() < 0.2 + options.pageDepth * 0.55 && state.count < MAX_ELEMENTS) {
    const [x, y] = geometry.point(1);
    const berryGroup = el('g', {
      transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})`,
    }, group);
    const berry = el('circle', {
      class: 'vb-part',
      r: ((1.8 + rand() * 1.8 + options.pageDepth * 1.4)
        * options.scale * Math.pow(0.85, options.level)).toFixed(1),
      fill: options.palette[(options.colorIdx + 1) % options.palette.length],
      'fill-opacity': '0.6',
    }, berryGroup);
    state.count++;
    berry.dataset.s = '1';
    parts.push({ element: berry, stem: false, a: stemEnd + 0.08, b: Math.min(stemEnd + 0.3, 1) });
  }

  if (options.level < options.maxLevel && state.count < MAX_ELEMENTS - 4) {
    const depth2 = options.pageDepth * options.pageDepth;
    const subCount = Math.min(
      Math.floor(rand() * 0.8 + depth2 * (options.level === 0 ? 4.4 : 3)),
      4
    );
    for (let i = 0; i < subCount; i++) {
      const fraction = 0.35 + rand() * 0.55;
      const [x, y] = geometry.point(fraction);
      const angle = (i % 2 ? 1 : -1) * (30 + rand() * 36);
      const subGroup = el('g', {
        transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle.toFixed(0)})`,
      }, group);
      const start = options.t0 + (options.t1 - options.t0) * (0.4 + fraction * 0.25);
      parts.push(...buildBranch(subGroup, rand, {
        ...options,
        level: options.level + 1,
        length: options.length * (0.45 + rand() * 0.3),
        colorIdx: options.colorIdx + (rand() < 0.35 ? 1 : 0),
        t0: start,
        t1: Math.min(start + (options.t1 - options.t0) * 0.55, 1),
      }));
    }
  }
  return parts;
}

function pointAt(samples, arc) {
  const target = Math.max(0, Math.min(arc, samples.total));
  let lo = 0;
  let hi = samples.cum.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (samples.cum[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  const i = Math.max(lo, 1);
  const t = (target - samples.cum[i - 1])
    / (samples.cum[i] - samples.cum[i - 1] + 1e-9);
  return {
    x: samples.xs[i - 1] + (samples.xs[i] - samples.xs[i - 1]) * t,
    y: samples.ys[i - 1] + (samples.ys[i] - samples.ys[i - 1]) * t,
    tx: samples.xs[i] - samples.xs[i - 1],
    ty: samples.ys[i] - samples.ys[i - 1],
  };
}

function fullTrailPath(samples) {
  const points = [];
  let nextArc = 0;
  for (let i = 0; i < samples.cum.length; i++) {
    if (samples.cum[i] < nextArc) continue;
    points.push(`${samples.xs[i].toFixed(1)} ${samples.ys[i].toFixed(1)}`);
    nextArc += 22;
  }
  const end = pointAt(samples, samples.total);
  points.push(`${end.x.toFixed(1)} ${end.y.toFixed(1)}`);
  return points.length > 1 ? `M ${points[0]} L ${points.slice(1).join(' L ')}` : 'M 0 0';
}

export function measureVine(info) {
  if (!state.trail || !state.branchGroup || !info.samples?.xs.length) return;
  const { samples } = info;
  state.total = Math.max(info.total, 1);
  state.trail.setAttribute('d', fullTrailPath(samples));
  state.trailLength = Math.max(state.trail.getTotalLength(), 1);
  state.trail.style.strokeDasharray = `${state.trailLength} ${state.trailLength * 3}`;
  state.trail.style.strokeDashoffset = `${state.trailLength}`;

  state.branchGroup.textContent = '';
  state.branches = [];
  state.count = 0;
  const rand = mulberry32(20260707);
  const docW = document.documentElement.clientWidth;
  const mobile = docW < 720;
  const ranges = sectionRanges();
  const excludes = excludeRects();
  const content = document.querySelector('.container')?.getBoundingClientRect();
  if (!content) return;

  const heroMilestone = info.milestones.find((milestone) => milestone.section === 'hero');
  let position = (heroMilestone?.arc ?? 0) + 140;
  let branchIndex = 0;
  while (position < state.total - 60 && state.count < MAX_ELEMENTS) {
    const depth = position / state.total;
    const depth2 = depth * depth;
    let spacing = (SPACING_START + (SPACING_END - SPACING_START) * depth2)
      * (mobile ? 1.7 : 1)
      * (0.8 + rand() * 0.5);
    const probe = pointAt(samples, Math.min(position + spacing, state.total - 61));
    if (probe.x < content.left - 40 || probe.x > content.right + 40) spacing *= 0.72;
    position += spacing;
    if (position >= state.total - 60) break;

    const point = pointAt(samples, position);
    const textDistance = distToText(ranges, content, point.x, point.y);
    // The current route crosses scene geometry more often than the old margin-only
    // route. Keep those candidates, but make them short and shallow near content.
    const proximity = textDistance === 0 ? 0.28 : Math.min(textDistance / 170, 1);
    const tangentLength = Math.hypot(point.tx, point.ty) || 1;
    let nx = -point.ty / tangentLength;
    let ny = point.tx / tangentLength;
    const away = point.x < docW / 2 ? -1 : 1;
    if (nx * away < 0) {
      nx = -nx;
      ny = -ny;
    }

    const scale = mobile ? 0.68 : 1;
    let length = (LEN_START + (LEN_END - LEN_START) * Math.pow(depth, 1.5))
      * (0.75 + rand() * 0.6)
      * scale;
    length *= 0.4 + 0.6 * proximity;
    const room = away < 0 ? point.x - 8 : docW - point.x - 8;
    length = Math.min(length, Math.max(room, 8));

    // never sprout where a buyer needs to read or click — sub-branches extend well
    // past the trunk, so the clearance uses full potential reach, not trunk length
    if (inExclusion(excludes, point.x, point.y, length * 1.8 + 24)) continue;

    const palette = accentAt(ranges, point.y);
    const angle = Math.atan2(ny, nx) * 180 / Math.PI + (rand() - 0.5) * 44;
    const group = el('g', {
      class: 'vine-branch',
      transform: `translate(${point.x.toFixed(1)} ${point.y.toFixed(1)}) rotate(${angle.toFixed(1)})`,
    }, state.branchGroup);
    const fullLevel = mobile ? 2 : depth > 0.5 ? 3 : 2;
    const parts = buildBranch(group, rand, {
      level: 0,
      maxLevel: proximity < 0.5 ? 1 : proximity < 0.85 ? Math.min(fullLevel, 2) : fullLevel,
      pageDepth: depth,
      length,
      palette,
      colorIdx: branchIndex,
      scale,
      t0: 0,
      t1: 1,
    });
    state.branches.push({
      parts,
      position,
      grow: GROW_BASE + depth * GROW_EXTRA,
      progress: -1,
    });
    branchIndex++;
  }
}

export function updateVine(len) {
  if (!state.trail) return;
  const arc = Math.max(0, Math.min(len, state.total));
  const progress = clamp01(arc / state.total);
  state.trail.style.strokeDashoffset = String(state.trailLength * (1 - progress));

  for (const branch of state.branches) {
    const t = seg(arc, branch.position - 10, branch.position - 10 + branch.grow);
    if (t === branch.progress) continue;
    branch.progress = t;
    for (const part of branch.parts) {
      if (part.stem) {
        const drawProgress = t <= 0 ? 0 : clamp01(seg(t, part.a, part.b));
        part.element.style.strokeDashoffset = String(
          (1 - drawProgress) * part.length
        );
      } else {
        const partProgress = t <= 0 ? 0 : smooth(seg(t, part.a, part.b));
        part.element.style.opacity = partProgress;
        part.element.style.transform = `scale(${(
          Number(part.element.dataset.s) * (0.3 + 0.7 * partProgress)
        ).toFixed(3)})`;
      }
    }
  }
}

export function initVine() {
  const svg = document.getElementById('turtle-guide-svg');
  if (!svg) return false;
  state.trail = el('path', { id: 'vine-trail', fill: 'none' }, svg);
  state.branchGroup = el('g', { id: 'vine-branches' }, svg);
  return true;
}
