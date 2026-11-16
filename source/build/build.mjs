// Biashara website build.
// Reads /src, writes a plain static site to /dist. Run with: npm run build
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';
import { CONFIG } from '../src/js/config.js';
import { pages, parts, products, notes } from '../src/data/site.mjs';
import { images } from '../src/data/images.mjs';
import { buildImages } from './images.mjs';
import { buildIcons, buildOgImages } from './brand.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');
const rel = (...p) => path.join(...p);
const read = (p) => fs.readFile(p, 'utf8');
const write = async (p, s) => { await fs.mkdir(path.dirname(p), { recursive: true }); await fs.writeFile(p, s); };
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('base64');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const t0 = Date.now();
const FAST = process.argv.includes('--fast'); // reuse cached images and social cards
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean); // build just these pages while designing

// ---------------------------------------------------------------- links
// Every page links to its files with RELATIVE paths: "assets/css/main.css" on the home page, "../assets/css/main.css"
// one folder down. So the site works opened straight from disk, at the top of a domain, or in any folder, with no setting.
// Templates are written with root paths ("/assets/...") and converted for each page on the way out.
// The one exception is 404.html: a host can show it for a missing address at any depth, so it uses absolute paths
// that start with BASE, the folder the site is published in ('' at a domain root, '/biashara' on GitHub Pages).
const BASE = (() => {
  const raw = (process.env.BASE_PATH ?? CONFIG.BASE_PATH ?? '').trim();
  const b = raw === '/' ? '' : raw.replace(/\/+$/, '');
  if (b && !/^\/[\w.~-]+(\/[\w.~-]+)*$/.test(b)) throw new Error(`BASE_PATH must look like "" or "/folder" (got "${raw}")`);
  return b;
})();
const isRoot = (u) => u.startsWith('/') && !u.startsWith('//');
const URL_ATTR = /(\s(?:href|src|action|poster)=")([^"]*)"/g;
const SET_ATTR = /(\s(?:srcset|imagesrcset)=")([^"]*)"/g;
const mapSet = (v, fn) => v.split(',').map((s) => s.trim().replace(/^\S+/, fn)).join(', ');
const relUrl = (prefix) => (u) => (u === '/' ? prefix || './' : isRoot(u) ? prefix + u.slice(1) : u);
const absUrl = (u) => (isRoot(u) ? BASE + u : u);
const convertHtml = (html, fn) => html.replace(URL_ATTR, (_, a, v) => `${a}${fn(v)}"`).replace(SET_ATTR, (_, a, v) => `${a}${mapSet(v, fn)}"`);
const relativeHtml = (html, depth) => convertHtml(html, relUrl('../'.repeat(depth)));
const absoluteHtml = (html) => (BASE ? convertHtml(html, absUrl) : html);

// ---------------------------------------------------------------- dates
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const longDate = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
const fmtPhone = (p) => p.replace(/^\+256(\d{3})(\d{3})(\d{3})$/, '+256 $1 $2 $3');

const vars = {
  licence: {
    number: CONFIG.LICENCE.number,
    issuedText: longDate(CONFIG.LICENCE.issued),
    expiresText: longDate(CONFIG.LICENCE.expires),
    issued: CONFIG.LICENCE.issued,
    expires: CONFIG.LICENCE.expires,
    referenceYear: CONFIG.LICENCE.referenceYear,
  },
  contact: {
    email: CONFIG.CONTACT.email,
    phone1: CONFIG.CONTACT.phones[0], phone1Text: fmtPhone(CONFIG.CONTACT.phones[0]),
    phone2: CONFIG.CONTACT.phones[1], phone2Text: fmtPhone(CONFIG.CONTACT.phones[1]),
    whatsapp: CONFIG.CONTACT.whatsapp, whatsappText: fmtPhone('+' + CONFIG.CONTACT.whatsapp),
    address: CONFIG.CONTACT.address,
    maps: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(CONFIG.CONTACT.mapsQuery),
  },
  site: { url: CONFIG.SITE_URL },
};
const getVar = (key, extra) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), { ...vars, ...extra });

// ---------------------------------------------------------------- start
await fs.rm(DIST, { recursive: true, force: true });
await fs.mkdir(DIST, { recursive: true });

