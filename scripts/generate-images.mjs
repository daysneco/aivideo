#!/usr/bin/env node
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IMAGE_DIR = join(__dirname, '../public/images');
const MODEL = 'gemini-2.5-flash-image';

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
const STYLE_PROMPT = `You are creating illustrations for an educational book summary video.

Style requirements:
- Clean, modern flat illustration style with soft gradients
- Warm, inviting color palette
- Simple but expressive cartoon characters/objects (NO text in the image)
- Minimalist composition with clear focal point
- Suitable as a background visual for video with text overlay
- Aspect ratio 16:9, landscape orientation
- Do NOT include any text, words, letters, or numbers in the image
- Leave some visual breathing room (don't overcrowd)`;

// Generate image prompt from scene data
function buildPrompt(scene, bookTitle) {
  return `${STYLE_PROMPT}

Book: "${bookTitle}"
Scene title: "${scene.title}"
Scene content: "${scene.narration}"

Create a single illustration that visually represents the core concept of this scene. Focus on the key metaphor or idea, not literal text content.`;
}

// Generate image for a single scene
async function generateImage(ai, scene, bookTitle, outputPath) {
  const prompt = buildPrompt(scene, bookTitle);

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: {
          aspectRatio: '16:9',
        },
      },
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

    console.warn(`  ⚠ No image generated for ${scene.id}`);
    return false;
  } catch (error) {
    console.error(`  ✗ Error generating image for ${scene.id}:`, error.message);
    return false;
  }
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

  console.log(`\n🎨 Generating images for "${bookTitle}"`);
  console.log(`   Model: ${MODEL}`);
  console.log(`   Output: ${IMAGE_DIR}`);
  console.log(`   Scenes: ${scenes.length}`);
  console.log(`   Force regenerate: ${force}\n`);

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const outputPath = join(IMAGE_DIR, `${scene.id}.png`);

    // Skip if already exists (unless --force)
    if (!force && existsSync(outputPath)) {
      console.log(`  ⏭ [${i + 1}/${scenes.length}] ${scene.id} — already exists, skipping`);
      skipped++;
      continue;
    }

    console.log(`  🖌 [${i + 1}/${scenes.length}] ${scene.id} — "${scene.title}"...`);

    const success = await generateImage(ai, scene, bookTitle, outputPath);
    if (success) {
      console.log(`  ✓ Saved to ${scene.id}.png`);
      generated++;
    } else {
      failed++;
    }

    // Rate limiting: wait 2 seconds between requests
    if (i < scenes.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log(`\n✨ Done! Generated: ${generated}, Skipped: ${skipped}, Failed: ${failed}\n`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
