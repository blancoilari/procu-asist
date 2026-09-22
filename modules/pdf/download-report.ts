/**
 * Informe de faltantes de una descarga de la MEV: el archivo
 * _verificacion_AAAA-MM-DD_HHMM.txt, la última página del PDF único y los
 * datos del aviso en pantalla. Módulo puro, se prueba en node.
 */

export type MevFailureReason =
  | 'desafio'
  | 'login'
  | 'sin-contexto'
  | 'respuesta-inesperada'
  | 'error'
  | 'pendiente';

export interface MevFailedItem {
  kind: 'proveido' | 'adjunto';
  /** Nombre del archivo que le correspondía. */
  fileName: string;
  date: string;
  fojas?: string;
  description: string;
  url: string;
  reason: MevFailureReason;
  /** Qué devolvió la MEV o qué falló. */
  detail: string;
  /** Movimiento al que pertenece, para "Bajar los que faltan". */
  movementFileBase: string;
}

export interface MevDownloadStats {
  requestedDocuments: number;
  proveidosDownloaded: number;
  proveidosFailed: number;
  adjuntosDownloaded: number;
  adjuntosFailed: number;
  /** Documentos o adjuntos que no se llegaron a pedir porque la descarga se detuvo. */
  pending: number;
  failedItems: MevFailedItem[];
  /** Movimientos a volver a pedir (fallidos o pendientes), sin repetir. */
  missingFileBases: string[];
}

export function emptyStats(requestedDocuments: number): MevDownloadStats {
  return {
    requestedDocuments,
    proveidosDownloaded: 0,
    proveidosFailed: 0,
    adjuntosDownloaded: 0,
    adjuntosFailed: 0,
    pending: 0,
    failedItems: [],
    missingFileBases: [],
  };
}

export function reasonLabel(reason: MevFailureReason): string {
  switch (reason) {
    case 'desafio':
      return 'la MEV respondió con su pantalla de verificación';
    case 'login':
      return 'la sesión de la MEV se cerró';
    case 'sin-contexto':
      return 'la MEV devolvió la búsqueda en vez del proveído';
    case 'respuesta-inesperada':
      return 'la MEV devolvió otra página';
    case 'error':
      return 'error al pedir o armar el documento';
    case 'pendiente':
      return 'no se pidió: la descarga se detuvo antes';
  }
}

export function formatDateTimeAr(at: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(at.getDate())}/${p(at.getMonth() + 1)}/${at.getFullYear()} ${p(at.getHours())}:${p(at.getMinutes())}`;
}

export function buildVerificationLines(input: {
  caseNumber: string;
  generatedAt: Date;
  outcome: 'complete' | 'partial';
  stats: MevDownloadStats;
}): string[] {
  const { stats } = input;
  const lines: string[] = [
    `VERIFICACIÓN DE DESCARGA, expediente ${input.caseNumber}`,
    `Generado: ${formatDateTimeAr(input.generatedAt)}`,
    input.outcome === 'partial'
      ? 'Resultado: descarga detenida antes de terminar'
      : 'Resultado: descarga terminada, con faltantes',
    '='.repeat(60),
    '',
    `Documentos pedidos: ${stats.requestedDocuments}`,
    `Proveídos bajados: ${stats.proveidosDownloaded}`,
    `Proveídos que faltan: ${stats.proveidosFailed}`,
    `Adjuntos bajados: ${stats.adjuntosDownloaded}`,
    `Adjuntos que faltan: ${stats.adjuntosFailed}`,
    `No pedidos porque la descarga se detuvo: ${stats.pending}`,
    '',
    'Para completar la carpeta, usá "Bajar los que faltan" en la pantalla de la MEV',
    'o volvé a descargar esos pasos: los nombres encajan en esta misma carpeta.',
    '',
    'FALTANTES:',
    '-'.repeat(60),
    '',
  ];
  for (const item of stats.failedItems) {
    lines.push(`[${item.kind === 'proveido' ? 'PROVEÍDO' : 'ADJUNTO'}] ${item.fileName}`);
    const fojas = item.fojas ? `, fs. ${item.fojas}` : '';
    lines.push(`  Paso: ${item.date}${fojas}, ${item.description}`);
    lines.push(`  Motivo: ${reasonLabel(item.reason)}`);
    if (item.detail) lines.push(`  Detalle: ${item.detail}`);
    if (item.url) lines.push(`  URL: ${item.url}`);
    lines.push('');
  }
  return lines;
}
