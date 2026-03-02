#!/usr/bin/env node
/**
 * Sync durationInFrames in bookScript.ts with actual audio file durations.
 * Adds padding frames at the end of each scene for a natural pause.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUDIO_DIR = join(__dirname, '../public/audio');
const SCRIPT_PATH = join(__dirname, '../src/data/bookScript.ts');
const FPS = 30;
const PADDING_FRAMES = 45; // 1.5s silence at end of each scene

function getAudioDuration(filePath) {
  try {
    const result = execSync(
      `ffprobe -v error -show_entries format=duration -of csv=p=0 "${filePath}"`,
      { encoding: 'utf-8' }
    ).trim();
    return parseFloat(result);
  } catch {
    return null;
  }
}

function main() {
  const content = readFileSync(SCRIPT_PATH, 'utf-8');

  // Parse bookScript
  const startIdx = content.indexOf('export const bookScript: BookScript = ');
  if (startIdx === -1) {
    console.error('Could not find bookScript export in bookScript.ts');
    process.exit(1);
  }

  const jsonStart = startIdx + 'export const bookScript: BookScript = '.length;
  const jsonEnd = content.lastIndexOf(';');
  const jsonStr = content.substring(jsonStart, jsonEnd).trim();
  
  let scriptData;
  try {
    scriptData = eval(`(${jsonStr})`);
  } catch (e) {
    console.error('Failed to parse bookScript.ts content:', e.message);
    process.exit(1);
  }

  let updated = 0;
  let totalDuration = 0;

  console.log('🔄 Syncing durations with actual audio files...\n');
  console.log('Scene           | Old Frames | Audio(s)  | New Frames | Diff');
  console.log('----------------|------------|-----------|------------|------');

  for (const scene of scriptData.scenes) {
    const audioPath = join(AUDIO_DIR, `${scene.id}.wav`);
    if (!existsSync(audioPath)) {
      console.log(`${scene.id.padEnd(16)}| ${String(scene.durationInFrames).padEnd(11)}| no audio  | unchanged  |`);
      totalDuration += scene.durationInFrames;
      continue;
    }

    const audioDuration = getAudioDuration(audioPath);
    if (!audioDuration) {
      totalDuration += scene.durationInFrames;
      continue;
    }

    const oldFrames = scene.durationInFrames;
    const newFrames = Math.ceil(audioDuration * FPS) + PADDING_FRAMES;
    const diff = newFrames - oldFrames;
    const diffStr = diff > 0 ? `+${diff}` : `${diff}`;

    if (oldFrames !== newFrames) {
      scene.durationInFrames = newFrames;
      scene.durationSeconds = parseFloat((newFrames / FPS).toFixed(1));
      updated++;
    }

    totalDuration += newFrames;
    console.log(
      `${scene.id.padEnd(16)}| ${String(oldFrames).padEnd(11)}| ${audioDuration.toFixed(1).padEnd(10)}| ${String(newFrames).padEnd(11)}| ${diffStr}`
    );
  }

  // Update totalDuration in object
  scriptData.totalDuration = totalDuration;

  // Write back the whole file
  const newFileContent = `import { BookScript } from '../types/book';

export const bookScript: BookScript = ${JSON.stringify(scriptData, null, 2)};
`;

  writeFileSync(SCRIPT_PATH, newFileContent, 'utf-8');

  console.log(`\n✨ Updated ${updated} scenes. Total duration: ${totalDuration} frames (${(totalDuration / FPS).toFixed(1)}s)`);
}

main();
