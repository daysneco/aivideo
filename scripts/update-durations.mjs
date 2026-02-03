import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseFile } from 'music-metadata';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = join(__dirname, '../src/data/bookScript.ts');
const AUDIO_DIR = join(__dirname, '../public/audio');
const FPS = 30;

async function updateDurations() {
  console.log('🔄 Updating durations based on actual audio files...');

  // 1. Read existing script
  // Quick hack to read TS file content
  const scriptContent = readFileSync(SCRIPT_PATH, 'utf-8');
  // Extract JSON part using regex (assuming standard formatting)
  const jsonMatch = scriptContent.match(/export const bookScript: BookScript = (\{[\s\S]*\});/);
  
  if (!jsonMatch) {
    console.error('❌ Could not parse bookScript.ts');
    process.exit(1);
  }

  // Parse current data
  // Using eval safely here because we trust our own generated file
  const bookData = eval(`(${jsonMatch[1]})`);
  
  let totalDuration = 0;
  let updatedCount = 0;

  // 2. Iterate and measure audio
  for (const scene of bookData.scenes) {
    const audioPath = join(AUDIO_DIR, `${scene.id}.mp3`);
    
    try {
      const metadata = await parseFile(audioPath);
      const durationSec = metadata.format.duration;
      
      if (durationSec) {
        // Add 0.5s padding to prevent abrupt cuts
        const newDurationFrames = Math.ceil((durationSec + 0.5) * FPS);
        
        // Log significant changes
        const diff = newDurationFrames - scene.durationInFrames;
        if (Math.abs(diff) > 10) {
          console.log(`   ${scene.id}: ${scene.durationInFrames} -> ${newDurationFrames} frames (${(diff/30).toFixed(1)}s)`);
        }

        scene.durationInFrames = newDurationFrames;
        // Keep original durationSeconds for reference, or update it too? 
        // Let's update it to match actual audio
        scene.durationSeconds = durationSec; 
        updatedCount++;
      }
    } catch (e) {
      console.warn(`⚠️  Could not measure audio for ${scene.id}: ${e.message}`);
    }
    
    totalDuration += scene.durationInFrames;
  }

  bookData.totalDuration = totalDuration;

  // 3. Write back to file
  const newFileContent = `import { BookScript } from '../types/book';

export const bookScript: BookScript = ${JSON.stringify(bookData, null, 2)};
`;

  writeFileSync(SCRIPT_PATH, newFileContent, 'utf-8');
  console.log(`\n✅ Updated ${updatedCount} scenes.`);
  console.log(`⏱️  New Total Duration: ${(totalDuration / FPS / 60).toFixed(1)} mins`);
}

updateDurations();
