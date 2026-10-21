// One command for every check: npm run qa
// Builds the site, starts the preview, runs the static checks, behaviour tests, axe, the fact audit
// and screenshots, then prints one summary. Add --lighthouse for the Lighthouse run (slow).
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4179;
const BASE = `http://localhost:${PORT}`;
const args = process.argv.slice(2);
const run = (label, cmd, a, env = process.env) => {
  process.stdout.write(`\n── ${label}\n`);
  const r = spawnSync(cmd, a, { cwd: ROOT, stdio: 'inherit', env });
  return { label, ok: r.status === 0 };
};

const results = [];
// The preview server below serves at the top of a domain, so the first build is for that (this only affects the 404 page,
// whose paths are absolute). The configured build (the folder the real site is published in) is built and checked at the end.
const atRoot = { ...process.env, BASE_PATH: '' };
results.push(run('Build (for the preview server)', 'node', ['build/build.mjs', ...(args.includes('--fast') ? ['--fast'] : [])], atRoot));
const server = spawn('node', ['build/serve.mjs', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
try {
  results.push(run('Static checks (facts, anti-AI, type, links, alt, budgets)', 'node', ['qa/static.mjs']));
  results.push(run('Fact audit and image map', 'node', ['qa/audit.mjs']));
  results.push(run('Behaviour tests', 'node', ['qa/behaviour.mjs', BASE]));
  results.push(run('Accessibility (axe)', 'node', ['qa/axe.mjs', BASE]));
  if (!args.includes('--no-shots')) results.push(run('Screenshots 390/768/1280/1920', 'node', ['qa/shots.mjs', 'qa/report/shots', '--widths=390,768,1280,1920', `--base=${BASE}`]));
  if (args.includes('--lighthouse')) results.push(run('Lighthouse (mobile)', 'bash', ['qa/lighthouse.sh', BASE]));
} finally {
  server.kill();
}
results.push(run('Build (configured BASE_PATH, the files that get published)', 'node', ['build/build.mjs', '--fast']));
// Opens the built site from disk and from three server locations (domain root, /biashara, a deep folder)
results.push(run('References: every link, file, font, icon and offline-cache entry exists', 'node', ['qa/references.mjs']));
results.push(run('Portable: every file and link connects from disk, a domain root and any folder', 'node', ['qa/portable.mjs']));
console.log('\n══ Summary');
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} · ${r.label}`);
console.log('Reports: qa/report/');
process.exit(results.every((r) => r.ok) ? 0 : 1);
