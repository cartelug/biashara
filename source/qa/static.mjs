// Static checks on /dist: anti-AI scan, typography scan, fact audit, links and alt text, budgets.
// Writes qa/report/static.json and prints a summary. Exit code 1 when anything fails.
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const out = { antiAI: [], typography: [], facts: [], disclaimers: [], links: [], alt: [], budgets: {}, pass: true };
const fail = (k, msg) => { out[k].push(msg); out.pass = false; };

async function walk(dir) {
  const r = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) r.push(...await walk(p)); else r.push(p);
  }
  return r;
}
const files = await walk(DIST);
const html = files.filter((f) => f.endsWith('.html'));
const css = files.filter((f) => f.endsWith('.css'));
const js = files.filter((f) => f.endsWith('.js') && !f.includes('/vendor/'));
const read = (f) => fs.readFile(f, 'utf8');
const rel = (f) => path.relative(DIST, f);
// visible text: drop scripts, styles, svg sprite and tags
// Drop aria-hidden elements (odometer digit reels, decorative microprint): readers never hear them
const dropHidden = (h) => {
  const re = /<(span|div|p|i|b)\b[^>]*aria-hidden="true"[^>]*>/g;
  let m, outH = '', at = 0;
  while ((m = re.exec(h))) {
    const tag = m[1]; let depth = 1, i = re.lastIndex;
    const t = new RegExp(`<${tag}\\b[^>]*>|</${tag}>`, 'g'); t.lastIndex = i;
    let n; while (depth && (n = t.exec(h))) { depth += n[0][1] === '/' ? -1 : 1; i = t.lastIndex; }
    outH += h.slice(at, m.index) + ' '; at = i; re.lastIndex = i;
  }
  return outH + h.slice(at);
};
const textOf = (h) => dropHidden(h).replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<svg[\s\S]*?<\/svg>/g, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&#8209;|‑/g, '-').replace(/\s+/g, ' ');

// ------------------------------------------------------------------ anti-AI (no glass blur, no gradient text, no stock phrases, no emoji)
const cssAll = (await Promise.all(css.map(read))).join('\n');
const headStyles = (await Promise.all(html.map(read))).map((h) => (h.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '').join('\n');
const allCss = cssAll + headStyles;
if (/backdrop-filter/.test(allCss)) fail('antiAI', 'backdrop-filter used');
if (/background-clip:\s*text|-webkit-background-clip:\s*text/.test(allCss)) fail('antiAI', 'gradient text (background-clip:text)');
const BANNED = [/welcome to/i, /empowering your financial journey/i, /\bunlock/i, /seamless/i, /cutting[- ]edge/i];
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/u;
for (const f of html) {
  const t = textOf(await read(f));
  for (const re of BANNED) if (re.test(t)) fail('antiAI', `${rel(f)}: banned phrase ${re}`);
  if (EMOJI.test(t)) fail('antiAI', `${rel(f)}: emoji`);
}

// ------------------------------------------------------------------ typography
if (!/font-synthesis:\s*none/.test(allCss)) fail('typography', 'font-synthesis: none missing');
for (const m of allCss.matchAll(/font-stretch:\s*([^;}]+)/g)) if (m[1].trim() !== '100%') fail('typography', `font-stretch ${m[1]}`);
const weights = new Set([...allCss.matchAll(/font-weight:\s*(\d{3})(?!\s*\d)/g)].map((m) => m[1]));
for (const w of weights) if (!['400', '500', '600', '700', '800', '900'].includes(w)) fail('typography', `font-weight ${w}`);
// Serif ships 400–500 only: flag rules that set the serif family with a heavier weight in the same block
for (const m of allCss.matchAll(/\{([^{}]*font-family:\s*var\(--font-serif\)[^{}]*)\}/g)) {
  const w = (m[1].match(/font-weight:\s*(\d{3})/) || [])[1];
  if (w && Number(w) > 500) fail('typography', `serif at weight ${w}`);
}
// transforms that scale text: only images and decorative marks may scale
for (const f of js) {
  const s = await read(f);
  if (/gsap\.[a-z]+\([^)]*(h1|h2|\.h-display|line-inner)[^)]*scale/i.test(s)) fail('typography', `${rel(f)} scales text`);
}
out.typography.push(`weights in use: ${[...weights].sort().join(', ')}`);

