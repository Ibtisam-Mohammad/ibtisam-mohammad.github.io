// Section titles stay fully readable. A lower-contrast outline traces behind the real
// heading as it enters, then settles into a quiet technical annotation.

import { addScene, preparePaths, drawSequence, seg, smooth } from '../engine.js';

export function initHeadingReveals() {
  for (const heading of document.querySelectorAll('.stroke-heading')) {
    const svg = heading.querySelector('.sh-svg');
    if (!svg) continue;
    const glyphs = preparePaths(svg);
    if (!glyphs.length) continue;

    addScene({
      el: heading,
      start: 0,
      end: 1,
      measure(rect, vh) {
        this.start = rect.top - vh * 0.98;
        this.end = rect.top - vh * 0.7;
      },
      update(s) {
        drawSequence(glyphs, s, 0, 0.78);
        const settle = smooth(seg(s, 0.72, 1));
        svg.style.opacity = (0.72 - settle * 0.42).toFixed(3);
      },
    });
  }
}
