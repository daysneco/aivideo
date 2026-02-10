#!/usr/bin/env node
import { readFileSync, existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUDIO_DIR = join(__dirname, '../public/audio');

// Gemini TTS configuration
const VOICE = 'Achernar';  // Soft, gentle female voice
const MODEL = 'gemini-2.5-flash-preview-tts';

// Director's notes for consistent book narrator style
const NARRATOR_PROMPT = `# AUDIO PROFILE: 小雨
## "温暖的讲书人"

### DIRECTOR'S NOTES
Style: 温暖亲切的女性讲书人，像在和好朋友分享一本有趣的书。声音柔和自然，带有微笑感，让听众感到舒适放松。
Pacing: 语速适中偏慢，节奏平稳舒缓，重点词语略微放慢强调。段落之间自然停顿。
Accent: 标准普通话，清晰自然。

### TRANSCRIPT
`;

// Ensure audio directory exists
if (!existsSync(AUDIO_DIR)) {
  mkdirSync(AUDIO_DIR, { recursive: true });
}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('❌ GEMINI_API_KEY not set');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

async function generateSceneAudio(scene, index, total) {
  const pcmPath = join(AUDIO_DIR, `${scene.id}.pcm`);
  const wavPath = join(AUDIO_DIR, `${scene.id}.wav`);

  console.log(`[${index + 1}/${total}] Generating: ${scene.id}...`);

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ parts: [{ text: NARRATOR_PROMPT + scene.narration }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: VOICE },
          },
        },
      },
    });

    const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!data) {
      console.error(`  ✗ No audio data returned`);
      return false;
    }

    // Save PCM, then convert to WAV
    const pcmBuffer = Buffer.from(data, 'base64');
    writeFileSync(pcmPath, pcmBuffer);
    execSync(`ffmpeg -y -f s16le -ar 24000 -ac 1 -i "${pcmPath}" "${wavPath}" 2>/dev/null`);
    unlinkSync(pcmPath);

    console.log(`  ✓ ${scene.id}.wav (${(pcmBuffer.length / 1024).toFixed(0)} KB)`);
    return true;
  } catch (e) {
    console.error(`  ✗ Error: ${e.message}`);
    return false;
  }
}

async function generateAllAudio(scenes) {
  console.log(`\n🎙️  Audio Generation (Gemini TTS)`);
  console.log(`   Scenes: ${scenes.length}`);
  console.log(`   Voice: ${VOICE}`);
  console.log(`   Model: ${MODEL}`);
  console.log(`   Output: ${AUDIO_DIR}\n`);

  const startTime = Date.now();
  let success = 0;

  for (let i = 0; i < scenes.length; i++) {
    const ok = await generateSceneAudio(scenes[i], i, scenes.length);
    if (ok) success++;
    // Small delay to avoid rate limiting
    if (i < scenes.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✨ ${success}/${scenes.length} audio files generated in ${duration}s!`);
}

// Parse bookScript.ts and run
async function main() {
  // Support --count=N to limit scenes
  const countArg = process.argv.find(a => a.startsWith('--count='));
  const maxCount = countArg ? parseInt(countArg.split('=')[1]) : Infinity;

  try {
    const scriptPath = join(__dirname, '../src/data/bookScript.ts');
    const content = readFileSync(scriptPath, 'utf-8');

    const startIdx = content.indexOf('export const bookScript: BookScript = ');
    if (startIdx === -1) throw new Error('Could not find bookScript export');

    const jsonStart = startIdx + 'export const bookScript: BookScript = '.length;
    const jsonEnd = content.lastIndexOf(';');
    const jsonStr = content.substring(jsonStart, jsonEnd).trim();
    const scriptData = eval(`(${jsonStr})`);

    const scenes = scriptData.scenes.slice(0, maxCount);
    await generateAllAudio(scenes);
  } catch (e) {
    console.error('Failed:', e);
    process.exit(1);
  }
}

main();
