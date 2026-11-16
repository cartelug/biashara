// Film strip: screenshots of the opening film and a scroll through a page, for the design review.
// Usage: node qa/film.mjs http://localhost:4179 out-dir [--page=/] [--w=390] [--h=844] [--frames=0,300,700,1100,1500,1900,2400] [--scroll]
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const BASE = process.argv[2] || 'http://localhost:4179';
const OUT = process.argv[3] || 'qa/report/film';
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `=${d}`).split('=')[1];
const pagePath = arg('page', '/');
const w = Number(arg('w', 390)), h = Number(arg('h', 844));
const frames = arg('frames', '0,250,600,1000,1400,1750,2100,2600').split(',').map(Number);
const short = process.argv.includes('--short');
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const mobile = w < 1024;
const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block' });
if (short) await ctx.addInitScript(() => sessionStorage.setItem('btc-film', '1'));
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const name = (pagePath.replace(/\//g, '') || 'home') + `-${w}`;
const t0 = Date.now();
await page.goto(BASE + pagePath, { waitUntil: 'commit' });
for (const f of frames) {
  const wait = f - (Date.now() - t0);
  if (wait > 0) await page.waitForTimeout(wait);
  await page.screenshot({ path: `${OUT}/${name}-film-${String(f).padStart(4, '0')}.png` });
}
if (process.argv.includes('--scroll')) {
  await page.waitForTimeout(800);
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  let i = 0;
  for (let y = 0; y < H; y += Math.round(h * 0.85)) {
    await page.mouse.wheel(0, 0);
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(Number(arg('settle', 900)));
    await page.screenshot({ path: `${OUT}/${name}-scroll-${String(i++).padStart(2, '0')}.png` });
  }
}
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
await browser.close();
