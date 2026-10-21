// Security-print textures, generated as small SVG files:
// paper grain, paper fibre, guilloche rosettes and wave bands, and microprint strips.
import fs from 'node:fs/promises';
import path from 'node:path';
import opentype from 'opentype.js';
import { rosette, waveBand, toPath } from '../src/js/guilloche.js';

export async function buildTextures({ outDir, fontDir, licenceNo }) {
  await fs.mkdir(outDir, { recursive: true });
  const w = (name, svg) => fs.writeFile(path.join(outDir, name), svg.trim());

  // Paper grain (fine) and paper fibre (long, faint streaks).
  await w('grain.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.2 -.1"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>`);
  await w('fibre.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900"><filter id="f"><feTurbulence type="fractalNoise" baseFrequency=".003 .06" numOctaves="3" seed="7" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 2.2 -1"/></filter><rect width="100%" height="100%" filter="url(#f)"/></svg>`);

  // Guilloche rosette, three inks.
  const ros = rosette(1);
  const rosPaths = (stroke) => ros.map((p) => `<path d="${toPath(p, 1)}" fill="none" stroke="${stroke}" stroke-width=".6"/>`).join('');
  for (const [name, ink] of [['ink', '#0f1012'], ['red', '#d82028'], ['paper', '#f5f2ee']]) {
    await w(`rosette-${name}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-300 -300 600 600" width="600" height="600">${rosPaths(ink)}</svg>`);
  }
  // Wave band (horizontal, repeats on x).
  const band = waveBand({ width: 1200, height: 120, lines: 12, waves: 10 });
  for (const [name, ink] of [['ink', '#0f1012'], ['red', '#d82028'], ['paper', '#f5f2ee']]) {
    await w(`band-${name}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" width="1200" height="120" preserveAspectRatio="none">${band.map((p) => `<path d="${toPath(p, 1)}" fill="none" stroke="${ink}" stroke-width=".7"/>`).join('')}</svg>`);
  }

  // Microprint: real Archivo outlines at 5px, repeated along a strip.
  const font = opentype.loadSync(path.join(fontDir, 'archivo-600.ttf'));
  const text = `BIASHARA TRADING COMPANY LIMITED · LICENCE ${licenceNo} · `;
  const size = 5;
  const width = Math.ceil(font.getAdvanceWidth(text, size, { kerning: true, letterSpacing: 0.06 }) * 100) / 100;
  const glyphPath = font.getPath(text, 0, 4.6, size, { kerning: true, letterSpacing: 0.06 }).toPathData(2);
  for (const [name, ink, op] of [['ink', '#0f1012', 0.62], ['paper', '#f5f2ee', 0.55], ['red', '#d82028', 0.85]]) {
    await w(`micro-h-${name}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="6" viewBox="0 0 ${width} 6"><path d="${glyphPath}" fill="${ink}" fill-opacity="${op}"/></svg>`);
    await w(`micro-v-${name}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" width="6" height="${width}" viewBox="0 0 6 ${width}"><g transform="translate(6 0) rotate(90)"><path d="${glyphPath}" fill="${ink}" fill-opacity="${op}"/></g></svg>`);
  }
  return { microWidth: width };
}
