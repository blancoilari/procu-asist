/**
 * M6a — Orquestador que recorre TODAS las actuaciones de un expediente abierto.
 *
 * Corre en el contexto del content script (mismo DOM que la página scw), para
 * reutilizar `parseActuacionesTab` sin duplicar lógica de parsing. El service
 * worker dispara la corrida mandando un mensaje a la pestaña (ver
 * `pjn.content.ts` y `pjn-debug-helpers.ts`).
 *
 * Flujo:
 *   1. Asegurar que la pestaña "Actuaciones" esté activa.
 *   2. Si aparece el botón "Ver históricas", clickearlo y esperar el AJAX postback.
 *   3. Iterar la paginación clickeando el número siguiente hasta agotarla.
 *   4. Acumular filas dedupadas por fecha+tipo+descripcion+foja.
 *
 * JSF emite postbacks AJAX sin cambio de URL, así que las esperas se hacen con
 * MutationObserver + fingerprint de la primera fila de la tabla. Si el
 * fingerprint no cambia tras `maxWaitMs`, asumimos que el postback ya terminó
 * (o que no había cambio) y seguimos.
 */

import {
  isScwActuacionesHistoricas,
  isScwExpediente,
  parseActuacionesTab,
  type PjnActuacion,
} from './pjn-parser';
import { PJN_SELECTORS } from './pjn-selectors';

export interface PjnCollectorPageInfo {
  page: number;
  parsedInPage: number;
  addedToAccumulated: number;
  fingerprintBefore: string;
  fingerprintAfter: string;
  waitedMs: number;
  mutationDetected: boolean;
}

export type PjnCollectorPage = 'expediente' | 'historicas' | 'unknown';

export interface PjnCollectorResult {
  ok: boolean;
  error?: string;
  totalActuaciones: number;
  actuaciones: PjnActuacion[];
  /** Página desde la que corrió el collector. */
  pageKind: PjnCollectorPage;
  /**
   * Sólo relevante cuando `pageKind === 'expediente'`. En `historicas` ya
   * estamos en la página dedicada, no hay que clickear nada.
   */
  verHistoricasClicked: boolean;
  /** URL del link "Ver históricas" si está visible en expediente.seam. */
  verHistoricasHref?: string;
  pages: PjnCollectorPageInfo[];
  startedAt: number;
  endedAt: number;
}

const DEFAULT_WAIT_MS = 8000;
const MAX_PAGES = 200; // seguridad: nunca deberían ser más

// ────────────────────────────────────────────────────────
// Helpers DOM
// ────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function dedupeKey(a: PjnActuacion): string {
  return [a.fecha, a.tipo, a.oficina, a.foja, a.descripcion].join('|');
}

/**
 * Fingerprint liviano de la tabla de actuaciones. Usa las primeras 3 filas
 * como muestra representativa — si cambian, es porque hubo AJAX postback.
 * Si no hay tabla, devuelve string vacío.
 */
function actuacionesTableFingerprint(): string {
  const table = document.querySelector<HTMLTableElement>(
    'table.rf-dt, table.datagrid, table.table, table'
  );
  const rows = Array.from(document.querySelectorAll('table tbody tr')).slice(0, 3);
  if (!rows.length) return '';
  return rows
    .map((tr) => (tr.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 120))
    .join('##') + `::${table?.querySelectorAll('tbody tr').length ?? 0}`;
}

/**
 * Espera a que el fingerprint de la tabla cambie respecto a `before`, o a
 * que pase `maxMs`. Devuelve cuánto esperó + si detectó mutación.
 */
async function waitForTableChange(
  before: string,
  maxMs: number
): Promise<{ waitedMs: number; mutationDetected: boolean; fingerprintAfter: string }> {
  const start = Date.now();
  // Polling corto + MutationObserver. El polling cubre el caso donde el MO se
  // dispara con eventos no visibles en el fingerprint.
  return new Promise((resolve) => {
    let settled = false;
    const done = (mutationDetected: boolean) => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearInterval(poll);
      clearTimeout(timeout);
      resolve({
        waitedMs: Date.now() - start,
        mutationDetected,
        fingerprintAfter: actuacionesTableFingerprint(),
      });
    };

    const observer = new MutationObserver(() => {
      if (actuacionesTableFingerprint() !== before) done(true);
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    const poll = setInterval(() => {
      if (actuacionesTableFingerprint() !== before) done(true);
    }, 200);

    const timeout = setTimeout(() => done(false), maxMs);
  });
}

// ────────────────────────────────────────────────────────
// Activar pestaña Actuaciones
// ────────────────────────────────────────────────────────

function findTabLabel(target: string): HTMLElement | null {
  const nTarget = normalize(target);
  for (const selector of PJN_SELECTORS.expediente.tabLabelCandidates) {
    const nodes = document.querySelectorAll<HTMLElement>(selector);
    for (const el of nodes) {
      if (normalize(el.textContent ?? '').includes(nTarget)) return el;
    }
  }
  // Fallback: cualquier <a>/<li>/<span> con texto exacto "actuaciones".
  const generics = document.querySelectorAll<HTMLElement>('a, li, span, button');
  for (const el of generics) {
    const t = normalize(el.textContent ?? '');
    if (t === nTarget) return el;
  }
  return null;
}

async function ensureActuacionesActive(maxMs: number): Promise<boolean> {
  const parsed = parseActuacionesTab(document);
  if (parsed.loaded && !parsed.isEmpty) return true;

  const label = findTabLabel('actuaciones');
  if (!label) return parsed.loaded; // no encontramos tab label — quizá ya está activa

  const before = actuacionesTableFingerprint();
  label.click();
  await waitForTableChange(before, maxMs);
  return parseActuacionesTab(document).loaded;
}

// ────────────────────────────────────────────────────────
// Click "Ver históricas"
// ────────────────────────────────────────────────────────

function findVerHistoricasLink(): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>(
    'a, button, input[type="button"], input[type="submit"]'
  );
  for (const el of candidates) {
    const txt = el.textContent ?? (el as HTMLInputElement).value ?? '';
    if (PJN_SELECTORS.expediente.verHistoricasPattern.test(txt)) return el;
  }
  return null;
}

