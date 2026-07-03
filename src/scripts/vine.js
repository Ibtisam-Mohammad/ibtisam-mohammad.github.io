// The vine (owner-directed): the turtle's guide path made visible as an ink trail
// that grows exactly behind the turtle, with RECURSIVE branches — trunks sprout
// branches, branches sprout sub-branches — like a real vine. Density ramps
// QUADRATICALLY with page depth: bare stem in the ink chapter, a five-hue thicket
// by Contact. Everything is f(scroll): scrolling up un-grows it, twig by twig.
//
// Performance guardrails: a hard element budget (MAX_ELEMENTS), per-branch cached
// progress (untouched branches cost one float compare per frame), and one DOM
// subtree per trunk.

import { clamp01, seg, smooth } from './engine.js';

const NS = 'http://www.w3.org/2000/svg';

// ---- tuning knobs ----
const SPACING_START = 240;   // arc px between trunks at the top of the page...
const SPACING_END = 34;      // ...and at the bottom (quadratic ramp between them)
const LEN_START = 20;        // trunk length range down the page
const LEN_END = 72;
const GROW_BASE = 110;       // arc distance for a trunk to fully unfurl...
const GROW_EXTRA = 190;      // ...plus this much for the deepest, bushiest ones
const MAX_ELEMENTS = 4400;   // hard cap across all levels (§13 discipline)

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

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const state = { trail: null, group: null, branches: [], total: 0, trailLen: 0, count: 0 };

function el(name, attrs, parent) {
  const n = document.createElementNS(NS, name);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  parent.appendChild(n);
  return n;
}

function sectionRanges() {
  const ranges = [];
  for (const id in SECTION_ACCENT) {
    const s = document.getElementById(id);
    if (!s) continue;
    const r = s.getBoundingClientRect();
    const top = r.top + window.scrollY;
    ranges.push({ top, bottom: top + r.height, palette: SECTION_ACCENT[id] });
  }
  return ranges;
}

function accentAt(ranges, y) {
  let last = ACCENTS;
  for (const r of ranges) {
    if (y >= r.top && y <= r.bottom) return r.palette;
    if (y > r.bottom) last = r.palette;
  }
  return last;
}

// distance from an attach point to the nearest protected text zone (the content
// column inside a section). 0 = inside it (no branch at all); small = nearby, so
// the cluster must stay small; Infinity = margins/lanes, grow freely.
function distToText(ranges, contentRect, x, y) {
  if (x < contentRect.left - 40 || x > contentRect.right + 40) return Infinity;
  let best = Infinity;
  for (const r of ranges) {
    const top = r.top + 40, bottom = r.bottom - 30;
    if (y >= top && y <= bottom) return 0;
    best = Math.min(best, y < top ? top - y : y - bottom);
  }
  return best;
}

function stemD(len, bend) {
  return `M0 0 Q ${(len * 0.45).toFixed(1)} ${(bend * 0.7).toFixed(1)}, ${(len * 0.8).toFixed(1)} ${(bend * 0.4).toFixed(1)} T ${len.toFixed(1)} ${(bend * 0.55).toFixed(1)}`;
}

/**
 * Recursively build one branch into `g`. Returns animatable parts, each with a
 * reveal window [a, b] in trunk-local progress: the stem draws first, leaves pop
 * along it, then sub-branches unfurl from points on the stem — and so on down.
 */
