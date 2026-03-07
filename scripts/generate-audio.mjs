#!/usr/bin/env node
import { readFileSync, existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { createHmac } from 'crypto';

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
import { GoogleGenAI } from '@google/genai';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUDIO_DIR = join(__dirname, '../public/audio');
const SCRIPT_PATH = join(__dirname, '../src/data/bookScript.ts');

if (!existsSync(AUDIO_DIR)) {
  mkdirSync(AUDIO_DIR, { recursive: true });
}

// Load TTS config from shared config.ts
function loadTTSConfig() {
  const configPath = join(__dirname, '../src/config.ts');
  const content = readFileSync(configPath, 'utf-8');
  const ttsMatch = content.match(/TTS:\s*\{([^}]+)\}/s);
  if (!ttsMatch) return {};
  const block = ttsMatch[1];
  const get = (key) => {
    const m = block.match(new RegExp(`${key}:\\s*['"]([^'"]+)['"]`));
    return m ? m[1] : undefined;
  };
  return {
    provider: get('PROVIDER'),
    edgeVoice: get('EDGE_VOICE'),
    edgeRate: get('EDGE_RATE'),
    edgeStyle: get('EDGE_STYLE'),
    geminiVoice: get('GEMINI_VOICE'),
  };
}

const ttsConfig = loadTTSConfig();
const PROVIDER = process.env.TTS_PROVIDER || ttsConfig.provider || 'edge';
const GEMINI_VOICE = ttsConfig.geminiVoice || 'Gacrux';
const EDGE_VOICE = ttsConfig.edgeVoice || 'zh-CN-YunfengNeural';
const EDGE_RATE = ttsConfig.edgeRate || '+0%';
const EDGE_STYLE = ttsConfig.edgeStyle || 'general';

// Initialize Gemini
const geminiApiKey = process.env.GEMINI_API_KEY;
const ai = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

// ── Azure Edge TTS via Microsoft Translator endpoint ──

const SIGN_KEY = Buffer.from('oik6PdDdMnOXemTbwvMn9de/h9lFnfBaCWbGMMZqqoSaQaqUOqjVGm5NqsmjcBI1x+sS9ugjB55HEJWRiFXYFw==', 'base64');
let tokenCache = { endpoint: null, token: null, expiredAt: 0 };

function uuid() { return crypto.randomUUID().replace(/-/g, ''); }

function dateFormat() {
  return (new Date()).toUTCString().replace(/GMT/, '').trim() + ' GMT';
}

function signUrl(urlStr) {
  const url = urlStr.split('://')[1];
  const encodedUrl = encodeURIComponent(url);
  const uuidStr = uuid();
  const formattedDate = dateFormat().toLowerCase();
  const bytesToSign = `MSTranslatorAndroidApp${encodedUrl}${formattedDate}${uuidStr}`.toLowerCase();
  const sig = createHmac('sha256', SIGN_KEY).update(bytesToSign).digest('base64');
  return `MSTranslatorAndroidApp::${sig}::${formattedDate}::${uuidStr}`;
}

async function getAzureEndpoint() {
  const now = Date.now() / 1000;
  if (tokenCache.token && now < tokenCache.expiredAt - 180) {
    return tokenCache.endpoint;
  }
  const endpointUrl = 'https://dev.microsofttranslator.com/apps/endpoint?api-version=1.0';
  const resp = await fetch(endpointUrl, {
    method: 'POST',
    headers: {
      'Accept-Language': 'zh-Hans',
      'X-ClientVersion': '4.0.530a 5fe1dc6c',
      'X-UserId': '0f04d16a175c411e',
      'X-HomeGeographicRegion': 'zh-Hans-CN',
      'X-ClientTraceId': uuid(),
      'X-MT-Signature': signUrl(endpointUrl),
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0',
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': '0',
    },
  });
  if (!resp.ok) throw new Error(`Azure endpoint fetch failed: ${resp.status}`);
  const data = await resp.json();
  const jwt = JSON.parse(Buffer.from(data.t.split('.')[1], 'base64').toString());
  tokenCache = { endpoint: data, token: data.t, expiredAt: jwt.exp };
  return data;
}

function escapeXml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function buildSsml(text, voice, rate, style) {
  return `<speak xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" version="1.0" xml:lang="zh-CN">
  <voice name="${voice}">
    <mstts:express-as style="${style}" styledegree="2.0" role="default">
      <prosody rate="${rate}" pitch="+0Hz" volume="+0%">${escapeXml(text)}</prosody>
    </mstts:express-as>
  </voice>
</speak>`;
}

async function generateWithEdgeTTS(text, outputPath) {
  const tempMp3 = outputPath.replace('.wav', '.temp.mp3');
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const ep = await getAzureEndpoint();
      const url = `https://${ep.r}.tts.speech.microsoft.com/cognitiveservices/v1`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': ep.t,
          'Content-Type': 'application/ssml+xml',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0',
          'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        },
        body: buildSsml(text, EDGE_VOICE, EDGE_RATE, EDGE_STYLE),
      });
      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Azure TTS ${resp.status}: ${errText.slice(0, 200)}`);
      }
      const buf = Buffer.from(await resp.arrayBuffer());
      writeFileSync(tempMp3, buf);
      execSync(`ffmpeg -y -i "${tempMp3}" -ar 24000 -ac 1 "${outputPath}" 2>/dev/null`);
      unlinkSync(tempMp3);
      return true;
    } catch (e) {
      console.warn(`  ⚠️ Edge TTS attempt ${attempt} failed: ${e.message}`);
      if (attempt < 3) {
        tokenCache = { endpoint: null, token: null, expiredAt: 0 };
        await new Promise(r => setTimeout(r, 500 * attempt));
      }
    }
  }
  try { unlinkSync(tempMp3); } catch (_) {}
  return false;
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

  if (PROVIDER === 'edge') {
    success = await generateWithEdgeTTS(scene.narration, wavPath);
    if (success) {
      const stats = await import('fs').then(fs => fs.statSync(wavPath));
      console.log(`  ✓ ${scene.id}.wav (${EDGE_VOICE}/${EDGE_STYLE}) (${Math.round(stats.size/1024)} KB)`);
      return true;
    } else {
      console.warn(`  ⚠️ edge-tts failed. Falling back to Gemini...`);
    }
  }

  if (!success && (PROVIDER === 'gemini' || PROVIDER === 'edge')) {
    success = await generateWithGemini(scene.narration, wavPath);
    if (success) {
      const stats = await import('fs').then(fs => fs.statSync(wavPath));
      console.log(`  ✓ ${scene.id}.wav (Gemini) (${Math.round(stats.size/1024)} KB)`);
      return true;
    } else {
      console.error(`  ✗ Failed to generate ${scene.id}`);
    }
  }

  return success;
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
    
    const fallbackChain = PROVIDER === 'edge' ? 'edge-tts -> Gemini' : PROVIDER;
    console.log(`\n🎙️  Audio Generation (Provider chain: ${fallbackChain})`);
    
    const total = bookScript.scenes.length;
    for (let i = 0; i < total; i++) {
      writeProgress(i + 1, total);
      const scene = bookScript.scenes[i];
      const ok = await generateSceneAudio(scene, i, total);
      if (ok) successCount++;
      if (PROVIDER !== 'edge') await new Promise(r => setTimeout(r, 1000));
    }

    console.log(`\n✨ ${successCount}/${bookScript.scenes.length} audio files generated!`);
    
  } catch (error) {
    console.error('Fatal Error:', error);
    process.exit(1);
  }
}

main();