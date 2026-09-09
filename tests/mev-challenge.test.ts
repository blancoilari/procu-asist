/**
 * Tests de la detección del desafío de la MEV.
 *
 * Se corren con el runner de node (node --test), sin dependencias nuevas:
 *   npm test
 *
 * Viven fuera de modules/ a propósito: el tsconfig del proyecto solo declara
 * los tipos de chrome, así que un import de "node:test" adentro de modules/
 * rompería "npm run compile".
 *
 * Los HTML de muestra son inventados. Ningún dato de una causa real entra acá.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  detectMevChallenge,
  findChallengeMarker,
  htmlLooksLikeChallenge,
  messageForVerdict,
  normalizeForMarkers,
  MEV_CHALLENGE_MESSAGE,
  MEV_UNEXPECTED_PAGE_MESSAGE,
} from '../modules/portals/mev-challenge.ts';

const paginaLarga = 'x'.repeat(20000);

test('normaliza tildes, mayúsculas y espacios', () => {
  assert.equal(
    normalizeForMarkers('  Validando   ACCESO\n al  sitio  '),
    ' validando acceso al sitio '
  );
  assert.equal(normalizeForMarkers('está'), 'esta');
});

test('encuentra la frase de la pantalla de verificación', () => {
  assert.equal(
    findChallengeMarker('Validando acceso a mev.scba.gov.ar'),
    'validando acceso'
  );
  assert.equal(
    findChallengeMarker(
      'Estamos verificando si está siendo navegado por un ser humano.'
    ),
    'navegado por un ser humano'
  );
  assert.equal(findChallengeMarker('Texto del proveído: se provee.'), null);
});

test('la pantalla de verificación se detecta como desafío', () => {
  const veredicto = detectMevChallenge({
    htmlLength: 900,
    bodyTextSample:
      'Validando acceso. El sitio está verificando si está siendo navegado por un ser humano.',
    hasProveidoStructure: false,
  });
  assert.equal(veredicto.status, 'desafio');
  assert.equal(veredicto.marker, 'validando acceso');
  assert.equal(messageForVerdict(veredicto), MEV_CHALLENGE_MESSAGE);
});

test('una página con estructura de proveído nunca se marca, aunque diga "ser humano"', () => {
  // Red de seguridad: un proveído puede hablar de "un ser humano" en su texto.
  const veredicto = detectMevChallenge({
    htmlLength: 18000,
    bodyTextSample:
      'Carátula: PEREZ (ficticio) c/ DEMANDADA. El derecho de todo ser humano a ser oído.',
    hasProveidoStructure: true,
  });
  assert.equal(veredicto.status, 'ok');
});

test('una página chica y sin estructura se trata como desafío', () => {
  const veredicto = detectMevChallenge({
    htmlLength: 300,
    bodyTextSample: 'Un momento por favor',
    hasProveidoStructure: false,
  });
  assert.equal(veredicto.status, 'desafio');
  assert.equal(veredicto.marker, 'respuesta-demasiado-corta');
});

test('una página grande, sin estructura y sin frase conocida es respuesta inesperada', () => {
  const veredicto = detectMevChallenge({
    htmlLength: 40000,
    bodyTextSample: 'Mesa de Entradas Virtual. Menú principal del portal.',
    hasProveidoStructure: false,
  });
  assert.equal(veredicto.status, 'respuesta-inesperada');
  assert.equal(messageForVerdict(veredicto), MEV_UNEXPECTED_PAGE_MESSAGE);
});

test('htmlLooksLikeChallenge solo dispara con frase explícita', () => {
  assert.equal(
    htmlLooksLikeChallenge(
      '<html><body><h1>Validando acceso</h1>' + paginaLarga + '</body></html>'
    ),
    true
  );
  assert.equal(
    htmlLooksLikeChallenge('<html><body>' + paginaLarga + '</body></html>'),
    false
  );
  // Sin la sonda estructural no decide por tamaño: una respuesta corta y sin
  // frase conocida no alcanza para acusar verificación.
  assert.equal(htmlLooksLikeChallenge('<html></html>'), false);
});
