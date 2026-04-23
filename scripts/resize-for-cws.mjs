/**
 * Ajusta una captura al tamaño exacto que pide Chrome Web Store (1280×800 o
 * 640×400) sin distorsionar: escala la imagen para que entre, y rellena con
 * un color sólido de fondo (blanco por defecto) el resto del lienzo.
 *
 * Uso:
 *   node scripts/resize-for-cws.mjs <input> <output> [size=1280x800] [bgHex=ffffff]
 */
import sharp from 'sharp';
import { argv, exit } from 'process';

const [, , input, output, size = '1280x800', bgHex = 'ffffff'] = argv;

if (!input || !output) {
  console.error(
    'Uso: node scripts/resize-for-cws.mjs <input> <output> [size=1280x800] [bgHex=ffffff]'
  );
  exit(1);
}

const [W, H] = size.split('x').map(Number);
if (!W || !H) {
  console.error(`Tamaño inválido: "${size}". Formato esperado: AxB, p.ej. 1280x800`);
  exit(1);
}

const hex = bgHex.replace(/^#/, '');
const r = parseInt(hex.slice(0, 2), 16);
const g = parseInt(hex.slice(2, 4), 16);
const b = parseInt(hex.slice(4, 6), 16);

await sharp(input)
  .resize(W, H, {
    fit: 'contain',
    background: { r, g, b, alpha: 1 },
  })
  .flatten({ background: { r, g, b } }) // CWS requiere PNG 24-bit sin alfa
  .png()
  .toFile(output);

const m = await sharp(output).metadata();
console.log(`OK — ${output} (${m.width}×${m.height})`);
