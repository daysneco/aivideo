#!/usr/bin/env node
/**
 * Generate one AI landscape image as background for the intro-book (cover) scene.
 * Saves to public/intro_background.png and sets hasIntroBackground in src/data/introBackground.ts.
 */
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// 自动加载环境变量
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const { config } = await import('dotenv');
config({ path: join(ROOT, '.env') });

import { GoogleGenAI } from '@google/genai';

const OUTPUT_PATH = join(ROOT, 'public', 'intro_background.png');
const INTRO_FLAG_PATH = join(ROOT, 'src', 'data', 'introBackground.ts');

const MODEL_PRIMARY = process.env.MODEL_IMAGE || 'gemini-3-pro-image-preview';
const MODEL_BACKUP = process.env.MODEL_IMAGE_BACKUP || 'gemini-2.5-flash-image';

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is required');
  return new GoogleGenAI({ apiKey });
}

function getBookTitle() {
  const scriptPath = join(ROOT, 'src/data/bookScript.ts');
  if (!existsSync(scriptPath)) return '';
  const content = readFileSync(scriptPath, 'utf-8');
  const m = content.match(/bookTitle:\s*["']([^"']+)["']/);
  return m ? m[1] : '';
}

const LANDSCAPE_PROMPT = `Create a single cinematic landscape image for use as a subtle background behind a book cover.

Requirements:
- Serene, atmospheric natural scenery (e.g. soft hills, forest edge, misty valley, or calm water).
- Soft natural lighting, no harsh shadows. Mood: peaceful and contemplative.
- Vertical 9:16 aspect ratio, suitable for mobile video.
- NO text, NO people, NO man-made objects. Pure nature only.
- Slightly muted or desaturated so it does not compete with the book cover overlay.
- High quality, photorealistic or painterly style.`;

async function main() {
  const bookTitle = getBookTitle();
  const context = bookTitle ? ` (Context: this will sit behind the cover of the book "${bookTitle}")` : '';
  const prompt = LANDSCAPE_PROMPT + context;

  const ai = getClient();

  const attempt = async (modelName) => {
    console.log(`   Attempting with model: ${modelName}...`);
    try {
      const config = {
        imageConfig: { aspectRatio: '9:16' },
      };
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config,
      });
      
      if (!response.candidates || !response.candidates[0] || !response.candidates[0].content) {
        console.warn(`   No content in response from ${modelName}`);
        return false;
      }

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const buffer = Buffer.from(part.inlineData.data, 'base64');
          writeFileSync(OUTPUT_PATH, buffer);
          return true;
        }
      }
      return false;
    } catch (e) {
      console.warn(`   Error with ${modelName}: ${e.message}`);
      return false;
    }
  };

  console.log('🖼️  Generating intro scene background (AI landscape)...');
  let ok = await attempt(MODEL_PRIMARY);
  if (!ok) {
    console.warn('   Primary model failed, trying backup...');
    ok = await attempt(MODEL_BACKUP);
  }
  
  if (!ok) {
    console.warn('   Both primary and backup failed. Disabling intro background...');
    writeFileSync(INTRO_FLAG_PATH, "export const hasIntroBackground = false;\n", 'utf-8');
    return;
  }

  writeFileSync(INTRO_FLAG_PATH, "export const hasIntroBackground = true;\n", 'utf-8');
  console.log('   ✅ Saved public/intro_background.png and enabled in intro scene.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
