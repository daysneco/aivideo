#!/usr/bin/env node
/**
 * Fetch book cover + metadata (author, publisher) from Douban or Open Library.
 * Saves cover to public/book_cover.png; updates bookScript.ts with author/publisher.
 * Ref: obsidian-douban style fields (author, publisher, image).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const COVER_PATH = join(ROOT, 'public/book_cover.png');
const SCRIPT_PATH = join(ROOT, 'src/data/bookScript.ts');

function parseBookScript() {
  if (!existsSync(SCRIPT_PATH)) return null;
  const content = readFileSync(SCRIPT_PATH, 'utf-8');
  const startIdx = content.indexOf('export const bookScript: BookScript = ');
  if (startIdx === -1) return null;
  const jsonStart = startIdx + 'export const bookScript: BookScript = '.length;
  const jsonEnd = content.lastIndexOf(';');
  if (jsonEnd <= jsonStart) return null;
  const jsonStr = content.substring(jsonStart, jsonEnd).trim();
  try {
    return eval(`(${jsonStr})`);
  } catch {
    return null;
  }
}

/**
 * Patch bookScript.ts: update bookAuthor and publisher in the exported object.
 * Reads file, parses the object, sets fields, re-serializes with JSON.stringify(obj, null, 2).
 */
function updateBookScriptMeta(bookAuthor, publisher) {
  const content = readFileSync(SCRIPT_PATH, 'utf-8');
  const startMarker = 'export const bookScript: BookScript = ';
  const startIdx = content.indexOf(startMarker);
  if (startIdx === -1) return;
  const jsonStart = startIdx + startMarker.length;
  const jsonEnd = content.lastIndexOf(';');
  if (jsonEnd <= jsonStart) return;
  const jsonStr = content.substring(jsonStart, jsonEnd).trim();
  let obj;
  try {
    obj = eval(`(${jsonStr})`);
  } catch {
    return;
  }
  if (bookAuthor != null && bookAuthor !== '') obj.bookAuthor = String(bookAuthor).trim();
  if (publisher != null && publisher !== '') obj.publisher = String(publisher).trim();
  const newJson = JSON.stringify(obj, null, 2);
  const newContent = content.slice(0, jsonStart) + newJson + content.slice(jsonEnd);
  writeFileSync(SCRIPT_PATH, newContent, 'utf-8');
}

/** Random BID cookie for Douban (bypass 403). Ref: obsidian-douban, fetch-douban-cover.mjs */
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

/** Extract JSON object for window.__DATA__ = {...}; (brace-balanced). */
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

/**
 * Douban without API key: search page (window.__DATA__) → cover + subject id;
 * then fetch subject page and parse author/publisher with cheerio. Ref: obsidian-douban, fetch-douban-cover.mjs.
 */
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

/** Douban v2 API (needs DOUBAN_API_KEY): returns { imageUrl, author, publisher }. */
async function fetchDoubanBook(bookTitle, apiKey) {
  const q = encodeURIComponent(bookTitle);
  const url = `https://api.douban.com/v2/book/search?apikey=${encodeURIComponent(apiKey)}&q=${q}&count=5`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BookVideo/1.0)' },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const book = data?.books?.[0];
  if (!book?.image) return null;
  let imageUrl = book.image;
  if (imageUrl.includes('/s/')) imageUrl = imageUrl.replace('/s/', '/l/');
  const author = Array.isArray(book.author) ? book.author.join(' ') : (book.author || '');
  const publisher = book.publisher || '';
  return { imageUrl, author, publisher };
}

/** Open Library search: returns { imageUrl, author, publisher } from first doc with cover. */
async function fetchOpenLibraryBook(bookTitle) {
  const queries = [];
  const match = bookTitle.match(/\(([^)]+)\)/);
  if (match) queries.push(match[1].trim());
  queries.push(bookTitle);
  if (/纳瓦尔|宝典/.test(bookTitle)) queries.push('Almanack of Naval Ravikant', 'Naval Ravikant');
  if (/自卑|超越/.test(bookTitle)) queries.push('What Life Should Mean to You', 'Alfred Adler');
  for (const query of queries) {
    const q = encodeURIComponent(query);
    const url = `https://openlibrary.org/search.json?q=${q}&limit=5`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BookVideo/1.0)' },
    });
    if (!res.ok) continue;
    const data = await res.json();
    const docs = data?.docs || [];
    const doc = docs.find((d) => d.cover_i);
    if (!doc?.cover_i) continue;
    const imageUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
    const author = Array.isArray(doc.author_name) ? doc.author_name.join(' ') : (doc.author_name?.[0] || '');
    const publisher = Array.isArray(doc.publisher) ? doc.publisher[0] : (doc.publisher || '');
    return { imageUrl, author, publisher };
  }
  return null;
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
  const script = parseBookScript();
  if (!script?.bookTitle) {
    console.log('📖 No bookScript found, skipping cover fetch.');
    process.exit(0);
  }

  const { bookTitle } = script;
  console.log(`\n📖 Fetching book cover & metadata for: "${bookTitle}"`);

  if (!existsSync(join(ROOT, 'public'))) mkdirSync(join(ROOT, 'public'), { recursive: true });

  let result = null;
  let source = '';

  if (process.env.DOUBAN_API_KEY) {
    try {
      result = await fetchDoubanBook(bookTitle, process.env.DOUBAN_API_KEY);
      if (result) source = 'Douban (API)';
    } catch (e) {
      console.warn('   Douban API request failed:', e.message);
    }
  }

  if (!result) {
    try {
      result = await fetchDoubanBookNoApi(bookTitle);
      if (result) source = 'Douban (网页)';
    } catch (e) {
      console.warn('   Douban search page failed:', e.message);
    }
  }

  if (!result) {
    try {
      result = await fetchOpenLibraryBook(bookTitle);
      if (result) source = 'Open Library';
    } catch (e) {
      console.warn('   Open Library request failed:', e.message);
    }
  }

  if (!result) {
    console.log('   ⏭ No cover/metadata found. Will use AI-generated cover in Step 3.\n');
    process.exit(0);
  }

  const { imageUrl, author, publisher } = result;
  if (author) console.log(`   ✓ 作者: ${author}`);
  if (publisher) console.log(`   ✓ 出版社: ${publisher}`);

  const downloadHeaders = source.startsWith('Douban') ? DOUBAN_HEADERS(randomBid()) : {};
  try {
    const buf = await downloadImage(imageUrl, downloadHeaders);
    if (!buf) {
      console.log('   ⏭ Download failed. Will use AI-generated cover.\n');
      if ((author || publisher) && existsSync(SCRIPT_PATH)) {
        updateBookScriptMeta(author || script.bookAuthor, publisher);
        console.log('   ✓ Updated bookScript with author/publisher.\n');
      }
      process.exit(0);
    }
    const sharp = (await import('sharp')).default;
    await sharp(buf).png().toFile(COVER_PATH);
    console.log(`   ✓ Saved cover from ${source} → public/book_cover.png`);
  } catch (e) {
    console.warn('   Save failed:', e.message, '→ Will use AI-generated cover.');
  }

  if ((author || publisher) && existsSync(SCRIPT_PATH)) {
    updateBookScriptMeta(author || script.bookAuthor, publisher);
    console.log('   ✓ Updated bookScript (author / publisher).\n');
  } else {
    console.log('');
  }
  process.exit(0);
}

main();
