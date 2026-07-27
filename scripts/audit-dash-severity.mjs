// Severity of the dash-restart hazard is exactly len(shortest subpath) / len(total):
// every subpath inks at rate L_total * t, so the shortest one finishes at that t while
// the longest finishes at len(longest)/L_total. A small ratio = a mark that appears
// almost immediately and then waits, detached, for its parent stroke to catch up.
import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME_PATH || `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto('http://localhost:4321/', { waitUntil: 'networkidle0' });
await page.evaluate(async () => {
  for (let y = 0; y < document.body.scrollHeight; y += 600) {
    window.scrollTo({ top: y, behavior: 'instant' });
    await new Promise((r) => requestAnimationFrame(r));
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
});
await new Promise((r) => setTimeout(r, 1200));

const report = await page.evaluate(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const groups = {};
  for (const p of document.querySelectorAll('[data-draw]')) {
    const d = p.getAttribute('d') || '';
    const chunks = d.split(/(?=[Mm])/).filter((c) => c.trim().length > 2);
    if (chunks.length < 2) continue;

    // measure each subpath in isolation using a throwaway path in the same svg
    const svg = p.closest('svg');
    const probe = document.createElementNS(NS, 'path');
    svg.appendChild(probe);
    const lens = chunks.map((c) => { probe.setAttribute('d', c); return probe.getTotalLength(); });
    probe.remove();
    const total = lens.reduce((a, b) => a + b, 0);
    if (!total) continue;

    const section = p.closest('section')?.id || '?';
    const key = `${section} / ${svg.getAttribute('class') || svg.id}`;
    const ratio = Math.min(...lens) / total;      // t at which the FIRST mark completes
    const lastRatio = Math.max(...lens) / total;  // t at which the parent stroke completes
    groups[key] = groups[key] || { n: 0, worstRatio: 1, spreadAtWorst: 0 };
    groups[key].n++;
    if (ratio < groups[key].worstRatio) {
      groups[key].worstRatio = Number(ratio.toFixed(3));
      groups[key].spreadAtWorst = Number((lastRatio - ratio).toFixed(3));
    }
  }
  return groups;
});
console.log(JSON.stringify(report, null, 1));
await browser.close();
