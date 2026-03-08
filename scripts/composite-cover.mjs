import sharp from 'sharp';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

export async function compositeCover(bookCoverPath, bgPath, outputPath) {
  console.log('🖼️  Compositing 3D book cover...');

  // 1. Load background and cover
  const bg = sharp(bgPath);
  const cover = sharp(bookCoverPath);

  // 2. Prepare cover with shadow/3D effect
  // Resize cover to a fixed width of 850px
  const processedCover = await cover
    .resize(850)
    .rotate(-5, { background: '#00000000' }) // Slight tilt
    .toBuffer();

  // Create a shadow
  const shadow = await sharp(processedCover)
    .ensureAlpha()
    .composite([{ input: Buffer.from('<svg><rect width="100%" height="100%" fill="black"/></svg>'), blend: 'dest-in' }]) // basic shadow mask
    .blur(10)
    .toBuffer();

  // 3. Composite
  await bg
    .resize(1080, 1920) // Ensure BG is 9:16
    .composite([
      { input: shadow, gravity: 'center', top: 50, left: 50 }, // Offset shadow
      { input: processedCover, gravity: 'center' }
    ])
    .toFile(outputPath);

  console.log(`✅ Final cover saved to ${outputPath}`);
}
