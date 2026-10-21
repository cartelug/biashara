// The site must work from wherever it is served: a domain root ('') or a folder such as a GitHub Pages
// project site ('/biashara'). Run against a build made with that BASE_PATH (build.json records it).
// Loads four pages in a real browser and fails on any 404, failed request, console error, unloaded image,
// link that leaves the folder, or page change that is not handled by the client-side router.
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
  await page.waitForSelector('[data-loader]', { state: 'detached', timeout: 6000 }).catch(() => fail(where, 'loader never left'));

  // scroll through so lazy images load, then every image must have decoded
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 600) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(80); }
  await page.waitForTimeout(600);
  const broken = await page.evaluate(() => [...document.images].filter((i) => !(i.complete && i.naturalWidth > 0)).map((i) => i.currentSrc || i.src));
  broken.forEach((s) => fail(where, `image did not load ${s}`));

  // the site must have booted (scripts and styles loaded) and every internal link must stay inside the folder
  const state = await page.evaluate(() => ({ booted: document.documentElement.classList.contains('motion-ready') || typeof window.gsap === 'object', hrefs: [...document.querySelectorAll('a[href^="/"]')].map((a) => a.getAttribute('href')) }));
  if (!state.booted) fail(where, 'scripts did not start (no GSAP)');
  for (const href of state.hrefs) if (BASE && !(href === BASE || href.startsWith(BASE + '/'))) fail(where, `link leaves ${BASE}: ${href}`);
  await page.close();
}

// client-side navigation: the router must swap the page without a reload and stay inside the folder
{
  const page = await ctx.newPage();
  const where = `${BASE}/ (router)`;
  await page.goto(ORIGIN + BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-loader]', { state: 'detached', timeout: 6000 }).catch(() => {});
  await page.evaluate(() => { window.__noReload = true; });
  await page.evaluate(() => document.querySelector('a[data-nav="about"]')?.click());
  await page.waitForFunction((want) => location.pathname === want, BASE + '/about/', { timeout: 8000 }).catch(() => fail(where, 'URL did not change to the About page'));
  await page.waitForSelector('main#main[data-page="about"]', { timeout: 8000 }).catch(() => fail(where, 'About page content did not appear'));
  if (!(await page.evaluate(() => window.__noReload === true))) fail(where, 'page fully reloaded instead of using the router');
  await page.close();
}

// the command palette builds its destinations in script, so it needs the prefix too
{
  const page = await ctx.newPage();
  const where = `${BASE}/ (palette)`;
  await page.goto(ORIGIN + BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-loader]', { state: 'detached', timeout: 6000 }).catch(() => {});
  await page.evaluate(() => { window.__noReload = true; });
  await page.keyboard.press('/');
  await page.keyboard.type('licence');
  await page.keyboard.press('Enter');
  await page.waitForFunction((want) => location.pathname === want, BASE + '/licence/', { timeout: 8000 }).catch(() => fail(where, `Enter on "licence" did not open ${BASE}/licence/ (now ${new URL(page.url()).pathname})`));
  if (!(await page.evaluate(() => window.__noReload === true))) fail(where, 'palette caused a full reload');
  await page.close();
}

await browser.close();
if (problems.length) {
  console.error(`Base path "${BASE || '/'}": ${problems.length} problem(s)`);
  [...new Set(problems)].slice(0, 30).forEach((p) => console.error('  ' + p));
  process.exit(1);
}
console.log(`Base path "${BASE || '/'}": ${PAGES.length} pages load with every file, image and link in place; router and palette navigation work.`);
