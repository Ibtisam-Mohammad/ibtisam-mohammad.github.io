// Verify the hero black-hole integration: renders on desktop, adds no long tasks,
// reacts to the cursor, absent on mobile, static-but-present under reduced motion.
import puppeteer from 'puppeteer-core';

const OUT = 'C:\\Users\\ibtis\\AppData\\Local\\Temp\\claude\\i--AI-website\\1954000c-6840-487e-a57c-7c5e68d3e198\\scratchpad';
const CHROME = process.env.CHROME_PATH || `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
const out = {};

// ---- desktop -----------------------------------------------------------------
{
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.evaluateOnNewDocument(() => {
    window.__longTasks = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__longTasks.push(Math.round(e.duration));
    }).observe({ type: 'longtask', buffered: true });
  });
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:4321/', { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-blackhole].is-ready', { timeout: 15000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 1400));

  out.desktop = await page.evaluate(() => ({
    ready: document.querySelector('[data-blackhole]')?.classList.contains('is-ready') ?? false,
    longTasks: window.__longTasks,
    finishMs: Math.round(performance.getEntriesByName('bh-finish')[0]?.duration ?? -1),
    artDisplay: getComputedStyle(document.querySelector('.hero-art')).display,
  }));
  await page.screenshot({ path: `${OUT}\\site-hero-bh.png`, clip: { x: 0, y: 0, width: 1440, height: 900 } });

  // cursor over the disk: lens + accretion, and hero buttons must stay clickable
  await page.mouse.move(1020, 420);
  for (let i = 0; i < 30; i++) {
    await page.mouse.move(1020 + i, 420 + (i % 7));
    await new Promise((r) => setTimeout(r, 40));
  }
  await page.screenshot({ path: `${OUT}\\site-hero-bh-cursor.png`, clip: { x: 0, y: 0, width: 1440, height: 900 } });
  out.desktop.buttonsClickable = await page.evaluate(() => {
    const btn = document.querySelector('.actions .btn');
    const r = btn.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return btn.contains(hit) || hit === btn;
  });
  out.desktop.errs = errs;
  await page.close();
}

// ---- mobile: art absent, module never boots ------------------------------------
{
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:4321/', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 2500));
  out.mobile = await page.evaluate(() => ({
    artDisplay: getComputedStyle(document.querySelector('.hero-art')).display,
    ready: document.querySelector('[data-blackhole]')?.classList.contains('is-ready') ?? false,
    mediaNarrow: matchMedia('(max-width: 1023px)').matches,
    sheets: [...document.styleSheets].length,
  }));
  out.mobile.errs = errs;
  await page.close();
}

// ---- reduced motion: static frame still renders ---------------------------------
{
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:4321/', { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-blackhole].is-ready', { timeout: 15000 }).catch(() => {});
  out.reducedMotion = await page.evaluate(() => ({
    animClass: document.documentElement.classList.contains('anim'),
    ready: document.querySelector('[data-blackhole]')?.classList.contains('is-ready') ?? false,
  }));
  out.reducedMotion.errs = errs;
  await page.close();
}

console.log(JSON.stringify(out, null, 1));
await browser.close();
