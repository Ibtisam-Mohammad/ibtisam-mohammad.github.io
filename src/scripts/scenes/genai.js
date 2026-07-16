// Generative AI scene: a compact margin trajectory and restrained washes.

import { addScene, preparePaths, setDraw, seg, smooth } from '../engine.js';
import { registerWaypoints } from '../turtle.js';

export function initGenAiScene() {
  const el = document.getElementById('generative');
  if (!el) return;

  // (the heading's stroke-reveal is driven by the site-wide scenes/headings.js)
  const system = el.querySelector('.gen-system');
  const frame = el.querySelector('[data-part="frame"]');
  const stages = [...el.querySelectorAll('.gen-system-stage')];
  const stageControls = [...el.querySelectorAll('[data-gen-stage]')];
  const doodle = el.querySelector('.gen-doodle');
  const doodleCurve = doodle && doodle.querySelector('[data-part="curve"]');
  const doodleDots = doodle ? [...doodle.querySelectorAll('[data-part="dot"]')] : [];
  const washes = [...el.querySelectorAll('.wash')];

  preparePaths(el);

  const washWindows = [0.08, 0.26, 0.46, 0.68];

  // The turtle traces the system map while its stages activate in sequence.
  registerWaypoints('generative', (_section, { vh, mobile, docW }) => {
    const figure = el.querySelector('.gen-system');
    if (!figure) return [];
    const r = figure.getBoundingClientRect();
    const top = r.top + window.scrollY;
    const points = mobile
      ? [
          { x: docW - 40, y: top - 12, pen: 'down', visible: true },
          { x: docW - 40, y: top + r.height * 0.5, pen: 'down', visible: true },
          { x: docW - 40, y: top + r.height + 12, pen: 'up', visible: true },
        ]
      : [
          { x: r.left + 10, y: top - 10, pen: 'down', visible: true },
          { x: r.right - 10, y: top + 10, pen: 'down', visible: true },
          { x: r.right + 18, y: top + r.height - 10, pen: 'down', visible: true },
          { x: r.left + 10, y: top + r.height + 10, pen: 'up', visible: true },
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
      if (frame) setDraw(frame, seg(s, 0.08, 0.76));
      if (!system?.dataset.stagePinned) {
        const active = Math.min(stages.length - 1, Math.floor(s * stages.length));
        stages.forEach((stage, index) => stage.classList.toggle('is-active', index === active));
        stageControls.forEach((control, index) => control.setAttribute('aria-pressed', String(index === active)));
      }

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
