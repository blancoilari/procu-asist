# Descarga confiable de expedientes MEV: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objetivo:** que la descarga de un expediente de la MEV baje todos sus documentos respetando el límite de pedidos del portal, frene y pregunte en cada bloqueo, y nombre los archivos por fecha.

**Arquitectura:** la política de la descarga (orden de pedidos, reintentos, pausas) pasa a un módulo puro con dependencias inyectadas (`mev-download-runner.ts`), probado en node. Un portero puro (`mev-pacer.ts`) espacia los pedidos a 20 por minuto. El trabajo corre en el service worker detrás de un canal `chrome.runtime.connect` (no de un mensaje suelto, que Chrome corta a los 5 minutos), y la pestaña muestra progreso, pausas y resultado con un módulo de interfaz propio.

**Tecnologías:** TypeScript, WXT 0.21 (Manifest V3), JSZip, jsPDF, pdf-lib, runner de tests de node 24 (quita los tipos solo, sin dependencias nuevas).

**Especificación:** `docs/superpowers/specs/2026-09-22-descarga-confiable-mev-design.md`.

**Reglas del repo que valen para todas las tareas:**

- Repo público: ningún dato de causas reales en código, tests, commits ni nombres de archivo. Los datos de prueba son inventados.
- Sin guiones largos (el carácter de raya larga) en ningún texto nuevo ni en los textos que se toquen.
- Los módulos que se prueban en node no pueden importar con el alias `@/`: usan rutas relativas con extensión `.ts` (el tsconfig tiene `allowImportingTsExtensions`).
- Mensajes de commit en castellano, terminados con la línea `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Directorio de trabajo: `C:\Users\Patricio\proyectos\.worktrees\procu-asist-descarga-confiable` (rama `descarga-confiable-mev`).

---

## Mapa de archivos

| Archivo | Qué hace | Estado |
|---|---|---|
| `modules/portals/mev-pacer.ts` | Portero: 20 pedidos por minuto, fila de llamados, escalera de esperas | nuevo, puro |
| `modules/pdf/file-naming.ts` | Nombres por fecha, colisiones estables, nombre del informe | nuevo, puro |
| `modules/portals/mev-challenge.ts` | Clasifica respuestas: ok, desafío, login, sin contexto, inesperada | reescrito, puro |
| `modules/pdf/download-report.ts` | Tipos de faltantes y texto del informe de verificación | nuevo, puro |
| `modules/pdf/mev-download-runner.ts` | Política del recorrido de la descarga | nuevo, puro |
| `modules/utils/blob.ts` | Blob a base64 y a data URI | nuevo |
| `modules/messages/mev-download.ts` | Nombre y mensajes del canal de descarga | nuevo |
| `modules/pdf/attachment-downloader.ts` | Un pedido por función a la MEV, clasificado | reescrito |
| `modules/pdf/case-zip-generator.ts` | Arma ZIP o PDF único con el recorrido | reescrito |
| `entrypoints/background/mev-download-job.ts` | Canal en el service worker, pausas, entrega | nuevo |
| `modules/ui/mev-download-ui.ts` | Barra, pausa, detener, resultado en la pestaña | nuevo |
| `entrypoints/mev.content.ts` | Botón Descargar con nombres; no tocar la pantalla de verificación | modificado |
| `entrypoints/background/case-monitor.ts`, `keep-alive.ts` | No consultar la MEV durante una descarga | modificados |
| `entrypoints/background/message-router.ts`, `modules/messages/types.ts`, `entrypoints/background.ts` | Retirar `GENERATE_ZIP` y `DOWNLOAD_ATTACHMENT`, registrar el canal | modificados |
| `tests/*.test.ts` | Pruebas de los cinco módulos puros | nuevos y reescrito |
| `package.json` | `npm test` corre todos los `tests/*.test.ts` | modificado |
| `README.md`, `CHANGELOG.md`, `docs/manual-usuario.md`, `docs/release-v0.8.1-assets.md` | Documentación | modificados |

Tres ajustes de detalle respecto de la especificación, que se reflejan en ella en la Tarea 1:

- El informe se llama `_verificacion_AAAA-MM-DD_HHMM.txt` (con fecha y hora) para que una descarga parcial posterior no pise ni deje desactualizado el informe de una anterior en la misma carpeta.
- Los adjuntos de `docs.scba.gov.ar` se bajan de a uno: su tiempo queda dentro del intervalo de 3 s del portero, así que ir de a dos no acorta la descarga y complica el recorrido.
- El `resumen.pdf` lista todos los movimientos de la ficha (no solo lo tildado): una descarga parcial posterior lo reemplaza por uno completo y al día.

---

### Tarea 1: script de tests y ajustes de la especificación

**Archivos:**
- Modificar: `package.json` (script `test`)
- Modificar: `docs/superpowers/specs/2026-09-22-descarga-confiable-mev-design.md`

- [ ] **Paso 1: cambiar el script de tests para que corra todos los archivos**

En `package.json`, reemplazar:

```json
    "test": "node --test tests/mev-challenge.test.ts",
```

por:

```json
    "test": "node --test tests/*.test.ts",
```

- [ ] **Paso 2: correr los tests actuales**

Run: `npm test`
Expected: PASS, 8 tests de `mev-challenge.test.ts` (node expande el patrón; si en Windows no lo hiciera, el runner avisa "Could not find" y hay que listar los archivos).

- [ ] **Paso 3: reflejar los tres ajustes en la especificación**

En la sección 3.1, reemplazar "Los adjuntos de `docs.scba.gov.ar` no pasan (otro servidor; si se comprobara que cuentan, se suman) y se bajan de a dos por vez." por "Los adjuntos de `docs.scba.gov.ar` no pasan (otro servidor; si se comprobara que cuentan, se suman) y se bajan de a uno, dentro del intervalo del portero."

En la sección 3.3, reemplazar "entrega el ZIP (o el PDF único) con lo descargado y `_verificacion.txt` con lo que falta." por "entrega el ZIP (o el PDF único) con lo descargado y el informe `_verificacion_AAAA-MM-DD_HHMM.txt` con lo que falta."

En la sección 3.6, reemplazar la primera viñeta por: "`_verificacion_AAAA-MM-DD_HHMM.txt` (fecha y hora de la descarga, para no pisar el informe de otra descarga en la misma carpeta), la página final del PDF único y el aviso en pantalla nombran cada faltante por fecha, fojas, descripción y nombre de archivo, y dicen qué devolvió la MEV (pantalla de verificación, login, búsqueda u otra, con título y tamaño)." y agregar la viñeta: "El `resumen.pdf` lista todos los movimientos de la ficha, no solo los tildados: una descarga parcial lo reemplaza por uno completo y al día."

- [ ] **Paso 4: commit**

```bash
git add package.json docs/superpowers/specs/2026-09-22-descarga-confiable-mev-design.md docs/superpowers/plans/2026-09-22-descarga-confiable-mev.md
git commit -m "Plan de la descarga confiable de la MEV y npm test para todos los archivos de tests

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarea 2: portero de pedidos (`mev-pacer.ts`)

**Archivos:**
- Crear: `modules/portals/mev-pacer.ts`
- Test: `tests/mev-pacer.test.ts`

- [ ] **Paso 1: escribir los tests**

```ts
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

test('20 pedidos por minuto: un inicio cada 3000 ms', () => {
  assert.equal(MEV_MAX_REQUESTS_PER_MINUTE, 20);
  assert.equal(MEV_MIN_INTERVAL_MS, 3000);
});

test('el primer pedido sale sin esperar y los siguientes se espacian', async () => {
  const reloj = relojSimulado();
  const portero = createMevPacer(reloj);
  const inicios: number[] = [];
  for (let i = 0; i < 3; i++) {
    await portero.wait();
    inicios.push(reloj.t);
  }
  assert.deepEqual(inicios, [0, 3000, 6000]);
});

test('si ya pasó el intervalo, no espera', async () => {
  const reloj = relojSimulado();
  const portero = createMevPacer(reloj);
  await portero.wait();
  reloj.t += 5000;
  await portero.wait();
  assert.deepEqual(reloj.esperas, []);
});

test('espera solo lo que falta del intervalo', async () => {
  const reloj = relojSimulado();
  const portero = createMevPacer(reloj);
  await portero.wait();
  reloj.t += 1000;
  await portero.wait();
  assert.deepEqual(reloj.esperas, [2000]);
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
  assert.deepEqual(inicios, [0, 3000, 6000]);
});

test('escalera de esperas ante un bloqueo: 30 s, 1, 2 y 4 min, y la última se repite', () => {
  assert.deepEqual(
    [0, 1, 2, 3, 4, 9].map(blockWaitMs),
    [30_000, 60_000, 120_000, 240_000, 240_000, 240_000]
  );
  assert.equal(blockWaitMs(-1), 30_000);
});
```

- [ ] **Paso 2: correr y ver que fallan**

Run: `npm test`
Expected: FAIL en `mev-pacer.test.ts` con `ERR_MODULE_NOT_FOUND` (el módulo no existe).

- [ ] **Paso 3: implementar**

```ts
/**
 * Portero de los pedidos de la descarga a la MEV.
 *
 * Medido el 22/09/2026 contra el portal: la MEV deja pasar unos 30 pedidos
 * de proveídos por minuto. Pasado ese número contesta a todo con su
 * pantalla de verificación y, si se sigue pidiendo, el bloqueo no se
 * levanta y cada vez dura más. El portero espacia los pedidos para no
 * llegar nunca al límite (20 por minuto deja margen para lo que el usuario
 * navegue en la MEV al mismo tiempo) y define cuánto se espera cuando igual
 * aparece un bloqueo.
 *
 * Módulo puro: el reloj y la espera se inyectan, así se prueba en node.
 */

/** Pedidos por minuto que se permite la descarga (decisión del 22/09/2026). */
export const MEV_MAX_REQUESTS_PER_MINUTE = 20;

/** Separación mínima entre el inicio de dos pedidos. */
export const MEV_MIN_INTERVAL_MS = Math.ceil(60_000 / MEV_MAX_REQUESTS_PER_MINUTE);

/** Esperas ante un bloqueo, en orden; la última se repite. */
export const MEV_BLOCK_WAITS_MS: readonly number[] = [30_000, 60_000, 120_000, 240_000];

/** Espera que corresponde según cuántos bloqueos seguidos hubo antes (0 = el primero). */
export function blockWaitMs(previousConsecutiveBlocks: number): number {
  const last = MEV_BLOCK_WAITS_MS.length - 1;
  const index = Math.min(Math.max(previousConsecutiveBlocks, 0), last);
  return MEV_BLOCK_WAITS_MS[index];
}

export interface PacerClock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

export interface MevPacer {
  /**
   * Resuelve cuando se puede iniciar el próximo pedido. Los llamados
   * concurrentes hacen fila: nunca salen dos pedidos juntos.
   */
  wait(): Promise<void>;
}

export function createMevPacer(
  clock: PacerClock,
  minIntervalMs: number = MEV_MIN_INTERVAL_MS
): MevPacer {
  let lastStart = Number.NEGATIVE_INFINITY;
  let queue: Promise<void> = Promise.resolve();
  return {
    wait() {
      const turn = queue.then(async () => {
        const remaining = lastStart + minIntervalMs - clock.now();
        if (remaining > 0) await clock.sleep(remaining);
        lastStart = clock.now();
      });
      queue = turn.catch(() => undefined);
      return turn;
    },
  };
}

/** Reloj real, para el service worker. */
export const realClock: PacerClock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};
```

- [ ] **Paso 4: correr y ver que pasan**

Run: `npm test`
Expected: PASS (6 nuevos más los 8 existentes).

- [ ] **Paso 5: commit**

```bash
git add modules/portals/mev-pacer.ts tests/mev-pacer.test.ts
git commit -m "Portero de pedidos a la MEV: 20 por minuto, en fila, con escalera de esperas ante un bloqueo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarea 3: nombres de archivo por fecha (`file-naming.ts`)

**Archivos:**
- Crear: `modules/pdf/file-naming.ts`
- Test: `tests/file-naming.test.ts`

- [ ] **Paso 1: escribir los tests**

```ts
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
```

- [ ] **Paso 2: correr y ver que fallan**

Run: `npm test`
Expected: FAIL en `file-naming.test.ts` con `ERR_MODULE_NOT_FOUND`.

- [ ] **Paso 3: implementar**

