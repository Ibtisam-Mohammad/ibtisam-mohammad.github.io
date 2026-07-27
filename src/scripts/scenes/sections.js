// Phase 3 section scenes (plan.md §10.2/3/6/7/8/9): the turtle's drawings across
// the remaining sections, all driven by the shared auto-scene pattern — paths draw
// sequentially, dots and tapes pop after — plus the MLOps pipeline choreography,
// runtime-built Problem→Approach→Result arrows on the lead case study, the notes
// graph, and the Contact signature. Everything rewinds with scroll.

import { addScene, preparePaths, setDraw, drawSequence, popSequence, seg, smooth } from '../engine.js';
import { registerWaypoints } from '../turtle.js';

const NS = 'http://www.w3.org/2000/svg';

// null-safe: a renamed/removed figure must degrade to "no extra waypoints for this
// section", never to a TypeError that kills every drawing on the page
function documentBox(element) {
  if (!element) return null;
  const r = element.getBoundingClientRect();
  return { left: r.left, right: r.right, width: r.width, height: r.height, top: r.top + window.scrollY };
}

function spread(points, start, end) {
  return points.map((point, index) => ({
    ...point,
    scrollAnchor: start + (end - start) * (index / Math.max(points.length - 1, 1)),
  }));
}

function registerSectionWaypoints() {
  registerWaypoints('foundations', (_section, { vh }) => {
    const figure = document.querySelector('.fnd-contours svg');
    const r = documentBox(figure);
    if (!r) return [];
    return spread([
      { x: r.right + 18, y: r.top + 12, pen: 'up', visible: true },
      { x: r.left + r.width * 0.86, y: r.top + r.height * 0.2, pen: 'down', visible: true },
      { x: r.left + r.width * 0.66, y: r.top + r.height * 0.43, pen: 'down', visible: true },
      { x: r.left + r.width * 0.5, y: r.top + r.height * 0.58, pen: 'down', visible: true },
      { x: r.right + 18, y: r.top + r.height + 18, pen: 'up', visible: true },
    ], r.top - vh * 0.95, r.top - vh * 0.45);
  });

  registerWaypoints('ml', (_section, { vh }) => {
    const r = documentBox(document.querySelector('.ml-scene'));
    if (!r) return [];
    return spread([
      { x: r.left + r.width * 0.65, y: r.top + r.height * 0.24, pen: 'down', visible: true },
      { x: r.left + r.width * 0.52, y: r.top + r.height * 0.51, pen: 'down', visible: true },
      { x: r.left + r.width * 0.39, y: r.top + r.height * 0.84, pen: 'down', visible: true },
      { x: r.right + 18, y: r.top + r.height + 18, pen: 'up', visible: true },
    ], r.top - vh * 0.95, r.top - vh * 0.4);
  });

  registerWaypoints('mlops', (_section, { vh }) => {
    const pipeline = [...document.querySelectorAll('.pipeline')].find((svg) => svg.getClientRects().length);
    const r = documentBox(pipeline);
    if (!r) return [];
    const horizontal = r.width > r.height * 2;
    const points = [];
    for (let i = 0; i < 5; i++) {
      points.push(horizontal
        ? { x: r.left + r.width * (0.083 + i * 0.2085), y: r.top + r.height * 0.48 + i * 3 }
        : { x: r.left + r.width * 0.5, y: r.top + r.height * (0.065 + i * 0.2) });
    }
    return spread([
      ...points.map((point) => ({ ...point, pen: 'down', visible: true })),
      { x: r.right + 18, y: r.top + r.height + 18, pen: 'up', visible: true },
    ], r.top - vh * 0.92, r.top - vh * 0.4);
  });

  registerWaypoints('work', (_section, { vh }) => {
    const r = documentBox(document.querySelector('.cs-shot-frame'));
    if (!r) return [];
    return spread([
      { x: r.left + 8, y: r.top - 8, pen: 'down', visible: true },
      { x: r.right - 8, y: r.top + 18, pen: 'down', visible: true },
      { x: r.right + 8, y: r.top + r.height * 0.82, pen: 'down', visible: true },
      { x: r.right + 18, y: r.top + r.height + 22, pen: 'up', visible: true },
    ], r.top - vh * 0.9, r.top - vh * 0.55);
  });

  registerWaypoints('notes', (_section, { vh }) => {
    const r = documentBox(document.querySelector('.notes-graph'));
    if (!r) return [];
    const at = (x, y) => ({ x: r.left + (x / 300) * r.width, y: r.top + (y / 340) * r.height });
    return spread([
      { ...at(150, 62), pen: 'down', visible: true },
      { ...at(236, 116), pen: 'down', visible: true },
      { ...at(212, 200), pen: 'down', visible: true },
      { ...at(254, 280), pen: 'down', visible: true },
      { x: r.left - 18, y: r.top + r.height + 18, pen: 'up', visible: true },
    ], r.top - vh * 0.92, r.top - vh * 0.45);
  });

  registerWaypoints('contact', (_section, { vh }) => {
    const r = documentBox(document.querySelector('.signature'));
    if (!r) return [];
    return spread([
      { x: r.left + r.width * 0.06, y: r.top + r.height * 0.4, pen: 'down', visible: true },
      { x: r.left + r.width * 0.4, y: r.top + r.height * 0.48, pen: 'down', visible: true },
      { x: r.left + r.width * 0.72, y: r.top + r.height * 0.56, pen: 'down', visible: true },
      { x: r.left + r.width * 0.94, y: r.top + r.height * 0.68, pen: 'down', visible: true },
      { x: r.right + 18, y: r.top + r.height + 18, pen: 'up', visible: true },
    ], r.top - vh * 0.85, r.top - vh * 0.2);
  });
}

