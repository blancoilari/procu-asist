/**
 * Tapa los datos identificables de las capturas del manual de usuario
 * (docs/tutorial) con rectangulos opacos, y verifica el resultado con OCR.
 *
 * Por que un rectangulo opaco y no un desenfoque: un desenfoque de baja
 * intensidad se revierte. El pixel tapado se pierde y no vuelve.
 *
 * Uso:
 *   node scripts/tapar-capturas-tutorial.mjs tapar      # aplica el manifiesto
 *   node scripts/tapar-capturas-tutorial.mjs verificar  # OCR + patrones
 *   node scripts/tapar-capturas-tutorial.mjs tapar --dry-run
 *
 * Como se agrega una captura nueva:
 *   1. Mirar la imagen entera, no solo el OCR. El OCR se saltea texto chico,
 *      texto sobre fondo de color y todo lo que este rotado o comprimido.
 *   2. Sacar las coordenadas del texto a tapar. Ayuda:
 *        tesseract captura.png stdout -l spa tsv
 *      (las coordenadas del TSV son de la imagen tal cual, sin escalar).
 *   3. Agregar la entrada al MANIFIESTO de abajo, con el motivo.
 *   4. Correr `tapar` y despues `verificar`, y volver a MIRAR la imagen para
 *      confirmar que no se tapo el boton que la captura viene a explicar.
 *
 * Las coordenadas son x,y,w,h en pixeles de la imagen original.
 */
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { argv, exit } from 'node:process';

const RAIZ = path.resolve(import.meta.dirname, '..');
const DIR_TUTORIAL = path.join(RAIZ, 'docs', 'tutorial');

/** Gris oscuro pleno. Opaco, no reversible, y menos agresivo que el negro
 *  puro sobre las barras grises de MEV. */
const TAPA = { r: 68, g: 68, b: 68 };

/**
 * Un rectangulo por dato identificable. El motivo queda escrito al lado
 * porque dentro de un ano nadie se acuerda de por que hay un bloque ahi.
 */
const MANIFIESTO = [
  {
    archivo: '07-guardar-causa.png',
    tamano: [1345, 950],
    rects: [
      { x: 450, y: 210, w: 772, h: 24, motivo: 'juzgado y departamento judicial de la causa (barra superior de MEV)' },
      { x: 458, y: 350, w: 112, h: 26, motivo: 'N de Receptoria' },
      { x: 778, y: 350, w: 112, h: 26, motivo: 'N de Expediente' },
    ],
  },
  {
    archivo: '11-modal-zip-pjn.png',
    tamano: [925, 805],
    rects: [
      { x: 383, y: 422, w: 98, h: 18, motivo: 'numero de cedula electronica (fila 31/03)' },
      { x: 383, y: 710, w: 98, h: 18, motivo: 'numero de cedula electronica (fila 09/03)' },
      { x: 318, y: 522, w: 332, h: 20, motivo: 'juzgado y secretaria de la causa mostrada (fila RECEPCION PASE 26/03)' },
      { x: 318, y: 552, w: 332, h: 20, motivo: 'juzgado y secretaria de la causa mostrada (fila PASE 19/03)' },
      { x: 318, y: 612, w: 410, h: 20, motivo: 'camara y oficina de origen de la causa mostrada (fila RECEPCION PASE 19/03)' },
      { x: 318, y: 642, w: 410, h: 20, motivo: 'camara y oficina de origen de la causa mostrada (fila PASE 17/03)' },
    ],
  },
];

/**
 * Patrones que no pueden quedar legibles en ninguna captura del manual.
 * Se corren sobre el texto que devuelve el OCR.
 */
const PATRONES = [
  { nombre: 'expediente MEV (XX - 99999 - 9999)', re: /\b[A-Z]{2}\s*-\s*\d{3,6}\s*-\s*\d{4}\b/g },
  { nombre: 'expediente PJN (ABC 999999/9999)', re: /\b[A-Z]{2,4}\s*\d{4,6}\s*\/\s*\d{4}\b/g },
  { nombre: 'numero de cedula electronica', re: /C[EÉ]DULA\s*N[°ºo]?\s*\d{6,}/gi },
  { nombre: 'CUIJ', re: /\bCUIJ\b[^\n]{0,40}/gi },
  { nombre: 'CUIT / CUIL', re: /\b\d{2}-\d{7,8}-\d\b/g },
  { nombre: 'numero largo suelto (posible identificador)', re: /\b\d{6,}\b/g },
  { nombre: 'etiqueta de receptoria con valor', re: /Receptor[ií]a\s*:?\s*[A-Z0-9]/gi },
];

