#!/usr/bin/env node
/**
 * 简单的豆瓣书籍信息获取脚本
 * 支持输入书名搜索或直接输入豆瓣ID
 * 基于 obsidian-douban 插件的实现优化
 */

import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUTPUT_DIR = join(ROOT, 'output');

// 豆瓣相关函数
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

// HTML解码
function html_decode(str) {
  if (!str) return str;
  return str.replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, ' ');
}

// 下载图片
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

// 从豆瓣书籍页面获取完整信息
async function fetchDoubanBookInfo(subjectId) {
  const bid = randomBid();
  const headers = DOUBAN_HEADERS(bid);
  const url = `https://book.douban.com/subject/${subjectId}/`;

  console.log(`📖 获取书籍详情: ${url}`);

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`获取书籍详情失败: ${response.status}`);
    }

    const html = await response.text();
    const cheerio = (await import('cheerio')).load(html);

    // 解析书籍信息
    let desc = cheerio(".intro p").text();
    if (!desc) {
      desc = cheerio("head > meta[property='og:description']").attr("content") || '';
    }

    const image = cheerio("head > meta[property='og:image']").attr("content") || '';

    // 解析JSON-LD数据
    let jsonLd = cheerio("head > script[type='application/ld+json']").text();
    jsonLd = html_decode(jsonLd);
    const obj = JSON.parse(jsonLd.replace(/[\r\n\t\s+]/g, ' '));

    const title = obj.name;
    const bookUrl = obj.url;
    const author = obj.author ? obj.author.map(a => a.name) : [];
    const isbn = obj.isbn;

    // 获取评分
    const score = cheerio("#interest_sectl > div > div.rating_self.clearfix > strong[property='v:average']").text();
    const scoreNum = score ? parseFloat(score) : null;

    // 解析详细信息
    const infoDom = cheerio("#info");
    const publish = infoDom.find("span.pl");

    const valueMap = new Map();

    publish.each((index, info) => {
      let key = cheerio(info).text().trim();
      let value;

      if (key.indexOf('译者') >= 0) {
        value = [];
        cheerio(info).parent().find("a").each((i, a) => {
          value.push(cheerio(a).text().trim());
        });
      } else if (key.indexOf('作者') >= 0 || key.indexOf('丛书') >= 0 || key.indexOf('出版社') >= 0 || key.indexOf('出品方') >= 0) {
        value = cheerio(info).next().next().text().trim();
      } else {
        value = cheerio(info).next().text().trim();
      }

      valueMap.set(BookKeyValueMap.get(key), value);
    });

    // 获取目录
    const menuIdDom = cheerio('#dir_' + subjectId + '_full') || cheerio('#dir_' + subjectId + '_short');
    let menu = [];
    if (menuIdDom.length > 0) {
      menu = menuIdDom.text().trim().split('\n').map(row => row.trim()).filter(row => row);
      if (menu.length > 0) menu.pop(); // 移除最后一个空行
    }

    const bookInfo = {
      id: subjectId,
      title: title,
      author: author,
      translator: valueMap.get('translator') || [],
      image: image,
      imageUrl: image,
      datePublished: valueMap.get('datePublished') ? new Date(valueMap.get('datePublished')) : null,
      isbn: isbn,
      publisher: valueMap.get('publisher') || "",
      score: scoreNum,
      originalTitle: valueMap.get('originalTitle') || "",
      subTitle: valueMap.get('subTitle') || "",
      totalPage: valueMap.get('totalPage') ? Number(valueMap.get('totalPage')) : null,
      series: valueMap.get('series') || "",
      menu: menu,
      price: valueMap.get('price') ? Number(valueMap.get('price').replace('元', '')) : null,
      desc: desc,
      url: bookUrl,
      binding: valueMap.get('binding') || "",
      producer: valueMap.get('producer') || "",
    };

    console.log('✅ 书籍信息解析完成');
    return bookInfo;

  } catch (error) {
    console.error('❌ 获取书籍详情失败:', error.message);
    return null;
  }
}

// 书籍字段映射
const BookKeyValueMap = new Map([
  ['作者', 'author'],
  ['出版社:', 'publisher'],
  ['原作名:', 'originalTitle'],
  ['出版年:', 'datePublished'],
  ['页数:', 'totalPage'],
  ['定价:', 'price'],
  ['装帧:', 'binding'],
  ['丛书:', 'series'],
  ['ISBN:', 'isbn'],
  ['译者', 'translator'],
  ['副标题:', 'subTitle'],
  ['出品方:', 'producer'],
]);

