#!/usr/bin/env node
import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('Please set GEMINI_API_KEY environment variable');
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    console.log('Fetching available models...');
    const models = await ai.models.list();
    console.log('\nAvailable models:');
    console.log('Response structure:', typeof models, Array.isArray(models) ? 'array' : 'object');
    if (Array.isArray(models)) {
      models.forEach(model => {
        console.log(`- ${model.name}: ${model.description || 'No description'}`);
      });
    } else {
      console.log('Full response:', JSON.stringify(models, null, 2));
    }
  } catch (error) {
    console.error('Error listing models:', error.message);
  }
}

listModels();