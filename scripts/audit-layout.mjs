// Measure the things that look wrong in a 1800px screenshot: hero dead zone,
// horizontal whitespace balance, experience-row ledger alignment, vine wander.
import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME_PATH || `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
const page = await browser.newPage();
await page.setViewport({ width: 1800, height: 950 });
await page.goto('http://localhost:4321/', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 1000));

// --- hero at scroll 0: is there a blank band between the name and the thesis?
const hero = await page.evaluate(() => {
  const r = (s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; };
  const h1 = r('.hero-name'), scene = r('.hero-scene'), thesis = r('.thesis');
  const paths = [...document.querySelectorAll('.hero-scene [data-draw]')].map((p) => {
    const cs = getComputedStyle(p);
    return { part: p.dataset.part, dash: cs.strokeDasharray, offset: cs.strokeDashoffset, opacity: cs.opacity };
  });
  return {
    scrollY,
    h1Bottom: Math.round(h1.bottom),
    sceneTop: Math.round(scene.top), sceneH: Math.round(scene.height),
    thesisTop: Math.round(thesis.top),
    gapNameToThesis: Math.round(thesis.top - h1.bottom),
    paths,
  };
});

// --- horizontal balance: how much of a 1800px page is used?
const width = await page.evaluate(() => {
  const c = document.querySelector('.hero .container').getBoundingClientRect();
  const t = document.querySelector('.thesis').getBoundingClientRect();
  return {
    viewport: innerWidth,
    containerW: Math.round(c.width), containerLeft: Math.round(c.left), containerRight: Math.round(innerWidth - c.right),
    textW: Math.round(t.width),
    emptyRightOfText: Math.round(innerWidth - t.right),
  };
});

// --- experience rows: does the date sit at the right edge of its rule?
await page.evaluate(() => document.querySelector('#ml').scrollIntoView({ block: 'start', behavior: 'instant' }));
await new Promise((r) => setTimeout(r, 800));
const exp = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.experience-list li')];
  if (!rows.length) return { note: 'no rows matched' };
  return rows.slice(0, 3).map((row) => {
    const rr = row.getBoundingClientRect();          // the ruled row (border-bottom)
    const head = row.querySelector('p:first-child'); // flex: title <-> date
    const hr = head.getBoundingClientRect();
    const dr = head.querySelector('.mono').getBoundingClientRect();
    return {
      ruleRight: Math.round(rr.right),
      headRight: Math.round(hr.right),
      dateRight: Math.round(dr.right),
      dateShortOfRule: Math.round(rr.right - dr.right), // 0 = proper ledger alignment
      headMaxWidth: getComputedStyle(head).maxWidth,
    };
  });
});

// --- vine: how far does it actually wander sideways?
const vine = await page.evaluate(() => {
  const svg = document.querySelector('[data-vine] svg, .vine-layer svg, svg.vine');
  if (!svg) return { note: 'no vine svg' };
  const paths = [...svg.querySelectorAll('path')];
  let minX = Infinity, maxX = -Infinity;
  for (const p of paths.slice(0, 400)) {
    const b = p.getBBox();
    minX = Math.min(minX, b.x); maxX = Math.max(maxX, b.x + b.width);
  }
  return { pathCount: paths.length, spanX: Math.round(maxX - minX), svgW: Math.round(svg.getBoundingClientRect().width) };
});

console.log(JSON.stringify({ hero, width, exp, vine }, null, 1));
await browser.close();
