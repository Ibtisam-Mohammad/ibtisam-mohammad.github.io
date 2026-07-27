// Identify every multi-subpath [data-draw] path by where it lives, so the dash-restart
// hazard can be judged per feature rather than as an anonymous count.
import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME_PATH || `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto('http://localhost:4321/', { waitUntil: 'networkidle0' });
// scroll the whole page so lazily-built scenes (headings, case arrows) exist
await page.evaluate(async () => {
  for (let y = 0; y < document.body.scrollHeight; y += 600) {
    window.scrollTo({ top: y, behavior: 'instant' });
    await new Promise((r) => requestAnimationFrame(r));
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
});
await new Promise((r) => setTimeout(r, 1200));

const groups = await page.evaluate(() => {
  const tally = {};
  for (const p of document.querySelectorAll('[data-draw]')) {
    const subpaths = (p.getAttribute('d') || '').match(/[Mm]/g)?.length || 0;
    if (subpaths < 2) continue;
    const svg = p.closest('svg');
    const section = p.closest('section')?.id || p.closest('[id]')?.id || '?';
    const key = `${section} / ${svg?.getAttribute('class') || svg?.id || 'svg'} / ${p.getAttribute('class') || '(no class)'}`;
    tally[key] = tally[key] || { count: 0, maxSubpaths: 0 };
    tally[key].count++;
    tally[key].maxSubpaths = Math.max(tally[key].maxSubpaths, subpaths);
  }
  return tally;
});
console.log(JSON.stringify(groups, null, 1));
await browser.close();
