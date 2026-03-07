import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';

async function test() {
  const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  try {
    const result = await model.generateContent('Hi');
    console.log(result.response.text());
  } catch (e) {
    console.error(e);
  }
}
test();