// 简单的豆瓣搜索（作为备选方案）
async function simpleDoubanSearch(keyword) {
  console.log(`🔍 尝试简单搜索: "${keyword}"`);

  // 一些常见的书籍豆瓣ID映射
  const knownBooks = {
    '小狗钱钱': '35295592',
    '富爸爸穷爸爸': '1033778',
    '思考快与慢': '10785583',
    '纳瓦尔宝典': '35876121',
    '原则': '27608239',
    '如何阅读一本书': '1013208',
  };

  // 检查是否是已知的书籍
  if (knownBooks[keyword]) {
    console.log(`✅ 找到已知书籍: ${keyword} (ID: ${knownBooks[keyword]})`);
    return knownBooks[keyword];
  }

  // 尝试通过关键词匹配
  for (const [bookName, bookId] of Object.entries(knownBooks)) {
    if (bookName.includes(keyword) || keyword.includes(bookName)) {
      console.log(`✅ 找到匹配书籍: ${bookName} (ID: ${bookId})`);
      return bookId;
    }
  }

  console.log('❌ 未找到匹配的书籍，请尝试以下方式:');
  console.log('1. 使用豆瓣ID直接获取: node scripts/fetch-douban-book-simple.mjs 35295592');
  console.log('2. 或者访问豆瓣网站搜索书籍ID');

  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const input = args[0];

  if (!input) {
    console.log('❌ 请提供书籍名称或豆瓣ID');
    console.log('');
    console.log('📖 使用方法:');
    console.log('  搜索书籍: node scripts/fetch-douban-book-simple.mjs "书籍名称"');
    console.log('  直接ID:   node scripts/fetch-douban-book-simple.mjs 豆瓣ID');
    console.log('');
    console.log('📚 示例:');
    console.log('  node scripts/fetch-douban-book-simple.mjs "小狗钱钱"');
    console.log('  node scripts/fetch-douban-book-simple.mjs 35295592');
    process.exit(1);
  }

  // 确保output目录存在
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  let subjectId = input;

  // 如果输入不是纯数字，则尝试搜索
  if (!/^\d+$/.test(input)) {
    console.log(`📖 开始搜索《${input}》...`);
    subjectId = await simpleDoubanSearch(input);

    if (!subjectId) {
      process.exit(1);
    }
  } else {
    console.log(`📖 开始获取豆瓣ID ${input} 的书籍信息...`);
  }

  try {
    // 获取书籍详细信息
    const bookDetail = await fetchDoubanBookInfo(subjectId);

    if (!bookDetail) {
      console.error('❌ 获取书籍详情失败');
      process.exit(1);
    }

    // 下载封面图片
    const coverPath = join(OUTPUT_DIR, `${bookDetail.title.replace(/[^\w\u4e00-\u9fff]/g, '_')}_douban_cover.png`);

    if (bookDetail.imageUrl) {
      const downloadHeaders = DOUBAN_HEADERS(randomBid());
      const imageBuffer = await downloadImage(bookDetail.imageUrl, downloadHeaders);

      if (imageBuffer) {
        const sharp = (await import('sharp')).default;
        await sharp(imageBuffer).png().toFile(coverPath);
        console.log(`✅ 封面已保存: ${coverPath}`);
      }
    }

    // 显示完整书籍信息
    console.log('\n📖 完整书籍信息:');
    console.log('='.repeat(60));
    console.log(`书名: ${bookDetail.title}`);
    console.log(`作者: ${Array.isArray(bookDetail.author) ? bookDetail.author.join(', ') : bookDetail.author}`);
    if (bookDetail.translator && bookDetail.translator.length > 0) {
      console.log(`译者: ${Array.isArray(bookDetail.translator) ? bookDetail.translator.join(', ') : bookDetail.translator}`);
    }
    console.log(`出版社: ${bookDetail.publisher}`);
    if (bookDetail.datePublished) {
      console.log(`出版年: ${bookDetail.datePublished.getFullYear()}`);
    }
    if (bookDetail.isbn) {
      console.log(`ISBN: ${bookDetail.isbn}`);
    }
    if (bookDetail.score) {
      console.log(`评分: ${bookDetail.score}`);
    }
    if (bookDetail.totalPage) {
      console.log(`页数: ${bookDetail.totalPage}`);
    }
    if (bookDetail.price) {
      console.log(`定价: ${bookDetail.price}元`);
    }
    if (bookDetail.originalTitle) {
      console.log(`原作名: ${bookDetail.originalTitle}`);
    }
    console.log(`豆瓣链接: ${bookDetail.url}`);
    console.log(`封面路径: ${coverPath}`);
    console.log('='.repeat(60));

    if (bookDetail.desc) {
      console.log(`\n📝 内容简介:\n${bookDetail.desc.substring(0, 200)}${bookDetail.desc.length > 200 ? '...' : ''}`);
    }

    console.log('\n🎉 书籍信息获取完成！');

    // 返回书籍信息
    return bookDetail;

  } catch (error) {
    console.error('❌ 处理失败:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { fetchDoubanBookInfo, simpleDoubanSearch, downloadImage };