// Images and icons
const imgManifest = await buildImages({ images, srcDir: rel(SRC, 'img-source'), outDir: rel(DIST, 'assets/img/photo'), cacheDir: rel(ROOT, '.cache/img'), fast: FAST });
const brand = await buildIcons({ logo: rel(SRC, 'img-source/logo.png'), outDir: DIST, cacheDir: rel(ROOT, '.cache/brand') });

// Fonts and static files
for (const f of await fs.readdir(rel(SRC, 'fonts'))) await fs.cp(rel(SRC, 'fonts', f), rel(DIST, 'assets/fonts', f));
if (fss.existsSync(rel(SRC, 'static'))) await fs.cp(rel(SRC, 'static'), DIST, { recursive: true });

// ---------------------------------------------------------------- CSS
const cssFiles = (await fs.readdir(rel(SRC, 'css'))).filter((f) => f.endsWith('.css') && !/^(00|10)-/.test(f)).sort();
let css = '';
for (const f of cssFiles) css += `/* ${f} */\n` + (await read(rel(SRC, 'css', f))) + '\n';
css += generatedCss();
const minCss = minifyCss(css);
const cssHash = sha256(minCss).replace(/[^a-z0-9]/gi, '').slice(0, 10);
await write(rel(DIST, 'assets/css/main.css'), minCss);

// Critical CSS: tokens + base + the frame. Inlined in every page head.
const critical = minifyCss((await read(rel(SRC, 'css/00-tokens.css'))) + (await read(rel(SRC, 'css/10-base.css'))) + (await read(rel(SRC, 'critical/critical.css'))));

// ---------------------------------------------------------------- JS
// One classic script (not an ES module), so it also runs when a page is opened straight from disk; the settings are bundled in.
// The scroll-driven motion (GSAP, ScrollTrigger, Lenis and the red thread) is a second file, loaded after first paint.
const motionOut = await esbuild.build({
  entryPoints: [rel(SRC, 'js/motion/index.js')],
  bundle: true, format: 'iife', minify: true, target: ['es2020'], write: false, legalComments: 'none',
});
const motionJs = motionOut.outputFiles[0].text;
const motionHash = sha256(motionJs).replace(/[^a-z0-9]/gi, '').slice(0, 10);
await write(rel(DIST, 'assets/js/motion.js'), motionJs);
const jsOut = await esbuild.build({
  entryPoints: [rel(SRC, 'js/app.js')],
  bundle: true, format: 'iife', minify: true, target: ['es2020'], write: false, legalComments: 'none',
  define: { __MOTION_V__: JSON.stringify(motionHash) },
});
const appJs = jsOut.outputFiles[0].text;
const jsHash = sha256(appJs).replace(/[^a-z0-9]/gi, '').slice(0, 10);
await write(rel(DIST, 'assets/js/app.js'), appJs);

// Inline head script: flags JS on and restores the high-contrast setting.
const headScript = (await read(rel(SRC, 'critical/head.js'))).trim();
const headScriptHash = sha256(headScript);

const BUILD = { css: cssHash, js: jsHash, motion: motionHash, base: BASE, time: new Date().toISOString() };

// ---------------------------------------------------------------- templates
const partialCache = new Map();
async function partial(name) {
  if (!partialCache.has(name)) partialCache.set(name, await read(rel(SRC, 'partials', name + '.html')));
  return partialCache.get(name);
}

