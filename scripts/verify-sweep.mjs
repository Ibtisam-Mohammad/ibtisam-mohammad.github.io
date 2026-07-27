// One-off verification: arrows on every card, meta-text gone, campaign case live.
import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME_PATH || `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.setViewport({ width: 1440, height: 900 });
await page.goto('http://localhost:4321/', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 900));

const checks = await page.evaluate(() => {
  const text = document.body.textContent;
  return {
    arrowSvgs: document.querySelectorAll('.cs-arrows').length,
    arrowPathsPerCard: [...document.querySelectorAll('.cs-arrows')].map((s) => s.querySelectorAll('path').length),
    goneReconstructions: !text.includes('privacy-safe reconstructions'),
    goneHostedHere: !text.includes('hosted here') && !text.includes('hosted on this site'),
    goneSubstantiate: !text.includes('substantiate'),
    goneFootagePrivate: !text.includes('footage remains private') && !text.includes('images remain private'),
    campaignCase: text.includes('Campaign orchestrator with LLM drafting'),
    campaignStack: text.includes('ASP.NET Core'),
    smsCard: text.includes('SMS rescheduling agent'),
    ctrKept: text.includes('25% click-through'),
  };
});

// scroll to the SECOND case card and screenshot its arrows mid-draw
await page.evaluate(async () => {
  const rows = document.querySelectorAll('.cs-card .cs-rows')[1];
  window.scrollTo({ top: rows.getBoundingClientRect().top + scrollY - innerHeight * 0.4, behavior: 'instant' });
  await new Promise((r) => setTimeout(r, 700));
});
await page.screenshot({
  path: 'C:\\Users\\ibtis\\AppData\\Local\\Temp\\claude\\i--AI-website\\1954000c-6840-487e-a57c-7c5e68d3e198\\scratchpad\\card2-arrows.png',
});
console.log(JSON.stringify({ errs, checks }, null, 1));
await browser.close();
