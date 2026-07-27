// Verify the three UI fixes across widths:
//  1. hero axes visible at scroll 0 (no blank band in the first frame)
//  2. thesis settles to 2 lines
//  4. travel lane stays a bounded distance from the text column, not the gutter mid
import puppeteer from 'puppeteer-core';

const OUT = 'C:\\Users\\ibtis\\AppData\\Local\\Temp\\claude\\i--AI-website\\1954000c-6840-487e-a57c-7c5e68d3e198\\scratchpad';
const CHROME = process.env.CHROME_PATH || `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
const errs = [];
const out = {};

for (const width of [1440, 1800, 2560]) {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errs.push(`${width}: ${e.message}`));
  await page.setViewport({ width, height: 950 });
  await page.goto('http://localhost:4321/', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1100));

  const m = await page.evaluate(() => {
    const rect = (s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; };

    // (1) how much of each axis is actually inked at scroll 0?
    const drawn = [...document.querySelectorAll('.hero-scene [data-draw]')].map((p) => {
      const len = Number(p.dataset.len);
      const off = parseFloat(getComputedStyle(p).strokeDashoffset);
      return { part: p.dataset.part, pctDrawn: Math.round((1 - off / len) * 100) };
    });

    // (2) thesis line count via client rects
    const thesis = document.querySelector('.thesis');
    const lines = thesis.getClientRects().length
      || Math.round(thesis.getBoundingClientRect().height / parseFloat(getComputedStyle(thesis).lineHeight));
    const range = document.createRange();
    range.selectNodeContents(thesis);
    const lineCount = new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;

    // (4) where does the turtle guide path sit relative to the text column?
    const guide = document.getElementById('turtle-guide');
    const content = document.querySelector('.container').getBoundingClientRect();
    let laneGap = null, guideMaxX = null;
    if (guide) {
      const b = guide.getBBox(); // viewBox is 0 0 docW docH, so units are px
      guideMaxX = Math.round(b.x + b.width);
      laneGap = Math.round(guideMaxX - content.right);
    }
    // SVG restarts the dash pattern at every subpath, so any [data-draw] path with
    // more than one M inks its later subpaths instantly instead of drawing in order.
    const dashHazards = [...document.querySelectorAll('[data-draw]')]
      .map((p) => ({
        subpaths: (p.getAttribute('d') || '').match(/[Mm]/g)?.length || 0,
        cls: p.getAttribute('class') || p.dataset.part || p.tagName,
      }))
      .filter((h) => h.subpaths > 1);

    return {
      scrollY,
      axes: drawn,
      strayTicks: [...document.querySelectorAll('.hero-scene [data-part="ticks"]')]
        .map((t) => Number(getComputedStyle(t).opacity).toFixed(2)),
      dashHazards,
      thesisWidth: Math.round(thesis.getBoundingClientRect().width),
      thesisLines: lineCount || lines,
      contentRight: Math.round(content.right),
      guideMaxX,
      laneGapPastText: laneGap,
      viewportRight: innerWidth,
    };
  });
  out[width] = m;
  if (width === 1800) {
    await page.screenshot({ path: `${OUT}\\hero-fixed-1800.png`, clip: { x: 0, y: 0, width: 1800, height: 950 } });
  }
  await page.close();
}
console.log(JSON.stringify({ errs, out }, null, 1));
await browser.close();
