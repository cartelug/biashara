// Full-page screenshots of every page at 390, 768, 1280 and 1920 wide, plus console errors.
// Usage: node qa/shots.mjs [outDir] [--motion] [--only=home,apply] [--widths=390,1280]
import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE = (process.argv.find((a) => a.startsWith('--base=')) || '').slice(7) || process.env.BASE || 'http://localhost:4173';
const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith('--')) || 'qa/shots';
const motion = args.includes('--motion');
const only = (args.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const widths = ((args.find((a) => a.startsWith('--widths=')) || '').slice(9) || '390,768,1280,1920').split(',').map(Number);
const PAGES = ['/', '/about/', '/loans/', '/how-we-lend/', '/terms/', '/who-we-serve/', '/team/', '/licence/', '/faq/', '/contact/', '/apply/', '/profile/', '/privacy/', '/404.html']
  .filter((p) => !only.length || only.includes(p.replace(/\//g, '') || 'home'));
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch();
const errors = [];
for (const w of widths) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w < 760 ? 844 : w < 1100 ? 1024 : w < 1600 ? 800 : 1080 }, deviceScaleFactor: 1, reducedMotion: motion ? 'no-preference' : 'reduce' });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('btc-seen', '1'); } catch {} });
  for (const p of PAGES) {
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${w} ${p} ${m.type()}: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`${w} ${p} pageerror: ${e.message}`));
    await page.goto(BASE + p, { waitUntil: 'networkidle' });
    await page.waitForTimeout(motion ? 3200 : 600);
    // walk down the page so lazy images and scroll reveals fire
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < h; y += 500) { await page.evaluate((yy) => window.scrollTo(0, yy), y); await page.waitForTimeout(motion ? 120 : 30); }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(motion ? 1500 : 400);
    const name = (p.replace(/\//g, '') || 'home').replace('.html', '');
    await page.screenshot({ path: `${out}/${name}-${w}.png`, fullPage: true });
    const hs = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (hs > 0) errors.push(`${w} ${p} horizontal overflow ${hs}px`);
    await page.close();
  }
  await ctx.close();
}
await browser.close();
console.log(errors.length ? errors.join('\n') : 'no console errors');