// generic: one scene per drawing root; paths draw, then pops settle
function autoScene(root, { startF = 0.92, endF = 0.55, drawEnd = 0.8, popStart = 0.55 } = {}) {
  if (!root) return;
  const paths = preparePaths(root);
  const pops = [...root.querySelectorAll('[data-pop]')];
  if (!paths.length && !pops.length) return;
  addScene({
    el: root,
    start: 0,
    end: 1,
    _last: -1,
    measure(rect, vh) {
      this.start = rect.top - vh * startF;
      this.end = rect.top - vh * endF;
    },
    update(s) {
      if (s === this._last) return;
      this._last = s;
      drawSequence(paths, s, 0, drawEnd);
      popSequence(pops, s, popStart, 1);
    },
  });
}

export function initSectionScenes() {
  registerSectionWaypoints();
  // §10.2 — physics & math: orbit, vector field, annotated equation, contours
  autoScene(document.querySelector('.fnd-orbit'));
  autoScene(document.querySelector('.fnd-field'), { drawEnd: 0.9, popStart: 0.8 });
  autoScene(document.querySelector('.eq-annotate'), { startF: 0.88, endF: 0.5 });
  autoScene(document.querySelector('.fnd-contours svg'), { startF: 0.95, endF: 0.45 });

  // §10.3 — ML: network, boundary, hulls (one wide sketch)
  autoScene(document.querySelector('.ml-scene'), { startF: 0.95, endF: 0.4, drawEnd: 0.75, popStart: 0.3 });

  // §10.6 — MLOps: pipeline draws, then the palette fills the shapes, then the sparkline
  const pipeline = [...document.querySelectorAll('.pipeline')].find((s) => s.getClientRects().length);
  if (pipeline) {
    const connectors = [...pipeline.querySelectorAll('.pl-connectors path')];
    const rects = [...pipeline.querySelectorAll('.pl-node')];
    const labels = [...pipeline.querySelectorAll('.pl-label')];
    const spark = pipeline.querySelector('.pl-spark');
    preparePaths(pipeline);
    addScene({
      el: pipeline,
      start: 0,
      end: 1,
      _last: -1,
      measure(rect, vh) {
        this.start = rect.top - vh * 0.92;
        this.end = rect.top - vh * 0.4;
      },
      update(s) {
        if (s === this._last) return;
        this._last = s;
        // node borders and connectors draw in pipeline order...
        for (let i = 0; i < rects.length; i++) {
          setDraw(rects[i], seg(s, 0.02 + i * 0.11, 0.14 + i * 0.11));
          if (connectors[i]) setDraw(connectors[i], seg(s, 0.13 + i * 0.11, 0.2 + i * 0.11));
        }
        // ...then "color, disciplined": the collected palette fills the shapes
        rects.forEach((r, i) => {
          r.style.fillOpacity = (0.16 * smooth(seg(s, 0.45 + i * 0.06, 0.6 + i * 0.06))).toFixed(3);
        });
        labels.forEach((l, i) => {
          l.style.opacity = smooth(seg(s, 0.5 + i * 0.06, 0.62 + i * 0.06)).toFixed(3);
        });
        if (spark) setDraw(spark, seg(s, 0.82, 1));
      },
    });
  }

  // §10.7 — case studies: taped frames and P→A→R connective arrows on every card
  // (arrows on the lead only read as missing dashes on the rest)
  for (const svg of document.querySelectorAll('.cs-frame-svg')) {
    autoScene(svg, { startF: 0.9, endF: 0.65, drawEnd: 0.7, popStart: 0.65 });
  }
  for (const rows of document.querySelectorAll('.cs-card .cs-rows')) {
    let arrowSvg = null;
    addScene({
      el: rows,
      start: 0,
      end: 1,
      _last: -1,
      paths: [],
      measure(rect, vh) {
        this.start = rect.top - vh * 0.85;
        this.end = rect.top - vh * 0.45;
        // (re)build the connective arrows from the live label positions
        if (arrowSvg) arrowSvg.remove();
        arrowSvg = document.createElementNS(NS, 'svg');
        arrowSvg.setAttribute('class', 'cs-arrows');
        arrowSvg.setAttribute('aria-hidden', 'true');
        const rowsRect = rows.getBoundingClientRect();
        arrowSvg.setAttribute('viewBox', `0 0 ${Math.round(rowsRect.width)} ${Math.round(rowsRect.height)}`);
        const dts = [...rows.querySelectorAll('dt')].slice(0, 3);
        this.paths = [];
        this.heads = [];
        for (let i = 0; i < dts.length - 1; i++) {
          const a = dts[i].getBoundingClientRect();
          const b = dts[i + 1].getBoundingClientRect();
          const x = a.left - rowsRect.left + 16;
          const y1 = a.bottom - rowsRect.top + 6;
          const y2 = b.top - rowsRect.top - 6;
          // Shaft and head are SEPARATE elements. On one path the head's two strokes
          // are their own subpaths, and SVG restarts the dash pattern at each subpath:
          // every subpath inks at rate len(total) * t, so the ~9-unit head completed at
          // 4% progress and then hung in space for the remaining 88% of the shaft's
          // draw. The head now fades in as its shaft lands instead.
          const shaft = document.createElementNS(NS, 'path');
          shaft.setAttribute('d', `M ${x} ${y1} C ${x - 15} ${y1 + (y2 - y1) * 0.4}, ${x - 15} ${y1 + (y2 - y1) * 0.6}, ${x} ${y2}`);
          shaft.setAttribute('data-draw', '');
          arrowSvg.appendChild(shaft);
          this.paths.push(shaft);

          const head = document.createElementNS(NS, 'path');
          head.setAttribute('d', `M ${x} ${y2} l -6 -7 M ${x} ${y2} l 7 -5`);
          arrowSvg.appendChild(head);
          this.heads.push(head);
        }
        rows.appendChild(arrowSvg);
        preparePaths(arrowSvg);
      },
      update(s) {
        if (s === this._last) return;
        this._last = s;
        drawSequence(this.paths, s, 0.3, 0.9);
        // mirror drawSequence's slicing so each head resolves with its own shaft
        const width = 0.6 / Math.max(this.heads.length, 1);
        for (let i = 0; i < this.heads.length; i++) {
          const end = 0.3 + (i + 1) * width;
          this.heads[i].style.opacity = String(smooth(seg(s, end - width * 0.4, end)));
        }
      },
    });
  }

  // §10.8 — the notes graph draws in
  autoScene(document.querySelector('.notes-graph'), { startF: 0.92, endF: 0.45, drawEnd: 0.7, popStart: 0.5 });

  // §10.9 — SIGNATURE 4: the painted turtle signs, unhurried
  autoScene(document.querySelector('.signature'), { startF: 0.85, endF: 0.2, drawEnd: 0.92, popStart: 0.9 });
}