let calcCounter = 0;
async function expand(html, ctx) {
  // product rows/panels data loops: <x-products tpl="name"></x-products>
  html = await replaceAsync(html, /<x-products tpl="([\w-]+)"><\/x-products>/g, async (_, tpl) => {
    const t = await partial(tpl);
    return products.map((p, i) => t.replace(/\{\{p\.(\w+)\}\}/g, (_, k) => ({ ...p, nameUrl: encodeURIComponent(p.name) })[k]).replace(/\{\{i\}\}/g, String(i))).join('\n');
  });
  // includes (recursive)
  for (let i = 0; i < 6 && /<!--\s*@include\s+/.test(html); i++) {
    const m = [...html.matchAll(/<!--\s*@include\s+([\w-]+)\s*-->/g)];
    for (const x of m) html = html.replace(x[0], await partial(x[1]));
  }
  // calculator
  html = await replaceAsync(html, /<x-calc([^>]*)><\/x-calc>/g, async (_, a) => {
    const at = attrs(a); const id = 'calc' + (++calcCounter);
    return (await partial('calculator')).replaceAll('__ID__', id).replaceAll('__VARIANT__', at.variant || 'full')
      .replace('__CTA__', at.cta === 'none' ? '' : `<a class="btn" href="/apply/" data-calc-apply>Continue to the full application<svg class="icon" aria-hidden="true" focusable="false"><use href="#i-arrow-right"/></svg></a>`);
  });
  // variables
  html = html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, k) => { const v = getVar(k, ctx); if (v == null) throw new Error(`Unknown variable ${k} in ${ctx.page?.id}`); return v; });
  // icons and tiles
  html = html.replace(/<x-icon([^>]*)><\/x-icon>/g, (_, a) => { const at = attrs(a); return `<svg class="icon${at.class ? ' ' + at.class : ''}" aria-hidden="true" focusable="false"><use href="#i-${at.name}"/></svg>`; });
  html = html.replace(/<x-tile([^>]*)><\/x-tile>/g, (_, a) => { const at = attrs(a); return `<span class="tile${at.class ? ' ' + at.class : ''}" aria-hidden="true"><svg class="icon" focusable="false"><use href="#i-${at.name}"/></svg></span>`; });
  // images
  html = html.replace(/<x-img([^>]*)><\/x-img>/g, (_, a) => picture(attrs(a), ctx));
  // footnotes
  const fnOrder = [];
  html = html.replace(/<x-fn note="([\w-]+)"><\/x-fn>/g, (_, key) => {
    if (!notes[key]) throw new Error('Unknown note ' + key);
    let n = fnOrder.indexOf(key) + 1;
    if (!n) { fnOrder.push(key); n = fnOrder.length; }
    return `<sup class="fn"><a href="#note-${n}" aria-label="Note ${n}">${n}</a></sup>`;
  });
  html = html.replace(/<x-notes><\/x-notes>/g, () => fnOrder.length ? notesBlock(fnOrder) : '');
  return html;
}

