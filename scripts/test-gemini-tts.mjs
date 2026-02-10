#!/usr/bin/env node
import { GoogleGenAI } from '@google/genai';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('❌ GEMINI_API_KEY not set');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

// First scene narration as test
const text = `大家有没有想过，为什么超市里的牛奶盒子是方形的，而可乐瓶子却是圆形的？这看起来只是包装设计的差异，但其实背后隐藏着深刻的经济学逻辑。今天我们就来聊聊这本风靡全球的《牛奶可乐经济学》。`;

// Prompt with director's notes for book narrator style
const prompt = `# AUDIO PROFILE: 小雨
## "温暖的讲书人"

### DIRECTOR'S NOTES
Style: 温暖亲切的女性讲书人，像在和好朋友分享一本有趣的书。声音柔和自然，带有微笑感，让听众感到舒适放松。
Pacing: 语速适中偏慢，节奏平稳舒缓，重点词语略微放慢强调。段落之间自然停顿。
Accent: 标准普通话，清晰自然。

### TRANSCRIPT
${text}`;

const voices = ['Sulafat', 'Achernar', 'Vindemiatrix', 'Achird'];

async function generateWithVoice(voiceName) {
  console.log(`\n🎙️  Generating with voice: ${voiceName}...`);
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!data) {
      console.error(`  ✗ No audio data returned for ${voiceName}`);
      return;
    }

    // data is base64 encoded PCM, save as raw PCM first then convert
    const pcmBuffer = Buffer.from(data, 'base64');
    const outputPath = join(__dirname, `../output/tts-test-${voiceName}.pcm`);
    writeFileSync(outputPath, pcmBuffer);
    console.log(`  ✓ Saved PCM: output/tts-test-${voiceName}.pcm (${(pcmBuffer.length / 1024).toFixed(0)} KB)`);
    
    return outputPath;
  } catch (e) {
    console.error(`  ✗ Error with ${voiceName}:`, e.message);
  }
}

async function main() {
  console.log('🎬 Gemini TTS Test - Book Narrator Voice Comparison');
  console.log(`   Text: ${text.substring(0, 40)}...`);
  console.log(`   Voices: ${voices.join(', ')}`);

  const pcmFiles = [];
  for (const voice of voices) {
    const path = await generateWithVoice(voice);
    if (path) pcmFiles.push({ voice, path });
  }

  // Convert PCM to WAV using ffmpeg
  console.log('\n📦 Converting to WAV...');
  const { execSync } = await import('child_process');
  for (const { voice, path } of pcmFiles) {
    const wavPath = path.replace('.pcm', '.wav');
    try {
      execSync(`ffmpeg -y -f s16le -ar 24000 -ac 1 -i "${path}" "${wavPath}" 2>/dev/null`);
      console.log(`  ✓ output/tts-test-${voice}.wav`);
      // Clean up PCM
      const { unlinkSync } = await import('fs');
      unlinkSync(path);
    } catch (e) {
      console.error(`  ✗ ffmpeg conversion failed for ${voice}`);
    }
  }

  console.log('\n✨ Done! Listen to the wav files in output/ to compare voices.');
}

main();
