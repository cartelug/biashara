// The built site must work wherever it is put: opened straight from disk (file://), at the top of a domain, in a
// folder such as a GitHub Pages project site, or in a deep folder. Every page links to its files with relative paths.
// This starts its own small servers over dist/ and checks, in a real browser, that on every one of them:
//   the stylesheet and the scripts apply, every image and font loads, there is no failed request or console error,
//   every internal link on the page points to a file that exists, the phone menu and the calculator link reach
//   the right pages, and (on the folder the 404 page is built for) the 404 page is styled at any depth.
// Usage: node qa/portable.mjs [distDir]      Exit code 1 on any problem.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const DIST = path.resolve(process.argv[2] || 'dist');
const BUILT_BASE = JSON.parse(fs.readFileSync(path.join(DIST, 'build.json'), 'utf8')).base || '';
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.xml': 'application/xml', '.txt': 'text/plain' };

// A static server that mounts dist/ at a prefix, serves folders as index.html, and 404.html for anything missing.
function serve(prefix) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let rel = null;
      if (!prefix) rel = u; else if (u === prefix || u.startsWith(prefix + '/')) rel = u.slice(prefix.length) || '/';
      let file = rel && path.join(DIST, rel);
      if (file && file.startsWith(DIST) && fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      if (file && file.startsWith(DIST) && fs.existsSync(file)) { res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }); return fs.createReadStream(file).pipe(res); }
      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
      fs.createReadStream(path.join(DIST, '404.html')).pipe(res);
    });
    server.listen(0, () => resolve({ server, origin: `http://localhost:${server.address().port}` }));
  });
}

const problems = [];
const fail = (where, msg) => problems.push(`${where}: ${msg}`);
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});

