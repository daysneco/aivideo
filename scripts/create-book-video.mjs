#!/usr/bin/env node
import 'dotenv/config';
import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function runCommand(command, args = []) {
  // Check if command is a string with arguments (for simple execution)
  // or split command/args
  let cmd = command;
  let cmdArgs = args;

  if (command.includes(' ') && args.length === 0) {
     // Naive split, but good enough for 'npx remotion ...'
     // Better to use shell: true in spawn
  }

  return new Promise((resolve, reject) => {
    // shell: true allows passing full command string
    const proc = spawn(command, args, { stdio: 'inherit', shell: true });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with code ${code}`));
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: npm run create-book-video -- <bookName>');
    process.exit(1);
  }

  const bookName = args[0];
  
  // Ensure output directory
  if (!existsSync('output')) {
    mkdirSync('output');
  }

  console.log(`\n🎬 Starting Video Creation for: "${bookName}"\n`);

  // Step 0: Check Environment
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ Error: GEMINI_API_KEY is not set.');
    process.exit(1);
  }

  try {
    // Step 1: Generate Script
    console.log('📝 [Step 1/5] Generating Book Script...');
    // Pass all args (bookName + optional outline)
    await runCommand(`node "${join(__dirname, 'generate-book-script.mjs')}" ${args.join(' ')}`);

    // Step 2: Generate Audio
    console.log('\n🎤 [Step 2/5] Generating Audio...');
    await runCommand(`node "${join(__dirname, 'generate-audio.mjs')}"`);

    // Step 3: Render Video
    console.log('\n🎞️ [Step 3/5] Rendering Video...');
    const outputFile = `output/${bookName}.mp4`;
    
    // Using npx remotion render
    // Composition ID: BookVideo
    await runCommand(`npx remotion render src/index.ts BookVideo "${outputFile}" --concurrency=4`);

    console.log(`\n✅ All Done! Video saved to ${outputFile}`);

  } catch (error) {
    console.error('\n❌ Process Failed:', error.message);
    process.exit(1);
  }
}

main();
