/**
 * Tests del recorrido de la descarga MEV con dobles: sin red, sin chrome y
 * sin PDF. Direcciones y movimientos inventados.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  runMevDownload,
  type AttachmentFetch,
  type BlockChoice,
  type CaseEntry,
  type PageFetch,
  type RunnerDeps,
  type RunnerHooks,
  type RunnerMovement,
  type StopRequest,
} from '../modules/pdf/mev-download-runner.ts';

type Pagina = { adjuntos: string[] };

const MEV = 'https://mev.scba.gov.ar';
const DOCS = 'https://docs.scba.gov.ar';

const movs = (): RunnerMovement[] => [
  { date: '01/02/2026', fojas: '1', description: 'A', documentUrls: [`${MEV}/p1`], fileBase: 'A' },
  { date: '02/02/2026', fojas: '2', description: 'B', documentUrls: [`${MEV}/p2`], fileBase: 'B' },
  { date: '03/02/2026', fojas: '3', description: 'C', documentUrls: [`${MEV}/p3`], fileBase: 'C' },
];

const OK: PageFetch<Pagina> = { status: 'ok', data: { adjuntos: [] } };

/** Cada dirección responde su guion en orden; la última respuesta se repite. */
function dobles(guion: {
  paginas?: Record<string, PageFetch<Pagina>[]>;
  adjuntos?: Record<string, AttachmentFetch[]>;
  fichas?: CaseEntry[];
  fallaGuardar?: string[];
} = {}) {
  const llamadas: string[] = [];
  const guardados: string[] = [];
  const esperas: number[] = [];
  const siguiente = <T>(cola: T[] | undefined, porDefecto: T): T => {
    if (!cola || cola.length === 0) return porDefecto;
    return cola.length > 1 ? cola.shift()! : cola[0];
  };
  const deps: RunnerDeps<Pagina> = {
    pace: async () => {
      llamadas.push('turno');
    },
    sleep: async (ms) => {
      esperas.push(ms);
    },
    fetchProveido: async (url) => {
      llamadas.push(`proveido ${url.replace(MEV, '')}`);
      return siguiente(guion.paginas?.[url], OK);
    },
    enterCase: async () => {
      llamadas.push('ficha');
      return siguiente(guion.fichas, { status: 'ok', detail: '' });
    },
    isMevHosted: (url) => url.startsWith(MEV),
    fetchAttachment: async (url) => {
      llamadas.push(`adjunto ${url}`);
      return siguiente(guion.adjuntos?.[url], { status: 'ok', base64: 'QQ==', mimeType: 'application/pdf' });
    },
    adjuntoUrls: (pagina) => pagina.adjuntos,
    saveProveido: async (fileName) => {
      if (guion.fallaGuardar?.includes(fileName)) throw new Error('PDF roto');
      guardados.push(`${fileName}.pdf`);
    },
    saveAttachment: async (fileName) => {
      guardados.push(fileName);
    },
  };
  return { deps, llamadas, guardados, esperas };
}

function ganchos(respuestas: BlockChoice[] = [], detener?: { enAvance: number; orden: StopRequest }) {
  const pausas: Array<{ reason: string; waitMs: number }> = [];
  const cuentas: number[] = [];
  let avances = 0;
  let orden: StopRequest = null;
  const hooks: RunnerHooks = {
    onProgress: () => {
      avances += 1;
      if (detener && avances === detener.enAvance) orden = detener.orden;
    },
    onBlocked: async (b) => {
      pausas.push({ reason: b.reason, waitMs: b.waitMs });
      return respuestas.shift() ?? 'cancel';
    },
    onWaiting: (w) => {
      cuentas.push(w.secondsLeft);
    },
    shouldStop: () => orden,
  };
  return { hooks, pausas, cuentas };
}

