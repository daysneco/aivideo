#!/usr/bin/env node
/**
 * 根据书名生成书籍封面图片
 * 使用AI生成适合书籍主题的封面设计
 */

import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// 自动加载环境变量
const { config } = await import('dotenv');
const envPath = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');
config({ path: envPath });

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUTPUT_DIR = join(ROOT, 'output');

async function generateCoverByTitle(bookTitle) {
  console.log(`🎨 开始为《${bookTitle}》生成AI封面...`);

  // 确保输出目录存在
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const outputPath = join(OUTPUT_DIR, `${bookTitle.replace(/[^\w\u4e00-\u9fff]/g, '_')}_ai_cover.png`);

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error('请设置 GEMINI_API_KEY 环境变量');
    }

    const ai = new GoogleGenAI({ apiKey });

    // 构建详细的封面生成提示
    const prompt = `Create a professional book cover for the book titled "${bookTitle}".

Book cover design requirements:
- Size: Portrait orientation, suitable for Xiaohongshu (3:4 aspect ratio)
- Style: Modern, clean, and sophisticated
- Theme: Analyze the book title and create relevant visual elements
- Typography: Include the book title prominently in both Chinese and English if applicable
- Color scheme: Professional and appealing color palette
- Elements: Books, knowledge symbols, or relevant metaphors
- Quality: High resolution, publication-ready quality
- NO WATERMARKS: Do not add any watermarks, logos, or platform identifiers
- CLEAN DESIGN: Keep the design clean without any branding elements

Specific design for "${bookTitle}":
- Create visual metaphors that represent the book's core concepts
- Use elegant typography with good hierarchy
- Include subtle decorative elements that enhance the theme
- Ensure the design is suitable for a Chinese audience
- Make it visually striking and memorable
- IMPORTANT: No watermarks, no logos, no platform branding

The final result should be a clean, professional book cover ready for publication without any watermarks or branding.`;

    console.log('🤖 正在生成封面图片...');

    const response = await ai.models.generateContent({
      model: process.env.MODEL_IMAGE || 'gemini-2.0-flash-exp',
      contents: prompt,
      config: {
        imageConfig: {
          aspectRatio: '3:4', // 小红书封面比例
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
        writeFileSync(outputPath, buffer);

        console.log('✅ 封面生成成功！');
        console.log(`📁 保存位置: ${outputPath}`);

        // 验证图片尺寸
        const sharp = (await import('sharp')).default;
        const metadata = await sharp(outputPath).metadata();
        console.log(`📏 图片尺寸: ${metadata.width}x${metadata.height}`);

        return outputPath;
      }
    }

    throw new Error('未能生成图片');

  } catch (error) {
    console.error('❌ 生成封面失败:', error.message);
    throw error;
  }
}

// 智能分析书名并生成更具体的提示
function generateDetailedPrompt(bookTitle) {
  // 分析书名关键词
  const keywords = bookTitle.toLowerCase();

  let theme = '';
  let colors = '';
  let elements = '';

  // 根据关键词确定主题
  if (keywords.includes('思考') || keywords.includes('thinking')) {
    theme = 'mind, brain, thinking process, psychology';
    colors = 'blue and purple tones for intelligence and depth';
    elements = 'brain imagery, lightbulb, gears turning, thought bubbles';
  } else if (keywords.includes('快与慢') || keywords.includes('fast and slow')) {
    theme = 'time, speed, decision making, duality';
    colors = 'contrasting colors representing fast (red/orange) and slow (blue/green)';
    elements = 'hourglass, running figure vs thinking figure, clock hands';
  } else if (keywords.includes('投资') || keywords.includes('理财') || keywords.includes('investment')) {
    theme = 'wealth, money, finance, growth';
    colors = 'gold, green, and black for money and success';
    elements = 'coins, money tree, upward arrows, graphs';
  } else if (keywords.includes('成功') || keywords.includes('success')) {
    theme = 'achievement, victory, progress';
    colors = 'gold and royal blue';
    elements = 'mountain peak, trophy, upward staircase';
  } else if (keywords.includes('心理学') || keywords.includes('psychology')) {
    theme = 'mind, behavior, human nature';
    colors = 'deep blues and greens';
    elements = 'brain, human silhouette, maze, lightbulb';
  } else {
    theme = 'knowledge, wisdom, learning';
    colors = 'classic and elegant colors';
    elements = 'books, light, wisdom symbols';
  }

  return `Create a stunning book cover for "${bookTitle}".

Design theme: ${theme}
Color scheme: ${colors}
Visual elements: ${elements}

Requirements:
- Portrait orientation (3:4 aspect ratio)
- Modern and sophisticated design
- Include the book title prominently
- Professional typography
- High-quality, publication-ready
- Suitable for Chinese readers
- Visually striking and memorable
- NO WATERMARKS: Do not add any watermarks, logos, or platform identifiers
- CLEAN DESIGN: Keep the design clean without any branding elements`;
}

async function main() {
  // 获取命令行参数中的书籍名称，如果没有则从环境变量获取
  const args = process.argv.slice(2);
  let bookTitle = args[0];

  // 如果没有命令行参数，尝试从环境变量获取书名
  if (!bookTitle) {
    bookTitle = process.env.BOOK_NAME || process.env.BOOK_TITLE;
  }

  if (!bookTitle) {
    console.log('❌ 请提供书籍名称');
    console.log('');
    console.log('📖 使用方法:');
    console.log('  node scripts/generate-cover-by-title.mjs "书籍名称"');
    console.log('');
    console.log('📚 示例:');
    console.log('  node scripts/generate-cover-by-title.mjs "思考，快与慢"');
    console.log('  node scripts/generate-cover-by-title.mjs "Atomic Habits"');
    console.log('');
    console.log('💡 提示: 也可以设置环境变量 BOOK_NAME 或 BOOK_TITLE');
    process.exit(1);
  }

  console.log(`🎨 AI封面生成器 - 为《${bookTitle}》创建专业封面\n`);

  try {
    const outputPath = await generateCoverByTitle(bookTitle);

    console.log('\n🎉 书籍封面生成完成！');
    console.log(`📖 书籍: 《${bookTitle}》`);
    console.log(`🖼️  封面: ${outputPath}`);
    console.log('\n💡 提示: 这是一个AI生成的封面设计，');
    console.log('         你可以将其用作基础设计或进一步修改。');

  } catch (error) {
    console.error('\n💥 封面生成失败:', error.message);
    console.log('\n🔧 故障排除:');
    console.log('1. 检查 GEMINI_API_KEY 是否正确设置');
    console.log('2. 检查网络连接是否正常');
    console.log('3. 尝试使用不同的书名重新生成');
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { generateCoverByTitle, generateDetailedPrompt };