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
import { createHmac, randomUUID } from 'crypto';
import { execSync } from 'child_process';
import 'dotenv/config';
import OpenAI from 'openai';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUDIO_DIR = join(__dirname, '../public/audio');
const SCRIPT_PATH = join(__dirname, '../src/data/bookScript.ts');
const CONFIG_PATH = join(__dirname, '../src/config.ts');

// Helper to get config from TS file (since we're in CJS/MJS without ts-node)
function getConfig() {
  const content = readFileSync(CONFIG_PATH, 'utf-8');
  const speedMatch = content.match(/AUDIO_SPEED:\s*['"](.*?)['"]/);
  return {
    AUDIO_SPEED: speedMatch ? speedMatch[1] : '+25%'
  };
}
const config = getConfig();

// Configuration
const PROVIDER = process.env.TTS_PROVIDER || 'wangwang';
const WANGWANG_VOICE = 'zh-CN-XiaochenNeural'; // 晓辰女声 

// Ensure audio directory exists
if (!existsSync(AUDIO_DIR)) {
  mkdirSync(AUDIO_DIR, { recursive: true });
}

// Initialize OpenAI (fallback)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-placeholder', 
});

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

// ---- WangWang / Edge TTS Logic ----

let tokenInfo = { endpoint: null, token: null, expiredAt: null };
const TOKEN_REFRESH_BEFORE_EXPIRY = 3 * 60;

function uuid() { return randomUUID().replace(/-/g, ""); }
function dateFormat() { return (new Date()).toUTCString().replace(/GMT/, "").trim().toLowerCase() + " gmt"; }
function base64ToBytes(base64) { return Buffer.from(base64, 'base64'); }
function bytesToBase64(bytes) { return bytes.toString('base64'); }
function hmacSha256(key, data) { return createHmac('sha256', key).update(data).digest(); }

async function sign(urlStr) {
    const url = urlStr.split("://")[1];
    const encodedUrl = encodeURIComponent(url);
    const uuidStr = uuid();
    const formattedDate = dateFormat();
    const bytesToSign = `MSTranslatorAndroidApp${encodedUrl}${formattedDate}${uuidStr}`.toLowerCase();
    const decode = base64ToBytes("oik6PdDdMnOXemTbwvMn9de/h9lFnfBaCWbGMMZqqoSaQaqUOqjVGm5NqsmjcBI1x+sS9ugjB55HEJWRiFXYFw==");
    const signData = hmacSha256(decode, bytesToSign);
    const signBase64 = bytesToBase64(signData);
    return `MSTranslatorAndroidApp::${signBase64}::${formattedDate}::${uuidStr}`;
}

async function getEndpoint() {
    const now = Date.now() / 1000;
    if (tokenInfo.token && tokenInfo.expiredAt && now < tokenInfo.expiredAt - TOKEN_REFRESH_BEFORE_EXPIRY) {
        return tokenInfo.endpoint;
    }
    const endpointUrl = "https://dev.microsofttranslator.com/apps/endpoint?api-version=1.0";
    const clientId = uuid();
    try {
        const signature = await sign(endpointUrl);
        const response = await fetch(endpointUrl, {
            method: "POST",
            headers: {
                "Accept-Language": "zh-Hans",
                "X-ClientVersion": "4.0.530a 5fe1dc6c",
                "X-UserId": "0f04d16a175c411e",
                "X-HomeGeographicRegion": "zh-Hans-CN",
                "X-ClientTraceId": clientId,
                "X-MT-Signature": signature,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0",
                "Content-Type": "application/json; charset=utf-8",
                "Content-Length": "0",
                "Accept-Encoding": "gzip"
            }
        });
        if (!response.ok) throw new Error(`Get endpoint failed: ${response.status} ${await response.text()}`);
        const data = await response.json();
        const jwt = data.t.split(".")[1];
        const decodedJwt = JSON.parse(Buffer.from(jwt, 'base64').toString());
        tokenInfo = { endpoint: data, token: data.t, expiredAt: decodedJwt.exp };
        return data;
    } catch (error) {
        console.error("Get endpoint failed:", error);
        if (tokenInfo.token) return tokenInfo.endpoint;
        throw error;
    }
}

function escapeXmlText(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function getSsml(text, voiceName, rate, pitch, volume, style, slien = 0) {
    const escapedText = escapeXmlText(text);
    let slien_str = slien > 0 ? `<break time="${slien}ms" />` : '';
    return `<speak xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" version="1.0" xml:lang="zh-CN"> 
                <voice name="${voiceName}"> 
                    <mstts:express-as style="${style}"  styledegree="2.0" role="default" > 
                        <prosody rate="${rate}" pitch="${pitch}" volume="${volume}">${escapedText}</prosody> 
                    </mstts:express-as> 
                    ${slien_str}
                </voice> 
            </speak>`;
}

async function generateWithWangWang(scene) {
    const endpoint = await getEndpoint();
    const url = `https://${endpoint.r}.tts.speech.microsoft.com/cognitiveservices/v1`;
    const ssml = getSsml(scene.narration, WANGWANG_VOICE, config.AUDIO_SPEED, '+0Hz', '+0%', 'general');
    
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": endpoint.t,
            "Content-Type": "application/ssml+xml",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0",
            "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3"
        },
        body: ssml
    });

    if (!response.ok) throw new Error(`Edge TTS API Error: ${response.status} ${await response.text()}`);
    return Buffer.from(await response.arrayBuffer());
}

async function generateSceneAudio(scene, index, total) {
  const wavPath = join(AUDIO_DIR, `${scene.id}.wav`);
  const mp3Path = join(AUDIO_DIR, `${scene.id}.mp3`);

  if (existsSync(wavPath)) {
    console.log(`[${index + 1}/${total}] Skipping existing: ${scene.id}`);
    return true;
  }

  console.log(`[${index + 1}/${total}] Generating: ${scene.id}...`);

  // Try WangWang
  try {
      const mp3Buffer = await generateWithWangWang(scene);
      writeFileSync(mp3Path, mp3Buffer);
      execSync(`ffmpeg -y -i "${mp3Path}" -ar 24000 -ac 1 "${wavPath}" 2>/dev/null`);
      unlinkSync(mp3Path);
      const stats = await import('fs').then(fs => fs.statSync(wavPath));
      console.log(`  ✓ ${scene.id}.wav (WangWang) (${Math.round(stats.size/1024)} KB)`);
      return true;
  } catch (e) {
      console.warn(`  ⚠️ WangWang failed: ${e.message}. Trying OpenAI...`);
      
      // Fallback to OpenAI
      if (process.env.OPENAI_API_KEY) {
          const ok = await generateWithOpenAI(scene.narration, wavPath);
          if (ok) {
              const stats = await import('fs').then(fs => fs.statSync(wavPath));
              console.log(`  ✓ ${scene.id}.wav (OpenAI) (${Math.round(stats.size/1024)} KB)`);
              return true;
          }
      }
      
      console.error(`  ✗ Failed to generate ${scene.id}`);
      return false;
  }
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
    
    console.log('\n🎙️  Audio Generation (Hybrid: WangWang -> OpenAI)');
    
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