```ts
/**
 * Nombres de los archivos de la descarga de un expediente de la MEV.
 *
 * Formato: AAAA-MM-DD_fs-X_DESCRIPCION (sin fojas: AAAA-MM-DD_DESCRIPCION).
 * La fecha adelante ordena los archivos por fecha y hace que una descarga
 * parcial encaje en la carpeta de una anterior sin pisar nada (decisión del
 * titular del 22/09/2026; antes el número inicial era la posición dentro de
 * lo tildado y volvía a 001 en cada descarga). Limitación aceptada: dentro
 * de un mismo día el Explorador ordena por fojas como texto, no en el orden
 * de la MEV.
 *
 * Módulo puro: sin chrome.* ni DOM, se prueba en node.
 */

export interface NamingMovement {
  date: string;
  fojas?: string;
  description: string;
  hasDocuments: boolean;
}

/** Marcas de combinación Unicode (los acentos que deja NFD). */
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g');

/** dd/mm/aaaa (con o sin hora) a AAAA-MM-DD; si no se reconoce, 'sin-fecha'. */
export function isoDateForName(date: string): string {
  const match = (date ?? '').trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (!match) return 'sin-fecha';
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/** Fojas para el nombre: la barra pasa a guion y se descarta lo demás. */
export function safeFojas(fojas?: string): string {
  return (fojas ?? '').trim().replace(/\//g, '-').replace(/[^a-zA-Z0-9-]/g, '');
}

/**
 * Descripción para el nombre: tildes y eñe a su letra base (antes
 * "ACOMPAÑA" quedaba "ACOMPAA"), primeros 35 caracteres, solo letras,
 * números, espacios y guiones, y los espacios pasan a guion bajo.
 */
export function safeDescription(description: string): string {
  return (description ?? '')
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .substring(0, 35)
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

/** Nombre base de un paso procesal, sin extensión y sin sufijo de colisión. */
export function buildFileBase(mov: { date: string; fojas?: string; description: string }): string {
  const parts = [isoDateForName(mov.date)];
  const fojas = safeFojas(mov.fojas);
  if (fojas) parts.push(`fs-${fojas}`);
  const description = safeDescription(mov.description);
  if (description) parts.push(description);
  return parts.join('_');
}

/**
 * Nombre de cada movimiento con documentos, calculado sobre la lista
 * COMPLETA de la ficha, del más viejo al más nuevo. Si dos quedan iguales,
 * el segundo lleva _2, el tercero _3, salteando cualquier nombre ya usado.
 * Como el cálculo es sobre la lista completa y no sobre lo tildado, el
 * nombre de un documento no cambia entre una descarga y otra.
 *
 * Devuelve un array paralelo a la entrada: null para los movimientos sin
 * documentos.
 */
export function assignFileBases(movementsOldestFirst: NamingMovement[]): Array<string | null> {
  const used = new Set<string>();
  return movementsOldestFirst.map((mov) => {
    if (!mov.hasDocuments) return null;
    const base = buildFileBase(mov);
    let name = base;
    let n = 1;
    while (used.has(name)) {
      n += 1;
      name = `${base}_${n}`;
    }
    used.add(name);
    return name;
  });
}

/** Nombre del informe de faltantes, con fecha y hora para no pisar el de otra descarga. */
export function verificationFileName(at: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `_verificacion_${at.getFullYear()}-${p(at.getMonth() + 1)}-${p(at.getDate())}_${p(at.getHours())}${p(at.getMinutes())}.txt`;
}
```

Nota: en el test de colisión con descripción natural, el primer movimiento ocupa `..._OFICIO_2`, el segundo queda `..._OFICIO` y el tercero salta el `_2` usado y queda `_3`.

- [ ] **Paso 4: correr y ver que pasan**

Run: `npm test`
Expected: PASS.

- [ ] **Paso 5: commit**

```bash
git add modules/pdf/file-naming.ts tests/file-naming.test.ts
git commit -m "Nombres de archivo por fecha, con colisiones estables entre descargas y tildes a su letra base

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarea 4: clasificación de respuestas (`mev-challenge.ts`)

**Archivos:**
- Reescribir: `modules/portals/mev-challenge.ts`
- Reescribir: `tests/mev-challenge.test.ts`

- [ ] **Paso 1: reescribir los tests**

```ts
/**
 * Tests de la clasificación de respuestas de la MEV.
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
```

- [ ] **Paso 2: correr y ver que fallan**

Run: `npm test`
Expected: FAIL en `mev-challenge.test.ts`: `classifyMevPage` y los demás no existen (SyntaxError de import con el nombre).

- [ ] **Paso 3: reescribir el módulo**

```ts
/**
 * Clasificación de las respuestas de la MEV y detección de su pantalla de
 * verificación ("Validando acceso").
 *
 * Qué se sabe (medido el 22/09/2026 contra el portal, con sesión real):
 *   - La MEV tiene un nginx delante del servidor ASP con un límite de unos 30
 *     pedidos de proveídos por minuto. Pasado el límite, TODA página
 *     responde, en la misma dirección y con HTTP 200, una pantalla de 2.000
 *     bytes con título "Validando acceso...", un script de Cloudflare
 *     Turnstile (challenges.cloudflare.com/turnstile) y ningún texto visible
 *     en el cuerpo: el texto que se ve lo arma un script. Por eso la
 *     detección del 09/09/2026, que buscaba las frases en el texto visible,
 *     no la reconocía y la descarga la tomaba por "página inesperada".
 *   - La página de login no carga Turnstile y su título es "Mesa de Entradas
 *     Virtual": el título alcanza para distinguirlas.
 *   - proveido.asp pedido sin que la sesión haya pasado antes por la ficha de
 *     esa causa (procesales.asp) redirige a busqueda.asp.
 *
 * Qué no se sabe: si la ficha y los adjuntos cuentan para el límite, si va
 * por usuario o por IP, y si pasar la verificación a mano acorta el bloqueo.
 *
 * Regla de oro, igual que antes: una página con estructura de proveído nunca
 * se marca como verificación, aunque su texto contenga las frases.
 *
 * Módulo puro: no usa chrome.*, ni DOM, ni fetch. Se prueba en node.
 */

/** Frases de la pantalla de verificación, sin acentos (se buscan normalizadas). */
export const MEV_CHALLENGE_MARKERS: readonly string[] = [
  'validando acceso',
  'navegado por un ser humano',
  'verificando si esta siendo navegado',
  'checking your browser',
  'verifying you are human',
  'enable javascript and cookies to continue',
];

/** Piso de tamaño del HTML de un proveído real. */
export const MEV_MIN_PROVEIDO_HTML_LENGTH = 1200;

/** Cuántos caracteres de texto visible se traen de la página. */
export const MEV_PROBE_SAMPLE_LENGTH = 600;

/**
 * Cuánto HTML crudo se trae para buscar las frases fuera del texto visible.
 * La pantalla de verificación entera mide 2.000 y el formulario de login
 * aparece antes del carácter 3.000 de su página.
 */
export const MEV_RAW_SAMPLE_LENGTH = 8000;

const TITLE_MARKER = 'validando acceso';
const TURNSTILE_SRC = /challenges\.cloudflare\.com\/turnstile/i;
const TITLE_TAG = /<title[^>]*>([\s\S]*?)<\/title>/i;

/** Datos mínimos de la respuesta para poder juzgarla. */
export interface MevPageProbe {
  /** Largo del HTML crudo recibido, en caracteres. */
  htmlLength: number;
  /** Muestra acotada del texto visible (sin scripts ni estilos). */
  bodyTextSample: string;
  /** true si la página trae al menos una marca estructural de un proveído. */
  hasProveidoStructure: boolean;
  /** Título del documento. */
  title?: string;
  /** true si la página carga el script de Cloudflare Turnstile. */
  hasTurnstile?: boolean;
  /** Ruta final después de las redirecciones, en minúsculas (p. ej. '/busqueda.asp'). */
  finalPath?: string;
  /** true si la página es el formulario de login (usuario y clave). */
  looksLikeLogin?: boolean;
  /** Comienzo del HTML crudo, para buscar las frases fuera del texto visible. */
  rawHtmlSample?: string;
}

export type MevPageStatus = 'ok' | 'desafio' | 'login' | 'sin-contexto' | 'respuesta-inesperada';

export interface MevPageVerdict {
  status: MevPageStatus;
  /** Regla que decidió, para el log. */
  marker?: string;
}

/** Marcas de combinación Unicode (los acentos que deja NFD). */
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g');

/** Minúsculas, sin tildes y con los espacios colapsados. */
export function normalizeForMarkers(text: string): string {
  return text
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Devuelve la primera frase de verificación encontrada, o null. */
export function findChallengeMarker(text: string): string | null {
  const normalized = normalizeForMarkers(text);
  for (const marker of MEV_CHALLENGE_MARKERS) {
    if (normalized.includes(marker)) return marker;
  }
  return null;
}

/** ¿El título es el de la pantalla de verificación? */
export function isChallengeTitle(title: string | null | undefined): boolean {
  return !!title && normalizeForMarkers(title).includes(TITLE_MARKER);
}

/**
 * Juzga una respuesta de la MEV a partir de la sonda. El orden importa: la
 * estructura de proveído gana siempre; después las señales propias de la
 * verificación (título y frases); después el login y la búsqueda; y recién
 * al final las señales débiles (Turnstile solo, tamaño).
 */
export function classifyMevPage(probe: MevPageProbe): MevPageVerdict {
  if (probe.hasProveidoStructure) return { status: 'ok' };
  if (isChallengeTitle(probe.title)) return { status: 'desafio', marker: 'titulo' };
  const phrase =
    findChallengeMarker(probe.bodyTextSample) ?? findChallengeMarker(probe.rawHtmlSample ?? '');
  if (phrase) return { status: 'desafio', marker: phrase };
  if (probe.looksLikeLogin) return { status: 'login', marker: 'formulario-de-login' };
  if ((probe.finalPath ?? '').toLowerCase().endsWith('/busqueda.asp')) {
    return { status: 'sin-contexto', marker: 'busqueda' };
  }
  if (probe.hasTurnstile) return { status: 'desafio', marker: 'turnstile' };
  if (probe.htmlLength < MEV_MIN_PROVEIDO_HTML_LENGTH) {
    return { status: 'desafio', marker: 'respuesta-demasiado-corta' };
  }
  return { status: 'respuesta-inesperada' };
}

/** Texto corto de qué devolvió la MEV, para el informe de faltantes. */
export function describeProbe(probe: MevPageProbe): string {
  const parts: string[] = [];
  if (probe.finalPath) parts.push(`página ${probe.finalPath}`);
  if (probe.title) parts.push(`título "${probe.title.trim().slice(0, 60)}"`);
  parts.push(`${probe.htmlLength} caracteres`);
  return parts.join(', ');
}

/**
 * Versión para HTML crudo (adjuntos, reingreso a la ficha, monitoreo):
 * reconoce el título de la pantalla, el script de Turnstile o una frase
 * conocida. Nunca decide por tamaño.
 */
export function htmlLooksLikeChallenge(html: string): boolean {
  const title = html.match(TITLE_TAG)?.[1];
  if (isChallengeTitle(title)) return true;
  if (TURNSTILE_SRC.test(html)) return true;
  return findChallengeMarker(html) !== null;
}

/** ¿El HTML es el formulario de login de la MEV? */
export function htmlLooksLikeLogin(html: string): boolean {
  const lower = html.toLowerCase();
  return (
    lower.includes('ingrese los datos del usuario') ||
    (lower.includes('name="usuario"') && lower.includes('name="clave"'))
  );
}
```

- [ ] **Paso 4: correr los tests**

Run: `npm test`
Expected: PASS en los 16 de `mev-challenge.test.ts`. `npm run compile` todavía falla en `attachment-downloader.ts` (usa `detectMevChallenge`, que ya no existe). Es esperado: la rama no compila entre esta tarea y la 12, y cada tarea siguiente achica la lista de errores. El commit no tiene chequeo de compilación (el hook del repo solo busca secretos).

- [ ] **Paso 5: commit**

```bash
git add modules/portals/mev-challenge.ts tests/mev-challenge.test.ts
git commit -m "La pantalla de verificacion de la MEV se reconoce por su titulo y su script, no por el texto visible, que esta vacio

Clasifica ademas el login, la busqueda en vez del proveido y la pagina
desconocida. La compilacion del resto se completa al reescribir el
descargador.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarea 5: informe de faltantes (`download-report.ts`)

**Archivos:**
- Crear: `modules/pdf/download-report.ts`
- Test: `tests/download-report.test.ts`

- [ ] **Paso 1: escribir los tests**

```ts
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
```

- [ ] **Paso 2: correr y ver que fallan**

Run: `npm test`
Expected: FAIL en `download-report.test.ts` con `ERR_MODULE_NOT_FOUND`.

- [ ] **Paso 3: implementar**

```ts
/**
 * Informe de faltantes de una descarga de la MEV: el archivo
 * _verificacion_AAAA-MM-DD_HHMM.txt, la última página del PDF único y los
 * datos del aviso en pantalla. Módulo puro, se prueba en node.
 */

export type MevFailureReason =
  | 'desafio'
  | 'login'
  | 'sin-contexto'
  | 'respuesta-inesperada'
  | 'error'
  | 'pendiente';

export interface MevFailedItem {
  kind: 'proveido' | 'adjunto';
  /** Nombre del archivo que le correspondía. */
  fileName: string;
  date: string;
  fojas?: string;
  description: string;
  url: string;
  reason: MevFailureReason;
  /** Qué devolvió la MEV o qué falló. */
  detail: string;
  /** Movimiento al que pertenece, para "Bajar los que faltan". */
  movementFileBase: string;
}

export interface MevDownloadStats {
  requestedDocuments: number;
  proveidosDownloaded: number;
  proveidosFailed: number;
  adjuntosDownloaded: number;
  adjuntosFailed: number;
  /** Documentos o adjuntos que no se llegaron a pedir porque la descarga se detuvo. */
  pending: number;
  failedItems: MevFailedItem[];
  /** Movimientos a volver a pedir (fallidos o pendientes), sin repetir. */
  missingFileBases: string[];
}

export function emptyStats(requestedDocuments: number): MevDownloadStats {
  return {
    requestedDocuments,
    proveidosDownloaded: 0,
    proveidosFailed: 0,
    adjuntosDownloaded: 0,
    adjuntosFailed: 0,
    pending: 0,
    failedItems: [],
    missingFileBases: [],
  };
}

export function reasonLabel(reason: MevFailureReason): string {
  switch (reason) {
    case 'desafio':
      return 'la MEV respondió con su pantalla de verificación';
    case 'login':
      return 'la sesión de la MEV se cerró';
    case 'sin-contexto':
      return 'la MEV devolvió la búsqueda en vez del proveído';
    case 'respuesta-inesperada':
      return 'la MEV devolvió otra página';
    case 'error':
      return 'error al pedir o armar el documento';
    case 'pendiente':
      return 'no se pidió: la descarga se detuvo antes';
  }
}

export function formatDateTimeAr(at: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(at.getDate())}/${p(at.getMonth() + 1)}/${at.getFullYear()} ${p(at.getHours())}:${p(at.getMinutes())}`;
}

