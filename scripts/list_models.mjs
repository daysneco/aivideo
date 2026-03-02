import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function listModels() {
  try {
    const response = await ai.models.list();
    console.log('Response structure:', JSON.stringify(response, null, 2));
  } catch (error) {
    console.error('Error listing models:', error);
  }
}

listModels();