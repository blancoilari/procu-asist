import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waitForMevDocument } from '../modules/pdf/wait-for-mev-document.ts';

test('espera la verificación y devuelve el documento ya abierto', async () => {
  let now = 0;
  let reads = 0;
  const got = await waitForMevDocument({
    read: async () => ++reads === 3 ? { status: 'ok', data: 'documento' } : { status: 'desafio', detail: 'validando' },
    stopped: () => false, now: () => now, sleep: async ms => { now += ms; }, timeoutMs: 3000,
  });
  assert.deepEqual(got, { status: 'ok', data: 'documento' });
  assert.equal(reads, 3);
  assert.equal(now, 2000);
});

test('página equivocada o verificación persistente no producen un falso documento', async () => {
  let now = 0;
  const got = await waitForMevDocument({
    read: async () => ({ status: 'error', detail: 'otro documento' }), stopped: () => false,
    now: () => now, sleep: async ms => { now += ms; }, timeoutMs: 3000,
  });
  assert.equal(got.status, 'desafio');
  assert.equal(now, 3000);
});

test('cancelar o cerrar la pestaña termina sin nuevas lecturas', async () => {
  let reads = 0;
  for (const stopped of [true, false]) {
    const got = await waitForMevDocument({
      read: async () => { reads++; return null; }, stopped: () => stopped,
      now: () => 0, sleep: async () => { throw new Error('no debe esperar'); }, timeoutMs: 3000,
    });
    assert.equal(got.status, 'desafio');
  }
  assert.equal(reads, 1);
});
