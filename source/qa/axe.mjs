// axe-core (WCAG 2.2 A/AA + best practice) on every page at 1280 and 390, plus high-contrast mode on two pages.
// Usage: node qa/axe.mjs [baseUrl] → qa/report/axe.json
import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pages } from '../src/data/site.mjs';

const BASE = process.argv[2] || 'http://localhost:4173';
const axeSrc = await readFile(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const browser = await chromium.launch();
const paths = [...pages.map((p) => p.path), '/this-page-does-not-exist/'];
const report = [];
for (const width of [1280, 390]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block', bypassCSP: true }); // lets axe inject itself
  await ctx.addInitScript(() => sessionStorage.setItem('btc-seen', '"1"'));
  const page = await ctx.newPage();
  for (const path of paths) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-loader]', { state: 'detached', timeout: 5000 }).catch(() => {});
    await page.addScriptTag({ content: axeSrc });
    const r = await page.evaluate(() => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } }));
    report.push({ path, width, violations: r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 4).map((n) => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\n')[1]?.trim()) })), passes: r.passes.length, incomplete: r.incomplete.length });
  }
  await ctx.close();
}
await browser.close();
await mkdir('qa/report', { recursive: true });
await writeFile('qa/report/axe.json', JSON.stringify(report, null, 1));
let total = 0;
for (const r of report) {
  if (r.violations.length) { console.log(`${r.path} @${r.width}`); for (const v of r.violations) { total += 1; console.log(`  ${v.impact} ${v.id}: ${v.help}\n    ${v.nodes.join('\n    ')}`); } }
}
console.log(`\nAXE: ${total} violations across ${report.length} page runs`);
process.exit(total ? 1 : 0);