export function buildVerificationLines(input: {
  caseNumber: string;
  generatedAt: Date;
  outcome: 'complete' | 'partial';
  stats: MevDownloadStats;
}): string[] {
  const { stats } = input;
  const lines: string[] = [
    `VERIFICACIÓN DE DESCARGA, expediente ${input.caseNumber}`,
    `Generado: ${formatDateTimeAr(input.generatedAt)}`,
    input.outcome === 'partial'
      ? 'Resultado: descarga detenida antes de terminar'
      : 'Resultado: descarga terminada, con faltantes',
    '='.repeat(60),
    '',
    `Documentos pedidos: ${stats.requestedDocuments}`,
    `Proveídos bajados: ${stats.proveidosDownloaded}`,
    `Proveídos que faltan: ${stats.proveidosFailed}`,
    `Adjuntos bajados: ${stats.adjuntosDownloaded}`,
    `Adjuntos que faltan: ${stats.adjuntosFailed}`,
    `No pedidos porque la descarga se detuvo: ${stats.pending}`,
    '',
    'Para completar la carpeta, usá "Bajar los que faltan" en la pantalla de la MEV',
    'o volvé a descargar esos pasos: los nombres encajan en esta misma carpeta.',
    '',
    'FALTANTES:',
    '-'.repeat(60),
    '',
  ];
  for (const item of stats.failedItems) {
    lines.push(`[${item.kind === 'proveido' ? 'PROVEÍDO' : 'ADJUNTO'}] ${item.fileName}`);
    const fojas = item.fojas ? `, fs. ${item.fojas}` : '';
    lines.push(`  Paso: ${item.date}${fojas}, ${item.description}`);
    lines.push(`  Motivo: ${reasonLabel(item.reason)}`);
    if (item.detail) lines.push(`  Detalle: ${item.detail}`);
    if (item.url) lines.push(`  URL: ${item.url}`);
    lines.push('');
  }
  return lines;
}
```

- [ ] **Paso 4: correr y ver que pasan**

Run: `npm test`
Expected: PASS.

- [ ] **Paso 5: commit**

```bash
git add modules/pdf/download-report.ts tests/download-report.test.ts
git commit -m "Informe de faltantes: cada documento por nombre de archivo, paso y que devolvio la MEV

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarea 6: recorrido de la descarga (`mev-download-runner.ts`)

**Archivos:**
- Crear: `modules/pdf/mev-download-runner.ts`
- Test: `tests/mev-download-runner.test.ts`

- [ ] **Paso 1: escribir los tests**

```ts
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
```

- [ ] **Paso 2: correr y ver que fallan**

Run: `npm test`
Expected: FAIL en `mev-download-runner.test.ts` con `ERR_MODULE_NOT_FOUND`.

- [ ] **Paso 3: implementar**

```ts
/**
 * Recorrido de la descarga de un expediente de la MEV: orden de los
 * pedidos, qué hacer con cada respuesta y cuándo frenar a preguntar.
 *
 * Política (especificación del 22/09/2026):
 *   - cada pedido a la MEV espera su turno en el portero (20 por minuto);
 *   - pantalla de verificación o sesión cerrada: la descarga deja de pedir
 *     y pregunta; con "esperar" cuenta la espera que toca y reintenta el
 *     MISMO documento, nunca lo saltea;
 *   - la MEV devolvió la búsqueda en vez del proveído: reingresa una vez a
 *     la ficha y reintenta;
 *   - otra página o un error: reintenta una vez y, si se repite, lo anota
 *     como faltante con lo que devolvió la MEV y sigue con el resto.
 *
 * Módulo puro: los pedidos, el guardado y el reloj se inyectan. Lo prueba
 * tests/mev-download-runner.test.ts con dobles.
 */

import { blockWaitMs } from '../portals/mev-pacer.ts';
import {
  emptyStats,
  type MevDownloadStats,
  type MevFailureReason,
} from './download-report.ts';

export interface RunnerMovement {
  date: string;
  fojas?: string;
  description: string;
  documentUrls: string[];
  /** Nombre base del archivo (modules/pdf/file-naming.ts). */
  fileBase: string;
}

export type BlockReason = 'desafio' | 'login';

export type PageFetch<T> =
  | { status: 'ok'; data: T }
  | {
      status: 'desafio' | 'login' | 'sin-contexto' | 'respuesta-inesperada' | 'error';
      detail: string;
    };

export type AttachmentFetch =
  | { status: 'ok'; base64: string; mimeType: string }
  | { status: 'desafio' | 'login' | 'error'; detail: string };

export interface CaseEntry {
  status: 'ok' | 'desafio' | 'login' | 'error';
  detail: string;
}

export interface RunnerDeps<T> {
  /** Espera el turno del portero antes de un pedido a la MEV. */
  pace(): Promise<void>;
  sleep(ms: number): Promise<void>;
  fetchProveido(url: string): Promise<PageFetch<T>>;
  /** Reingresa a la ficha de la causa: deja la causa en la sesión. */
  enterCase(): Promise<CaseEntry>;
  /** true si el adjunto se pide a la MEV (cuenta para el límite). */
  isMevHosted(url: string): boolean;
  fetchAttachment(url: string): Promise<AttachmentFetch>;
  adjuntoUrls(data: T): string[];
  saveProveido(fileName: string, mov: RunnerMovement, url: string, data: T): Promise<void>;
  saveAttachment(fileName: string, base64: string, mimeType: string): Promise<void>;
}

export type BlockChoice = 'wait' | 'continue' | 'stop-save' | 'cancel';
export type StopRequest = 'stop-save' | 'cancel' | null;

export interface RunnerHooks {
  onProgress(p: { done: number; total: number }): void;
  /** Pausa: la descarga no pide nada hasta que esto resuelva. */
  onBlocked(b: { reason: BlockReason; done: number; total: number; waitMs: number }): Promise<BlockChoice>;
  onWaiting(w: { secondsLeft: number; done: number; total: number }): void;
  shouldStop(): StopRequest;
}

export interface RunnerResult {
  outcome: 'complete' | 'partial' | 'cancelled';
  stats: MevDownloadStats;
}

/** Tramo de la cuenta regresiva durante una espera. */
export const WAIT_TICK_MS = 5_000;

interface DocEntry {
  mov: RunnerMovement;
  url: string;
  fileName: string;
}

interface PendingAttachment {
  doc: DocEntry;
  url: string;
  fileName: string;
}

export async function runMevDownload<T>(
  movements: RunnerMovement[],
  deps: RunnerDeps<T>,
  hooks: RunnerHooks
): Promise<RunnerResult> {
  const docs: DocEntry[] = [];
  for (const mov of movements) {
    mov.documentUrls.forEach((url, i) => {
      docs.push({ mov, url, fileName: i === 0 ? mov.fileBase : `${mov.fileBase}_doc${i + 1}` });
    });
  }
  const total = docs.length;
  const stats = emptyStats(total);
  const missing = new Set<string>();
  let done = 0;
  let consecutiveBlocks = 0;

  const fail = (
    doc: DocEntry,
    kind: 'proveido' | 'adjunto',
    fileName: string,
    url: string,
    reason: MevFailureReason,
    detail: string
  ) => {
    stats.failedItems.push({
      kind,
      fileName,
      date: doc.mov.date,
      fojas: doc.mov.fojas,
      description: doc.mov.description,
      url,
      reason,
      detail,
      movementFileBase: doc.mov.fileBase,
    });
    if (reason === 'pendiente') stats.pending += 1;
    else if (kind === 'proveido') stats.proveidosFailed += 1;
    else stats.adjuntosFailed += 1;
    missing.add(doc.mov.fileBase);
  };

  const finish = (
    order: 'stop-save' | 'cancel',
    fromDoc: number,
    pendingAttachments: PendingAttachment[] = []
  ): RunnerResult => {
    if (order === 'cancel') {
      stats.missingFileBases = [...missing];
      return { outcome: 'cancelled', stats };
    }
    for (const a of pendingAttachments) fail(a.doc, 'adjunto', a.fileName, a.url, 'pendiente', '');
    for (let k = fromDoc; k < docs.length; k++) {
      const doc = docs[k];
      fail(doc, 'proveido', `${doc.fileName}.pdf`, doc.url, 'pendiente', '');
    }
    stats.missingFileBases = [...missing];
    return { outcome: 'partial', stats };
  };

  /** Pausa por bloqueo: devuelve 'retry' o la orden de detener. */
  const resolveBlock = async (reason: BlockReason): Promise<'retry' | 'stop-save' | 'cancel'> => {
    let current: BlockReason = reason;
    for (;;) {
      const waitMs = blockWaitMs(consecutiveBlocks);
      const choice = await hooks.onBlocked({ reason: current, done, total, waitMs });
      if (choice === 'stop-save' || choice === 'cancel') return choice;
      if (current === 'desafio') {
        consecutiveBlocks += 1;
        let left = waitMs;
        while (left > 0) {
          const stop = hooks.shouldStop();
          if (stop) return stop;
          hooks.onWaiting({ secondsLeft: Math.ceil(left / 1000), done, total });
          const step = Math.min(WAIT_TICK_MS, left);
          await deps.sleep(step);
          left -= step;
        }
        return 'retry';
      }
      // Sesión cerrada: el usuario avisa que ya entró en otra pestaña. El
      // reingreso a la ficha deja la causa en la sesión nueva.
      await deps.pace();
      const entry = await deps.enterCase();
      if (entry.status === 'desafio' || entry.status === 'login') {
        current = entry.status;
        continue;
      }
      return 'retry';
    }
  };

  for (let di = 0; di < docs.length; di++) {
    const doc = docs[di];
    hooks.onProgress({ done, total });

    let page: { data: T } | null = null;
    let failure: { reason: MevFailureReason; detail: string } | null = null;
    let reentered = false;
    let retried = false;

    while (!page && !failure) {
      const stop = hooks.shouldStop();
      if (stop) return finish(stop, di);
      await deps.pace();
      const got = await deps.fetchProveido(doc.url);
      if (got.status === 'ok') {
        page = { data: got.data };
        consecutiveBlocks = 0;
      } else if (got.status === 'desafio' || got.status === 'login') {
        const next = await resolveBlock(got.status);
        if (next !== 'retry') return finish(next, di);
      } else if (got.status === 'sin-contexto' && !reentered) {
        reentered = true;
        await deps.pace();
        const entry = await deps.enterCase();
        if (entry.status === 'desafio' || entry.status === 'login') {
          const next = await resolveBlock(entry.status);
          if (next !== 'retry') return finish(next, di);
        }
      } else if ((got.status === 'respuesta-inesperada' || got.status === 'error') && !retried) {
        retried = true;
      } else {
        failure = { reason: got.status, detail: got.detail };
      }
    }

    if (!page) {
      if (failure) fail(doc, 'proveido', `${doc.fileName}.pdf`, doc.url, failure.reason, failure.detail);
      done += 1;
      continue;
    }

    try {
      await deps.saveProveido(doc.fileName, doc.mov, doc.url, page.data);
      stats.proveidosDownloaded += 1;
    } catch (err) {
      fail(doc, 'proveido', `${doc.fileName}.pdf`, doc.url, 'error', err instanceof Error ? err.message : String(err));
    }

    const adjuntos = deps.adjuntoUrls(page.data);
    for (let ai = 0; ai < adjuntos.length; ai++) {
      const url = adjuntos[ai];
      const fileName = `${doc.fileName}_adjunto_${ai + 1}`;
      const restantes = (): PendingAttachment[] =>
        adjuntos.slice(ai).map((u, k) => ({ doc, url: u, fileName: `${doc.fileName}_adjunto_${ai + k + 1}` }));
      let attachmentRetried = false;
      for (;;) {
        const stop = hooks.shouldStop();
        if (stop) return finish(stop, di + 1, restantes());
        const mevHosted = deps.isMevHosted(url);
        if (mevHosted) await deps.pace();
        const got = await deps.fetchAttachment(url);
        if (got.status === 'ok') {
          await deps.saveAttachment(fileName, got.base64, got.mimeType);
          stats.adjuntosDownloaded += 1;
          consecutiveBlocks = 0;
          break;
        }
        if (got.status === 'desafio' || got.status === 'login') {
          const next = await resolveBlock(got.status);
          if (next !== 'retry') return finish(next, di + 1, restantes());
          continue;
        }
        if (mevHosted && !attachmentRetried) {
          attachmentRetried = true;
          continue;
        }
        fail(doc, 'adjunto', fileName, url, 'error', got.detail);
        break;
      }
    }
    done += 1;
  }

  hooks.onProgress({ done, total });
  stats.missingFileBases = [...missing];
  return { outcome: 'complete', stats };
}
```

- [ ] **Paso 4: correr y ver que pasan**

