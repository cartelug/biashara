// Reference integrity: every file the site points at must exist where the reference says it is.
// Reads the HTML pages, the stylesheet, the manifest and the service worker in a folder (dist/ or the repository root)
// and resolves each link the way a browser would (relative to the file that holds it).
// Usage: node qa/references.mjs [folder]      Exit code 1 if anything points at a missing file.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.argv[2] || 'dist');
const SKIP = new Set(['source', 'docs', 'node_modules', '.git']);
const problems = [];
let checked = 0;
const exists = (p) => fs.existsSync(p) && (fs.statSync(p).isFile() || fs.existsSync(path.join(p, 'index.html')));
const BASE = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'build.json'), 'utf8')).base || ''; } catch { return ''; } })();

function check(from, ref, label) {
  if (!ref || /^(#|[a-z][a-z0-9+.-]*:|\/\/)/i.test(ref)) return;            // anchors, https:, mailto:, tel:, data:
  checked += 1;
  let clean = ref.split('#')[0].split('?')[0];
  let target;
  if (clean.startsWith('/')) target = path.join(ROOT, BASE && clean.startsWith(BASE + '/') ? clean.slice(BASE.length) : clean);  // the 404 page
  else target = path.resolve(path.dirname(from), clean);
  if (clean === '' || clean.endsWith('/')) target = path.join(target, 'index.html');
  if (!target.startsWith(ROOT) || !exists(target)) problems.push(`${path.relative(ROOT, from)}: ${label} ${ref} -> missing ${path.relative(ROOT, target)}`);
}

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p)); else out.push(p);
  }
  return out;
}
const files = walk(ROOT);

// HTML pages
const pages = files.filter((f) => f.endsWith('.html'));
if (!fs.existsSync(path.join(ROOT, 'index.html'))) problems.push('index.html is not at the top of the folder');
for (const f of pages) {
  const h = fs.readFileSync(f, 'utf8');
  for (const m of h.matchAll(/\s(?:href|src|action|poster)="([^"]*)"/g)) check(f, m[1], 'link');
  for (const m of h.matchAll(/\s(?:srcset|imagesrcset)="([^"]*)"/g)) for (const part of m[1].split(',')) check(f, part.trim().split(/\s+/)[0], 'srcset');
  // every in-page anchor must exist
  const ids = new Set([...h.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  for (const m of h.matchAll(/\shref="#([^"]+)"/g)) if (!['top', 'main'].includes(m[1]) && !ids.has(m[1])) problems.push(`${path.relative(ROOT, f)}: #${m[1]} has no target`);
}

// Stylesheet: url(...) paths are relative to the stylesheet
for (const f of files.filter((x) => x.endsWith('.css'))) {
  const c = fs.readFileSync(f, 'utf8');
  for (const m of c.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) check(f, m[1], 'css url');
}

// Web app manifest: paths are relative to the manifest
const manifest = path.join(ROOT, 'manifest.webmanifest');
if (fs.existsSync(manifest)) {
  const m = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  for (const i of m.icons || []) check(manifest, i.src, 'manifest icon');
  check(manifest, m.start_url, 'manifest start_url');
}

// Service worker: every precache entry, relative to the folder the worker is in
const sw = path.join(ROOT, 'sw.js');
if (fs.existsSync(sw)) {
  const pre = JSON.parse(fs.readFileSync(sw, 'utf8').match(/const PRECACHE = (\[.*?\]);/)[1]);
  for (const p of pre) check(sw, p === '' ? './' : p, 'offline cache entry');
}

// Top-level files a host expects
for (const f of ['404.html', 'favicon.ico', 'robots.txt', 'sitemap.xml', 'manifest.webmanifest', 'sw.js', 'assets/css/main.css', 'assets/js/app.js']) {
  if (!fs.existsSync(path.join(ROOT, f))) problems.push(`missing ${f}`);
}
// The pages the navigation promises
for (const p of ['about', 'loans', 'how-we-lend', 'terms', 'who-we-serve', 'team', 'licence', 'faq', 'contact', 'apply', 'profile', 'privacy']) {
  if (!fs.existsSync(path.join(ROOT, p, 'index.html'))) problems.push(`missing page ${p}/index.html`);
}

if (problems.length) {
  console.error(`REFERENCES in ${ROOT}: ${problems.length} problem(s) after ${checked} references checked`);
  [...new Set(problems)].slice(0, 40).forEach((p) => console.error('  ' + p));
  process.exit(1);
}
console.log(`REFERENCES: ${checked} references in ${pages.length} pages, the stylesheet, manifest and offline cache all point at files that exist (${path.basename(ROOT)}/index.html is at the top).`);
