# AI Book Video Generator 📚🎬

An automated workflow to turn any book into a high-quality summary video using AI.
Powered by **Gemini 1.5 Pro/Flash** (Script & Image Generation) + **Edge-TTS** (Voiceover) + **Remotion** (Video Rendering).

## 🚀 Quick Start

### 1. Setup
```bash
# Install dependencies
npm install

# Configure Environment Variables
# Create a .env file with your API key:
echo "GEMINI_API_KEY=your_api_key_here" > .env
```

### 2. Generate a New Video (One-Command Magic)
To create a complete video for a book (e.g., "Elon Musk"):
```bash
npm run create-book-video -- "Elon Musk"
```

**💡 Pro Tip: Use an Outline for Better Results**
If you want the video to focus on specific chapters or key concepts (e.g., only "First Principles" from Elon Musk), provide an outline text file:

1. Create a text file (e.g., `outline.txt`) with your key points/summary.
2. Run the command with the file path:
```bash
npm run create-book-video -- "Elon Musk" "outline.txt"
```
*The script will use your outline as the core source material instead of relying solely on the AI's general knowledge.*

**This process includes:**
1.  **Scriptwriting**: Generates 30+ scenes with structured narrative (based on your outline if provided).
2.  **Voiceover**: Generates audio for each scene using Edge-TTS.
3.  **Illustration**: Creates consistent style images for each scene using Gemini Imagen.
4.  **Rendering**: Compiles everything into an MP4 video.

### 3. Finalize & Package
After the video is rendered, generate the upload assets (Cover, Captions, Metadata):
```bash
npm run prepare-upload
```
**Output Location:** `output/upload-package/`
- `video.mp4`: The main video file.
- `thumbnail.png`: High-quality cover image (Classic style, same as `ClassicCover` composition).
- `captions.srt`: Subtitles for YouTube.
- `metadata.txt`: Title, Description, and Timestamps (Chapters).

---

## 🎨 Design Style & Configuration

The project uses a unified **Cyber Style** for all generated videos. You can customize the global aesthetic and audio behavior in a single file.

### Central Configuration (`src/config.ts`)
Modify this file to update the style for all future books:
- **Visuals**: Title font size (default 70px), neon glow effects, and gradient backgrounds.
- **Audio**: Global voiceover speed (default **1.25x**).
- **Layout**: Image margins and subtitle positioning.

### Cyber Style Aesthetic
- **Title**: Large, italicized gold text with neon amber glow.
- **Background**: Deep navy-to-black gradients with glowing borders.
- **Subtitles**: Auto-aligned, phrases-based line breaks for better readability.

---

## 📂 Project Structure
- `src/data/bookScript.ts`: The **Single Source of Truth** for the current video project.
- `public/images/`: Generated images for the current project.
- `output/`: Where final video and assets are saved.
- `scripts/`: Node.js automation scripts (script generation, TTS, image gen, etc.).

## ⚠️ Important Notes
- **Data Overwrite**: Running `create-book-video` **WILL OVERWRITE** the current project in `src/data/` and `public/images/`.
- **Backup**: If you want to save the current project, manually back up `src/data/bookScript.ts` and `public/images/` before starting a new one.
- **Network**: Requires access to Google Gemini API (ensure VPN/Proxy is active if needed).

## 🛠 Advanced Usage

### Manual Step-by-Step
If the automated process fails, you can run steps individually:

1.  **Generate Script**:
    ```bash
    node scripts/generate-book-script.mjs "Book Name"
    ```
2.  **Generate Audio**:
    ```bash
    node scripts/generate-audio.mjs
    ```
3.  **Sync Durations**:
    ```bash
    node scripts/sync-durations.mjs
    ```
4.  **Generate Images**:
    ```bash
    node scripts/generate-images.mjs
    ```
5.  **Render Video**:
    ```bash
    npm run render
    ```

### AI Book Cover Generation (Default)
**Book covers are now automatically generated using AI based on the book title.**

The video creation workflow now uses AI to generate professional, publication-ready book covers instead of downloading from external sources. This ensures:

- 🎨 **Consistent Quality**: High-quality, publication-ready covers
- 🎯 **Thematic Design**: AI analyzes the book title and creates relevant visual elements
- 📱 **Mobile Optimized**: 3:4 aspect ratio perfect for Xiaohongshu
- 🔤 **Multilingual**: Supports Chinese and English typography
- 🤖 **Automated**: No manual cover selection needed

#### Manual Cover Generation
If you need to generate covers manually:

```bash
# Generate AI cover for any book
npm run generate-cover-by-title "思考，快与慢"

# Or use the script directly
node scripts/generate-cover-by-title.mjs "Book Title"
```

This creates a cover image in the `output/` directory with filename `{book_title}_ai_cover.png`.

### Cropping the book cover
If you use your own cover image (e.g. `public/book_cover.png`) and it has background or margins, crop it to keep only the book before generating the video and thumbnail:

```bash
npm run crop-book-cover
```

This reads `public/book_cover.png` or `public/book_cover.jpg`, removes uniform-color edges (**trim**), and overwrites `public/book_cover.png`. For non-uniform backgrounds use center crop: `node scripts/crop-book-cover.mjs --center` or `--center=0.9` (crop to 90% of width/height from center). Then run `npm run render` and `npm run prepare-upload` as usual.

### Customizing Styles
- **Visuals**: Modify `src/components/BookScene.tsx` for scene layout.
- **Cover**: Modify `src/ClassicCover.tsx` to change cover style.
- **Prompt**: Edit `scripts/generate-book-script.mjs` to change the scriptwriting style.
