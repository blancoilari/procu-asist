/**
 * Canal entre la pestaña de la MEV y el fondo de la extensión para la
 * descarga de un expediente (chrome.runtime.connect). Un canal y no un
 * mensaje suelto: Chrome termina el service worker si un solo mensaje tarda
 * más de 5 minutos, y una descarga que respeta el límite de la MEV tarda
 * más que eso en un expediente grande. Los mensajes por el canal lo
 * mantienen vivo (Chrome 114 o posterior).
 */

import type { BlockChoice, BlockReason } from '@/modules/pdf/mev-download-runner';
import type { MevDownloadStats } from '@/modules/pdf/download-report';

export const MEV_DOWNLOAD_PORT = 'mev-download';

export interface MevDownloadMovement {
  date: string;
  fojas?: string;
  description: string;
  type?: string;
  hasDocuments: boolean;
  documentUrls: string[];
  /** Nombre base del archivo, calculado sobre la lista completa de la ficha. */
  fileBase: string;
}

export interface MevDownloadCaseData {
  caseNumber: string;
  title: string;
  court: string;
  portal: string;
  portalUrl: string;
  fechaInicio?: string;
  estadoPortal?: string;
  numeroReceptoria?: string;
  /** Todos los movimientos de la ficha, en el orden de la MEV, para el resumen. */
  allMovements: Array<{ date: string; fojas?: string; description: string; type?: string; hasDocuments: boolean }>;
  /** Movimientos elegidos para bajar, en el orden de la MEV (más nuevo primero). */
  movements: MevDownloadMovement[];
}

export type MevDownloadClientMessage =
  | { type: 'start'; caseData: MevDownloadCaseData; format: 'zip' | 'pdf' }
  | { type: 'answer'; choice: BlockChoice }
  | { type: 'stop'; save: boolean };

export type MevDownloadServerMessage =
  | { type: 'progress'; done: number; total: number; etaSeconds: number }
  | { type: 'paused'; reason: BlockReason; done: number; total: number; waitSeconds: number }
  | { type: 'waiting'; secondsLeft: number; done: number; total: number }
  | { type: 'keepalive' }
  | { type: 'building' }
  | { type: 'result'; outcome: 'complete' | 'partial'; filename: string; stats: MevDownloadStats }
  | { type: 'cancelled' }
  | { type: 'error'; message: string };
