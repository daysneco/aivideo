#!/usr/bin/env node
/**
 * Generate subtitle highlight keywords for the current book via LLM.
 * Reads bookScript.ts, asks LLM for 8–15 core concepts that appear in the script,
 * and writes highlightKeywords back to bookScript.ts. No hand-coding per book.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateContent } from './llm-client.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
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

function patchBookScriptHighlightKeywords(keywords) {
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
  obj.highlightKeywords = keywords;
  const newJson = JSON.stringify(obj, null, 2);
  const newContent = content.slice(0, jsonStart) + newJson + content.slice(jsonEnd);
  writeFileSync(SCRIPT_PATH, newContent, 'utf-8');
}

async function main() {
  const script = parseBookScript();
  if (!script?.bookTitle) {
    console.error('No bookScript found at src/data/bookScript.ts');
    process.exit(1);
  }

  const bookTitle = script.bookTitle;
  const outlineSnippet = script.outline ? script.outline.slice(0, 1200) : '';
  const sampleNarrations = (script.scenes || [])
    .slice(0, 15)
    .map((s) => s.narration)
    .filter(Boolean)
    .join('；');

  console.log(`Generating highlight keywords for: 《${bookTitle}》...`);

  const prompt = `你正在为书籍解说视频生成「字幕高亮关键词」。请根据书名和内容，输出该书解说中会反复出现的核心概念词，用于字幕高亮（观众看到这些词会高亮显示）。

书名：《${bookTitle}》
${outlineSnippet ? `大纲摘要：\n${outlineSnippet}\n` : ''}
${sampleNarrations ? `部分旁白示例：\n${sampleNarrations}\n` : ''}

请输出 8～15 个中文关键词，这些词必须会出现在解说旁白/字幕中（例如纳瓦尔宝典：财富、杠杆、幸福、判断力、专长、责任感、地位、金钱、第一性原理、复利）。只输出一个 JSON：{"highlightKeywords": ["词1", "词2", ...]}，不要 markdown 包裹。`;

  try {
    const data = await generateContent(prompt);
    const keywords = Array.isArray(data.highlightKeywords) ? data.highlightKeywords : [];
    if (keywords.length === 0) {
      console.warn('LLM did not return highlightKeywords, skipping.');
      process.exit(0);
    }
    patchBookScriptHighlightKeywords(keywords);
    console.log('Updated bookScript.highlightKeywords:', keywords.join('、'));
  } catch (e) {
    console.error('Failed:', e.message);
    process.exit(1);
  }
}

main();
