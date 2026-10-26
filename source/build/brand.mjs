// Logo sizes, favicons and 1200×630 social cards, all from the real logo file.
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import opentype from 'opentype.js';
import { rosette, toPath } from './guilloche.mjs';

// The red square of the logo (with the B) — measured from the logo file: x 36–858, y 6–908.
const MARK = { left: 36, top: 6, width: 822, height: 902 };

export async function buildIcons({ logo, outDir }) {
  const dir = path.join(outDir, 'assets/img/logo');
  await fs.mkdir(dir, { recursive: true });
  for (const w of [96, 192, 320, 512]) {
    const img = sharp(logo).resize({ width: w });
    await img.clone().png({ compressionLevel: 9 }).toFile(path.join(dir, `biashara-logo-${w}.png`));
    await img.clone().webp({ quality: 92 }).toFile(path.join(dir, `biashara-logo-${w}.webp`));
  }
  // Mark only (the red square), for the favicon, the preloader and the curtain.
  const mark = sharp(logo).extract(MARK);
  for (const s of [160, 320]) {
    await mark.clone().resize({ width: s }).png({ compressionLevel: 9 }).toFile(path.join(dir, `mark-${s}.png`));
    await mark.clone().resize({ width: s }).webp({ quality: 92 }).toFile(path.join(dir, `mark-${s}.webp`));
  }
  // Square icons: the mark centred on white.
  const square = async (size, pad, file) => {
    const inner = Math.round(size * (1 - pad * 2));
    const m = await mark.clone().resize({ width: inner, height: inner, fit: 'contain', background: '#ffffff' }).png().toBuffer();
    await sharp({ create: { width: size, height: size, channels: 4, background: '#ffffff' } })
      .composite([{ input: m, gravity: 'center' }]).png({ compressionLevel: 9 }).toFile(path.join(dir, file));
  };
  await square(180, 0.06, 'apple-touch-icon.png');
  await square(192, 0.04, 'icon-192.png');
  await square(512, 0.04, 'icon-512.png');
  await square(512, 0.14, 'icon-maskable-512.png');
  await square(32, 0.0, 'favicon-32.png');
  // favicon.ico holding a 32×32 and 16×16 PNG
  const png32 = await fs.readFile(path.join(dir, 'favicon-32.png'));
  const png16 = await mark.clone().resize({ width: 16, height: 16, fit: 'contain', background: '#ffffff' }).png().toBuffer();
  await fs.writeFile(path.join(outDir, 'favicon.ico'), ico([[16, png16], [32, png32]]));
  return { markAspect: MARK.height / MARK.width };
}

function ico(list) {
  const header = Buffer.alloc(6); header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(list.length, 4);
  const dirs = []; let offset = 6 + 16 * list.length;
  for (const [size, buf] of list) {
    const d = Buffer.alloc(16);
    d.writeUInt8(size, 0); d.writeUInt8(size, 1); d.writeUInt8(0, 2); d.writeUInt8(0, 3);
    d.writeUInt16LE(1, 4); d.writeUInt16LE(32, 6); d.writeUInt32LE(buf.length, 8); d.writeUInt32LE(offset, 12);
    dirs.push(d); offset += buf.length;
  }
  return Buffer.concat([header, ...dirs, ...list.map((x) => x[1])]);
}

// Social cards: paper, a faint rosette, the real logo, the page name set in Archivo, and the span.
export async function buildOgImages({ pages, parts, outDir, fontDir, logo, cacheDir }) {
  await fs.mkdir(outDir, { recursive: true });
  await fs.mkdir(cacheDir, { recursive: true });
  const bold = opentype.loadSync(path.join(fontDir, 'archivo-800.ttf'));
  const label = opentype.loadSync(path.join(fontDir, 'archivo-600.ttf'));
  const serif = opentype.loadSync(path.join(fontDir, 'sourceserif-400.ttf'));
  const logoBuf = await sharp(logo).resize({ height: 190 }).png().toBuffer();
  const ros = rosette(1.25).map((p) => `<path d="${toPath(p, 1)}" fill="none" stroke="#0f1012" stroke-opacity=".09" stroke-width=".8"/>`).join('');
  const spaced = (s) => s.split('').join(' ');

  const headlines = {
    express: ['BIASHARA', 'EXPRESS / V6'],
    home: ['SHORT-TERM', 'BRIDGE FINANCING.'],
    about: ['ABOUT', 'BIASHARA'], loans: ['OUR LOAN', 'SOLUTIONS'], 'how-we-lend': ['HOW WE', 'LEND'],
    terms: ['TERMS', '& CHARGES'], 'who-we-serve': ['WHO WE', 'SERVE'], team: ['LEADERSHIP &', 'ORGANISATION'],
    licence: ['MONEY LENDING', 'LICENCE'], faq: ['QUESTIONS', '& ANSWERS'], contact: ['CONTACT', 'US'],
    apply: ['ASSEMBLE YOUR', 'LOAN FILE'], profile: ['COMPANY', 'PROFILE 2026'], privacy: ['PRIVACY'],
  };
  for (const p of pages) {
    const lines = headlines[p.id]; if (!lines) continue;
    const sig = crypto.createHash('md5').update(JSON.stringify([p, lines, 'v3'])).digest('hex').slice(0, 8);
    const cached = path.join(cacheDir, `${p.id}.${sig}.png`);
    if (!fss.existsSync(cached)) {
      const size = lines.some((l) => l.length > 13) ? 92 : 112;
      const head = lines.map((l, i) => bold.getPath(l, 72, 330 + i * size * 0.96, size).toPathData(1)).join('');
      const runhead = label.getPath(spaced(parts[p.part]), 72, 78, 15).toPathData(1);
      const foot = label.getPath(spaced('BIASHARA TRADING COMPANY LIMITED · SINCE 2014 · LICENCE 1451/ML'), 72, 572, 14).toPathData(1);
      const sub = p.id === 'home' ? serif.getPath('Up to 6 months · UGX 1–50M · 2.8% per month', 72, 330 + lines.length * size * 0.96 + 22, 30).toPathData(1) : '';
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#f5f2ee"/>
<g transform="translate(980 300)">${ros}</g>
<path d="${runhead}" fill="#6b6a68"/>
<rect x="72" y="100" width="1056" height="1" fill="#0f1012" fill-opacity=".14"/>
<path d="${head}" fill="#0f1012"/>
${sub ? `<path d="${sub}" fill="#0f1012"/>` : ''}
<rect x="0" y="${p.id === 'home' ? 470 : 450}" width="1200" height="2" fill="#d82028"/>
<rect x="72" y="540" width="1056" height="1" fill="#0f1012" fill-opacity=".14"/>
<path d="${foot}" fill="#0f1012"/>
<rect x="1108" y="556" width="20" height="20" fill="#d82028"/>
</svg>`;
      await sharp(Buffer.from(svg)).composite([{ input: logoBuf, top: 132, left: 1000 }]).png({ compressionLevel: 9 }).toFile(cached);
    }
    await fs.copyFile(cached, path.join(outDir, `${p.id}.png`));
  }
}
