#!/usr/bin/env node
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';

function writeProgress(current, total) {
  const f = process.env.VIDEO_PROGRESS_FILE;
  const step = process.env.VIDEO_PROGRESS_STEP || 'Images';
  if (!f) return;
  try {
    writeFileSync(f, `[${new Date().toLocaleTimeString()}] ${step}... ${current}/${total}\n`, 'utf-8');
  } catch (_) {}
}
import { fileURLToPath } from 'url';
import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IMAGE_DIR = join(__dirname, '../public/images');

// Primary and Backup models for better reliability
const MODEL_PRIMARY = 'gemini-2.5-flash-image';
const MODEL_BACKUP = 'gemini-3-flash-preview';

// Ensure image directory exists
if (!existsSync(IMAGE_DIR)) {
  mkdirSync(IMAGE_DIR, { recursive: true });
}

// Initialize Gemini client
function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Please set GEMINI_API_KEY environment variable');
  }
  return new GoogleGenAI({ apiKey });
}

// Style prompt template for consistent illustration style
const STYLE_PROMPT = `You are creating cinematic illustrations for a high-traffic short video.

Style requirements:
- **Cinematic Anime Style / Modern Digital Art**
- **Vibrant colors with high contrast, dramatic lighting**
- **Dynamic composition, low-angle or Dutch angle for impact**
- Thick brush strokes, detailed textures
- Modern tech and humanity theme
- **CRITICAL: DO NOT RENDER ANY TEXT, CHARACTERS, OR SYMBOLS IN THE IMAGE.**
- **CRITICAL: Center all subjects (people, animals, objects) VERTICALLY in the middle third of the image.**
- Clean and minimal composition with plenty of breathing room`;

// Generate image prompt from scene data
function buildPrompt(scene, bookTitle) {
  return `${STYLE_PROMPT}

Context (Book): "${bookTitle}"
Context (Scene Title - Chinese): "${scene.title}"
Context (Scene Content - Chinese): "${scene.narration}"

Task:
1. Understand the meaning of the Chinese text above.
2. Translate the core concept/metaphor into a visual scene description in English.
3. Draw that visual scene.
4. **IMPORTANT: Do not try to write the Chinese text in the image. The image should be PURELY VISUAL.**

Create a single illustration that visually represents the core concept.`;
}

// Generate image for a single scene
async function generateImage(ai, scene, bookTitle, outputPath) {
  const prompt = buildPrompt(scene, bookTitle);

  const attempt = async (modelName) => {
    try {
      const config = modelName === 'gemini-3-flash-preview' ? {} : {
        imageConfig: {
          aspectRatio: '9:16',
        },
      };
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: config,
      });

      // Extract image from response
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const imageData = part.inlineData.data;
          const buffer = Buffer.from(imageData, 'base64');
          writeFileSync(outputPath, buffer);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.warn(`    ⚠ Model ${modelName} failed: ${error.message}`);
      return false;
    }
  };

  // Try Primary
  console.log(`    Trying primary model: ${MODEL_PRIMARY}...`);
  let success = await attempt(MODEL_PRIMARY);

  // Try Backup if failed
  if (!success) {
    console.log(`    🔄 Primary failed. Trying backup model: ${MODEL_BACKUP}...`);
    success = await attempt(MODEL_BACKUP);
  }

  // If both models failed, terminate program
  if (!success) {
    console.error(`\n❌ FATAL ERROR: Both primary model (${MODEL_PRIMARY}) and backup model (${MODEL_BACKUP}) failed to generate image for scene "${scene.id}".`);
    console.error(`   Scene title: "${scene.title}"`);
    console.error(`   Scene content: "${scene.narration}"`);
    console.error(`   Program will now terminate.`);
    process.exit(1);
  }

  return success;
}

// Parse bookScript.ts to extract scene data
function parseBookScript() {
  const scriptPath = join(__dirname, '../src/data/bookScript.ts');
  const content = readFileSync(scriptPath, 'utf-8');

  const startIdx = content.indexOf('export const bookScript: BookScript = ');
  if (startIdx === -1) {
    throw new Error('Could not find bookScript export in file.');
  }

  const jsonStart = startIdx + 'export const bookScript: BookScript = '.length;
  const jsonEnd = content.lastIndexOf(';');
  if (jsonEnd === -1 || jsonEnd <= jsonStart) {
    throw new Error('Could not find end of bookScript object.');
  }

  const jsonStr = content.substring(jsonStart, jsonEnd).trim();
  return eval(`(${jsonStr})`);
}

