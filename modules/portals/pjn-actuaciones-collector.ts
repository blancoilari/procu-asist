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
  parseDatosGenerales,
  type PjnActuacion,
  type PjnDatosGenerales,
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
  /** Datos generales del expediente (solo presente cuando corremos en expediente.seam). */
  datosGenerales: PjnDatosGenerales | null;
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
 * Scoped a la tabla de actuaciones específicamente (no cualquier table).
 */
function actuacionesTableFingerprint(): string {
  const table = findActuacionesTableElement();
  if (!table) return '';
  const rows = Array.from(table.querySelectorAll('tbody tr')).slice(0, 3);
  if (!rows.length) return `::0`;
  return rows
    .map((tr) => (tr.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 120))
    .join('##') + `::${table.querySelectorAll('tbody tr').length}`;
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
  // 1. Match directo por href (más confiable que el texto).
  const byHref = document.querySelector<HTMLAnchorElement>(
    'a[href*="actuacionesHistoricas.seam" i]'
  );
  if (byHref) return byHref;

  // 2. Fallback por texto visible / value / title — "Ver históricas", "Históricas", etc.
  const candidates = document.querySelectorAll<HTMLElement>(
    'a, button, input[type="button"], input[type="submit"]'
  );
  for (const el of candidates) {
    const signals = [
      el.textContent ?? '',
      (el as HTMLInputElement).value ?? '',
      el.getAttribute('title') ?? '',
      el.getAttribute('aria-label') ?? '',
    ].join(' ');
    if (PJN_SELECTORS.expediente.verHistoricasPattern.test(signals)) return el;
    if (/hist[óo]ric/i.test(signals)) return el; // más laxo
  }
  return null;
}

/**
 * "Ver históricas" es un LINK (no un botón AJAX) que navega a
 * actuacionesHistoricas.seam. El caller puede querer fetchearlo para mergear
 * las filas sin navegar la pestaña.
 *
 * Si el botón existe pero su href es "#" (botón JSF con onclick/action), no
 * podemos reconstruir la URL fielmente (JSF genera un `cid` nuevo del lado
 * del server). Devolvemos undefined en ese caso y el caller le muestra al
 * usuario un hint para que navegue manualmente.
 */
function getVerHistoricasHref(): string | undefined {
  const el = findVerHistoricasLink();
  if (!el) {
    // Diagnostic: ¿hay ALGÚN <a> con "historicas" en el href o texto?
    const hints = Array.from(document.querySelectorAll<HTMLElement>('a, button'))
      .filter((n) => {
        const txt = (n.textContent ?? '').toLowerCase();
        const href = (n as HTMLAnchorElement).href?.toLowerCase() ?? '';
        return txt.includes('histor') || href.includes('histor');
      })
      .slice(0, 5);
    if (hints.length) {
      console.log(
        `${LOG_PREFIX_LAZY()} Ver históricas NO matcheó, pero hay candidatos con "histor":`,
        hints.map((h) => ({
          tag: h.tagName,
          text: (h.textContent ?? '').trim().slice(0, 60),
          href: (h as HTMLAnchorElement).href ?? '',
          class: h.className,
        }))
      );
    }
    return undefined;
  }
  const href = (el as HTMLAnchorElement).href;
  if (href && !href.endsWith('#')) {
    console.log(`${LOG_PREFIX_LAZY()} "Ver históricas" encontrado con href real: ${href}`);
    return href;
  }
  console.log(
    `${LOG_PREFIX_LAZY()} "Ver históricas" encontrado pero href="#" (botón JSF). Marker presente.`
  );
  // Retornamos un sentinel para indicar presencia — el caller lo detecta.
  return '#jsf-button';
}

/** `true` si hay evidencia visible de que el expediente tiene históricas aparte. */
export function hasHistoricasHint(href: string | undefined): boolean {
  return !!href; // incluye tanto URL real como '#jsf-button'
}

// ────────────────────────────────────────────────────────
// Paginación
// ────────────────────────────────────────────────────────

/**
 * Busca el paginador de la tabla de actuaciones. Para evitar matchear
 * paginadores de OTRAS secciones de la página (ej: listados de intervinientes),
 * scopeamos siempre a un contenedor que tenga la tabla de actuaciones.
 *
 * IMPORTANTE: preferimos `<a>` y `<button>` sobre `<td>`/`<span>` — clickear
 * un `<td>` en JSF no dispara postback, solo el ancla interna lo hace.
 */
