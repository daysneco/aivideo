#!/usr/bin/env node
/**
 * 手动上传书籍封面脚本
 * 允许用户手动指定封面图片路径或URL
 */

import { existsSync, copyFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PUBLIC_COVER_PATH = join(ROOT, 'public', 'book_cover_real.png');

async function downloadImage(url, outputPath) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.startsWith('image/')) {
      throw new Error(`Invalid content type: ${contentType}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // 检查是否为有效的图片文件
    if (buffer.length < 100) {
      throw new Error('Image file too small');
    }

    // 检查JPEG/PNG头
    const isJPEG = buffer[0] === 0xFF && buffer[1] === 0xD8;
    const isPNG = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;

    if (!isJPEG && !isPNG) {
      throw new Error('Invalid image format (only JPEG/PNG supported)');
    }

    writeFileSync(outputPath, buffer);
    return true;
  } catch (error) {
    throw new Error(`Download failed: ${error.message}`);
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log('📖 手动上传书籍封面脚本');
    console.log('');
    console.log('📋 功能说明:');
    console.log('   • 支持从URL下载封面图片');
    console.log('   • 支持从本地文件复制封面');
    console.log('   • 自动验证图片格式和质量');
    console.log('');
    console.log('💡 使用方法:');
    console.log('   node scripts/upload-cover.mjs "https://example.com/cover.jpg"');
    console.log('   node scripts/upload-cover.mjs "/path/to/local/cover.png"');
    console.log('');
    console.log('📚 示例:');
    console.log('   node scripts/upload-cover.mjs "https://covers.openlibrary.org/b/id/14858349-L.jpg"');
    console.log('   node scripts/upload-cover.mjs "~/Downloads/book_cover.jpg"');
    console.log('');
    console.log('✅ 上传成功后，封面将保存到: public/book_cover_real.png');
    console.log('🎬 视频生成时会自动使用此封面');
    process.exit(0);
  }

  const coverSource = args[0];

  console.log('🖼️ 手动上传书籍封面');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📂 源文件: ${coverSource}`);
  console.log(`🎯 目标位置: ${PUBLIC_COVER_PATH}`);
  console.log('');

  try {
    if (coverSource.startsWith('http://') || coverSource.startsWith('https://')) {
      // 从URL下载
      console.log('🌐 从URL下载封面...');
      await downloadImage(coverSource, PUBLIC_COVER_PATH);
      console.log('✅ 封面下载成功！');

    } else {
      // 从本地文件复制
      console.log('📁 从本地文件复制...');

      if (!existsSync(coverSource)) {
        // 尝试扩展路径
        const expandedPath = coverSource.replace(/^~/, process.env.HOME || '');
        if (!existsSync(expandedPath)) {
          throw new Error(`文件不存在: ${coverSource}`);
        }
        coverSource = expandedPath;
      }

      copyFileSync(coverSource, PUBLIC_COVER_PATH);
      console.log('✅ 封面复制成功！');
    }

    // 验证文件
    const stats = await import('fs').then(fs => fs.statSync(PUBLIC_COVER_PATH));
    console.log(`📊 文件大小: ${Math.round(stats.size / 1024)}KB`);
    console.log('');
    console.log('🎉 封面上传完成！');
    console.log('💡 下次运行视频生成时会自动使用此封面');
    console.log('');
    console.log('🔄 如需重新生成视频，请运行:');
    console.log('   npm run create-book-video "书籍名称"');

  } catch (error) {
    console.error('❌ 上传失败:', error.message);
    console.log('');
    console.log('🔧 故障排除:');
    console.log('   • 检查URL是否正确且可访问');
    console.log('   • 检查本地文件路径是否正确');
    console.log('   • 确保图片格式为JPEG或PNG');
    console.log('   • 检查文件权限');
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}