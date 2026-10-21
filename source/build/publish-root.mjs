// Copies the freshly built dist/ into the repository root (the folder above source/), so index.html
// sits at the top of the repository and any static host can serve the repository as it is.
// Usage: npm run release   (builds, then copies)
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const SITE = path.resolve(ROOT, '..');
if (path.basename(ROOT) !== 'source') {
  console.error('This project is not inside a repository folder called "source", so nothing was copied.');
  process.exit(1);
}
let n = 0;
for (const name of await fs.readdir(DIST)) {
  await fs.rm(path.join(SITE, name), { recursive: true, force: true });
  await fs.cp(path.join(DIST, name), path.join(SITE, name), { recursive: true });
  n += 1;
}
console.log(`Copied ${n} items from source/dist into the repository root (${SITE}).`);
