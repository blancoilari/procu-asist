/**
 * Tests del informe de faltantes de la descarga MEV. Datos inventados.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildVerificationLines,
  emptyStats,
  formatDateTimeAr,
  reasonLabel,
  type MevDownloadStats,
} from '../modules/pdf/download-report.ts';

const RAYA_LARGA = String.fromCharCode(0x2014);

function statsDeEjemplo(): MevDownloadStats {
  const stats = emptyStats(3);
  stats.proveidosDownloaded = 1;
  stats.proveidosFailed = 1;
  stats.pending = 1;
  stats.failedItems = [
    {
      kind: 'proveido',
      fileName: '2026-02-02_fs-145_OFICIO.pdf',
      date: '02/02/2026',
      fojas: '145',
      description: 'OFICIO',
      url: 'https://mev.scba.gov.ar/proveido.asp?x=1',
      reason: 'sin-contexto',
      detail: 'página /busqueda.asp, 17000 caracteres',
      movementFileBase: '2026-02-02_fs-145_OFICIO',
    },
    {
      kind: 'proveido',
      fileName: '2026-02-03_PROVEIDO.pdf',
      date: '03/02/2026',
      description: 'PROVEIDO',
      url: 'https://mev.scba.gov.ar/proveido.asp?x=2',
      reason: 'pendiente',
      detail: '',
      movementFileBase: '2026-02-03_PROVEIDO',
    },
  ];
  stats.missingFileBases = ['2026-02-02_fs-145_OFICIO', '2026-02-03_PROVEIDO'];
  return stats;
}

test('fecha y hora en formato argentino', () => {
  assert.equal(formatDateTimeAr(new Date(2026, 8, 2, 7, 5)), '02/09/2026 07:05');
});

test('cada motivo tiene su explicación', () => {
  for (const r of ['desafio', 'login', 'sin-contexto', 'respuesta-inesperada', 'error', 'pendiente'] as const) {
    assert.ok(reasonLabel(r).length > 10, r);
  }
});

test('el informe lista cada faltante con nombre de archivo, paso y motivo', () => {
  const texto = buildVerificationLines({
    caseNumber: 'XX-1-2026',
    generatedAt: new Date(2026, 8, 22, 10, 51),
    outcome: 'partial',
    stats: statsDeEjemplo(),
  }).join('\n');
  assert.match(texto, /expediente XX-1-2026/);
  assert.match(texto, /Generado: 22\/09\/2026 10:51/);
  assert.match(texto, /descarga detenida/i);
  assert.match(texto, /\[PROVEÍDO\] 2026-02-02_fs-145_OFICIO\.pdf/);
  assert.match(texto, /Paso: 02\/02\/2026, fs\. 145, OFICIO/);
  assert.match(texto, /Motivo: la MEV devolvió la búsqueda/);
  assert.match(texto, /Detalle: página \/busqueda\.asp/);
  assert.match(texto, /Paso: 03\/02\/2026, PROVEIDO/);
  assert.match(texto, /No pedidos porque la descarga se detuvo: 1/);
});

test('el informe no usa guiones largos', () => {
  const texto = buildVerificationLines({
    caseNumber: 'XX-1-2026',
    generatedAt: new Date(2026, 8, 22, 10, 51),
    outcome: 'complete',
    stats: statsDeEjemplo(),
  }).join('\n');
  assert.equal(texto.includes(RAYA_LARGA), false);
});
