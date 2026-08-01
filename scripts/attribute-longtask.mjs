// Attribute the boot long task using the site's own performance marks.
import puppeteer from 'puppeteer-core';
const CHROME = process.env.CHROME_PATH || `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
const page = await browser.newPage();
await page.evaluateOnNewDocument(() => {
  window.__lt = [];
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) window.__lt.push({ start: Math.round(e.startTime), dur: Math.round(e.duration) });
  }).observe({ type: 'longtask', buffered: true });
});
await page.setViewport({ width: 1440, height: 900 });
await page.goto('http://localhost:4321/', { waitUntil: 'networkidle0' });
await page.waitForSelector('[data-blackhole].is-ready', { timeout: 15000 }).catch(() => {});
await new Promise((r) => setTimeout(r, 1000));
console.log(JSON.stringify(await page.evaluate(() => ({
  longTasks: window.__lt,
  measures: performance.getEntriesByType('measure').map((m) => ({
    name: m.name, start: Math.round(m.startTime), dur: Math.round(m.duration),
  })),
})), null, 1));
await browser.close();
