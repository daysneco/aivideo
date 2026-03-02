import os
import sys
import uvicorn
import random
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import torch
import soundfile as sf
import io
from qwen_tts import Qwen3TTSModel

# Add the qwen-tts directory to sys.path just in case, though installing it in venv should be enough
sys.path.append("/Users/tongjingshi/Documents/AIOS/qwen-tts/qwen3-tts")

app = FastAPI()

# Global model variable
model = None

def set_seed(seed=42):
    print(f"Setting global seed to {seed}")
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
        torch.backends.cudnn.deterministic = True
        torch.backends.cudnn.benchmark = False

class TTSRequest(BaseModel):
    text: str
    voice: str = "Serena" # Default voice
    prompt: str = "用正常的语气说，不要有任何语气词"
    seed: int = 42 # Added fixed seed for consistency

@app.on_event("startup")
async def startup_event():
    global model
    print("Initializing Qwen3-TTS model...")
    model_dir = "/Users/tongjingshi/Documents/AIOS/qwen-tts/qwen3-tts/Qwen3-TTS-12Hz-1.7B-CustomVoice"
    
    if not os.path.exists(model_dir):
        print(f"Error: Model directory not found at {model_dir}")
        sys.exit(1)
        
    try:
        model = Qwen3TTSModel.from_pretrained(
            model_dir,
            device_map="auto",
            dtype=torch.bfloat16,
        )
        print("Model loaded successfully!")
    except Exception as e:
        print(f"Failed to load model: {e}")
        sys.exit(1)

@app.post("/tts")
async def generate_tts(request: TTSRequest):
    global model
    if not model:
        raise HTTPException(status_code=500, detail="Model not initialized")
    
    # Critical: Set seed before every generation to ensure consistency
    set_seed(request.seed)
    
    print(f"Generating TTS for: {request.text[:20]}... (Seed: {request.seed}, Voice: {request.voice})")
    try:
        # The model returns (wavs, sample_rate)
        # wavs is a list of numpy arrays (one per batch item)
        wavs, sr = model.generate_custom_voice(
            text=request.text,
            language="Chinese",
            speaker=request.voice,
            instruct=request.prompt
        )
        
        # Convert numpy array to wav bytes
        buffer = io.BytesIO()
        sf.write(buffer, wavs[0], sr, format='WAV')
        buffer.seek(0)
        
        return {
            "audio_base64": buffer.read().hex() # Returning hex string of bytes for simplicity in JSON
        }
    except Exception as e:
        print(f"Error generating TTS: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    # Run on port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
