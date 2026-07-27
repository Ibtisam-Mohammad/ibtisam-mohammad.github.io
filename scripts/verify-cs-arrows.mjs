// The split shaft/head must still produce complete arrows: heads present, opaque when
// their shaft is done, and hidden before it starts.
import puppeteer from 'puppeteer-core';

const OUT = 'C:\\Users\\ibtis\\AppData\\Local\\Temp\\claude\\i--AI-website\\1954000c-6840-487e-a57c-7c5e68d3e198\\scratchpad';
const CHROME = process.env.CHROME_PATH || `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.setViewport({ width: 1440, height: 900 });
await page.goto('http://localhost:4321/', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 900));

const shape = await page.evaluate(() => ({
  svgs: document.querySelectorAll('.cs-arrows').length,
  perSvg: [...document.querySelectorAll('.cs-arrows')].map((s) => ({
    shafts: s.querySelectorAll('path[data-draw]').length,
    heads: s.querySelectorAll('path:not([data-draw])').length,
  })),
}));

// fully settled: scroll past the cards, heads must be opaque and shafts complete
await page.evaluate(() => {
  const rows = document.querySelectorAll('.cs-card .cs-rows')[0];
  window.scrollTo({ top: rows.getBoundingClientRect().top + scrollY - 100, behavior: 'instant' });
});
await new Promise((r) => setTimeout(r, 800));
const settled = await page.evaluate(() => {
  const svg = document.querySelectorAll('.cs-arrows')[0];
  return {
    shaftOffsets: [...svg.querySelectorAll('path[data-draw]')].map((p) => Math.round(parseFloat(p.style.strokeDashoffset))),
    headOpacity: [...svg.querySelectorAll('path:not([data-draw])')].map((p) => Number(getComputedStyle(p).opacity).toFixed(2)),
  };
});

const box = await page.evaluate(() => {
  const r = document.querySelectorAll('.cs-card .cs-rows')[0].getBoundingClientRect();
  return { x: r.x + scrollX - 12, y: r.y + scrollY - 12, width: r.width + 24, height: r.height + 24 };
});
await page.screenshot({ path: `${OUT}\\cs-arrows-settled.png`, clip: box });
console.log(JSON.stringify({ errs, shape, settled }, null, 1));
await browser.close();
