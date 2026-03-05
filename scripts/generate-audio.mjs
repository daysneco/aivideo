#!/usr/bin/env node
import { readFileSync, existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';

function writeProgress(current, total) {
  const f = process.env.VIDEO_PROGRESS_FILE;
  const step = process.env.VIDEO_PROGRESS_STEP || 'Audio';
  if (!f) return;
  try {
    writeFileSync(f, `[${new Date().toLocaleTimeString()}] ${step}... ${current}/${total}\n`, 'utf-8');
  } catch (_) {}
}
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import 'dotenv/config';
import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUDIO_DIR = join(__dirname, '../public/audio');
const SCRIPT_PATH = join(__dirname, '../src/data/bookScript.ts');

// Ensure audio directory exists
if (!existsSync(AUDIO_DIR)) {
  mkdirSync(AUDIO_DIR, { recursive: true });
}

// Configuration
const PROVIDER = process.env.TTS_PROVIDER || 'gemini';
const GEMINI_VOICE = 'Gacrux';

// Initialize OpenAI (fallback)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-placeholder', 
});

// Initialize Gemini
const geminiApiKey = process.env.GEMINI_API_KEY;
const ai = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

async function generateWithOpenAI(text, outputPath) {
  try {
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: "onyx",
      input: text,
    });
    const buffer = Buffer.from(await mp3.arrayBuffer());
    // Convert mp3 buffer to wav using ffmpeg via temp file
    const tempMp3 = outputPath.replace('.wav', '.temp.mp3');
    writeFileSync(tempMp3, buffer);
    execSync(`ffmpeg -y -i "${tempMp3}" -ar 24000 -ac 1 "${outputPath}" 2>/dev/null`);
    unlinkSync(tempMp3);
    return true;
  } catch (error) {
    console.error('OpenAI TTS failed:', error.message);
    return false;
  }
}

async function generateWithGemini(text, outputPath) {
  if (!ai) {
    console.error('GEMINI_API_KEY is not set');
    return false;
  }

  const prompt = `# AUDIO PROFILE: 短视频讲书人

### DIRECTOR'S NOTES
Style: 充满激情、引人入胜的短视频讲书人。声音具有穿透力，能够立刻抓住观众的注意力。
Pacing: 语速像机关枪一样密集但逻辑清晰，节奏感强，重点词语要重音强调。
Accent: 标准普通话，声音要清晰有力。

### TRANSCRIPT
${text}`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: GEMINI_VOICE },
            },
          },
        },
      });

      const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!data) {
        throw new Error('No audio data received from Gemini');
      }

      const pcmBuffer = Buffer.from(data, 'base64');
      const pcmPath = outputPath.replace('.wav', '.temp.pcm');
      writeFileSync(pcmPath, pcmBuffer);
      
      // The API returns 24kHz raw PCM data (s16le)
      execSync(`ffmpeg -y -f s16le -ar 24000 -ac 1 -i "${pcmPath}" "${outputPath}" 2>/dev/null`);
      unlinkSync(pcmPath);
      return true;
    } catch (e) {
      console.warn(`  ⚠️ Gemini TTS attempt ${attempt} failed: ${e.message}`);
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }
  return false;
}

async function generateSceneAudio(scene, index, total) {
  const wavPath = join(AUDIO_DIR, `${scene.id}.wav`);

  if (existsSync(wavPath)) {
    console.log(`[${index + 1}/${total}] Skipping existing: ${scene.id}`);
    return true;
  }

  console.log(`[${index + 1}/${total}] Generating: ${scene.id}...`);

  let success = false;

  if (PROVIDER === 'gemini') {
    success = await generateWithGemini(scene.narration, wavPath);
    if (success) {
      const stats = await import('fs').then(fs => fs.statSync(wavPath));
      console.log(`  ✓ ${scene.id}.wav (Gemini) (${Math.round(stats.size/1024)} KB)`);
      return true;
    } else {
      console.warn(`  ⚠️ Gemini failed. Falling back to OpenAI...`);
    }
  }

  // Fallback or if provider is openai
  if (!success && process.env.OPENAI_API_KEY) {
    success = await generateWithOpenAI(scene.narration, wavPath);
    if (success) {
      const stats = await import('fs').then(fs => fs.statSync(wavPath));
      console.log(`  ✓ ${scene.id}.wav (OpenAI) (${Math.round(stats.size/1024)} KB)`);
      return true;
    }
  }

  console.error(`  ✗ Failed to generate ${scene.id}`);
  return false;
}

function parseBookScript() {
  if (!existsSync(SCRIPT_PATH)) {
    throw new Error(`Script file not found at ${SCRIPT_PATH}`);
  }
  const content = readFileSync(SCRIPT_PATH, 'utf-8');
  const jsonStr = content.match(/export const bookScript: BookScript = (\{[\s\S]*?\});/)[1];
  return eval(`(${jsonStr})`);
}

async function main() {
  try {
    const bookScript = parseBookScript();
    let successCount = 0;
    
    console.log(`\n🎙️  Audio Generation (Provider: ${PROVIDER}${PROVIDER === 'gemini' ? ' -> OpenAI Fallback' : ''})`);
    
    const total = bookScript.scenes.length;
    for (let i = 0; i < total; i++) {
      writeProgress(i + 1, total);
      const scene = bookScript.scenes[i];
      const ok = await generateSceneAudio(scene, i, total);
      if (ok) successCount++;
      await new Promise(r => setTimeout(r, 1000));
    }

    console.log(`\n✨ ${successCount}/${bookScript.scenes.length} audio files generated!`);
    
  } catch (error) {
    console.error('Fatal Error:', error);
    process.exit(1);
  }
}

main();