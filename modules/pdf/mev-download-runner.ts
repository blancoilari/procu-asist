/**
 * Recorrido de la descarga de un expediente de la MEV: orden de los
 * pedidos, qué hacer con cada respuesta y cuándo frenar a preguntar.
 *
 * Política (especificación del 22/09/2026):
 *   - cada pedido a la MEV espera su turno en el portero (20 por minuto);
 *   - pantalla de verificación o sesión cerrada: la descarga deja de pedir
 *     y pregunta; con "esperar" cuenta la espera que toca y reintenta el
 *     MISMO documento, nunca lo saltea;
 *   - la MEV devolvió la búsqueda en vez del proveído: reingresa una vez a
 *     la ficha y reintenta;
 *   - otra página o un error: reintenta una vez y, si se repite, lo anota
 *     como faltante con lo que devolvió la MEV y sigue con el resto.
 *
 * Módulo puro: los pedidos, el guardado y el reloj se inyectan. Lo prueba
 * tests/mev-download-runner.test.ts con dobles.
 */

import { blockWaitMs } from '../portals/mev-pacer.ts';
import {
  emptyStats,
  type MevDownloadStats,
  type MevFailureReason,
} from './download-report.ts';

export interface RunnerMovement {
  date: string;
  fojas?: string;
  description: string;
  documentUrls: string[];
  /** Nombre base del archivo (modules/pdf/file-naming.ts). */
  fileBase: string;
}

export type BlockReason = 'desafio' | 'login';

export type PageFetch<T> =
  | { status: 'ok'; data: T }
  | {
      status: 'desafio' | 'login' | 'sin-contexto' | 'respuesta-inesperada' | 'error';
      detail: string;
    };

export type AttachmentFetch =
  | { status: 'ok'; base64: string; mimeType: string }
  | { status: 'desafio' | 'login' | 'error'; detail: string };

export interface CaseEntry {
  status: 'ok' | 'desafio' | 'login' | 'error';
  detail: string;
}

export interface RunnerDeps<T> {
  /** Espera el turno del portero antes de un pedido a la MEV. */
  pace(): Promise<void>;
  sleep(ms: number): Promise<void>;
  fetchProveido(url: string): Promise<PageFetch<T>>;
  /** Reingresa a la ficha de la causa: deja la causa en la sesión. */
  enterCase(): Promise<CaseEntry>;
  /** true si el adjunto se pide a la MEV (cuenta para el límite). */
  isMevHosted(url: string): boolean;
  fetchAttachment(url: string): Promise<AttachmentFetch>;
  adjuntoUrls(data: T): string[];
  saveProveido(fileName: string, mov: RunnerMovement, url: string, data: T): Promise<void>;
  saveAttachment(fileName: string, base64: string, mimeType: string): Promise<void>;
}

export type BlockChoice = 'wait' | 'continue' | 'stop-save' | 'cancel';
export type StopRequest = 'stop-save' | 'cancel' | null;

export interface RunnerHooks {
  onProgress(p: { done: number; total: number }): void;
  /** Pausa: la descarga no pide nada hasta que esto resuelva. */
  onBlocked(b: { reason: BlockReason; done: number; total: number; waitMs: number }): Promise<BlockChoice>;
  onWaiting(w: { secondsLeft: number; done: number; total: number }): void;
  shouldStop(): StopRequest;
}

export interface RunnerResult {
  outcome: 'complete' | 'partial' | 'cancelled';
  stats: MevDownloadStats;
}

/** Tramo de la cuenta regresiva durante una espera. */
export const WAIT_TICK_MS = 5_000;

interface DocEntry {
  mov: RunnerMovement;
  url: string;
  fileName: string;
}

interface PendingAttachment {
  doc: DocEntry;
  url: string;
  fileName: string;
}

