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
const BLOQUEO: PageFetch<Pagina> = { status: 'desafio', detail: 'x' };

/** Orden de detener compartida entre dobles y ganchos. */
function control() {
  return { orden: null as StopRequest };
}

/** Cada dirección responde su guion en orden; la última respuesta se repite. */
function dobles(
  guion: {
    paginas?: Record<string, PageFetch<Pagina>[]>;
    adjuntos?: Record<string, AttachmentFetch[]>;
    fichas?: CaseEntry[];
    fallaGuardar?: string[];
    fallaAdjunto?: string[];
    /** Da la orden de detener en el turno N del portero (1 = el primero). */
    detenerEnTurno?: { turno: number; orden: StopRequest };
    detenerAlGuardar?: { archivo: string; orden: StopRequest };
  } = {},
  ctl = control()
) {
  const llamadas: string[] = [];
  const guardados: string[] = [];
  const esperas: number[] = [];
  let turnos = 0;
  const siguiente = <T>(cola: T[] | undefined, porDefecto: T): T => {
    if (!cola || cola.length === 0) return porDefecto;
    return cola.length > 1 ? cola.shift()! : cola[0];
  };
  const deps: RunnerDeps<Pagina> = {
    pace: async () => {
      turnos += 1;
      llamadas.push('turno');
      if (guion.detenerEnTurno && turnos === guion.detenerEnTurno.turno) ctl.orden = guion.detenerEnTurno.orden;
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
      if (guion.fallaAdjunto?.includes(fileName)) throw new Error('ZIP roto');
      guardados.push(fileName);
      if (guion.detenerAlGuardar?.archivo === fileName) ctl.orden = guion.detenerAlGuardar.orden;
    },
  };
  return { deps, llamadas, guardados, esperas, ctl };
}

function ganchos(
  respuestas: BlockChoice[] = [],
  opciones: {
    detener?: { enAvance: number; orden: StopRequest };
    detenerEnCuenta?: { cuenta: number; orden: StopRequest };
  } = {},
  ctl = control()
) {
  const pausas: Array<{ reason: string; waitMs: number; canSkip: boolean }> = [];
  const cuentas: number[] = [];
  let avances = 0;
  const hooks: RunnerHooks = {
    onProgress: () => {
      avances += 1;
      if (opciones.detener && avances === opciones.detener.enAvance) ctl.orden = opciones.detener.orden;
    },
    onBlocked: async (b) => {
      pausas.push({ reason: b.reason, waitMs: b.waitMs, canSkip: b.canSkip });
      return respuestas.shift() ?? 'cancel';
    },
    onWaiting: (w) => {
      cuentas.push(w.secondsLeft);
      if (opciones.detenerEnCuenta && cuentas.length === opciones.detenerEnCuenta.cuenta) {
        ctl.orden = opciones.detenerEnCuenta.orden;
      }
    },
    shouldStop: () => ctl.orden,
  };
  return { hooks, pausas, cuentas, ctl };
}

test('todo bien: baja los tres en orden, con un turno del portero por proveído', async () => {
  const d = dobles();
  const r = await runMevDownload(movs(), d.deps, ganchos().hooks);
  assert.equal(r.outcome, 'complete');
  assert.deepEqual(d.guardados, ['A.pdf', 'B.pdf', 'C.pdf']);
  assert.equal(d.llamadas.filter((l) => l === 'turno').length, 3);
  assert.equal(r.stats.proveidosDownloaded, 3);
  assert.deepEqual(r.stats.failedItems, []);
});

test('pantalla de verificación: pregunta, espera 30 s en tramos de 5 y reintenta el mismo documento', async () => {
  const d = dobles({ paginas: { [`${MEV}/p2`]: [BLOQUEO, OK] } });
  const g = ganchos(['wait']);
  const r = await runMevDownload(movs(), d.deps, g.hooks);
  assert.equal(r.outcome, 'complete');
  assert.deepEqual(g.pausas, [{ reason: 'desafio', waitMs: 30_000, canSkip: false }]);
  assert.deepEqual(g.cuentas, [30, 25, 20, 15, 10, 5]);
  assert.equal(d.esperas.reduce((a, b) => a + b, 0), 30_000);
  assert.equal(d.llamadas.filter((l) => l === 'proveido /p2').length, 2);
  assert.deepEqual(d.guardados, ['A.pdf', 'B.pdf', 'C.pdf']);
});

