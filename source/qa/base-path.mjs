// The site must work from wherever it is served: a domain root ('') or a folder such as a GitHub Pages
// project site ('/biashara'). Run against a build made with that BASE_PATH (build.json records it).
// Loads four pages in a real browser and fails on any 404, failed request, console error, image that does not
// decode, link that leaves the folder, or a header link or menu link that does not reach its page.
// Usage: node qa/base-path.mjs [origin]   (default http://localhost:4173)
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';

const ORIGIN = process.argv[2] || 'http://localhost:4173';
const BASE = (JSON.parse(await readFile('dist/build.json', 'utf8')).base || '');
const PAGES = ['/', '/about/', '/loans/', '/apply/'];
const problems = [];
const fail = (where, msg) => problems.push(`${where}: ${msg}`);

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' });

for (const p of PAGES) {
  const page = await ctx.newPage();
  const where = `${BASE}${p}`;
  page.on('response', (r) => { if (r.status() >= 400) fail(where, `${r.status()} ${r.url()}`); });
  page.on('requestfailed', (r) => fail(where, `request failed ${r.url()}`));
  page.on('pageerror', (e) => fail(where, `script error: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/status of 4\d\d/.test(m.text())) fail(where, `console: ${m.text()}`); });
  await page.goto(ORIGIN + BASE + p, { waitUntil: 'networkidle' });

  // scroll through so lazy images load, then every visible image must have decoded
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 400) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(60); }
  await page.waitForFunction(() => [...document.images].filter((i) => i.getBoundingClientRect().width > 0).every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 8000 }).catch(() => {});
  const broken = await page.evaluate(async () => {
    const bad = [];
    for (const i of [...document.images].filter((x) => x.getBoundingClientRect().width > 0)) {
      try { await i.decode(); } catch { bad.push(i.currentSrc || i.src); continue; }
      if (!i.naturalWidth) bad.push(i.currentSrc || i.src);
    }
    return bad;
  });
  broken.forEach((s) => fail(where, `image did not load ${s}`));

  // the stylesheet and scripts must have applied, and every internal link must stay inside the folder
  const state = await page.evaluate(() => ({
    styled: getComputedStyle(document.querySelector('.site-header')).position === 'sticky',
    booted: !!document.querySelector('[data-menu-toggle]') && getComputedStyle(document.querySelector('[data-menu-toggle]')).display !== 'none',
    hrefs: [...document.querySelectorAll('a[href^="/"]')].map((a) => a.getAttribute('href')),
  }));
  if (!state.styled) fail(where, 'stylesheet did not apply (header is not sticky)');
  if (!state.booted) fail(where, 'scripts did not start (menu button missing)');
  for (const href of state.hrefs) if (BASE && !(href === BASE || href.startsWith(BASE + '/'))) fail(where, `link leaves ${BASE}: ${href}`);
  await page.close();
}

// the menu on a phone: open it, follow a link, and land on the right page inside the folder
{
  const page = await ctx.newPage();
  const where = `${BASE}/ (menu)`;
  await page.goto(ORIGIN + BASE + '/', { waitUntil: 'networkidle' });
  await page.click('[data-menu-toggle]');
  await page.click('[data-menu] a[href$="/about/"]');
  await page.waitForURL('**' + BASE + '/about/', { timeout: 8000 }).catch(() => fail(where, `menu link did not reach ${BASE}/about/ (now ${new URL(page.url()).pathname})`));
  if (!(await page.locator('main#main[data-page="about"]').count())) fail(where, 'About page content did not appear');
  await page.close();
}

// calculator link and the home link carry the folder too
{
  const page = await ctx.newPage();
  const where = `${BASE}/loans/ (calculator)`;
  await page.goto(ORIGIN + BASE + '/loans/', { waitUntil: 'networkidle' });
  const href = await page.locator('[data-calc-apply]').first().getAttribute('href');
  if (href !== `${BASE}/apply/?amount=10000000&term=3`) fail(where, `calculator apply link is ${href}`);
  await page.close();
}

await browser.close();
if (problems.length) {
  console.error(`Base path "${BASE || '/'}": ${problems.length} problem(s)`);
  [...new Set(problems)].slice(0, 30).forEach((p) => console.error('  ' + p));
  process.exit(1);
}
console.log(`Base path "${BASE || '/'}": ${PAGES.length} pages load with every file, image and link in place; the phone menu and calculator link reach the right pages.`);
