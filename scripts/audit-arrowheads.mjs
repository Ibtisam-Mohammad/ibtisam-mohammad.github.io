// Is the dash-restart hazard actually visible? Sample the 25 Foundations field
// arrows mid-reveal and report shaft progress vs. whether the head is already inked.
import puppeteer from 'puppeteer-core';

const OUT = 'C:\\Users\\ibtis\\AppData\\Local\\Temp\\claude\\i--AI-website\\1954000c-6840-487e-a57c-7c5e68d3e198\\scratchpad';
const CHROME = process.env.CHROME_PATH || `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto('http://localhost:4321/', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 800));

// find a scroll position where the field is partially revealed
const svgTop = await page.evaluate(() => {
  const s = document.querySelector('.fnd-field');
  return s.getBoundingClientRect().top + scrollY;
});

const samples = [];
for (const frac of [0.25, 0.5, 0.75]) {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), svgTop - 900 + 900 * frac);
  await new Promise((r) => setTimeout(r, 450));
  const s = await page.evaluate(() => {
    const arrows = [...document.querySelectorAll('.field-arrow')];
    const partial = arrows.map((p) => {
      const len = Number(p.dataset.len);
      const off = parseFloat(getComputedStyle(p).strokeDashoffset);
      return (1 - off / len);
    });
    // an arrow whose overall progress is >0 but <1 has a fully-inked head already
    const midDraw = partial.filter((t) => t > 0.01 && t < 0.99).length;
    return {
      arrows: arrows.length,
      midDraw,
      avgProgress: Number((partial.reduce((a, b) => a + b, 0) / partial.length).toFixed(2)),
    };
  });
  samples.push({ frac, ...s });
  await page.screenshot({ path: `${OUT}\\field-${Math.round(frac * 100)}.png`, clip: await page.evaluate(() => {
    const r = document.querySelector('.fnd-field').getBoundingClientRect();
    return { x: r.x + scrollX - 10, y: r.y + scrollY - 10, width: r.width + 20, height: r.height + 20 };
  }) });
}
console.log(JSON.stringify(samples, null, 1));
await browser.close();
