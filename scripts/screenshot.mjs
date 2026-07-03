// Phase 2 review harness (plan.md §15): screenshots at three scroll positions,
// desktop and mobile, plus no-JS and reduced-motion verification shots.
// Usage: node scripts/screenshot.mjs <outDir> [baseUrl]
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.argv[2] || 'shots';
const BASE = process.argv[3] || 'http://localhost:4321/';
const CHROME = process.env.CHROME_PATH || 'C:\\Users\\ibtis\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1 },
  { name: 'mobile', width: 390, height: 844, deviceScaleFactor: 1.5 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// scroll targets: hero mid-draw, GenAI mid-crossfade (s~.45), GenAI settled (s~.93),
// plus two vine-depth checks (work section, page end)
async function targets(page) {
  return page.evaluate(() => {
    const vh = window.innerHeight;
    const gen = document.getElementById('generative');
    const r = gen.getBoundingClientRect();
    const top = r.top + window.scrollY;
    const bottom = r.bottom + window.scrollY;
    const start = top - vh * 0.8;
    const end = bottom - vh * 0.6;
    const at = (s) => Math.round(start + s * (end - start));
    const work = document.getElementById('work');
    const workY = Math.round(work.getBoundingClientRect().top + window.scrollY - vh * 0.4);
    const endY = document.documentElement.scrollHeight - vh;
    return {
      'hero-mid': Math.round(vh * 0.5),
      'genai-mid': at(0.45),
      'genai-late': at(0.93),
      'work-vine': workY,
      'page-end': endY,
    };
  });
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
});

for (const vp of VIEWPORTS) {
  const page = await browser.newPage();
  await page.setViewport(vp);
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await sleep(400);
  const pos = await targets(page);
  for (const [name, y] of Object.entries(pos)) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await sleep(900); // micro-eases settle; lazy images decode
    await page.screenshot({ path: join(OUT, `${vp.name}-${name}.png`) });
    console.log(`${vp.name}-${name}.png @ scrollY=${y}`);
  }
  await page.close();
}

// no-JS verification: finished states must be fully visible
{
  const page = await browser.newPage();
  await page.setJavaScriptEnabled(false);
  await page.setViewport(VIEWPORTS[0]);
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await page.evaluate; // no-op
  await page.screenshot({ path: join(OUT, 'nojs-top.png') });
  // scroll to generative via CDP-less approach: hash link works without JS
  await page.goto(BASE + '#generative', { waitUntil: 'networkidle0' });
  await sleep(600);
  await page.screenshot({ path: join(OUT, 'nojs-genai.png') });
  console.log('nojs shots done');
  await page.close();
}

// reduced-motion verification: finished states, no scrub
{
  const page = await browser.newPage();
  await page.setViewport(VIEWPORTS[0]);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto(BASE + '#generative', { waitUntil: 'networkidle0' });
  await sleep(600);
  await page.screenshot({ path: join(OUT, 'reduced-genai.png') });
  console.log('reduced-motion shot done');
  await page.close();
}

await browser.close();
console.log('all shots ->', OUT);