// Main
async function main() {
  const force = process.argv.includes('--force');
  const onlyFirst = process.argv.includes('--first');
  const countArg = process.argv.find(a => a.startsWith('--count='));
  const maxCount = countArg ? parseInt(countArg.split('=')[1]) : Infinity;

  const ai = getClient();
  const scriptData = parseBookScript();
  const bookTitle = scriptData.bookTitle;
  let scenes = scriptData.scenes;

  if (onlyFirst) {
    scenes = scenes.slice(0, 1);
  } else if (maxCount < Infinity) {
    scenes = scenes.slice(0, maxCount);
  }

  // 检查现有图片数量
  const existingImages = scenes.filter(scene => scene.id === 'intro-book' || existsSync(join(IMAGE_DIR, `${scene.id}.png`)));
  const missingImages = scenes.filter(scene => scene.id !== 'intro-book' && !existsSync(join(IMAGE_DIR, `${scene.id}.png`)));

  console.log(`\n🎨 Generating images for "${bookTitle}"`);
  console.log(`   Primary Model: ${MODEL_PRIMARY}`);
  console.log(`   Backup Model: ${MODEL_BACKUP}`);
  console.log(`   Output: ${IMAGE_DIR}`);
  console.log(`   Total scenes: ${scenes.length}`);
  console.log(`   Existing images: ${existingImages.length}`);
  console.log(`   Missing images: ${missingImages.length}`);
  console.log(`   Force regenerate: ${force}\n`);

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  // 如果不是强制重新生成且图片数量匹配，则跳过
  if (!force && existingImages.length === scenes.length) {
    console.log(`✅ All ${scenes.length} scenes already have images. Use --force to regenerate.\n`);
    skipped = scenes.length;
  } else {
    // 生成缺失的图片
    const scenesToGenerate = force ? scenes : missingImages;

    for (let i = 0; i < scenesToGenerate.length; i++) {
      writeProgress(i + 1, scenesToGenerate.length);
      const scene = scenesToGenerate[i];
      const outputPath = join(IMAGE_DIR, `${scene.id}.png`);

      console.log(`  🖌 [${i + 1}/${scenesToGenerate.length}] ${scene.id} — "${scene.title}"...`);

      const success = await generateImage(ai, scene, bookTitle, outputPath);
      if (success) {
        console.log(`  ✓ Saved to ${scene.id}.png`);
        generated++;
      } else {
        failed++;
      }

      // Rate limiting: wait 2 seconds between requests
      if (i < scenesToGenerate.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  console.log(`\n✨ Done! Generated: ${generated}, Skipped: ${skipped}, Failed: ${failed}\n`);

  // Write manifest of scene IDs that have an image (so BookScene only loads existing PNGs)
  const sceneIdsWithImages = scriptData.scenes
    .filter(s => s.id === 'intro-book' || existsSync(join(IMAGE_DIR, `${s.id}.png`)))
    .map(s => s.id);
  
  const hasRealCover = existsSync(join(__dirname, '../public/book_cover_real.png'));
  const coverFileName = hasRealCover ? 'book_cover_real.png' : 'book_cover.png';

  const manifestPath = join(__dirname, '../src/data/imageManifest.ts');
  writeFileSync(manifestPath, `export const sceneIdsWithImages: string[] = ${JSON.stringify(sceneIdsWithImages)};\nexport const coverFileName: string = "${coverFileName}";\n`, 'utf-8');
  console.log(`📋 Wrote imageManifest.ts (${sceneIdsWithImages.length}/${scriptData.scenes.length} scenes have images)\n`);

  // --- Generate Book Cover (only if fetch-book-cover did not save one) ---
  const coverPathPng = join(__dirname, '../public/book_cover.png');
  const coverPathJpg = join(__dirname, '../public/book_cover.jpg');
  const hasCover = existsSync(coverPathPng) || existsSync(coverPathJpg);
  if (!force && hasCover) {
    console.log('⏭ Book cover already exists, skipping');
  } else {
    console.log('🖌 Generating book cover illustration...');
    const coverScene = {
      title: "Book Cover",
      narration: `A representative illustration for the book "${bookTitle}". It should capture the essence of the book's wisdom and philosophy.`
    };
    await generateImage(ai, coverScene, bookTitle, coverPathPng);
    console.log('✓ Saved to book_cover.png');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
