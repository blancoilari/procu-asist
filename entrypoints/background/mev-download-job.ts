/**
 * Descarga de expedientes MEV en el service worker, detrás del canal
 * 'mev-download' (modules/messages/mev-download.ts).
 *
 * El trabajo corre fuera del evento que lo inicia: así ningún evento dura
 * más de los 5 minutos que Chrome tolera, y los mensajes por el canal
 * (progreso, cuenta regresiva y un latido cada 20 s mientras se espera una
 * respuesta) mantienen vivo el service worker. Si la pestaña se cierra o
 * cambia de página, el canal se corta y la descarga se cancela sin pedir
 * nada más a la MEV.
 */

import {
  MEV_DOWNLOAD_PORT,
  type MevDownloadCaseData,
  type MevDownloadClientMessage,
  type MevDownloadServerMessage,
} from '@/modules/messages/mev-download';
import { generateCaseDownload } from '@/modules/pdf/case-zip-generator';
import type { BlockChoice, StopRequest } from '@/modules/pdf/mev-download-runner';
import { createMevPacer, MEV_MIN_INTERVAL_MS, realClock } from '@/modules/portals/mev-pacer';
import { blobToDataUri } from '@/modules/utils/blob';

/** Un solo portero para todas las descargas: comparten el cupo de la MEV. */
const pacer = createMevPacer(realClock);

const KEEPALIVE_MS = 20_000;

let activeJobs = 0;
let scanPending = false;
let runPostponedScan: (() => Promise<unknown>) | null = null;

/** true mientras haya una descarga MEV en curso. */
export function isMevDownloadActive(): boolean {
  return activeJobs > 0;
}

/** El escaneo del monitoreo se salteó la MEV por una descarga: correrlo al terminar. */
export function requestScanAfterDownloads(): void {
  scanPending = true;
}

export function setupMevDownloadPort(options: { runPostponedScan: () => Promise<unknown> }): void {
  runPostponedScan = options.runPostponedScan;
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== MEV_DOWNLOAD_PORT) return;
    const tabId = port.sender?.tab?.id;
    if (tabId === undefined) {
      port.disconnect();
      return;
    }
    handlePort(port, tabId);
  });
}

function estimateEtaSeconds(done: number, total: number): number {
  return Math.round(((total - done) * (MEV_MIN_INTERVAL_MS + 300)) / 1000);
}

function handlePort(port: chrome.runtime.Port, tabId: number): void {
  let started = false;
  let disconnected = false;
  let stopRequest: StopRequest = null;
  let pendingAnswer: ((choice: BlockChoice) => void) | null = null;

  const post = (message: MevDownloadServerMessage) => {
    if (disconnected) return;
    try {
      port.postMessage(message);
    } catch {
      disconnected = true;
    }
  };

  const answer = (choice: BlockChoice) => {
    const resolve = pendingAnswer;
    pendingAnswer = null;
    resolve?.(choice);
  };

  port.onDisconnect.addListener(() => {
    disconnected = true;
    stopRequest = 'cancel';
    answer('cancel');
  });

  port.onMessage.addListener((message: MevDownloadClientMessage) => {
    if (message.type === 'start' && !started) {
      started = true;
      void runJob(message.caseData, message.format);
    } else if (message.type === 'answer') {
      answer(message.choice);
    } else if (message.type === 'stop') {
      stopRequest = message.save ? 'stop-save' : 'cancel';
      answer(stopRequest);
    }
  });

  async function runJob(caseData: MevDownloadCaseData, format: 'zip' | 'pdf'): Promise<void> {
    activeJobs += 1;
    try {
      const result = await generateCaseDownload(
        caseData,
        tabId,
        format,
        {
          onProgress: ({ done, total }) =>
            post({ type: 'progress', done, total, etaSeconds: estimateEtaSeconds(done, total) }),
          onBlocked: ({ reason, done, total, waitMs }) =>
            new Promise<BlockChoice>((resolve) => {
              if (stopRequest) {
                resolve(stopRequest);
                return;
              }
              const beat = setInterval(() => post({ type: 'keepalive' }), KEEPALIVE_MS);
              pendingAnswer = (choice) => {
                clearInterval(beat);
                resolve(choice);
              };
              post({ type: 'paused', reason, done, total, waitSeconds: Math.round(waitMs / 1000) });
            }),
          onWaiting: ({ secondsLeft, done, total }) => post({ type: 'waiting', secondsLeft, done, total }),
          shouldStop: () => stopRequest,
        },
        pacer
      );

      if (result.outcome === 'cancelled' || disconnected) {
        post({ type: 'cancelled' });
        return;
      }
      if (!result.blob || !result.filename) {
        post({ type: 'error', message: result.error ?? 'No se pudo armar el archivo.' });
        return;
      }
      post({ type: 'building' });
      const mime = format === 'pdf' ? 'application/pdf' : 'application/zip';
      const dataUri = await blobToDataUri(result.blob, mime);
      await chrome.downloads.download({ url: dataUri, filename: result.filename, saveAs: true });
      post({ type: 'result', outcome: result.outcome, filename: result.filename, stats: result.stats });
    } catch (err) {
      console.error('[ProcuAsist] Descarga MEV:', err);
      post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      activeJobs -= 1;
      if (activeJobs === 0 && scanPending && runPostponedScan) {
        scanPending = false;
        void runPostponedScan().catch((err) =>
          console.warn('[ProcuAsist] Escaneo pospuesto por la descarga falló:', err)
        );
      }
    }
  }
}
