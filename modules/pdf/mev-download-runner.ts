/**
 * Recorrido de la descarga de un expediente de la MEV: orden de los
 * pedidos, qué hacer con cada respuesta y cuándo frenar a preguntar.
 *
 * Política (especificación del 22/09/2026):
 *   - cada pedido a la MEV espera su turno en el portero (10 por minuto);
 *   - pantalla de verificación o sesión cerrada: la descarga deja de pedir
 *     y pregunta; con "esperar" completa la espera que toca, contada desde
 *     el bloqueo (el tiempo que el aviso estuvo abierto ya cuenta), y
 *     reintenta el MISMO documento. Nunca lo saltea por su cuenta: desde el segundo
 *     bloqueo seguido del mismo documento, el usuario puede elegir
 *     saltearlo (salida para un documento que la MEV nunca sirve);
 *   - la MEV devolvió la búsqueda en vez del proveído: reingresa a la ficha
 *     y reintenta (si el reingreso choca con un bloqueo, después de la
 *     espera vuelve a reingresar);
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
  /** Hora actual en milisegundos: la espera se cuenta desde el bloqueo. */
  now(): number;
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

export type BlockChoice = 'wait' | 'continue' | 'skip' | 'stop-save' | 'cancel';
export type StopRequest = 'stop-save' | 'cancel' | null;

export interface RunnerHooks {
  onActivity?(message: string): void;
  onProgress(p: { done: number; total: number }): void;
  /**
   * Pausa: la descarga no pide nada hasta que esto resuelva. `canSkip` es
   * true desde el segundo bloqueo seguido del mismo documento.
   */
  onBlocked(b: {
    reason: BlockReason;
    done: number;
    total: number;
    waitMs: number;
    canSkip: boolean;
  }): Promise<BlockChoice>;
  onWaiting(w: { secondsLeft: number; done: number; total: number }): void;
  shouldStop(): StopRequest;
}

export interface RunnerResult {
  outcome: 'complete' | 'partial' | 'cancelled';
  stats: MevDownloadStats;
}

/** Tramo de la cuenta regresiva durante una espera. */
export const WAIT_TICK_MS = 5_000;
export const MAX_ITEM_RECOVERIES = 4;
export const MAX_RUN_RECOVERIES = 12;

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

/** Bloqueos seguidos sobre el documento o adjunto en curso. */
interface ItemBlocks {
  count: number;
  lastReason: BlockReason;
}