// One page: load it and check everything that can go wrong with paths.
async function checkPage(ctx, label, url, { checkLinks = true } = {}) {
  const page = await ctx.newPage();
  const where = `${label} ${new URL(url).pathname.slice(-40)}`;
  const bad = [];
  page.on('requestfailed', (r) => bad.push(`request failed ${r.url()}`));
  page.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });
  page.on('pageerror', (e) => bad.push(`script error: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/status of 4\d\d/.test(m.text())) bad.push(`console: ${m.text()}`); });
  await page.goto(url, { waitUntil: 'networkidle' });
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 400) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(50); }
  await page.waitForFunction(() => [...document.images].filter((i) => i.getBoundingClientRect().width > 0).every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 8000 }).catch(() => {});
  const s = await page.evaluate(async () => {
    const broken = [];
    for (const i of [...document.images].filter((x) => x.getBoundingClientRect().width > 0)) { try { await i.decode(); } catch { broken.push(i.currentSrc || i.src); } }
    const fonts = await Promise.all(['16px Archivo', '600 16px Archivo', '16px "Source Serif 4"'].map((f) => document.fonts.load(f).then((r) => r.length).catch(() => 0)));
    return {
      styled: getComputedStyle(document.querySelector('.site-header')).position === 'sticky',
      booted: document.documentElement.classList.contains('ready'),
      hasMain: !!document.querySelector('main#main'),
      fontsLoaded: fonts.every((n) => n > 0),
      broken,
      links: [...new Set([...document.querySelectorAll('a[href]')].map((a) => a.href).filter((u) => /^(https?|file):/.test(u) && !/^https?:\/\/(wa\.me|www\.google)/.test(u)))],
    };
  });
  if (!s.styled) bad.push('the stylesheet did not apply (header is not sticky)');
  if (!s.booted) bad.push('scripts did not start');
  if (!s.hasMain) bad.push('no <main>');
  // Browsers refuse font files opened from disk (a security rule, not a path problem), so text falls back to system fonts there.
  const fromDisk = url.startsWith('file:');
  if (!s.fontsLoaded && !fromDisk) bad.push('fonts did not load');
  for (const b of s.broken) bad.push(`image did not decode ${b}`);
  // every internal link must lead to a file that exists
  if (checkLinks) {
    const origin = new URL(url).origin;
    for (const link of s.links) {
      if (new URL(link).protocol === 'file:') {
        const p = decodeURIComponent(new URL(link).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
        if (!fs.existsSync(p)) bad.push(`link to a missing file: ${link}`);
      } else if (link.startsWith(origin)) {
        const r = await ctx.request.get(link.split('#')[0]);
        if (r.status() >= 400) bad.push(`link ${link} -> ${r.status()}`);
      }
    }
  }
  [...new Set(bad)].filter((b) => !(fromDisk && /woff2|CORS policy|ERR_FAILED/.test(b))).forEach((b) => fail(where, b));
  await page.close();
}

const PAGES = ['/', '/about/', '/loans/', '/apply/', '/contact/', '/licence/'];
const mounts = ['', '/biashara', '/a/b/c'];
for (const prefix of mounts) {
  const { server, origin } = await serve(prefix);
  const label = `http ${prefix || '/'}`;
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const desk = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  for (const p of PAGES) await checkPage(phone, label, origin + prefix + p);
  await checkPage(desk, label, origin + prefix + '/');

  // phone menu from the home page, then the calculator link on the loans page
  const page = await phone.newPage();
  await page.goto(origin + prefix + '/', { waitUntil: 'networkidle' });
  await page.click('[data-menu-toggle]');
  await page.click('[data-menu] a[href$="loans/"]');
  await page.waitForURL(`${origin}${prefix}/loans/`, { timeout: 6000 }).catch(() => fail(label, `menu link did not reach ${prefix}/loans/ (now ${new URL(page.url()).pathname})`));
  const apply = await page.locator('[data-calc-apply]').first().evaluate((a) => a.href).catch(() => '');
  if (apply !== `${origin}${prefix}/apply/?amount=10000000&term=3`) fail(label, `calculator link is ${apply}`);
  await page.click('[data-calc-apply]');
  await page.waitForURL(`${origin}${prefix}/apply/**`, { timeout: 6000 }).catch(() => fail(label, 'calculator link did not open the Apply page'));
  if (!(await page.locator('main#main[data-page="apply"]').count())) fail(label, 'Apply page content missing after the calculator link');
  await page.close();

  // the 404 page is built for one folder: it must be styled even when the missing address is deep
  if (prefix === BUILT_BASE) {
    const nf = await phone.newPage();
    const resp = await nf.goto(`${origin}${prefix}/no/such/page/`, { waitUntil: 'networkidle' });
    if (resp.status() !== 404) fail(label, `missing page returned ${resp.status()}`);
    const styled = await nf.evaluate(() => getComputedStyle(document.querySelector('.site-header')).position === 'sticky');
    if (!styled) fail(label, '404 page is not styled at a deep missing address');
    await nf.close();
  }
  await phone.close(); await desk.close(); server.close();
}

// Opened straight from disk: double-clicking index.html. Folder links must become index.html and scripts must run.
{
  const label = 'file://';
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const desk = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  const url = (p) => pathToFileURL(path.join(DIST, p)).href;
  for (const p of ['index.html', 'about/index.html', 'loans/index.html', 'apply/index.html', 'contact/index.html', 'licence/index.html']) await checkPage(phone, label, url(p));
  await checkPage(desk, label, url('index.html'));

  const page = await desk.newPage();
  await page.goto(url('index.html'), { waitUntil: 'networkidle' });
  await page.click('.primary-nav a[href$="loans/index.html"]');
  await page.waitForURL(/loans\/index\.html$/, { timeout: 6000 }).catch(() => fail(label, `nav link did not open loans/index.html (now ${page.url()})`));
  const apply = await page.locator('[data-calc-apply]').first().getAttribute('href').catch(() => '');
  if (apply !== 'apply/index.html?amount=10000000&term=3' && apply !== '../apply/index.html?amount=10000000&term=3') fail(label, `calculator link is ${apply}`);
  await page.click('.brand');
  await page.waitForURL(/index\.html$/, { timeout: 6000 }).catch(() => fail(label, `logo did not return to index.html (now ${page.url()})`));
  if (!(await page.locator('main#main[data-page="home"]').count())) fail(label, 'logo did not return to the home page');
  await page.close(); await phone.close(); await desk.close();
}

await browser.close();
if (problems.length) {
  console.error(`PORTABLE: ${problems.length} problem(s)`);
  problems.slice(0, 40).forEach((p) => console.error('  ' + p));
  process.exit(1);
}
console.log(`PORTABLE: opens correctly from disk (file://) and from ${mounts.map((m) => m || '/').join(', ')}: stylesheet, scripts, fonts, images and every internal link connect; phone menu, calculator link and ${BUILT_BASE || '/'} 404 page work.`);
