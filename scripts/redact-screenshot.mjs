/**
 * Redacta (tacha con negro) rectángulos de una imagen.
 *
 * Uso:
 *   node scripts/redact-screenshot.mjs <input> <output> <x,y,w,h> [otro rect...]
 *
 * Coordenadas por rectángulo (x, y, w, h):
 *   - Píxeles absolutos:    120,340,220,22
 *   - Porcentaje (0-100):   45%,33%,40%,7%
 *   - Se pueden mezclar:    45%,340,40%,22
 *
 * Ejemplo — tachar la descripción de una fila (porcentaje):
 *   node scripts/redact-screenshot.mjs cap.png cap-limpia.png 34%,33%,52%,7%
 */
import sharp from 'sharp';
import { argv, exit } from 'process';

const [, , input, output, ...rects] = argv;

if (!input || !output || rects.length === 0) {
  console.error(
    'Uso: node scripts/redact-screenshot.mjs <input> <output> <x,y,w,h> [x,y,w,h ...]\n' +
      '  Coords en píxeles: 120,340,220,22\n' +
      '  O en porcentaje:    45%,33%,40%,7%'
  );
  exit(1);
}

const metadata = await sharp(input).metadata();
const W = metadata.width ?? 0;
const H = metadata.height ?? 0;

function parseCoord(value, axis) {
  const v = value.trim();
  if (v.endsWith('%')) {
    const pct = parseFloat(v.slice(0, -1));
    const dim = axis === 'x' || axis === 'w' ? W : H;
    return Math.round((pct / 100) * dim);
  }
  return parseInt(v, 10);
}

const overlays = rects.map((r, i) => {
  const parts = r.split(',').map((v) => v.trim());
  if (parts.length !== 4) {
    console.error(`Rect #${i + 1} inválido: "${r}" — se esperan 4 valores separados por coma`);
    exit(1);
  }
  const x = parseCoord(parts[0], 'x');
  const y = parseCoord(parts[1], 'y');
  const w = Math.max(1, parseCoord(parts[2], 'w'));
  const h = Math.max(1, parseCoord(parts[3], 'h'));

  // Clamp a los bordes
  const clampedX = Math.max(0, Math.min(x, W - 1));
  const clampedY = Math.max(0, Math.min(y, H - 1));
  const clampedW = Math.max(1, Math.min(w, W - clampedX));
  const clampedH = Math.max(1, Math.min(h, H - clampedY));

  return {
    input: {
      create: {
        width: clampedW,
        height: clampedH,
        channels: 3,
        background: { r: 15, g: 15, b: 15 },
      },
    },
    top: clampedY,
    left: clampedX,
  };
});

try {
  await sharp(input).composite(overlays).toFile(output);
  console.log(`OK — ${output} (${W}x${H}, ${overlays.length} rect${overlays.length > 1 ? 's' : ''})`);
} catch (err) {
  console.error('Error:', err.message);
  exit(1);
}
