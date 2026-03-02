#!/usr/bin/env node
/**
 * 测试完整的视频制作工作流（不实际生成视频，只验证各步骤）
 */

import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

async function runCommand(command, description) {
  console.log(`\n🔄 ${description}...`);
  const { spawn } = await import('child_process');

  return new Promise((resolve, reject) => {
    const proc = spawn(command, [], { stdio: 'inherit', shell: true });
    proc.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${description} 完成`);
        resolve();
      } else {
        reject(new Error(`${description} 失败，退出码: ${code}`));
      }
    });
    proc.on('error', reject);
  });
}

async function checkFile(filePath, description) {
  if (existsSync(filePath)) {
    console.log(`📁 ${description}: ${filePath} ✅`);
    return true;
  } else {
    console.log(`❌ ${description}: ${filePath} 未找到`);
    return false;
  }
}

async function main() {
  const bookName = "小狗钱钱";

  console.log(`🎬 测试《${bookName}》完整视频制作工作流\n`);
  console.log('='.repeat(60));

  try {
    // Step 1: 检查环境
    console.log('📋 Step 1: 检查环境和依赖');
    const hasGeminiKey = process.env.GEMINI_API_KEY;
    console.log(`   API Key: ${hasGeminiKey ? '✅ 已配置' : '❌ 未配置'}`);

    // Step 1.5: 豆瓣封面获取
    console.log('\n📖 Step 1.5: 豆瓣封面获取');
    await runCommand(`node "${join(__dirname, 'fetch-douban-book-simple.mjs')}" "${bookName}"`, '获取豆瓣封面');

    // 检查生成的封面
    await checkFile(`output/${bookName.replace(/[^\w\u4e00-\u9fff]/g, '_')}_douban_cover.png`, '豆瓣封面');

    // Step 2-4: 模拟视频制作步骤（实际不运行）
    console.log('\n🎵 Step 2: 音频生成 (模拟)');
    console.log('   ⏭️ 跳过实际生成');

    console.log('\n🎨 Step 3: 图片生成 (模拟)');
    console.log('   ⏭️ 跳过实际生成');

    console.log('\n🎞️ Step 4: 视频渲染 (模拟)');
    console.log('   ⏭️ 跳过实际生成');

    // Step 5: 封面生成
    console.log('\n🖼️ Step 5: 封面生成');

    // 经典封面（模拟）
    console.log('   📸 经典封面生成 (模拟)');
    console.log('   ⏭️ 跳过实际生成');

    // 3:4科技封面
    console.log('   🤖 3:4科技封面生成');
    await runCommand(`node "${join(__dirname, 'generate-xiaohongshu-3x4-cover-auto.mjs')}"`, '生成3:4科技封面');

    // 检查生成的封面
    const coverFiles = [
      `output/${bookName.replace(/[^\w\u4e00-\u9fff]/g, '_')}_xiaohongshu_3x4.png`,
      'output/auto_xiaohongshu_3x4.png'
    ];

    let techCoverFound = false;
    for (const coverFile of coverFiles) {
      if (await checkFile(coverFile, '3:4科技封面')) {
        techCoverFound = true;
        break;
      }
    }

    if (!techCoverFound) {
      console.log('   ⚠️  3:4封面未找到，可能需要手动检查');
    }

    // Step 5.5: 小红书内容生成
    console.log('\n📱 Step 5.5: 小红书内容生成');
    await runCommand(`node "${join(__dirname, 'generate-xiaohongshu.mjs')}"`, '生成小红书标题和描述');

    // 检查生成的小红书内容
    await checkFile('output/upload-package/xiaohongshu.txt', '小红书内容');

    // 总结
    console.log('\n' + '='.repeat(60));
    console.log('🎉 工作流测试完成！');
    console.log('\n📊 生成的文件:');

    const expectedFiles = [
      `output/${bookName.replace(/[^\w\u4e00-\u9fff]/g, '_')}_douban_cover.png`,
      `output/${bookName.replace(/[^\w\u4e00-\u9fff]/g, '_')}_xiaohongshu_3x4.png`,
      'output/upload-package/xiaohongshu.txt'
    ];

    expectedFiles.forEach(file => {
      if (existsSync(file)) {
        console.log(`   ✅ ${file}`);
      } else {
        console.log(`   ❌ ${file} (未生成)`);
      }
    });

    console.log('\n🚀 完整视频制作命令:');
    console.log(`   npm run create-book-video "${bookName}"`);

  } catch (error) {
    console.error('\n❌ 工作流测试失败:', error.message);
    process.exit(1);
  }
}

main();