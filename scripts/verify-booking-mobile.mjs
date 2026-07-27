// The hero is a sticky pin sized to the viewport; a 4th action button is exactly
// the kind of addition that overflows it on a small phone. Check, don't assume.
import puppeteer from 'puppeteer-core';

const OUT = 'C:\\Users\\ibtis\\AppData\\Local\\Temp\\claude\\i--AI-website\\1954000c-6840-487e-a57c-7c5e68d3e198\\scratchpad';
const CHROME = process.env.CHROME_PATH || `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await page.goto('http://localhost:4321/', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 900));

const m = await page.evaluate(() => {
  const pin = document.querySelector('.hero-pin');
  const actions = document.querySelector('.actions');
  const a = actions.getBoundingClientRect();
  return {
    actionsBottom: Math.round(a.bottom),
    viewportH: innerHeight,
    overflowsViewport: a.bottom > innerHeight,
    actionLines: new Set([...actions.querySelectorAll('.btn')].map((b) => Math.round(b.getBoundingClientRect().top))).size,
    pinHeight: Math.round(pin.getBoundingClientRect().height),
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
  };
});
await page.screenshot({ path: `${OUT}\\book-hero-mobile.png` });
console.log(JSON.stringify(m, null, 1));
await browser.close();