function findPagerLinks(): HTMLElement[] {
  const actuacionesTable = findActuacionesTableElement();
  const scope = actuacionesTable
    ? findPagerScope(actuacionesTable)
    : document.body;

  const scopeSelectors = [
    '.rf-ds',
    '.ui-paginator',
    '.pagination',
    '.paginator',
    'table.rf-ds',
  ];

  for (const sel of scopeSelectors) {
    const containers = scope.querySelectorAll<HTMLElement>(sel);
    for (const container of containers) {
      // 1. Preferir <a>/<button> con texto numérico — clickables de verdad.
      const clickable = Array.from(
        container.querySelectorAll<HTMLElement>('a, button')
      ).filter((a) => /^\d+$/.test((a.textContent ?? '').trim()));
      if (clickable.length >= 2) {
        console.log(
          `${LOG_PREFIX_LAZY()} pager scope='${sel}' → ${clickable.length} <a>/<button> numéricos`
        );
        return clickable;
      }

      // 2. Fallback: si el número está en un <td>/<span>, subir hasta el <a>
      //    envolvente o tomar el primer <a>/<button> descendiente.
      const wrappers = Array.from(
        container.querySelectorAll<HTMLElement>('td, span')
      ).filter((a) => /^\d+$/.test((a.textContent ?? '').trim()));
      const resolved = wrappers
        .map((w) => {
          const closest = w.closest<HTMLElement>('a, button');
          if (closest) return closest;
          return w.querySelector<HTMLElement>('a, button');
        })
        .filter((el): el is HTMLElement => !!el);
      const unique = Array.from(new Set(resolved));
      if (unique.length >= 2) {
        console.log(
          `${LOG_PREFIX_LAZY()} pager scope='${sel}' → ${unique.length} clickables resueltos desde td/span`
        );
        return unique;
      }
    }
  }

  console.warn(`${LOG_PREFIX_LAZY()} pager NO encontrado en scope de actuaciones. Dumpeando…`);
  dumpPagerDiagnostics(scope);
  return [];
}

function findActuacionesTableElement(): HTMLTableElement | null {
  const tables = document.querySelectorAll<HTMLTableElement>('table');
  for (const table of tables) {
    const headers = Array.from(table.querySelectorAll('th, thead td'))
      .map((c) => (c.textContent ?? '').toLowerCase());
    // La tabla de actuaciones tiene a la vez "fecha" y "tipo" (y típicamente "descripcion").
    if (headers.some((h) => h.includes('fecha')) && headers.some((h) => h.includes('tipo'))) {
      return table;
    }
  }
  return null;
}

/**
 * El pager suele estar al pie de la tabla, dentro de un contenedor común
 * (un div, un tfoot, o el parent del table). Subimos por el árbol buscando
 * un contenedor "razonable" que incluya la tabla + potencialmente el pager.
 */
function findPagerScope(table: HTMLTableElement): HTMLElement {
  let el: HTMLElement | null = table.parentElement;
  for (let depth = 0; depth < 6 && el; depth++, el = el.parentElement) {
    // Si hay algo que parezca pager en este nivel, nos quedamos aquí.
    const hasPager =
      el.querySelector('.rf-ds, .ui-paginator, .pagination, .paginator') !== null;
    if (hasPager) return el;
  }
  return table.parentElement ?? table;
}

/**
 * Busca el botón "siguiente" del pager de actuaciones. En SCW el icono está
 * en un `<span title="Siguiente"><i class="fa-arrow-circle-o-right">` y el
 * handler de click está en el `<a>` envolvente. Resolvemos siempre al
 * ancestor clickable antes de devolver.
 */
function findNextArrowButton(): HTMLElement | null {
  const actuacionesTable = findActuacionesTableElement();
  const scope = actuacionesTable
    ? findPagerScope(actuacionesTable)
    : document.body;

  const hints = Array.from(
    scope.querySelectorAll<HTMLElement>(
      '.rf-ds-btn-fastfwd, .rf-ds-btn-fwd, .rf-ds-btn-next, .rf-ds-next, ' +
        '.ui-paginator-next, a.next, button.next, ' +
        '[title*="siguiente" i], [aria-label*="siguiente" i], ' +
        'i.fa-arrow-circle-o-right, i.fa-chevron-right, i.fa-angle-right'
    )
  );
  for (const hint of hints) {
    const clickable = resolveClickable(hint);
    if (clickable && !isDisabled(clickable)) return clickable;
  }

  // Fallback por texto: flechas, ">>", "Siguiente". Solo <a>/<button>.
  const all = scope.querySelectorAll<HTMLElement>('a, button');
  for (const el of all) {
    const txt = (el.textContent ?? '').trim();
    const title = (el.getAttribute('title') ?? '').toLowerCase();
    if (/^(?:›|»|>>?|&gt;|&raquo;)$/.test(txt) || /siguiente|next/i.test(title)) {
      if (!isDisabled(el)) return el;
    }
  }
  return null;
}

