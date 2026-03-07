#!/usr/bin/env node
import 'dotenv/config';
import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, readdirSync, unlinkSync, rmSync, writeFileSync, statSync, copyFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PROGRESS_FILE = join(ROOT, 'output', 'video_progress.txt');

function writeProgress(msg) {
  try {
    const line = `[${new Date().toLocaleTimeString()}] ${msg}\n`;
    writeFileSync(PROGRESS_FILE, line, 'utf-8');
    // 同时输出到控制台，便于实时查看
    console.log(`📊 ${msg}`);
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

async function runRenderWithProgressTest(outputFile) {
  const env = { ...process.env, VIDEO_PROGRESS_FILE: PROGRESS_FILE };
  return new Promise((resolve, reject) => {
    // 渲染前150帧（约5秒，30fps），展示特效
    const proc = spawn(
      'npx',
      ['remotion', 'render', 'src/index.ts', 'BookVideo', outputFile, '--frames=0-149'],
      { shell: true, env }
    );
    function onData(chunk) {
      const s = chunk.toString();
      const m = s.match(/Rendered\s+(\d+)\/(\d+)/);
      if (m) {
        const [, current, total] = m;
        try {
          writeFileSync(PROGRESS_FILE, `[${new Date().toLocaleTimeString()}] Test render... ${current}/${total} frames\n`, 'utf-8');
        } catch (_) {}
      }
    }
    proc.stdout.on('data', (chunk) => { process.stdout.write(chunk); onData(chunk); });
    proc.stderr.on('data', (chunk) => { process.stderr.write(chunk); onData(chunk); });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Test render failed with code ${code}`));
    });
  });
}

async function main() {
  const args = process.argv.slice(2);

  // 检查是否是测试模式
  const isTestMode = args.includes('--test') || process.env.npm_lifecycle_event === 'create-book-video-test';

  // 过滤掉--test参数，获取书名
  const filteredArgs = args.filter(arg => arg !== '--test');
  const bookName = filteredArgs[0];

  if (!bookName) {
    console.error('Usage: npm run create-book-video -- <bookName>');
    console.error('Test mode: npm run create-book-video-test -- <bookName>');
    process.exit(1);
  }

  // Create sanitized book name for directory (remove special chars and book brackets)
  const sanitizedBookName = bookName.replace(/[《》]/g, '').replace(/[^\w\u4e00-\u9fff\s-]/g, '_').trim();

  // Create book-specific output directory
  const bookOutputDir = join('output', sanitizedBookName);
  if (!existsSync(bookOutputDir)) {
    mkdirSync(bookOutputDir, { recursive: true });
  }

  console.log(`\n🎬 Starting Video Creation for: "${bookName}"`);
  console.log(`📁 Output directory: ${bookOutputDir}`);
  console.log(`📊 实时进度监控: npm run monitor-progress`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
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
  
  for (const name of ['book_cover.jpg', 'book_cover.png', 'book_cover_real.png']) {
    const p = join(ROOT, 'public', name);
    if (existsSync(p)) unlinkSync(p);
  }
  console.log('   Done. Starting fresh for this book.\n');

  // Step 0.6: Pick a random subtitle font from public
  const publicDir = join(ROOT, 'public');
  const fontExts = ['.ttf', '.otf'];
  const fontFiles = (readdirSync(publicDir) || []).filter(f => fontExts.some(ext => f.toLowerCase().endsWith(ext)));
  const chosenFont = fontFiles.length > 0 ? fontFiles[Math.floor(Math.random() * fontFiles.length)] : 'LXGWWenKai.ttf';
  const fontFamily = chosenFont.replace(/\.[^.]+$/, '');
  const subtitleFontTs = join(ROOT, 'src', 'data', 'subtitleFont.ts');
  writeFileSync(subtitleFontTs, `/**
 * 当前视频使用的字幕字体，由 create-book-video 在生成时随机从 public 下字体中选取并写入。
 */
export const subtitleFontFile = '${chosenFont}';
export const subtitleFontFamily = '${fontFamily}';
`, 'utf-8');
  console.log('🔤 Subtitle font: ' + chosenFont + ' (family: ' + fontFamily + ')\n');

  try {
    // Step 1: Generate Script
    writeProgress('Step 1/5 - Generating book script...');
    console.log('📝 [Step 1/5] Generating Book Script...');
    const quotedArgs = filteredArgs.map(a => `"${String(a).replace(/"/g, '\\"')}"`).join(' ');
    await runCommand(`node "${join(__dirname, 'generate-book-script.mjs')}" ${quotedArgs}`);

    // Step 1.5: Fetch real book cover from online sources
    writeProgress('Step 1.5/5 - Fetching real book cover...');
    console.log('\n📚 [Step 1.5/5] Fetching Real Book Cover...');
    const publicCoverPath = join(ROOT, 'public', 'book_cover.png');
    const realCoverPath = join(ROOT, 'public', 'book_cover_real.png');

    try {
      await runCommand(`node "${join(__dirname, 'fetch-book-cover-multi.mjs')}" "${bookName}"`);
    } catch (e) {
      // fetch script may exit non-zero
    }

    if (existsSync(realCoverPath)) {
      await runCommand(`cp "${realCoverPath}" "${publicCoverPath}"`);
      console.log(`   ✅ 真实封面已获取并复制到 public/book_cover.png`);
    } else {
      writeProgress('Failed: 未找到真实书籍封面');
      console.error('\n❌ 未找到真实书籍封面，流程终止。');
      console.error('💡 请手动将封面图片放到 public/book_cover.png 后重新运行，');
      console.error('   或运行以下命令单独获取封面：');
      console.error(`   node scripts/fetch-book-cover-multi.mjs "${bookName}"`);
      process.exit(1);
    }

    // Step 1.6: Generate AI landscape background for intro-book scene
    writeProgress('Step 1.6/5 - Generating intro background...');
    console.log('\n🖼️ [Step 1.6/5] Generating Intro Background (AI landscape)...');
    await runCommand(`node "${join(__dirname, 'generate-intro-background.mjs')}"`);

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
    const outputFileBase = join(bookOutputDir, `视频_《${sanitizedBookName}》.mp4`);
    const outputFile = outputFileBase;
    writeProgress('Step 4/5 - Rendering video...');
    console.log(`\n🎞️ [Step 4/5] Rendering Video${isTestMode ? ' (Test Mode - First 3 scenes)' : ''}...`);

    // 在测试模式下渲染一个简短的测试视频（约150帧，5秒）
    if (isTestMode) {
      console.log('🎯 测试模式: 渲染约5秒的测试视频');
      await runRenderWithProgressTest(outputFile);
    } else {
      await runRenderWithProgress(outputFile);
      writeProgress('Step 4.5/5 - Compressing video...');
      console.log('\n📦 [Step 4.5/5] Compressing video (<50MB)...');
      await runCommand(`node "${join(__dirname, 'compress-video.mjs')}" "${outputFile}"`);
      // 压缩脚本会自动生成 _compressed.mp4，我们需要覆盖原文件并重命名
      const compressedFile = outputFile.replace('.mp4', '_compressed.mp4');
      if (existsSync(compressedFile)) {
        rmSync(outputFile);
        copyFileSync(compressedFile, outputFile);
        rmSync(compressedFile);
      }
    }

    // Step 5: Generate Covers (3:4 Real Cover Style)
    writeProgress('Step 5/5 - Generating covers...');
    console.log('\n🖼️ [Step 5/5] Generating Real Cover (3:4) via Remotion...');

    const finalCoverFile = join(bookOutputDir, `封面_《${sanitizedBookName}》.png`);
    
    // 使用新的 RealCoverXhs 构图生成封面
    await runCommand(`npx remotion still src/index.ts RealCoverXhs "${finalCoverFile}"`);

    // 生成小红书标题和描述
    writeProgress('Step 5.5/5 - Generating Xiaohongshu content...');
    console.log('\n📱 [Step 5.5/5] Generating Xiaohongshu content...');
    const xiaohongshuFile = join(bookOutputDir, 'xiaohongshu.txt');
    await runCommand(`node "${join(__dirname, 'generate-xiaohongshu.mjs')}"`);

    // Move Xiaohongshu content to book directory
    const uploadPackageDir = join('output', 'upload-package');
    if (existsSync(uploadPackageDir)) {
      const xhsFiles = readdirSync(uploadPackageDir).filter(f => f.includes('xiaohongshu'));
      for (const file of xhsFiles) {
        const dest = join(bookOutputDir, file === 'xiaohongshu.txt' ? 'xiaohongshu.txt' : file);
        if (existsSync(dest)) rmSync(dest);
        await runCommand(`mv "${join(uploadPackageDir, file)}" "${dest}"`);
      }
    }

    // Copy all generated assets to output/书名 (audio, images, covers)
    writeProgress('Copying assets to book output dir...');
    const outAudio = join(bookOutputDir, 'audio');
    const outImages = join(bookOutputDir, 'images');
    if (!existsSync(outAudio)) mkdirSync(outAudio, { recursive: true });
    if (!existsSync(outImages)) mkdirSync(outImages, { recursive: true });
    
    // ... rest of the copy logic ...
    const coverPaths = ['book_cover.png', 'book_cover_real.png', 'intro_background.png'];
    for (const name of coverPaths) {
      const src = join(ROOT, 'public', name);
      if (existsSync(src)) copyFileSync(src, join(bookOutputDir, name));
    }

    writeProgress('Done!');
    console.log(`\n✅ All Done!`);
    console.log(`   📹 Video: ${outputFile}`);
    console.log(`   🚀 3:4 Cover: ${finalCoverFile}`);
    console.log(`   📱 Xiaohongshu Content: ${xiaohongshuFile}`);
    console.log(`\n   (Progress was written to output/video_progress.txt)\n`);

  } catch (error) {
    writeProgress('Failed: ' + error.message);
    console.error('\n❌ Process Failed:', error.message);
    process.exit(1);
  }
}

main();