test('todo bien: baja los tres en orden, con un turno del portero por proveído', async () => {
  const d = dobles();
  const g = ganchos();
  const r = await runMevDownload(movs(), d.deps, g.hooks);
  assert.equal(r.outcome, 'complete');
  assert.deepEqual(d.guardados, ['A.pdf', 'B.pdf', 'C.pdf']);
  assert.equal(d.llamadas.filter((l) => l === 'turno').length, 3);
  assert.equal(r.stats.proveidosDownloaded, 3);
  assert.deepEqual(r.stats.failedItems, []);
});

test('pantalla de verificación: pregunta, espera 30 s en tramos de 5 y reintenta el mismo documento', async () => {
  const d = dobles({ paginas: { [`${MEV}/p2`]: [{ status: 'desafio', detail: 'x' }, OK] } });
  const g = ganchos(['wait']);
  const r = await runMevDownload(movs(), d.deps, g.hooks);
  assert.equal(r.outcome, 'complete');
  assert.deepEqual(g.pausas, [{ reason: 'desafio', waitMs: 30_000 }]);
  assert.deepEqual(g.cuentas, [30, 25, 20, 15, 10, 5]);
  assert.equal(d.esperas.reduce((a, b) => a + b, 0), 30_000);
  assert.equal(d.llamadas.filter((l) => l === 'proveido /p2').length, 2);
  assert.deepEqual(d.guardados, ['A.pdf', 'B.pdf', 'C.pdf']);
});

test('bloqueos seguidos escalan la espera y un documento bajado la vuelve a 30 s', async () => {
  const bloqueo: PageFetch<Pagina> = { status: 'desafio', detail: 'x' };
  const d = dobles({
    paginas: { [`${MEV}/p2`]: [bloqueo, bloqueo, OK], [`${MEV}/p3`]: [bloqueo, OK] },
  });
  const g = ganchos(['wait', 'wait', 'wait']);
  const r = await runMevDownload(movs(), d.deps, g.hooks);
  assert.equal(r.outcome, 'complete');
  assert.deepEqual(g.pausas.map((p) => p.waitMs), [30_000, 60_000, 30_000]);
});

test('detener y guardar en una pausa: entrega lo bajado y anota lo pendiente', async () => {
  const d = dobles({ paginas: { [`${MEV}/p2`]: [{ status: 'desafio', detail: 'x' }] } });
  const g = ganchos(['stop-save']);
  const r = await runMevDownload(movs(), d.deps, g.hooks);
  assert.equal(r.outcome, 'partial');
  assert.deepEqual(d.guardados, ['A.pdf']);
  assert.equal(r.stats.pending, 2);
  assert.deepEqual(r.stats.missingFileBases, ['B', 'C']);
  assert.deepEqual(r.stats.failedItems.map((f) => f.reason), ['pendiente', 'pendiente']);
});

test('cancelar en una pausa: no entrega nada', async () => {
  const d = dobles({ paginas: { [`${MEV}/p2`]: [{ status: 'desafio', detail: 'x' }] } });
  const r = await runMevDownload(movs(), d.deps, ganchos(['cancel']).hooks);
  assert.equal(r.outcome, 'cancelled');
});

test('la búsqueda en vez del proveído: reingresa a la ficha una vez y reintenta', async () => {
  const d = dobles({ paginas: { [`${MEV}/p2`]: [{ status: 'sin-contexto', detail: 'b' }, OK] } });
  const r = await runMevDownload(movs(), d.deps, ganchos().hooks);
  assert.equal(r.outcome, 'complete');
  assert.equal(d.llamadas.filter((l) => l === 'ficha').length, 1);
  assert.deepEqual(d.guardados, ['A.pdf', 'B.pdf', 'C.pdf']);
});

