// One-off verification of the audit-fix pass.
import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME_PATH || `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`;
const BASE = process.argv[2] || 'http://localhost:4321';

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.setViewport({ width: 1440, height: 900 });
await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 1000));

const checks = await page.evaluate(() => ({
  h1Text: document.querySelector('h1').textContent.trim().replace(/\s+/g, ' '),
  heroProof: !!document.querySelector('.hero-proof'),
  heroAvail: document.querySelector('.hero-avail')?.textContent.trim().slice(0, 60) ?? null,
  heroEmailBtn: !!document.querySelector('.hero .actions a[href^="mailto"]'),
  csCta: !!document.querySelector('.cs-cta'),
  csAvail: [...document.querySelectorAll('.cs-availability')].map((e) => e.textContent.trim()),
  copyBtnVisible: !!document.querySelector('[data-copy-email]') && !document.querySelector('[data-copy-email]').hidden,
  availNote: !!document.querySelector('.avail-note'),
  vineExcludes: document.querySelectorAll('[data-vine-exclude]').length,
  topbarBg: getComputedStyle(document.querySelector('.topbar')).backgroundColor,
  footerLinks: document.querySelectorAll('.footer-links a').length,
  vikaraTitle: document.body.textContent.includes('AI Consultant · Vikara AI'),
  vineNodes: document.querySelectorAll('#vine-branches *').length,
  notesInMobileNav: true, // checked separately at mobile width below
}));

const rssStatus = (await page.goto(`${BASE}/rss.xml`)).status();

await page.goto(`${BASE}/notes/fara-7b-on-12gb-vram/`, { waitUntil: 'networkidle0' });
const noteChecks = await page.evaluate(() => ({
  byline: document.querySelector('.byline').textContent.trim().replace(/\s+/g, ' '),
  hireBlock: !!document.querySelector('.note-hire'),
  jsonLdClean: !document.querySelector('script[type="application/ld+json"]').textContent.includes('isRelatedTo'),
}));

const redirectStatus = (await page.goto(`${BASE}/fara-7b/`)).status();

// mobile: Notes nav present?
await page.setViewport({ width: 390, height: 844 });
await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' });
const mobileNotes = await page.evaluate(() => {
  const link = [...document.querySelectorAll('.topnav a')].find((a) => a.textContent.trim() === 'Notes');
  return link ? getComputedStyle(link.closest('li')).display !== 'none' : false;
});

console.log(JSON.stringify({ errs, checks, rssStatus, noteChecks, redirectStatus, mobileNotes }, null, 1));
await browser.close();