/**
 * "Ver históricas" es un LINK (no un botón AJAX) que navega a
 * actuacionesHistoricas.seam?cid=XXX. Lo reportamos al caller en vez de
 * seguirlo — navegar desde el collector mataría el content script a mitad
 * de corrida y perderíamos la respuesta.
 */
function getVerHistoricasHref(): string | undefined {
  const el = findVerHistoricasLink();
  if (!el) return undefined;
  const href = (el as HTMLAnchorElement).href;
  return href && !href.endsWith('#') ? href : undefined;
}

// ────────────────────────────────────────────────────────
// Paginación
// ────────────────────────────────────────────────────────

/**
 * Busca el paginador de la tabla de actuaciones. SCW usa RichFaces
 * (`.rf-ds`) / PrimeFaces (`.ui-paginator`) / o un agrupador genérico con
 * links numerados. Devolvemos el conjunto de links "numéricos" (texto = dígito).
 */
function findPagerLinks(): HTMLAnchorElement[] {
  const scopeSelectors = [
    '.rf-ds', // RichFaces dataScroller
    '.ui-paginator',
    '.pagination',
    '.paginator',
    '.rf-ds-btn',
    '.rf-ds-nmb-btn',
  ];
  for (const sel of scopeSelectors) {
    const scopes = document.querySelectorAll<HTMLElement>(sel);
    for (const scope of scopes) {
      const links = Array.from(
        scope.querySelectorAll<HTMLAnchorElement>('a, button')
      ).filter((a) => /^\d+$/.test((a.textContent ?? '').trim()));
      if (links.length >= 2) return links;
    }
  }
  // Fallback global: anchors whose text is a standalone digit and that sit
  // near the actuaciones table (same parent chain).
  const all = Array.from(document.querySelectorAll<HTMLAnchorElement>('a')).filter(
    (a) => /^\d+$/.test((a.textContent ?? '').trim())
  );
  // Clusters of ≥3 numeric links are almost certainly a pager.
  if (all.length >= 3) return all;
  return [];
}

function isActivePagerLink(el: HTMLElement): boolean {
  const klass = (el.className || '').toLowerCase();
  if (/\b(active|selected|current|rf-ds-act-btn|ui-state-active)\b/.test(klass)) {
    return true;
  }
  // Cuando el "link" actual no es navegable se renderiza como <span>; el parent
  // puede tener la marca.
  const parent = el.parentElement;
  if (parent) {
    const pk = (parent.className || '').toLowerCase();
    if (/\b(active|selected|current|rf-ds-act-btn|ui-state-active)\b/.test(pk)) {
      return true;
    }
  }
  return false;
}

function findNextPageLink(currentPage: number): HTMLElement | null {
  const links = findPagerLinks();
  if (!links.length) return null;

  // Buscar link con texto = (currentPage + 1).
  const targetNum = String(currentPage + 1);
  const byNumber = links.find(
    (l) => (l.textContent ?? '').trim() === targetNum && !isActivePagerLink(l)
  );
  if (byNumber) return byNumber;

  // Fallback: detectar el link activo y tomar el siguiente sibling numérico.
  const activeIdx = links.findIndex(isActivePagerLink);
  if (activeIdx >= 0 && activeIdx + 1 < links.length) {
    const candidate = links[activeIdx + 1];
    if (!isActivePagerLink(candidate)) return candidate;
  }
  return null;
}

// ────────────────────────────────────────────────────────
// Orquestador
// ────────────────────────────────────────────────────────

const LOG_PREFIX = '[ProcuAsist PJN M6a]';