Run: `npm test`
Expected: PASS en los 12 de `mev-download-runner.test.ts`.

- [ ] **Paso 5: commit**

```bash
git add modules/pdf/mev-download-runner.ts tests/mev-download-runner.test.ts
git commit -m "Recorrido de la descarga MEV: nunca saltea por un bloqueo, pregunta, reingresa a la ficha si hace falta y anota lo que falta

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarea 7: pedidos a la MEV clasificados (`attachment-downloader.ts`) y utilidades de blob

**Archivos:**
- Crear: `modules/utils/blob.ts`
- Reescribir: `modules/pdf/attachment-downloader.ts`

- [ ] **Paso 1: crear `modules/utils/blob.ts`**

```ts
/** Blob a base64, sin el prefijo data:. */
export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const CHUNK = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)));
  }
  return btoa(parts.join(''));
}

/** Blob a data URI, para chrome.downloads.download desde el service worker. */
export async function blobToDataUri(blob: Blob, mime: string): Promise<string> {
  return `data:${mime};base64,${await blobToBase64(blob)}`;
}
```

- [ ] **Paso 2: reescribir `modules/pdf/attachment-downloader.ts` completo**

Las funciones inyectadas con `chrome.scripting.executeScript` se serializan: no pueden usar nada del módulo, por eso repiten sus expresiones regulares adentro.

```ts
/**
 * Pedidos a la MEV desde la pestaña del usuario (chrome.scripting en el
 * mundo MAIN, con las cookies de su sesión): proveídos, adjuntos y
 * reingreso a la ficha. Cada función hace UN pedido y clasifica la
 * respuesta; reintentos, esperas y ritmo los decide el recorrido de la
 * descarga (mev-download-runner.ts) con el portero (mev-pacer.ts).
 *
 * Excepción: los adjuntos de docs.scba.gov.ar, otro servidor, se piden
 * desde el service worker (host_permissions evita CORS) y conservan sus
 * reintentos propios porque ese servidor falla de a ratos.
 */

import { MEV_BASE_URL } from '@/modules/portals/mev-selectors';
import {
  classifyMevPage,
  describeProbe,
  htmlLooksLikeChallenge,
  htmlLooksLikeLogin,
  MEV_PROBE_SAMPLE_LENGTH,
  MEV_RAW_SAMPLE_LENGTH,
  type MevPageProbe,
} from '@/modules/portals/mev-challenge';
import type { AttachmentFetch, CaseEntry, PageFetch } from '@/modules/pdf/mev-download-runner';

/** Datos de la página de un proveído de la MEV. */
export interface ProveidoPageData {
  text: string;
  adjuntoUrls: string[];
  juzgadoName: string;
  departamento: string;
  datosExpediente: {
    caratula: string;
    fechaInicio: string;
    nroReceptoria: string;
    nroExpediente: string;
    estado: string;
  };
  pasoProcesal: {
    fecha: string;
    tramite: string;
    firmado: boolean;
    fojas: string;
  };
  referencias: {
    adjuntos: Array<{ nombre: string; url: string }>;
    despacho?: string;
    observacion?: string;
    observacionProfesional?: string;
    rawFields: Array<{ label: string; value: string }>;
  };
  datosPresentacion?: {
    fechaEscrito?: string;
    firmadoPor?: string;
    nroPresentacionElectronica?: string;
    presentadoPor?: string;
  };
  /** Señales de la respuesta cruda, para clasificarla afuera. */
  probe?: MevPageProbe;
}

