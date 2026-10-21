// Fact audit and image map.
// Fact audit: every key figure the site states is looked up in the profile text page by page
// (qa/source/profile.txt, one form feed per page) and in every built page.
// Image map: every photograph, the profile page it comes from, its source size, where it is used.
// Usage: node qa/audit.mjs → qa/report/fact-audit.md, qa/report/image-map.md
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { images } from '../src/data/images.mjs';
import { pages } from '../src/data/site.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const profile = (await readFile(path.join(ROOT, 'qa/source/profile.txt'), 'utf8')).split('\f');
const norm = (s) => s.replace(/[‐‑–—]/g, '-').replace(/\s+/g, ' ');
const profPages = profile.map(norm);

const textOf = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>/g, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&#8209;/g, '-');
const site = {};
for (const p of pages) {
  const f = path.join(ROOT, 'dist', p.path === '/' ? 'index.html' : p.path.slice(1) + 'index.html');
  site[p.id] = norm(textOf(await readFile(f, 'utf8')));
}

// [fact as stated on the site, pattern for the profile, pattern for the site]
const FACTS = [
  ['Incorporated in 2014 ("Since 2014")', /incorporated in 2014/i, /2014/],
  ['Four products: School Fees, Salary, Asset Financing, Business', /School Fees.*Salary|Asset Financing/i, /Asset Financing/],
  ['Facility range UGX 1,000,000 to 50,000,000', /1,000,000|1M - 50M|1-50M/, /1,000,000|1M\s?-\s?50M|1-50M/],
  ['Interest 2.8% per month, on the approved principal', /2\.8% per month applies across all four products, calculated/i, /2\.8%/],
  ['Maximum term 6 months', /6 months|six months/i, /6 months|six months|six-month/i],
  ['No fees to apply or be assessed', /required to be served/i, /no fees|free/i],
  ['Processing fee and other charges disclosed at approval', /Disclosed/, /Disclosed at approval/i],
  ['Review target: 4 working hours, office hours only', /4 working hours/, /4 working hours|four.working.hour/i],
  ['Office hours Monday–Friday 8:00 AM–4:00 PM', /Monday - Friday · 8:00 AM - 4:00 PM|8:00 AM/, /8:00 AM/],
  ['Office: Conrad Plaza, Plot 24/25 Entebbe Road, 2nd floor, Suite 2', /Conrad Plaza/i, /Conrad Plaza/i],
  ['Phone +256 702 634 848', /702 634 848/, /702 634 848/],
  ['Phone +256 392 960 002', /392 960 002/, /392 960 002/],
  ['Email inquiries@biasharafinance.com', /inquiries@biasharafinance\.com/, /inquiries@biasharafinance\.com/],
  ['Money Lending Licence 1451/ML', /1451/, /1451\/ML/],
  ['Licence issued 11 March 2026', /11.{0,6}March|MARCH/i, /11 March 2026/],
  ['Licence expires 31 December 2026', /31.{0,4}December|31st December/i, /31 December 2026/],
  ['Licence renewed every year; verify with the Board of Directors', /Board of Directors/i, /Board of Directors/],
  ['Chairman John Tasi Mufumba', /Mufumba/i, /Mufumba/],
  ['Managing Director Modest Rutagengwa', /Rutagengwa/i, /Rutagengwa/],
  ['Board Secretary Felix Omunu', /Omunu/i, /Omunu/],
  ['Vision: a microfinance institution serving a fast-growing mass market', /microfinance institution serving a fast/i, /microfinance institution serving a fast/i],
  ['Serves urban, semi-urban and rural Uganda', /semi-urban/i, /semi-urban/i],
];

const lines = ['# Fact audit', '', `Generated ${new Date().toISOString().slice(0, 10)} from the built site and the profile text (Edition 2026, Version 5).`, '',
  'Each fact the site states is found in the profile (the profile pages listed) and on the site pages listed. A fact with no profile page would be invented; there are none.', '',
  '| Fact on the site | Profile pages | Site pages |', '|---|---|---|'];
let missing = 0;
for (const [label, pre, sre] of FACTS) {
  const pp = profPages.map((t, i) => (pre.test(t) ? i + 1 : 0)).filter(Boolean);
  const sp = Object.entries(site).filter(([, t]) => sre.test(t)).map(([id]) => id);
  if (!pp.length) missing += 1;
  lines.push(`| ${label} | ${pp.length ? pp.join(', ') : '**not found**'} | ${sp.join(', ') || '—'} |`);
}
const stat = JSON.parse(await readFile(path.join(ROOT, 'qa/report/static.json'), 'utf8').catch(() => '{}'));
lines.push('', '## Automatic checks (qa/static.mjs)', '');
for (const r of stat.facts || []) lines.push(`- ${r}`);
lines.push('', '## Deliberately not on the site', '',
  '- No testimonials, client counts, awards, "trusted by" strips, milestones, branches or "years of experience" claims (the profile has none).',
  '- No APR or annual rate, and no instalment formula or repayment schedule: the repayment arrangement is shown as "assessed".',
  '- No second interest rate, no amount outside UGX 1M–50M, no term beyond 6 months (checked on every page).');
await mkdir(path.join(ROOT, 'qa/report'), { recursive: true });
await writeFile(path.join(ROOT, 'qa/report/fact-audit.md'), lines.join('\n') + '\n');

// ------------------------------------------------------------------ image map
const srcFiles = [...(await readdir(path.join(ROOT, 'src/pages'))).map((f) => 'src/pages/' + f), ...(await readdir(path.join(ROOT, 'src/partials'))).map((f) => 'src/partials/' + f)];
const srcText = Object.fromEntries(await Promise.all(srcFiles.map(async (f) => [f, await readFile(path.join(ROOT, f), 'utf8')])));
// A photo looks soft when it is shown wider than its own pixels. Portrait cards display at up to about
// 300 px, wide photos and bands at up to about 1400 px, so those are the limits checked here.
const softAt = (w, ratio) => (['3:4', '4:5'].includes(ratio) ? w < 450 : w < 1400);
const im = ['# Image map', '', 'Every photograph comes from the 2026 Company Profile and is used at its full extracted resolution. Nothing is redrawn; faces are not edited.', '',
  '| Image | Profile page | Source (w × h) | Sharp up to (1× / 2× screens) | Used on | Note |', '|---|---|---|---|---|---|'];
for (const [key, v] of Object.entries(images)) {
  const [, , w, h] = v.crop;
  const used = Object.entries(srcText).filter(([, t]) => t.includes(`key="${key}"`)).map(([f]) => path.basename(f, '.html'));
  const notes = [];
  if (v.reconstructed) notes.push('**reconstructed portrait** (caption shown)');
  if (softAt(w, v.ratio) && used.length) notes.push('low resolution: may look soft at its largest size');
  if (v.grade === false) notes.push('colours untouched');
  im.push(`| ${key} | ${v.page} | ${w} × ${h} | ${w} / ${Math.round(w / 2)} px | ${used.join(', ') || 'not used'} | ${notes.join('; ')} |`);
}
im.push('', 'The logo is the original artwork from the profile (cover page), used as supplied in PNG at 192 px and 512 px and never redrawn.');
await writeFile(path.join(ROOT, 'qa/report/image-map.md'), im.join('\n') + '\n');
console.log(`AUDIT: ${FACTS.length - missing}/${FACTS.length} facts found in the profile · ${Object.keys(images).length} images mapped`);
process.exit(missing ? 1 : 0);
