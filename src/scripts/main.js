// Finished states live in markup. Motion-capable clients layer the scroll story on
// top; reduced-motion users keep the complete static document.

import { start, addGlobal, onRemeasure } from './engine.js';
import { initTurtle, updateTurtle, remeasure as remeasureTurtle, guideInfo } from './turtle.js';
import { initVine, measureVine, updateVine } from './vine.js';
import { initHeroScene } from './scenes/hero.js';
import { initGenAiScene } from './scenes/genai.js';
import { initInkSettle } from './scenes/ink.js';
import { initHeadingReveals } from './scenes/headings.js';
import { initVisionScene } from './scenes/vision.js';
import { initSectionScenes, initNotesInteractive } from './scenes/sections.js';

const anim = document.documentElement.classList.contains('anim');

// This filtering interaction is functional and remains available with reduced motion.
initNotesInteractive();

if (anim) {
  // Scenes register their local turtle choreography before the document path is measured.
  performance.mark('b0');
  initHeroScene();
  initGenAiScene();
  initVisionScene();
  initSectionScenes();
  performance.mark('b1');
  initInkSettle();
  performance.mark('b2');
  initHeadingReveals();
  performance.mark('b3');
  const hasTurtle = initTurtle();
  performance.mark('b4');

  const hairline = document.getElementById('progress-hairline');
  const sections = ['hero', 'foundations', 'ml', 'vision', 'generative', 'mlops', 'work', 'notes', 'contact']
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  const hasVine = hasTurtle && initVine();

  // One idle timer gives the plotter pen a quiet tap after scrolling stops.
  const turtleInner = document.getElementById('turtle-inner');
  let idleTimer = 0;
  const armIdle = () => {
    if (!turtleInner) return;
    clearTimeout(idleTimer);
    turtleInner.classList.remove('idle');
    idleTimer = setTimeout(() => turtleInner.classList.add('idle'), 2400);
  };
  armIdle();

  addGlobal((y, p, vh, dt, changed) => {
    if (changed) armIdle();
    let keepAlive = false;

    if (hasTurtle) {
      const turtle = updateTurtle(y, dt);
      if (turtle) {
        keepAlive = turtle.moving;
        if (hasVine) updateVine(turtle.len);
      }
    }

    if (hairline && changed) {
      hairline.style.transform = `scaleX(${p.toFixed(4)})`;
      const mid = y + vh * 0.4;
      for (let i = sections.length - 1; i >= 0; i--) {
        const top = sections[i].getBoundingClientRect().top + y;
        if (mid < top) continue;
        const accent = getComputedStyle(sections[i]).getPropertyValue('--accent');
        if (accent) hairline.style.background = accent;
        break;
      }
    }
    return keepAlive;
  });

  if (hasTurtle) {
    onRemeasure(() => {
      performance.mark('v0');
      remeasureTurtle();
      performance.mark('v1');
      if (hasVine) measureVine(guideInfo());
      performance.mark('v2');
    });
  }

  start();
  performance.mark('b5');
  for (const [name, a, b] of [
    ['scenes', 'b0', 'b1'],
    ['ink', 'b1', 'b2'],
    ['headings', 'b2', 'b3'],
    ['turtle-init', 'b3', 'b4'],
    ['start+measure', 'b4', 'b5'],
    ['turtle-measure', 'v0', 'v1'],
    ['vine-measure', 'v1', 'v2'],
  ]) {
    try { performance.measure(name, a, b); } catch {}
  }
}
