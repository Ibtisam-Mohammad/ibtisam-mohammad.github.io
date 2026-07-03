// Heading stroke-reveals (plan.md §6 rule 2), site-wide: each heading's letter
// outlines draw sequentially — a typed-by-the-turtle feel — then the fill settles in,
// all synced to scroll as the heading crosses the lower half of the viewport.
// Scrolling up un-writes the letters. Real text stays in the DOM underneath.

import { addScene, preparePaths, drawSequence, seg, smooth } from '../engine.js';

export function initHeadingReveals() {
  for (const h of document.querySelectorAll('.stroke-heading')) {
    const svg = h.querySelector('.sh-svg');
    if (!svg) continue;
    const glyphs = preparePaths(svg);
    if (!glyphs.length) continue;
    addScene({
      el: h,
      start: 0,
      end: 1,
      measure(rect, vh) {
        this.start = rect.top - vh * 0.92;
        this.end = rect.top - vh * 0.5;
      },
      update(s) {
        drawSequence(glyphs, s, 0, 0.82);
        const fill = smooth(seg(s, 0.78, 1));
        for (const g of glyphs) g.style.fillOpacity = fill;
      },
    });
  }
}
