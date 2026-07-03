// Ink-write (owner override of §6.3's block-only rule): body copy is WRITTEN in,
// word by word, as the turtle passes — each block's words fade in sequentially
// across its scroll window, with a subtle 4px rise on the block. Non-text pieces
// (chips, equations, buttons, figures) reveal as whole units in document order.
// Word-level, not letter-level: readable at every mid-state, and the DOM keeps
// plain text flow (spans preserve copy/paste, wrapping, and screen-reader order).
//
// Pure f(scroll): scrolling up un-writes the page. This module only runs under
// html.anim — no-JS and reduced-motion users get untouched, fully visible markup.

import { addScene, seg, smooth } from '../engine.js';

// content blocks that write themselves as the viewport reaches them
const BLOCK_SELECTOR = [
  '.hero h1',
  '.hero .thesis',
  '.hero .roles',
  '.section-head',
  '.prose > p',
  '.card',
  'figure',
  '.group',
  '.note',
  '.stat',
  '.stat-note',
  '.actions',
  '.contact-links',
  '.location',
].join(',');

// elements that reveal as one piece (their internals are units, not words);
// .gen-step/.gen-frame internals belong to the GenAI scene — the figure wrapper
// reveals as a unit and the scene drives what happens inside it
const UNIT_SELECTOR = '.chip, .btn, .equation, .katex, .stat-bar, .stat-num, img, svg, .placeholder-tag, time, .gen-figure, .visual-placeholder, .kicker';

// skip entirely: the stroke-heading has its own letter-outline reveal
const SKIP_SELECTOR = '.stroke-heading, .gen-doodle';

function collectUnits(block) {
  const units = [];
  (function walk(node) {
    if (node.nodeType === 1) {
      if (node.matches(SKIP_SELECTOR)) return;
      if (node.matches(UNIT_SELECTOR)) {
        units.push(node);
        return;
      }
      for (const child of [...node.childNodes]) walk(child);
    } else if (node.nodeType === 3 && node.textContent.trim()) {
      const frag = document.createDocumentFragment();
      for (const w of node.textContent.split(/(\s+)/)) {
        if (!w) continue;
        if (/^\s+$/.test(w)) {
          frag.appendChild(document.createTextNode(w));
        } else {
          const span = document.createElement('span');
          span.textContent = w;
          frag.appendChild(span);
          units.push(span);
        }
      }
      node.replaceWith(frag);
    }
  })(block);
  return units;
}

export function initInkSettle() {
  const main = document.getElementById('main');
  if (!main) return;
  const all = [...main.querySelectorAll(BLOCK_SELECTOR)];
  const blocks = all.filter((e) => !all.some((o) => o !== e && o.contains(e)));

  for (const el of blocks) {
    const units = collectUnits(el);
    addScene({
      el,
      start: 0,
      end: 1,
      _last: -1,
      measure(rect, vh) {
        this.start = rect.top - vh * 0.95;
        this.end = rect.top - vh * 0.72;
      },
      update(s) {
        if (s === this._last) return;
        this._last = s;
        const t = smooth(s);
        el.style.transform = t >= 1 ? '' : `translateY(${((1 - t) * 4).toFixed(2)}px)`;
        const n = units.length;
        if (!n) {
          el.style.opacity = t >= 1 ? '' : t.toFixed(3);
          return;
        }
        // the write: units ink in sequentially across the window
        const span = 0.35;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * (1 - span);
          const o = seg(s, a, a + span);
          units[i].style.opacity = o >= 1 ? '' : o.toFixed(3);
        }
      },
    });
  }
}