function resolveClickable(el: HTMLElement): HTMLElement | null {
  if (el.tagName === 'A' || el.tagName === 'BUTTON') return el;
  return el.closest<HTMLElement>('a, button');
}

/**
 * Dispara una secuencia completa de eventos mousedown/mouseup/click para
 * simular una interacción de usuario real. Necesario para componentes JSF
 * que bindean handlers en fases distintas del click (o que chequean
 * secuencias completas de mouse).
 */
function simulateUserClick(el: HTMLElement): void {
  const baseInit: MouseEventInit = {
    view: window,
    bubbles: true,
    cancelable: true,
    button: 0,
    buttons: 1,
  };
  el.dispatchEvent(new MouseEvent('mousedown', baseInit));
  el.dispatchEvent(new MouseEvent('mouseup', baseInit));
  el.dispatchEvent(new MouseEvent('click', baseInit));
}

function isDisabled(el: HTMLElement): boolean {
  const klass = (el.className || '').toLowerCase();
  if (/\b(disabled|rf-ds-btn-dis|ui-state-disabled)\b/.test(klass)) return true;
  if ((el as HTMLButtonElement).disabled) return true;
  return false;
}

/** Dump al console de lo que el collector ve como "candidatos de pager". */
function dumpPagerDiagnostics(scope: HTMLElement): void {
  const scopes = [
    '.rf-ds',
    '.ui-paginator',
    '.pagination',
    '.paginator',
    'table.rf-ds',
  ];
  for (const sel of scopes) {
    const nodes = scope.querySelectorAll(sel);
    if (nodes.length > 0) {
      nodes.forEach((n, i) =>
        console.log(
          `${LOG_PREFIX_LAZY()}   scope/${sel}[${i}]:`,
          (n as HTMLElement).outerHTML.slice(0, 500)
        )
      );
    }
  }
  const digitLinks = Array.from(scope.querySelectorAll<HTMLElement>('a, td, span')).filter(
    (a) => /^\d+$/.test((a.textContent ?? '').trim())
  );
  console.log(
    `${LOG_PREFIX_LAZY()}   elementos con texto=dígito dentro del scope: ${digitLinks.length}`,
    digitLinks.slice(0, 20).map((el) => ({
      tag: el.tagName,
      text: (el.textContent ?? '').trim(),
      class: el.className,
      parent: el.parentElement?.className,
    }))
  );
  // Dump del HTML del scope mismo — lo más útil para identificar el pager.
  console.log(
    `${LOG_PREFIX_LAZY()}   scope outerHTML (primeros 2000 chars):`,
    scope.outerHTML.slice(0, 2000)
  );
}

