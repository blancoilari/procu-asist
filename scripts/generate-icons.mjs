/**
 * Generate extension icon PNGs from SVG.
 * Run: node scripts/generate-icons.mjs
 */
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = join(__dirname, '..', 'public', 'icon', 'logo.svg');
const outDir = join(__dirname, '..', 'public', 'icon');

const sizes = [16, 32, 48, 96, 128];

const svgBuffer = readFileSync(svgPath);

for (const size of sizes) {
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(join(outDir, `${size}.png`));
  console.log(`Generated ${size}.png`);
}

console.log('All icons generated!');