// ------------------------------------------------------------------ facts
const pageText = {};
for (const f of html) pageText[rel(f)] = textOf(await read(f));
const all = Object.values(pageText).join(' ');
const RULES = [
  ['APR / annual rate never used', () => !/\bAPR\b|annual percentage|per annum|p\.a\./i.test(all)],
  ['Only one interest rate (2.8%)', () => [...all.matchAll(/(\d+(?:\.\d+)?)\s?%/g)].every((m) => m[1] === '2.8' || m[1] === '100')],
  ['"per year" only in the "not per year" note', () => [...all.matchAll(/per year/gi)].length === [...all.matchAll(/not per year/gi)].length],
  ['No testimonials, client counts, awards or trust strips', () => !/testimonial|trusted by|happy clients|clients served|\baward|\bawarded|years of experience|\d+\+ (clients|years)/i.test(all)],
  ['No instalment or repayment schedule invented', () => !/instal+ment of|monthly instal+ment|per instal+ment|repayment schedule:/i.test(all)],
  ['Facility range UGX 1M–50M only', () => [...all.matchAll(/UGX\s?([\d,]+)(M\b)?(?!\s?(?:per|over))/g)].every((m) => { const n = Number(m[1].replace(/,/g, '')) * (m[2] ? 1e6 : 1); return n >= 1e6 && n <= 5e7 || n < 1e6 && n % 1000 === 0; })],
  ['Maximum term 6 months', () => !/\b([7-9]|1[0-9]|2[0-4])\s?months?\b/i.test(all)],
  ['"Since 2014" with nothing derived from it', () => !/\b(1[0-9]|[2-9])\s?(\+\s?)?years\b/i.test(all) && !/decade/i.test(all)],
  ['No branches claimed', () => !/branches|branch network|offices across/i.test(all)],
  ['Licence 1451/ML', () => /1451\/ML/.test(all) && !/\d{4}\/ML/.test(all.replace(/1451\/ML/g, ''))],
  ['Contacts match the profile', () => ['+256 702 634 848', '+256 392 960 002', 'inquiries@biasharafinance.com', 'Conrad Plaza'].every((s) => all.includes(s)) && !/\+256 \d{3} \d{3} \d{3}/.test(all.replace(/\+256 702 634 848|\+256 392 960 002/g, ''))],
  ['Office hours Monday–Friday 8:00 AM–4:00 PM', () => /8:00 AM\s?[–-]\s?4:00 PM/.test(all) && !/Saturday[^.]{0,20}(open|AM)/i.test(all)],
  ['Never claims approval', () => !/(you are|you're|you have been|has been) approved|pre-?approved|instant approval|guaranteed approval/i.test(all)],
];
for (const [name, ok] of RULES) { const r = ok(); out.facts.push(`${r ? 'PASS' : 'FAIL'} · ${name}`); if (!r) out.pass = false; }

const DISCLAIMERS = [
  ['Figures are standard published terms', /standard published term/i],
  ['Final terms confirmed in writing at approval', /(confirmed|given) in writing at approval/i],
  ['An application does not guarantee a facility', /application does not guarantee a facility/i],
  ['Review time runs in office hours', /review time runs during office hours|during office hours/i],
  ['Interest calculated on the approved principal', /calculated on the approved principal/i],
  ['Repayment arrangement is assessed', /Repayment arrangement\s+Assessed/i],
  ['Reconstructed portraits caption', /portraits reconstructed from supplied references/i],
  ['Licence verification via the Board of Directors', /verify the current licence, (kindly )?contact the Board of Directors/i],
];
for (const [name, re] of DISCLAIMERS) {
  const where = Object.entries(pageText).filter(([, t]) => re.test(t)).map(([p]) => p.replace('/index.html', '') || 'home');
  const r = where.length > 0;
  out.disclaimers.push(`${r ? 'PASS' : 'FAIL'} · ${name} · ${where.join(', ')}`);
  if (!r) out.pass = false;
}

// ------------------------------------------------------------------ links, anchors, alt text
const exists = async (p) => fs.stat(p).then(() => true, () => false);
const BUILT_BASE = JSON.parse(await fs.readFile(path.join(DIST, 'build.json'), 'utf8')).base || '';
// Where a link in a given file points on disk: relative links resolve from the file's folder; the 404 page uses
// absolute links that start with the folder the site is published in.
const resolveRef = (file, ref) => {
  if (ref.startsWith('/')) return path.join(DIST, BUILT_BASE && ref.startsWith(BUILT_BASE + '/') ? ref.slice(BUILT_BASE.length) : ref);
  return path.resolve(path.dirname(file), ref);
};
for (const f of html) {
  const h = await read(f);
  const ids = new Set([...h.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  for (const m of h.matchAll(/<(?:a|link)\s[^>]*href="([^"]+)"/g)) {
    const href = m[1];
    if (/^(https?:|mailto:|tel:|data:)/.test(href)) continue;
    const [p, hash] = href.split('#');
    if (!p) { if (hash && !['top', 'main'].includes(hash) && !ids.has(hash)) fail('links', `${rel(f)}: missing #${hash}`); continue; }
    const clean = p.split('?')[0];
    let target = resolveRef(f, clean);
    if (clean.endsWith('/')) target = path.join(target, 'index.html');
    if (!(await exists(target))) { fail('links', `${rel(f)}: broken ${href}`); continue; }
    if (hash && target.endsWith('.html')) {
      const th = await read(target);
      if (!new RegExp(`\\sid="${hash}"`).test(th)) fail('links', `${rel(f)}: ${href} anchor missing`);
    }
  }
  for (const m of h.matchAll(/<script\s[^>]*src="([^"]+)"/g)) {
    if (!/^https?:/.test(m[1]) && !(await exists(resolveRef(f, m[1].split('?')[0])))) fail('links', `${rel(f)}: missing script ${m[1]}`);
  }
  for (const m of h.matchAll(/<(?:img|source)\s[^>]*(?:src|srcset)="([^" ,]+)/g)) {
    const src = m[1].split('?')[0];
    if (!/^(https?:|data:)/.test(src) && !(await exists(resolveRef(f, src)))) fail('links', `${rel(f)}: missing image ${src}`);
  }
  for (const m of h.matchAll(/<img\s[^>]*>/g)) if (!/\salt="/.test(m[0])) fail('alt', `${rel(f)}: img without alt ${m[0].slice(0, 80)}`);
}

// ------------------------------------------------------------------ budgets
const gz = async (f) => zlib.gzipSync(await fs.readFile(f), { level: 9 }).length;
const jsFiles = files.filter((f) => f.endsWith('.js') && !f.endsWith('sw.js'));
let jsTotal = 0; for (const f of jsFiles) jsTotal += await gz(f);
let cssTotal = 0; for (const f of css) cssTotal += await gz(f);
const crit = (await read(path.join(DIST, 'index.html'))).match(/<style>([\s\S]*?)<\/style>/)?.[1] || '';
cssTotal += zlib.gzipSync(Buffer.from(crit)).length;
const fonts = files.filter((f) => f.endsWith('.woff2'));
const heroCandidates = files.filter((f) => /banknote-hands-\d+\.avif$/.test(f));
const heroSizes = await Promise.all(heroCandidates.map(async (f) => [path.basename(f), (await fs.stat(f)).size]));
const heroMax = Math.max(...heroSizes.map(([, s]) => s));
out.budgets = {
  jsGzipKB: +(jsTotal / 1024).toFixed(1), jsBudgetKB: 40,
  cssGzipKB: +(cssTotal / 1024).toFixed(1), cssBudgetKB: 28,
  fontFiles: fonts.length, fontBudget: 4,
  heroLargestAvifKB: +(heroMax / 1024).toFixed(1), heroBudgetKB: 180,
  heroFiles: Object.fromEntries(heroSizes.map(([n, s]) => [n, +(s / 1024).toFixed(1)])),
};
if (jsTotal / 1024 > 40) fail('links', 'JS budget exceeded');
if (cssTotal / 1024 > 28) fail('links', 'CSS budget exceeded');
if (fonts.length > 4) fail('links', 'font budget exceeded');
if (heroMax / 1024 > 180) fail('links', 'hero image budget exceeded');

await fs.mkdir(path.join(ROOT, 'qa/report'), { recursive: true });
await fs.writeFile(path.join(ROOT, 'qa/report/static.json'), JSON.stringify(out, null, 2));
for (const k of ['antiAI', 'typography', 'facts', 'disclaimers', 'links', 'alt']) {
  console.log(`\n## ${k}`); console.log(out[k].length ? out[k].join('\n') : 'clean');
}
console.log('\n## budgets'); console.log(JSON.stringify(out.budgets, null, 1));
console.log(out.pass ? '\nSTATIC: PASS' : '\nSTATIC: FAIL');
process.exitCode = out.pass ? 0 : 1;
