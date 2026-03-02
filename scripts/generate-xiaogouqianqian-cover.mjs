#!/usr/bin/env node
/**
 * 为《小狗钱钱》生成书籍封面
 * 由于豆瓣没有收录，使用AI生成适合的封面
 */

import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUTPUT_DIR = join(ROOT, 'output');

async function generateBookCover() {
  const coverPath = join(OUTPUT_DIR, 'xiaogouqianqian_cover.png');

  console.log('🎨 开始生成《小狗钱钱》书籍封面...\n');

  try {
    // 确保output目录存在
    if (!existsSync(OUTPUT_DIR)) {
      mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const { GoogleGenAI } = await import('@google/genai');
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error('请设置 GEMINI_API_KEY 环境变量');
    }

    const ai = new GoogleGenAI({ apiKey });

    // 设计适合小红书的封面提示
    const prompt = `Create a book cover illustration for "小狗钱钱" (The Little Money Book) by Bodo Schäfer.

Book theme: Financial education for children/teens, money management, wealth building.

Style requirements:
- Modern minimalist design
- Warm and friendly color palette (orange, yellow, blue tones)
- Include a cute cartoon dog (the book's mascot)
- Show money-related elements (coins, piggy bank, money tree)
- Clean typography with Chinese title "小狗钱钱"
- Subtitle in smaller text: "关于财富和成功的童话故事"
- Portrait orientation (9:16 ratio, suitable for video thumbnails)
- High contrast, vibrant colors
- Professional book cover appearance

The illustration should be visually appealing and convey the message of financial wisdom for young readers.`;

    console.log('🤖 正在生成封面图片...');

    const response = await ai.models.generateContent({
      model: process.env.MODEL_IMAGE || 'gemini-2.5-flash-image',
      contents: prompt,
      config: {
        imageConfig: {
          aspectRatio: '9:16', // 适合小红书视频封面
        },
      },
    });

    // 提取生成的图片
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        const imageData = part.inlineData.data;
        const buffer = Buffer.from(imageData, 'base64');

        // 保存图片
        const { writeFileSync } = await import('fs');
        writeFileSync(coverPath, buffer);

        console.log('✅ 封面生成成功！');
        console.log(`📁 保存位置: ${coverPath}`);

        // 验证图片尺寸
        const sharp = (await import('sharp')).default;
        const metadata = await sharp(coverPath).metadata();
        console.log(`📏 图片尺寸: ${metadata.width}x${metadata.height}`);

        return coverPath;
      }
    }

    throw new Error('未能生成图片');

  } catch (error) {
    console.error('❌ 生成封面失败:', error.message);
    throw error;
  }
}

async function generateXiaohongshuCover() {
  const originalCover = join(OUTPUT_DIR, 'xiaogouqianqian_cover.png');
  const xiaohongshuCover = join(OUTPUT_DIR, 'xiaogouqianqian_xiaohongshu_cover.png');

  console.log('📱 生成适合小红书的封面版本...\n');

  try {
    if (!existsSync(originalCover)) {
      throw new Error(`找不到原始封面文件: ${originalCover}`);
    }

    const sharp = (await import('sharp')).default;
    const metadata = await sharp(originalCover).metadata();

    console.log('🔍 检查原始封面尺寸...');
    console.log('📏 原始尺寸:', metadata.width + 'x' + metadata.height);

    // 检查是否已经是正方形
    const isSquare = Math.abs(metadata.width - metadata.height) / Math.max(metadata.width, metadata.height) < 0.1;

    if (isSquare && metadata.width === 1080 && metadata.height === 1080) {
      console.log('✅ 原始封面已是1080x1080，直接复制');
      await sharp(originalCover).png().toFile(xiaohongshuCover);
    } else {
      console.log('🔄 转换为1080x1080正方形...');

      // 计算裁剪参数（居中裁剪）
      const size = Math.min(metadata.width, metadata.height);
      const left = Math.max(0, Math.floor((metadata.width - size) / 2));
      const top = Math.max(0, Math.floor((metadata.height - size) / 2));

      console.log('✂️  裁剪参数:', { left, top, width: size, height: size });

      // 生成1080x1080版本
      await sharp(originalCover)
        .extract({ left, top, width: size, height: size })
        .resize(1080, 1080, {
          fit: 'cover',
          position: 'center',
          kernel: 'lanczos3'
        })
        .png({
          quality: 90,
          compressionLevel: 6
        })
        .toFile(xiaohongshuCover);

      console.log('✅ 小红书封面生成完成！');
    }

    // 验证结果
    const resultMeta = await sharp(xiaohongshuCover).metadata();
    console.log('📏 小红书封面尺寸:', resultMeta.width + 'x' + resultMeta.height);
    console.log(`📁 小红书封面位置: ${xiaohongshuCover}`);

    if (resultMeta.width === 1080 && resultMeta.height === 1080) {
      console.log('✨ 完美！符合小红书1080x1080要求');
    }

  } catch (error) {
    console.error('❌ 生成小红书封面失败:', error.message);
    throw error;
  }
}

async function main() {
  try {
    console.log('📖 《小狗钱钱》封面生成工具\n');

    // 1. 生成原始封面
    await generateBookCover();

    // 2. 生成小红书版本
    await generateXiaohongshuCover();

    console.log('\n🎉 《小狗钱钱》封面生成完成！');
    console.log('📂 文件位置:');
    console.log('   🖼️  原始封面: output/xiaogouqianqian_cover.png');
    console.log('   📱 小红书封面: output/xiaogouqianqian_xiaohongshu_cover.png');

  } catch (error) {
    console.error('\n💥 封面生成失败:', error.message);
    process.exit(1);
  }
}

main();