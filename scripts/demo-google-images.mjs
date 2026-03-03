#!/usr/bin/env node
/**
 * Google Images搜索演示脚本
 * 展示改进后的3D图片选择算法
 */

import 'dotenv/config';

// 模拟Google Images API响应数据
const mockApiResponse = {
  items: [
    {
      link: "https://example.com/3d-book-cover-1.jpg",
      title: "The Courage to Be Disliked 3D Book Cover Design",
      snippet: "Beautiful 3D render of The Courage to Be Disliked book cover with modern design",
      image: { width: 1200, height: 1600 },
      mime: "image/jpeg"
    },
    {
      link: "https://example.com/digital-art-cover.jpg",
      title: "The Courage to Be Disliked Digital Art Cover",
      snippet: "Professional digital art illustration for The Courage to Be Disliked",
      image: { width: 1000, height: 1400 },
      mime: "image/jpeg"
    },
    {
      link: "https://example.com/3d-mockup.jpg",
      title: "Book Cover 3D Mockup",
      snippet: "3D mockup design for psychology book cover",
      image: { width: 800, height: 1200 },
      mime: "image/jpeg"
    },
    {
      link: "https://example.com/simple-cover.jpg",
      title: "Book Cover Design",
      snippet: "Simple book cover illustration",
      image: { width: 600, height: 800 },
      mime: "image/jpeg"
    },
    {
      link: "https://example.com/low-quality.jpg",
      title: "Book thumbnail small",
      snippet: "Low quality book thumbnail image",
      image: { width: 200, height: 300 },
      mime: "image/jpeg"
    }
  ]
};

// 评分算法（与实际脚本相同）
function scoreImage(item) {
  const title = (item.title || '').toLowerCase();
  const snippet = (item.snippet || '').toLowerCase();

  let score = 0;
  let reasons = [];

  // 3D相关关键词 (最高优先级)
  const d3Keywords = ['3d', '3-d', 'three dimensional', '3d render', '3d mockup', '3d design', '3d illustration', '3d art'];
  for (const keyword of d3Keywords) {
    if (title.includes(keyword) || snippet.includes(keyword)) {
      score += 15;
      reasons.push('3D相关');
      break;
    }
  }

  // 高质量艺术风格关键词
  const qualityKeywords = ['art', 'illustration', 'design', 'digital art', 'concept art', 'render', 'mockup', 'professional'];
  for (const keyword of qualityKeywords) {
    if (title.includes(keyword) || snippet.includes(keyword)) {
      score += 8;
      reasons.push('高质量艺术');
      break;
    }
  }

  // 书籍封面相关关键词
  const bookKeywords = ['book cover', 'cover art', 'book design', 'book illustration', 'book mockup'];
  for (const keyword of bookKeywords) {
    if (title.includes(keyword) || snippet.includes(keyword)) {
      score += 6;
      reasons.push('书籍封面');
      break;
    }
  }

  // 尺寸评分 (适合封面的尺寸)
  if (item.image) {
    const { width, height } = item.image;
    if (width && height) {
      // 理想的书籍封面比例 (3:4 或 2:3)
      const aspectRatio = width / height;
      if (aspectRatio > 0.5 && aspectRatio < 1.0) { // 适合竖版封面
        score += 5;
        reasons.push('合适尺寸');
      } else if (width >= 800 && height >= 1000) { // 高分辨率
        score += 3;
        reasons.push('高分辨率');
      }
    }
  }

  // 避免低质量图片
  if (title.includes('thumbnail') || title.includes('small') || snippet.includes('low quality')) {
    score -= 5;
    reasons.push('低质量');
  }

  return { score, reasons, dimensions: item.image ? `${item.image.width}x${item.image.height}` : '未知' };
}

function demoImageSelection() {
  console.log('🎨 Google Images 3D图片选择算法演示');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log();

  console.log('📖 搜索书籍: "被讨厌的勇气" (The Courage to Be Disliked)');
  console.log('🔍 模拟Google Images API返回5张图片');
  console.log();

  const candidates = mockApiResponse.items.map(item => ({
    url: item.link,
    title: item.title,
    ...scoreImage(item)
  }));

  console.log('📊 图片评分结果:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  candidates
    .sort((a, b) => b.score - a.score)
    .forEach((candidate, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      console.log(`${medal} 分数:${candidate.score.toString().padStart(2)} | 原因:${candidate.reasons.join(', ').padEnd(20)} | ${candidate.dimensions}`);
      console.log(`      📝 ${candidate.title}`);
      if (index < 3) console.log(); // 前3名之间加空行
    });

  const bestCandidate = candidates[0];
  console.log('🎯 最终选择:');
  console.log(`   🏆 ${bestCandidate.title}`);
  console.log(`   📊 评分: ${bestCandidate.score}分`);
  console.log(`   🎨 优势: ${bestCandidate.reasons.join(' + ')}`);
  console.log(`   📐 尺寸: ${bestCandidate.dimensions}`);
  console.log();

  console.log('💡 评分算法说明:');
  console.log('   • 3D相关 (+15分): 3d, render, mockup等关键词');
  console.log('   • 高质量艺术 (+8分): art, illustration, design等');
  console.log('   • 书籍封面 (+6分): book cover, cover art等');
  console.log('   • 合适尺寸 (+5分): 适合竖版封面的比例');
  console.log('   • 高分辨率 (+3分): ≥800x1000像素');
  console.log('   • 低质量惩罚 (-5分): thumbnail, small等关键词');
  console.log();

  console.log('🚀 要启用Google Images搜索:');
  console.log('   1. 获取Google Custom Search API密钥');
  console.log('   2. 创建自定义搜索引擎');
  console.log('   3. 配置环境变量:');
  console.log('      GOOGLE_API_KEY=your_key');
  console.log('      GOOGLE_CSE_ID=your_search_engine_id');
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  demoImageSelection();
}

export { demoImageSelection, scoreImage };