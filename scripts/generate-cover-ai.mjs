import { GoogleGenAI } from '@google/genai';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IMAGE_DIR = join(__dirname, '../public/images');

// Initialize Gemini client
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error('Please set GEMINI_API_KEY environment variable');
}
const ai = new GoogleGenAI({ apiKey });

const MODEL = 'gemini-2.5-flash-image'; // Updated to 2.5 as suggested

async function generateCover(filename) {
  console.log(`Generating cover for ${filename}...`);
  
  const prompt = `
    You are a professional book cover designer.
    Create a high-quality, minimalist book cover for:
    "The Almanack of Naval Ravikant" (Chinese Title: 纳瓦尔宝典).
    
    Visual Style:
    - Dark, elegant, deep blue or black background.
    - A simple, iconic white silhouette or line art representing "Wisdom" or "Thinking".
    - Maybe a silhouette of a man's head with a universe inside, or a simple geometric leverage symbol.
    - NO TEXT (or very abstract text). The focus is on the art.
    - Aspect Ratio: 16:9 (Landscape video cover).
    
    Do NOT render complex text. Create a stunning visual.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { aspectRatio: '16:9' },
      },
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        const buffer = Buffer.from(part.inlineData.data, 'base64');
        const outputPath = join(IMAGE_DIR, filename);
        writeFileSync(outputPath, buffer);
        console.log(`Saved to ${outputPath}`);
        return;
      }
    }
    console.error('No image data found.');
  } catch (e) {
    console.error('Error:', e);
  }
}

async function main() {
    await generateCover('intro-1.png');
    await generateCover('intro-2.png');
}

main();