// Capture v2: idle field at a few inclinations, plus the cursor lens engaged.
import puppeteer from 'puppeteer-core';

const OUT = 'i:\\AI\\website\\prototypes';
const CHROME = process.env.CHROME_PATH || `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.setViewport({ width: 1500, height: 900, deviceScaleFactor: 1 });
await page.goto('file:///i:/AI/website/prototypes/blackhole.html', { waitUntil: 'load' });
await page.waitForFunction('window.__ready === true', { timeout: 20000 });
await new Promise((r) => setTimeout(r, 1800));

const shot = async (name) => { const el = await page.$('#c'); await el.screenshot({ path: `${OUT}\\${name}.png` }); };
const hud = () => page.evaluate(() => document.getElementById('hud').textContent);
const results = {};

for (const inc of [78, 62, 30]) {
  await page.evaluate((v) => {
    const el = document.getElementById('inc'); el.value = String(v);
    el.dispatchEvent(new Event('input'));
  }, inc);
  await new Promise((r) => setTimeout(r, 1500));
  results[`inc${inc}`] = await hud();
  await shot(`v2-inc${inc}`);
}

// engage the cursor lens near the left flank of the disk and let it settle
await page.evaluate((v) => {
  const el = document.getElementById('inc'); el.value = String(v);
  el.dispatchEvent(new Event('input'));
}, 78);
await new Promise((r) => setTimeout(r, 800));
const box = await page.evaluate(() => {
  const r = document.getElementById('c').getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
for (let i = 0; i < 26; i++) {
  await page.mouse.move(box.x + box.w * (0.32 + i * 0.0012), box.y + box.h * 0.42);
  await new Promise((r) => setTimeout(r, 40));
}
await new Promise((r) => setTimeout(r, 900));
results.cursorLens = await hud();
await shot('v2-cursor');

console.log(JSON.stringify({ errs, results }, null, 1));
await browser.close();