test('bloqueos seguidos escalan la espera y un documento bajado la vuelve a 30 s', async () => {
  const d = dobles({ paginas: { [`${MEV}/p2`]: [BLOQUEO, BLOQUEO, OK], [`${MEV}/p3`]: [BLOQUEO, OK] } });
  const g = ganchos(['wait', 'wait', 'wait']);
  const r = await runMevDownload(movs(), d.deps, g.hooks);
  assert.equal(r.outcome, 'complete');
  assert.deepEqual(g.pausas.map((p) => p.waitMs), [30_000, 60_000, 30_000]);
});

test('saltear se ofrece desde el segundo bloqueo seguido del mismo documento y lo anota como faltante', async () => {
  const d = dobles({ paginas: { [`${MEV}/p2`]: [BLOQUEO] } });
  const g = ganchos(['wait', 'skip']);
  const r = await runMevDownload(movs(), d.deps, g.hooks);
  assert.equal(r.outcome, 'complete');
  assert.deepEqual(g.pausas.map((p) => p.canSkip), [false, true]);
  assert.deepEqual(d.guardados, ['A.pdf', 'C.pdf']);
  assert.equal(r.stats.failedItems[0].reason, 'desafio');
  assert.match(r.stats.failedItems[0].detail, /salteado a pedido/);
  assert.deepEqual(r.stats.missingFileBases, ['B']);
});

test('detener y guardar en una pausa: entrega lo bajado y anota lo pendiente', async () => {
  const d = dobles({ paginas: { [`${MEV}/p2`]: [BLOQUEO] } });
  const r = await runMevDownload(movs(), d.deps, ganchos(['stop-save']).hooks);
  assert.equal(r.outcome, 'partial');
  assert.deepEqual(d.guardados, ['A.pdf']);
  assert.equal(r.stats.pending, 2);
  assert.deepEqual(r.stats.missingFileBases, ['B', 'C']);
  assert.deepEqual(r.stats.failedItems.map((f) => f.reason), ['pendiente', 'pendiente']);
});

test('cancelar en una pausa: no entrega nada', async () => {
  const d = dobles({ paginas: { [`${MEV}/p2`]: [BLOQUEO] } });
  const r = await runMevDownload(movs(), d.deps, ganchos(['cancel']).hooks);
  assert.equal(r.outcome, 'cancelled');
});

