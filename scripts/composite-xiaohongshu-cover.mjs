#!/usr/bin/env node
/**
 * 合成小红书 3:4 封面图：AI 风景背景 + 书封叠在上方
 * 输出 1080x1440 PNG
 */
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PUBLIC = join(ROOT, 'public');
const OUTPUT_DIR = join(ROOT, 'output');

const W = 1080;
const H = 1440; // 3:4

async function main() {
  const sharp = (await import('sharp')).default;

  const bgPath = join(PUBLIC, 'intro_background.png');
  const coverPath = join(PUBLIC, 'book_cover.png');

  if (!existsSync(bgPath)) {
    console.error('❌ 未找到 public/intro_background.png，请先运行: node scripts/generate-intro-background.mjs');
    process.exit(1);
  }
  if (!existsSync(coverPath)) {
    console.error('❌ 未找到 public/book_cover.png');
    process.exit(1);
  }

  // 1. 背景：风景图裁剪/缩放到 1080x1440，提亮、增强饱和度、锐化
  const background = await sharp(bgPath)
    .resize(W, H, { fit: 'cover', position: 'center', kernel: 'lanczos3' })
    .modulate({ brightness: 1.1, saturation: 1.25 })
    .sharpen({ sigma: 0.8, m1: 1, m2: 0.5 })
    .toBuffer();

  // 2. 书封：缩放到约 65% 画布高度，保持比例，居中
  const coverMaxHeight = Math.floor(H * 0.65);
  const coverMeta = await sharp(coverPath).metadata();
  const scale = Math.min(W / coverMeta.width, coverMaxHeight / coverMeta.height) * 0.9;
  const cw = Math.floor(coverMeta.width * scale);
  const ch = Math.floor(coverMeta.height * scale);
  const cx = Math.floor((W - cw) / 2);
  const cy = Math.floor((H - ch) / 2);

  const bookBuffer = await sharp(coverPath)
    .resize(cw, ch, { fit: 'inside', kernel: 'lanczos3' })
    .toBuffer();

  // 圆角矩形蒙版（可选，sharp 无内置 roundCorners 则用矩形）
  const radius = 24;
  const roundedMask = Buffer.from(`
    <svg width="${cw}" height="${ch}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${cw}" height="${ch}" rx="${radius}" ry="${radius}" fill="white"/>
    </svg>
  `);
  const bookRounded = await sharp(bookBuffer)
    .composite([{ input: roundedMask, blend: 'dest-in' }])
    .toBuffer();

  // 3. 书封阴影（简单椭圆）
  const shadowW = Math.floor(cw * 1.1);
  const shadowH = Math.floor(ch * 0.15);
  const shadowBuf = Buffer.from(`
    <svg width="${shadowW}" height="${shadowH}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="s" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stop-color="#000" stop-opacity="0.5"/>
          <stop offset="100%" stop-color="#000" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <ellipse cx="${shadowW/2}" cy="${shadowH*0.6}" rx="${Math.floor(cw*0.45)}" ry="${Math.floor(shadowH*0.8)}" fill="url(#s)"/>
    </svg>
  `);
  const shadowImg = await sharp(shadowBuf).png().toBuffer();

  // 4. 合成：背景 + 阴影 + 书封
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
  const outPath = join(OUTPUT_DIR, 'xiaohongshu_cover_landscape.png');
  await sharp(background)
    .composite([
      {
        input: shadowImg,
        top: cy + ch - Math.floor(shadowH * 0.3),
        left: Math.floor((W - shadowW) / 2),
        blend: 'multiply',
      },
      {
        input: bookRounded,
        top: cy,
        left: cx,
      },
    ])
    .png({ quality: 95 })
    .toFile(outPath);

  console.log('✅ 小红书封面已合成（风景背景 + 书封）');
  console.log('📁 输出:', outPath);
  console.log('📐 尺寸: 1080×1440 (3:4)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
