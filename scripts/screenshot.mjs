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

// scroll targets across every scene, mid-draw where possible
async function targets(page, mobile) {
  return page.evaluate((isMobile) => {
    const vh = window.innerHeight;
    const topOf = (sel) => {
      const el = document.querySelector(sel);
      return el ? el.getBoundingClientRect().top + window.scrollY : 0;
    };
    const gen = document.getElementById('generative').getBoundingClientRect();
    const hero = document.getElementById('hero').getBoundingClientRect();
    const gTop = gen.top + window.scrollY;
    const gBottom = gen.bottom + window.scrollY;
    const gStart = gTop - vh * 0.8;
    const gEnd = gBottom - vh * 0.6;
    const at = (s) => Math.round(gStart + s * (gEnd - gStart));
    const endY = document.documentElement.scrollHeight - vh;
    const all = {
      'hero-mid': Math.round(Math.max(hero.height - vh, 1) * 0.48),
      'fnd-mid': Math.round(topOf('.fnd-orbit') - vh * 0.5),
      'ml-mid': Math.round(topOf('.ml-scene') - vh * 0.5),
      'vision-mid': Math.round(topOf('.cv-figure') - vh * 0.62),
      'vision-late': Math.round(topOf('.cv-figure') - vh * 0.3),
      'genai-mid': at(0.45),
      'mlops-mid': Math.round(topOf('.pipeline-h') - vh * 0.55),
      'work-lead': Math.round(topOf('.cs-rows') - vh * 0.48),
      'notes-mid': Math.round(topOf('.notes-graph') - vh * 0.55),
      'sig-mid': Math.round(topOf('.signature') - vh * 0.52),
      'page-end': endY,
    };
    if (isMobile) {
      return { 'hero-mid': all['hero-mid'], 'vision-mid': all['vision-mid'], 'genai-mid': all['genai-mid'], 'page-end': all['page-end'] };
    }
    return all;
  }, mobile);
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
  const pos = await targets(page, vp.name === 'mobile');
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
