#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { generateContent } from './llm-client.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Default configuration
const FPS = 30;

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node generate-book-script.mjs <bookName> [outlineFile]');
    process.exit(1);
  }

  const bookName = args[0];
  const outlineFile = args[1];
  
  let outlineContent = '';
  if (outlineFile) {
    const outlinePath = join(process.cwd(), outlineFile);
    if (existsSync(outlinePath)) {
      outlineContent = readFileSync(outlinePath, 'utf-8');
      console.log(`Loaded outline from ${outlineFile}`);
    } else {
      console.warn(`Outline file not found: ${outlineFile}, generating without it.`);
    }
  }

  console.log(`Generating script for book: "${bookName}"...`);

  const prompt = `
System Role: Senior Video Scriptwriter for Book Reviews.
Task: Create a comprehensive video script for the book "${bookName}".

${outlineContent ? `Based on the following outline:\n${outlineContent}\n` : ''}

Requirements:
1. **Structure**:
   - Create at least 4 distinct themes/chapters for the top navigation bar.
   - Generate 30-36 scenes in total.
   - Total duration should be 5-8 minutes.

2. **Narrative Logic & Flow (CRITICAL)**:
   - **Coherence**: The narration must flow smoothly from one scene to the next. Use transitional phrases (e.g., "However", "Because of this", "Next", "Imagine that"). Avoid abrupt jumps.
   - **Story Arc**:
     - **Intro**: Hook the audience -> **Briefly introduce the author and their background** -> State the book's core value.
     - **Body**: Explain concepts step-by-step.
     - **Conclusion**: Summarize key points -> **Quote 1-2 famous lines/Golden Sentences from the book** -> Call to action.

3. **Scene Details**:
   - **id**: Unique identifier (e.g., "intro", "ch1-1", "ch1-2").
   - **title**: Concise scene title (2-6 Chinese characters).
   - **theme**: The specific theme this scene belongs to.
   - **narration**: 
     - First-person perspective ("I", "We").
     - Conversational, engaging, storytelling style.
     - 150-300 characters per scene (approx 8-12 seconds spoken).
     - **MUST connect logically to the previous scene.**
   - **durationSeconds**: Estimated duration (8-15 seconds).
   - **icon**: A relevant Lucide icon name.
   - **color**: Hex color code.

Output JSON Format (Strictly comply):
{
  "bookTitle": "Full Book Name",
  "bookAuthor": "Author Name",
  "themes": ["Theme 1", "Theme 2", "Theme 3", "Theme 4"],
  "scenes": [
    {
      "id": "scene-id",
      "title": "Scene Title",
      "theme": "Theme 1",
      "narration": "Narration text here...",
      "durationSeconds": 10,
      "icon": "IconName",
      "color": "#3b82f6"
    }
  ]
}
`;

  try {
    const data = await generateContent(prompt);
    
    // Post-processing
    const processedScenes = data.scenes.map(scene => ({
      ...scene,
      durationInFrames: Math.round(scene.durationSeconds * FPS),
      // Ensure icon is a string (remove any imports if LLM hallucinated them)
      icon: scene.icon.replace(/<|>/g, '').trim() 
    }));

    const totalDuration = processedScenes.reduce((acc, s) => acc + s.durationInFrames, 0);

    const finalData = {
      bookTitle: data.bookTitle,
      bookAuthor: data.bookAuthor,
      outline: outlineContent || undefined,
      totalDuration,
      themes: data.themes,
      scenes: processedScenes
    };

    const outputPath = join(root, 'src/data/bookScript.ts');
    const fileContent = `import { BookScript } from '../types/book';

export const bookScript: BookScript = ${JSON.stringify(finalData, null, 2)};
`;

    writeFileSync(outputPath, fileContent, 'utf-8');
    console.log(`Success! Script written to ${outputPath}`);
    console.log(`Total Scenes: ${finalData.scenes.length}`);
    console.log(`Total Duration: ${(totalDuration / FPS / 60).toFixed(1)} minutes`);
    console.log(`Themes: ${finalData.themes.join(', ')}`);

  } catch (error) {
    console.error('Error generating script:', error);
    process.exit(1);
  }
}

main();
