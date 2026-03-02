#!/usr/bin/env node
/**
 * 专门用于获取《小狗钱钱》书籍封面图的脚本
 * 如果尺寸不合适，会基于下载的图片重新生成适合小红书封面的版本
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const COVER_PATH = join(ROOT, 'public/book_cover.png');

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

// 检查图片尺寸是否适合小红书封面
async function checkCoverSize(imagePath) {
  try {
    const sharp = (await import('sharp')).default;
    const metadata = await sharp(imagePath).metadata();
    const { width, height } = metadata;

    console.log(`📏 当前封面尺寸: ${width}x${height}`);

    // 小红书封面推荐尺寸：1:1 比例，建议尺寸 1080x1080 或更高
    const isSquare = Math.abs(width - height) / Math.max(width, height) < 0.1; // 允许10%的偏差
    const isLargeEnough = Math.min(width, height) >= 800; // 最小800px边长

    return {
      isSuitable: isSquare && isLargeEnough,
      width,
      height,
      isSquare,
      isLargeEnough,
      aspectRatio: width / height
    };
  } catch (error) {
    console.error('❌ 检查封面尺寸失败:', error.message);
    return null;
  }
}

// 基于下载的图片重新生成适合小红书的封面
async function regenerateCoverForXiaohongshu(inputPath, outputPath) {
  try {
    const sharp = (await import('sharp')).default;
    const metadata = await sharp(inputPath).metadata();
    const { width, height } = metadata;

    console.log(`🔄 重新生成封面: ${width}x${height} → 1080x1080`);

    // 计算裁剪区域以保持书籍主体
    const size = Math.min(width, height);
    const left = Math.max(0, Math.floor((width - size) / 2));
    const top = Math.max(0, Math.floor((height - size) / 2));

    // 裁剪为正方形，然后缩放到1080x1080
    await sharp(inputPath)
      .extract({ left, top, width: size, height: size })
      .resize(1080, 1080, {
        fit: 'cover',
        position: 'center'
      })
      .png({ quality: 90 })
      .toFile(outputPath);

    console.log(`✅ 重新生成完成: ${outputPath}`);
    return true;
  } catch (error) {
    console.error('❌ 重新生成封面失败:', error.message);
    return false;
  }
}

async function main() {
  const bookTitle = '小狗钱钱';

  console.log(`\n📖 开始获取《${bookTitle}》的书籍封面图...\n`);

  // 1. 从豆瓣获取书籍信息
  console.log('🔍 从豆瓣搜索书籍信息...');
  let result = null;

  try {
    result = await fetchDoubanBookNoApi(bookTitle);
    if (result) {
      console.log('✅ 找到书籍信息:');
      console.log(`   📚 书名: ${bookTitle}`);
      if (result.author) console.log(`   ✍️  作者: ${result.author}`);
      if (result.publisher) console.log(`   🏢 出版社: ${result.publisher}`);
    }
  } catch (e) {
    console.error('❌ 从豆瓣获取书籍信息失败:', e.message);
  }

  if (!result) {
    console.log('❌ 未找到书籍信息');
    process.exit(1);
  }

  const { imageUrl } = result;

  // 2. 下载封面图片
  console.log(`\n📥 下载封面图片...`);
  console.log(`   🔗 图片链接: ${imageUrl}`);

  const downloadHeaders = DOUBAN_HEADERS(randomBid());
  let imageBuffer;

  try {
    imageBuffer = await downloadImage(imageUrl, downloadHeaders);
    if (!imageBuffer) {
      throw new Error('下载失败或图片数据无效');
    }
  } catch (e) {
    console.error('❌ 下载封面失败:', e.message);
    process.exit(1);
  }

  // 保存原始封面
  const sharp = (await import('sharp')).default;
  await sharp(imageBuffer).png().toFile(COVER_PATH);
  console.log(`✅ 已保存封面: ${COVER_PATH}`);

  // 3. 检查尺寸是否合适
  console.log(`\n📏 检查封面尺寸是否适合小红书...`);
  const sizeCheck = await checkCoverSize(COVER_PATH);

  if (!sizeCheck) {
    console.log('❌ 无法检查封面尺寸');
    process.exit(1);
  }

  if (sizeCheck.isSuitable) {
    console.log('✅ 封面尺寸合适，无需重新生成');
    console.log(`   📐 尺寸: ${sizeCheck.width}x${sizeCheck.height}`);
    console.log(`   📏 比例: ${sizeCheck.aspectRatio.toFixed(2)}`);
  } else {
    console.log('⚠️  封面尺寸不合适，需要重新生成');
    console.log(`   📐 当前尺寸: ${sizeCheck.width}x${sizeCheck.height}`);
    console.log(`   📏 当前比例: ${sizeCheck.aspectRatio.toFixed(2)}`);
    console.log(`   ❌ 是否正方形: ${sizeCheck.isSquare ? '是' : '否'}`);
    console.log(`   ❌ 是否够大: ${sizeCheck.isLargeEnough ? '是' : '否'}`);

    // 4. 重新生成适合小红书的封面
    console.log(`\n🔄 基于下载的图片重新生成适合小红书的封面...`);
    const xiaohongshuCoverPath = join(ROOT, 'public/xiaohongshu_cover.png');

    const success = await regenerateCoverForXiaohongshu(COVER_PATH, xiaohongshuCoverPath);

    if (success) {
      // 验证新生成的封面
      const newSizeCheck = await checkCoverSize(xiaohongshuCoverPath);
      if (newSizeCheck && newSizeCheck.isSuitable) {
        console.log('✅ 重新生成的封面尺寸合适！');
        console.log(`   📐 新尺寸: ${newSizeCheck.width}x${newSizeCheck.height}`);
        console.log(`   📁 保存位置: ${xiaohongshuCoverPath}`);
      } else {
        console.log('⚠️  重新生成的封面仍有问题');
      }
    }
  }

  console.log(`\n🎉 封面获取完成！`);
  console.log(`   📁 原始封面: ${COVER_PATH}`);
  if (!sizeCheck.isSuitable) {
    console.log(`   📁 小红书封面: ${join(ROOT, 'public/xiaohongshu_cover.png')}`);
  }
}

main().catch(err => {
  console.error('💥 脚本执行失败:', err);
  process.exit(1);
});