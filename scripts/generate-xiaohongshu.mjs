#!/usr/bin/env node
/**
 * Generate 小红书 (Xiaohongshu) style title and description for the book video.
 * Uses LLM to produce a catchy title (≤20 chars) and description with hashtags.
 * Writes to output/upload-package/xiaohongshu.txt
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateContent } from './llm-client.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SCRIPT_PATH = join(ROOT, 'src/data/bookScript.ts');
const OUTPUT_DIR = join(ROOT, 'output/upload-package');
const OUT_FILE = join(OUTPUT_DIR, 'xiaohongshu.txt');

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

async function main() {
  const script = parseBookScript();
  if (!script?.bookTitle) {
    console.error('No bookScript found.');
    process.exit(1);
  }

  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

  const bookTitle = script.bookTitle;
  const outlineSnippet = script.outline ? script.outline.slice(0, 800) : '';

  const prompt = `你是一位小红书爆款文案写手。为以下书籍解说视频生成「小红书标题」和「小红书描述」。

书名：《${bookTitle}》
${outlineSnippet ? `内容概要：\n${outlineSnippet}\n` : ''}

要求：
1. **标题**：不超过 20 字，吸睛、有情绪或悬念，可带 1～2 个 emoji。例如：「财富自由的底层逻辑｜纳瓦尔宝典」「读完这本，我戒掉了焦虑」。
2. **描述**：80～200 字，自然介绍这本书讲什么、为什么值得看，结尾带 5～8 个话题标签，如 #纳瓦尔宝典 #读书 #财富 #个人成长 #书单推荐 等，标签与本书内容相关。

只输出一个 JSON：{"title": "标题内容", "description": "描述内容"}，不要 markdown 代码块。`;

  console.log('📱 Generating 小红书 title & description...');

  try {
    const data = await generateContent(prompt);
    const title = (data.title || bookTitle + '｜深度解读').slice(0, 50);
    const description = (data.description || '').trim() || `《${bookTitle}》核心思想解读，几分钟看懂一本书。`;

    const content = `【标题】\n${title}\n\n【描述】\n${description}\n`;
    writeFileSync(OUT_FILE, content, 'utf-8');
    console.log('✅ Written to output/upload-package/xiaohongshu.txt');
    console.log('\n--- 标题 ---\n' + title + '\n\n--- 描述 ---\n' + description.slice(0, 150) + (description.length > 150 ? '...' : ''));
  } catch (e) {
    console.error('Failed:', e.message);
    process.exit(1);
  }
}

main();