export async function collectAllActuaciones(
  opts: { maxWaitMs?: number } = {}
): Promise<PjnCollectorResult> {
  const maxWaitMs = opts.maxWaitMs ?? DEFAULT_WAIT_MS;
  const startedAt = Date.now();
  const pages: PjnCollectorPageInfo[] = [];
  const seen = new Set<string>();
  const accumulated: PjnActuacion[] = [];

  // Detectar unload mientras corremos — si la página navega, el content script
  // muere y sendResponse queda huérfano. Con este flag al menos loggeamos por
  // qué tardó la diagnosis.
  let unloading = false;
  const onUnload = () => {
    unloading = true;
    console.warn(`${LOG_PREFIX} beforeunload disparado — la página está navegando.`);
  };
  window.addEventListener('beforeunload', onUnload);

  const pathname = window.location.pathname;
  const pageKind: PjnCollectorPage = isScwActuacionesHistoricas(pathname)
    ? 'historicas'
    : isScwExpediente(pathname)
    ? 'expediente'
    : 'unknown';

  try {
    console.log(`${LOG_PREFIX} inicio — maxWaitMs=${maxWaitMs} pageKind=${pageKind}`);

    if (pageKind === 'unknown') {
      return {
        ok: false,
        error: `Página no soportada: ${pathname}`,
        totalActuaciones: 0,
        actuaciones: [],
        pageKind,
        verHistoricasClicked: false,
        pages,
        startedAt,
        endedAt: Date.now(),
      };
    }

    // Sólo activar tab en expediente.seam — en actuacionesHistoricas.seam la
    // tabla está directamente en el body, no hay tabs.
    if (pageKind === 'expediente') {
      console.log(`${LOG_PREFIX} paso 1: activar pestaña Actuaciones…`);
      const activated = await ensureActuacionesActive(maxWaitMs);
      console.log(`${LOG_PREFIX} paso 1 resultado: activated=${activated}`);
      if (!activated) {
        return {
          ok: false,
          error: 'No se pudo activar la pestaña Actuaciones.',
          totalActuaciones: 0,
          actuaciones: [],
          pageKind,
          verHistoricasClicked: false,
          pages,
          startedAt,
          endedAt: Date.now(),
        };
      }
    }

    // "Ver históricas" es un link de navegación, no un botón AJAX. Lo
    // reportamos al caller así puede decidir seguirlo (en otro tab / misma tab).
    const verHistoricasHref =
      pageKind === 'expediente' ? getVerHistoricasHref() : undefined;
    const verHistoricasClicked = false;
    console.log(`${LOG_PREFIX} verHistoricasHref=${verHistoricasHref ?? '(no disponible)'}`);

    console.log(`${LOG_PREFIX} paso 3: iterar paginación…`);
    let currentPage = 1;
    for (let safety = 0; safety < MAX_PAGES; safety++) {
      if (unloading) {
        console.warn(`${LOG_PREFIX} aborto — la página se está descargando.`);
        break;
      }
      const parsed = parseActuacionesTab(document);
      let added = 0;
      for (const row of parsed.rows) {
        const key = dedupeKey(row);
        if (seen.has(key)) continue;
        seen.add(key);
        accumulated.push(row);
        added++;
      }
      console.log(
        `${LOG_PREFIX} página ${currentPage}: parseadas=${parsed.rows.length} nuevas=${added} total=${accumulated.length}`
      );

      const fingerprintBefore = actuacionesTableFingerprint();
      const nextLink = findNextPageLink(currentPage);
      if (!nextLink) {
        console.log(
          `${LOG_PREFIX} no hay siguiente página (pager no encontrado o fin de la lista).`
        );
        pages.push({
          page: currentPage,
          parsedInPage: parsed.rows.length,
          addedToAccumulated: added,
          fingerprintBefore,
          fingerprintAfter: fingerprintBefore,
          waitedMs: 0,
          mutationDetected: false,
        });
        break;
      }

      console.log(
        `${LOG_PREFIX} clickeando siguiente página: "${(nextLink.textContent ?? '').trim()}"`
      );
      nextLink.click();
      const { waitedMs, mutationDetected, fingerprintAfter } = await waitForTableChange(
        fingerprintBefore,
        maxWaitMs
      );
      console.log(
        `${LOG_PREFIX} post-click: waitedMs=${waitedMs} mutacion=${mutationDetected}`
      );
      pages.push({
        page: currentPage,
        parsedInPage: parsed.rows.length,
        addedToAccumulated: added,
        fingerprintBefore,
        fingerprintAfter,
        waitedMs,
        mutationDetected,
      });

      if (!mutationDetected) break;
      await sleep(120);
      currentPage++;
    }

    console.log(`${LOG_PREFIX} fin — total=${accumulated.length} páginas=${pages.length}`);
    return {
      ok: true,
      totalActuaciones: accumulated.length,
      actuaciones: accumulated,
      pageKind,
      verHistoricasClicked,
      verHistoricasHref,
      pages,
      startedAt,
      endedAt: Date.now(),
    };
  } catch (err) {
    console.error(`${LOG_PREFIX} excepción`, err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      totalActuaciones: accumulated.length,
      actuaciones: accumulated,
      pageKind,
      verHistoricasClicked: false,
      pages,
      startedAt,
      endedAt: Date.now(),
    };
  } finally {
    window.removeEventListener('beforeunload', onUnload);
  }
}