const LOG_PREFIX_LAZY = () => '[ProcuAsist PJN M6a]';

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
  // 1. Preferimos el botón flecha "siguiente" — más estable que adivinar números.
  const arrow = findNextArrowButton();
  if (arrow) {
    console.log(`${LOG_PREFIX_LAZY()} next=botón flecha (texto="${(arrow.textContent ?? '').trim()}" class="${arrow.className}")`);
    return arrow;
  }

  // 2. Fallback: link numérico = currentPage + 1.
  const links = findPagerLinks();
  if (!links.length) return null;

  const targetNum = String(currentPage + 1);
  const byNumber = links.find(
    (l) => (l.textContent ?? '').trim() === targetNum && !isActivePagerLink(l)
  );
  if (byNumber) {
    console.log(`${LOG_PREFIX_LAZY()} next=link numérico ${targetNum}`);
    return byNumber;
  }

  // 3. Fallback final: elemento después del activo.
  const activeIdx = links.findIndex(isActivePagerLink);
  if (activeIdx >= 0 && activeIdx + 1 < links.length) {
    const candidate = links[activeIdx + 1];
    if (!isActivePagerLink(candidate)) {
      console.log(`${LOG_PREFIX_LAZY()} next=sibling del activo (idx=${activeIdx + 1})`);
      return candidate;
    }
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
        datosGenerales: null,
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
          datosGenerales: null,
          pageKind,
          verHistoricasClicked: false,
          pages,
          startedAt,
          endedAt: Date.now(),
        };
      }
    }

    // "Ver históricas" es un link de navegación, no un botón AJAX. Si
    // estamos en expediente.seam y está visible, hacemos fetch same-origin
    // (sin navegar la pestaña) y mergeamos sus filas con dedupe.
    const verHistoricasHref =
      pageKind === 'expediente' ? getVerHistoricasHref() : undefined;
    const verHistoricasClicked = false;
    console.log(`${LOG_PREFIX} verHistoricasHref=${verHistoricasHref ?? '(no disponible)'}`);

    console.log(`${LOG_PREFIX} paso 3: iterar paginación de la página actual…`);
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
      console.log(`${LOG_PREFIX} fingerprint antes: "${fingerprintBefore.slice(0, 80)}…"`);
      simulateUserClick(nextLink);
      const { waitedMs, mutationDetected, fingerprintAfter } = await waitForTableChange(
        fingerprintBefore,
        maxWaitMs
      );
      console.log(
        `${LOG_PREFIX} post-click: waitedMs=${waitedMs} mutacion=${mutationDetected} fingerprint después: "${fingerprintAfter.slice(0, 80)}…"`
      );
      if (!mutationDetected) {
        // Diagnóstico: dump del elemento clickeado + su contexto.
        console.warn(
          `${LOG_PREFIX} el click en "${(nextLink.textContent ?? '').trim()}" no disparó postback. Info del elemento:`,
          {
            tag: nextLink.tagName,
            text: (nextLink.textContent ?? '').trim(),
            class: nextLink.className,
            href: (nextLink as HTMLAnchorElement).href ?? '',
            onclick: nextLink.getAttribute('onclick'),
            outerHTML: nextLink.outerHTML.slice(0, 400),
          }
        );
        const parent = nextLink.parentElement;
        if (parent) {
          console.warn(
            `${LOG_PREFIX} padre del click-target:`,
            parent.outerHTML.slice(0, 600)
          );
        }
      }
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

    // Paso 4 — si estamos en expediente.seam y hay URL real de históricas,
    // fetch y merge. Si solo tenemos el sentinel '#jsf-button', no podemos
    // fetchar (JSF genera cid server-side) y el modal avisa al usuario.
    if (
      pageKind === 'expediente' &&
      verHistoricasHref &&
      verHistoricasHref !== '#jsf-button'
    ) {
      console.log(`${LOG_PREFIX} paso 4: fetch de actuacionesHistoricas.seam…`);
      try {
        const extraRows = await fetchHistoricasRows(verHistoricasHref);
        let added = 0;
        for (const row of extraRows) {
          const key = dedupeKey(row);
          if (seen.has(key)) continue;
          seen.add(key);
          accumulated.push(row);
          added++;
        }
        console.log(
          `${LOG_PREFIX} históricas: fetched=${extraRows.length} nuevas=${added} total=${accumulated.length}`
        );
      } catch (err) {
        console.warn(`${LOG_PREFIX} fallo al fetchar históricas:`, err);
      }
    }

    // Parsear datos generales (solo disponibles en expediente.seam).
    const datosGenerales =
      pageKind === 'expediente'
        ? parseDatosGenerales(document, new URL(window.location.href))
        : null;

    console.log(`${LOG_PREFIX} fin — total=${accumulated.length} páginas=${pages.length}`);
    return {
      ok: true,
      totalActuaciones: accumulated.length,
      actuaciones: accumulated,
      datosGenerales,
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
      datosGenerales: null,
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

// ────────────────────────────────────────────────────────
// Fetch de actuacionesHistoricas.seam (same-origin con cookies)
// ────────────────────────────────────────────────────────

/**
 * Trae el HTML de actuacionesHistoricas.seam, decodifica ISO-8859-1 y parsea
 * las actuaciones. Solo devuelve la primera página — si hay más pages dentro
 * de históricas, quedan para M6b.2+ (requiere postbacks JSF con ViewState).
 */
async function fetchHistoricasRows(href: string): Promise<PjnActuacion[]> {
  const resp = await fetch(href, {
    credentials: 'include',
    headers: { Accept: 'text/html' },
  });
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} al pedir ${href}`);
  }
  const buf = await resp.arrayBuffer();

  // Charset: header → meta tag → fallback iso-8859-1 (default de SCW).
  const ct = resp.headers.get('content-type') ?? '';
  const headerCharset = ct.match(/charset=([^;]+)/i)?.[1]?.trim().toLowerCase();
  let charset = headerCharset;
  if (!charset) {
    // Intentar detectar del meta en los primeros KB.
    const preview = new TextDecoder('ascii').decode(buf.slice(0, 2048));
    const metaMatch = preview.match(/<meta[^>]+charset=["']?([^"'>\s]+)/i);
    charset = metaMatch?.[1]?.toLowerCase() ?? 'iso-8859-1';
  }

  let html: string;
  try {
    html = new TextDecoder(charset).decode(buf);
  } catch {
    html = new TextDecoder('iso-8859-1').decode(buf);
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const parsed = parseActuacionesTab(doc);
  return parsed.rows;
}
