import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textoMevValidado } from '../modules/pdf/mev-text.ts';

test('ausencia declarada se representa sin copiar el menú del portal', () => {
  assert.equal(textoMevValidado('', true), 'Texto del Proveído inexistente en la MEV.');
});
test('una estructura válida sin texto ni aviso no se da por descargada', () => {
  assert.equal(textoMevValidado('  ', false), null);
});
test('un documento que menciona la inexistencia de otro conserva su propio texto', () => {
  assert.equal(textoMevValidado('Contenido del despacho', true), 'Contenido del despacho');
});
