import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';

async function test() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    const result = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: 'Hi'
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error(e);
  }
}
test();
