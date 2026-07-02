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
import {
  collectScwListRows,
  findAndOpenCaseInList,
} from '@/modules/portals/pjn-list-collector';
import { mountPjnZipButton } from '@/modules/portals/pjn-zip-ui';
import { mountPjnCaseActions } from '@/modules/portals/pjn-actions-ui';
import {
  isImportableRow,
  mountPjnListImportButton,
  toImportCase,
} from '@/modules/portals/pjn-list-import-ui';
import { mountPjnBulkNoteButton } from '@/modules/portals/pjn-bulk-note-ui';
import { IMPORT_ALL_CANCEL_STORAGE_KEY } from '@/modules/messages/types';

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

    if (msg.type === 'IMPORT_ALL_COLLECT_LIST') {
      const { runId, sourceKey } = msg as {
        runId: string;
        sourceKey: string;
      };
      if (!isScwListadoPage(new URL(window.location.href).pathname)) {
        sendResponse({
          ok: false,
          error: 'La pestana scw no esta en un listado PJN.',
        });
        return false;
      }
      // Ack inmediato: la recoleccion puede tardar mas que el tope de 5
      // minutos del canal de mensajes MV3, asi que el resultado viaja en un
      // mensaje IMPORT_ALL_SOURCE_DONE aparte.
      sendResponse({ ok: true });
      void runImportAllCollection(runId, sourceKey);
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

      collectScwListRows({ maxPages })
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

/**
 * Recolección para el asistente "Importar todo": recorre el listado con tope
 * extendido y pausas de cortesía, reporta progreso por página (cada mensaje
 * además mantiene vivo el service worker MV3) y entrega los casos ya mapeados
 * al formato de BULK_IMPORT en un mensaje final.
 */
async function runImportAllCollection(
  runId: string,
  sourceKey: string
): Promise<void> {
  try {
    const mode = parseScwList(document, new URL(window.location.href)).mode;
    const collected = await collectScwListRows({
      maxPages: 120,
      allowExtendedPages: true,
      pauseMs: 1200,
      onPage: (pagesVisited, rowsCollected) => {
        chrome.runtime
          .sendMessage({
            type: 'IMPORT_ALL_PROGRESS',
            runId,
            sourceKey,
            detail: `página ${pagesVisited}, ${rowsCollected} causas recolectadas`,
          })
          .catch(() => {});
      },
      shouldCancel: async () => {
        try {
          const stored = await chrome.storage.local.get(
            IMPORT_ALL_CANCEL_STORAGE_KEY
          );
          return stored[IMPORT_ALL_CANCEL_STORAGE_KEY] === true;
        } catch {
          return false;
        }
      },
    });

    const cases = collected.rows
      .filter(isImportableRow)
      .map((row) => toImportCase(row, mode));

    await chrome.runtime.sendMessage({
      type: 'IMPORT_ALL_SOURCE_DONE',
      runId,
      sourceKey,
      ok: true,
      cases,
      pagesVisited: collected.pagesVisited,
      truncated: collected.truncated,
      cancelled: collected.cancelled,
    });
  } catch (err) {
    console.error('[ProcuAsist PJN] Importar todo: recoleccion fallo', err);
    chrome.runtime
      .sendMessage({
        type: 'IMPORT_ALL_SOURCE_DONE',
        runId,
        sourceKey,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      })
      .catch(() => {});
  }
}

function initScwDebug(): void {
  const url = new URL(window.location.href);
  if (isScwListadoPage(url.pathname)) {
    mountPjnListImportButton(url);
    mountPjnBulkNoteButton(url);
    void maybeOpenTargetCase();
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
// Abrir un expediente puntual desde el panel lateral
// ────────────────────────────────────────────────────────

/**
 * When the side panel asks to open a specific PJN case, the background stores
 * the target expediente and opens this listing. Here we consume that target
 * and click the matching row's (fresh) detail link — SCW deep links expire,
 * so we can't navigate to expediente.seam directly.
 */
async function maybeOpenTargetCase(): Promise<void> {
  try {
    const resp = (await chrome.runtime.sendMessage({
      type: 'CONSUME_PJN_OPEN_TARGET',
    })) as { success: boolean; target?: { caseNumber: string } } | undefined;

    if (!resp?.success || !resp.target?.caseNumber) return;

    const opened = await findAndOpenCaseInList(resp.target.caseNumber, {
      maxPages: 15,
    });
    if (!opened) {
      console.warn(
        '[ProcuAsist PJN] No encontré el expediente en el listado:',
        resp.target.caseNumber
      );
    }
  } catch (err) {
    console.debug('[ProcuAsist PJN] No pude abrir el expediente objetivo:', err);
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
