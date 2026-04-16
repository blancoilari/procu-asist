/**
 * ZIP generator for judicial case files.
 * Creates a .zip containing:
 *   - [caseNumber]_expte_completo/
 *       ├── resumen.pdf             — resumen de todos los movimientos
 *       ├── 001_fs-X-Y_fecha_DD-MM-YYYY_DESC.pdf  — PDF por paso procesal
 *       ├── 001_..._adjunto_1.pdf   — adjuntos binarios
 *       └── _verificacion.txt       — informe de errores (solo si hubo fallos)
 *
 * Ordering: oldest movement first (001 = primer paso procesal).
 * Naming: {index}_fs-{fojas}_fecha_{date}_{description}
 */

import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import { generateCasePdfBlob, type PdfCaseData } from './case-pdf-generator';
import {
  fetchMevPageContent,
  downloadMevAttachment,
  type ProveidoPageData,
} from './attachment-downloader';
import { MEV_BASE_URL } from '@/modules/portals/mev-selectors';

export interface ZipMovement {
  date: string;
  fojas?: string;
  description: string;
  type?: string;
  hasDocuments: boolean;
  documentUrls: string[];
}

export interface ZipCaseData {
  caseNumber: string;
  title: string;
  court: string;
  portal: string;
  portalUrl: string;
  fechaInicio?: string;
  estadoPortal?: string;
  numeroReceptoria?: string;
  movements: ZipMovement[];
}

export interface ZipProgressCallback {
  (stage: string, current: number, total: number): void;
}

export interface ZipFailedItem {
  type: 'proveido' | 'adjunto';
  index: number;
  date: string;
  description: string;
  url: string;
  error: string;
}

export interface ZipGenerationResult {
  success: boolean;
  blob?: Blob;
  filename?: string;
  error?: string;
  stats?: {
    totalMovements: number;
    proveidosDownloaded: number;
    proveidosFailed: number;
    adjuntosDownloaded: number;
    adjuntosFailed: number;
    allSuccessful: boolean;
    failedItems: ZipFailedItem[];
  };
}

// ── Public entry point ────────────────────────────────────

