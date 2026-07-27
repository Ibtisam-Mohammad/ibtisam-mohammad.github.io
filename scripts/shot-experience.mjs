import puppeteer from 'puppeteer-core';
const OUT = 'C:\\Users\\ibtis\\AppData\\Local\\Temp\\claude\\i--AI-website\\1954000c-6840-487e-a57c-7c5e68d3e198\\scratchpad';
const CHROME = process.env.CHROME_PATH || `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
const page = await browser.newPage();
await page.setViewport({ width: 1800, height: 950 });
await page.goto('http://localhost:4321/', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 900));
await page.evaluate(() => document.querySelector('.experience-list').scrollIntoView({ block: 'center', behavior: 'instant' }));
await new Promise((r) => setTimeout(r, 900));
const box = await page.evaluate(() => {
  const r = document.querySelector('.experience-list').getBoundingClientRect();
  return { x: r.x + scrollX - 30, y: r.y + scrollY - 30, width: r.width + 60, height: r.height + 60 };
});
await page.screenshot({ path: `${OUT}\\experience-fixed.png`, clip: box });
await browser.close();
