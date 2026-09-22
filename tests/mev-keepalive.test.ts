/**
 * Tests del mantener sesión frente a la verificación de la MEV.
 *
 * Se corren con el runner de node (node --test), sin dependencias nuevas:
 *   npm test
 *
 * La pantalla de verificación es SINTÉTICA (misma estructura que la de
 * tests/mev-challenge.test.ts); ningún dato de una causa real entra acá.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MEV_KEEPALIVE_BACKOFF_MS,
  heartbeatLooksLikeChallenge,
  shouldSkipMevKeepAlive,
} from '../modules/portals/mev-keepalive.ts';

const MIN = 60_000;
const AHORA = Date.UTC(2026, 8, 22, 23, 30);

const PANTALLA_SINTETICA =
  '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">' +
  '<title>Validando acceso...</title>' +
  '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>' +
  '</head><body><div id="x"></div></body></html>';

const BUSQUEDA_SINTETICA =
  '<html><head><title>Mesa de Entradas Virtual</title></head><body>' +
  '<form id="form1" action="Busqueda.asp"><input name="NCausa"><select name="Set"></select></form>' +
  '</body></html>';

test('el lapso de suspensión es de 30 minutos', () => {
  assert.equal(MEV_KEEPALIVE_BACKOFF_MS, 30 * MIN);
});

test('sin ninguna pantalla vista, el mantener sesión pide como siempre', () => {
  assert.equal(shouldSkipMevKeepAlive(undefined, AHORA), false);
});

test('con la pantalla vista hace 5 minutos, no pide', () => {
  assert.equal(shouldSkipMevKeepAlive(AHORA - 5 * MIN, AHORA), true);
});

test('justo antes de cumplirse el lapso sigue sin pedir; al cumplirse vuelve a pedir', () => {
  assert.equal(shouldSkipMevKeepAlive(AHORA - 30 * MIN + 1, AHORA), true);
  assert.equal(shouldSkipMevKeepAlive(AHORA - 30 * MIN, AHORA), false);
  assert.equal(shouldSkipMevKeepAlive(AHORA - 2 * 60 * MIN, AHORA), false);
});

test('una marca del futuro (reloj corrido) no suspende para siempre', () => {
  assert.equal(shouldSkipMevKeepAlive(AHORA + 10 * MIN, AHORA), false);
});

test('una marca que no es un número no suspende', () => {
  assert.equal(shouldSkipMevKeepAlive(Number.NaN, AHORA), false);
  assert.equal(shouldSkipMevKeepAlive('ayer' as unknown as number, AHORA), false);
});

test('el lapso se puede pasar explícito', () => {
  assert.equal(shouldSkipMevKeepAlive(AHORA - 2 * MIN, AHORA, MIN), false);
  assert.equal(shouldSkipMevKeepAlive(AHORA - 30_000, AHORA, MIN), true);
});

test('la pantalla de verificación con HTTP 200 se reconoce', () => {
  assert.equal(heartbeatLooksLikeChallenge({ status: 200, sample: PANTALLA_SINTETICA }), true);
});

test('HTTP 429 y 503 cuentan como verificación aunque el cuerpo no diga nada', () => {
  assert.equal(heartbeatLooksLikeChallenge({ status: 429, sample: '' }), true);
  assert.equal(heartbeatLooksLikeChallenge({ status: 503, sample: '' }), true);
});

test('la página de búsqueda normal no es verificación', () => {
  assert.equal(heartbeatLooksLikeChallenge({ status: 200, sample: BUSQUEDA_SINTETICA }), false);
});

test('sin respuesta (pestaña cerrada, red caída) no se anota nada', () => {
  assert.equal(heartbeatLooksLikeChallenge(null), false);
  assert.equal(heartbeatLooksLikeChallenge(undefined), false);
});
