// One-off verification of the biography-correction pass.
import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME_PATH || `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.setViewport({ width: 1440, height: 900 });
await page.goto('http://localhost:4321/', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 800));

const checks = await page.evaluate(() => ({
  worksFor: document.querySelector('script[type="application/ld+json"]').textContent.match(/worksFor.{0,60}/)[0],
  heroProof: document.querySelector('.hero-proof').textContent.trim().replace(/\s+/g, ' '),
  heroAvail: document.querySelector('.hero-avail').textContent.trim().replace(/\s+/g, ' '),
  expEntries: [...document.querySelectorAll('.experience-list li strong')].map((e) => e.textContent),
  expDates: [...document.querySelectorAll('.experience-list li .mono')].map((e) => e.textContent),
  foundationsP1: document.querySelector('#foundations .prose p').textContent.trim().replace(/\s+/g, ' ').slice(0, 80),
  contactAvail: document.querySelector('.avail-note').textContent.trim().replace(/\s+/g, ' ').slice(-90),
}));
console.log(JSON.stringify({ errs, checks }, null, 1));
await page.screenshot({
  path: 'C:\\Users\\ibtis\\AppData\\Local\\Temp\\claude\\i--AI-website\\1954000c-6840-487e-a57c-7c5e68d3e198\\scratchpad\\hero-quiet.png',
});
await browser.close();
