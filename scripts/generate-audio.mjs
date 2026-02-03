#!/usr/bin/env node
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

// Mock bookScript object for later population
const bookScript = { scenes: [] };

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUDIO_DIR = join(__dirname, '../public/audio');

// Configuration
const VOICE = 'zh-CN-XiaoxiaoNeural'; // Female voice
const CONCURRENCY = 5;

// Ensure audio directory exists
if (!existsSync(AUDIO_DIR)) {
  mkdirSync(AUDIO_DIR, { recursive: true });
}

// Helper to run shell command
function runCommand(command) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, { shell: true, stdio: 'ignore' });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with code ${code}`));
    });
  });
}

// Generate single audio file
async function generateAudio(scene) {
  const outputPath = join(AUDIO_DIR, `${scene.id}.mp3`);
  
  // Escape quotes in narration
  const safeText = scene.narration.replace(/"/g, '\\"').replace(/\n/g, ' ');
  
  const cmd = `edge-tts --voice ${VOICE} --text "${safeText}" --write-media "${outputPath}"`;
  
  try {
    await runCommand(cmd);
    // console.log(`✅ Generated: ${scene.id}.mp3`);
    process.stdout.write('.'); // Minimal progress indicator
  } catch (error) {
    console.error(`\n❌ Failed to generate audio for ${scene.id}:`, error.message);
  }
}

// Main execution with concurrency control
async function main() {
  console.log(`\n🎙️  Starting Audio Generation (${bookScript.scenes.length} scenes)...`);
  console.log(`   Output: ${AUDIO_DIR}`);
  console.log(`   Voice: ${VOICE}`);
  
  const scenes = bookScript.scenes;
  const queue = [...scenes];
  const active = [];
  
  const startTime = Date.now();

  // Simple concurrency loop
  while (queue.length > 0 || active.length > 0) {
    // Fill active slots
    while (active.length < CONCURRENCY && queue.length > 0) {
      const scene = queue.shift();
      const promise = generateAudio(scene).then(() => {
        active.splice(active.indexOf(promise), 1);
      });
      active.push(promise);
    }
    
    // Wait for at least one to finish
    if (active.length > 0) {
      await Promise.race(active);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n\n✨ Audio generation complete in ${duration}s!`);
}

// Since bookScript is a TS file, we can't import it directly in Node.js without compilation.
// Quick fix: Read the file content and parse it via regex or temporary TS execution.
// BETTER FIX: Use 'tsx' or 'ts-node' to run this script, BUT current setup uses plain node.
// WORKAROUND: Read src/data/bookScript.ts as text and extract JSON.
async function mainWorkaround() {
  try {
    const scriptPath = join(__dirname, '../src/data/bookScript.ts');
    const content = readFileSync(scriptPath, 'utf-8');
    
    // Extract JSON part: everything after "export const bookScript: BookScript ="
    const jsonMatch = content.match(/export const bookScript: BookScript = (\{[\s\S]*\});/);
    
    if (!jsonMatch) {
      throw new Error('Could not parse bookScript.ts. Regex match failed.');
    }
    
    // Evaluate the object (safe in this context as we generated it)
    // Using Function to parse the object literal (JSON.parse won't work if keys aren't quoted or trailing commas exist)
    // Actually, our generator writes strict JSON-compatible string, so JSON.parse might work if we clean it up
    // But evaluating is safer for JS object literals.
    const scriptData = eval(`(${jsonMatch[1]})`);
    
    // Replace the imported bookScript with parsed data
    bookScript.scenes = scriptData.scenes;
    
    await main();
    
  } catch (e) {
    console.error('Failed to read bookScript:', e);
    process.exit(1);
  }
}

mainWorkaround();
