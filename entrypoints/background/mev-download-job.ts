/**
 * Descarga de expedientes MEV en el service worker, detrás del canal
 * 'mev-download' (modules/messages/mev-download.ts).
 *
 * El trabajo corre fuera del evento que lo inicia, así ningún evento dura
 * más de los 5 minutos que Chrome tolera. Para que el service worker no se
 * termine por inactividad (30 s sin eventos ni llamadas a la API), durante
 * toda la descarga se hace una llamada a la API cada 20 s: cubre las pausas
 * esperando una respuesta, las cuentas regresivas y el armado del archivo,
 * que no mandan mensajes. Si la pestaña se cierra o cambia de página, el
 * canal se corta y la descarga se cancela sin pedir nada más a la MEV.
 */

import {
  MEV_DOWNLOAD_PORT,
  type MevDownloadCaseData,
  type MevDownloadClientMessage,
  type MevDownloadServerMessage,
} from '@/modules/messages/mev-download';
import { generateCaseDownload } from '@/modules/pdf/case-zip-generator';
import type { BlockChoice, BlockReason, StopRequest } from '@/modules/pdf/mev-download-runner';
import { createMevPacer, MEV_MIN_INTERVAL_MS, realClock } from '@/modules/portals/mev-pacer';
import { blobToDataUri } from '@/modules/utils/blob';
import { recordMevChallenge } from './mev-verification-state';

/** Un solo portero para todas las descargas: comparten el cupo de la MEV. */
const pacer = createMevPacer(realClock);

/** Cada cuánto se llama a la API para que el service worker siga vivo. */
const LIFELINE_MS = 20_000;
const PAUSE_NOTIFICATION_PREFIX = 'mev-download-pause-';

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
    const tab = port.sender?.tab;
    if (tab?.id === undefined) {
      port.disconnect();
      return;
    }
    handlePort(port, tab.id);
  });
  // La notificación de pausa trae al frente la pestaña de la descarga.
  chrome.notifications.onClicked.addListener((notificationId) => {
    if (!notificationId.startsWith(PAUSE_NOTIFICATION_PREFIX)) return;
    const tabId = Number(notificationId.slice(PAUSE_NOTIFICATION_PREFIX.length));
    void chrome.notifications.clear(notificationId);
    if (!Number.isFinite(tabId)) return;
    // La ventana se busca al hacer clic: la pestaña pudo haberse movido.
    void chrome.tabs
      .get(tabId)
      .then((tab) =>
        Promise.all([
          chrome.tabs.update(tabId, { active: true }),
          chrome.windows.update(tab.windowId, { focused: true }),
        ])
      )
      .catch(() => undefined);
  });
}

function estimateEtaSeconds(done: number, total: number): number {
  return Math.round(((total - done) * (MEV_MIN_INTERVAL_MS + 300)) / 1000);
}

function notifyPause(notificationId: string, reason: BlockReason): void {
  void chrome.notifications
    .create(notificationId, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icon/128.png'),
      title: 'ProcuAsist: la descarga está en pausa',
      message:
        reason === 'desafio'
          ? 'La MEV pidió una pausa. Volvé a la pestaña de la descarga para elegir cómo seguir.'
          : 'Se cerró la sesión de la MEV. Volvé a la pestaña de la descarga para seguir.',
      priority: 2,
    })
    .catch(() => undefined);
}

function handlePort(port: chrome.runtime.Port, tabId: number): void {
  let started = false;
  let disconnected = false;
  let stopRequest: StopRequest = null;
  let pendingAnswer: ((choice: BlockChoice) => void) | null = null;
  const pauseNotificationId = `${PAUSE_NOTIFICATION_PREFIX}${tabId}`;

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
    const lifeline = setInterval(() => {
      void chrome.runtime.getPlatformInfo().catch(() => undefined);
    }, LIFELINE_MS);
    let building = false;
    try {
      const result = await generateCaseDownload(
        caseData,
        tabId,
        format,
        {
          onActivity: message => post({ type: 'activity', message }),
          onProgress: ({ done, total }) => {
            if (done >= total) {
              // Terminó de pedir: desde acá se arma el archivo y la pantalla
              // deja de ofrecer Detener.
              if (!building) post({ type: 'building' });
              building = true;
              return;
            }
            post({ type: 'progress', done, total, etaSeconds: estimateEtaSeconds(done, total) });
          },
          onBlocked: ({ reason, done, total, waitMs, canSkip }) =>
            new Promise<BlockChoice>((resolve) => {
              // El mantener sesión deja de pedir mientras la MEV frena.
              if (reason === 'desafio') void recordMevChallenge();
              if (stopRequest) {
                resolve(stopRequest);
                return;
              }
              pendingAnswer = (choice) => {
                void chrome.notifications.clear(pauseNotificationId).catch(() => undefined);
                resolve(choice);
              };
              post({ type: 'paused', reason, done, total, waitSeconds: Math.round(waitMs / 1000), canSkip });
              notifyPause(pauseNotificationId, reason);
            }),
          onWaiting: ({ secondsLeft, done, total }) => post({ type: 'waiting', secondsLeft, done, total }),
          shouldStop: () => stopRequest,
        },
        pacer
      );

      if (result.outcome === 'cancelled' || disconnected || stopRequest === 'cancel') {
        post({ type: 'cancelled' });
        return;
      }
      if (!result.blob || !result.filename) {
        post({ type: 'error', message: result.error ?? 'No se pudo armar el archivo.' });
        return;
      }
      if (!building) post({ type: 'building' });
      const mime = format === 'pdf' ? 'application/pdf' : 'application/zip';
      const dataUri = await blobToDataUri(result.blob, mime);
      await chrome.downloads.download({ url: dataUri, filename: result.filename, saveAs: true });
      post({ type: 'result', outcome: result.outcome, filename: result.filename, stats: result.stats });
    } catch (err) {
      console.error('[ProcuAsist] Descarga MEV:', err);
      post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      clearInterval(lifeline);
      void chrome.notifications.clear(pauseNotificationId).catch(() => undefined);
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
