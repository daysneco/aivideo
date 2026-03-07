import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';

async function listModels() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    // There might not be a direct listModels in this SDK version or it's different
    // Let's try to see if it's there
    console.log('SDK Keys:', Object.keys(ai));
    if (ai.models && ai.models.list) {
       const models = await ai.models.list();
       console.log(JSON.stringify(models, null, 2));
    } else {
       console.log('ai.models.list not found');
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}
listModels();
