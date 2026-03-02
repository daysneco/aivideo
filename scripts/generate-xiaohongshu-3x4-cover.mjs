#!/usr/bin/env node
/**
 * 生成适合小红书的3:4封面图
 * 保持图片原始比例，添加深色科技感背景
 * 自动查找最新的豆瓣封面文件
 */

import { existsSync, readdirSync, statSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUTPUT_DIR = join(ROOT, 'output');

async function createTechBackground(width, height) {
  const sharp = (await import('sharp')).default;

  // 创建深色科技感背景
  const svgBackground = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- 渐变背景 -->
        <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#0a0a0f;stop-opacity:1" />
          <stop offset="50%" style="stop-color:#1a1a2e;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#0f0f23;stop-opacity:1" />
        </linearGradient>

        <!-- 科技网格 -->
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#16213e" stroke-width="0.5" opacity="0.3"/>
        </pattern>

        <!-- 光线效果 -->
        <radialGradient id="lightRay" cx="30%" cy="20%" r="80%">
          <stop offset="0%" style="stop-color:#00d4ff;stop-opacity:0.1" />
          <stop offset="70%" style="stop-color:#00d4ff;stop-opacity:0.02" />
          <stop offset="100%" style="stop-color:#00d4ff;stop-opacity:0" />
        </radialGradient>

        <!-- 第二道光线 -->
        <radialGradient id="lightRay2" cx="70%" cy="80%" r="60%">
          <stop offset="0%" style="stop-color:#ff006e;stop-opacity:0.08" />
          <stop offset="70%" style="stop-color:#ff006e;stop-opacity:0.01" />
          <stop offset="100%" style="stop-color:#ff006e;stop-opacity:0" />
        </radialGradient>
      </defs>

      <!-- 背景渐变 -->
      <rect width="${width}" height="${height}" fill="url(#bgGradient)"/>

      <!-- 科技网格 -->
      <rect width="${width}" height="${height}" fill="url(#grid)"/>

      <!-- 光线效果 -->
      <ellipse cx="${width * 0.3}" cy="${height * 0.2}" rx="${width * 0.8}" ry="${height * 0.8}" fill="url(#lightRay)"/>
      <ellipse cx="${width * 0.7}" cy="${height * 0.8}" rx="${width * 0.6}" ry="${height * 0.6}" fill="url(#lightRay2)"/>

      <!-- 科技线条 -->
      <path d="M0,${height * 0.3} Q${width * 0.3},${height * 0.1} ${width * 0.6},${height * 0.4} T${width},${height * 0.2}"
            stroke="#00d4ff" stroke-width="1" fill="none" opacity="0.3"/>
      <path d="M${width * 0.1},${height} Q${width * 0.4},${height * 0.7} ${width * 0.8},${height * 0.9} T${width * 0.9},0"
            stroke="#ff006e" stroke-width="1" fill="none" opacity="0.2"/>
    </svg>
  `;

  return sharp(Buffer.from(svgBackground));
}

async function generateXiaohongshuCover(inputPath, outputPath) {
  console.log('🎨 生成3:4小红书封面...');

  const sharp = (await import('sharp')).default;

  // 小红书3:4比例 (1080x1440)
  const canvasWidth = 1080;
  const canvasHeight = 1440;

  // 获取输入图片信息
  const inputMeta = await sharp(inputPath).metadata();
  const inputWidth = inputMeta.width;
  const inputHeight = inputMeta.height;

  console.log(`📏 原始图片尺寸: ${inputWidth}x${inputHeight}`);
  console.log(`📐 目标画布尺寸: ${canvasWidth}x${canvasHeight} (3:4)`);

  // 计算缩放比例，保持图片比例
  const scaleX = canvasWidth / inputWidth;
  const scaleY = canvasHeight / inputHeight;
  const scale = Math.min(scaleX, scaleY) * 0.8; // 留一些边距

  const newWidth = Math.floor(inputWidth * scale);
  const newHeight = Math.floor(inputHeight * scale);

  console.log(`🔄 缩放比例: ${(scale * 100).toFixed(1)}%`);
  console.log(`📏 缩放后尺寸: ${newWidth}x${newHeight}`);

  // 计算居中位置
  const offsetX = Math.floor((canvasWidth - newWidth) / 2);
  const offsetY = Math.floor((canvasHeight - newHeight) / 2);

  console.log(`📍 图片位置: (${offsetX}, ${offsetY})`);

  // 创建背景
  const background = await createTechBackground(canvasWidth, canvasHeight);

  // 处理图片
  const processedImage = await sharp(inputPath)
    .resize(newWidth, newHeight, {
      fit: 'inside',
      withoutEnlargement: false,
      kernel: 'lanczos3'
    })
    .png()
    .toBuffer();

  // 合成最终图片
  await background
    .composite([{
      input: processedImage,
      top: offsetY,
      left: offsetX
    }])
    .png({
      quality: 95,
      compressionLevel: 6
    })
    .toFile(outputPath);

  console.log('✅ 3:4小红书封面生成完成！');
  console.log(`📁 保存位置: ${outputPath}`);
}

async function main() {
  console.log('📖 3:4小红书封面生成工具\n');

  // 智能查找封面文件（优先最新的豆瓣封面）
  let sourceFile = null;
  let outputPath = join(OUTPUT_DIR, 'xiaohongshu_3x4.png');

  // 查找最新的豆瓣封面文件
  if (existsSync(OUTPUT_DIR)) {
    const files = readdirSync(OUTPUT_DIR)
      .filter(file => file.includes('_douban_cover.png'))
      .sort((a, b) => {
        const statA = statSync(join(OUTPUT_DIR, a));
        const statB = statSync(join(OUTPUT_DIR, b));
        return statB.mtime - statA.mtime; // 最新的在前
      });

    if (files.length > 0) {
      sourceFile = join(OUTPUT_DIR, files[0]);
      const bookName = files[0].replace('_douban_cover.png', '');
      outputPath = join(OUTPUT_DIR, `${bookName}_xiaohongshu_3x4.png`);
    }
  }

  // 如果没找到豆瓣封面，查找其他封面
  if (!sourceFile) {
    const fallbackSources = [
      join(ROOT, 'public/book_cover.png'),
      join(ROOT, 'public/xiaohongshu_cover.png'),
      join(OUTPUT_DIR, 'naval_cover.png'),
      join(OUTPUT_DIR, 'classic_cover_v4.png')
    ];

    for (const file of fallbackSources) {
      if (existsSync(file)) {
        sourceFile = file;
        break;
      }
    }
  }

  if (!sourceFile) {
    console.error('❌ 未找到任何封面文件');
    console.log('请先运行豆瓣封面获取命令:');
    console.log('  npm run fetch-douban-book-simple "书籍名称"');
    process.exit(1);
  }

  console.log('📄 使用封面文件:', sourceFile);

  // 优先使用豆瓣封面，如果没有则使用AI生成封面
  const possibleSources = [
    join(OUTPUT_DIR, 'xiaogouqianqian_douban_cover.png'),
    join(OUTPUT_DIR, 'xiaogouqianqian_cover.png'),
    join(ROOT, 'public/book_cover.png')
  ];

  let sourceFile = null;
  for (const file of possibleSources) {
    if (existsSync(file)) {
      sourceFile = file;
      console.log('📄 使用封面文件:', file);
      break;
    }
  }

  if (!sourceFile) {
    console.error('❌ 未找到任何封面文件');
    console.log('请先运行以下命令获取封面:');
    console.log('  npm run fetch-xiaogouqianqian-by-id');
    process.exit(1);
  }

  try {
    await generateXiaohongshuCover(sourceFile, outputPath);

    // 验证结果
    const sharp = (await import('sharp')).default;
    const resultMeta = await sharp(outputPath).metadata();

    console.log('\n📊 最终结果:');
    console.log(`📏 封面尺寸: ${resultMeta.width}x${resultMeta.height}`);
    console.log('📐 比例: 3:4 (适合小红书)');
    console.log('🎨 背景: 深色科技感 + 光线效果');
    console.log('✅ 图片: 保持原始比例，无裁剪');

    console.log('\n🎉 3:4封面生成完成！');

  } catch (error) {
    console.error('❌ 生成失败:', error.message);
    process.exit(1);
  }
}

main();