// notes-graph interactivity is functional, not decorative: it runs for every JS user
// (reduced-motion included), fully keyboard-operable (plan.md §10.8, §12)
export function initNotesInteractive() {
  const graph = document.querySelector('.notes-graph');
  if (!graph) return;
  const rows = [...document.querySelectorAll('.note')];
  const apply = (tag) =>
    rows.forEach((r) => {
      const has = (r.dataset.tags || '').split('|').includes(tag);
      r.classList.toggle('hl', has);
      r.classList.toggle('dim', !has);
    });
  const clear = () => rows.forEach((r) => r.classList.remove('hl', 'dim'));
  let pinned = null;
  for (const node of graph.querySelectorAll('.ng-node')) {
    const tag = node.dataset.tag;
    node.addEventListener('mouseenter', () => !pinned && apply(tag));
    node.addEventListener('mouseleave', () => !pinned && clear());
    node.addEventListener('focus', () => !pinned && apply(tag));
    node.addEventListener('blur', () => !pinned && clear());
    const toggle = () => {
      if (pinned === tag) {
        pinned = null;
        clear();
        node.setAttribute('aria-pressed', 'false');
      } else {
        graph.querySelectorAll('[aria-pressed="true"]').forEach((n) => n.setAttribute('aria-pressed', 'false'));
        pinned = tag;
        apply(tag);
        node.setAttribute('aria-pressed', 'true');
      }
    };
    node.addEventListener('click', toggle);
    node.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    });
  }
}