/**
 * Escotilla para textos que coinciden con un patron y que igual pueden quedar:
 * numeros de norma citados por el portal, numeros de version, etc. Hoy esta
 * vacia a proposito. Ojo al agregar: se compara contra la coincidencia
 * completa del patron, no contra una subcadena, asi que un numero de ley de
 * cinco digitos ("LEY 25344") no necesita entrada porque ningun patron lo
 * atrapa. Una entrada que no puede coincidir con ningun patron es ruido y
 * hace creer que hay una excepcion viva donde no la hay.
 */
const PERMITIDOS = [];

/**
 * OCR de una imagen. Se duplica la escala antes de pasarla a tesseract: a
 * tamano original se le escapan los numeros chicos (con las capturas de este
 * repositorio se le escapaban los numeros de cedula electronica de
 * 11-modal-zip-pjn.png, que estan a la vista para cualquiera que mire).
 */
async function tesseract(archivo) {
  const candidatos = [
    process.env.TESSERACT_EXE,
    'C:/Program Files/Tesseract-OCR/tesseract.exe',
    'C:/Program Files (x86)/Tesseract-OCR/tesseract.exe',
  ].filter(Boolean);
  const bin = candidatos.find((c) => existsSync(c)) || 'tesseract';
  const meta = await sharp(archivo).metadata();
  const tmp = path.join(tmpdir(), `procuasist-ocr-${path.basename(archivo)}`);
  await sharp(archivo)
    .resize(meta.width * 2, meta.height * 2, { kernel: 'lanczos3' })
    .png()
    .toFile(tmp);
  try {
    return execFileSync(bin, [tmp, 'stdout', '-l', 'spa'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } finally {
    rmSync(tmp, { force: true });
  }
}

async function tapar(dryRun) {
  let total = 0;
  for (const entrada of MANIFIESTO) {
    const ruta = path.join(DIR_TUTORIAL, entrada.archivo);
    if (!existsSync(ruta)) {
      console.error(`FALTA ${entrada.archivo}`);
      exit(1);
    }
    const meta = await sharp(ruta).metadata();
    const [w, h] = entrada.tamano;
    if (meta.width !== w || meta.height !== h) {
      console.error(
        `${entrada.archivo}: mide ${meta.width}x${meta.height} y el manifiesto dice ${w}x${h}. ` +
          'Las coordenadas no sirven: revisar la captura a mano antes de seguir.'
      );
      exit(1);
    }
    const overlays = entrada.rects.map((r) => ({
      input: { create: { width: r.w, height: r.h, channels: 3, background: TAPA } },
      left: r.x,
      top: r.y,
    }));
    console.log(`${entrada.archivo} (${w}x${h})`);
    for (const r of entrada.rects) {
      console.log(`  ${r.x},${r.y},${r.w},${r.h}  ${r.motivo}`);
    }
    total += entrada.rects.length;
    if (dryRun) continue;
    const buf = await sharp(ruta).composite(overlays).png().toBuffer();
    await sharp(buf).toFile(ruta);
  }
  console.log(dryRun ? `\n(dry-run) ${total} rectangulos` : `\nOK: ${total} rectangulos aplicados`);
}

async function verificar() {
  const archivos = readdirSync(DIR_TUTORIAL)
    .filter((f) => f.toLowerCase().endsWith('.png'))
    .sort();
  let hallazgos = 0;
  for (const f of archivos) {
    const texto = await tesseract(path.join(DIR_TUTORIAL, f));
    const encontrados = [];
    for (const p of PATRONES) {
      for (const m of texto.matchAll(p.re)) {
        const valor = m[0].trim();
        if (PERMITIDOS.some((ok) => ok.test(valor))) continue;
        encontrados.push(`${p.nombre}: "${valor}"`);
      }
    }
    if (encontrados.length) {
      hallazgos += encontrados.length;
      console.log(`FALLA ${f}`);
      for (const e of [...new Set(encontrados)]) console.log(`   ${e}`);
    } else {
      console.log(`ok    ${f}`);
    }
  }
  console.log(
    hallazgos
      ? `\n${hallazgos} coincidencia(s). Revisar a mano: el OCR marca de mas y de menos.`
      : '\nSin coincidencias de patrones. El OCR no prueba que no quede nada: mirar las imagenes.'
  );
  return hallazgos;
}

const comando = argv[2];
if (comando === 'tapar') {
  await tapar(argv.includes('--dry-run'));
} else if (comando === 'verificar') {
  // Sale con codigo 1 si encontro algo: si no, un hook o una tarea que llame a
  // este comando ve verde con las coincidencias impresas en pantalla.
  const hallazgos = await verificar();
  if (hallazgos) exit(1);
} else {
  console.error(
    'Uso: node scripts/tapar-capturas-tutorial.mjs <tapar|verificar> [--dry-run]'
  );
  exit(1);
}
