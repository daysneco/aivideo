import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';

// Models
const MODEL_PRO = 'gemini-3-pro-preview';
const MODEL_FLASH = 'gemini-3-flash-preview';

/**
 * Initialize Gemini Client
 */
function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Please set GEMINI_API_KEY environment variable');
  }
  return new GoogleGenAI({ apiKey });
}

/**
 * Generate content with automatic fallback (Pro -> Flash)
 * @param {string} prompt 
 * @param {object} schema Optional JSON schema
 * @returns {Promise<any>} Parsed JSON response
 */
export async function generateContent(prompt, schema = null) {
  const ai = getClient();
  
  // Try Pro model first
  try {
    console.log(`Using model: ${MODEL_PRO}...`);
    return await generateWithModel(ai, MODEL_PRO, prompt, schema);
  } catch (error) {
    console.warn(`Model ${MODEL_PRO} failed:`, error.message);
    console.log(`Falling back to ${MODEL_FLASH}...`);
    
    // Fallback to Flash model
    try {
      return await generateWithModel(ai, MODEL_FLASH, prompt, schema);
    } catch (fallbackError) {
      throw new Error(`All models failed. Last error: ${fallbackError.message}`);
    }
  }
}

/**
 * Internal function to call a specific model
 */
async function generateWithModel(ai, modelName, prompt, schema) {
  const config = {
    responseMimeType: 'application/json',
    temperature: 0.7,
  };

  if (schema) {
    config.responseSchema = schema;
  }

  const result = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: config
  });

  // Debug: Log the result structure if needed
  // console.log('Raw result:', JSON.stringify(result, null, 2));

  // Handle different SDK response structures
  let responseText;
  if (result.response && typeof result.response.text === 'function') {
    responseText = result.response.text();
  } else if (typeof result.text === 'function') {
    responseText = result.text();
  } else if (result.candidates && result.candidates[0] && result.candidates[0].content && result.candidates[0].content.parts[0].text) {
     responseText = result.candidates[0].content.parts[0].text;
  } else {
    console.error('Unexpected result structure:', JSON.stringify(result, null, 2));
    throw new Error('Unexpected response structure from Gemini SDK');
  }
  
  try {
    return JSON.parse(responseText);
  } catch (e) {
    console.error('Failed to parse JSON response:', responseText);
    throw new Error('Invalid JSON response from LLM');
  }
}
