/**
 * Content script para PJN (Poder Judicial de la Nación).
 *
 * M1: confirma sesión desde portalpjn.pjn.gov.ar (LOGIN_SUCCESS).
 * M3: parsea listados de scw.pjn.gov.ar (Relacionados / Favoritos) y muestra
 *     un panel flotante de verificación.
 * M4: parsea el detalle de un expediente (expediente.seam) y muestra datos
 *     generales + estado de las cuatro pestañas. Acumula datos a medida que
 *     el usuario cambia de tab (parse-on-visit).
 *
 * El auto-login contra Keycloak vive en eje.content.ts (compartido vía
 * detectPortalFromKeycloakUrl). Sin UI de descarga todavía — eso llega en M5-M8.
 */

import {
  isScwActuacionesPage,
  isScwExpediente,
  isScwListadoPage,
  parseExpedientePage,
  parseScwList,
  type PjnExpedienteData,
  type PjnTabName,
} from '@/modules/portals/pjn-parser';
import {
  renderDebugPanel,
  renderExpedienteDebugPanel,
} from '@/modules/portals/pjn-debug-panel';
import {
  collectAllActuaciones,
  type PjnCollectorResult,
} from '@/modules/portals/pjn-actuaciones-collector';
import { mountPjnZipButton } from '@/modules/portals/pjn-zip-ui';
import { mountPjnCaseActions } from '@/modules/portals/pjn-actions-ui';
import { mountPjnListImportButton } from '@/modules/portals/pjn-list-import-ui';

export interface PjnCollectActuacionesMessage {
  type: 'PJN_COLLECT_ACTUACIONES';
  maxWaitMs?: number;
}

export interface PjnCollectListRowsMessage {
  type: 'PJN_COLLECT_LIST_ROWS';
  maxPages?: number;
}

export default defineContentScript({
  matches: [
    'https://portalpjn.pjn.gov.ar/*',
    'https://scw.pjn.gov.ar/*',
  ],
  registration: 'manifest',
  runAt: 'document_idle',

  main() {
    console.debug('[ProcuAsist PJN] content script loaded on:', window.location.hostname);

    if (window.location.hostname === 'portalpjn.pjn.gov.ar') {
      chrome.runtime.sendMessage({ type: 'LOGIN_SUCCESS', portal: 'pjn' });
      return;
    }

    if (window.location.hostname === 'scw.pjn.gov.ar') {
      initScwDebug();
      installCollectorListener();
    }
  },
});

// ────────────────────────────────────────────────────────
// M6a — listener para corridas iniciadas desde el SW
// ────────────────────────────────────────────────────────

function installCollectorListener(): void {
  console.log(
    `[ProcuAsist PJN M6a] listener instalado en ${window.location.href}`
  );
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || typeof msg !== 'object') return false;

    if (msg.type === 'PJN_PING') {
      const pathname = window.location.pathname;
      sendResponse({
        ok: true,
        url: window.location.href,
        pathname,
        isExpediente: isScwExpediente(pathname),
        isActuacionesPage: isScwActuacionesPage(pathname),
        timestamp: Date.now(),
      });
      return false;
    }

    if (msg.type === 'PJN_COLLECT_LIST_ROWS') {
      const { maxPages } = msg as PjnCollectListRowsMessage;
      if (!isScwListadoPage(new URL(window.location.href).pathname)) {
        sendResponse({
          ok: false,
          error: 'La pestana scw no esta en un listado PJN.',
        });
        return false;
      }

      collectListRows({ maxPages })
        .then(sendResponse)
        .catch((err) => {
          console.error('[ProcuAsist PJN] error recolectando listado', err);
          sendResponse({
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      return true;
    }

    if (msg.type !== 'PJN_COLLECT_ACTUACIONES') return false;

    console.log('[ProcuAsist PJN M6a] mensaje recibido, iniciando collector…');
    const { maxWaitMs } = msg as PjnCollectActuacionesMessage;
    if (!isScwActuacionesPage(new URL(window.location.href).pathname)) {
      sendResponse({
        ok: false,
        error:
          'La pestaña scw no está en expediente.seam ni en actuacionesHistoricas.seam.',
      } satisfies Partial<PjnCollectorResult>);
      return false;
    }
    collectAllActuaciones({ maxWaitMs })
      .then((result) => {
        console.log('[ProcuAsist PJN M6a] enviando respuesta al SW', result);
        sendResponse(result);
      })
      .catch((err) => {
        console.error('[ProcuAsist PJN M6a] error no capturado', err);
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        } satisfies Partial<PjnCollectorResult>);
      });
    return true; // respuesta asíncrona
  });
}