function attrs(s) {
  const out = {};
  for (const m of s.matchAll(/([\w-]+)(?:="([^"]*)")?/g)) out[m[1]] = m[2] === undefined ? true : m[2];
  return out;
}
async function replaceAsync(str, re, fn) {
  const parts = []; let last = 0;
  for (const m of str.matchAll(re)) { parts.push(str.slice(last, m.index), await fn(...m)); last = m.index + m[0].length; }
  parts.push(str.slice(last)); return parts.join('');
}

function picture(at, ctx) {
  const key = at.key; const meta = images[key]; const out = imgManifest[key];
  if (!meta || !out) throw new Error('Unknown image ' + key + ' in ' + ctx.page?.id);
  const sizes = at.sizes || '100vw';
  const srcset = (fmt) => out.widths.map((w) => `/assets/img/photo/${key}-${w}.${fmt} ${w}w`).join(', ');
  const largest = out.widths[out.widths.length - 1];
  const fallbackW = out.widths.find((w) => w >= 960) || largest;
  const alt = at.alt !== undefined ? at.alt : meta.alt;
  const eager = at.loading === 'eager' || at.priority;
  const ratioCls = 'r-' + meta.ratio.replace(':', 'x');
  return `<picture class="ph ${ratioCls} fp-${key}${at.class ? ' ' + at.class : ''}">` +
    `<source type="image/avif" srcset="${srcset('avif')}" sizes="${sizes}">` +
    `<source type="image/webp" srcset="${srcset('webp')}" sizes="${sizes}">` +
    `<img src="/assets/img/photo/${key}-${fallbackW}.jpg" srcset="${srcset('jpg')}" sizes="${sizes}" width="${out.width}" height="${out.height}" alt="${esc(alt)}"` +
    `${eager ? ' loading="eager"' : ' loading="lazy"'} decoding="${eager ? 'sync' : 'async'}"${at.priority ? ' fetchpriority="high"' : ''}>` +
    `</picture>`;
}

function notesBlock(order) {
  const items = order.map((k, i) => `<li id="note-${i + 1}"><p>${esc(notes[k].text)}</p><p class="notes__src">Company Profile 2026 · page&nbsp;${notes[k].src}</p></li>`).join('');
  return `<section class="notes" aria-labelledby="notes-h"><div class="container"><h2 class="notes__h" id="notes-h">Notes</h2><ol class="notes__list">${items}</ol></div></section>`;
}

function generatedCss() {
  let s = '';
  for (const [k, m] of Object.entries(images)) s += `.fp-${k} img{object-position:${m.focus}}\n`;
  return s;
}

function minifyCss(s) {
  return esbuild.transformSync(s, { loader: 'css', minify: true, target: ['chrome100', 'safari15', 'firefox100'], legalComments: 'none' }).code.trim();
}

// ---------------------------------------------------------------- head
function jsonLd(page) {
  const org = {
    '@context': 'https://schema.org',
    '@type': 'FinancialService',
    '@id': CONFIG.SITE_URL + '/#organization',
    name: 'Biashara Trading Company Limited',
    legalName: 'Biashara Trading Company Limited',
    url: CONFIG.SITE_URL + '/',
    logo: CONFIG.SITE_URL + '/assets/img/logo/biashara-logo-512.png',
    image: CONFIG.SITE_URL + '/assets/img/og/home.png',
    slogan: 'Turning your financial challenge to simplicity.',
    description: 'A Kampala-based lender providing short-term bridge financing to eligible individuals and enterprises across Uganda.',
    foundingDate: '2014',
    email: CONFIG.CONTACT.email,
    telephone: CONFIG.CONTACT.phones,
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Conrad Plaza, Plot 24/25 Entebbe Road, Second Floor, Suite 2',
      addressLocality: 'Kampala',
      addressCountry: 'UG',
    },
    areaServed: { '@type': 'Country', name: 'Uganda' },
    openingHoursSpecification: [{ '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '08:00', closes: '16:00' }],
    identifier: { '@type': 'PropertyValue', propertyID: 'Money Lending Licence', value: CONFIG.LICENCE.number },
  };
  const webpage = {
    '@context': 'https://schema.org', '@type': 'WebPage', name: page.title, description: page.description,
    url: CONFIG.SITE_URL + page.path, isPartOf: { '@type': 'WebSite', name: 'Biashara Trading Company Limited', url: CONFIG.SITE_URL + '/' },
    about: { '@id': CONFIG.SITE_URL + '/#organization' },
  };
  return JSON.stringify([org, webpage]).replace(/</g, '\\u003c');
}

const OG_PAGES = ['home', 'about', 'loans', 'how-we-lend', 'terms', 'who-we-serve', 'team', 'licence', 'faq', 'contact', 'apply', 'profile', 'privacy'];

function head(page) {
  const url = CONFIG.SITE_URL + page.path;
  const og = OG_PAGES.includes(page.id) ? page.id : 'home';
  const ogImg = `${CONFIG.SITE_URL}/assets/img/og/${og}.png`;
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.description)}">
${page.noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${url}">`}
<meta name="theme-color" content="#fcfbf8">
<meta name="color-scheme" content="light">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Biashara Trading Company Limited">
<meta property="og:title" content="${esc(page.title)}">
<meta property="og:description" content="${esc(page.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${ogImg}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="en_UG">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(page.title)}">
<meta name="twitter:description" content="${esc(page.description)}">
<meta name="twitter:image" content="${ogImg}">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/assets/img/logo/icon-192.png" type="image/png" sizes="192x192">
<link rel="apple-touch-icon" href="/assets/img/logo/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="preload" href="/assets/fonts/archivo-wght.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/sourceserif4-opsz.woff2" as="font" type="font/woff2" crossorigin>
${page.preloadImage || ''}
<script>${headScript}</script>
<style>${critical}</style>
<link rel="stylesheet" href="/assets/css/main.css?v=${BUILD.css}">
<script type="application/ld+json" id="ld">${jsonLd(page)}</script>`;
}

// ---------------------------------------------------------------- film shapes
// The thread forms a shape that hints at the page before the reveal (MOTION.md section 4). 200 x 200 box.
const B_PATH = 'M30 268C140 200 260 150 400 128C520 112 610 130 640 190C670 250 640 330 590 380C550 420 520 470 470 500C420 525 330 520 270 500C230 490 250 530 330 545C420 560 480 640 495 740C505 820 480 870 420 875C330 880 200 875 130 860C80 850 70 790 110 770C160 650 250 450 330 270C350 220 370 170 395 80';
const scalePath = (d, k, dx, dy) => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => `${(x * k + dx).toFixed(1)} ${(y * k + dy).toFixed(1)}`);
const SHAPES = {
  b: scalePath(B_PATH, 0.165, 28, 2),
  growth: 'M14 170C40 168 52 150 70 146S92 156 108 128 136 100 148 82 170 52 186 26M186 26L166 30M186 26L184 46',
  steps: 'M12 182H56V140H100V98H144V56H188V18',
  ledger: 'M48 18H128L156 46V182H48ZM128 18V46H156M68 80H136M68 104H136M68 128H116M68 156H136',
  handshake: 'M8 120C40 120 58 82 88 82C118 82 120 124 96 124C72 124 76 82 110 82C140 82 160 120 192 120',
  pin: 'M100 184C72 142 46 116 46 80A54 54 0 1 1 154 80C154 116 128 142 100 184ZM100 58A22 22 0 1 0 100.1 58',
  links: 'M14 100C14 70 40 56 64 56S112 70 112 100 88 144 64 144 14 130 14 100M88 100C88 70 112 56 136 56S186 70 186 100 160 144 136 144 88 130 88 100',
  seal: 'M100 22A58 58 0 1 1 99.9 22M74 128L58 186L80 172L94 192L100 138L106 192L120 172L142 186L126 128',
  question: 'M66 70C66 34 134 34 134 70C134 100 100 100 100 132V142M100 168V170',
  document: 'M48 18H128L156 46V182H48ZM128 18V46H156M64 148C78 128 88 164 104 144S126 138 146 150',
  shield: 'M100 18L166 44V100C166 146 136 170 100 186C64 170 34 146 34 100V44ZM68 100L92 124L136 78',
  knot: 'M8 112C56 112 76 58 110 58C150 58 152 132 110 132C70 132 78 78 122 90C150 98 164 112 192 112',
};
const PAGE_SHAPE = { home: 'b', loans: 'growth', 'how-we-lend': 'steps', terms: 'ledger', about: 'handshake', 'who-we-serve': 'pin',
  team: 'links', licence: 'seal', faq: 'question', contact: 'pin', apply: 'document', profile: 'document', privacy: 'shield', '404': 'knot' };

// The closing band (the thread ties off here) sits at the end of every page that does not already end with a call to action.
const FOOT_CTA_SKIP = ['home', 'apply', '404'];

// ---------------------------------------------------------------- pages
const layout = await read(rel(SRC, 'partials', 'layout.html'));
const allPages = [...pages, { id: '404', path: '/404.html', num: '00', name: 'Page not found', nav: '', part: 'end', noindex: true,
  title: 'Page not found · Biashara Trading Company Limited', description: 'The page you asked for is not here. Links to the main pages of Biashara Trading Company Limited.' }];

// Navigation (desktop bar with two panels, and the phone menu). Every short line is wording already on the site.
const NAVI = {
  home: ['grid', 'Start page'],
  loans: ['coins', 'Four products, UGX 1M–50M'],
  'how-we-lend': ['compass', 'Four steps from enquiry to disbursement'],
  terms: ['receipt', '2.8% per month · applying is free'],
  about: ['building', 'Kampala lender since 2014'],
  team: ['users', 'Board, management and staff'],
  'who-we-serve': ['user-check', 'Entrepreneurs, salaried clients, companies & NGOs'],
  licence: ['badge', 'Money Lending Licence 1451/ML'],
  faq: ['chat', 'Answers from the Company Profile'],
  contact: ['pin', 'Conrad Plaza, Entebbe Road, Kampala'],
  profile: ['document', 'The full 2026 Company Profile'],
  privacy: ['lock', 'How information is handled'],
};
const pg = (id) => pages.find((p) => p.id === id);
const ico = (name) => `<svg class="icon" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;
const cur = (id, current) => (id === current ? ' aria-current="page"' : '');
const label = (id) => (id === 'profile' ? 'Company profile' : id === 'faq' ? 'FAQ' : pg(id).nav);
const COMPANY = ['about', 'team', 'who-we-serve', 'licence', 'faq', 'profile'];
const panelItem = (href, icon, title, text, current) => `<li><a class="np__item" href="${href}"${current ? ' aria-current="page"' : ''}><span class="np__ico">${ico(icon)}</span><span class="np__t">${esc(title)}</span><span class="np__d">${esc(text)}</span></a></li>`;
const navLinks = (current) => {
  const loansPanel = `<div class="np np--loans" id="np-loans"><div class="np__grid"><ul class="np__list" role="list">${products.map((p) => panelItem(`/loans/#${p.slug}`, p.icon, p.name, p.purpose)).join('')}</ul>
    <div class="np__aside"><p class="np__k">Every product</p><ul class="np__facts" role="list"><li>UGX 1M – 50M</li><li>2.8% per month</li><li>Up to 6 months</li><li>Applying is free</li></ul>
    <a class="np__more" href="/loans/">Compare all products${ico('arrow-right')}</a><a class="np__more" href="/loans/#cost">Work out the cost${ico('arrow-right')}</a></div></div></div>`;
  const companyPanel = `<div class="np np--company" id="np-company"><div class="np__grid"><ul class="np__list" role="list">${COMPANY.map((id) => panelItem(pg(id).path, NAVI[id][0], label(id), NAVI[id][1], id === current)).join('')}</ul>
    <div class="np__aside np__aside--dark"><p class="np__k">Talk to us</p><p class="open-now needs-js" data-open-now data-compact><span class="open-now__sq" aria-hidden="true"></span><span data-open-now-text>Checking office hours</span></p>
    <a class="np__more" href="tel:${vars.contact.phone1}">${ico('phone')}${esc(vars.contact.phone1Text)}</a><a class="np__more" href="/contact/">Visit or write to us${ico('arrow-right')}</a></div></div></div>`;
  const top = (id, extra = '') => `<a class="nav-link" href="${pg(id).path}" data-nav="${id}"${cur(id, current)}>${ico(NAVI[id][0])}<span>${esc(label(id))}</span>${extra}</a>`;
  const chev = '<span class="nav-chev" aria-hidden="true"></span>';
  return `<li class="nav-item nav-item--panel">${top('loans', chev)}${loansPanel}</li>`
    + `<li class="nav-item">${top('how-we-lend')}</li><li class="nav-item">${top('terms')}</li>`
    + `<li class="nav-item nav-item--panel"><a class="nav-link" href="/about/"${COMPANY.includes(current) ? ' aria-current="true"' : ''}>${ico('building')}<span>Company</span>${chev}</a>${companyPanel}</li>`
    + `<li class="nav-item">${top('contact')}</li>`;
};
// The phone menu: the four loans as cards, the main pages as rows with a symbol and a line of text, then the rest.
const MENU_MAIN = ['how-we-lend', 'terms', 'about', 'team', 'who-we-serve', 'contact'];
const MENU_MORE = ['home', 'licence', 'faq', 'profile', 'privacy'];
const menuLoans = () => products.map((p) => `<li><a class="mloan" href="/loans/#${p.slug}"><span class="mloan__ico">${ico(p.icon)}</span><span>${esc(p.short === 'Asset Financing' ? 'Asset' : p.short)}</span></a></li>`).join('');
const menuMain = (current) => MENU_MAIN.map((id) => `<li><a class="mrow" href="${pg(id).path}"${cur(id, current)}><span class="mrow__ico">${ico(NAVI[id][0])}</span><span class="mrow__t">${esc(label(id))}</span><span class="mrow__d">${esc(NAVI[id][1])}</span></a></li>`).join('');
const menuLinks = (current) => MENU_MORE.map((id) => `<li><a class="mchip" href="${pg(id).path}"${cur(id, current)}>${ico(NAVI[id][0])}${esc(label(id))}</a></li>`).join('');

const sitemap = [];
for (const page of allPages) {
  if (ONLY.length && !ONLY.includes(page.id)) continue;
  const file = rel(SRC, 'pages', page.id + '.html');
  if (!fss.existsSync(file)) { console.warn('  missing page', page.id); continue; }
  let body = await read(file);
  calcCounter = 0;
  // 404.html uses absolute paths (see above); every other page is one folder down, except the home page
  const depth = page.id === 'home' || page.id === '404' ? 0 : 1;
  const ctx = { page: { ...page, root: page.id === '404' ? BASE + '/' : '../'.repeat(depth), shapePath: SHAPES[PAGE_SHAPE[page.id] || 'knot'] } };
  if (!FOOT_CTA_SKIP.includes(page.id)) body += '\n<!-- @include foot-cta -->\n';
  // Preload the hero image (LCP) when a page marks one as priority.
  const pri = body.match(/<x-img([^>]*\bpriority\b[^>]*)><\/x-img>/);
  if (pri) {
    const at = attrs(pri[1]); const o = imgManifest[at.key];
    page.preloadImage = `<link rel="preload" as="image" type="image/avif" imagesrcset="${o.widths.map((w) => `/assets/img/photo/${at.key}-${w}.avif ${w}w`).join(', ')}" imagesizes="${at.sizes || '100vw'}" fetchpriority="high">`;
  }
  let html = layout
    .replace('<!--HEAD-->', head(ctx.page))
    .replace('<!--MAIN-->', body)
    .replace('<!--NAV-->', navLinks(page.id));
  html = html.replace(/\{\{page\.(\w+)\}\}/g, (_, k) => esc(ctx.page[k] ?? ''));
  html = await expand(html, ctx);
  // the header and footer partials arrive during expand, so fill their slots afterwards (the nav appears twice)
  html = html.replaceAll('<!--NAV-->', navLinks(page.id)).replaceAll('<!--MENU-->', menuLinks(page.id)).replaceAll('<!--MENUMAIN-->', menuMain(page.id)).replaceAll('<!--MENULOANS-->', menuLoans());
  html = html.replace(/__BUILD__/g, BUILD.js);
  html = page.id === '404' ? absoluteHtml(html) : relativeHtml(html, depth);
  if (/\{\{|<x-/.test(html)) throw new Error('Unexpanded template token in ' + page.id + ': ' + html.match(/.{40}(\{\{|<x-).{40}/)?.[0]);
  const out = page.id === 'home' ? rel(DIST, 'index.html') : page.id === '404' ? rel(DIST, '404.html') : rel(DIST, page.id, 'index.html');
  await write(out, html);
  if (!page.noindex) sitemap.push(page.path);
}

// ---------------------------------------------------------------- OG images
await buildOgImages({ pages, parts, outDir: rel(DIST, 'assets/img/og'), fontDir: rel(ROOT, 'build/assets-src'), logo: rel(SRC, 'img-source/logo.png'), cacheDir: rel(ROOT, '.cache/og'), fast: FAST });

// ---------------------------------------------------------------- site files
const today = new Date().toISOString().slice(0, 10);
await write(rel(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemap.map((p) => `  <url><loc>${CONFIG.SITE_URL}${p}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`);
await write(rel(DIST, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${CONFIG.SITE_URL}/sitemap.xml\n`);
await write(rel(DIST, 'manifest.webmanifest'), JSON.stringify({
  name: 'Biashara Trading Company Limited', short_name: 'Biashara', start_url: './', scope: './', display: 'standalone',
  background_color: '#fcfbf8', theme_color: '#fcfbf8', description: 'Short-term bridge financing in Kampala since 2014.',
  icons: [
    { src: 'assets/img/logo/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'assets/img/logo/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'assets/img/logo/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}, null, 2));

// Security headers (Netlify and Cloudflare Pages read _headers). The CSP allows only what the site uses.
const connect = CONFIG.SUBMIT_ENDPOINT ? ' ' + new URL(CONFIG.SUBMIT_ENDPOINT).origin : '';
const criticalHash = sha256(critical);
const csp = [
  "default-src 'self'",
  `script-src 'self' 'sha256-${headScriptHash}'`,
  `style-src 'self' 'sha256-${criticalHash}'`,
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src 'self'${connect}`,
  "manifest-src 'self'",
  "worker-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  `form-action 'self' mailto:${connect}`,
  "object-src 'none'",
  'upgrade-insecure-requests',
].join('; ');
await write(rel(DIST, '_headers'), `/*
  Content-Security-Policy: ${csp}
  Referrer-Policy: strict-origin-when-cross-origin
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()
  Cross-Origin-Opener-Policy: same-origin

/assets/css/*
  Cache-Control: public, max-age=31536000, immutable

/assets/js/app.js
  Cache-Control: public, max-age=31536000, immutable

/assets/js/motion.js
  Cache-Control: public, max-age=31536000, immutable

/assets/fonts/*
  Cache-Control: public, max-age=31536000, immutable

/assets/img/*
  Cache-Control: public, max-age=2592000

/sw.js
  Cache-Control: public, max-age=0, must-revalidate
`);
// Same headers for Apache / cPanel hosts.
await write(rel(DIST, '.htaccess'), `# Biashara website — Apache / cPanel settings
Options -Indexes
ErrorDocument 404 ${BASE}/404.html
<IfModule mod_headers.c>
  Header always set Content-Security-Policy "${csp}"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
  Header always set X-Content-Type-Options "nosniff"
  Header always set X-Frame-Options "DENY"
  Header always set Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
</IfModule>
<IfModule mod_mime.c>
  AddType font/woff2 .woff2
  AddType image/avif .avif
  AddType application/manifest+json .webmanifest
</IfModule>
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css text/javascript application/javascript image/svg+xml application/json application/manifest+json application/xml text/plain
</IfModule>
# Caching: versioned assets for a year; pages and the service worker are always re-checked
<IfModule mod_headers.c>
  <FilesMatch "\\.(woff2|css)$|^(app|motion)\\.js$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>
  <FilesMatch "\\.(avif|webp|jpe?g|png|svg|ico)$|\\.min\\.js$">
    Header set Cache-Control "public, max-age=2592000"
  </FilesMatch>
  <FilesMatch "^sw\\.js$|\\.(html|webmanifest|xml|txt)$">
    Header set Cache-Control "public, max-age=0, must-revalidate"
  </FilesMatch>
</IfModule>
`);

// Service worker with a precache list of every page, font and the core assets. Paths are relative to the folder
// the site is in (the worker works that folder out for itself), so no setting is needed.
const precache = [...sitemap.map((p) => p.slice(1)), '404.html', `assets/css/main.css?v=${BUILD.css}`, `assets/js/app.js?v=${BUILD.js}`, `assets/js/motion.js?v=${BUILD.motion}`,
  'assets/fonts/archivo-wght.woff2', 'assets/fonts/sourceserif4-opsz.woff2', 'assets/fonts/sourceserif4-italic-opsz.woff2',
  'assets/img/logo/biashara-logo-320.png', 'assets/img/logo/mark-160.png'];
const sw = (await read(rel(SRC, 'js/sw.js'))).replace('__VERSION__', BUILD.js).replace('__PRECACHE__', JSON.stringify(precache))
  .replace('__ENDPOINT__', JSON.stringify(CONFIG.SUBMIT_ENDPOINT || ''));
await write(rel(DIST, 'sw.js'), sw);
await write(rel(DIST, 'build.json'), JSON.stringify(BUILD, null, 2));

// ---------------------------------------------------------------- report sizes
const gz = (buf) => zlib.gzipSync(buf, { level: 9 }).length;
const sizeOf = async (p) => gz(await fs.readFile(rel(DIST, p)));
const jsTotal = await sizeOf('assets/js/app.js');
const motionTotal = await sizeOf('assets/js/motion.js');
const cssTotal = (await sizeOf('assets/css/main.css')) + gz(Buffer.from(critical));
console.log(`Built ${allPages.length} pages for ${BASE || '/'} in ${((Date.now() - t0) / 1000).toFixed(1)}s · JS ${(jsTotal / 1024).toFixed(1)}KB gz (+ motion ${(motionTotal / 1024).toFixed(1)}KB gz, after first paint) · CSS ${(cssTotal / 1024).toFixed(1)}KB gz`);
await write(rel(DIST, '..', '.cache', 'budget.json'), JSON.stringify({ jsGzip: jsTotal, motionGzip: motionTotal, cssGzip: cssTotal }, null, 2));
