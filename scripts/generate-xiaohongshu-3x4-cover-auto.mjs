#!/usr/bin/env node
/**
 * 生成适合小红书的3:4封面图
 * 自动查找最新的豆瓣封面，保持图片原始比例，添加深色科技感背景
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

  // 创建更炫酷的科技感背景
  const svgBackground = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- 主背景渐变 -->
        <radialGradient id="bgGradient" cx="50%" cy="50%" r="80%">
          <stop offset="0%" style="stop-color:#0d1117;stop-opacity:1" />
          <stop offset="40%" style="stop-color:#161b22;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#0a0a0f;stop-opacity:1" />
        </radialGradient>

        <!-- 科技网格 -->
        <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
          <rect width="30" height="30" fill="none"/>
          <circle cx="15" cy="15" r="1" fill="#00d4ff" opacity="0.1"/>
          <path d="M0,15 L30,15 M15,0 L15,30" stroke="#00d4ff" stroke-width="0.3" opacity="0.2"/>
        </pattern>

        <!-- 数据流效果 -->
        <pattern id="dataFlow" width="100" height="20" patternUnits="userSpaceOnUse">
          <rect width="100" height="20" fill="none"/>
          <circle cx="10" cy="10" r="1" fill="#ff006e" opacity="0.8">
            <animate attributeName="cx" values="10;90;10" dur="3s" repeatCount="indefinite"/>
          </circle>
          <circle cx="30" cy="10" r="0.8" fill="#00d4ff" opacity="0.6">
            <animate attributeName="cx" values="30;10;90" dur="4s" repeatCount="indefinite"/>
          </circle>
          <circle cx="70" cy="10" r="0.6" fill="#8338ec" opacity="0.7">
            <animate attributeName="cx" values="70;30;70" dur="5s" repeatCount="indefinite"/>
          </circle>
        </pattern>

        <!-- 霓虹光晕 -->
        <radialGradient id="neonGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" style="stop-color:#00d4ff;stop-opacity:0.3" />
          <stop offset="50%" style="stop-color:#ff006e;stop-opacity:0.2" />
          <stop offset="100%" style="stop-color:#8338ec;stop-opacity:0.1" />
        </radialGradient>

        <!-- 几何图形 -->
        <polygon id="hexagon" points="15,4 26,11 26,22 15,29 4,22 4,11" fill="none" stroke="#00d4ff" stroke-width="0.5" opacity="0.4"/>
        <circle id="techCircle" cx="15" cy="15" r="8" fill="none" stroke="#ff006e" stroke-width="0.3" opacity="0.3"/>
      </defs>

      <!-- 主背景 -->
      <rect width="${width}" height="${height}" fill="url(#bgGradient)"/>

      <!-- 科技网格背景 -->
      <rect width="${width}" height="${height}" fill="url(#grid)"/>

      <!-- 数据流动效果 -->
      <rect x="0" y="${height * 0.2}" width="${width}" height="20" fill="url(#dataFlow)"/>
      <rect x="0" y="${height * 0.6}" width="${width}" height="20" fill="url(#dataFlow)"/>

      <!-- 霓虹光晕 -->
      <ellipse cx="${width * 0.8}" cy="${height * 0.2}" rx="${width * 0.3}" ry="${height * 0.3}" fill="url(#neonGlow)"/>

      <!-- 几何装饰 -->
      <use href="#hexagon" x="${width * 0.1}" y="${height * 0.1}" transform="scale(0.8)"/>
      <use href="#techCircle" x="${width * 0.85}" y="${height * 0.7}" transform="scale(1.2)"/>
      <use href="#hexagon" x="${width * 0.7}" y="${height * 0.8}" transform="scale(0.6)"/>

      <!-- 动态线条 -->
      <path d="M${width * 0.1},${height * 0.3} Q${width * 0.4},${height * 0.1} ${width * 0.8},${height * 0.4}"
            stroke="#00d4ff" stroke-width="2" fill="none" opacity="0.6">
        <animate attributeName="stroke-dasharray" values="0,100;100,0" dur="3s" repeatCount="indefinite"/>
      </path>

      <path d="M${width * 0.9},${height * 0.7} Q${width * 0.6},${height * 0.9} ${width * 0.2},${height * 0.6}"
            stroke="#ff006e" stroke-width="1.5" fill="none" opacity="0.5">
        <animate attributeName="stroke-dasharray" values="0,80;80,0" dur="4s" repeatCount="indefinite"/>
      </path>

      <!-- 粒子效果 -->
      <circle cx="${width * 0.2}" cy="${height * 0.8}" r="2" fill="#00d4ff" opacity="0.7">
        <animate attributeName="opacity" values="0.7;0.3;0.7" dur="2s" repeatCount="indefinite"/>
      </circle>
      <circle cx="${width * 0.8}" cy="${height * 0.3}" r="1.5" fill="#ff006e" opacity="0.6">
        <animate attributeName="opacity" values="0.6;0.2;0.6" dur="3s" repeatCount="indefinite"/>
      </circle>
      <circle cx="${width * 0.5}" cy="${height * 0.5}" r="1" fill="#8338ec" opacity="0.8">
        <animate attributeName="opacity" values="0.8;0.4;0.8" dur="2.5s" repeatCount="indefinite"/>
      </circle>
    </svg>
  `;

  return sharp(Buffer.from(svgBackground));
}

async function generateXiaohongshuCover(inputPath, outputPath) {
  console.log('🎨 生成3:4小红书封面（3D书籍效果）...');

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
  const scale = Math.min(scaleX, scaleY) * 0.75; // 留更多边距给3D效果

  const newWidth = Math.floor(inputWidth * scale);
  const newHeight = Math.floor(inputHeight * scale);

  console.log(`🔄 缩放比例: ${(scale * 100).toFixed(1)}%`);
  console.log(`📏 缩放后尺寸: ${newWidth}x${newHeight}`);

  // 计算居中位置（确保都是整数）
  const offsetX = Math.floor((canvasWidth - newWidth) / 2);
  const offsetY = Math.floor((canvasHeight - newHeight) / 2);

  console.log(`📍 图片位置: (${offsetX}, ${offsetY})`);

  // 创建背景
  const background = await createTechBackground(canvasWidth, canvasHeight);

  // 创建真正的3D书籍效果
  const bookLayers = [];

  // 1. 书籍阴影（最底层，椭圆形）
  const shadowWidth = Math.floor(newWidth * 1.1);
  const shadowHeight = Math.floor(newHeight * 0.25);
  const shadowImage = Buffer.from(`
    <svg width="${shadowWidth}" height="${shadowHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="shadowGrad" cx="50%" cy="30%" r="70%">
          <stop offset="0%" style="stop-color:#000000;stop-opacity:0.6" />
          <stop offset="70%" style="stop-color:#000000;stop-opacity:0.2" />
          <stop offset="100%" style="stop-color:#000000;stop-opacity:0" />
        </radialGradient>
      </defs>
      <ellipse cx="${shadowWidth/2}" cy="${shadowHeight * 0.6}" rx="${Math.floor(newWidth * 0.7)}" ry="${Math.floor(newHeight * 0.3)}" fill="url(#shadowGrad)"/>
    </svg>
  `);

  const processedShadow = await sharp(shadowImage)
    .png()
    .toBuffer();

  bookLayers.push({
    input: processedShadow,
    top: Math.max(0, offsetY + newHeight - shadowHeight + 20),
    left: Math.max(0, Math.floor(offsetX + (newWidth - shadowWidth) / 2)),
    blend: 'multiply'
  });

  // 2. 书籍背面（3D透视效果）
  const backWidth = Math.floor(newWidth * 0.9);
  const backImage = await sharp(inputPath)
    .resize(backWidth, newHeight, {
      fit: 'inside',
      withoutEnlargement: false,
      kernel: 'lanczos3'
    })
    .modulate({ brightness: 0.7, saturation: 0.8 })
    .png()
    .toBuffer();

  bookLayers.push({
    input: backImage,
    top: offsetY + 15,
    left: offsetX + 15
  });

  // 3. 书籍主体（正面）
  const mainImage = await sharp(inputPath)
    .resize(newWidth, newHeight, {
      fit: 'inside',
      withoutEnlargement: false,
      kernel: 'lanczos3'
    })
    .png()
    .toBuffer();

  bookLayers.push({
    input: mainImage,
    top: offsetY,
    left: offsetX
  });

  // 4. 书籍侧面（厚度效果）
  const sideWidth = 20;
  const sideImage = Buffer.from(`
    <svg width="${sideWidth}" height="${newHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sideGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#666666" />
          <stop offset="100%" style="stop-color:#999999" />
        </linearGradient>
      </defs>
      <rect width="${sideWidth}" height="${newHeight}" fill="url(#sideGrad)"/>
    </svg>
  `);

  const processedSide = await sharp(sideImage)
    .png()
    .toBuffer();

  bookLayers.push({
    input: processedSide,
    top: offsetY,
    left: offsetX + newWidth
  });

  // 5. 高光效果（左上角）
  const highlightSize = Math.floor(Math.min(newWidth, newHeight) * 0.3);
  const highlightImage = Buffer.from(`
    <svg width="${highlightSize}" height="${highlightSize}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="highlightGrad" cx="30%" cy="30%" r="70%">
          <stop offset="0%" style="stop-color:#ffffff;stop-opacity:0.8" />
          <stop offset="100%" style="stop-color:#ffffff;stop-opacity:0" />
        </radialGradient>
      </defs>
      <ellipse cx="${Math.floor(highlightSize * 0.3)}" cy="${Math.floor(highlightSize * 0.3)}" rx="${Math.floor(highlightSize * 0.6)}" ry="${Math.floor(highlightSize * 0.6)}" fill="url(#highlightGrad)"/>
    </svg>
  `);

  const processedHighlight = await sharp(highlightImage)
    .png()
    .toBuffer();

  bookLayers.push({
    input: processedHighlight,
    top: offsetY,
    left: offsetX,
    blend: 'screen',
    opacity: 0.6
  });

  // 6. 科技边框效果
  const borderWidth = 6;
  const borderPadding = 10; // 额外边距避免负数
  const borderImage = Buffer.from(`
    <svg width="${newWidth + borderWidth * 2 + borderPadding * 2}" height="${newHeight + borderWidth * 2 + borderPadding * 2}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="techBorder" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#00d4ff;stop-opacity:0.9" />
          <stop offset="25%" style="stop-color:#ff006e;stop-opacity:0.8" />
          <stop offset="50%" style="stop-color:#8338ec;stop-opacity:0.7" />
          <stop offset="75%" style="stop-color:#ff006e;stop-opacity:0.8" />
          <stop offset="100%" style="stop-color:#00d4ff;stop-opacity:0.9" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <rect x="${borderWidth/2 + borderPadding}" y="${borderWidth/2 + borderPadding}" width="${newWidth + borderWidth}" height="${newHeight + borderWidth}"
            fill="none" stroke="url(#techBorder)" stroke-width="${borderWidth}" rx="12" filter="url(#glow)"/>
    </svg>
  `);

  const processedBorder = await sharp(borderImage)
    .png()
    .toBuffer();

  bookLayers.push({
    input: processedBorder,
    top: Math.max(0, offsetY - borderWidth),
    left: Math.max(0, offsetX - borderWidth)
  });

  // 合成最终图片
  await background
    .composite(bookLayers)
    .png({
      quality: 95,
      compressionLevel: 6
    })
    .toFile(outputPath);

  console.log('✅ 3D科技感封面生成完成！');
  console.log(`📁 保存位置: ${outputPath}`);
  console.log('🎨 3D效果: 阴影 + 高光 + 立体边框 + 科技背景');
}

async function main() {
  console.log('📖 智能3:4小红书封面生成工具\n');

  // 智能查找封面文件（优先最新的豆瓣封面）
  let sourceFile = null;
  let outputPath = join(OUTPUT_DIR, 'auto_xiaohongshu_3x4.png');

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
      console.log(`📚 检测到书籍: ${bookName}`);
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