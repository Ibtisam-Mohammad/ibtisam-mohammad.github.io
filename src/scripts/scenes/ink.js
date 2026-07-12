// Content arrives as whole readable blocks. The turtle supplies the detailed drawing;
// prose and headings should never require a visitor to wait for word-by-word ink.

import { addScene, smooth } from '../engine.js';

const BLOCK_SELECTOR = [
  '.hero h1',
  '.hero .thesis',
  '.hero .roles',
  '.section-head',
  '.prose > p',
  '.card',
  'figure',
  '.group',
  '.note',
  '.stat',
  '.stat-note',
  '.actions',
  '.contact-links',
  '.location',
].join(',');

export function initInkSettle() {
  const main = document.getElementById('main');
  if (!main) return;
  const all = [...main.querySelectorAll(BLOCK_SELECTOR)];
  const blocks = all.filter((element) => !all.some((other) => other !== element && other.contains(element)));

  for (const element of blocks) {
    const textFirst = element.matches('.section-head, .prose > p');
    addScene({
      el: element,
      start: 0,
      end: 1,
      _last: -1,
      measure(rect, vh) {
        this.start = rect.top - vh * 0.98;
        this.end = rect.top - vh * 0.76;
      },
      update(s) {
        if (s === this._last) return;
        this._last = s;
        const t = smooth(s);
        const floor = textFirst ? 0.72 : 0.5;
        element.style.opacity = t >= 1 ? '' : (floor + (1 - floor) * t).toFixed(3);
        element.style.transform = t >= 1 ? '' : `translateY(${((1 - t) * 5).toFixed(2)}px)`;
      },
    });
  }
}
