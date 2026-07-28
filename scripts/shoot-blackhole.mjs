// Screenshot + measure the lensed-disk prototype at several inclinations, and
// measure the worst case (rebuilding the lens map every frame while sweeping).
import puppeteer from 'puppeteer-core';

const OUT = 'C:\\Users\\ibtis\\AppData\\Local\\Temp\\claude\\i--AI-website\\1954000c-6840-487e-a57c-7c5e68d3e198\\scratchpad';
const CHROME = process.env.CHROME_PATH || `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.setViewport({ width: 920, height: 820, deviceScaleFactor: 1 });
await page.goto(`file:///${OUT.replace(/\\/g, '/')}/blackhole.html`, { waitUntil: 'load' });
await page.waitForFunction('window.__ready === true', { timeout: 15000 });
await new Promise((r) => setTimeout(r, 1500));

const results = {};
for (const inc of [80, 72, 55, 25]) {
  await page.evaluate((v) => {
    const el = document.getElementById('inc');
    el.value = String(v);
    el.dispatchEvent(new Event('input'));
  }, inc);
  await new Promise((r) => setTimeout(r, 1400));
  results[`inc${inc}`] = await page.evaluate(() => document.getElementById('hud').textContent);
  const el = await page.$('#c');
  await el.screenshot({ path: `${OUT}\\bh-${inc}.png` });
}

// worst case: rebuild the whole lens map every single frame
await page.evaluate(() => { document.getElementById('sweep').checked = true; });
await new Promise((r) => setTimeout(r, 2600));
results.sweeping = await page.evaluate(() => document.getElementById('hud').textContent);

console.log(JSON.stringify({ errs, results }, null, 1));
await browser.close();
