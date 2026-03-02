import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COVER_DIR = path.join(__dirname, '../public');

// Headers to mimic a browser with Cookie (Crucial for Douban)
const generateBid = () => {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  for (let i = 0; i < 11; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};

const bid = generateBid();
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Referer': 'https://book.douban.com/',
    'Cookie': `bid=${bid}`, // Random BID is key to bypass 403/Redirect
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'Connection': 'keep-alive'
};

async function downloadImage(url, destPath) {
    console.log(`Downloading to ${destPath}...`);
    const response = await fetch(url, { headers: HEADERS });
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(destPath, Buffer.from(buffer));
    console.log('Download complete!');
}

async function main() {
    const args = process.argv.slice(2);
    const keyword = args[0] || "纳瓦尔宝典";
    
    try {
        console.log(`Searching for cover of: "${keyword}"`);
        const encodedKeyword = encodeURIComponent(keyword);
        
        // This URL returns a page with window.__DATA__ containing results!
        const searchUrl = `https://search.douban.com/book/subject_search?search_text=${encodedKeyword}&cat=1001`;
        
        console.log(`Searching: ${searchUrl}`);
        const searchRes = await fetch(searchUrl, { headers: HEADERS });
        
        if (!searchRes.ok) throw new Error(`Search failed: ${searchRes.status}`);
        
        const html = await searchRes.text();
        
        // Extract window.__DATA__
        const match = html.match(/window\.__DATA__ = ({.*?});/);
        if (!match) throw new Error("Could not find window.__DATA__ in search page");
        
        const data = JSON.parse(match[1]);
        if (!data.items || data.items.length === 0) throw new Error("No items in search data");
        
        const firstItem = data.items[0];
        console.log(`Found: ${firstItem.title}`);
        
        if (!firstItem.cover_url) throw new Error("No cover_url in item");
        
        // Convert to high quality
        // e.g. https://img9.doubanio.com/view/subject/m/public/s34241855.jpg
        // -> https://img9.doubanio.com/view/subject/l/public/s34241855.jpg
        const hqUrl = firstItem.cover_url.replace(/\/view\/subject\/[sm]\/public\//, '/view/subject/l/public/');
        
        console.log(`Downloading: ${hqUrl}`);
        await downloadImage(hqUrl, path.join(COVER_DIR, 'book_cover.jpg'));
        
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
