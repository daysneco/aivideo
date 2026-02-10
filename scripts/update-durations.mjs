#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = join(__dirname, '../src/data/bookScript.ts');
const FPS = 30;

// Read audio durations from CSV
const durationsContent = readFileSync('/tmp/audio_durations.csv', 'utf-8');
const durations = {};

durationsContent.trim().split('\n').forEach(line => {
  const [id, seconds, frames] = line.split(',');
  durations[id] = {
    durationSeconds: Math.round(parseFloat(seconds) * 10) / 10,
    durationInFrames: parseInt(frames)
  };
});

// Read existing script
const scriptContent = readFileSync(SCRIPT_PATH, 'utf-8');
const jsonMatch = scriptContent.match(/export const bookScript: BookScript = (\{[\s\S]*\});/);

if (!jsonMatch) {
  console.error('❌ Could not parse bookScript.ts');
  process.exit(1);
}

const bookData = eval(`(${jsonMatch[1]})`);
let totalDuration = 0;
let updatedCount = 0;

// Update each scene
for (const scene of bookData.scenes) {
  if (durations[scene.id]) {
    const newFrames = durations[scene.id].durationInFrames + 15; // Add 0.5s padding
    const diff = newFrames - scene.durationInFrames;
    
    if (Math.abs(diff) > 10) {
      console.log(`   ${scene.id}: ${scene.durationInFrames} -> ${newFrames} frames (${(diff/30).toFixed(1)}s)`);
      updatedCount++;
    }
    
    scene.durationInFrames = newFrames;
    scene.durationSeconds = durations[scene.id].durationSeconds;
  }
  
  totalDuration += scene.durationInFrames;
}

bookData.totalDuration = totalDuration;

// Write back
const newFileContent = `import { BookScript } from '../types/book';

export const bookScript: BookScript = ${JSON.stringify(bookData, null, 2)};
`;

writeFileSync(SCRIPT_PATH, newFileContent, 'utf-8');
console.log(`\n✅ Updated ${updatedCount} scenes.`);
console.log(`⏱️  New Total Duration: ${(totalDuration / FPS / 60).toFixed(1)} mins`);
