// One-off: booking CTA renders correctly and does not crowd the hero / contact rows.
import puppeteer from 'puppeteer-core';

const OUT = 'C:\\Users\\ibtis\\AppData\\Local\\Temp\\claude\\i--AI-website\\1954000c-6840-487e-a57c-7c5e68d3e198\\scratchpad';
const CHROME = process.env.CHROME_PATH || `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.setViewport({ width: 1440, height: 900 });
await page.goto('http://localhost:4321/', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 900));

const shot = async (sel, name, pad = 24) => {
  // scroll first, let the scroll-driven engine + sticky hero settle, THEN measure:
  // a rect read in the same frame as the scroll is stale by the time we capture.
  const found = await page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return false;
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    return true;
  }, sel);
  if (!found) return `MISSING ${sel}`;
  await new Promise((r) => setTimeout(r, 900));
  // screenshot `clip` is in PAGE coordinates; getBoundingClientRect is viewport-relative
  const box = await page.evaluate((s, p) => {
    const r = document.querySelector(s).getBoundingClientRect();
    return {
      x: Math.max(0, r.x + scrollX - p),
      y: Math.max(0, r.y + scrollY - p),
      width: r.width + p * 2,
      height: r.height + p * 2,
    };
  }, sel, pad);
  await page.screenshot({ path: `${OUT}\\${name}.png`, clip: box });
  return 'ok';
};

const rows = await page.evaluate(() => {
  const read = (sel) => {
    const wrap = document.querySelector(sel);
    if (!wrap) return null;
    const btns = [...wrap.querySelectorAll('.btn')].map((b) => ({ text: b.textContent.trim(), cls: b.className }));
    // wrapped onto more than one line?
    const tops = new Set(btns.map((_, i) => Math.round(wrap.querySelectorAll('.btn')[i].getBoundingClientRect().top)));
    return { btns, lines: tops.size };
  };
  return { hero: read('.actions'), cta: read('.cs-cta-actions'), contact: read('.contact-actions') };
});

const shots = {
  hero: await shot('.actions', 'book-hero'),
  cta: await shot('.cs-cta', 'book-cta'),
  contact: await shot('.contact-actions', 'book-contact', 30),
};
console.log(JSON.stringify({ errs, rows, shots }, null, 1));
await browser.close();
