// Layout sweep: every page at every width (portrait and landscape). Reports sideways overflow, elements past the
// viewport edge, tap targets under 44px, images drawn at a different aspect ratio from their file, console errors
// and failed requests. Usage: node qa/sweep.mjs http://localhost:4179 [--widths=320,390] [--pages=/,/loans/]
import { chromium } from 'playwright';
const BASE = process.argv[2] || 'http://localhost:4179';
const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1];
const PAGES = (arg('pages') || '/,/about/,/loans/,/how-we-lend/,/terms/,/who-we-serve/,/team/,/licence/,/faq/,/contact/,/apply/,/profile/,/privacy/,/missing-page/').split(',');
const SIZES = (arg('widths') || '320x640,360x740,390x844,414x896,768x1024,1024x768,1280x800,1440x900,1920x1080,844x390,740x360,1024x1366').split(',').map((s) => { const [w, h] = s.split('x').map(Number); return { w, h: h || 900 }; });
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
let problems = 0;
for (const { w, h } of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 1024, isMobile: w < 1024, reducedMotion: process.env.RM ? 'reduce' : 'no-preference' });
  for (const p of PAGES) {
    const page = await ctx.newPage();
    const errs = [];
    page.on('console', (m) => { if (m.type() === 'error' && !(p.includes('missing-page') && /404/.test(m.text()))) errs.push(m.text()); });
    page.on('pageerror', (e) => errs.push(String(e)));
    page.on('requestfailed', (r) => errs.push('failed ' + r.url()));
    page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('missing-page')) errs.push(r.status() + ' ' + r.url()); });
    await page.goto(BASE + p, { waitUntil: 'load' });
    await page.waitForTimeout(2600);
    // scroll through so lazy content and scroll-driven states settle
    await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * 0.8) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } scrollTo(0, 0); });
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => {
      const out = [];
      const vw = document.documentElement.clientWidth;
      if (document.documentElement.scrollWidth > vw + 1) out.push(`page scrolls sideways: ${document.documentElement.scrollWidth} > ${vw}`);
      const vis = (el) => { const s = getComputedStyle(el); return s.visibility !== 'hidden' && s.display !== 'none' && el.getClientRects().length; };
      for (const el of document.querySelectorAll('main *, header *, footer *')) {
        if (!vis(el) || el.closest('[hidden], .sr-only, svg, .thread, [aria-hidden="true"], .reel, .carousel, .nf-rope')) continue;
        const b = el.getBoundingClientRect();
        if (b.width && (b.right > vw + 1 || b.left < -1)) { let clipped = false; for (let a = el.parentElement; a; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if (o !== 'visible') { clipped = true; break; } } if (!clipped) out.push(`off-screen ${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} ${Math.round(b.left)}–${Math.round(b.right)}`); }
      }
      for (const el of document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, summary, [role=slider]')) {
        if (!vis(el) || el.closest('[hidden], .sr-only, .hp, [aria-hidden="true"], p, li > p, .prose, .acc__panel, .crumbs, td, .notes, .fn, .site-footer__licence')) continue;
        if (el.matches('.hotspot')) continue; // 32 px marks with a 48 px hit area (licence page)
        const b = el.getBoundingClientRect();
        if (el.matches('input[type=checkbox], input[type=radio]')) continue;
        if (b.width && (b.height < 43.5 || b.width < 43.5)) out.push(`small target ${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ')[0] : ''} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24)}" ${Math.round(b.width)}x${Math.round(b.height)}`);
      }
      for (const img of document.querySelectorAll('img')) {
        if (!vis(img) || !img.naturalWidth) continue;
        const s = getComputedStyle(img); if (s.objectFit === 'cover' || s.objectFit === 'contain') continue;
        const b = img.getBoundingClientRect(); const ra = b.width / b.height, rn = img.naturalWidth / img.naturalHeight;
        if (b.height && Math.abs(ra - rn) / rn > 0.03) out.push(`stretched img ${img.getAttribute('src')} ${ra.toFixed(2)} vs ${rn.toFixed(2)}`);
      }
      return [...new Set(out)];
    });
    const all = [...r, ...errs.map((e) => 'console/network: ' + e.slice(0, 160))];
    if (all.length) { problems += all.length; console.log(`\n${p} @${w}x${h}`); all.slice(0, 12).forEach((x) => console.log('  - ' + x)); if (all.length > 12) console.log(`  … ${all.length - 12} more`); }
    await page.close();
  }
  await ctx.close();
}
await browser.close();
console.log(`\nSWEEP: ${problems} problem(s) across ${PAGES.length} pages × ${SIZES.length} sizes`);
process.exit(problems ? 1 : 0);
