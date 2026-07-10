// Generative AI scene — SIGNATURE 3 of 4, peak paint (plan.md §10.5, §8 variant 2).
// Choreography (s local): heading stroke-reveal .0-.16 -> turtle noise scribbles .06-.2
// -> four-step noise->structure crossfade .22-.72 -> contour frame .72-.86 (settles to
// 25%) -> diffusion-trajectory doodle .84-1. Washes bloom in the margins throughout.

import { addScene, preparePaths, setDraw, drawSequence, seg, smooth } from '../engine.js';
import { registerWaypoints } from '../turtle.js';

export function initGenAiScene() {
  const el = document.getElementById('generative');
  if (!el) return;

  // (the heading's stroke-reveal is driven by the site-wide scenes/headings.js)
  const scribbles = [...el.querySelectorAll('[data-part="scribble"]')];
  const frame = el.querySelector('[data-part="frame"]');
  const steps = [...el.querySelectorAll('.gen-step')];
  const stages = [...el.querySelectorAll('.gen-stage')];
  const conditioning = el.querySelector('.gen-conditioning');
  const doodle = el.querySelector('.gen-doodle');
  const doodleCurve = doodle && doodle.querySelector('[data-part="curve"]');
  const doodleDots = doodle ? [...doodle.querySelectorAll('[data-part="dot"]')] : [];
  const washes = [...el.querySelectorAll('.wash')];

  preparePaths(el);

  // crossfade windows for steps 1..4: [in-start, in-end, out-start, out-end]
  const FADE = [
    [0.0, 0.02, 0.3, 0.42],
    [0.3, 0.42, 0.48, 0.58],
    [0.48, 0.58, 0.64, 0.74],
    [0.64, 0.76, 2, 3],
  ];
  const washWindows = [0.08, 0.26, 0.46, 0.68];

  // The turtle traces the figure's frame, then disappears before travelling onward.
  registerWaypoints('generative', (_section, { vh }) => {
    const fig = el.querySelector('.gen-figure');
    const r = fig.getBoundingClientRect();
    const top = r.top + window.scrollY;
    const points = [
      { x: r.left + 12, y: top - 10, pen: 'down', visible: true },
      { x: r.right - 18, y: top + 22, pen: 'down', visible: true },
      { x: r.right + 18, y: top + r.height * 0.72, pen: 'down', visible: true },
      { x: r.right + 22, y: top + r.height + 22, pen: 'up', visible: false },
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
      // scribbles draw, then dissolve as denoising begins
      drawSequence(scribbles, s, 0.06, 0.2);
      const scribbleOut = 1 - smooth(seg(s, 0.24, 0.34));
      for (const sc of scribbles) sc.style.opacity = scribbleOut;

      // noise -> structure crossfade
      for (let i = 0; i < steps.length; i++) {
        const [a, b, c, d] = FADE[i];
        steps[i].style.opacity = (smooth(seg(s, a, b)) * (1 - smooth(seg(s, c, d)))).toFixed(3);
      }

      const stageIndex = s < 0.3 ? 0 : s < 0.48 ? 1 : s < 0.64 ? 2 : 3;
      stages.forEach((stage, i) => stage.classList.toggle('is-active', i === stageIndex));
      if (conditioning) {
        const showInputs = smooth(seg(s, 0.24, 0.38)) * (1 - smooth(seg(s, 0.68, 0.82)));
        conditioning.style.opacity = showInputs.toFixed(3);
      }

      // contour frame draws late, then settles to 25%
      if (frame) {
        setDraw(frame, seg(s, 0.72, 0.86));
        frame.style.opacity = String(1 - 0.75 * smooth(seg(s, 0.88, 0.96)));
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
