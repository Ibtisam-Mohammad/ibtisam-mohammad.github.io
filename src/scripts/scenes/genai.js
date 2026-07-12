// Generative AI scene: a compact margin trajectory and restrained washes.

import { addScene, preparePaths, setDraw, seg, smooth } from '../engine.js';
import { registerWaypoints } from '../turtle.js';

export function initGenAiScene() {
  const el = document.getElementById('generative');
  if (!el) return;

  // (the heading's stroke-reveal is driven by the site-wide scenes/headings.js)
  const doodle = el.querySelector('.gen-doodle');
  const doodleCurve = doodle && doodle.querySelector('[data-part="curve"]');
  const doodleDots = doodle ? [...doodle.querySelectorAll('[data-part="dot"]')] : [];
  const washes = [...el.querySelectorAll('.wash')];

  preparePaths(el);

  const washWindows = [0.08, 0.26, 0.46, 0.68];

  // The turtle crosses the project summaries without implying a client screenshot.
  registerWaypoints('generative', (_section, { vh, mobile, docW }) => {
    const grid = el.querySelector('.project-grid');
    if (!grid) return [];
    const r = grid.getBoundingClientRect();
    const top = r.top + window.scrollY;
    const lane = mobile ? docW - 40 : r.left - 22;
    const points = [
      { x: lane, y: top - 18, pen: 'up', visible: true },
      { x: lane, y: top + r.height * 0.45, pen: 'up', visible: true },
      { x: lane, y: top + r.height + 18, pen: 'up', visible: true },
    ];
    const start = top - vh * 0.8;
    const end = top + r.height - vh * 0.35;
    return points.map((point, index) => ({
      ...point,
      scrollAnchor: start + (end - start) * (index / (points.length - 1)),
    }));
  });

  addScene({
    el,
    start: 0,
    end: 1,
    measure(rect, vh) {
      this.start = rect.top - vh * 0.8;
      this.end = rect.bottom - vh * 0.6;
    },
    update(s) {
      // diffusion-trajectory doodle: curve, then dots converge along it
      if (doodleCurve) setDraw(doodleCurve, seg(s, 0.84, 0.94));
      doodleDots.forEach((d2, i) => {
        d2.style.opacity = smooth(seg(s, 0.86 + i * 0.014, 0.9 + i * 0.014));
      });

      // washes bloom: opacity + slight scale only (transform/opacity rule, §4)
      washes.forEach((w, i) => {
        const a = washWindows[i % washWindows.length];
        const t = smooth(seg(s, a, a + 0.16));
        w.style.opacity = (t * parseFloat(w.dataset.opacity || '0.2')).toFixed(3);
        w.style.transform = `scale(${0.88 + 0.12 * t})`;
      });
    },
  });
}