async function collectListRows(options: { maxPages?: number } = {}) {
  const maxPages = Math.max(1, Math.min(options.maxPages ?? 12, 25));
  const seen = new Set<string>();
  const rows: ReturnType<typeof parseScwList>['rows'] = [];
  let pagesVisited = 0;

  for (let page = 0; page < maxPages; page++) {
    const parsed = parseScwList(document, new URL(window.location.href));
    pagesVisited++;

    for (const row of parsed.rows) {
      const key = [
        normalizeForPaging(row.expediente),
        normalizeForPaging(row.dependencia),
        normalizeForPaging(row.caratula),
      ].join('|');
      if (!key.trim() || seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
    }

    const next = findNextListPageControl();
    if (!next) break;

    const before = listSignature();
    next.click();
    const changed = await waitForListSignatureChange(before, 3500);
    if (!changed) break;
  }

  return {
    ok: true,
    rows,
    pagesVisited,
  };
}

function findNextListPageControl(): HTMLElement | null {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      'a, button, input[type="button"], input[type="submit"]'
    )
  );

  for (const el of candidates) {
    if (!isVisibleElement(el) || isDisabledElement(el)) continue;

    const input = el as HTMLInputElement;
    const label = normalizeForPaging(
      [el.textContent, input.value, el.title, el.getAttribute('aria-label')]
        .filter(Boolean)
        .join(' ')
    );

    if (/\b(proximo|siguiente|next)\b|[>›»]/.test(label)) {
      return el;
    }
  }

  return null;
}

function waitForListSignatureChange(
  previousSignature: string,
  timeoutMs: number
): Promise<boolean> {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const check = () => {
      if (listSignature() !== previousSignature) {
        resolve(true);
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        resolve(false);
        return;
      }
      window.setTimeout(check, 150);
    };
    window.setTimeout(check, 150);
  });
}

function listSignature(): string {
  const parsed = parseScwList(document, new URL(window.location.href));
  return parsed.rows
    .map((row) =>
      [
        normalizeForPaging(row.expediente),
        normalizeForPaging(row.ultimaActualizacion),
        normalizeForPaging(row.situacion),
      ].join(':')
    )
    .join(';');
}

