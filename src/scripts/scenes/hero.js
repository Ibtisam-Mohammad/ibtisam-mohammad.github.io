// Hero scene — SIGNATURE 1 of 4 (plan.md §10.1).
// Choreography (s local): axes .08-.28 -> sine resolving into the underline .28-.66
// -> cobalt dot .66-.76. Turtle rides the sine span pen-down. Rewinds with scroll.

import { addScene, preparePaths, setDraw, seg, smooth } from '../engine.js';
import { registerWaypoints } from '../turtle.js';

export function initHeroScene() {
  const el = document.getElementById('hero');
  const svg = el && el.querySelector('.hero-scene');
  if (!svg) return;

  const axes = [...svg.querySelectorAll('[data-part="axis"]')];
  const sine = svg.querySelector('[data-part="sine"]');
  const dot = svg.querySelector('[data-part="dot"]');
  preparePaths(svg);

  // turtle: pen drops at the origin, rides the sine to its resolution, exits pen-up.
  // The hero content is PINNED (sticky): waypoints descend through document space at
  // scroll speed (y = span*t + viewport offset) with `vy` holding the turtle at the
  // drawing's viewport height — so it appears to glide along the pinned sine.
  registerWaypoints('hero', (rect) => {
    const vh = window.innerHeight;
    const span = Math.max(rect.height - vh, 1); // scroll distance the pin holds
    const r = svg.getBoundingClientRect();
    // viewport y of the sine line while pinned: current position, corrected if we
    // measured after the pin released (sticky content scrolls normally past `span`).
    // The axis/underline sits at y=18 of the 120-unit viewBox: 15% of svg height.
    const lineVY = r.top + r.height * 0.15 + Math.max(0, window.scrollY - span);
    const u = (fx) => r.left + r.width * fx;
    // document y that renders at lineVY when scrollY = span * t
    const at = (t) => span * t + lineVY;
    return [
      { x: u(0.014), y: at(0.3), vy: lineVY, pen: 'down', visible: true },
      { x: u(0.3), y: at(0.48), vy: lineVY, pen: 'down', visible: true },
      { x: u(0.58), y: at(0.68), vy: lineVY, pen: 'up', visible: false },
      // glide back to the left lane before the section ends, so the visible trail
      // exits cleanly instead of kinking across the next section's margin drawings
      { x: r.left - 30, y: at(0.88), pen: 'up', visible: false },
    ];
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
      setDraw(axes[0], seg(s, 0.08, 0.2));
      setDraw(axes[1], seg(s, 0.16, 0.28));
      setDraw(sine, seg(s, 0.28, 0.66));
      const d = smooth(seg(s, 0.66, 0.76));
      dot.style.opacity = d;
      dot.style.transform = `scale(${0.4 + 0.6 * d})`;
    },
  });
}