test('detener durante la cuenta regresiva: no vuelve a pedir y entrega lo bajado', async () => {
  const ctl = control();
  const d = dobles({ paginas: { [`${MEV}/p2`]: [BLOQUEO, OK] } }, ctl);
  const g = ganchos(['wait'], { detenerEnCuenta: { cuenta: 2, orden: 'stop-save' } }, ctl);
  const r = await runMevDownload(movs(), d.deps, g.hooks);
  assert.equal(r.outcome, 'partial');
  assert.equal(d.llamadas.filter((l) => l === 'proveido /p2').length, 1);
  assert.deepEqual(r.stats.missingFileBases, ['B', 'C']);
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

test('un bloqueo al reingresar a la ficha no pierde el documento: después de la espera vuelve a reingresar', async () => {
  const sinContexto: PageFetch<Pagina> = { status: 'sin-contexto', detail: 'b' };
  const d = dobles({
    paginas: { [`${MEV}/p2`]: [sinContexto, sinContexto, OK] },
    fichas: [{ status: 'desafio', detail: 'x' }, { status: 'ok', detail: '' }],
  });
  const g = ganchos(['wait']);
  const r = await runMevDownload(movs(), d.deps, g.hooks);
  assert.equal(r.outcome, 'complete');
  assert.equal(d.llamadas.filter((l) => l === 'ficha').length, 2);
  assert.deepEqual(d.guardados, ['A.pdf', 'B.pdf', 'C.pdf']);
  assert.deepEqual(r.stats.failedItems, []);
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

test('sesión cerrada y el reingreso choca con la verificación: pregunta de nuevo, espera y sigue', async () => {
  const d = dobles({
    paginas: { [`${MEV}/p2`]: [{ status: 'login', detail: 'l' }, OK] },
    fichas: [{ status: 'desafio', detail: 'x' }, { status: 'ok', detail: '' }],
  });
  const g = ganchos(['continue', 'wait']);
  const r = await runMevDownload(movs(), d.deps, g.hooks);
  assert.equal(r.outcome, 'complete');
  assert.deepEqual(g.pausas.map((p) => p.reason), ['login', 'desafio']);
  assert.deepEqual(d.guardados, ['A.pdf', 'B.pdf', 'C.pdf']);
});

test('detener desde la barra entre documentos: entrega lo bajado', async () => {
  const d = dobles();
  const g = ganchos([], { detener: { enAvance: 2, orden: 'stop-save' } });
  const r = await runMevDownload(movs(), d.deps, g.hooks);
  assert.equal(r.outcome, 'partial');
  assert.deepEqual(d.guardados, ['A.pdf']);
  assert.deepEqual(r.stats.missingFileBases, ['B', 'C']);
});

test('una orden de detener que llega durante el turno del portero no manda el pedido', async () => {
  const ctl = control();
  const d = dobles({ detenerEnTurno: { turno: 2, orden: 'stop-save' } }, ctl);
  const r = await runMevDownload(movs(), d.deps, ganchos([], {}, ctl).hooks);
  assert.equal(r.outcome, 'partial');
  assert.deepEqual(d.llamadas.filter((l) => l.startsWith('proveido')), ['proveido /p1']);
  assert.deepEqual(r.stats.missingFileBases, ['B', 'C']);
});

test('cancelar durante el último documento no entrega el archivo', async () => {
  const d = dobles();
  const g = ganchos([], { detener: { enAvance: 4, orden: 'cancel' } });
  const r = await runMevDownload(movs(), d.deps, g.hooks);
  assert.equal(r.outcome, 'cancelled');
});

test('detener a mitad de los adjuntos: lo que falta del paso queda pendiente y el paso se vuelve a pedir', async () => {
  const ctl = control();
  const conAdjuntos: PageFetch<Pagina> = { status: 'ok', data: { adjuntos: [`${DOCS}/a1`, `${DOCS}/a2`, `${DOCS}/a3`] } };
  const d = dobles(
    { paginas: { [`${MEV}/p1`]: [conAdjuntos] }, detenerAlGuardar: { archivo: 'A_adjunto_1', orden: 'stop-save' } },
    ctl
  );
  const r = await runMevDownload(movs(), d.deps, ganchos([], {}, ctl).hooks);
  assert.equal(r.outcome, 'partial');
  assert.deepEqual(d.guardados, ['A.pdf', 'A_adjunto_1']);
  assert.deepEqual(
    r.stats.failedItems.map((f) => `${f.kind}:${f.fileName}`),
    ['adjunto:A_adjunto_2', 'adjunto:A_adjunto_3', 'proveido:B.pdf', 'proveido:C.pdf']
  );
  assert.deepEqual(r.stats.missingFileBases, ['A', 'B', 'C']);
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

test('un adjunto con error se reintenta una vez si es de la MEV y ninguna si es de docs.scba', async () => {
  const conAdjuntos: PageFetch<Pagina> = { status: 'ok', data: { adjuntos: [`${DOCS}/a1`, `${MEV}/a2`] } };
  const d = dobles({
    paginas: { [`${MEV}/p1`]: [conAdjuntos] },
    adjuntos: {
      [`${DOCS}/a1`]: [{ status: 'error', detail: 'HTTP 500' }],
      [`${MEV}/a2`]: [{ status: 'error', detail: 'HTTP 500' }, { status: 'ok', base64: 'QQ==', mimeType: 'application/pdf' }],
    },
  });
  const r = await runMevDownload(movs(), d.deps, ganchos().hooks);
  assert.equal(d.llamadas.filter((l) => l === `adjunto ${DOCS}/a1`).length, 1);
  assert.equal(d.llamadas.filter((l) => l === `adjunto ${MEV}/a2`).length, 2);
  assert.equal(r.stats.adjuntosFailed, 1);
  assert.equal(r.stats.adjuntosDownloaded, 1);
});

test('si falla el PDF de un proveído, queda anotado y sus adjuntos se bajan igual', async () => {
  const conAdjunto: PageFetch<Pagina> = { status: 'ok', data: { adjuntos: [`${DOCS}/b1`] } };
  const d = dobles({ paginas: { [`${MEV}/p2`]: [conAdjunto] }, fallaGuardar: ['B'] });
  const r = await runMevDownload(movs(), d.deps, ganchos().hooks);
  assert.equal(r.stats.failedItems[0].reason, 'error');
  assert.equal(r.stats.failedItems[0].detail, 'PDF roto');
  assert.deepEqual(d.guardados, ['A.pdf', 'B_adjunto_1', 'C.pdf']);
});

test('si falla guardar un adjunto, queda anotado y la descarga sigue', async () => {
  const conAdjunto: PageFetch<Pagina> = { status: 'ok', data: { adjuntos: [`${DOCS}/b1`] } };
  const d = dobles({ paginas: { [`${MEV}/p2`]: [conAdjunto] }, fallaAdjunto: ['B_adjunto_1'] });
  const r = await runMevDownload(movs(), d.deps, ganchos().hooks);
  assert.equal(r.outcome, 'complete');
  assert.equal(r.stats.adjuntosFailed, 1);
  assert.equal(r.stats.failedItems[0].detail, 'ZIP roto');
  assert.deepEqual(d.guardados, ['A.pdf', 'B.pdf', 'C.pdf']);
});