function buildBranch(g, rand, o) {
  const parts = [];
  const accent = o.palette[o.colorIdx % o.palette.length];
  const bend = (rand() - 0.5) * o.len * 0.9;
  const stem = el('path', { class: 'vb-stem', d: stemD(o.len, bend), stroke: accent }, g);
  state.count++;
  const sl = stem.getTotalLength();
  stem.style.strokeDasharray = `${sl} ${sl * 3}`;
  stem.style.strokeDashoffset = `${sl}`;
  const stemEnd = o.t0 + (o.t1 - o.t0) * 0.45;
  parts.push({ el: stem, stem: true, a: o.t0, b: stemEnd, len: sl });

  const angleAt = (f) => {
    const p1 = stem.getPointAtLength(Math.max(f * sl - 1, 0));
    const p2 = stem.getPointAtLength(Math.min(f * sl + 1, sl));
    return (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI;
  };

  // leaves along the stem, denser and larger down the page
  const nLeaves = Math.min(1 + Math.round(rand() * (0.5 + o.pageDepth * 3.0)), 4);
  for (let k = 0; k < nLeaves && state.count < MAX_ELEMENTS; k++) {
    const f = 0.45 + (k / Math.max(nLeaves, 1)) * 0.5;
    const pt = stem.getPointAtLength(f * sl);
    const la = angleAt(f) + (k % 2 ? 1 : -1) * (36 + rand() * 32);
    const ls = (0.65 + rand() * 0.5 + o.pageDepth * 0.5) * o.scale * Math.pow(0.82, o.level);
    const lg = el('g', { transform: `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)}) rotate(${la.toFixed(0)})` }, g);
    const leaf = el('path', { class: 'vb-part', d: LEAF_D, fill: accent, 'fill-opacity': '0.32', stroke: accent, 'stroke-width': '0.9' }, lg);
    state.count++;
    leaf.dataset.s = ls.toFixed(2);
    const a = stemEnd - 0.06 + k * 0.05;
    parts.push({ el: leaf, stem: false, a, b: Math.min(a + 0.22, 1) });
  }

  // a berry at the tip, more often deeper down
  if (rand() < 0.2 + o.pageDepth * 0.55 && state.count < MAX_ELEMENTS) {
    const tip = stem.getPointAtLength(sl);
    const bg = el('g', { transform: `translate(${tip.x.toFixed(1)} ${tip.y.toFixed(1)})` }, g);
    const berry = el('circle', {
      class: 'vb-part',
      r: ((1.8 + rand() * 1.8 + o.pageDepth * 1.4) * o.scale * Math.pow(0.85, o.level)).toFixed(1),
      fill: o.palette[(o.colorIdx + 1) % o.palette.length],
      'fill-opacity': '0.6',
    }, bg);
    state.count++;
    berry.dataset.s = '1';
    parts.push({ el: berry, stem: false, a: stemEnd + 0.08, b: Math.min(stemEnd + 0.3, 1) });
  }

  // sub-branches: the recursion. Count ramps quadratically with page depth, so the
  // top of the page stays a clean line and the bottom becomes a thicket.
  if (o.level < o.maxLevel && state.count < MAX_ELEMENTS - 4) {
    const d2 = o.pageDepth * o.pageDepth;
    const nSub = Math.min(Math.floor(rand() * 0.8 + d2 * (o.level === 0 ? 4.4 : 3.0)), 4);
    for (let k = 0; k < nSub; k++) {
      const f = 0.35 + rand() * 0.55;
      const pt = stem.getPointAtLength(f * sl);
      const da = angleAt(f) + (k % 2 ? 1 : -1) * (30 + rand() * 36);
      const sg = el('g', { transform: `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)}) rotate(${(da - angleAt(f)).toFixed(0)})` }, g);
      const subStart = o.t0 + (o.t1 - o.t0) * (0.4 + f * 0.25);
      parts.push(...buildBranch(sg, rand, {
        ...o,
        level: o.level + 1,
        len: o.len * (0.45 + rand() * 0.3),
        colorIdx: o.colorIdx + (rand() < 0.35 ? 1 : 0),
        t0: subStart,
        t1: Math.min(subStart + (o.t1 - o.t0) * 0.55, 1),
      }));
    }
  }
  return parts;
}

// (re)build the whole vine along the current guide path
export function measureVine(guide, total) {
  state.total = total;

  // the visible trail begins where the hero scene ends: the hero opens on blank
  // paper (§7 level 1), and the turtle starts leaving its trail after the origin
  // dot. Find the arc where the path exits the hero, then rebuild the trail as a
  // sampled subpath from there.
  const hero = document.getElementById('hero');
  let startArc = 0;
  if (hero) {
    const hr = hero.getBoundingClientRect();
    const heroExitY = hr.top + window.scrollY + hr.height - 60;
    let lo = 0, hi = total;
    for (let k = 0; k < 24; k++) {
      const mid = (lo + hi) / 2;
      if (guide.getPointAtLength(mid).y < heroExitY) lo = mid; else hi = mid;
    }
    startArc = hi;
  }
  state.startArc = startArc;
  const pts = [];
  for (let a = startArc; a <= total; a += 22) {
    const p = guide.getPointAtLength(a);
    pts.push(`${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
  }
  state.trail.setAttribute('d', pts.length > 1 ? `M ${pts[0]} L ${pts.slice(1).join(' L ')}` : 'M 0 0');
  const L = state.trail.getTotalLength();
  state.trail.style.strokeDasharray = `${L} ${L * 3}`;
  state.trail.style.strokeDashoffset = `${L}`;
  state.trailLen = L;

  state.group.textContent = '';
  state.branches = [];
  state.count = 0;
  const rand = mulberry32(20260707);
  const docW = document.documentElement.clientWidth;
  const mobile = docW < 720;
  const ranges = sectionRanges();
  const contentRect = document.querySelector('.container').getBoundingClientRect();

  let pos = startArc + 140;
  let i = 0;
  while (pos < total - 60 && state.count < MAX_ELEMENTS) {
    const depth = pos / total;
    const d2 = depth * depth; // quadratic density ramp
    let spacing = (SPACING_START + (SPACING_END - SPACING_START) * d2) * (mobile ? 1.7 : 1) * (0.8 + rand() * 0.5);
    // free margins (outside the content column) grow extra-dense
    const probe = guide.getPointAtLength(Math.min(pos + spacing, total - 61));
    if (probe.x < contentRect.left - 40 || probe.x > contentRect.right + 40) spacing *= 0.72;
    pos += spacing;
    if (pos >= total - 60) break;

    const p = guide.getPointAtLength(pos);
    const dist = distToText(ranges, contentRect, p.x, p.y);
    if (dist === 0) continue;
    // clusters shrink as they approach text: reach must never cross into copy
    const prox = Math.min(dist / 170, 1);
    const ahead = guide.getPointAtLength(Math.min(pos + 2, total));
    const behind = guide.getPointAtLength(Math.max(pos - 2, 0));
    const tx = ahead.x - behind.x, ty = ahead.y - behind.y;
    const tl = Math.hypot(tx, ty) || 1;
    let nx = -ty / tl, ny = tx / tl;
    const away = p.x < docW / 2 ? -1 : 1;
    if (nx * away < 0) { nx = -nx; ny = -ny; }

    const scale = mobile ? 0.68 : 1;
    let len = (LEN_START + (LEN_END - LEN_START) * Math.pow(depth, 1.5)) * (0.75 + rand() * 0.6) * scale;
    len *= 0.4 + 0.6 * prox;
    const room = away < 0 ? p.x - 8 : docW - p.x - 8;
    len = Math.min(len, Math.max(room, 8));

    const palette = accentAt(ranges, p.y);
    const ang = (Math.atan2(ny, nx) * 180) / Math.PI + (rand() - 0.5) * 44;
    const g = el('g', { class: 'vine-branch', transform: `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${ang.toFixed(1)})` }, state.group);

    // third-order twigs arrive in the lower half of the page — real-vine feel —
    // but recursion depth also backs off near text so foliage reach stays bounded
    const fullLevel = mobile ? 2 : depth > 0.5 ? 3 : 2;
    const parts = buildBranch(g, rand, {
      level: 0,
      maxLevel: prox < 0.5 ? 1 : prox < 0.85 ? Math.min(fullLevel, 2) : fullLevel,
      pageDepth: depth,
      len,
      palette,
      colorIdx: i,
      scale,
      t0: 0,
      t1: 1,
    });
    state.branches.push({ parts, pos, grow: GROW_BASE + depth * GROW_EXTRA, t: -1 });
    i++;
  }
}

export function updateVine(len) {
  if (!state.trail) return;
  // the trail is the guide path past the hero: reveal to the turtle's arc position
  const eff = clamp01((len - state.startArc) / Math.max(state.trailLen, 1)) * state.trailLen;
  state.trail.style.strokeDashoffset = String(state.trailLen - eff);

  for (const b of state.branches) {
    const t = seg(len, b.pos - 10, b.pos - 10 + b.grow);
    if (t === b.t) continue;
    b.t = t;
    for (const part of b.parts) {
      if (part.stem) {
        part.el.style.strokeDashoffset = String((1 - clamp01(seg(t, part.a, part.b))) * part.len);
      } else {
        const pt = smooth(seg(t, part.a, part.b));
        part.el.style.opacity = pt;
        part.el.style.transform = `scale(${(part.el.dataset.s * (0.3 + 0.7 * pt)).toFixed(3)})`;
      }
    }
  }
}

export function initVine() {
  const svg = document.getElementById('turtle-guide-svg');
  if (!svg) return false;
  state.trail = document.createElementNS(NS, 'path');
  state.trail.setAttribute('id', 'vine-trail');
  state.trail.setAttribute('fill', 'none');
  svg.appendChild(state.trail);
  state.group = document.createElementNS(NS, 'g');
  state.group.setAttribute('id', 'vine-branches');
  svg.appendChild(state.group);
  return true;
}
