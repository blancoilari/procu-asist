/**
 * Tests de los nombres de archivo de la descarga MEV. Movimientos
 * inventados: ningún dato de una causa real.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  assignFileBases,
  buildFileBase,
  isoDateForName,
  safeDescription,
  verificationFileName,
} from '../modules/pdf/file-naming.ts';

test('fecha adelante, después fojas y descripción', () => {
  assert.equal(
    buildFileBase({ date: '02/02/2026', fojas: '145', description: 'MANDAMIENTO DILIGENCIADO / SE PROVEE' }),
    '2026-02-02_fs-145_MANDAMIENTO_DILIGENCIADO_SE_PROVE'
  );
});

test('la barra de las fojas pasa a guion', () => {
  assert.equal(
    buildFileBase({ date: '16/06/2026', fojas: '375/381', description: 'RECURSO DE APELACION' }),
    '2026-06-16_fs-375-381_RECURSO_DE_APELACION'
  );
});

test('sin fojas no queda un guion bajo de más', () => {
  assert.equal(buildFileBase({ date: '05/02/2026', description: 'PROVEIDO' }), '2026-02-05_PROVEIDO');
  assert.equal(buildFileBase({ date: '05/02/2026', fojas: '', description: '' }), '2026-02-05');
});

test('tildes y eñe pasan a su letra base', () => {
  assert.equal(safeDescription('MANDAMIENTO DILIGENCIADO - ACOMPAÑA'), 'MANDAMIENTO_DILIGENCIADO_-_ACOMPANA');
  assert.equal(safeDescription('Resolución'), 'Resolucion');
});

test('la fecha con hora se corta en el día y una fecha rara queda como sin-fecha', () => {
  assert.equal(isoDateForName('22/06/2026 12:11:59'), '2026-06-22');
  assert.equal(isoDateForName('5/2/2026'), '2026-02-05');
  assert.equal(isoDateForName(''), 'sin-fecha');
  assert.equal(isoDateForName('ayer'), 'sin-fecha');
});

test('colisiones: el segundo lleva _2 y el tercero _3; sin documentos da null', () => {
  const mov = { date: '10/03/2026', fojas: '20', description: 'OFICIO', hasDocuments: true };
  assert.deepEqual(
    assignFileBases([mov, { ...mov, hasDocuments: false }, mov, mov]),
    ['2026-03-10_fs-20_OFICIO', null, '2026-03-10_fs-20_OFICIO_2', '2026-03-10_fs-20_OFICIO_3']
  );
});

test('un sufijo nunca repite un nombre que ya existe por su descripción', () => {
  const natural = { date: '10/03/2026', fojas: '20', description: 'OFICIO 2', hasDocuments: true };
  const repetido = { date: '10/03/2026', fojas: '20', description: 'OFICIO', hasDocuments: true };
  assert.deepEqual(assignFileBases([natural, repetido, repetido]), [
    '2026-03-10_fs-20_OFICIO_2',
    '2026-03-10_fs-20_OFICIO',
    '2026-03-10_fs-20_OFICIO_3',
  ]);
});

test('el informe lleva fecha y hora', () => {
  assert.equal(verificationFileName(new Date(2026, 8, 22, 9, 5)), '_verificacion_2026-09-22_0905.txt');
});
