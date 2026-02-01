#!/usr/bin/env node
/**
 * 用 LLM 根据 src/data/script.ts 的分镜标题生成精简的顶部导航 topic。
 * 需要环境变量 OPENAI_API_KEY 或 ANTHROPIC_API_KEY。
 *
 * 用法: node scripts/generate-topics.mjs
 * 或:   npm run generate-topics
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// 从 script.ts 里用正则提取每段的 text / subtext（保持顺序）
function extractScenesFromScript() {
  const scriptPath = join(root, 'src/data/script.ts');
  const content = readFileSync(scriptPath, 'utf-8');
  const scenes = [];
  const textRe = /text:\s*['"]([^'"]+)['"]/g;
  const subtextRe = /subtext:\s*['"]([^'"]*)['"]/g;
  let m;
  while ((m = textRe.exec(content)) !== null) scenes.push({ text: m[1] });
  let i = 0;
  while ((m = subtextRe.exec(content)) !== null && i < scenes.length) {
    scenes[i].subtext = m[1];
    i++;
  }
  return scenes;
}

const scenes = extractScenesFromScript();
const sceneList = scenes.map((s, i) => `${i + 1}. ${s.text}${s.subtext ? `（${s.subtext}）` : ''}`).join('\n');

const systemPrompt = `你是一个视频导航文案助手。根据视频分镜标题，为顶部导航栏生成精简主题词。
要求：
- 每项 2～4 个汉字，简洁有力
- 不要包含书名（例如已知是《小狗钱钱》则不要出现「小狗钱钱」）
- 顺序和数量与分镜一一对应
- 只输出一个 JSON 数组，不要其他说明，例如：["开篇","相遇","梦想清单","养鹅","成功日记","行动"]`;

const userPrompt = `请为以下分镜生成导航主题（与分镜条数相同、顺序一致）：\n\n${sceneList}`;

async function callOpenAI() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('请设置环境变量 OPENAI_API_KEY');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content?.trim() || '';
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('LLM 未返回有效 JSON 数组');
  return JSON.parse(jsonMatch[0]);
}

async function callAnthropic() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('请设置环境变量 ANTHROPIC_API_KEY');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const raw = data.content?.[0]?.text?.trim() || '';
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('LLM 未返回有效 JSON 数组');
  return JSON.parse(jsonMatch[0]);
}

async function main() {
  let topics;
  if (process.env.OPENAI_API_KEY) {
    console.log('使用 OpenAI 生成 topics...');
    topics = await callOpenAI();
  } else if (process.env.ANTHROPIC_API_KEY) {
    console.log('使用 Anthropic 生成 topics...');
    topics = await callAnthropic();
  } else {
    console.error('请设置 OPENAI_API_KEY 或 ANTHROPIC_API_KEY 后重试。');
    process.exit(1);
  }
  if (!Array.isArray(topics) || topics.some((t) => typeof t !== 'string')) {
    throw new Error('LLM 返回格式错误，应为字符串数组');
  }
  const outPath = join(root, 'src/data/topics.ts');
  const content = `/**
 * 顶部导航栏主题（由 LLM 根据 script 生成，精简、不含书名）。
 * 重新生成: npm run generate-topics
 */
export const topics: string[] = ${JSON.stringify(topics, null, 2)};
`;
  writeFileSync(outPath, content, 'utf-8');
  console.log('已写入', outPath, ':', topics.join(' | '));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
