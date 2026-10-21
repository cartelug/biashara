// Photo pipeline: crop to the fixed ratio set, apply the shared grade, and write
// AVIF, WebP and JPEG at several widths. Results are cached in /.cache/img.
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const WIDTHS = [320, 480, 640, 800, 960, 1280, 1600, 2048];

// The shared grade: slight warmth and lifted blacks, the same for every photograph.
// Colour only — nothing is retouched.
const GRADE = { mul: [0.93, 0.92, 0.9], add: [14, 11, 8], saturation: 0.97 };

export async function buildImages({ images, srcDir, outDir, cacheDir }) {
  await fs.mkdir(cacheDir, { recursive: true });
  await fs.mkdir(outDir, { recursive: true });
  const manifest = {};
  for (const [key, m] of Object.entries(images)) {
    const src = path.join(srcDir, m.file);
    const [x, y, w, h] = m.crop;
    const widths = WIDTHS.filter((v) => v < w);
    if (!widths.length || widths[widths.length - 1] !== w) widths.push(w);
    const sig = crypto.createHash('md5').update(JSON.stringify([m, GRADE, widths, fss.statSync(src).mtimeMs])).digest('hex').slice(0, 10);
    const stamp = path.join(cacheDir, `${key}.${sig}.ok`);
    if (!fss.existsSync(stamp)) {
      for (const f of await fs.readdir(cacheDir)) if (f.startsWith(key + '-') || f.startsWith(key + '.')) await fs.rm(path.join(cacheDir, f));
      let base = sharp(src).extract({ left: x, top: y, width: w, height: h }).toColorspace('srgb');
      if (m.grade !== false) base = base.modulate({ saturation: GRADE.saturation }).linear(GRADE.mul, GRADE.add);
      const buf = await base.toBuffer();
      for (const width of widths) {
        const r = sharp(buf).resize({ width, withoutEnlargement: true });
        await r.clone().avif({ quality: 52, effort: 6 }).toFile(path.join(cacheDir, `${key}-${width}.avif`));
        await r.clone().webp({ quality: 74 }).toFile(path.join(cacheDir, `${key}-${width}.webp`));
        await r.clone().jpeg({ quality: 78, mozjpeg: true, progressive: true }).toFile(path.join(cacheDir, `${key}-${width}.jpg`));
      }
      await fs.writeFile(stamp, '');
    }
    for (const width of widths) for (const ext of ['avif', 'webp', 'jpg']) {
      await fs.copyFile(path.join(cacheDir, `${key}-${width}.${ext}`), path.join(outDir, `${key}-${width}.${ext}`));
    }
    manifest[key] = { widths, width: w, height: h, sourceWidth: w };
  }
  return manifest;
}
