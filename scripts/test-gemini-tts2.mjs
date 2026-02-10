#!/usr/bin/env node
import { GoogleGenAI } from '@google/genai';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('GEMINI_API_KEY not set');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

const text = `大家有没有想过，为什么超市里的牛奶盒子是方形的，而可乐瓶子却是圆形的？这看起来只是包装设计的差异，但其实背后隐藏着深刻的经济学逻辑。今天我们就来聊聊这本风靡全球的《牛奶可乐经济学》。`;

const prompt = `# AUDIO PROFILE: 讲书人

### DIRECTOR'S NOTES
Style: 温暖亲切的讲书人，像在和好朋友分享一本有趣的书。声音自然，让听众感到舒适放松。
Pacing: 语速适中偏慢，节奏平稳舒缓，重点词语略微放慢强调。
Accent: 标准普通话，清晰自然。

### TRANSCRIPT
${text}`;

const voiceName = 'Gacrux';

async function generate() {
  console.log(`Generating with voice: ${voiceName}...`);
  for (let attempt = 1; attempt <= 3; attempt++) {
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
        console.error(`  No audio data (attempt ${attempt})`);
        continue;
      }

      const pcmBuffer = Buffer.from(data, 'base64');
      const pcmPath = join(__dirname, `../output/tts-test-${voiceName}.pcm`);
      const wavPath = join(__dirname, `../output/tts-test-${voiceName}.wav`);
      writeFileSync(pcmPath, pcmBuffer);
      execSync(`ffmpeg -y -f s16le -ar 24000 -ac 1 -i "${pcmPath}" "${wavPath}" 2>/dev/null`);
      execSync(`rm "${pcmPath}"`);
      console.log(`  Done: output/tts-test-${voiceName}.wav (${(pcmBuffer.length / 1024).toFixed(0)} KB)`);
      return;
    } catch (e) {
      console.error(`  Attempt ${attempt} error: ${e.message}`);
      if (attempt < 3) {
        console.log(`  Retrying in 3s...`);
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }
  console.error(`  Failed after 3 attempts.`);
}

await generate();
