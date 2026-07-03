// Phase 3 section scenes (plan.md §10.2/3/6/7/8/9): the turtle's drawings across
// the remaining sections, all driven by the shared auto-scene pattern — paths draw
// sequentially, dots and tapes pop after — plus the MLOps pipeline choreography,
// runtime-built Problem→Approach→Result arrows on the lead case study, the notes
// graph, and the Contact signature. Everything rewinds with scroll.

import { addScene, preparePaths, setDraw, drawSequence, popSequence, seg, smooth } from '../engine.js';

const NS = 'http://www.w3.org/2000/svg';

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

  // §10.7 — case studies: taped frames on every card, P→A→R arrows on the lead only
  for (const svg of document.querySelectorAll('.cs-frame-svg')) {
    autoScene(svg, { startF: 0.9, endF: 0.65, drawEnd: 0.7, popStart: 0.65 });
  }
  const lead = document.querySelector('.cs-card .cs-rows');
  if (lead) {
    let arrowSvg = null;
    addScene({
      el: lead,
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
        const rowsRect = lead.getBoundingClientRect();
        arrowSvg.setAttribute('viewBox', `0 0 ${Math.round(rowsRect.width)} ${Math.round(rowsRect.height)}`);
        const dts = [...lead.querySelectorAll('dt')].slice(0, 3);
        this.paths = [];
        for (let i = 0; i < dts.length - 1; i++) {
          const a = dts[i].getBoundingClientRect();
          const b = dts[i + 1].getBoundingClientRect();
          const x = a.left - rowsRect.left + 16;
          const y1 = a.bottom - rowsRect.top + 6;
          const y2 = b.top - rowsRect.top - 6;
          const d = `M ${x} ${y1} C ${x - 15} ${y1 + (y2 - y1) * 0.4}, ${x - 15} ${y1 + (y2 - y1) * 0.6}, ${x} ${y2} M ${x} ${y2} l -6 -7 M ${x} ${y2} l 7 -5`;
          const p = document.createElementNS(NS, 'path');
          p.setAttribute('d', d);
          p.setAttribute('data-draw', '');
          arrowSvg.appendChild(p);
          this.paths.push(p);
        }
        lead.appendChild(arrowSvg);
        preparePaths(arrowSvg);
      },
      update(s) {
        if (s === this._last) return;
        this._last = s;
        drawSequence(this.paths, s, 0.3, 0.9);
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
