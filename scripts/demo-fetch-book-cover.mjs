#!/usr/bin/env node
/**
 * 演示从豆瓣获取书籍封面的脚本
 * 可以手动指定书籍名称
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// 豆瓣API相关函数
function randomBid() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 11; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

const DOUBAN_HEADERS = (bid) => ({
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Referer': 'https://book.douban.com/',
  'Cookie': `bid=${bid}`,
});

function extractWindowData(html) {
  const marker = 'window.__DATA__ = ';
  const idx = html.indexOf(marker);
  if (idx === -1) return null;
  const start = html.indexOf('{', idx + marker.length);
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

async function fetchDoubanBookNoApi(bookTitle) {
  const bid = randomBid();
  const headers = DOUBAN_HEADERS(bid);
  const searchUrl = `https://search.douban.com/book/subject_search?search_text=${encodeURIComponent(bookTitle)}&cat=1001`;
  console.log(`🔍 搜索URL: ${searchUrl}`);

  const searchRes = await fetch(searchUrl, { headers });
  if (!searchRes.ok) {
    console.error(`❌ 搜索请求失败: ${searchRes.status}`);
    return null;
  }

  const html = await searchRes.text();
  const data = extractWindowData(html);
  if (!data?.items?.length) {
    console.log('❌ 未找到搜索结果');
    return null;
  }

  const first = data.items[0];
  const target = first.target || first;
  const coverUrl = first.cover_url || target.cover_url;
  if (!coverUrl) {
    console.log('❌ 未找到封面URL');
    return null;
  }

  const imageUrl = coverUrl.replace(/\/view\/subject\/[sm]\/public\//, '/view/subject/l/public/');
  const subjectId = target.id || first.id || (target.uri && target.uri.match(/subject\/(\d+)/)?.[1]);

  let author = '';
  let publisher = '';

  if (subjectId) {
    try {
      console.log(`📖 获取书籍详情: ${subjectId}`);
      const subjectRes = await fetch(`https://book.douban.com/subject/${subjectId}/`, { headers });
      if (subjectRes.ok) {
        const subjectHtml = await subjectRes.text();
        const cheerio = (await import('cheerio')).load(subjectHtml);
        const info = cheerio('#info').text().replace(/\s+/g, ' ').trim();
        const authorM = info.match(/作者[：:]\s*([^出版社]+?)(?=\s*出版社|$)/);
        const pubM = info.match(/出版社[：:]\s*(.+?)(?=\s+副标题|\s+出版年|\s+页数|\s+定价|$)/);
        if (authorM) author = authorM[1].replace(/\s+/g, ' ').trim();
        if (pubM) publisher = pubM[1].replace(/\s+/g, ' ').trim();
      }
    } catch (e) {
      console.warn('⚠️ 获取书籍详情失败:', e.message);
    }
  }

  return { imageUrl, author, publisher };
}

async function downloadImage(url, extraHeaders = {}) {
  console.log(`📥 下载图片: ${url}`);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://book.douban.com/',
      ...extraHeaders,
    },
  });
  if (!res.ok) {
    console.error(`❌ 下载失败: ${res.status}`);
    return null;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 500) {
    console.error('❌ 图片数据太小，可能无效');
    return null;
  }
  console.log(`✅ 下载成功，大小: ${(buf.length / 1024).toFixed(1)}KB`);
  return buf;
}

async function main() {
  // 获取命令行参数中的书籍名称
  const args = process.argv.slice(2);
  const bookTitle = args[0] || '纳瓦尔宝典'; // 默认使用纳瓦尔宝典

  console.log(`📖 开始获取《${bookTitle}》的豆瓣封面图\n`);

  try {
    // 从豆瓣获取书籍信息
    const result = await fetchDoubanBookNoApi(bookTitle);

    if (!result) {
      console.error('❌ 未找到书籍信息');
      console.log('\n💡 可能的原因:');
      console.log('   - 书籍名称不正确');
      console.log('   - 网络连接问题');
      console.log('   - 豆瓣网站限制');
      console.log('\n🔄 尝试其他书籍名称:');
      console.log('   node scripts/demo-fetch-book-cover.mjs "小狗钱钱"');
      console.log('   node scripts/demo-fetch-book-cover.mjs "The Almanack of Naval Ravikant"');
      process.exit(1);
    }

    console.log('\n✅ 找到书籍信息:');
    console.log(`   📚 书名: ${bookTitle}`);
    if (result.author) console.log(`   ✍️  作者: ${result.author}`);
    if (result.publisher) console.log(`   🏢 出版社: ${result.publisher}`);

    const { imageUrl } = result;

    // 下载封面图片
    const downloadHeaders = DOUBAN_HEADERS(randomBid());
    const imageBuffer = await downloadImage(imageUrl, downloadHeaders);

    if (!imageBuffer) {
      console.error('❌ 下载封面失败');
      process.exit(1);
    }

    // 保存到output目录
    if (!existsSync(join(ROOT, 'output'))) {
      mkdirSync(join(ROOT, 'output'), { recursive: true });
    }

    const coverPath = join(ROOT, 'output', `${bookTitle.replace(/[^\w\u4e00-\u9fff]/g, '_')}_cover.png`);
    const sharp = (await import('sharp')).default;
    await sharp(imageBuffer).png().toFile(coverPath);

    console.log(`\n✅ 封面已保存: ${coverPath}`);

    // 检查尺寸
    const metadata = await sharp(coverPath).metadata();
    console.log(`📏 封面尺寸: ${metadata.width}x${metadata.height}`);

    console.log('\n🎉 豆瓣封面获取成功！');
    console.log(`📁 文件位置: ${coverPath}`);

  } catch (error) {
    console.error('❌ 处理失败:', error.message);
    process.exit(1);
  }
}

main();