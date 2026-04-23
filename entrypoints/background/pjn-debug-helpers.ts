/**
 * Helpers de debug expuestos como globales en el service worker.
 *
 * `chrome.runtime.sendMessage` llamado desde la consola del propio service
 * worker no llega al listener (el SW es el emisor y no puede recibirse a sí
 * mismo). Para debug interactivo exponemos funciones directamente en `self`.
 *
 * Uso desde la consola del service worker:
 *   await pjnGetEvents()
 *   await pjnGetEvents({ page: 1 })
 *   pjnTokenStatus()
 */

import { getEvents } from '@/modules/portals/pjn-api-client';
import { getToken, getTokenAgeMs, clearToken } from '@/modules/portals/pjn-token-store';
import {
  downloadPjnPdf,
  findScwActuacionesTab,
  findScwTab,
} from '@/modules/portals/pjn-downloader';
import type { PjnCollectorResult } from '@/modules/portals/pjn-actuaciones-collector';

type GlobalHelpers = {
  pjnGetEvents: typeof pjnGetEvents;
  pjnTokenStatus: typeof pjnTokenStatus;
  pjnClearToken: typeof clearToken;
  pjnDownloadPdf: typeof pjnDownloadPdfDebug;
  pjnCollectActuaciones: typeof pjnCollectActuacionesDebug;
};

export function installPjnDebugHelpers(): void {
  const target = self as unknown as GlobalHelpers;
  target.pjnGetEvents = pjnGetEvents;
  target.pjnTokenStatus = pjnTokenStatus;
  target.pjnClearToken = clearToken;
  target.pjnDownloadPdf = pjnDownloadPdfDebug;
  target.pjnCollectActuaciones = pjnCollectActuacionesDebug;
  (target as unknown as { pjnPing: typeof pjnPingDebug }).pjnPing = pjnPingDebug;

  console.debug(
    '[ProcuAsist PJN] Debug helpers: pjnGetEvents(), pjnTokenStatus(), pjnClearToken(), pjnDownloadPdf(href), pjnCollectActuaciones(), pjnPing()'
  );
}

async function pjnPingDebug() {
  const tabs = await chrome.tabs.query({ url: 'https://scw.pjn.gov.ar/*' });
  if (!tabs.length) {
    console.warn('No hay pestañas scw.pjn.gov.ar abiertas.');
    return { ok: false, error: 'no-scw-tab' };
  }
  console.log(`Pestañas scw encontradas: ${tabs.length}`);
  const results = [];
  for (const tab of tabs) {
    if (!tab.id) continue;
    const info = await new Promise<unknown>((resolve) => {
      chrome.tabs.sendMessage(tab.id!, { type: 'PJN_PING' }, (response) => {
        const err = chrome.runtime.lastError;
        if (err) {
          resolve({ tabId: tab.id, url: tab.url, error: err.message });
          return;
        }
        resolve({ tabId: tab.id, url: tab.url, response });
      });
    });
    results.push(info);
  }
  console.table(results);
  return results;
}

async function pjnGetEvents(params: {
  page?: number;
  pageSize?: number;
  fechaHasta?: number;
} = {}) {
  const token = getToken();
  const ageMs = getTokenAgeMs();
  console.groupCollapsed(
    `%c[ProcuAsist PJN] getEvents — token=${token ? 'sí' : 'no'}${ageMs !== null ? ` age=${Math.round(ageMs / 1000)}s` : ''}`,
    'color: #2a5d9f; font-weight: bold;'
  );
  const result = await getEvents(params);
  if (result.ok) {
    console.log(
      `hasNext=${result.data.hasNext} items=${result.data.items.length} numberOfItems=${result.data.numberOfItems}`
    );
    console.log('Respuesta cruda:', result.data);
    console.table(
      result.data.items.map((e) => ({
        fecha: formatMsDate(e.fechaFirma ?? e.fechaAccion ?? e.fechaCreacion),
        tipo: e.tipo,
        expediente: e.payload?.claveExpediente ?? '(sin payload)',
        caratula: (e.payload?.caratulaExpediente ?? '').slice(0, 60),
        hasDocument: e.hasDocument,
      }))
    );
  } else {
    console.warn('error:', result.error);
  }
  console.groupEnd();
  return result;
}