type BlockOutcome = 'retry' | 'skip' | 'stop-save' | 'cancel';

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
  let totalRecoveries = 0;
  let automaticStop = false;

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

  /**
   * Lo que estaba bloqueado cuando llegó la orden de detener desde el aviso. Prueba real del
   * 23/09/2026: el informe decía "no se pidió: la descarga se detuvo antes" también del
   * documento que se pidió siete veces y chocó siete veces con la pantalla, y contaba cero
   * faltantes. Ese queda con el motivo del bloqueo; recién los que siguen, pendientes.
   */
  type Bloqueado = { doc: DocEntry; kind: 'proveido' | 'adjunto'; fileName: string; url: string; item: ItemBlocks };
  const blockedDetail = (item: ItemBlocks) =>
    automaticStop
      ? 'verificación persistente: se agotaron las esperas automáticas; se conserva lo descargado y el resto queda pendiente para reintentar'
      : item.lastReason === 'login'
      ? 'la descarga se detuvo a pedido del usuario con la sesión de la MEV cerrada'
      : `${item.count} ${item.count === 1 ? 'intento' : 'intentos seguidos'} con la pantalla; la descarga se detuvo a pedido del usuario`;

  const finish = (
    order: 'stop-save' | 'cancel',
    fromDoc: number,
    pendingAttachments: PendingAttachment[] = [],
    bloqueado?: Bloqueado
  ): RunnerResult => {
    if (order === 'cancel') {
      stats.missingFileBases = [...missing];
      return { outcome: 'cancelled', stats };
    }
    if (bloqueado) {
      fail(bloqueado.doc, bloqueado.kind, bloqueado.fileName, bloqueado.url, bloqueado.item.lastReason, blockedDetail(bloqueado.item));
    }
    for (const a of pendingAttachments) fail(a.doc, 'adjunto', a.fileName, a.url, 'pendiente', '');
    for (let k = fromDoc; k < docs.length; k++) {
      const doc = docs[k];
      fail(doc, 'proveido', `${doc.fileName}.pdf`, doc.url, 'pendiente', '');
    }
    stats.missingFileBases = [...missing];
    return { outcome: 'partial', stats };
  };

  const skippedDetail = (item: ItemBlocks) =>
    `salteado a pedido del usuario después de ${item.count} bloqueos seguidos`;

  /** Pausa por bloqueo: devuelve 'retry', 'skip' o la orden de detener. */
  const resolveBlock = async (reason: BlockReason, item: ItemBlocks): Promise<BlockOutcome> => {
    let current: BlockReason = reason;
    for (;;) {
      if (current === 'desafio' && (item.count >= MAX_ITEM_RECOVERIES || totalRecoveries >= MAX_RUN_RECOVERIES)) {
        automaticStop = true;
        item.lastReason = current;
        return 'stop-save';
      }
      const canSkip = item.count >= 1;
      item.count += 1;
      item.lastReason = current;
      const waitMs = blockWaitMs(consecutiveBlocks);
      const blockedAt = deps.now();
      const choice = await hooks.onBlocked({ reason: current, done, total, waitMs, canSkip });
      if (choice === 'stop-save' || choice === 'cancel') return choice;
      if (choice === 'skip' && canSkip) return 'skip';
      if (current === 'desafio') {
        totalRecoveries += 1;
        consecutiveBlocks += 1;
        // Lo que el aviso estuvo abierto ya es espera: solo se completa lo que falta.
        let left = Math.max(0, waitMs - (deps.now() - blockedAt));
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
      const stop = hooks.shouldStop();
      if (stop) return stop;
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
    const item: ItemBlocks = { count: 0, lastReason: 'desafio' };
    const esteBloqueado = (): Bloqueado => ({ doc, kind: 'proveido', fileName: `${doc.fileName}.pdf`, url: doc.url, item });

    while (!page && !failure) {
      if (hooks.shouldStop()) return finish(hooks.shouldStop()!, di);
      await deps.pace();
      // Una orden que llegó durante el turno del portero no manda el pedido.
      if (hooks.shouldStop()) return finish(hooks.shouldStop()!, di);
      const got = await deps.fetchProveido(doc.url);
      if (got.status === 'ok') {
        page = { data: got.data };
        consecutiveBlocks = 0;
      } else if (got.status === 'desafio' || got.status === 'login') {
        const next = await resolveBlock(got.status, item);
        if (next === 'skip') failure = { reason: item.lastReason, detail: skippedDetail(item) };
        else if (next !== 'retry') return finish(next, di + 1, [], esteBloqueado());
      } else if (got.status === 'sin-contexto' && !reentered) {
        reentered = true;
        await deps.pace();
        if (hooks.shouldStop()) return finish(hooks.shouldStop()!, di);
        const entry = await deps.enterCase();
        if (entry.status === 'desafio' || entry.status === 'login') {
          const next = await resolveBlock(entry.status, item);
          if (next === 'skip') failure = { reason: item.lastReason, detail: skippedDetail(item) };
          else if (next !== 'retry') return finish(next, di + 1, [], esteBloqueado());
          // El reingreso no llegó a hacerse: después de la espera se vuelve a intentar.
          else reentered = false;
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
      const adjItem: ItemBlocks = { count: 0, lastReason: 'desafio' };
      let attachmentRetried = false;
      for (;;) {
        if (hooks.shouldStop()) return finish(hooks.shouldStop()!, di + 1, restantes());
        const mevHosted = deps.isMevHosted(url);
        if (mevHosted) {
          await deps.pace();
          if (hooks.shouldStop()) return finish(hooks.shouldStop()!, di + 1, restantes());
        }
        const got = await deps.fetchAttachment(url);
        if (got.status === 'ok') {
          try {
            await deps.saveAttachment(fileName, got.base64, got.mimeType);
            stats.adjuntosDownloaded += 1;
          } catch (err) {
            fail(doc, 'adjunto', fileName, url, 'error', err instanceof Error ? err.message : String(err));
          }
          consecutiveBlocks = 0;
          break;
        }
        if (got.status === 'desafio' || got.status === 'login') {
          const next = await resolveBlock(got.status, adjItem);
          if (next === 'skip') {
            fail(doc, 'adjunto', fileName, url, adjItem.lastReason, skippedDetail(adjItem));
            break;
          }
          if (next !== 'retry') {
            return finish(next, di + 1, restantes().slice(1), { doc, kind: 'adjunto', fileName, url, item: adjItem });
          }
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
  // Un "Cancelar sin guardar" durante el último documento también cuenta.
  if (hooks.shouldStop() === 'cancel') return finish('cancel', docs.length);
  stats.missingFileBases = [...missing];
  return { outcome: 'complete', stats };
}
