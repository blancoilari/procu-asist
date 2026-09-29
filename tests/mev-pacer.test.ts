/**
 * Tests del portero de pedidos a la MEV. Reloj simulado: la espera avanza
 * el tiempo al instante, sin dormir de verdad.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  blockWaitMs,
  createMevPacer,
  MEV_MAX_REQUESTS_PER_MINUTE,
  MEV_MIN_INTERVAL_MS,
  type PacerClock,
} from '../modules/portals/mev-pacer.ts';

function relojSimulado(): PacerClock & { t: number; esperas: number[] } {
  const reloj = {
    t: 0,
    esperas: [] as number[],
    now: () => reloj.t,
    sleep: async (ms: number) => {
      reloj.esperas.push(ms);
      reloj.t += ms;
    },
  };
  return reloj;
}

test('10 pedidos por minuto: un inicio cada 6000 ms', () => {
  assert.equal(MEV_MAX_REQUESTS_PER_MINUTE, 10);
  assert.equal(MEV_MIN_INTERVAL_MS, 6000);
});

test('el primer pedido sale sin esperar y los siguientes se espacian', async () => {
  const reloj = relojSimulado();
  const portero = createMevPacer(reloj);
  const inicios: number[] = [];
  for (let i = 0; i < 3; i++) {
    await portero.wait();
    inicios.push(reloj.t);
  }
  assert.deepEqual(inicios, [0, 6000, 12000]);
});

test('si ya pasó el intervalo, no espera', async () => {
  const reloj = relojSimulado();
  const portero = createMevPacer(reloj);
  await portero.wait();
  reloj.t += 7000;
  await portero.wait();
  assert.deepEqual(reloj.esperas, []);
});

test('espera solo lo que falta del intervalo', async () => {
  const reloj = relojSimulado();
  const portero = createMevPacer(reloj);
  await portero.wait();
  reloj.t += 1000;
  await portero.wait();
  assert.deepEqual(reloj.esperas, [5000]);
});

test('los llamados concurrentes hacen fila: nunca salen dos juntos', async () => {
  const reloj = relojSimulado();
  const portero = createMevPacer(reloj);
  const inicios: number[] = [];
  await Promise.all(
    [0, 1, 2].map(async () => {
      await portero.wait();
      inicios.push(reloj.t);
    })
  );
  assert.deepEqual(inicios, [0, 6000, 12000]);
});

test('escalera de esperas ante un bloqueo: 30 s, 1, 2 y 4 min, y la última se repite', () => {
  assert.deepEqual(
    [0, 1, 2, 3, 4, 9].map(blockWaitMs),
    [30_000, 60_000, 120_000, 240_000, 240_000, 240_000]
  );
  assert.equal(blockWaitMs(-1), 30_000);
});