function formatMsDate(ms: unknown): string {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return '(sin fecha)';
  try {
    return new Date(ms).toISOString().slice(0, 19);
  } catch {
    return '(fecha inválida)';
  }
}

async function pjnDownloadPdfDebug(href: string) {
  if (typeof href !== 'string' || !href) {
    console.warn('Uso: pjnDownloadPdf("/scw/viewer.seam?id=...&tipoDoc=despacho")');
    return { success: false, error: 'href inválido' };
  }
  const tabId = await findScwTab();
  if (!tabId) {
    console.warn(
      'No hay pestaña scw.pjn.gov.ar abierta. Abrí el expediente y volvé a intentar.'
    );
    return { success: false, error: 'no-scw-tab' };
  }
  console.debug(`[ProcuAsist PJN] Descargando vía tab ${tabId}: ${href}`);
  const result = await downloadPjnPdf(tabId, href);
  if (!result.success) {
    console.warn('Error:', result.error);
    return result;
  }
  const dataUri = `data:${result.mimeType};base64,${result.base64}`;
  await chrome.downloads.download({
    url: dataUri,
    filename: result.filename,
    saveAs: false,
  });
  console.log(
    `OK: ${result.filename} (${Math.round(result.sizeBytes / 1024)} KB, ${result.mimeType})`
  );
  return result;
}

async function pjnCollectActuacionesDebug(
  opts: { maxWaitMs?: number } = {}
): Promise<PjnCollectorResult | { ok: false; error: string }> {
  const tabId = await findScwActuacionesTab();
  if (!tabId) {
    console.warn(
      'No hay pestaña scw.pjn.gov.ar en expediente.seam ni actuacionesHistoricas.seam. Abrí un expediente y volvé a intentar.'
    );
    return { ok: false, error: 'no-actuaciones-tab' };
  }
  console.groupCollapsed(
    `%c[ProcuAsist PJN] collectActuaciones — tabId=${tabId}`,
    'color: #991b1b; font-weight: bold;'
  );
  const result = await new Promise<PjnCollectorResult | { ok: false; error: string }>(
    (resolve) => {
      chrome.tabs.sendMessage(
        tabId,
        { type: 'PJN_COLLECT_ACTUACIONES', maxWaitMs: opts.maxWaitMs },
        (response) => {
          const err = chrome.runtime.lastError;
          if (err) {
            resolve({ ok: false, error: err.message ?? 'runtime error' });
            return;
          }
          if (!response) {
            resolve({ ok: false, error: 'sin respuesta del content script' });
            return;
          }
          resolve(response as PjnCollectorResult);
        }
      );
    }
  );

  if (!result.ok) {
    console.warn('Error:', result.error);
    console.groupEnd();
    return result;
  }

  const r = result as PjnCollectorResult;
  console.log(
    `total=${r.totalActuaciones} verHistóricasClick=${r.verHistoricasClicked} páginas=${r.pages.length} duración=${r.endedAt - r.startedAt}ms`
  );
  console.table(
    r.pages.map((p) => ({
      pagina: p.page,
      parseadas: p.parsedInPage,
      nuevas: p.addedToAccumulated,
      esperaMs: p.waitedMs,
      mutacion: p.mutationDetected,
    }))
  );
  console.log('Actuaciones:', r.actuaciones);
  console.groupEnd();
  return r;
}

function pjnTokenStatus() {
  const token = getToken();
  const ageMs = getTokenAgeMs();
  if (!token) {
    console.log('No hay token capturado todavía. Navegá por portalpjn.pjn.gov.ar para que el SPA haga requests a api.pjn.gov.ar.');
    return { hasToken: false };
  }
  const ageSec = ageMs !== null ? Math.round(ageMs / 1000) : null;
  console.log(`Token capturado hace ${ageSec}s. Bearer empieza con: ${token.bearer.slice(0, 20)}...`);
  return { hasToken: true, ageSeconds: ageSec };
}
