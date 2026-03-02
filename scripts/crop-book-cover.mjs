#!/usr/bin/env node
/**
 * Crop book cover image: keep only the book, remove background.
 * Reads from public/book_cover.png or public/book_cover.jpg, writes to public/book_cover.png.
 *
 * Strategies:
 *   trim  - Remove uniform-color edges (best when background is solid). Default.
 *   center - Take center portion (e.g. 85% width × 85% height) to cut margins.
 *
 * Usage:
 *   node scripts/crop-book-cover.mjs              # trim, overwrite with public/book_cover.png
 *   node scripts/crop-book-cover.mjs --center    # center crop 85%
 *   node scripts/crop-book-cover.mjs --center=0.9
 */
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PUBLIC = join(ROOT, 'public');

const DEFAULT_INPUTS = ['book_cover.png', 'book_cover.jpg'].map((name) => join(PUBLIC, name));
const DEFAULT_OUTPUT = join(PUBLIC, 'book_cover.png');

function getArg(name, defaultValue) {
  const eq = process.argv.find((a) => a.startsWith(name + '='));
  if (eq) return eq.slice(name.length + 1);
  const i = process.argv.indexOf(name);
  if (i === -1) return defaultValue;
  const next = process.argv[i + 1];
  return next && !next.startsWith('-') ? next : defaultValue;
}

function parseCenter(value) {
  const n = parseFloat(value);
  if (Number.isFinite(n) && n > 0 && n <= 1) return n;
  return 0.85;
}

async function main() {
  const useCenter = process.argv.includes('--center');
  const centerRatio = parseCenter(getArg('--center', '0.85'));
  const inputPath = getArg('--input', null) || DEFAULT_INPUTS.find((p) => existsSync(p));
  const outputPath = getArg('--output', DEFAULT_OUTPUT);

  if (!inputPath || !existsSync(inputPath)) {
    console.error('No input image found. Place book cover at public/book_cover.png or public/book_cover.jpg');
    process.exit(1);
  }

  const sharp = (await import('sharp')).default;

  if (useCenter) {
    const meta = await sharp(inputPath).metadata();
    const w = meta.width || 0;
    const h = meta.height || 0;
    if (!w || !h) {
      console.error('Could not read image dimensions.');
      process.exit(1);
    }
    const cw = Math.round(w * centerRatio);
    const ch = Math.round(h * centerRatio);
    const left = Math.round((w - cw) / 2);
    const top = Math.round((h - ch) / 2);
    await sharp(inputPath)
      .extract({ left, top, width: cw, height: ch })
      .png()
      .toFile(outputPath);
    console.log(`Center crop: ${w}×${h} → ${cw}×${ch} (${(centerRatio * 100) | 0}%)`);
  } else {
    const before = await sharp(inputPath).metadata();
    const w0 = before.width || 0;
    const h0 = before.height || 0;
    const trimmed = await sharp(inputPath).trim({ threshold: 15 }).toBuffer();
    const after = await sharp(trimmed).metadata();
    await sharp(trimmed).png().toFile(outputPath);
    console.log(`Trim: ${w0}×${h0} → ${after.width}×${after.height} (removed uniform edges)`);
  }

  console.log(`Saved: ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
