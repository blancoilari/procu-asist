/**
 * M6b.3 — Generador de ZIP para expedientes PJN.
 *
 * Orquesta (en el service worker):
 *   1. PDF resumen con datos generales + lista de actuaciones incluidas.
 *   2. Descarga individual de cada PDF seleccionado vía `downloadPjnPdf`
 *      (M5), que delega en la pestaña scw para heredar cookies.
 *   3. Empaquetado con JSZip.
 *
 * La estructura del ZIP sigue el patrón establecido por MEV:
 *   {claveExpediente}_expte_completo/
 *     ├── resumen.pdf
 *     ├── 001_2026-04-16_MANDAMIENTO_OBSERVADO.pdf
 *     ├── 001_2026-04-16_MANDAMIENTO_OBSERVADO_adjunto_1.pdf
 *     ├── ...
 *     └── _verificacion.txt (solo si hubo errores)
 *
 * Ordenado oldest-first para que el índice 001 sea la primera actuación
 * cronológica incluida en la selección.
 */

import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import { downloadPjnPdf } from '@/modules/portals/pjn-downloader';
import type {
  PjnActuacion,
  PjnDatosGenerales,
} from '@/modules/portals/pjn-parser';

export interface PjnZipInput {
  datosGenerales: PjnDatosGenerales | null;
  actuaciones: PjnActuacion[];
  /** URL del portal donde se originó la descarga (para el resumen). */
  portalUrl: string;
  /** tabId de scw para heredar cookies en los fetch de viewer.seam. */
  scwTabId: number;
}

export interface PjnZipFailedItem {
  index: number;
  fecha: string;
  tipo: string;
  descripcion: string;
  docIndex: number;
  href: string;
  error: string;
}

export interface PjnZipResult {
  success: boolean;
  error?: string;
  blob?: Blob;
  filename?: string;
  stats?: {
    totalActuaciones: number;
    actuacionesConDoc: number;
    docsDescargados: number;
    docsFallidos: number;
    allSuccessful: boolean;
    failedItems: PjnZipFailedItem[];
  };
}

export type PjnZipProgress = (stage: string, current: number, total: number) => void;

// ────────────────────────────────────────────────────────
// Entry point
// ────────────────────────────────────────────────────────

