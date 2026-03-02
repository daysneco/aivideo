#!/usr/bin/env node
/**
 * 直接使用豆瓣ID获取《小狗钱钱》封面
 * 豆瓣链接: https://book.douban.com/subject/35295592/
 */

import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUTPUT_DIR = join(ROOT, 'output');

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

async function fetchDoubanBookById(subjectId) {
  const bid = randomBid();
  const headers = DOUBAN_HEADERS(bid);

  console.log(`📖 正在获取豆瓣书籍: ${subjectId}`);

  try {
    const subjectRes = await fetch(`https://book.douban.com/subject/${subjectId}/`, { headers });
    if (!subjectRes.ok) {
      console.error(`❌ 获取书籍页面失败: ${subjectRes.status}`);
      return null;
    }

    const subjectHtml = await subjectRes.text();
    const cheerio = (await import('cheerio')).load(subjectHtml);

    // 获取书名
    const title = cheerio('h1').text().trim().replace(/^\s*书籍\s*|\s*$/g, '');
    console.log(`📚 书名: ${title}`);

    // 获取封面URL
    const coverImg = cheerio('#mainpic img').attr('src');
    if (!coverImg) {
      console.log('❌ 未找到封面图片');
      return null;
    }

    const imageUrl = coverImg.replace(/\/view\/subject\/[sm]\//, '/view/subject/l/');
    console.log(`🖼️  封面URL: ${imageUrl}`);

    // 获取书籍信息
    const info = cheerio('#info').text().replace(/\s+/g, ' ').trim();
    const authorM = info.match(/作者[：:]\s*([^出版社]+?)(?=\s*出版社|$)/);
    const pubM = info.match(/出版社[：:]\s*(.+?)(?=\s+副标题|\s+出版年|\s+页数|\s+定价|$)/);

    const author = authorM ? authorM[1].replace(/\s+/g, ' ').trim() : '';
    const publisher = pubM ? pubM[1].replace(/\s+/g, ' ').trim() : '';

    if (author) console.log(`✍️  作者: ${author}`);
    if (publisher) console.log(`🏢 出版社: ${publisher}`);

    return { imageUrl, author, publisher, title };
  } catch (e) {
    console.error('❌ 获取书籍详情失败:', e.message);
    return null;
  }
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

async function generateXiaohongshuCover(originalCover, xiaohongshuCover) {
  console.log('\n📱 生成适合小红书的封面版本...');

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

    if (resultMeta.width === 1080 && resultMeta.height === 1080) {
      console.log('✨ 完美！符合小红书1080x1080要求');
    }

  } catch (error) {
    console.error('❌ 生成小红书封面失败:', error.message);
    throw error;
  }
}

async function main() {
  // 从豆瓣链接提取ID: https://book.douban.com/subject/35295592/
  const subjectId = '35295592';

  console.log('📖 从豆瓣获取《小狗钱钱》封面\n');

  // 确保output目录存在
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const originalCover = join(OUTPUT_DIR, 'xiaogouqianqian_douban_cover.png');
  const xiaohongshuCover = join(OUTPUT_DIR, 'xiaogouqianqian_douban_xiaohongshu_cover.png');

  try {
    // 1. 从豆瓣获取书籍信息
    const result = await fetchDoubanBookById(subjectId);

    if (!result) {
      console.error('❌ 无法获取书籍信息');
      process.exit(1);
    }

    const { imageUrl, author, publisher, title } = result;

    // 2. 下载封面图片
    const downloadHeaders = DOUBAN_HEADERS(randomBid());
    const imageBuffer = await downloadImage(imageUrl, downloadHeaders);

    if (!imageBuffer) {
      console.error('❌ 下载封面失败');
      process.exit(1);
    }

    // 保存原始封面到output目录
    const sharp = (await import('sharp')).default;
    await sharp(imageBuffer).png().toFile(originalCover);
    console.log(`\n✅ 已保存原始封面: ${originalCover}`);

    // 3. 检查原始封面尺寸
    const originalMeta = await sharp(originalCover).metadata();
    console.log('📏 原始封面尺寸:', originalMeta.width + 'x' + originalMeta.height);

    // 4. 生成适合小红书的版本
    await generateXiaohongshuCover(originalCover, xiaohongshuCover);

    console.log('\n🎉 《小狗钱钱》豆瓣封面获取完成！');
    console.log('📂 文件位置:');
    console.log('   🖼️  豆瓣原始封面: output/xiaogouqianqian_douban_cover.png');
    console.log('   📱 小红书专用封面: output/xiaogouqianqian_douban_xiaohongshu_cover.png');

    console.log('\n📖 书籍信息:');
    console.log(`   📚 书名: ${title}`);
    if (author) console.log(`   ✍️  作者: ${author}`);
    if (publisher) console.log(`   🏢 出版社: ${publisher}`);
    console.log(`   🔗 豆瓣链接: https://book.douban.com/subject/${subjectId}/`);

  } catch (error) {
    console.error('\n💥 处理失败:', error.message);
    process.exit(1);
  }
}

main();