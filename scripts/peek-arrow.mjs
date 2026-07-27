import puppeteer from 'puppeteer-core';
const CHROME = process.env.CHROME_PATH || `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto('http://localhost:4321/', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 800));
const svgTop = await page.evaluate(() => document.querySelector('.fnd-field').getBoundingClientRect().top + scrollY);
await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), svgTop - 680);
await new Promise((r) => setTimeout(r, 500));
console.log(JSON.stringify(await page.evaluate(() => {
  const a = [...document.querySelectorAll('.field-arrow')].slice(0, 3).map((p) => ({
    d: p.getAttribute('d'),
    len: p.dataset.len,
    dasharray: p.style.strokeDasharray,
    dashoffset: p.style.strokeDashoffset,
  }));
  const svg = document.querySelector('.fnd-field');
  return { scrollY, svgTop: Math.round(svg.getBoundingClientRect().top + scrollY), arrows: a };
}), null, 1));
await browser.close();
