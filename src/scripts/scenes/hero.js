// Hero scene — SIGNATURE 1 of 4 (plan.md §10.1).
// Choreography (s local): axes .08-.28 -> sine resolving into the underline .28-.66
// -> cobalt dot .66-.76. Turtle rides the sine span pen-down. Rewinds with scroll.
//
// The axes carry a head start (negative segment starts, below). Fully rewound, they
// left the first frame — the one a visitor judges in two seconds and the one that
// gets screenshotted — as a ~146px blank band between the name and the thesis, with
// the site's most distinctive feature rendering as nothing. Starting them partway
// means the first paint already reads as a plotted chart with the name underlined,
// and they still finish on exactly the same scroll positions as before. The sine is
// deliberately left at zero: it is the signature, and it should be earned by scrolling.

import { addScene, preparePaths, setDraw, seg, smooth } from '../engine.js';
import { registerWaypoints } from '../turtle.js';

export function initHeroScene() {
  const el = document.getElementById('hero');
  const svg = el && el.querySelector('.hero-scene');
  if (!svg) return;

  const axes = [...svg.querySelectorAll('[data-part="axis"]')];
  const ticks = svg.querySelector('[data-part="ticks"]');
  const sine = svg.querySelector('[data-part="sine"]');
  const dot = svg.querySelector('[data-part="dot"]');
  const TICK_OPACITY = 0.45; // matches .axis in Hero.astro; inline styles override it
  preparePaths(svg);

  // Sample the rendered path itself so the sticky turtle follows every crest and
  // trough during the same scroll interval that reveals the sine stroke.
  registerWaypoints('hero', (rect) => {
    const vh = window.innerHeight;
    const span = Math.max(rect.height - vh, 1);
    const r = svg.getBoundingClientRect();
    const matrix = sine.getScreenCTM();
    const length = sine.getTotalLength();
    const releaseCorrection = Math.max(0, window.scrollY - span);
    const sampleCount = 28;
    const points = [];

    for (let index = 0; index <= sampleCount; index++) {
      const fraction = index / sampleCount;
      const local = sine.getPointAtLength(length * fraction);
      const screen = matrix
        ? new DOMPoint(local.x, local.y).matrixTransform(matrix)
        : {
            x: r.left + r.width * local.x / 1000,
            y: r.top + r.height * local.y / 120,
          };
      const viewportY = screen.y + releaseCorrection;
      const scrollAnchor = span * (0.28 + 0.38 * fraction);
      points.push({
        x: screen.x,
        y: scrollAnchor + viewportY,
        vy: viewportY,
        scrollAnchor,
        lockAnchor: true,
        pen: index === sampleCount ? 'up' : 'down',
        visible: true,
      });
    }

    points.push({
      x: r.left + r.width * 0.86,
      y: span * 0.88 + points.at(-1).vy,
      pen: 'up',
      visible: true,
    });
    return points;
  });

  addScene({
    el,
    start: 0,
    end: 1,
    measure(rect, vh) {
      this.start = 0;
      // the drawing plays across the pinned span (~75svh of scroll, within §10.1's 120vh)
      this.end = Math.max(rect.height - vh, vh * 0.5);
    },
    update(s) {
      // negative starts = visible at s === 0; ends unchanged
      setDraw(axes[0], seg(s, -0.22, 0.2));  // y-axis, ~52% on load
      setDraw(axes[1], seg(s, -0.2, 0.28));  // x-axis doubles as the name underline, ~42%
      // ticks fade in behind the advancing x-axis rather than dashing (see Hero.astro)
      ticks.style.opacity = String(TICK_OPACITY * smooth(seg(s, 0.06, 0.3)));
      setDraw(sine, seg(s, 0.28, 0.66));
      const d = smooth(seg(s, 0.66, 0.76));
      dot.style.opacity = d;
      dot.style.transform = `scale(${0.4 + 0.6 * d})`;
    },
  });
}
