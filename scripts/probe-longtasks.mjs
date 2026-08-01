// Minimal: long tasks during load at 1440x900, nothing else.
import puppeteer from 'puppeteer-core';
const CHROME = process.env.CHROME_PATH || `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
const page = await browser.newPage();
await page.evaluateOnNewDocument(() => {
  window.__longTasks = [];
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) window.__longTasks.push(Math.round(e.duration));
  }).observe({ type: 'longtask', buffered: true });
});
await page.setViewport({ width: 1440, height: 900 });
await page.goto('http://localhost:4321/', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 3500));
console.log(JSON.stringify(await page.evaluate(() => window.__longTasks)));
await browser.close();