export async function generateCaseZip(
  data: ZipCaseData,
  mevTabId: number,
  onProgress?: ZipProgressCallback
): Promise<ZipGenerationResult> {
  const zip = new JSZip();
  const safeNumber = data.caseNumber.replace(/[^a-zA-Z0-9-]/g, '_');

  // ── 1. Create main folder ──────────────────────────────
  const expedienteFolder = zip.folder(`${safeNumber}_expte_completo`);
  if (!expedienteFolder) {
    return { success: false, error: 'Error creando carpeta en ZIP' };
  }

  // ── 2. Summary PDF ──────────────────────────────────────
  onProgress?.('Generando resumen PDF...', 0, 1);

  const pdfData: PdfCaseData = {
    caseNumber: data.caseNumber,
    title: data.title,
    court: data.court,
    portal: data.portal,
    portalUrl: data.portalUrl,
    fechaInicio: data.fechaInicio,
    estadoPortal: data.estadoPortal,
    numeroReceptoria: data.numeroReceptoria,
    movements: data.movements.map((m) => ({
      date: m.date,
      fojas: m.fojas,
      description: m.description,
      type: m.type,
      hasDocuments: m.hasDocuments,
    })),
    attachments: [],
  };

  let pdfBlob: Blob;
  try {
    pdfBlob = generateCasePdfBlob(pdfData);
  } catch (err) {
    return {
      success: false,
      error: `Error generando PDF resumen: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  expedienteFolder.file('resumen.pdf', pdfBlob);

  // ── 3. Collect movements with documents, sorted ascending (oldest first) ──
  const movementsWithDocs = data.movements
    .filter((m) => m.hasDocuments && m.documentUrls.length > 0)
    .slice() // copy to avoid mutating original
    .reverse(); // MEV shows newest first → reverse for oldest-first numbering

  let proveidosDownloaded = 0;
  let proveidosFailed = 0;
  let adjuntosDownloaded = 0;
  let adjuntosFailed = 0;
  const failedItems: ZipFailedItem[] = [];

  // Flatten all doc entries with their sequential index
  const allDocs: Array<{ index: number; mov: ZipMovement; url: string }> = [];
  let docIdx = 1;
  for (const mov of movementsWithDocs) {
    for (const url of mov.documentUrls) {
      allDocs.push({ index: docIdx++, mov, url });
    }
  }

  const total = allDocs.length;

  for (const { index, mov, url } of allDocs) {
    onProgress?.(
      `Descargando documento ${index} de ${total}...`,
      index,
      total
    );

    const baseFilename = buildFilename(index, mov.date, mov.description, mov.fojas);

    // Fetch the proveido content (text + adjunto URLs), parsed inside the MEV tab
    const pageResult = await fetchMevPageContent(mevTabId, url);

    if ('error' in pageResult) {
      proveidosFailed++;
      failedItems.push({
        type: 'proveido', index, date: mov.date,
        description: mov.description, url: toAbsoluteUrl(url),
        error: pageResult.error,
      });
      expedienteFolder.file(
        `${baseFilename}_ERROR.txt`,
        `No se pudo descargar este documento.\nURL: ${toAbsoluteUrl(url)}\nError: ${pageResult.error}\n`
      );
      await delay(300);
      continue;
    }

    const parsed = pageResult;

    // Generate PDF from the proveido content with full metadata
    try {
      const proveidoPdfBlob = generateProveidoPdf({
        index,
        date: mov.date,
        fojas: mov.fojas,
        description: mov.description,
        caseNumber: data.caseNumber,
        title: data.title,
        court: data.court,
        content: parsed.text,
        sourceUrl: toAbsoluteUrl(url),
        juzgadoName: parsed.juzgadoName,
        departamento: parsed.departamento,
        datosExpediente: parsed.datosExpediente,
        pasoProcesal: parsed.pasoProcesal,
        referencias: parsed.referencias,
        datosPresentacion: parsed.datosPresentacion,
      });
      expedienteFolder.file(`${baseFilename}.pdf`, proveidoPdfBlob);
      proveidosDownloaded++;
    } catch (err) {
      proveidosFailed++;
      failedItems.push({
        type: 'proveido', index, date: mov.date,
        description: mov.description, url: toAbsoluteUrl(url),
        error: String(err),
      });
      expedienteFolder.file(
        `${baseFilename}_ERROR.txt`,
        `Error generando PDF.\nURL: ${toAbsoluteUrl(url)}\nError: ${err}\n\nContenido extraído:\n${parsed.text}`
      );
    }

    // Download VER ADJUNTO binary files found inside this proveido
    for (let ai = 0; ai < parsed.adjuntoUrls.length; ai++) {
      const adjUrl = parsed.adjuntoUrls[ai];
      const adjName = `${baseFilename}_adjunto_${ai + 1}`;

      onProgress?.(
        `Descargando adjunto ${ai + 1} de paso ${index}...`,
        index,
        total
      );

      const adjResult = await downloadMevAttachment(mevTabId, adjUrl, adjName);

      if (adjResult.success && adjResult.attachment) {
        const att = adjResult.attachment;
        const ext = getExtensionFromMime(att.mimeType);
        expedienteFolder.file(`${adjName}${ext}`, att.base64, { base64: true });
        adjuntosDownloaded++;
      } else {
        adjuntosFailed++;
        failedItems.push({
          type: 'adjunto', index, date: mov.date,
          description: `Adjunto ${ai + 1} de ${mov.description}`,
          url: adjUrl,
          error: adjResult.error ?? 'desconocido',
        });
        expedienteFolder.file(
          `${adjName}_ERROR.txt`,
          `No se pudo descargar este adjunto.\nURL: ${adjUrl}\nError: ${adjResult.error ?? 'desconocido'}\n`
        );
      }

      await delay(200);
    }

    await delay(300);
  }

  // ── 5. Verification report ────────────────────────────────
  const allSuccessful = failedItems.length === 0;
  if (!allSuccessful) {
    const verLines: string[] = [
      `VERIFICACIÓN DE DESCARGA — ${data.caseNumber}`,
      `Generado: ${new Date().toLocaleString('es-AR')}`,
      '='.repeat(60),
      '',
      `Proveidos descargados: ${proveidosDownloaded}`,
      `Proveidos fallidos: ${proveidosFailed}`,
      `Adjuntos descargados: ${adjuntosDownloaded}`,
      `Adjuntos fallidos: ${adjuntosFailed}`,
      '',
      'DETALLE DE ERRORES:',
      '-'.repeat(60),
      '',
    ];
    for (const item of failedItems) {
      verLines.push(`[${item.type.toUpperCase()}] Paso ${item.index} — ${item.date} — ${item.description}`);
      verLines.push(`  URL: ${item.url}`);
      verLines.push(`  Error: ${item.error}`);
      verLines.push('');
    }
    expedienteFolder.file('_verificacion.txt', verLines.join('\n'));
  }

  // ── 6. Generate final ZIP ────────────────────────────────
  onProgress?.('Comprimiendo...', total, total);

  let zipBlob: Blob;
  try {
    zipBlob = await zip.generateAsync({
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

  return {
    success: true,
    blob: zipBlob,
    filename: `expediente_${safeNumber}.zip`,
    stats: {
      totalMovements: data.movements.length,
      proveidosDownloaded,
      proveidosFailed,
      adjuntosDownloaded,
      adjuntosFailed,
      allSuccessful,
      failedItems,
    },
  };
}

// ── Proveido PDF Generator ───────────────────────────────

interface ProveidoPdfInput {
  index: number;
  date: string;
  fojas?: string;
  description: string;
  caseNumber: string;
  title: string;
  court: string;
  content: string;
  sourceUrl: string;
  // Extended metadata from ProveidoPageData
  juzgadoName?: string;
  departamento?: string;
  datosExpediente?: {
    caratula: string;
    fechaInicio: string;
    nroReceptoria: string;
    nroExpediente: string;
    estado: string;
  };
  pasoProcesal?: {
    fecha: string;
    tramite: string;
    firmado: boolean;
    fojas: string;
  };
  referencias?: {
    adjuntos: Array<{ nombre: string; url: string }>;
    despacho?: string;
    observacion?: string;
    observacionProfesional?: string;
  };
  datosPresentacion?: {
    fechaEscrito?: string;
    firmadoPor?: string;
    nroPresentacionElectronica?: string;
    presentadoPor?: string;
  };
}

function generateProveidoPdf(input: ProveidoPdfInput): Blob {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const ML = 15;
  const MR = 15;
  const CW = 210 - ML - MR;
  const PH = 297;
  const MB = 20;
  const primary: [number, number, number] = [37, 99, 235];
  const dark: [number, number, number] = [30, 30, 30];
  const gray: [number, number, number] = [100, 100, 100];
  const white: [number, number, number] = [255, 255, 255];
  const headerBg: [number, number, number] = [240, 245, 255];
  const lightGray: [number, number, number] = [200, 200, 200];
  const green: [number, number, number] = [22, 163, 74];

  /** Check page break and add page if needed */
  const ensureSpace = (needed: number, currentY: number): number => {
    if (currentY + needed > PH - MB) {
      doc.addPage();
      return 20;
    }
    return currentY;
  };

  // ── 1. Header bar ──
  doc.setFillColor(...primary);
  doc.rect(0, 0, 210, 12, 'F');
  doc.setTextColor(...white);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('ProcuAsist — Paso Procesal', ML, 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(
    `${String(input.index).padStart(3, '0')} — ${input.date}`,
    210 - MR,
    8,
    { align: 'right' }
  );

  let y = 16;

  // ── 2. Juzgado + Departamento ──
  if (input.juzgadoName) {
    doc.setTextColor(...dark);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const juzLine = input.departamento
      ? `${input.juzgadoName}  —  ${input.departamento}`
      : input.juzgadoName;
    const juzLines = doc.splitTextToSize(juzLine, CW) as string[];
    doc.text(juzLines, ML, y + 4);
    y += juzLines.length * 4 + 4;
  }

  // ── 3. Datos del Expediente box ──
  const datos = input.datosExpediente;
  // Calculate box height dynamically
  let boxContentH = 8; // base padding
  const caratulaText = datos?.caratula || input.title || 'Sin caratula';
  doc.setFontSize(8);
  const caratulaLines = doc.splitTextToSize(caratulaText, CW - 30) as string[];
  boxContentH += caratulaLines.length * 3.5 + 2;

  // Metadata items
  const metaItemsStr: string[] = [];
  if (datos?.fechaInicio) metaItemsStr.push(`Inicio: ${datos.fechaInicio}`);
  if (datos?.estado) metaItemsStr.push(`Estado: ${datos.estado}`);
  if (datos?.nroReceptoria) metaItemsStr.push(`Receptoria: ${datos.nroReceptoria}`);
  if (datos?.nroExpediente) metaItemsStr.push(`Expediente: ${datos.nroExpediente}`);
  if (metaItemsStr.length > 0) boxContentH += 8;

  const boxH = Math.max(28, boxContentH + 10);
  y = ensureSpace(boxH, y);
  doc.setFillColor(...headerBg);
  doc.roundedRect(ML, y, CW, boxH, 2, 2, 'F');

  // Case number
  doc.setTextColor(...primary);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(input.caseNumber, ML + 4, y + 7);

  // Caratula
  doc.setTextColor(...dark);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Caratula:', ML + 4, y + 13);
  doc.setFont('helvetica', 'normal');
  doc.text(caratulaLines, ML + 22, y + 13);

  // Metadata row
  const metaRowY = y + 13 + caratulaLines.length * 3.5 + 3;
  if (metaItemsStr.length > 0) {
    doc.setFontSize(7.5);
    doc.setTextColor(...gray);
    const metaLine = metaItemsStr.join('  |  ');
    const metaLines = doc.splitTextToSize(metaLine, CW - 8) as string[];
    doc.text(metaLines, ML + 4, metaRowY);
  }

  y += boxH + 3;

  // ── 4. Paso procesal info ──
  const paso = input.pasoProcesal;
  if (paso && paso.tramite) {
    y = ensureSpace(12, y);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...dark);
    doc.text('Paso procesal:', ML, y + 4);
    doc.setFont('helvetica', 'normal');

    let pasoText = '';
    if (paso.fecha) pasoText += `Fecha: ${paso.fecha}`;
    pasoText += ` — Tramite: ${paso.tramite}`;
    if (paso.firmado) pasoText += ' (FIRMADO)';
    if (paso.fojas) pasoText += ` — Fojas: ${paso.fojas}`;

    const pasoLines = doc.splitTextToSize(pasoText, CW - 30) as string[];
    doc.text(pasoLines, ML + 30, y + 4);
    y += pasoLines.length * 3.5 + 4;
  } else {
    // Fallback: show basic info
    y = ensureSpace(8, y);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...dark);
    doc.text('Desc.:', ML, y + 4);
    doc.setFont('helvetica', 'normal');
    const descFallback = doc.splitTextToSize(input.description, CW - 20) as string[];
    doc.text(descFallback, ML + 18, y + 4);
    y += descFallback.length * 3.5 + 2;
    doc.setFontSize(7.5);
    doc.setTextColor(...gray);
    doc.text(`Fojas: ${input.fojas ?? '-'}  |  Juzgado: ${input.court}`, ML, y + 4);
    y += 6;
  }

  // ── 5. REFERENCIAS ──
  const refs = input.referencias;
  if (refs && (refs.adjuntos.length > 0 || refs.despacho || refs.observacion || refs.observacionProfesional)) {
    y = ensureSpace(10, y);

    // Section separator
    doc.setDrawColor(...lightGray);
    doc.line(ML, y, ML + CW, y);
    y += 3;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...dark);
    doc.text('REFERENCIAS', ML, y + 4);
    y += 8;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');

    // Adjuntos with clickable links
    for (const adj of refs.adjuntos) {
      y = ensureSpace(6, y);
      doc.setTextColor(...primary);
      const adjLabel = `${adj.nombre}  VER ADJUNTO`;
      doc.text(adjLabel, ML + 2, y + 4);
      // Make it clickable
      const textWidth = doc.getTextWidth(adjLabel);
      doc.link(ML + 2, y, textWidth, 5, { url: adj.url });
      y += 6;
    }

    // Despacho
    if (refs.despacho) {
      y = ensureSpace(8, y);
      doc.setTextColor(...dark);
      doc.setFont('helvetica', 'bold');
      doc.text('Despachado en:', ML + 2, y + 4);
      doc.setFont('helvetica', 'normal');
      const despLines = doc.splitTextToSize(refs.despacho, CW - 30) as string[];
      doc.text(despLines, ML + 30, y + 4);
      y += despLines.length * 3.5 + 3;
    }

    // Observación
    if (refs.observacion) {
      y = ensureSpace(8, y);
      doc.setFont('helvetica', 'bold');
      doc.text('Observacion:', ML + 2, y + 4);
      doc.setFont('helvetica', 'normal');
      const obsLines = doc.splitTextToSize(refs.observacion, CW - 28) as string[];
      doc.text(obsLines, ML + 28, y + 4);
      y += obsLines.length * 3.5 + 3;
    }

    // Observación del Profesional
    if (refs.observacionProfesional) {
      y = ensureSpace(8, y);
      doc.setFont('helvetica', 'bold');
      doc.text('Obs. Profesional:', ML + 2, y + 4);
      doc.setFont('helvetica', 'normal');
      const obsPLines = doc.splitTextToSize(refs.observacionProfesional, CW - 34) as string[];
      doc.text(obsPLines, ML + 34, y + 4);
      y += obsPLines.length * 3.5 + 3;
    }
  }

  // ── 6. DATOS DE PRESENTACIÓN ──
  const pres = input.datosPresentacion;
  if (pres) {
    y = ensureSpace(10, y);

    doc.setDrawColor(...lightGray);
    doc.line(ML, y, ML + CW, y);
    y += 3;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...dark);
    doc.text('DATOS DE PRESENTACION', ML, y + 4);
    y += 8;

    doc.setFontSize(8);

    const presFields: Array<[string, string | undefined]> = [
      ['Fecha del Escrito:', pres.fechaEscrito],
      ['Firmado por:', pres.firmadoPor],
      ['Nro. Presentacion Electronica:', pres.nroPresentacionElectronica],
      ['Presentado por:', pres.presentadoPor],
    ];

    for (const [label, value] of presFields) {
      if (!value) continue;
      y = ensureSpace(6, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...dark);
      doc.text(label, ML + 2, y + 4);
      doc.setFont('helvetica', 'normal');
      const labelW = doc.getTextWidth(label) + 3;
      const valLines = doc.splitTextToSize(value, CW - labelW - 4) as string[];
      doc.text(valLines, ML + 2 + labelW, y + 4);
      y += valLines.length * 3.5 + 2;
    }
  }

  // ── 7. "Texto del Proveído" section ──
  y = ensureSpace(10, y);
  doc.setDrawColor(...lightGray);
  doc.line(ML, y, ML + CW, y);
  y += 3;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...dark);
  doc.text('Texto del Proveido', ML, y + 4);
  y += 8;

  // ── 8. Content text ──
  doc.setTextColor(...dark);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');

  const paragraphs = input.content.split('\n').filter((l) => l.trim().length > 0);

  for (const para of paragraphs) {
    const lines = doc.splitTextToSize(para.trim(), CW) as string[];
    const blockH = lines.length * 4;

    y = ensureSpace(blockH, y);
    doc.text(lines, ML, y);
    y += blockH + 2;
  }

  // ── 9. Source URL footer note ──
  y = ensureSpace(10, y);
  y += 4;
  doc.setFontSize(6.5);
  doc.setTextColor(...gray);
  const urlLines = doc.splitTextToSize(`Fuente: ${input.sourceUrl}`, CW) as string[];
  doc.text(urlLines, ML, y);

  // ── 10. Page numbers ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(6.5);
    doc.setTextColor(...gray);
    doc.text(
      `${input.caseNumber} — Paso ${input.index} — Pag. ${i}/${pageCount}`,
      210 - MR,
      PH - 5,
      { align: 'right' }
    );
  }

  return doc.output('blob');
}

// ── Helpers ──────────────────────────────────────────────

function buildFilename(index: number, date: string, description: string, fojas?: string): string {
  const safeDate = date.replace(/\//g, '-');
  const safeFojas = fojas ? fojas.replace(/\//g, '-') : 'sin';
  const safeDesc = description
    .substring(0, 35)
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  return `${String(index).padStart(3, '0')}_fs-${safeFojas}_fecha_${safeDate}_${safeDesc}`;
}

function toAbsoluteUrl(url: string): string {
  if (url.startsWith('http')) return url;
  return `${MEV_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

function getExtensionFromMime(mimeType: string): string {
  const clean = mimeType.split(';')[0].trim().toLowerCase();
  const map: Record<string, string> = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/tiff': '.tif',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'text/html': '.html',
    'text/plain': '.txt',
  };
  return map[clean] ?? '.bin';
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
