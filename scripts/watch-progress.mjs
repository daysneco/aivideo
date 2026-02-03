import { readFileSync, statSync } from 'fs';

function checkProgress() {
  try {
    // Check log file
    const logContent = readFileSync('render.log', 'utf-8');
    const lines = logContent.trim().split('\n');
    const lastLines = lines.slice(-5);
    
    console.log('--- Render Log ---');
    console.log(lastLines.join('\n'));
    
    // Check output file size if exists
    try {
      const stats = statSync('output/final_video.mp4');
      console.log(`\n📁 Video Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    } catch (e) {
      console.log('\n📁 Video file not created yet.');
    }
    
  } catch (e) {
    console.log('Waiting for logs...');
  }
}

checkProgress();
