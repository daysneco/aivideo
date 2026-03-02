#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '../output/upload-package');
const IMAGE_DIR = join(__dirname, '../public/images');
const SCRIPT_PATH = join(__dirname, '../src/data/bookScript.ts');

// Ensure output directory exists
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Helper: Parse bookScript.ts (Reuse logic from generate-images.mjs)
function parseBookScript() {
  if (!existsSync(SCRIPT_PATH)) {
    throw new Error(`Script file not found at ${SCRIPT_PATH}`);
  }
  const content = readFileSync(SCRIPT_PATH, 'utf-8');

  const startIdx = content.indexOf('export const bookScript: BookScript = ');
  if (startIdx === -1) {
    throw new Error('Could not find bookScript export in file.');
  }

  const jsonStart = startIdx + 'export const bookScript: BookScript = '.length;
  // Find the last semicolon which should end the statement
  const jsonEnd = content.lastIndexOf(';');
  
  if (jsonEnd === -1 || jsonEnd <= jsonStart) {
    throw new Error('Could not find end of bookScript object.');
  }

  const jsonStr = content.substring(jsonStart, jsonEnd).trim();
  // Evaluate the object literal safely-ish (it's a local file)
  return eval(`(${jsonStr})`);
}

// Helper: Format time for SRT (HH:MM:SS,ms)
function formatSrtTime(seconds) {
  const date = new Date(0);
  date.setMilliseconds(seconds * 1000);
  const iso = date.toISOString(); // 1970-01-01T00:00:00.000Z
  return iso.substr(11, 12).replace('.', ',');
}

// Helper: Format time for YouTube Chapters (MM:SS)
function formatChapterTime(seconds) {
  const date = new Date(0);
  date.setMilliseconds(seconds * 1000);
  const iso = date.toISOString();
  // If hour > 0, include HH:MM:SS, else MM:SS
  if (seconds >= 3600) {
    return iso.substr(11, 8);
  }
  return iso.substr(14, 5);
}

function generateSRT(scenes) {
  let srtContent = '';
  let currentTime = 0;

  scenes.forEach((scene, index) => {
    const startTime = currentTime;
    const endTime = currentTime + scene.durationSeconds;
    
    // SRT index starts at 1
    srtContent += `${index + 1}\n`;
    srtContent += `${formatSrtTime(startTime)} --> ${formatSrtTime(endTime)}\n`;
    srtContent += `${scene.narration}\n\n`;

    currentTime = endTime;
  });

  return srtContent;
}

function generateMetadata(bookScript) {
  const { bookTitle, bookAuthor, themes, scenes, outline } = bookScript;
  
  let content = `Title: ${bookTitle} | 深度解读 (Full Summary)\n\n`;
  
  content += `Description:\n`;
  // Use first 200 chars of outline or a default intro
  const intro = outline ? outline.split('\n').slice(0, 3).join('\n') : `深度解读 ${bookTitle}，作者 ${bookAuthor}。`;
  content += `${intro}\n\n`;
  content += `本视频带你深入理解《${bookTitle}》的核心思想。\n\n`;
  
  content += `⏳ 章节跳转 (Timestamps):\n`;
  
  let currentTime = 0;
  // Group by Theme or list all Scenes? 
  // Strategy: List the first scene of each Theme, PLUS the Intro and Outro
  // Actually, for a 5-8 min video, listing every scene might be too much (30+ lines).
  // Let's list specific key scenes: Intro, New Themes, Outro.
  
  let lastTheme = '';
  
  scenes.forEach((scene) => {
    const isNewTheme = scene.theme !== lastTheme;
    const isSpecial = scene.id.startsWith('intro') || scene.id.startsWith('outro');
    
    // Create timestamp if it's a new theme OR a special section (intro/outro)
    if (isNewTheme || isSpecial) {
      // If it's a new theme (and not intro/outro), use Theme name. 
      // If it's intro/outro, use Scene title.
      let label = scene.title;
      if (isNewTheme && !isSpecial) {
        label = `【${scene.theme}】${scene.title}`;
      }
      
      content += `${formatChapterTime(currentTime)} ${label}\n`;
      lastTheme = scene.theme;
    }
    
    currentTime += scene.durationSeconds;
  });

  content += `\n#${bookTitle.replace(/\s+/g, '')} #${bookAuthor.replace(/\s+/g, '')} #读书 #BookSummary #AIvideo\n`;
  
  // Add theme hashtags
  themes.forEach(theme => {
    content += `#${theme.replace(/\s+/g, '')} `;
  });

  return content;
}

import { spawnSync } from 'child_process';

// ... (existing imports)

// ... (existing functions)

function generateThumbnail() {
  console.log('🖼️ Generating Cover (Classic style) from Composition...');
  // 使用 ClassicCover 构图，与 classic_cover_v4 风格一致
  // Output: output/upload-package/thumbnail.png
  
  const result = spawnSync('npx', [
    'remotion', 
    'still', 
    'src/index.ts', 
    'ClassicCover', 
    join(OUTPUT_DIR, 'thumbnail.png')
  ], { 
    stdio: 'inherit',
    encoding: 'utf-8' 
  });
  
  if (result.status !== 0) {
    console.error('❌ Failed to generate cover via Remotion');
    // Fallback logic is handled in main if file doesn't exist
  } else {
    console.log('✅ Generated thumbnail.png (Classic cover style)');
  }
}

function main() {
  console.log('📦 Preparing Upload Package...');
  
  try {
    const data = parseBookScript();
    
    // 1. Generate SRT
    // ...
    
    // 2. Generate Metadata
    // ...
    
    // 3. Prepare Thumbnail (Classic Cover 风格)
    // Priority: 1. Remotion ClassicCover
    //           2. intro-2.png
    //           3. intro-1.png
    
    generateThumbnail();
    
    if (!existsSync(join(OUTPUT_DIR, 'thumbnail.png'))) {
        console.warn('⚠️ Remotion thumbnail generation failed, falling back to existing images...');
        // Strategy: Prefer intro-2 (Title card), then intro-1, then first available image
        const candidates = ['intro-2.png', 'intro-1.png', `${data.scenes[0].id}.png`];
        let thumbnailFound = false;
        
        for (const img of candidates) {
          const srcPath = join(IMAGE_DIR, img);
          if (existsSync(srcPath)) {
            copyFileSync(srcPath, join(OUTPUT_DIR, 'thumbnail.png'));
            console.log(`✅ Using ${img} as thumbnail.png`);
            thumbnailFound = true;
            break;
          }
        }
    }

    console.log(`\n🎉 Package ready at: output/upload-package/`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}


main();
