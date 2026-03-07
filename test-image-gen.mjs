import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';
import { writeFileSync } from 'fs';

async function testImage() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const modelName = 'gemini-2.0-flash'; // Let's try this one
  console.log(`Testing image generation with ${modelName}...`);
  try {
    const result = await ai.models.generateContent({
      model: modelName,
      contents: 'Generate a cinematic landscape image of a forest in 9:16 aspect ratio.',
      config: {
        // Some models might not support imageConfig here or might require it in a different way
        // But the project code uses it like this.
      }
    });
    
    console.log('Result parts:', result.candidates[0].content.parts.length);
    for (const part of result.candidates[0].content.parts) {
      if (part.inlineData) {
        console.log('Found inlineData!');
        const buffer = Buffer.from(part.inlineData.data, 'base64');
        writeFileSync('test-image.png', buffer);
        console.log('Saved test-image.png');
        return;
      }
    }
    console.log('No inlineData found in response parts.');
    console.log('Response text:', result.candidates[0].content.parts[0].text);
  } catch (e) {
    console.error('Error:', e.message);
  }
}
testImage();