function isVisibleElement(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function isDisabledElement(el: HTMLElement): boolean {
  const input = el as HTMLInputElement;
  return (
    input.disabled ||
    el.getAttribute('aria-disabled') === 'true' ||
    /\b(disabled|ui-state-disabled|rf-dsbl)\b/i.test(el.className)
  );
}

function normalizeForPaging(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function initScwDebug(): void {
  const url = new URL(window.location.href);
  if (isScwListadoPage(url.pathname)) {
    mountPjnListImportButton(url);
    if (import.meta.env.DEV) initListMode(url);
    return;
  }
  if (isScwActuacionesPage(url.pathname)) {
    // FAB real para release — también en actuacionesHistoricas.seam.
    mountPjnZipButton();
  }
  if (isScwExpediente(url.pathname)) {
    const parsed = parseExpedientePage(document, url);
    mountPjnCaseActions(parsed, window.location.href);

    // Panel debug M4 solo en dev.
    if (import.meta.env.DEV) initExpedienteMode(url);
    return;
  }
}

// ────────────────────────────────────────────────────────
// M3 — list mode
// ────────────────────────────────────────────────────────

function initListMode(url: URL): void {
  let debounce: number | undefined;
  let lastSignature = '';

  const parseAndRender = () => {
    const result = parseScwList(document, url);
    const signature =
      result.mode +
      '|' +
      result.rows.length +
      '|' +
      result.rows
        .map((r) => r.expediente + ':' + r.ultimaActualizacion + ':' + r.isFavorito)
        .join(';');
    if (signature === lastSignature) return;
    lastSignature = signature;

    console.groupCollapsed(
      `%c[ProcuAsist PJN] ${result.mode} — ${result.rows.length} causas parseadas`,
      'color: #2a5d9f; font-weight: bold;'
    );
    console.table(result.rows);
    if (result.unresolvedHeaders.length) {
      console.warn('Headers sin mapear:', result.unresolvedHeaders);
    }
    if (!result.rows.length) {
      console.warn('Sin filas. Headers detectados:', result.headerTexts);
    }
    console.groupEnd();
    renderDebugPanel(result);
  };

  parseAndRender();

  const mo = new MutationObserver(() => {
    window.clearTimeout(debounce);
    debounce = window.setTimeout(parseAndRender, 300);
  });
  mo.observe(document.body, { childList: true, subtree: true });
}

// ────────────────────────────────────────────────────────
// M4 — expediente mode
// ────────────────────────────────────────────────────────

function initExpedienteMode(url: URL): void {
  let debounce: number | undefined;
  let lastSignature = '';
  let accumulated: PjnExpedienteData | null = null;

  const parseAndRender = () => {
    const fresh = parseExpedientePage(document, url);
    accumulated = mergeExpediente(accumulated, fresh);

    const signature = buildExpedienteSignature(accumulated);
    if (signature === lastSignature) return;
    lastSignature = signature;

    console.groupCollapsed(
      `%c[ProcuAsist PJN] expediente ${accumulated.datosGenerales?.expediente ?? '(sin cabecera)'} — tab activa: ${fresh.activeTab}`,
      'color: #2a5d9f; font-weight: bold;'
    );
    console.log('datosGenerales:', accumulated.datosGenerales);
    for (const tab of ['actuaciones', 'intervinientes', 'vinculados', 'recursos'] as PjnTabName[]) {
      const st = accumulated.tabs[tab];
      if (!st.loaded) {
        console.log(`${tab}: (no visitada)`);
      } else if (st.isEmpty) {
        console.log(`${tab}: vacía`);
      } else {
        console.log(`${tab}: ${st.rows.length} filas`, st.rows);
      }
    }
    if (accumulated.notas) console.log('notas:', accumulated.notas);
    console.groupEnd();

    renderExpedienteDebugPanel(accumulated);
  };

  parseAndRender();

  // JSF AJAX reloads the tab content on click. Observe and re-parse, debounced.
  const mo = new MutationObserver(() => {
    window.clearTimeout(debounce);
    debounce = window.setTimeout(parseAndRender, 300);
  });
  mo.observe(document.body, { childList: true, subtree: true });
}

/**
 * Merge a fresh parse into the accumulated state. Tabs that were previously
 * loaded are kept; datos generales are refreshed (favorito state can toggle).
 * This way the user sees a growing picture as they click through tabs, even
 * if JSF removes inactive tab DOM between AJAX updates.
 */
function mergeExpediente(
  prev: PjnExpedienteData | null,
  fresh: PjnExpedienteData
): PjnExpedienteData {
  if (!prev) return fresh;

  const tabs = { ...prev.tabs };
  for (const name of ['actuaciones', 'intervinientes', 'vinculados', 'recursos'] as PjnTabName[]) {
    const freshTab = fresh.tabs[name];
    const prevTab = prev.tabs[name];
    // Prefer the fresh parse if it loaded data; otherwise keep the prior state.
    if (freshTab.loaded) {
      (tabs as Record<PjnTabName, unknown>)[name] = freshTab;
    } else {
      (tabs as Record<PjnTabName, unknown>)[name] = prevTab;
    }
  }

  return {
    datosGenerales: fresh.datosGenerales ?? prev.datosGenerales,
    activeTab: fresh.activeTab !== 'unknown' ? fresh.activeTab : prev.activeTab,
    tabs: tabs as PjnExpedienteData['tabs'],
    notas: fresh.notas || prev.notas,
  };
}

function buildExpedienteSignature(data: PjnExpedienteData): string {
  const dg = data.datosGenerales;
  const dgSig = dg
    ? `${dg.expediente}|${dg.situacionActual}|${dg.isFavorito}`
    : 'nodg';
  const tabSigs = (['actuaciones', 'intervinientes', 'vinculados', 'recursos'] as PjnTabName[])
    .map((name) => {
      const st = data.tabs[name];
      return `${name}:${st.loaded ? 1 : 0}:${st.isEmpty ? 1 : 0}:${st.rows.length}`;
    })
    .join(';');
  return `${dgSig}|${data.activeTab}|${tabSigs}`;
}