export async function generatePjnCaseZip(
  input: PjnZipInput,
  onProgress?: PjnZipProgress
): Promise<PjnZipResult> {
  const { datosGenerales, actuaciones, portalUrl, scwTabId } = input;

  if (actuaciones.length === 0) {
    return { success: false, error: 'No hay actuaciones seleccionadas.' };
  }

  const zip = new JSZip();
  const claveExpediente =
    datosGenerales?.expediente || inferClaveFromActuaciones(actuaciones) || 'expediente_pjn';
  const safeKey = sanitizeFilename(claveExpediente).replace(/\s+/g, '_');
  const folder = zip.folder(`${safeKey}_expte_completo`);
  if (!folder) {
    return { success: false, error: 'No se pudo crear la carpeta del ZIP.' };
  }

  // ── Ordenar cronológicamente (oldest first) ──────────────
  const ordered = [...actuaciones].sort((a, b) => {
    const da = parseIsoDate(a.fecha);
    const db = parseIsoDate(b.fecha);
    if (da && db) return da.localeCompare(db);
    return 0;
  });

  // ── 1. Resumen PDF ───────────────────────────────────────
  onProgress?.('Generando resumen…', 0, ordered.length + 1);
  try {
    const resumenBlob = generateResumenPdf({
      datosGenerales,
      actuaciones: ordered,
      portalUrl,
    });
    folder.file('resumen.pdf', resumenBlob);
  } catch (err) {
    return {
      success: false,
      error: `Error generando resumen PDF: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // ── 2. Descargar cada PDF (en serie, con delay entre request) ─
  const failedItems: PjnZipFailedItem[] = [];
  let docsDescargados = 0;
  let docsFallidos = 0;
  let actuacionesConDoc = 0;
  const usedFilenames = new Set<string>();

  for (let i = 0; i < ordered.length; i++) {
    const a = ordered[i];
    const idx = i + 1; // contador interno para progress/failedItems, no para filenames
    const baseFilename = buildActuacionFilename(a);

    if (!a.hasDocument || a.documentos.length === 0) {
      continue; // actuaciones "informativas" sin descargables no se incluyen individualmente
    }
    actuacionesConDoc++;

    onProgress?.(
      `Descargando ${idx} de ${ordered.length}…`,
      idx,
      ordered.length + 1
    );

    // Una actuación puede tener 1+ documentos (ej: despacho + notificación).
    // Descargar el "download" primero (si existe); si solo hay "view", usarlo.
    const docs = pickDocumentsForDownload(a);
    for (let d = 0; d < docs.length; d++) {
      const doc = docs[d];
      const suffix = docs.length > 1 ? `_doc${d + 1}` : '';
      const suggested = uniqueFilename(
        `${baseFilename}${suffix}.pdf`,
        usedFilenames
      );

      const result = await downloadPjnPdf(scwTabId, doc.href, suggested);
      if (result.success) {
        folder.file(suggested, result.base64, { base64: true });
        docsDescargados++;
      } else {
        docsFallidos++;
        failedItems.push({
          index: idx,
          fecha: a.fecha,
          tipo: a.tipo,
          descripcion: a.descripcion,
          docIndex: d + 1,
          href: doc.href,
          error: result.error,
        });
        folder.file(
          uniqueFilename(`${baseFilename}${suffix}_ERROR.txt`, usedFilenames),
          `No se pudo descargar este documento.\nURL: ${doc.href}\nError: ${result.error}\n`
        );
      }
      // Pequeño delay entre descargas para no saturar.
      await sleep(200);
    }
  }

  // ── 3. Informe de verificación si hubo errores ───────────
  const allSuccessful = failedItems.length === 0;
  if (!allSuccessful) {
    const lines = [
      `VERIFICACIÓN DE DESCARGA — ${claveExpediente}`,
      `Generado: ${new Date().toLocaleString('es-AR')}`,
      '='.repeat(60),
      '',
      `Actuaciones seleccionadas: ${ordered.length}`,
      `Actuaciones con documento: ${actuacionesConDoc}`,
      `Documentos descargados OK: ${docsDescargados}`,
      `Documentos fallidos: ${docsFallidos}`,
      '',
      'DETALLE DE ERRORES:',
      '-'.repeat(60),
      '',
    ];
    for (const item of failedItems) {
      lines.push(
        `[${item.index}] ${item.fecha} — ${item.tipo} — ${item.descripcion} (doc ${item.docIndex})`
      );
      lines.push(`  URL: ${item.href}`);
      lines.push(`  Error: ${item.error}`);
      lines.push('');
    }
    folder.file('_verificacion.txt', lines.join('\n'));
  }

  // ── 4. Generar ZIP ────────────────────────────────────────
  onProgress?.('Comprimiendo…', ordered.length, ordered.length + 1);
  let blob: Blob;
  try {
    blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
  } catch (err) {
    return {
      success: false,
      error: `Error generando ZIP: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  onProgress?.('Listo', ordered.length + 1, ordered.length + 1);

  return {
    success: true,
    blob,
    filename: `${safeKey}_expte_completo.zip`,
    stats: {
      totalActuaciones: ordered.length,
      actuacionesConDoc,
      docsDescargados,
      docsFallidos,
      allSuccessful,
      failedItems,
    },
  };
}

// ────────────────────────────────────────────────────────
// PDF resumen
// ────────────────────────────────────────────────────────

interface ResumenInput {
  datosGenerales: PjnDatosGenerales | null;
  actuaciones: PjnActuacion[];
  portalUrl: string;
}

function generateResumenPdf(input: ResumenInput): Blob {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const ML = 15;
  const MR = 15;
  const CW = 210 - ML - MR;
  const PH = 297;
  const MB = 20;
  const primary: [number, number, number] = [42, 93, 159]; // azul ProcuAsist
  const dark: [number, number, number] = [30, 30, 30];
  const gray: [number, number, number] = [100, 100, 100];
  const white: [number, number, number] = [255, 255, 255];
  const headerBg: [number, number, number] = [238, 244, 252];

  const ensureSpace = (needed: number, currentY: number): number => {
    if (currentY + needed > PH - MB) {
      doc.addPage();
      return 20;
    }
    return currentY;
  };

  // ── Header bar ──
  doc.setFillColor(...primary);
  doc.rect(0, 0, 210, 12, 'F');
  doc.setTextColor(...white);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('ProcuAsist — Resumen de expediente PJN', ML, 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    new Date().toLocaleDateString('es-AR'),
    210 - MR,
    8,
    { align: 'right' }
  );

  let y = 20;

  // ── Datos generales ──
  const dg = input.datosGenerales;
  if (dg) {
    doc.setFillColor(...headerBg);
    doc.roundedRect(ML, y, CW, 40, 2, 2, 'F');

    doc.setTextColor(...primary);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(sanitize(dg.expediente || 'Expediente PJN'), ML + 4, y + 7);

    doc.setTextColor(...dark);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const fields: Array<[string, string]> = [
      ['Carátula', dg.caratula],
      ['Jurisdicción', dg.jurisdiccion],
      ['Dependencia', dg.dependencia],
      ['Situación', dg.situacionActual],
    ];
    let yBox = y + 13;
    for (const [label, value] of fields) {
      if (!value) continue;
      doc.setFont('helvetica', 'bold');
      doc.text(`${label}:`, ML + 4, yBox);
      doc.setFont('helvetica', 'normal');
      const valueLines = doc.splitTextToSize(sanitize(value), CW - 36) as string[];
      doc.text(valueLines, ML + 32, yBox);
      yBox += valueLines.length * 3.5 + 1.5;
    }
    y += 44;
  } else {
    // Sin datos generales (venimos de actuacionesHistoricas.seam). Mínimo título.
    doc.setTextColor(...primary);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Expediente PJN', ML, y + 4);
    y += 10;
  }

  // ── Métricas de la descarga ──
  y = ensureSpace(10, y);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...gray);
  const conDoc = input.actuaciones.filter((a) => a.hasDocument).length;
  doc.text(
    `${input.actuaciones.length} actuaciones incluidas · ${conDoc} con documento adjunto`,
    ML,
    y + 4
  );
  y += 10;

  // ── Tabla de actuaciones ──
  y = ensureSpace(12, y);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primary);
  doc.text('Actuaciones', ML, y + 4);
  y += 8;

  // Headers de tabla
  const colFecha = ML;
  const colTipo = ML + 22;
  const colDesc = ML + 58;
  const colFs = ML + CW - 22;
  const colDoc = ML + CW - 8;

  y = ensureSpace(8, y);
  doc.setFillColor(...headerBg);
  doc.rect(ML, y, CW, 6, 'F');
  doc.setFontSize(7.5);
  doc.setTextColor(...dark);
  doc.setFont('helvetica', 'bold');
  doc.text('Fecha', colFecha + 1, y + 4);
  doc.text('Tipo', colTipo + 1, y + 4);
  doc.text('Descripción', colDesc + 1, y + 4);
  doc.text('Fs.', colFs + 1, y + 4);
  doc.text('Doc', colDoc - 1, y + 4);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);

  for (let i = 0; i < input.actuaciones.length; i++) {
    const a = input.actuaciones[i];
    const descLines = doc.splitTextToSize(sanitize(a.descripcion), colFs - colDesc - 3) as string[];
    const rowH = Math.max(4, descLines.length * 3) + 1.5;

    y = ensureSpace(rowH, y);
    doc.setTextColor(...dark);
    doc.text(sanitize(a.fecha), colFecha + 1, y + 3);
    doc.text(sanitize(a.tipo).slice(0, 18), colTipo + 1, y + 3);
    doc.text(descLines, colDesc + 1, y + 3);
    doc.text(sanitize(a.foja), colFs + 1, y + 3);
    doc.text(a.hasDocument ? String(a.documentos.length) : '-', colDoc - 1, y + 3);
    y += rowH;
  }

  // ── Footer page numbers ──
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(6.5);
    doc.setTextColor(...gray);
    doc.text(`Pag. ${p}/${pageCount}`, 210 - MR, PH - 5, { align: 'right' });
    doc.text(sanitize(input.portalUrl).slice(0, 100), ML, PH - 5);
  }

  return doc.output('blob');
}

