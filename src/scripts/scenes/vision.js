// Computer vision scene — SIGNATURE 2 of 4 (plan.md §10.4, §8 variant 1).
// Choreography (s local): box 1 draws → its chip stamps → the image appears INSIDE
// the box and expands to fill the frame → box 2 + chip → the segmentation tint
// scrubs 0 → 30% → 0. The pose skeleton draws over the second image in parallel
// (desktop; mobile hides it via CSS). Finished states are the markup defaults.

import { addScene, preparePaths, setDraw, drawSequence, popSequence, seg, smooth } from '../engine.js';
import { registerWaypoints } from '../turtle.js';

export function initVisionScene() {
  const el = document.getElementById('vision');
  if (!el) return;
  const fig = el.querySelector('.cv-figure');
  if (!fig) return;

  const img = fig.querySelector('.cv-img');
  const segEl = fig.querySelector('.cv-seg');
  const boxes = [...fig.querySelectorAll('.cv-box')];
  const chips = [...fig.querySelectorAll('.cv-chip')];
  preparePaths(fig);

  // starting inset (the lead box) parsed from the build-time custom property
  const clipStr = getComputedStyle(fig).getPropertyValue('--clip1');
  const inset = (clipStr.match(/[\d.]+/g) || []).map(Number); // [t, r, b, l]

  const pose = el.querySelector('.cv-pose');
  const poseHead = pose && pose.querySelector('.pose-head');
  const poseBones = pose ? [...pose.querySelectorAll('.pose-bone')] : [];
  const poseJoints = pose ? [...pose.querySelectorAll('.pose-joint')] : [];
  if (pose) preparePaths(pose);

  // Follow two sides of the lead detection box while the overlay is drawn. Keeping
  // document y monotonic preserves a natural scroll-to-arc mapping on every viewport.
  registerWaypoints('vision', (_section, { vh }) => {
    const r = fig.getBoundingClientRect();
    const top = r.top + window.scrollY;
    const at = (x, y) => ({ x: r.left + (x / 1280) * r.width, y: top + (y / 853) * r.height });
    const points = [
      { ...at(596, 352), pen: 'down', visible: true },
      { ...at(596, 524), pen: 'down', visible: true },
      { ...at(810, 530), pen: 'down', visible: true },
      { x: r.left - 20, y: top + r.height + 20, pen: 'up', visible: false },
    ];
    const start = top - vh * 0.95;
    const end = top - vh * 0.25;
    return points.map((point, index) => ({
      ...point,
      scrollAnchor: start + (end - start) * (index / (points.length - 1)),
    }));
  });

  addScene({
    el: fig,
    start: 0,
    end: 1,
    _last: -1,
    measure(rect, vh) {
      this.start = rect.top - vh * 0.95;
      this.end = rect.top - vh * 0.25;
    },
    update(s) {
      if (s === this._last) return;
      this._last = s;

      // box 1 draws on blank paper, chip stamps
      if (boxes[0]) setDraw(boxes[0], seg(s, 0.04, 0.18));
      if (chips[0]) chips[0].style.opacity = smooth(seg(s, 0.18, 0.24)).toFixed(3);

      // the image appears inside the box, then the crop releases to the full frame
      if (img && inset.length === 4) {
        img.style.opacity = smooth(seg(s, 0.18, 0.28)).toFixed(3);
        const k = 1 - smooth(seg(s, 0.3, 0.52));
        img.style.clipPath =
          k <= 0
            ? ''
            : `inset(${(inset[0] * k).toFixed(2)}% ${(inset[1] * k).toFixed(2)}% ${(inset[2] * k).toFixed(2)}% ${(inset[3] * k).toFixed(2)}%)`;
      }

      // second detection
      if (boxes[1]) setDraw(boxes[1], seg(s, 0.52, 0.64));
      if (chips[1]) chips[1].style.opacity = smooth(seg(s, 0.64, 0.7)).toFixed(3);

      // segmentation tint: 0 -> 30% -> 0, scrubbed
      if (segEl) {
        const o = 0.3 * smooth(seg(s, 0.7, 0.8)) * (1 - smooth(seg(s, 0.86, 0.97)));
        segEl.style.opacity = o.toFixed(3);
      }

      // pose skeleton alongside (its own finished state if the figure is hidden)
      if (poseHead) setDraw(poseHead, seg(s, 0.45, 0.55));
      drawSequence(poseBones, s, 0.5, 0.85);
      popSequence(poseJoints, s, 0.78, 1);
    },
  });
}