test('la búsqueda dos veces: queda como faltante y la descarga sigue', async () => {
  const d = dobles({ paginas: { [`${MEV}/p2`]: [{ status: 'sin-contexto', detail: 'página /busqueda.asp' }] } });
  const r = await runMevDownload(movs(), d.deps, ganchos().hooks);
  assert.equal(r.outcome, 'complete');
  assert.equal(d.llamadas.filter((l) => l === 'ficha').length, 1);
  assert.deepEqual(d.guardados, ['A.pdf', 'C.pdf']);
  assert.equal(r.stats.failedItems[0].reason, 'sin-contexto');
  assert.equal(r.stats.failedItems[0].detail, 'página /busqueda.asp');
  assert.deepEqual(r.stats.missingFileBases, ['B']);
});

test('otra página: reintenta una vez y después la anota con lo que devolvió', async () => {
  const d = dobles({ paginas: { [`${MEV}/p2`]: [{ status: 'respuesta-inesperada', detail: 'página /x.asp' }] } });
  const r = await runMevDownload(movs(), d.deps, ganchos().hooks);
  assert.equal(d.llamadas.filter((l) => l === 'proveido /p2').length, 2);
  assert.equal(r.stats.proveidosFailed, 1);
  assert.equal(r.stats.failedItems[0].detail, 'página /x.asp');
  assert.deepEqual(d.guardados, ['A.pdf', 'C.pdf']);
});

test('sesión cerrada: pregunta, reingresa a la ficha y reintenta', async () => {
  const d = dobles({ paginas: { [`${MEV}/p2`]: [{ status: 'login', detail: 'l' }, OK] } });
  const g = ganchos(['continue']);
  const r = await runMevDownload(movs(), d.deps, g.hooks);
  assert.equal(r.outcome, 'complete');
  assert.deepEqual(g.pausas.map((p) => p.reason), ['login']);
  assert.equal(d.llamadas.filter((l) => l === 'ficha').length, 1);
  assert.deepEqual(d.guardados, ['A.pdf', 'B.pdf', 'C.pdf']);
});

test('detener desde la barra entre documentos: entrega lo bajado', async () => {
  const d = dobles();
  const g = ganchos([], { enAvance: 2, orden: 'stop-save' });
  const r = await runMevDownload(movs(), d.deps, g.hooks);
  assert.equal(r.outcome, 'partial');
  assert.deepEqual(d.guardados, ['A.pdf']);
  assert.deepEqual(r.stats.missingFileBases, ['B', 'C']);
});

test('adjuntos: los de la MEV pasan por el portero y ante la verificación se reintentan; los de docs.scba no', async () => {
  const conAdjuntos: PageFetch<Pagina> = { status: 'ok', data: { adjuntos: [`${DOCS}/a1`, `${MEV}/a2`] } };
  const d = dobles({
    paginas: { [`${MEV}/p1`]: [conAdjuntos] },
    adjuntos: { [`${MEV}/a2`]: [{ status: 'desafio', detail: 'x' }, { status: 'ok', base64: 'QQ==', mimeType: 'application/pdf' }] },
  });
  const g = ganchos(['wait']);
  const r = await runMevDownload(movs(), d.deps, g.hooks);
  assert.equal(r.outcome, 'complete');
  assert.deepEqual(d.guardados, ['A.pdf', 'A_adjunto_1', 'A_adjunto_2', 'B.pdf', 'C.pdf']);
  assert.equal(d.llamadas.filter((l) => l === 'turno').length, 5);
  assert.equal(r.stats.adjuntosDownloaded, 2);
});

test('si falla el PDF de un proveído, queda anotado y sus adjuntos se bajan igual', async () => {
  const conAdjunto: PageFetch<Pagina> = { status: 'ok', data: { adjuntos: [`${DOCS}/b1`] } };
  const d = dobles({ paginas: { [`${MEV}/p2`]: [conAdjunto] }, fallaGuardar: ['B'] });
  const r = await runMevDownload(movs(), d.deps, ganchos().hooks);
  assert.equal(r.stats.failedItems[0].reason, 'error');
  assert.equal(r.stats.failedItems[0].detail, 'PDF roto');
  assert.deepEqual(d.guardados, ['A.pdf', 'B_adjunto_1', 'C.pdf']);
});
