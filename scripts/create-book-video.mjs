#!/usr/bin/env node
import 'dotenv/config';
import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, readdirSync, unlinkSync, rmSync, writeFileSync, statSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PROGRESS_FILE = join(ROOT, 'output', 'video_progress.txt');

function writeProgress(msg) {
  try {
    const line = `[${new Date().toLocaleTimeString()}] ${msg}\n`;
    writeFileSync(PROGRESS_FILE, line, 'utf-8');
  } catch (_) {}
}
const PUBLIC_AUDIO = join(ROOT, 'public/audio');
const PUBLIC_IMAGES = join(ROOT, 'public/images');
const SCRIPT_FILE = join(ROOT, 'src/data/bookScript.ts');

function clearDir(dirPath) {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
    return;
  }
  // Remove and recreate for a clean slate
  rmSync(dirPath, { recursive: true, force: true });
  mkdirSync(dirPath, { recursive: true });
}

async function runCommand(command, args = []) {
  // Check if command is a string with arguments (for simple execution)
  // or split command/args
  let cmd = command;
  let cmdArgs = args;

  if (command.includes(' ') && args.length === 0) {
     // Naive split, but good enough for 'npx remotion ...'
     // Better to use shell: true in spawn
  }

  return new Promise((resolve, reject) => {
    const env = { ...process.env, VIDEO_PROGRESS_FILE: PROGRESS_FILE };
    const proc = spawn(command, args, { stdio: 'inherit', shell: true, env });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with code ${code}`));
    });
  });
}

async function runRenderWithProgress(outputFile) {
  const env = { ...process.env, VIDEO_PROGRESS_FILE: PROGRESS_FILE };
  return new Promise((resolve, reject) => {
    const proc = spawn(
      'npx',
      ['remotion', 'render', 'src/index.ts', 'BookVideo', outputFile, '--concurrency=4'],
      { shell: true, env }
    );
    function onData(chunk) {
      const s = chunk.toString();
      const m = s.match(/Rendered\s+(\d+)\/(\d+)/);
      if (m) {
        const [, current, total] = m;
        try {
          writeFileSync(PROGRESS_FILE, `[${new Date().toLocaleTimeString()}] Step 4/5 - Rendering video... ${current}/${total} frames\n`, 'utf-8');
        } catch (_) {}
      }
    }
    proc.stdout.on('data', (chunk) => { process.stdout.write(chunk); onData(chunk); });
    proc.stderr.on('data', (chunk) => { process.stderr.write(chunk); onData(chunk); });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Render failed with code ${code}`));
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: npm run create-book-video -- <bookName>');
    process.exit(1);
  }

  const bookName = args[0];
  
  // Ensure output directory
  if (!existsSync('output')) {
    mkdirSync('output');
  }

  console.log(`\n🎬 Starting Video Creation for: "${bookName}"\n`);
  writeProgress('Starting...');

  // Step 0: Check Environment
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ Error: GEMINI_API_KEY is not set.');
    process.exit(1);
  }

  // Step 0.5: Clear previous book data so new book does not mix with old
  console.log('🧹 Clearing previous book audio & images...');
  clearDir(PUBLIC_AUDIO);
  clearDir(PUBLIC_IMAGES);
  
  for (const name of ['book_cover.jpg', 'book_cover.png']) {
    const p = join(ROOT, 'public', name);
    if (existsSync(p)) unlinkSync(p);
  }
  console.log('   Done. Starting fresh for this book.\n');

  try {
    // Step 1: Generate Script
    writeProgress('Step 1/5 - Generating book script...');
    console.log('📝 [Step 1/5] Generating Book Script...');
    const quotedArgs = args.map(a => `"${String(a).replace(/"/g, '\\"')}"`).join(' ');
    await runCommand(`node "${join(__dirname, 'generate-book-script.mjs')}" ${quotedArgs}`);

    // Step 1.5: Generate AI book cover
    writeProgress('Step 1.5/5 - Generating AI book cover...');
    console.log('\n🤖 [Step 1.5/5] Generating AI Book Cover...');

    // Set environment variable for book name
    const env = { ...process.env, BOOK_NAME: bookName };
    const proc = spawn('node', [join(__dirname, 'generate-cover-by-title.mjs')], {
      stdio: 'inherit',
      shell: false,
      env
    });

    await new Promise((resolve, reject) => {
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`AI cover generation failed with code ${code}`));
      });
    });

    // Copy AI generated cover to public directory for Remotion
    const aiCoverFile = `output/${bookName.replace(/[^\w\u4e00-\u9fff]/g, '_')}_ai_cover.png`;
    const publicCoverPath = join(ROOT, 'public', 'book_cover.png');
    if (existsSync(aiCoverFile)) {
      await runCommand(`cp "${aiCoverFile}" "${publicCoverPath}"`);
      console.log(`   ✅ AI封面已复制到 public/book_cover.png`);
    } else {
      console.warn(`   ⚠️ AI封面文件未找到: ${aiCoverFile}`);
    }

    // Step 2: Generate Audio
    process.env.VIDEO_PROGRESS_STEP = 'Step 2/5 - Generating audio';
    writeProgress('Step 2/5 - Generating audio...');
    console.log('\n🎤 [Step 2/5] Generating Audio...');
    await runCommand(`node "${join(__dirname, 'generate-audio.mjs')}"`);

    // Step 2.5: Sync Durations
    writeProgress('Step 2.5/5 - Syncing durations...');
    console.log('\n⏱️ [Step 2.5/5] Syncing Audio Durations...');
    await runCommand(`node "${join(__dirname, 'sync-durations.mjs')}"`);

    // Step 3: Generate Images
    process.env.VIDEO_PROGRESS_STEP = 'Step 3/5 - Generating images';
    writeProgress('Step 3/5 - Generating images...');
    console.log('\n🎨 [Step 3/5] Generating Images...');
    await runCommand(`node "${join(__dirname, 'generate-images.mjs')}"`);

    // Step 4: Render Video
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
    const outputFile = `output/${bookName}_${timestamp}.mp4`;
    writeProgress('Step 4/5 - Rendering video...');
    console.log('\n🎞️ [Step 4/5] Rendering Video...');
    
    await runRenderWithProgress(outputFile);

    // Step 5: Generate Covers (Classic + 3:4 Tech Style)
    writeProgress('Step 5/5 - Generating covers...');
    console.log('\n🖼️ [Step 5/5] Generating Covers...');

    // 生成经典风格封面
    const classicCoverFile = `output/${bookName}_${timestamp}_classic_cover.png`;
    console.log('   📸 Generating Classic cover...');
    await runCommand(`npx remotion still src/index.ts ClassicCover "${classicCoverFile}"`);

    // 生成3:4高科技感封面
    const techCoverFile = `output/${bookName}_${timestamp}_3x4_cover.png`;
    console.log('   🤖 Generating 3:4 Tech cover...');
    await runCommand(`node "${join(__dirname, 'generate-xiaohongshu-3x4-cover-auto.mjs')}"`);

    // 移动生成的3:4封面到标准命名
    const autoTechCover = `output/auto_xiaohongshu_3x4.png`; // 脚本默认输出名
    if (existsSync(autoTechCover)) {
      await runCommand(`mv "${autoTechCover}" "${techCoverFile}"`);
    } else {
      // 查找智能生成的封面
      const files = readdirSync('output').filter(f => f.includes('_xiaohongshu_3x4.png'));
      if (files.length > 0) {
        const latestCover = files.sort((a, b) => statSync(`output/${b}`).mtime - statSync(`output/${a}`).mtime)[0];
        await runCommand(`mv "output/${latestCover}" "${techCoverFile}"`);
      }
    }

    // 生成小红书标题和描述
    writeProgress('Step 5.5/5 - Generating Xiaohongshu content...');
    console.log('\n📱 [Step 5.5/5] Generating Xiaohongshu content...');
    const xiaohongshuFile = `output/upload-package/xiaohongshu.txt`;
    await runCommand(`node "${join(__dirname, 'generate-xiaohongshu.mjs')}"`);

    writeProgress('Done!');
    console.log(`\n✅ All Done!`);
    console.log(`   📹 Video: ${outputFile}`);
    console.log(`   🖼️ Classic Cover: ${classicCoverFile}`);
    console.log(`   🚀 3:4 Tech Cover: ${techCoverFile}`);
    console.log(`   📱 Xiaohongshu Content: ${xiaohongshuFile}`);
    console.log(`\n   (Progress was written to output/video_progress.txt)\n`);

  } catch (error) {
    writeProgress('Failed: ' + error.message);
    console.error('\n❌ Process Failed:', error.message);
    process.exit(1);
  }
}

main();
