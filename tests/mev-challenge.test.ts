/**
 * Tests de la clasificación de respuestas de la MEV.
 *
 * Se corren con el runner de node (node --test), sin dependencias nuevas:
 *   npm test
 *
 * La pantalla de verificación de muestra es SINTÉTICA: reproduce la
 * estructura medida el 22/09/2026 (título "Validando acceso...", script de
 * Turnstile, cuerpo sin texto visible, 2.000 bytes), no el HTML del portal.
 * Ningún dato de una causa real entra acá.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyMevPage,
  describeProbe,
  findChallengeMarker,
  htmlLooksLikeChallenge,
  htmlLooksLikeLogin,
  isChallengeTitle,
  normalizeForMarkers,
  type MevPageProbe,
} from '../modules/portals/mev-challenge.ts';

const PANTALLA_SINTETICA = (() => {
  const base = [
    '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">',
    '<title>Validando acceso...</title>',
    '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>',
    '<script>document.addEventListener("DOMContentLoaded", function () { /* arma el texto */ });</script>',
    '</head><body><div id="caja"></div>',
    '<script>function listo(t) { fetch("/verificar", { method: "POST", body: t }).then(function () { location.reload(); }); }</script>',
    '</body></html>',
  ].join('');
  return base + '<!--' + 'x'.repeat(2000 - base.length - 7) + '-->';
})();

const sonda = (extra: Partial<MevPageProbe>): MevPageProbe => ({
  htmlLength: 40000,
  bodyTextSample: '',
  hasProveidoStructure: false,
  ...extra,
});

test('la pantalla sintética mide 2.000 caracteres', () => {
  assert.equal(PANTALLA_SINTETICA.length, 2000);
});

test('normaliza tildes, mayúsculas y espacios', () => {
  assert.equal(normalizeForMarkers('  Validando   ACCESO\n al  sitio  '), ' validando acceso al sitio ');
  assert.equal(normalizeForMarkers('está'), 'esta');
});

test('encuentra las frases de la verificación', () => {
  assert.equal(findChallengeMarker('Validando acceso a la MEV'), 'validando acceso');
  assert.equal(findChallengeMarker('verificando si está siendo navegado por un ser humano'), 'navegado por un ser humano');
  assert.equal(findChallengeMarker('Texto del proveído: se provee.'), null);
});

test('el título de la pantalla alcanza para reconocerla, con o sin puntos suspensivos', () => {
  assert.equal(isChallengeTitle('Validando acceso...'), true);
  assert.equal(isChallengeTitle('  VALIDANDO ACCESO '), true);
  assert.equal(isChallengeTitle('Mesa de Entradas Virtual'), false);
  assert.equal(isChallengeTitle(undefined), false);
});

test('la pantalla real: título, Turnstile y cuerpo vacío es desafío', () => {
  const v = classifyMevPage(sonda({ htmlLength: 2000, title: 'Validando acceso...', hasTurnstile: true, finalPath: '/proveido.asp' }));
  assert.equal(v.status, 'desafio');
  assert.equal(v.marker, 'titulo');
});

test('con el texto visible vacío, la frase en el HTML crudo también la reconoce', () => {
  const v = classifyMevPage(sonda({ htmlLength: 2000, rawHtmlSample: PANTALLA_SINTETICA }));
  assert.equal(v.status, 'desafio');
});

test('regla de oro: una página con estructura de proveído nunca es desafío', () => {
  const v = classifyMevPage(
    sonda({ hasProveidoStructure: true, title: 'Validando acceso', bodyTextSample: 'el derecho de todo ser humano a ser oído' })
  );
  assert.equal(v.status, 'ok');
});

test('el formulario de login es sesión cerrada, no desafío', () => {
  const v = classifyMevPage(sonda({ htmlLength: 12000, title: 'Mesa de Entradas Virtual', looksLikeLogin: true, finalPath: '/loguin.asp' }));
  assert.equal(v.status, 'login');
});

test('la búsqueda en vez del proveído es sesión sin la causa', () => {
  const v = classifyMevPage(sonda({ htmlLength: 17000, title: 'Mesa de Entradas Virtual', finalPath: '/busqueda.asp' }));
  assert.equal(v.status, 'sin-contexto');
});

test('Turnstile sin título conocido cuenta como desafío', () => {
  assert.equal(classifyMevPage(sonda({ hasTurnstile: true, finalPath: '/otra.asp' })).status, 'desafio');
});

test('una página chica y sin estructura se trata como desafío', () => {
  const v = classifyMevPage(sonda({ htmlLength: 300, bodyTextSample: 'Un momento por favor' }));
  assert.equal(v.status, 'desafio');
  assert.equal(v.marker, 'respuesta-demasiado-corta');
});

test('una página grande y desconocida es respuesta inesperada', () => {
  const v = classifyMevPage(sonda({ bodyTextSample: 'Menú principal', finalPath: '/otra.asp', title: 'Mesa de Entradas Virtual' }));
  assert.equal(v.status, 'respuesta-inesperada');
});

test('describeProbe dice qué devolvió la MEV', () => {
  assert.equal(
    describeProbe(sonda({ htmlLength: 17000, title: 'Mesa de Entradas Virtual', finalPath: '/busqueda.asp' })),
    'página /busqueda.asp, título "Mesa de Entradas Virtual", 17000 caracteres'
  );
});

test('htmlLooksLikeChallenge sobre HTML crudo: título, Turnstile o frase; nunca por tamaño', () => {
  assert.equal(htmlLooksLikeChallenge(PANTALLA_SINTETICA), true);
  assert.equal(htmlLooksLikeChallenge('<html><head><title>Validando acceso</title></head><body></body></html>'), true);
  assert.equal(htmlLooksLikeChallenge('<html><body><h1>Mesa de Entradas Virtual</h1>' + 'x'.repeat(20000) + '</body></html>'), false);
  assert.equal(htmlLooksLikeChallenge('<html></html>'), false);
});

test('htmlLooksLikeLogin reconoce el formulario de usuario y clave', () => {
  assert.equal(htmlLooksLikeLogin('<p>Ingrese los datos del Usuario</p>'), true);
  assert.equal(htmlLooksLikeLogin('<input name="usuario"><input name="clave" type="password">'), true);
  assert.equal(htmlLooksLikeLogin(PANTALLA_SINTETICA), false);
});