export function toAbsoluteMevUrl(url: string): string {
  return url.startsWith('http') ? url : `${MEV_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

/** true si el archivo se pide a la MEV (cuenta para el límite de pedidos). */
export function isMevHostedUrl(url: string): boolean {
  return !toAbsoluteMevUrl(url).includes('docs.scba.gov.ar');
}

/** Un pedido de adjunto. Los de docs.scba.gov.ar van por el service worker. */
export async function downloadMevAttachment(tabId: number, attachmentUrl: string): Promise<AttachmentFetch> {
  const fullUrl = toAbsoluteMevUrl(attachmentUrl);
  if (!isMevHostedUrl(fullUrl)) return downloadDocsScba(fullUrl, 3, 1500);

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: async (url: string, rawLength: number) => {
        try {
          const resp = await fetch(url, { credentials: 'include' });
          if (!resp.ok) return { error: `HTTP ${resp.status}` };
          const contentType = resp.headers.get('content-type') || 'application/pdf';
          const buffer = await resp.arrayBuffer();
          // Una respuesta HTML nunca es el adjunto: puede ser la pantalla de
          // verificación, el login o un error. Se devuelve el comienzo para
          // que el llamador distinga.
          if (contentType.includes('text/html')) {
            return {
              error: 'La MEV devolvió una página en vez del archivo',
              htmlSample: new TextDecoder('windows-1252').decode(buffer.slice(0, rawLength)),
            };
          }
          const bytes = new Uint8Array(buffer);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          return { base64: btoa(binary), mimeType: contentType, sizeBytes: buffer.byteLength };
        } catch (e) {
          return { error: String(e) };
        }
      },
      args: [fullUrl, MEV_RAW_SAMPLE_LENGTH],
    });

    const result = results[0]?.result as
      | { base64: string; mimeType: string; sizeBytes: number }
      | { error: string; htmlSample?: string }
      | null
      | undefined;
    if (!result) return { status: 'error', detail: 'La pestaña de la MEV no respondió' };
    if ('error' in result) {
      const sample = result.htmlSample ?? '';
      if (sample && htmlLooksLikeChallenge(sample)) {
        return { status: 'desafio', detail: 'pantalla de verificación en vez del adjunto' };
      }
      if (sample && htmlLooksLikeLogin(sample)) {
        return { status: 'login', detail: 'formulario de login en vez del adjunto' };
      }
      return { status: 'error', detail: result.error };
    }
    if (result.sizeBytes < 100) {
      return { status: 'error', detail: `Archivo demasiado chico (${result.sizeBytes} bytes)` };
    }
    return { status: 'ok', base64: result.base64, mimeType: result.mimeType };
  } catch (err) {
    return { status: 'error', detail: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Un pedido de proveído, parseado dentro de la pestaña de la MEV (así
 * DOMParser, fetch y las cookies funcionan) y clasificado afuera con
 * classifyMevPage.
 */
export async function fetchMevPageContent(tabId: number, url: string): Promise<PageFetch<ProveidoPageData>> {
  const fullUrl = toAbsoluteMevUrl(url);

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: async (pageUrl: string, sampleLength: number, rawLength: number) => {
        try {
          const resp = await fetch(pageUrl, { credentials: 'include' });
          if (!resp.ok) return { error: `HTTP ${resp.status}` };

          // La MEV es ASP clásico en Windows-1252: resp.text() rompería la ñ y el º.
          const rawBuffer = await resp.arrayBuffer();
          const html = new TextDecoder('windows-1252').decode(rawBuffer);
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');

          // Señales que se leen ANTES de sacar los scripts: el título y el
          // script de Turnstile son la firma de la pantalla de verificación.
          const title = (doc.title || '').trim();
          const hasTurnstile = Array.from(doc.querySelectorAll('script[src]')).some((s) =>
            /challenges\.cloudflare\.com\/turnstile/i.test(s.getAttribute('src') || '')
          );
          const looksLikeLogin =
            !!doc.querySelector("input[name='usuario']") && !!doc.querySelector("input[name='clave']");
          let finalPath = '';
          try {
            finalPath = new URL(resp.url).pathname.toLowerCase();
          } catch {
            finalPath = '';
          }

          doc.querySelectorAll('script, style, noscript, link, meta').forEach((el) => el.remove());

          const allTds = Array.from(doc.querySelectorAll('td'));
          const findTdText = (prefix: string): string => {
            for (const td of allTds) {
              const t = td.textContent?.trim() ?? '';
              if (t.startsWith(prefix)) return t.replace(prefix, '').trim();
            }
            return '';
          };
          const findTdContaining = (keyword: string): string => {
            for (const td of allTds) {
              const t = td.textContent?.trim() ?? '';
              if (t.includes(keyword) && !t.includes('UsuarioMEV') && !t.includes('Usuario apto')) return t.trim();
            }
            return '';
          };

          // Juzgado y departamento
          let juzgadoName = '';
          let departamento = '';
          for (const td of allTds) {
            const t = td.textContent?.trim() ?? '';
            if (t.includes('UsuarioMEV') || t.includes('Usuario apto') || t.includes('Nombre:')) continue;
            if ((t.includes('Juzgado') || t.includes('CAMARA') || t.includes('TRIBUNAL') || t.includes('Cámara') || t.includes('Tribunal'))
                && t.length >= 10 && t.length <= 200 && !juzgadoName) {
              juzgadoName = t;
              const row = td.closest('tr');
              if (row) {
                const cells = row.querySelectorAll('td');
                for (const cell of cells) {
                  const ct = cell.textContent?.trim() ?? '';
                  if (ct !== t && ct.length > 3 && ct.length < 100
                      && !ct.includes('UsuarioMEV') && !ct.includes('Usuario apto') && !ct.includes('Nombre:')
                      && !ct.includes('Volver') && !ct.includes('Desconectarse') && !ct.includes('Imprimir')) {
                    departamento = ct;
                    break;
                  }
                }
              }
            }
          }

          // Datos del expediente
          const caratula = findTdText('Carátula:') || findTdText('Caratula:');
          const fechaInicio = findTdText('Fecha inicio:');
          let nroReceptoria = '';
          const recMatch = findTdContaining('Receptoría:') || findTdContaining('Receptor');
          if (recMatch) {
            const m = recMatch.match(/Receptor[ií]a?:\s*(.*)/i);
            if (m) nroReceptoria = m[1].trim();
          }
          let nroExpediente = '';
          const expTd = findTdText('Expediente:') || findTdText('Nº de Expediente:');
          if (expTd) nroExpediente = expTd;
          for (const td of allTds) {
            const t = td.textContent?.trim() ?? '';
            if (t.includes('Expediente:') && !t.includes('Receptoría') && !nroExpediente) {
              nroExpediente = t.replace(/.*Expediente:\s*/i, '').trim();
            }
          }
          const estado = findTdText('Estado:');

          // Paso procesal (combo o texto visible)
          let pasoFecha = '';
          let pasoTramite = '';
          let pasoFirmado = false;
          let pasoFojas = '';
          const selectEl = doc.querySelector('select[name*="Paso"], select[name*="paso"]') as HTMLSelectElement | null;
          if (selectEl) {
            const selectedOpt = selectEl.options[selectEl.selectedIndex];
            if (selectedOpt) {
              const optText = selectedOpt.textContent?.trim() ?? '';
              const fechaMatch = optText.match(/Fecha:\s*(\d{2}\/\d{2}\/\d{4})/);
              if (fechaMatch) pasoFecha = fechaMatch[1];
              const tramMatch = optText.match(/Tr[aá]mite:\s*(.*?)(?:\s*-\s*\(\s*FIRMADO\s*\)|\s*-\s*Foja)/i);
              if (tramMatch) pasoTramite = tramMatch[1].trim();
              pasoFirmado = /FIRMADO/i.test(optText);
              const fojaMatch = optText.match(/Foja[s]?:\s*([\d\/]+)/i);
              if (fojaMatch) pasoFojas = fojaMatch[1];
            }
          }
          if (!pasoFecha) {
            const allSelects = doc.querySelectorAll('select');
            for (const sel of allSelects) {
              const opt = (sel as HTMLSelectElement).options[(sel as HTMLSelectElement).selectedIndex];
              if (opt) {
                const t = opt.textContent?.trim() ?? '';
                if (t.includes('Fecha:') && t.includes('Foja')) {
                  const fm = t.match(/Fecha:\s*(\d{2}\/\d{2}\/\d{4})/);
                  if (fm) pasoFecha = fm[1];
                  const tm = t.match(/Tr[aá]mite:\s*(.*?)(?:\s*-\s*\(\s*FIRMADO\s*\)|\s*-\s*Foja)/i);
                  if (tm) pasoTramite = tm[1].trim();
                  pasoFirmado = /FIRMADO/i.test(t);
                  const fom = t.match(/Foja[s]?:\s*([\d\/]+)/i);
                  if (fom) pasoFojas = fom[1];
                  break;
                }
              }
            }
          }

          // REFERENCIAS
          const adjuntos: Array<{ nombre: string; url: string }> = [];
          let despacho = '';
          let observacion = '';
          let observacionProfesional = '';
          const rawFields: Array<{ label: string; value: string }> = [];
          let inRef = false;
          for (const td of allTds) {
            const t = td.textContent?.trim() ?? '';
            if (t === 'REFERENCIAS') {
              inRef = true;
              continue;
            }
            if (inRef) {
              if (t.includes('DATOS DE PRESENTACI') || t.includes('Texto del Prove')) break;
              if (!t || t.length < 3) continue;
              const colonIdx = t.indexOf(':');
              if (colonIdx > 0 && colonIdx < 60) {
                const label = t.substring(0, colonIdx).trim();
                const value = t.substring(colonIdx + 1).trim();
                rawFields.push({ label, value });
                if (label.startsWith('Despachado en')) despacho = value;
                else if (label === 'Observacion' || label === 'Observación') observacion = value;
                else if (label.startsWith('Observaci') && label.includes('Profesional')) observacionProfesional = value;
              } else if (t.length > 3) {
                rawFields.push({ label: t, value: '' });
              }
            }
          }

          // Adjuntos (links VER ADJUNTO)
          doc.querySelectorAll('a').forEach((a) => {
            const linkText = a.textContent?.toUpperCase().trim() ?? '';
            if (linkText.includes('VER ADJUNTO') || linkText.includes('ADJUNTO')) {
              const href = a.getAttribute('href');
              if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
              let nombre = '';
              const parent = a.parentElement;
              if (parent) {
                const parentText = parent.textContent?.trim() ?? '';
                nombre = parentText.replace(/VER ADJUNTO/gi, '').trim();
              }
              try {
                const absolute = new URL(href, 'https://mev.scba.gov.ar/').href;
                adjuntos.push({ nombre: nombre || 'Adjunto', url: absolute });
              } catch { /* href roto: se saltea */ }
            }
          });

          // DATOS DE PRESENTACIÓN
          let fechaEscrito = '';
          let firmadoPor = '';
          let nroPresentacionElectronica = '';
          let presentadoPor = '';
          for (const td of allTds) {
            const t = td.textContent?.trim() ?? '';
            if (t.startsWith('Fecha del Escrito')) {
              fechaEscrito = t.replace(/^Fecha del Escrito\s*/i, '').trim();
            } else if (t.startsWith('Firmado por')) {
              firmadoPor = t.replace(/^Firmado por\s*/i, '').trim();
            } else if (t.startsWith('Nro. Presentación') || t.startsWith('Nro. Presentaci')) {
              nroPresentacionElectronica = t.replace(/^Nro\.\s*Presentaci[oó]n\s*Electr[oó]nica\s*/i, '').trim();
            } else if (t.startsWith('Presentado por')) {
              presentadoPor = t.replace(/^Presentado por\s*/i, '').trim();
            }
          }
          const hasDatosPresentacion = fechaEscrito || firmadoPor || nroPresentacionElectronica || presentadoPor;

          // Texto del proveído (#contenidoTxt)
          const contentDiv = doc.getElementById('contenidoTxt');
          let text = '';
          if (contentDiv) {
            text = contentDiv.innerText?.trim() ?? contentDiv.textContent?.trim() ?? '';
          } else {
            text = doc.body?.innerText?.trim() ?? doc.body?.textContent?.trim() ?? '';
          }
          text = text.replace(/^[- ]*Para copiar y pegar el texto seleccione.*$/gm, '');
          text = text.replace(/\r\n/g, '\n').replace(/[ \t]{2,}/g, ' ').replace(/\n{4,}/g, '\n\n\n').trim();

          // Marcas estructurales de un proveído (regla de oro de la clasificación).
          const hasProveidoStructure =
            !!contentDiv ||
            !!selectEl ||
            allTds.some((td) => /^car[aá]tula\s*:/i.test(td.textContent?.trim() ?? '')) ||
            allTds.some((td) => (td.textContent?.trim() ?? '') === 'REFERENCIAS');
          const bodyTextSample = (doc.body?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, sampleLength);

          return {
            probe: {
              htmlLength: html.length,
              bodyTextSample,
              hasProveidoStructure,
              title,
              hasTurnstile,
              finalPath,
              looksLikeLogin,
              rawHtmlSample: html.slice(0, rawLength),
            },
            text,
            adjuntoUrls: adjuntos.map((a) => a.url),
            juzgadoName,
            departamento,
            datosExpediente: { caratula, fechaInicio, nroReceptoria, nroExpediente, estado },
            pasoProcesal: { fecha: pasoFecha, tramite: pasoTramite, firmado: pasoFirmado, fojas: pasoFojas },
            referencias: { adjuntos, despacho, observacion, observacionProfesional, rawFields },
            datosPresentacion: hasDatosPresentacion
              ? { fechaEscrito, firmadoPor, nroPresentacionElectronica, presentadoPor }
              : undefined,
          };
        } catch (e) {
          return { error: String(e) };
        }
      },
      args: [fullUrl, MEV_PROBE_SAMPLE_LENGTH, MEV_RAW_SAMPLE_LENGTH],
    });

    const result = results[0]?.result as ProveidoPageData | { error: string } | null | undefined;
    if (!result) return { status: 'error', detail: 'La pestaña de la MEV no respondió' };
    if ('error' in result) return { status: 'error', detail: result.error };

    const verdict = result.probe ? classifyMevPage(result.probe) : { status: 'ok' as const };
    if (verdict.status === 'ok') return { status: 'ok', data: result };

    console.warn(
      `[ProcuAsist] La MEV no devolvió el proveído (${verdict.status}${verdict.marker ? ': ' + verdict.marker : ''}):`,
      fullUrl
    );
    return { status: verdict.status, detail: result.probe ? describeProbe(result.probe) : '' };
  } catch (err) {
    return { status: 'error', detail: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Reingresa a la ficha de la causa (procesales.asp). Sirve para que la
 * sesión vuelva a tener la causa: sin esa visita, proveido.asp redirige a
 * la búsqueda (medido el 22/09/2026).
 */
export async function enterMevCase(tabId: number, caseUrl: string): Promise<CaseEntry> {
  const fullUrl = toAbsoluteMevUrl(caseUrl);
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: async (url: string, rawLength: number) => {
        try {
          const resp = await fetch(url, { credentials: 'include' });
          if (!resp.ok) return { error: `HTTP ${resp.status}` };
          const html = new TextDecoder('windows-1252').decode(await resp.arrayBuffer());
          return { hasSteps: /Pasos Procesales/i.test(html), sample: html.slice(0, rawLength), length: html.length };
        } catch (e) {
          return { error: String(e) };
        }
      },
      args: [fullUrl, MEV_RAW_SAMPLE_LENGTH],
    });
    const r = results[0]?.result as
      | { hasSteps: boolean; sample: string; length: number }
      | { error: string }
      | null
      | undefined;
    if (!r) return { status: 'error', detail: 'La pestaña de la MEV no respondió' };
    if ('error' in r) return { status: 'error', detail: r.error };
    if (r.hasSteps) return { status: 'ok', detail: '' };
    if (htmlLooksLikeChallenge(r.sample)) {
      return { status: 'desafio', detail: 'pantalla de verificación al reingresar a la ficha' };
    }
    if (htmlLooksLikeLogin(r.sample)) {
      return { status: 'login', detail: 'formulario de login al reingresar a la ficha' };
    }
    return { status: 'error', detail: `la ficha no se pudo abrir (${r.length} caracteres)` };
  } catch (err) {
    return { status: 'error', detail: err instanceof Error ? err.message : String(err) };
  }
}

/** Una pestaña abierta de la MEV (la usa el importador de resultados). */
export async function findMevTab(): Promise<number | null> {
  const tabs = await chrome.tabs.query({ url: 'https://mev.scba.gov.ar/*' });
  return tabs[0]?.id ?? null;
}

/**
 * docs.scba.gov.ar: servidor público de archivos sin cabeceras CORS. Se
 * pide desde el service worker (host_permissions lo permite) y con
 * reintentos, porque ese servidor falla de a ratos. No cuenta para el
 * límite de la MEV (otro servidor).
 */
async function downloadDocsScba(url: string, maxRetries: number, delayMs: number): Promise<AttachmentFetch> {
  let lastError = 'error desconocido';
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, delayMs * attempt));
    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        lastError = `HTTP ${resp.status}`;
        continue;
      }
      const contentType = resp.headers.get('content-type') ?? 'application/pdf';
      if (contentType.includes('text/html')) {
        lastError = 'El servidor devolvió una página en vez del archivo';
        continue;
      }
      const buffer = await resp.arrayBuffer();
      if (buffer.byteLength < 100) {
        lastError = `Archivo demasiado chico (${buffer.byteLength} bytes)`;
        continue;
      }
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      return { status: 'ok', base64: btoa(binary), mimeType: contentType };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  return { status: 'error', detail: `${lastError} (tras ${maxRetries} reintentos)` };
}
```

- [ ] **Paso 3: compilar**

Run: `npm run compile`
Expected: errores solo en `case-zip-generator.ts` y `message-router.ts` (usan la API vieja); se arreglan en las Tareas 8 y 10. Ningún error en `attachment-downloader.ts` ni en `modules/utils/blob.ts`.

- [ ] **Paso 4: commit**

```bash
git add modules/utils/blob.ts modules/pdf/attachment-downloader.ts
git commit -m "Cada pedido a la MEV hace uno solo y dice que devolvio: proveido, adjunto y reingreso a la ficha

Los reintentos y el ritmo pasan al recorrido de la descarga. La sonda lee
titulo, script de Turnstile, ruta final y formulario de login antes de
sacar los scripts de la pagina.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarea 8: armado del ZIP y del PDF único (`case-zip-generator.ts`) y protocolo del canal

**Archivos:**
- Crear: `modules/messages/mev-download.ts`
- Reescribir: `modules/pdf/case-zip-generator.ts`

- [ ] **Paso 1: crear `modules/messages/mev-download.ts`**

```ts
/**
 * Canal entre la pestaña de la MEV y el fondo de la extensión para la
 * descarga de un expediente (chrome.runtime.connect). Un canal y no un
 * mensaje suelto: Chrome termina el service worker si un solo mensaje tarda
 * más de 5 minutos, y una descarga que respeta el límite de la MEV tarda
 * más que eso en un expediente grande. Los mensajes por el canal lo
 * mantienen vivo (Chrome 114 o posterior).
 */

import type { BlockChoice, BlockReason } from '@/modules/pdf/mev-download-runner';
import type { MevDownloadStats } from '@/modules/pdf/download-report';

export const MEV_DOWNLOAD_PORT = 'mev-download';

export interface MevDownloadMovement {
  date: string;
  fojas?: string;
  description: string;
  type?: string;
  hasDocuments: boolean;
  documentUrls: string[];
  /** Nombre base del archivo, calculado sobre la lista completa de la ficha. */
  fileBase: string;
}

export interface MevDownloadCaseData {
  caseNumber: string;
  title: string;
  court: string;
  portal: string;
  portalUrl: string;
  fechaInicio?: string;
  estadoPortal?: string;
  numeroReceptoria?: string;
  /** Todos los movimientos de la ficha, en el orden de la MEV, para el resumen. */
  allMovements: Array<{ date: string; fojas?: string; description: string; type?: string; hasDocuments: boolean }>;
  /** Movimientos elegidos para bajar, en el orden de la MEV (más nuevo primero). */
  movements: MevDownloadMovement[];
}

export type MevDownloadClientMessage =
  | { type: 'start'; caseData: MevDownloadCaseData; format: 'zip' | 'pdf' }
  | { type: 'answer'; choice: BlockChoice }
  | { type: 'stop'; save: boolean };

export type MevDownloadServerMessage =
  | { type: 'progress'; done: number; total: number; etaSeconds: number }
  | { type: 'paused'; reason: BlockReason; done: number; total: number; waitSeconds: number }
  | { type: 'waiting'; secondsLeft: number; done: number; total: number }
  | { type: 'keepalive' }
  | { type: 'building' }
  | { type: 'result'; outcome: 'complete' | 'partial'; filename: string; stats: MevDownloadStats }
  | { type: 'cancelled' }
  | { type: 'error'; message: string };
```

- [ ] **Paso 2: reescribir `modules/pdf/case-zip-generator.ts` completo**

```ts
/**
 * Descarga de un expediente de la MEV: arma el ZIP (un PDF por paso y sus
 * adjuntos) o un PDF único, con el recorrido de mev-download-runner.ts.
 *
 * Contenido del ZIP:
 *   <numero>_expte_completo/
 *     resumen.pdf                                  todos los movimientos de la ficha
 *     AAAA-MM-DD_fs-X_DESCRIPCION.pdf              un PDF por paso procesal
 *     AAAA-MM-DD_fs-X_DESCRIPCION_adjunto_N.ext    adjuntos del paso
 *     _verificacion_AAAA-MM-DD_HHMM.txt           solo si falta algo
 */

import JSZip from 'jszip';
import { generateCasePdfBlob, type PdfCaseData } from './case-pdf-generator';
import { generateProveidoPdf, generateTextReportPdf } from './proveido-pdf-generator';
import {
  downloadMevAttachment,
  enterMevCase,
  fetchMevPageContent,
  isMevHostedUrl,
  toAbsoluteMevUrl,
  type ProveidoPageData,
} from './attachment-downloader';
import { mergePdfParts, type MergedPdfPart } from './merged-pdf-generator';
import { runMevDownload, type RunnerHooks } from './mev-download-runner';
import { buildVerificationLines, type MevDownloadStats } from './download-report';
import { verificationFileName } from './file-naming';
import { realClock, type MevPacer } from '@/modules/portals/mev-pacer';
import type { MevDownloadCaseData } from '@/modules/messages/mev-download';
import { blobToBase64 } from '@/modules/utils/blob';

export interface CaseDownloadResult {
  outcome: 'complete' | 'partial' | 'cancelled';
  blob?: Blob;
  filename?: string;
  stats: MevDownloadStats;
  error?: string;
}

export async function generateCaseDownload(
  data: MevDownloadCaseData,
  tabId: number,
  format: 'zip' | 'pdf',
  hooks: RunnerHooks,
  pacer: MevPacer
): Promise<CaseDownloadResult> {
  const zip = new JSZip();
  const safeNumber = data.caseNumber.replace(/[^a-zA-Z0-9-]/g, '_');
  const folder = zip.folder(`${safeNumber}_expte_completo`);
  if (!folder) throw new Error('No se pudo crear la carpeta dentro del ZIP');
  const mergeParts: MergedPdfPart[] = [];

  // El resumen lista TODOS los movimientos de la ficha: una descarga parcial
  // posterior lo reemplaza por uno completo y al día.
  const pdfData: PdfCaseData = {
    caseNumber: data.caseNumber,
    title: data.title,
    court: data.court,
    portal: data.portal,
    portalUrl: data.portalUrl,
    fechaInicio: data.fechaInicio,
    estadoPortal: data.estadoPortal,
    numeroReceptoria: data.numeroReceptoria,
    movements: data.allMovements.map((m) => ({
      date: m.date,
      fojas: m.fojas,
      description: m.description,
      type: m.type,
      hasDocuments: m.hasDocuments,
    })),
    attachments: [],
  };
  const resumenBlob = generateCasePdfBlob(pdfData);
  folder.file('resumen.pdf', resumenBlob);

  // La MEV lista del más nuevo al más viejo: se baja del más viejo al más
  // nuevo, que es el orden del PDF único.
  const oldestFirst = data.movements
    .filter((m) => m.hasDocuments && m.documentUrls.length > 0)
    .slice()
    .reverse();

  const run = await runMevDownload<ProveidoPageData>(
    oldestFirst,
    {
      pace: () => pacer.wait(),
      sleep: realClock.sleep,
      fetchProveido: (url) => fetchMevPageContent(tabId, url),
      enterCase: () => enterMevCase(tabId, data.portalUrl),
      isMevHosted: isMevHostedUrl,
      fetchAttachment: (url) => downloadMevAttachment(tabId, url),
      adjuntoUrls: (page) => page.adjuntoUrls,
      saveProveido: async (fileName, mov, url, page) => {
        const blob = generateProveidoPdf({
          date: mov.date,
          fojas: mov.fojas,
          description: mov.description,
          caseNumber: data.caseNumber,
          title: data.title,
          court: data.court,
          content: page.text,
          sourceUrl: toAbsoluteMevUrl(url),
          juzgadoName: page.juzgadoName,
          departamento: page.departamento,
          datosExpediente: page.datosExpediente,
          pasoProcesal: page.pasoProcesal,
          referencias: page.referencias,
          datosPresentacion: page.datosPresentacion,
        });
        folder.file(`${fileName}.pdf`, blob);
        if (format === 'pdf') {
          mergeParts.push({ label: fileName, base64: await blobToBase64(blob), mimeType: 'application/pdf' });
        }
      },
      saveAttachment: async (fileName, base64, mimeType) => {
        const ext = getExtensionFromMime(mimeType);
        folder.file(`${fileName}${ext}`, base64, { base64: true });
        if (format === 'pdf') mergeParts.push({ label: `${fileName}${ext}`, base64, mimeType });
      },
    },
    hooks
  );

  if (run.outcome === 'cancelled') return { outcome: 'cancelled', stats: run.stats };
  const outcome = run.outcome;

  if (run.stats.failedItems.length > 0) {
    const now = new Date();
    const lines = buildVerificationLines({ caseNumber: data.caseNumber, generatedAt: now, outcome, stats: run.stats });
    folder.file(verificationFileName(now), lines.join('\n'));
    // En el PDF único el .txt no llega al usuario: va como última página.
    if (format === 'pdf') {
      try {
        const verBlob = generateTextReportPdf(`Verificación de descarga, expediente ${data.caseNumber}`, lines);
        mergeParts.push({ label: '_verificacion', base64: await blobToBase64(verBlob), mimeType: 'application/pdf' });
      } catch (err) {
        console.warn('[ProcuAsist] No se pudo agregar la página de verificación:', err);
      }
    }
  }

  try {
    if (format === 'pdf') {
      const resumenBytes = new Uint8Array(await resumenBlob.arrayBuffer());
      const { blob } = await mergePdfParts(resumenBytes, mergeParts);
      return { outcome, blob, filename: `expediente_${safeNumber}.pdf`, stats: run.stats };
    }
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    return { outcome, blob, filename: `expediente_${safeNumber}.zip`, stats: run.stats };
  } catch (err) {
    return {
      outcome,
      stats: run.stats,
      error: `No se pudo armar el archivo: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function getExtensionFromMime(mimeType: string): string {
  const clean = mimeType.split(';')[0].trim().toLowerCase();
  const map: Record<string, string> = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/tiff': '.tif',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'text/html': '.html',
    'text/plain': '.txt',
  };
  return map[clean] ?? '.bin';
}
```

- [ ] **Paso 3: compilar**

Run: `npm run compile`
Expected: errores solo en `message-router.ts` (importa `generateCaseZip` y el `downloadMevAttachment` viejo). Se arreglan en la Tarea 10.

- [ ] **Paso 4: commit**

```bash
git add modules/messages/mev-download.ts modules/pdf/case-zip-generator.ts
git commit -m "El ZIP y el PDF unico se arman con el recorrido nuevo: nombres por fecha, resumen de toda la ficha e informe fechado

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarea 9: el trabajo en el service worker (`mev-download-job.ts`)

**Archivos:**
- Crear: `entrypoints/background/mev-download-job.ts`

- [ ] **Paso 1: implementar**

```ts
/**
 * Descarga de expedientes MEV en el service worker, detrás del canal
 * 'mev-download' (modules/messages/mev-download.ts).
 *
 * El trabajo corre fuera del evento que lo inicia: así ningún evento dura
 * más de los 5 minutos que Chrome tolera, y los mensajes por el canal
 * (progreso, cuenta regresiva y un latido cada 20 s mientras se espera una
 * respuesta) mantienen vivo el service worker. Si la pestaña se cierra o
 * cambia de página, el canal se corta y la descarga se cancela sin pedir
 * nada más a la MEV.
 */

import {
  MEV_DOWNLOAD_PORT,
  type MevDownloadClientMessage,
  type MevDownloadServerMessage,
} from '@/modules/messages/mev-download';
import { generateCaseDownload } from '@/modules/pdf/case-zip-generator';
import type { BlockChoice, StopRequest } from '@/modules/pdf/mev-download-runner';
import { createMevPacer, MEV_MIN_INTERVAL_MS, realClock } from '@/modules/portals/mev-pacer';
import { blobToDataUri } from '@/modules/utils/blob';

/** Un solo portero para todas las descargas: comparten el cupo de la MEV. */
const pacer = createMevPacer(realClock);

const KEEPALIVE_MS = 20_000;

let activeJobs = 0;
let scanPending = false;
let runPostponedScan: (() => Promise<unknown>) | null = null;

/** true mientras haya una descarga MEV en curso. */
export function isMevDownloadActive(): boolean {
  return activeJobs > 0;
}

/** El escaneo del monitoreo se salteó la MEV por una descarga: correrlo al terminar. */
export function requestScanAfterDownloads(): void {
  scanPending = true;
}

export function setupMevDownloadPort(options: { runPostponedScan: () => Promise<unknown> }): void {
  runPostponedScan = options.runPostponedScan;
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== MEV_DOWNLOAD_PORT) return;
    const tabId = port.sender?.tab?.id;
    if (tabId === undefined) {
      port.disconnect();
      return;
    }
    handlePort(port, tabId);
  });
}

function estimateEtaSeconds(done: number, total: number): number {
  return Math.round(((total - done) * (MEV_MIN_INTERVAL_MS + 300)) / 1000);
}

function handlePort(port: chrome.runtime.Port, tabId: number): void {
  let started = false;
  let disconnected = false;
  let stopRequest: StopRequest = null;
  let pendingAnswer: ((choice: BlockChoice) => void) | null = null;

  const post = (message: MevDownloadServerMessage) => {
    if (disconnected) return;
    try {
      port.postMessage(message);
    } catch {
      disconnected = true;
    }
  };

  const answer = (choice: BlockChoice) => {
    const resolve = pendingAnswer;
    pendingAnswer = null;
    resolve?.(choice);
  };

  port.onDisconnect.addListener(() => {
    disconnected = true;
    stopRequest = 'cancel';
    answer('cancel');
  });

  port.onMessage.addListener((message: MevDownloadClientMessage) => {
    if (message.type === 'start' && !started) {
      started = true;
      void runJob(message.caseData, message.format);
    } else if (message.type === 'answer') {
      answer(message.choice);
    } else if (message.type === 'stop') {
      stopRequest = message.save ? 'stop-save' : 'cancel';
      answer(stopRequest);
    }
  });

  async function runJob(
    caseData: Extract<MevDownloadClientMessage, { type: 'start' }>['caseData'],
    format: 'zip' | 'pdf'
  ): Promise<void> {
    activeJobs += 1;
    try {
      const result = await generateCaseDownload(
        caseData,
        tabId,
        format,
        {
          onProgress: ({ done, total }) =>
            post({ type: 'progress', done, total, etaSeconds: estimateEtaSeconds(done, total) }),
          onBlocked: ({ reason, done, total, waitMs }) =>
            new Promise<BlockChoice>((resolve) => {
              if (stopRequest) {
                resolve(stopRequest);
                return;
              }
              const beat = setInterval(() => post({ type: 'keepalive' }), KEEPALIVE_MS);
              pendingAnswer = (choice) => {
                clearInterval(beat);
                resolve(choice);
              };
              post({ type: 'paused', reason, done, total, waitSeconds: Math.round(waitMs / 1000) });
            }),
          onWaiting: ({ secondsLeft, done, total }) => post({ type: 'waiting', secondsLeft, done, total }),
          shouldStop: () => stopRequest,
        },
        pacer
      );

      if (result.outcome === 'cancelled' || disconnected) {
        post({ type: 'cancelled' });
        return;
      }
      if (!result.blob || !result.filename) {
        post({ type: 'error', message: result.error ?? 'No se pudo armar el archivo.' });
        return;
      }
      post({ type: 'building' });
      const mime = format === 'pdf' ? 'application/pdf' : 'application/zip';
      const dataUri = await blobToDataUri(result.blob, mime);
      await chrome.downloads.download({ url: dataUri, filename: result.filename, saveAs: true });
      post({ type: 'result', outcome: result.outcome, filename: result.filename, stats: result.stats });
    } catch (err) {
      console.error('[ProcuAsist] Descarga MEV:', err);
      post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      activeJobs -= 1;
      if (activeJobs === 0 && scanPending && runPostponedScan) {
        scanPending = false;
        void runPostponedScan().catch((err) =>
          console.warn('[ProcuAsist] Escaneo pospuesto por la descarga falló:', err)
        );
      }
    }
  }
}
```

- [ ] **Paso 2: compilar**

Run: `npm run compile`
Expected: sin errores nuevos en `mev-download-job.ts` (siguen solo los de `message-router.ts`).

- [ ] **Paso 3: commit**

```bash
git add entrypoints/background/mev-download-job.ts
git commit -m "La descarga MEV corre detras de un canal: no depende de un mensaje que Chrome corta a los 5 minutos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarea 10: registrar el canal y retirar los mensajes viejos

**Archivos:**
- Modificar: `entrypoints/background.ts`
- Modificar: `entrypoints/background/message-router.ts`
- Modificar: `modules/messages/types.ts`

- [ ] **Paso 1: `entrypoints/background.ts`**

Agregar los imports:

```ts
import { setupMevDownloadPort } from './background/mev-download-job';
import { scanMonitoredCases } from './background/case-monitor';
```

y, después de `setupMessageRouter();`:

```ts
  // Descarga de expedientes MEV por canal, no por mensaje suelto: una
  // descarga que respeta el límite de la MEV pasa los 5 minutos que Chrome
  // le da a un mensaje. Si el monitoreo se salteó la MEV por la descarga,
  // se corre al terminar.
  setupMevDownloadPort({ runPostponedScan: () => scanMonitoredCases() });
```

- [ ] **Paso 2: `entrypoints/background/message-router.ts`**

1. Borrar el import `import { generateCaseZip } from '@/modules/pdf/case-zip-generator';`.
2. Reemplazar el import de `attachment-downloader` por `import { findMevTab } from '@/modules/pdf/attachment-downloader';`.
3. Agregar `import { blobToDataUri } from '@/modules/utils/blob';`.
4. Borrar completos los `case 'GENERATE_ZIP': { ... }` y `case 'DOWNLOAD_ATTACHMENT': { ... }`.
5. Borrar la función local `async function blobToDataUri(blob: Blob, mime: string)` (ahora viene de `modules/utils/blob.ts`; la sigue usando `PJN_GENERATE_ZIP`).

- [ ] **Paso 3: `modules/messages/types.ts`**

Borrar las interfaces `GenerateZipMessage` y `DownloadAttachmentMessage` y sus dos entradas en la unión `ProcuAsistMessage`.

- [ ] **Paso 4: compilar**

Run: `npm run compile`
Expected: errores solo en `entrypoints/mev.content.ts` (manda `GENERATE_ZIP`), que se reescribe en la Tarea 12. Si aparece otro archivo que use `GENERATE_ZIP` o `DOWNLOAD_ATTACHMENT`, está fuera del mapa: detenerse y revisarlo.

- [ ] **Paso 5: commit**

```bash
git add entrypoints/background.ts entrypoints/background/message-router.ts modules/messages/types.ts
git commit -m "Se registra el canal de descarga y se retiran GENERATE_ZIP y DOWNLOAD_ATTACHMENT

DOWNLOAD_ATTACHMENT no tenia quien lo mandara. blobToDataUri pasa a un
modulo compartido con la descarga de PJN.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarea 11: pantalla de la descarga en la pestaña (`mev-download-ui.ts`)

**Archivos:**
- Crear: `modules/ui/mev-download-ui.ts`

- [ ] **Paso 1: implementar**

```ts
/**
 * Pantalla de la descarga de un expediente en la pestaña de la MEV: barra
 * de progreso con tiempo estimado y botón Detener, aviso de pausa cuando la
 * MEV bloquea, aviso de sesión cerrada y resumen final con "Bajar los que
 * faltan". Habla con el fondo por el canal de modules/messages/mev-download.ts.
 * Todo texto que viene del portal se inserta con textContent, nunca como HTML.
 */

import {
  MEV_DOWNLOAD_PORT,
  type MevDownloadCaseData,
  type MevDownloadClientMessage,
  type MevDownloadServerMessage,
} from '@/modules/messages/mev-download';
import { reasonLabel, type MevDownloadStats } from '@/modules/pdf/download-report';
import type { BlockChoice } from '@/modules/pdf/mev-download-runner';
import { createPortalModalButton, setPortalActionButtonState } from '@/modules/ui/portal-action-bar';
import { ICON_CHECK, ICON_LOADER, ICON_PACKAGE, ICON_X } from '@/modules/ui/icon-strings';
import { PORTAL_COLORS } from '@/modules/ui/portal-colors';

const MEV_PRIMARY = PORTAL_COLORS.mev.primary;
const DANGER = '#dc2626';
const WARNING = '#b45309';
const MEV_LOGIN_URL = 'https://mev.scba.gov.ar/loguin.asp';

let running = false;

/** true mientras esta pestaña tenga una descarga en curso. */
export function isMevDownloadRunning(): boolean {
  return running;
}

export interface StartMevDownloadOptions {
  caseData: MevDownloadCaseData;
  format: 'zip' | 'pdf';
  /** Botón "Descargar" de la botonera, para mostrar el estado. */
  button: HTMLButtonElement;
}

export function startMevDownload(options: StartMevDownloadOptions): void {
  if (running) return;
  running = true;
  const { button } = options;
  button.disabled = true;
  setPortalActionButtonState(button, ICON_LOADER, 'Descargando', 'muted');

  const panel = createProgressPanel();
  let finished = false;
  let pauseOverlay: HTMLElement | null = null;

  const onBeforeUnload = (event: BeforeUnloadEvent) => {
    event.preventDefault();
    event.returnValue = '';
  };
  window.addEventListener('beforeunload', onBeforeUnload);

  const port = chrome.runtime.connect({ name: MEV_DOWNLOAD_PORT });
  const send = (message: MevDownloadClientMessage) => {
    try {
      port.postMessage(message);
    } catch {
      // canal cerrado: lo informa onDisconnect
    }
  };

  const closePause = () => {
    pauseOverlay?.remove();
    pauseOverlay = null;
  };

  const end = (variant: 'success' | 'warning' | 'danger', label: string) => {
    finished = true;
    running = false;
    window.removeEventListener('beforeunload', onBeforeUnload);
    closePause();
    panel.remove();
    setPortalActionButtonState(button, variant === 'danger' ? ICON_X : ICON_CHECK, label, variant);
    button.disabled = false;
    window.setTimeout(() => setPortalActionButtonState(button, ICON_PACKAGE, 'Descargar', 'primary'), 8000);
    try {
      port.disconnect();
    } catch {
      // ya estaba cerrado
    }
  };

  panel.stopButton.addEventListener('click', () => {
    if (finished) return;
    showStopDialog({
      onSave: () => send({ type: 'stop', save: true }),
      onCancel: () => send({ type: 'stop', save: false }),
    });
  });

  port.onMessage.addListener((message: MevDownloadServerMessage) => {
    switch (message.type) {
      case 'progress':
        closePause();
        panel.update(
          message.done,
          message.total,
          `Documento ${Math.min(message.done + 1, message.total)} de ${message.total}, ${formatEta(message.etaSeconds)}`
        );
        break;
      case 'waiting':
        panel.update(
          message.done,
          message.total,
          `Pausa pedida por la MEV: sigo en ${message.secondsLeft} s (${message.done} de ${message.total})`
        );
        break;
      case 'paused':
        closePause();
        pauseOverlay = showPauseDialog(message, (choice) => {
          pauseOverlay = null;
          send({ type: 'answer', choice });
        });
        panel.update(
          message.done,
          message.total,
          message.reason === 'desafio' ? 'En pausa: la MEV pidió una pausa' : 'En pausa: se cerró la sesión de la MEV'
        );
        break;
      case 'keepalive':
        break;
      case 'building':
        panel.update(1, 1, 'Armando el archivo...');
        break;
      case 'result': {
        const stats = message.stats;
        if (stats.failedItems.length === 0) {
          end('success', 'Listo');
          break;
        }
        end('warning', 'Con faltantes');
        showResultDialog(message.outcome, stats, () => {
          const again = options.caseData.movements.filter((m) => stats.missingFileBases.includes(m.fileBase));
          if (again.length > 0) {
            startMevDownload({ ...options, caseData: { ...options.caseData, movements: again } });
          }
        });
        break;
      }
      case 'cancelled':
        end('danger', 'Cancelada');
        break;
      case 'error':
        end('danger', 'Error');
        showMessageDialog('La descarga falló', message.message);
        break;
    }
  });

  port.onDisconnect.addListener(() => {
    if (finished) return;
    end('danger', 'Cortada');
    showMessageDialog(
      'Se cortó la descarga',
      'Se perdió la conexión con la extensión (se reinició o se actualizó). No se guardó ningún archivo: volvé a intentar la descarga.'
    );
  });

  send({ type: 'start', caseData: options.caseData, format: options.format });
  panel.update(0, 1, 'Preparando la descarga...');
}

// --- Piezas de interfaz --------------------------------------------------

function formatEta(seconds: number): string {
  if (seconds < 60) return 'falta menos de un minuto';
  const minutes = Math.round(seconds / 60);
  return minutes === 1 ? 'queda un minuto' : `quedan unos ${minutes} min`;
}

function createProgressPanel(): {
  update: (done: number, total: number, label: string) => void;
  remove: () => void;
  stopButton: HTMLButtonElement;
} {
  const box = document.createElement('div');
  Object.assign(box.style, {
    position: 'fixed', bottom: '20px', right: '188px', width: '300px', backgroundColor: 'white',
    borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', padding: '10px 12px',
    fontSize: '12px', zIndex: '999999', display: 'flex', flexDirection: 'column', gap: '6px',
  });
  const label = document.createElement('span');
  label.style.color = '#374151';
  const track = document.createElement('div');
  Object.assign(track.style, { height: '6px', backgroundColor: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' });
  const fill = document.createElement('div');
  Object.assign(fill.style, {
    height: '100%', width: '0%', backgroundColor: MEV_PRIMARY, borderRadius: '3px', transition: 'width 0.3s',
  });
  track.appendChild(fill);
  const note = document.createElement('span');
  note.textContent = 'No cierres ni cambies de página en esta pestaña; para seguir usando la MEV, abrí otra.';
  Object.assign(note.style, { color: '#6b7280', fontSize: '11px', lineHeight: '1.4' });
  const stopButton = createPortalModalButton({ label: 'Detener', variant: 'secondary' });
  stopButton.style.alignSelf = 'flex-end';
  box.append(label, track, note, stopButton);
  document.body.appendChild(box);
  return {
    update: (done, total, text) => {
      label.textContent = text;
      fill.style.width = `${total > 0 ? Math.max(3, Math.round((done / total) * 100)) : 3}%`;
    },
    remove: () => box.remove(),
    stopButton,
  };
}

function createDialog(): { overlay: HTMLDivElement; modal: HTMLDivElement } {
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: '9999999',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  });
  const modal = document.createElement('div');
  Object.assign(modal.style, {
    backgroundColor: 'white', borderRadius: '12px', padding: '24px', maxWidth: '560px', width: '90%',
    maxHeight: '75vh', display: 'flex', flexDirection: 'column', gap: '12px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
  });
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  return { overlay, modal };
}

function heading(text: string, color: string): HTMLHeadingElement {
  const h = document.createElement('h3');
  h.textContent = text;
  Object.assign(h.style, { margin: '0', color, fontSize: '16px' });
  return h;
}

function paragraph(text: string, muted = false): HTMLParagraphElement {
  const p = document.createElement('p');
  p.textContent = text;
  Object.assign(p.style, { margin: '0', color: muted ? '#6b7280' : '#374151', fontSize: '13px', lineHeight: '1.5' });
  return p;
}

function buttonRow(buttons: HTMLButtonElement[]): HTMLDivElement {
  const row = document.createElement('div');
  Object.assign(row.style, { display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '8px' });
  row.append(...buttons);
  return row;
}

function showPauseDialog(
  message: Extract<MevDownloadServerMessage, { type: 'paused' }>,
  onChoice: (choice: BlockChoice) => void
): HTMLElement {
  const { overlay, modal } = createDialog();
  const choose = (choice: BlockChoice) => () => {
    overlay.remove();
    onChoice(choice);
  };
  const progress = `Bajados: ${message.done} de ${message.total}.`;
  if (message.reason === 'desafio') {
    modal.append(
      heading('La MEV pidió una pausa', WARNING),
      paragraph(
        'La MEV limita cuántos documentos se pueden pedir por minuto y ahora respondió con su pantalla de verificación. ' +
          `${progress} Si esperás, la descarga sigue sola en ${message.waitSeconds} segundos y reintenta el mismo documento: no se saltea nada.`
      ),
      buttonRow([
        createPortalModalButton({ label: 'Cancelar sin guardar', variant: 'secondary', onClick: choose('cancel') }),
        createPortalModalButton({ label: 'Detener y guardar lo bajado', variant: 'secondary', onClick: choose('stop-save') }),
        createPortalModalButton({ label: 'Esperar y seguir', variant: 'primary', onClick: choose('wait') }),
      ])
    );
  } else {
    const link = document.createElement('a');
    link.textContent = 'Abrir la MEV en otra pestaña';
    link.href = MEV_LOGIN_URL;
    link.target = '_blank';
    link.rel = 'noopener';
    Object.assign(link.style, { fontSize: '13px', color: MEV_PRIMARY });
    modal.append(
      heading('Se cerró la sesión de la MEV', WARNING),
      paragraph(
        `${progress} Para seguir, iniciá sesión en OTRA pestaña de la MEV (en esta no: cambiar de página cancela la descarga) y después tocá Seguir.`
      ),
      link,
      buttonRow([
        createPortalModalButton({ label: 'Cancelar sin guardar', variant: 'secondary', onClick: choose('cancel') }),
        createPortalModalButton({ label: 'Detener y guardar lo bajado', variant: 'secondary', onClick: choose('stop-save') }),
        createPortalModalButton({ label: 'Seguir', variant: 'primary', onClick: choose('continue') }),
      ])
    );
  }
  return overlay;
}

function showStopDialog(actions: { onSave: () => void; onCancel: () => void }): void {
  const { overlay, modal } = createDialog();
  const close = () => overlay.remove();
  modal.append(
    heading('¿Detener la descarga?', WARNING),
    paragraph('Podés guardar lo que ya se bajó, con el informe de lo que falta, o cancelar sin guardar nada.'),
    buttonRow([
      createPortalModalButton({ label: 'Seguir descargando', variant: 'secondary', onClick: close }),
      createPortalModalButton({ label: 'Cancelar sin guardar', variant: 'secondary', onClick: () => { close(); actions.onCancel(); } }),
      createPortalModalButton({ label: 'Detener y guardar lo bajado', variant: 'primary', onClick: () => { close(); actions.onSave(); } }),
    ])
  );
}

function showResultDialog(
  outcome: 'complete' | 'partial',
  stats: MevDownloadStats,
  onRetryMissing: () => void
): void {
  const { overlay, modal } = createDialog();
  const count = stats.failedItems.length;
  modal.append(
    heading(
      outcome === 'partial' ? `Descarga detenida: faltan ${count}` : `Descarga con ${count} faltante${count === 1 ? '' : 's'}`,
      DANGER
    ),
    paragraph(
      'El archivo se guardó con lo que se pudo bajar. El detalle está en el informe _verificacion dentro del ZIP (o en la última página del PDF único).',
      true
    )
  );
  const list = document.createElement('div');
  Object.assign(list.style, { overflowY: 'auto', flex: '1', borderTop: '1px solid #e5e7eb' });
  for (const item of stats.failedItems.slice(0, 300)) {
    const row = document.createElement('div');
    Object.assign(row.style, { padding: '8px 4px', borderBottom: '1px solid #e5e7eb', fontSize: '12px' });
    const name = document.createElement('strong');
    name.textContent = `${item.kind === 'proveido' ? '[PROVEÍDO]' : '[ADJUNTO]'} ${item.fileName}`;
    name.style.color = '#1f2937';
    const step = document.createElement('div');
    step.textContent = `${item.date}${item.fojas ? `, fs. ${item.fojas}` : ''}, ${item.description}`;
    step.style.color = '#374151';
    const why = document.createElement('div');
    why.textContent = `Motivo: ${reasonLabel(item.reason)}${item.detail ? ` (${item.detail})` : ''}`;
    Object.assign(why.style, { color: '#6b7280', fontSize: '11px' });
    row.append(name, step, why);
    list.appendChild(row);
  }
  const missing = stats.missingFileBases.length;
  const retry = createPortalModalButton({
    label: `Bajar los que faltan (${missing} paso${missing === 1 ? '' : 's'})`,
    variant: 'primary',
    onClick: () => {
      overlay.remove();
      onRetryMissing();
    },
  });
  retry.disabled = missing === 0;
  modal.append(
    list,
    buttonRow([
      createPortalModalButton({ label: 'Cerrar', variant: 'secondary', onClick: () => overlay.remove() }),
      retry,
    ])
  );
}

function showMessageDialog(title: string, text: string): void {
  const { overlay, modal } = createDialog();
  modal.append(
    heading(title, DANGER),
    paragraph(text),
    buttonRow([createPortalModalButton({ label: 'Cerrar', variant: 'primary', onClick: () => overlay.remove() })])
  );
}
```

- [ ] **Paso 2: compilar**

Run: `npm run compile`
Expected: sin errores en `mev-download-ui.ts` (siguen los de `mev.content.ts` hasta la Tarea 12).

- [ ] **Paso 3: commit**

```bash
git add modules/ui/mev-download-ui.ts
git commit -m "Pantalla de la descarga: progreso con tiempo estimado, Detener, pausa con pregunta y Bajar los que faltan

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarea 12: botón Descargar y pantalla de verificación en el content script

**Archivos:**
- Modificar: `entrypoints/mev.content.ts`

- [ ] **Paso 1: imports**

Agregar:

```ts
import { assignFileBases } from '@/modules/pdf/file-naming';
import { isChallengeTitle } from '@/modules/portals/mev-challenge';
import { isMevDownloadRunning, startMevDownload } from '@/modules/ui/mev-download-ui';
```

- [ ] **Paso 2: no tocar la pantalla de verificación**

En `main()`, inmediatamente después de `installWizardMessageListener();`:

```ts
    // Pantalla de verificación de la MEV ("Validando acceso"): no se toca.
    // Cuando se resuelve, el portal recarga la página y este script vuelve a
    // correr sobre la página real. Sin esto, un recorrido de importación la
    // tomaba por una página de resultados vacía (misma dirección, otra página).
    if (isChallengeTitle(doc.title)) {
      console.debug('[ProcuAsist] Pantalla de verificación de la MEV: no se hace nada hasta que se resuelva.');
      return;
    }
```

- [ ] **Paso 3: reemplazar `injectZipButton` completo**

```ts
function injectZipButton(caseData: MevCaseData, movements: Movement[]) {
  if (document.getElementById('procu-asist-zip')) return;

  const bar = ensureMevActionBar();
  const btn = createPortalActionButton({
    id: 'procu-asist-zip',
    icon: ICON_PACKAGE,
    label: 'Descargar',
    title: `Descargar expediente ${caseData.numero} (ZIP o un PDF único)`,
    variant: 'primary',
  });

  // Nombres de archivo sobre la lista COMPLETA de la ficha, del más viejo al
  // más nuevo: así no cambian entre una descarga y otra (file-naming.ts).
  const oldestFirst = movements.slice().reverse();
  const bases = assignFileBases(oldestFirst);
  const fileBaseOf = new Map<Movement, string>();
  oldestFirst.forEach((movement, i) => {
    const base = bases[i];
    if (base) fileBaseOf.set(movement, base);
  });

  btn.addEventListener('click', async () => {
    if (isMevDownloadRunning()) return;
    const choice = await showMovementSelectionModal(movements);
    if (!choice || choice.movements.length === 0) return;

    startMevDownload({
      button: btn,
      format: choice.format,
      caseData: {
        caseNumber: caseData.numero,
        title: caseData.caratula,
        court: caseData.juzgado,
        portal: 'mev',
        portalUrl: window.location.href,
        fechaInicio: caseData.fechaInicio,
        estadoPortal: caseData.estadoPortal,
        numeroReceptoria: caseData.numeroReceptoria,
        allMovements: movements.map((m) => ({
          date: m.date,
          fojas: m.fojas,
          description: m.description,
          type: m.type,
          hasDocuments: m.hasDocuments,
        })),
        movements: choice.movements.flatMap((m) => {
          const fileBase = fileBaseOf.get(m);
          if (!fileBase || !m.hasDocuments || m.documentUrls.length === 0) return [];
          return [{
            date: m.date,
            fojas: m.fojas,
            description: m.description,
            type: m.type,
            hasDocuments: m.hasDocuments,
            documentUrls: m.documentUrls,
            fileBase,
          }];
        }),
      },
    });
  });

  const configBtn = document.getElementById(MEV_CONFIG_ID);
  if (configBtn?.nextSibling) {
    bar.insertBefore(btn, configBtn.nextSibling);
  } else {
    bar.prepend(btn);
  }
}
```

- [ ] **Paso 4: borrar lo reemplazado**

Borrar completas `showChallengeOverlay` y `showVerificationOverlay` (y sus comentarios de encabezado): los reemplaza `modules/ui/mev-download-ui.ts`.

- [ ] **Paso 5: compilar y limpiar imports sin uso**

Run: `npm run compile`
Expected: sin errores. Si el compilador marca imports sin uso en `mev.content.ts` (por ejemplo `ICON_LOADER`, `ICON_X` o `DANGER_COLOR`), borrarlos solo si ya no tienen otro uso en el archivo (`grep -n "ICON_LOADER\|ICON_X\|DANGER_COLOR" entrypoints/mev.content.ts`).

- [ ] **Paso 6: tests y build**

Run: `npm test` y `npm run build`
Expected: PASS y build sin errores.

- [ ] **Paso 7: commit**

```bash
git add entrypoints/mev.content.ts
git commit -m "Boton Descargar con nombres por fecha y la pantalla nueva; el content script no toca la pantalla de verificacion

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarea 13: monitoreo y keep-alive durante una descarga

**Archivos:**
- Modificar: `entrypoints/background/case-monitor.ts`
- Modificar: `entrypoints/background/keep-alive.ts`

- [ ] **Paso 1: `keep-alive.ts`**

Agregar el import `import { isMevDownloadActive } from './mev-download-job';` y, después de la línea `if (portal === 'pjn' && settings?.keepAlivePjn === false) return;`:

```ts
  // Durante una descarga, sus propios pedidos mantienen viva la sesión y
  // cada pedido extra gasta cupo del límite de la MEV.
  if (portal === 'mev' && isMevDownloadActive()) return;
```

- [ ] **Paso 2: `case-monitor.ts`**

Agregar el import `import { isMevDownloadActive, requestScanAfterDownloads } from './mev-download-job';`.

Reemplazar:

```ts
  const needsMev = monitors.some((monitor) => monitor.portal === 'mev');
  const mevTabId = needsMev ? await findMevTab() : null;
  const pjnTabId = null;

  if (needsMev && !mevTabId) {
```

por:

```ts
  const needsMev = monitors.some((monitor) => monitor.portal === 'mev');
  // Con una descarga de expediente en curso, la MEV no se consulta en esta
  // corrida: la descarga ya usa el cupo de pedidos del portal. El escaneo
  // se repite apenas termine la descarga (mev-download-job.ts).
  const mevPostponed = needsMev && isMevDownloadActive();
  const mevTabId = needsMev && !mevPostponed ? await findMevTab() : null;
  const pjnTabId = null;

  if (needsMev && !mevPostponed && !mevTabId) {
```

Agregar el contador junto a los demás (`let skippedByChallenge = 0;`):

```ts
  let skippedByDownload = 0;
```

Dentro del `for (const monitor of batch)`, como primera instrucción del `try`:

```ts
        if (monitor.portal === 'mev' && mevPostponed) {
          skippedByDownload++;
          continue;
        }
```

Después de `await touchMonitorScans(touchedMonitorIds);`:

```ts
  if (skippedByDownload > 0) requestScanAfterDownloads();
```

En el objeto `result`, agregar `skippedByDownload: skippedByDownload || undefined,` junto a `skippedByChallenge`, y en la interfaz `ScanResult`:

```ts
  /** Causas MEV que no se consultaron porque había una descarga en curso;
   *  el escaneo se repite al terminar la descarga. */
  skippedByDownload?: number;
```

- [ ] **Paso 3: compilar, tests y build**

Run: `npm run compile`, `npm test`, `npm run build`
Expected: todo en verde.

- [ ] **Paso 4: commit**

```bash
git add entrypoints/background/case-monitor.ts entrypoints/background/keep-alive.ts
git commit -m "Durante una descarga el monitoreo no consulta la MEV y se repite al terminar; el keep-alive no se manda

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarea 14: documentación y verificación final

**Archivos:**
- Modificar: `README.md` (secciones "Contenido del ZIP descargado" y "Verificación de la MEV")
- Modificar: `CHANGELOG.md`
- Modificar: `docs/manual-usuario.md` (6.1)
- Modificar: `docs/release-v0.8.1-assets.md` (secciones 1, 4 y 5.2)

- [ ] **Paso 1: README, "Contenido del ZIP descargado"**

Reemplazar el bloque de ejemplo por:

```
expediente_XX-12345-2025.zip
└── XX-12345-2025_expte_completo/
    ├── resumen.pdf                                  # Todos los movimientos de la ficha
    ├── 2025-12-29_fs-1-3_AUTOS.pdf                  # PDF de cada paso procesal
    ├── 2025-12-29_fs-4-15_INTERLOCUTORIO.pdf
    ├── 2026-02-04_fs-29-36_RECURSO_DE_APELACION.pdf
    ├── 2026-02-04_fs-29-36_RECURSO_DE_APELACION_adjunto_1.pdf
    └── _verificacion_2026-02-04_1051.txt            # Solo si faltó algo
```

y agregar debajo: "Los nombres empiezan por la fecha del paso: los archivos quedan ordenados por fecha y una descarga parcial posterior (por ejemplo, solo los pasos nuevos) encaja en la misma carpeta sin pisar nada. Si dos pasos quedan con el mismo nombre, el segundo lleva `_2`."

- [ ] **Paso 2: README, reescribir "Verificación de la MEV ("Validando acceso")"**

Reemplazar la sección completa por el estado medido el 22/09/2026: qué es la pantalla (título, Turnstile, cuerpo sin texto, 2.000 bytes, misma dirección, HTTP 200), el límite medido (unos 30 proveídos por minuto, escalamiento del castigo, bloqueo compartido entre sesiones del mismo usuario), qué hace la extensión (portero de 20 por minuto, pausa con pregunta, reintento del mismo documento, reingreso a la ficha, informe fechado, monitoreo pospuesto durante una descarga, content script que no toca la pantalla), qué no hace (resolver o esquivar la verificación) y qué sigue sin medir (si la ficha y los adjuntos cuentan, si va por usuario o por IP, si pasar la verificación a mano acorta el bloqueo). Sin nombres de causas ni datos de sesiones.

- [ ] **Paso 3: CHANGELOG**

Agregar arriba de `## [Sin version] - 2026-09-09` una sección `## [Sin version] - 2026-09-22` titulada "Descarga confiable frente al límite de pedidos de la MEV", con síntoma (109 de 225 salteados en dos tandas), causa medida, cambios (portero, clasificación, pausa con pregunta, canal, nombres por fecha, informe fechado, resumen completo, Detener, Bajar los que faltan, monitoreo y keep-alive, content script), tests nuevos y lo que queda sin medir.

- [ ] **Paso 4: manual de usuario, 6.1**

Reemplazar el párrafo que empieza "La descarga puede tardar varios minutos..." por: la descarga va a un ritmo que respeta el límite de la MEV (unos 12 minutos para 225 pasos); si la MEV pide una pausa aparece un aviso con "Esperar y seguir", "Detener y guardar lo bajado" y "Cancelar sin guardar"; el botón "Detener" de la barra; no cerrar ni cambiar de página en esa pestaña durante la descarga; nombres por fecha y "Bajar los que faltan".

- [ ] **Paso 5: release-v0.8.1-assets.md**

En la sección 1, agregar las viñetas de la descarga confiable y quitar "Sin funciones nuevas y sin cambios en el flujo de trabajo del usuario". En la sección 4, agregar a las notas de versión: "La descarga de expedientes de la MEV respeta el límite de pedidos que el portal tiene desde septiembre: ya no saltea documentos, se pausa y pregunta si la MEV lo pide, y los archivos se nombran por fecha para que una descarga parcial encaje en la carpeta de la anterior." En la 5.2, agregar los tres casos de la prueba real de la especificación (sección 4).

- [ ] **Paso 6: verificación completa**

Run: `npm run compile`, `npm test`, `npm run build`, `npm run zip`
Expected: todo en verde; el zip queda en `.output/`.

Run: `grep -rn --include=*.ts --include=*.md "$(printf '\u2014')" modules/pdf modules/portals modules/ui/mev-download-ui.ts modules/messages/mev-download.ts modules/utils entrypoints/background/mev-download-job.ts docs/superpowers README.md` 
Expected: ninguna raya larga en los archivos nuevos o reescritos (las del resto del repo no se tocan en este trabajo).

- [ ] **Paso 7: commit**

```bash
git add README.md CHANGELOG.md docs/manual-usuario.md docs/release-v0.8.1-assets.md
git commit -m "Documentacion de la descarga confiable: README, CHANGELOG, manual y checklist de la 0.8.1

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Paso 8: prueba real con el titular (no automatizable)**

Con la MEV sin bloqueo, cargar la build de `.output/chrome-mv3` de esta carpeta de trabajo en Chrome (modo desarrollador) y correr los tres casos de la sección 4 de la especificación. Registrar tiempos y resultado. Hasta esa prueba, la descarga confiable no se da por verificada.
