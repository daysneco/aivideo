#!/usr/bin/env node
import { GoogleGenAI } from '@google/genai';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = join(__dirname, '../output');
if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

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

// All 30 Gemini TTS voices
const allVoices = [
  { name: 'Zephyr',        desc: 'Bright' },
  { name: 'Puck',           desc: 'Upbeat' },
  { name: 'Charon',         desc: 'Informative' },
  { name: 'Kore',           desc: 'Firm' },
  { name: 'Fenrir',         desc: 'Excitable' },
  { name: 'Leda',           desc: 'Youthful' },
  { name: 'Orus',           desc: 'Firm' },
  { name: 'Aoede',          desc: 'Breezy' },
  { name: 'Callirrhoe',     desc: 'Easy-going' },
  { name: 'Autonoe',        desc: 'Bright' },
  { name: 'Enceladus',      desc: 'Breathy' },
  { name: 'Iapetus',        desc: 'Clear' },
  { name: 'Umbriel',        desc: 'Easy-going' },
  { name: 'Algieba',        desc: 'Smooth' },
  { name: 'Despina',        desc: 'Smooth' },
  { name: 'Erinome',        desc: 'Clear' },
  { name: 'Algenib',        desc: 'Gravelly' },
  { name: 'Rasalgethi',     desc: 'Informative' },
  { name: 'Laomedeia',      desc: 'Upbeat' },
  { name: 'Achernar',       desc: 'Soft' },
  { name: 'Alnilam',        desc: 'Firm' },
  { name: 'Schedar',        desc: 'Even' },
  { name: 'Gacrux',         desc: 'Mature' },
  { name: 'Pulcherrima',    desc: 'Forward' },
  { name: 'Achird',         desc: 'Friendly' },
  { name: 'Zubenelgenubi',  desc: 'Casual' },
  { name: 'Vindemiatrix',   desc: 'Gentle' },
  { name: 'Sadachbia',      desc: 'Lively' },
  { name: 'Sadaltager',     desc: 'Knowledgeable' },
  { name: 'Sulafat',        desc: 'Warm' },
];

// Skip already generated voices
const skip = new Set(['Schedar', 'Gacrux']);
const voices = allVoices.filter(v => !skip.has(v.name));

const results = [];
let done = 0;

async function generateWithVoice(voiceName) {
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
        console.error(`  [${voiceName}] No audio data (attempt ${attempt})`);
        if (attempt < 3) await new Promise(r => setTimeout(r, 3000));
        continue;
      }

      const pcmBuffer = Buffer.from(data, 'base64');
      const pcmPath = join(outputDir, `tts-test-${voiceName}.pcm`);
      const wavPath = join(outputDir, `tts-test-${voiceName}.wav`);
      writeFileSync(pcmPath, pcmBuffer);
      execSync(`ffmpeg -y -f s16le -ar 24000 -ac 1 -i "${pcmPath}" "${wavPath}" 2>/dev/null`);
      execSync(`rm "${pcmPath}"`);
      return { voice: voiceName, size: pcmBuffer.length, ok: true };
    } catch (e) {
      console.error(`  [${voiceName}] Attempt ${attempt}: ${e.message}`);
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }
  return { voice: voiceName, ok: false };
}

console.log(`Generating ${voices.length} voice demos...\n`);
const startTime = Date.now();

for (const v of voices) {
  done++;
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`[${done}/${voices.length}] ${v.name} (${v.desc}) ... [${elapsed}s elapsed]`);

  const result = await generateWithVoice(v.name);
  if (result.ok) {
    console.log(`  ✓ output/tts-test-${v.name}.wav (${(result.size / 1024).toFixed(0)} KB)`);
    results.push({ ...v, ok: true, size: result.size });
  } else {
    console.log(`  ✗ FAILED`);
    results.push({ ...v, ok: false });
  }

  // Delay between calls to avoid rate limiting
  if (done < voices.length) {
    await new Promise(r => setTimeout(r, 2000));
  }
}

const totalTime = ((Date.now() - startTime) / 1000).toFixed(0);
console.log(`\n========================================`);
console.log(`Done! ${results.filter(r => r.ok).length}/${voices.length} succeeded in ${totalTime}s`);
console.log(`========================================\n`);

// Print summary table
console.log('Voice Summary:');
console.log('─'.repeat(50));
for (const r of results) {
  const status = r.ok ? '✓' : '✗';
  const sizeStr = r.ok ? `${(r.size / 1024).toFixed(0)} KB` : 'FAILED';
  console.log(`  ${status} ${r.name.padEnd(16)} ${r.desc.padEnd(14)} ${sizeStr}`);
}
