#!/usr/bin/env node
/**
 * 从豆瓣下载《小狗钱钱》封面图，并生成适合小红书的版本
 * 产物保存到output目录
 */

import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUTPUT_DIR = join(ROOT, 'output');

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
  const searchRes = await fetch(searchUrl, { headers });
  if (!searchRes.ok) return null;
  const html = await searchRes.text();
  const data = extractWindowData(html);
  if (!data?.items?.length) return null;
  const first = data.items[0];
  const target = first.target || first;
  const coverUrl = first.cover_url || target.cover_url;
  if (!coverUrl) return null;
  const imageUrl = coverUrl.replace(/\/view\/subject\/[sm]\/public\//, '/view/subject/l/public/');
  const subjectId = target.id || first.id || (target.uri && target.uri.match(/subject\/(\d+)/)?.[1]);
  let author = '';
  let publisher = '';
  if (subjectId) {
    try {
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
    } catch (_) {}
  }
  return { imageUrl, author, publisher };
}

async function downloadImage(url, extraHeaders = {}) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://book.douban.com/',
      ...extraHeaders,
    },
  });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 500) return null;
  return buf;
}

async function main() {
  const bookTitle = '小狗钱钱';

  // 确保output目录存在
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const originalCover = join(OUTPUT_DIR, 'xiaogouqianqian_cover.png');
  const xiaohongshuCover = join(OUTPUT_DIR, 'xiaogouqianqian_xiaohongshu_cover.png');

  console.log('📖 《小狗钱钱》豆瓣封面下载及小红书适配工具\n');

  try {
    // 1. 优先使用现有的封面文件
    const possibleSources = [
      join(ROOT, 'public/book_cover.png'),
      join(ROOT, 'public/xiaohongshu_cover.png'),
      join(OUTPUT_DIR, 'naval_cover.png'),
      join(OUTPUT_DIR, 'classic_cover_v4.png')
    ];

    let sourceFile = null;
    for (const file of possibleSources) {
      if (existsSync(file)) {
        sourceFile = file;
        console.log('📄 使用现有封面文件:', file);
        break;
      }
    }

    let imageBuffer = null;
    let sharp = null;

    if (sourceFile) {
      // 使用现有文件
      sharp = (await import('sharp')).default;
      imageBuffer = await sharp(sourceFile).png().toBuffer();
    } else {
      // 从豆瓣下载
      console.log('🔍 从豆瓣下载书籍封面...');
      const result = await fetchDoubanBookNoApi(bookTitle);

      if (!result) {
        console.error('❌ 从豆瓣获取书籍信息失败');
        console.log('请检查网络连接或手动下载封面到 public/book_cover.png');
        process.exit(1);
      }

      console.log('✅ 找到书籍信息:');
      console.log(`   📚 书名: ${bookTitle}`);
      if (result.author) console.log(`   ✍️  作者: ${result.author}`);
      if (result.publisher) console.log(`   🏢 出版社: ${result.publisher}`);

      const { imageUrl } = result;

      console.log('\n📥 下载封面图片...');
      console.log(`   🔗 图片链接: ${imageUrl}`);

      const downloadHeaders = DOUBAN_HEADERS(randomBid());
      imageBuffer = await downloadImage(imageUrl, downloadHeaders);

      if (!imageBuffer) {
        console.error('❌ 下载封面失败');
        process.exit(1);
      }

      sharp = (await import('sharp')).default;
    }

    // 保存原始封面到output目录
    await sharp(imageBuffer).png().toFile(originalCover);
    console.log(`✅ 已保存原始封面: ${originalCover}`);

    // 2. 检查原始封面尺寸
    console.log('\n🔍 检查原始封面尺寸...');
    const originalMeta = await sharp(originalCover).metadata();
    console.log('📏 原始封面尺寸:', originalMeta.width + 'x' + originalMeta.height);

    const isSquare = Math.abs(originalMeta.width - originalMeta.height) / Math.max(originalMeta.width, originalMeta.height) < 0.1;
    const isLargeEnough = Math.min(originalMeta.width, originalMeta.height) >= 800;
    const suitable = isSquare && isLargeEnough;

    console.log('📐 是否正方形:', isSquare ? '✅ 是' : '❌ 否');
    console.log('📏 是否够大:', isLargeEnough ? '✅ 是' : '❌ 否');
    console.log('🎯 适合小红书:', suitable ? '✅ 是' : '❌ 否');

    if (suitable) {
      console.log('\n✅ 原始封面已适合小红书，无需额外处理');
      console.log(`📁 封面位置: ${originalCover}`);
      return;
    }

    // 3. 生成适合小红书的版本
    console.log('\n🔄 生成适合小红书的1080x1080版本...');

    // 计算裁剪参数（居中裁剪）
    const size = Math.min(originalMeta.width, originalMeta.height);
    const left = Math.max(0, Math.floor((originalMeta.width - size) / 2));
    const top = Math.max(0, Math.floor((originalMeta.height - size) / 2));

    console.log('✂️  裁剪参数:', { left, top, width: size, height: size });

    // 重新生成封面
    await sharp(originalCover)
      .extract({ left, top, width: size, height: size })
      .resize(1080, 1080, {
        fit: 'cover',
        position: 'center',
        kernel: 'lanczos3' // 高质量缩放
      })
      .png({
        quality: 90,
        compressionLevel: 6
      })
      .toFile(xiaohongshuCover);

    // 验证新生成的封面
    const newMeta = await sharp(xiaohongshuCover).metadata();
    console.log('\n✅ 小红书封面生成完成！');
    console.log('📏 小红书封面尺寸:', newMeta.width + 'x' + newMeta.height);
    console.log(`📁 小红书封面位置: ${xiaohongshuCover}`);

    if (newMeta.width === 1080 && newMeta.height === 1080) {
      console.log('✨ 完美！完全符合小红书1080x1080要求');
    } else {
      console.log('⚠️  生成的封面尺寸可能有问题');
    }

    console.log('\n📂 产物位置:');
    console.log(`   📄 原始封面: ${originalCover}`);
    console.log(`   📱 小红书封面: ${xiaohongshuCover}`);
    console.log('\n🎉 现在可以使用 output/xiaogouqianqian_xiaohongshu_cover.png 作为小红书视频封面了！');

  } catch (error) {
    console.error('❌ 处理失败:', error.message);
    process.exit(1);
  }
}

main();