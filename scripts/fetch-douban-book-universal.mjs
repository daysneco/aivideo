#!/usr/bin/env node
/**
 * 通用的豆瓣书籍信息获取脚本
 * 基于 obsidian-douban 插件的实现
 * 输入书名即可获取书籍的详细信息，包括封面、作者、出版社等
 */

import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUTPUT_DIR = join(ROOT, 'output');

// 豆瓣相关常量和函数
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

// 从豆瓣搜索书籍（使用网页搜索，参考obsidian-douban的实现）
async function searchDoubanBooks(keyword, pageNum = 1, pageSize = 20) {
  const bid = randomBid();
  const headers = DOUBAN_HEADERS(bid);

  // 使用网页搜索而不是API
  const searchUrl = `https://search.douban.com/book/subject_search?search_text=${encodeURIComponent(keyword)}&cat=1001`;
  console.log(`🔍 搜索URL: ${searchUrl}`);

  try {
    const response = await fetch(searchUrl, { headers });
    if (!response.ok) {
      throw new Error(`搜索请求失败: ${response.status}`);
    }

    const html = await response.text();

    // 使用cheerio解析HTML
    const cheerio = (await import('cheerio')).load(html);

    const results = [];

    // 解析搜索结果列表
    cheerio('.result-list .result-item').each((index, element) => {
      const $item = cheerio(element);

      // 获取标题和链接
      const titleLink = $item.find('h3 a');
      const title = titleLink.text().trim();
      const url = titleLink.attr('href');

      if (!url || !title) return;

      // 获取ID
      const idMatch = url.match(/subject\/(\d+)/);
      const id = idMatch ? idMatch[1] : '';

      // 获取作者信息
      const author = $item.find('.subject-cast').text().trim();

      // 获取评分
      const rating = $item.find('.rating_nums').text().trim();
      const score = rating ? parseFloat(rating) : null;

      // 获取封面图片
      const coverImg = $item.find('img').attr('src');
      const imageUrl = coverImg ? coverImg.replace('/view/subject/s/public/', '/view/subject/l/public/') : '';

      // 获取简介
      const description = $item.find('.content .abstract').text().trim();

      results.push({
        id,
        title,
        score,
        author,
        type: '书籍',
        url,
        imageUrl,
        description
      });
    });

    console.log(`✅ 找到 ${results.length} 本相关书籍`);
    return results;

  } catch (error) {
    console.error('❌ 搜索失败:', error.message);
    return [];
  }
}

// 从豆瓣书籍详细页面获取完整信息
async function fetchDoubanBookDetail(bookId) {
  const bid = randomBid();
  const headers = DOUBAN_HEADERS(bid);
  const url = `https://book.douban.com/subject/${bookId}/`;

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
    const author = obj.author ? obj.author.map((a) => a.name) : [];
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
    const menuIdDom = cheerio('#dir_' + bookId + '_full') || cheerio('#dir_' + bookId + '_short');
    let menu = [];
    if (menuIdDom.length > 0) {
      menu = menuIdDom.text().trim().split('\n').map(row => row.trim()).filter(row => row);
      if (menu.length > 0) menu.pop(); // 移除最后一个空行
    }

    const bookInfo = {
      id: bookId,
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

// HTML解码函数
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

async function main() {
  // 获取命令行参数中的书籍名称
  const args = process.argv.slice(2);
  const bookTitle = args[0];

  if (!bookTitle) {
    console.log('❌ 请提供书籍名称');
    console.log('使用方法: node scripts/fetch-douban-book-universal.mjs "书籍名称"');
    console.log('例如: node scripts/fetch-douban-book-universal.mjs "小狗钱钱"');
    process.exit(1);
  }

  // 确保output目录存在
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log(`📖 开始获取《${bookTitle}》的豆瓣信息\n`);

  try {
    // 1. 搜索书籍
    const searchResults = await searchDoubanBooks(bookTitle, 1, 5);

    if (searchResults.length === 0) {
      console.log('❌ 未找到相关书籍，请尝试其他书名');
      process.exit(1);
    }

    // 显示搜索结果
    console.log('📚 搜索结果:');
    searchResults.forEach((book, index) => {
      console.log(`${index + 1}. ${book.title} - ${book.author} (评分: ${book.score || '暂无'})`);
    });
    console.log();

    // 选择第一个结果（通常是最相关的）
    const selectedBook = searchResults[0];
    console.log(`🎯 选择: ${selectedBook.title}`);
    console.log(`🔗 豆瓣链接: ${selectedBook.url}`);
    console.log();

    // 2. 获取书籍详细信息
    const bookId = selectedBook.url.split('/').pop();
    const bookDetail = await fetchDoubanBookById(bookId);

    if (!bookDetail) {
      console.error('❌ 获取书籍详情失败');
      process.exit(1);
    }

    // 3. 下载封面图片
    const coverPath = join(OUTPUT_DIR, `${bookTitle.replace(/[^\w\u4e00-\u9fff]/g, '_')}_douban_cover.png`);

    if (bookDetail.imageUrl) {
      const downloadHeaders = DOUBAN_HEADERS(randomBid());
      const imageBuffer = await downloadImage(bookDetail.imageUrl, downloadHeaders);

      if (imageBuffer) {
        const sharp = (await import('sharp')).default;
        await sharp(imageBuffer).png().toFile(coverPath);
        console.log(`✅ 封面已保存: ${coverPath}`);
      }
    }

    // 4. 显示完整书籍信息
    console.log('\n📖 完整书籍信息:');
    console.log('='.repeat(50));
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
    if (bookDetail.subTitle) {
      console.log(`副标题: ${bookDetail.subTitle}`);
    }
    if (bookDetail.series) {
      console.log(`丛书: ${bookDetail.series}`);
    }
    console.log(`豆瓣链接: ${bookDetail.url}`);
    console.log(`封面路径: ${coverPath}`);
    console.log('='.repeat(50));

    if (bookDetail.desc) {
      console.log(`\n📝 内容简介:\n${bookDetail.desc}`);
    }

    console.log('\n🎉 书籍信息获取完成！');

    // 返回书籍信息（供其他脚本使用）
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

export { searchDoubanBooks, fetchDoubanBookDetail, downloadImage };