export async function runMevDownload<T>(
  movements: RunnerMovement[],
  deps: RunnerDeps<T>,
  hooks: RunnerHooks
): Promise<RunnerResult> {
  const docs: DocEntry[] = [];
  for (const mov of movements) {
    mov.documentUrls.forEach((url, i) => {
      docs.push({ mov, url, fileName: i === 0 ? mov.fileBase : `${mov.fileBase}_doc${i + 1}` });
    });
  }
  const total = docs.length;
  const stats = emptyStats(total);
  const missing = new Set<string>();
  let done = 0;
  let consecutiveBlocks = 0;

  const fail = (
    doc: DocEntry,
    kind: 'proveido' | 'adjunto',
    fileName: string,
    url: string,
    reason: MevFailureReason,
    detail: string
  ) => {
    stats.failedItems.push({
      kind,
      fileName,
      date: doc.mov.date,
      fojas: doc.mov.fojas,
      description: doc.mov.description,
      url,
      reason,
      detail,
      movementFileBase: doc.mov.fileBase,
    });
    if (reason === 'pendiente') stats.pending += 1;
    else if (kind === 'proveido') stats.proveidosFailed += 1;
    else stats.adjuntosFailed += 1;
    missing.add(doc.mov.fileBase);
  };

  const finish = (
    order: 'stop-save' | 'cancel',
    fromDoc: number,
    pendingAttachments: PendingAttachment[] = []
  ): RunnerResult => {
    if (order === 'cancel') {
      stats.missingFileBases = [...missing];
      return { outcome: 'cancelled', stats };
    }
    for (const a of pendingAttachments) fail(a.doc, 'adjunto', a.fileName, a.url, 'pendiente', '');
    for (let k = fromDoc; k < docs.length; k++) {
      const doc = docs[k];
      fail(doc, 'proveido', `${doc.fileName}.pdf`, doc.url, 'pendiente', '');
    }
    stats.missingFileBases = [...missing];
    return { outcome: 'partial', stats };
  };

  /** Pausa por bloqueo: devuelve 'retry' o la orden de detener. */
  const resolveBlock = async (reason: BlockReason): Promise<'retry' | 'stop-save' | 'cancel'> => {
    let current: BlockReason = reason;
    for (;;) {
      const waitMs = blockWaitMs(consecutiveBlocks);
      const choice = await hooks.onBlocked({ reason: current, done, total, waitMs });
      if (choice === 'stop-save' || choice === 'cancel') return choice;
      if (current === 'desafio') {
        consecutiveBlocks += 1;
        let left = waitMs;
        while (left > 0) {
          const stop = hooks.shouldStop();
          if (stop) return stop;
          hooks.onWaiting({ secondsLeft: Math.ceil(left / 1000), done, total });
          const step = Math.min(WAIT_TICK_MS, left);
          await deps.sleep(step);
          left -= step;
        }
        return 'retry';
      }
      // Sesión cerrada: el usuario avisa que ya entró en otra pestaña. El
      // reingreso a la ficha deja la causa en la sesión nueva.
      await deps.pace();
      const entry = await deps.enterCase();
      if (entry.status === 'desafio' || entry.status === 'login') {
        current = entry.status;
        continue;
      }
      return 'retry';
    }
  };

  for (let di = 0; di < docs.length; di++) {
    const doc = docs[di];
    hooks.onProgress({ done, total });

    let page: { data: T } | null = null;
    let failure: { reason: MevFailureReason; detail: string } | null = null;
    let reentered = false;
    let retried = false;

    while (!page && !failure) {
      const stop = hooks.shouldStop();
      if (stop) return finish(stop, di);
      await deps.pace();
      const got = await deps.fetchProveido(doc.url);
      if (got.status === 'ok') {
        page = { data: got.data };
        consecutiveBlocks = 0;
      } else if (got.status === 'desafio' || got.status === 'login') {
        const next = await resolveBlock(got.status);
        if (next !== 'retry') return finish(next, di);
      } else if (got.status === 'sin-contexto' && !reentered) {
        reentered = true;
        await deps.pace();
        const entry = await deps.enterCase();
        if (entry.status === 'desafio' || entry.status === 'login') {
          const next = await resolveBlock(entry.status);
          if (next !== 'retry') return finish(next, di);
        }
      } else if ((got.status === 'respuesta-inesperada' || got.status === 'error') && !retried) {
        retried = true;
      } else {
        failure = { reason: got.status, detail: got.detail };
      }
    }

    if (!page) {
      if (failure) fail(doc, 'proveido', `${doc.fileName}.pdf`, doc.url, failure.reason, failure.detail);
      done += 1;
      continue;
    }

    try {
      await deps.saveProveido(doc.fileName, doc.mov, doc.url, page.data);
      stats.proveidosDownloaded += 1;
    } catch (err) {
      fail(doc, 'proveido', `${doc.fileName}.pdf`, doc.url, 'error', err instanceof Error ? err.message : String(err));
    }

    const adjuntos = deps.adjuntoUrls(page.data);
    for (let ai = 0; ai < adjuntos.length; ai++) {
      const url = adjuntos[ai];
      const fileName = `${doc.fileName}_adjunto_${ai + 1}`;
      const restantes = (): PendingAttachment[] =>
        adjuntos.slice(ai).map((u, k) => ({ doc, url: u, fileName: `${doc.fileName}_adjunto_${ai + k + 1}` }));
      let attachmentRetried = false;
      for (;;) {
        const stop = hooks.shouldStop();
        if (stop) return finish(stop, di + 1, restantes());
        const mevHosted = deps.isMevHosted(url);
        if (mevHosted) await deps.pace();
        const got = await deps.fetchAttachment(url);
        if (got.status === 'ok') {
          await deps.saveAttachment(fileName, got.base64, got.mimeType);
          stats.adjuntosDownloaded += 1;
          consecutiveBlocks = 0;
          break;
        }
        if (got.status === 'desafio' || got.status === 'login') {
          const next = await resolveBlock(got.status);
          if (next !== 'retry') return finish(next, di + 1, restantes());
          continue;
        }
        if (mevHosted && !attachmentRetried) {
          attachmentRetried = true;
          continue;
        }
        fail(doc, 'adjunto', fileName, url, 'error', got.detail);
        break;
      }
    }
    done += 1;
  }

  hooks.onProgress({ done, total });
  stats.missingFileBases = [...missing];
  return { outcome: 'complete', stats };
}
