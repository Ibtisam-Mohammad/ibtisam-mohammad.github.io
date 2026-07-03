// Boot (plan.md §4): finished states live in the markup by default; this script
// layers the scroll-driven story on top. Reduced-motion users never get the
// `anim` class, so they keep finished states and simple fades only.

import { start, addGlobal, onRemeasure } from './engine.js';
import { initTurtle, updateTurtle, remeasure as remeasureTurtle, guideInfo } from './turtle.js';
import { initVine, measureVine, updateVine } from './vine.js';
import { initHeroScene } from './scenes/hero.js';
import { initGenAiScene } from './scenes/genai.js';
import { initInkSettle } from './scenes/ink.js';
import { initHeadingReveals } from './scenes/headings.js';

const anim = document.documentElement.classList.contains('anim');

if (anim) {
  // scenes register turtle waypoints, so they init before the turtle measures
  initHeroScene();
  initGenAiScene();
  initInkSettle();
  initHeadingReveals();
  const hasTurtle = initTurtle();

  // progress hairline: 1px under the top bar, tinted to the current section's accent
  const hairline = document.getElementById('progress-hairline');
  const sections = ['hero', 'foundations', 'ml', 'vision', 'generative', 'mlops', 'work', 'notes', 'contact']
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  const hasVine = hasTurtle && initVine();

  // idle blink (owner request): the turtle breathes and gives a quick faceless
  // squash-blink after ~2.4s without scrolling. Time-based by definition — the one
  // deliberate exception to §4's no-timers rule; it stops the instant scroll resumes,
  // never runs under reduced motion, and touches nothing but the turtle itself.
  const turtleInner = document.getElementById('turtle-inner');
  let lastMove = performance.now();
  if (turtleInner) {
    setInterval(() => {
      if (performance.now() - lastMove > 2400) turtleInner.classList.add('idle');
    }, 600);
  }

  addGlobal((y, p, vh) => {
    lastMove = performance.now();
    if (turtleInner) turtleInner.classList.remove('idle');
    if (hasTurtle) {
      const len = updateTurtle(y);
      if (hasVine && len != null) updateVine(len);
    }
    if (hairline) {
      hairline.style.transform = `scaleX(${p.toFixed(4)})`;
      const mid = y + vh * 0.4;
      for (let i = sections.length - 1; i >= 0; i--) {
        const top = sections[i].getBoundingClientRect().top + y;
        if (mid >= top) {
          const accent = getComputedStyle(sections[i]).getPropertyValue('--accent');
          if (accent) hairline.style.background = accent;
          break;
        }
      }
    }
  });

  // the engine re-measures on resize and document-height changes (lazy images,
  // font swaps); the turtle rebuilds its guide path, then the vine regrows on it
  if (hasTurtle) {
    onRemeasure(() => {
      remeasureTurtle();
      if (hasVine) {
        const { guide, total } = guideInfo();
        measureVine(guide, total);
      }
    });
  }

  start();
}
