/**
 * Descarga de un expediente de la MEV: arma el ZIP (un PDF por paso y sus
 * adjuntos) o un PDF único, con el recorrido de mev-download-runner.ts.
 *
 * Contenido del ZIP:
 *   <numero>_expte_completo/
 *     resumen.pdf                                  todos los movimientos de la ficha
 *     AAAA-MM-DD_fs-X_DESCRIPCION.pdf              un PDF por paso procesal
 *     AAAA-MM-DD_fs-X_DESCRIPCION_adjunto_N.ext    adjuntos del paso
 *     _verificacion_AAAA-MM-DD_HHMM.txt           solo si falta algo
 */

import JSZip from 'jszip';
import { generateCasePdfBlob, type PdfCaseData } from './case-pdf-generator';
import { generateProveidoPdf, generateTextReportPdf } from './proveido-pdf-generator';
import {
  downloadMevAttachment,
  enterMevCase,
  fetchMevPageContent,
  isMevHostedUrl,
  toAbsoluteMevUrl,
  type ProveidoPageData,
} from './attachment-downloader';
import { mergePdfParts, type MergedPdfPart } from './merged-pdf-generator';
import { runMevDownload, type RunnerHooks } from './mev-download-runner';
import { buildVerificationLines, type MevDownloadStats } from './download-report';
import { downloadStamp, verificationFileName } from './file-naming';
import { realClock, type MevPacer } from '@/modules/portals/mev-pacer';
import type { MevDownloadCaseData } from '@/modules/messages/mev-download';
import { blobToBase64 } from '@/modules/utils/blob';

export interface CaseDownloadResult {
  outcome: 'complete' | 'partial' | 'cancelled';
  blob?: Blob;
  filename?: string;
  stats: MevDownloadStats;
  error?: string;
}

export async function generateCaseDownload(
  data: MevDownloadCaseData,
  tabId: number,
  format: 'zip' | 'pdf',
  hooks: RunnerHooks,
  pacer: MevPacer
): Promise<CaseDownloadResult> {
  const zip = new JSZip();
  const safeNumber = data.caseNumber.replace(/[^a-zA-Z0-9-]/g, '_');
  // Fecha y hora en el nombre del archivo: "Bajar los que faltan" o una
  // descarga parcial posterior no proponen pisar el archivo de la anterior.
  const startedAt = new Date();
  const outputBase = `expediente_${safeNumber}_${downloadStamp(startedAt)}`;
  const folder = zip.folder(`${safeNumber}_expte_completo`);
  if (!folder) throw new Error('No se pudo crear la carpeta dentro del ZIP');
  const mergeParts: MergedPdfPart[] = [];

  // El resumen lista TODOS los movimientos de la ficha: una descarga parcial
  // posterior lo reemplaza por uno completo y al día.
  const pdfData: PdfCaseData = {
    caseNumber: data.caseNumber,
    title: data.title,
    court: data.court,
    portal: data.portal,
    portalUrl: data.portalUrl,
    fechaInicio: data.fechaInicio,
    estadoPortal: data.estadoPortal,
    numeroReceptoria: data.numeroReceptoria,
    movements: data.allMovements.map((m) => ({
      date: m.date,
      fojas: m.fojas,
      description: m.description,
      type: m.type,
      hasDocuments: m.hasDocuments,
    })),
    attachments: [],
  };
  const resumenBlob = generateCasePdfBlob(pdfData);
  folder.file('resumen.pdf', resumenBlob);

  // La MEV lista del más nuevo al más viejo: se baja del más viejo al más
  // nuevo, que es el orden del PDF único.
  const oldestFirst = data.movements
    .filter((m) => m.hasDocuments && m.documentUrls.length > 0)
    .slice()
    .reverse();

  const run = await runMevDownload<ProveidoPageData>(
    oldestFirst,
    {
      pace: () => pacer.wait(),
      sleep: realClock.sleep,
      now: realClock.now,
      fetchProveido: (url) => fetchMevPageContent(tabId, url),
      enterCase: () => enterMevCase(tabId, data.portalUrl),
      isMevHosted: isMevHostedUrl,
      fetchAttachment: (url) => downloadMevAttachment(tabId, url),
      adjuntoUrls: (page) => page.adjuntoUrls,
      saveProveido: async (fileName, mov, url, page) => {
        const blob = generateProveidoPdf({
          date: mov.date,
          fojas: mov.fojas,
          description: mov.description,
          caseNumber: data.caseNumber,
          title: data.title,
          court: data.court,
          content: page.text,
          sourceUrl: toAbsoluteMevUrl(url),
          juzgadoName: page.juzgadoName,
          departamento: page.departamento,
          datosExpediente: page.datosExpediente,
          pasoProcesal: page.pasoProcesal,
          referencias: page.referencias,
          datosPresentacion: page.datosPresentacion,
        });
        folder.file(`${fileName}.pdf`, blob);
        if (format === 'pdf') {
          mergeParts.push({ label: fileName, base64: await blobToBase64(blob), mimeType: 'application/pdf' });
        }
      },
      saveAttachment: async (fileName, base64, mimeType) => {
        const ext = getExtensionFromMime(mimeType);
        folder.file(`${fileName}${ext}`, base64, { base64: true });
        if (format === 'pdf') mergeParts.push({ label: `${fileName}${ext}`, base64, mimeType });
      },
    },
    hooks
  );

  if (run.outcome === 'cancelled') return { outcome: 'cancelled', stats: run.stats };
  const outcome = run.outcome;
  // Ya no se pide nada a la MEV: el fondo avisa que se arma el archivo
  // (también cuando se detuvo y se guarda lo bajado).
  hooks.onProgress({ done: run.stats.requestedDocuments, total: run.stats.requestedDocuments });

  if (run.stats.failedItems.length > 0) {
    const lines = buildVerificationLines({ caseNumber: data.caseNumber, generatedAt: new Date(), outcome, stats: run.stats });
    // Misma marca que el archivo de salida: el informe y su ZIP se reconocen como pareja.
    folder.file(verificationFileName(startedAt), lines.join('\n'));
    // En el PDF único el .txt no llega al usuario: va como última página.
    if (format === 'pdf') {
      try {
        const verBlob = generateTextReportPdf(`Verificación de descarga, expediente ${data.caseNumber}`, lines);
        mergeParts.push({ label: '_verificacion', base64: await blobToBase64(verBlob), mimeType: 'application/pdf' });
      } catch (err) {
        console.warn('[ProcuAsist] No se pudo agregar la página de verificación:', err);
      }
    }
  }

  try {
    if (format === 'pdf') {
      const resumenBytes = new Uint8Array(await resumenBlob.arrayBuffer());
      const { blob } = await mergePdfParts(resumenBytes, mergeParts);
      return { outcome, blob, filename: `${outputBase}.pdf`, stats: run.stats };
    }
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    return { outcome, blob, filename: `${outputBase}.zip`, stats: run.stats };
  } catch (err) {
    return {
      outcome,
      stats: run.stats,
      error: `No se pudo armar el archivo: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
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