// ────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────

function pickDocumentsForDownload(
  a: PjnActuacion
): Array<{ kind: 'download' | 'view'; href: string }> {
  // Preferimos los marcados como 'download' sobre los 'view' — pero muchas
  // actuaciones solo tienen 'view' (viewer.seam?id=...&tipoDoc=...). Si hay
  // ambos apuntando al mismo id, son el mismo PDF (inline vs attachment).
  // Dedup por el 'id' del query string.
  const seenIds = new Set<string>();
  const result: Array<{ kind: 'download' | 'view'; href: string }> = [];
  for (const doc of a.documentos) {
    const id = extractViewerId(doc.href);
    const key = id || doc.href;
    if (seenIds.has(key)) continue;
    seenIds.add(key);
    result.push(doc);
  }
  return result;
}

function extractViewerId(href: string): string {
  try {
    const u = new URL(href, 'https://scw.pjn.gov.ar');
    return u.searchParams.get('id') ?? '';
  } catch {
    return '';
  }
}

function buildActuacionFilename(a: PjnActuacion): string {
  const dateIso = convertToIso(a.fecha);
  const descSafe = sanitizeFilename(a.descripcion).slice(0, 50);
  const foja = a.foja ? sanitizeFilename(a.foja).replace(/\//g, '-') : '';
  if (foja) {
    return `fs-${foja}_${dateIso}_${descSafe}`;
  }
  return `${dateIso}_${descSafe}`;
}

/**
 * Evita colisiones cuando sin el índice numérico (001, 002…) puede haber
 * dos archivos con el mismo nombre base (ej: actuaciones con misma fecha +
 * misma descripción y sin foja). Agrega `_2`, `_3`, … antes de la extensión.
 */
function uniqueFilename(candidate: string, used: Set<string>): string {
  if (!used.has(candidate)) {
    used.add(candidate);
    return candidate;
  }
  const dotIdx = candidate.lastIndexOf('.');
  const name = dotIdx > 0 ? candidate.slice(0, dotIdx) : candidate;
  const ext = dotIdx > 0 ? candidate.slice(dotIdx) : '';
  let n = 2;
  while (used.has(`${name}_${n}${ext}`)) n++;
  const final = `${name}_${n}${ext}`;
  used.add(final);
  return final;
}

function inferClaveFromActuaciones(
  actuaciones: PjnActuacion[]
): string | null {
  // Muy simple — el cliente no siempre tiene la clave. El caller normalmente
  // ya tiene datosGenerales.
  void actuaciones;
  return null;
}

function convertToIso(dateStr: string): string {
  const m = dateStr.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (m) {
    return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return dateStr.replace(/[\/]/g, '-');
}

function parseIsoDate(dateStr: string): string | null {
  const m = dateStr.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .trim();
}

function sanitize(text: string): string {
  return (text || '')
    .replace(/º/g, '°')
    .replace(/ª/g, 'a.')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/–/g, '-')
    .replace(/—/g, '--')
    .replace(/…/g, '...');
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
