#!/usr/bin/env node
/**
 * 通用封面生成：指定书名（+ 可选大纲）→ 生成剧本元数据 → 拉取书籍封面图 → 输出 Classic 风格封面 PNG。
 * 风格固定为 classic_cover_v4 版式，无需每次调整。
 *
 * 用法：
 *   npm run generate-cover -- "影响力"
 *   npm run generate-cover -- "影响力" "temp/outline.txt"
 */
import 'dotenv/config';
import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function run(cmd, args = []) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: 'inherit', shell: true, cwd: ROOT });
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`Exit ${code}`))));
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: npm run generate-cover -- <bookName> [outlineFile]');
    process.exit(1);
  }

  const bookName = args[0];
  const outlineArg = args[1];
  if (!existsSync(join(ROOT, 'output'))) mkdirSync(join(ROOT, 'output'), { recursive: true });

  console.log('\n📖 Generating classic cover for:', bookName, outlineArg ? `(outline: ${outlineArg})` : '');

  const quoted = args.map((a) => `"${String(a).replace(/"/g, '\\"')}"`).join(' ');

  await run('node', [join(__dirname, 'generate-book-script.mjs'), ...args]);
  await run('node', [join(__dirname, 'fetch-book-cover.mjs')]);

  const outFile = `output/${bookName.replace(/\s+/g, '_')}_classic_cover.png`;
  await run('npx', ['remotion', 'still', 'src/index.ts', 'ClassicCover', outFile]);

  console.log('\n✅ Cover saved:', outFile);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
