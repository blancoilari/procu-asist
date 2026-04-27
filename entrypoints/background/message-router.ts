/**
 * Central message router for the background service worker.
 * All messages from content scripts, popup, side panel, and options page
 * are routed here.
 */

import type { ProcuAsistMessage } from '@/modules/messages/types';
import {
  setupPin,
  unlockWithPin,
  lock,
  isUnlocked,
  isPinSetup,
} from '@/modules/crypto/key-manager';
import {
  saveCredentials,
  getCredentials,
} from '@/modules/storage/credential-store';
import {
  addBookmark,
  removeBookmark,
  getBookmarks,
  updateBookmark,
  searchBookmarks,
  isBookmarked,
} from '@/modules/storage/bookmark-store';
import {
  addMonitor,
  backfillMonitorMetadata,
  removeMonitor,
  getMonitors,
  getActiveMonitors,
  toggleMonitor,
  isMonitored,
  getAlerts,
  getAlertsForMonitor,
  getUnreadAlertCount,
  markAlertRead,
  markAllAlertsRead,
} from '@/modules/storage/monitor-store';
import { getSettings, updateSettings } from '@/modules/storage/settings-store';
import { generateCaseZip } from '@/modules/pdf/case-zip-generator';
import {
  downloadMevAttachment,
  findMevTab,
} from '@/modules/pdf/attachment-downloader';
import { MEV_BASE_URL, MEV_URLS } from '@/modules/portals/mev-selectors';
import type { MevSearchResult } from '@/modules/portals/mev-parser';
import { handleSessionExpired } from './auto-reconnect';
import { scanMonitoredCases } from './case-monitor';
import { getEvents } from '@/modules/portals/pjn-api-client';
import { getToken, getTokenAgeMs } from '@/modules/portals/pjn-token-store';
import {
  downloadPjnPdf,
  findScwActuacionesTab,
  findScwTab,
} from '@/modules/portals/pjn-downloader';
import { generatePjnCaseZip } from '@/modules/pdf/pjn-zip-generator';

export function setupMessageRouter() {
  chrome.runtime.onMessage.addListener(
    (message: ProcuAsistMessage, sender, sendResponse) => {
      handleMessage(message, sender)
        .then(sendResponse)
        .catch((err) => {
          console.error('[ProcuAsist] Message handler error:', err);
          sendResponse({ error: err.message });
        });

      // Return true to indicate async response
      return true;
    }
  );
}

async function handleMessage(
  message: ProcuAsistMessage,
  _sender: chrome.runtime.MessageSender
): Promise<unknown> {
  switch (message.type) {
    // --- PIN Management ---
    case 'SETUP_PIN': {
      const success = await setupPin(message.pin);
      return { success };
    }

    case 'UNLOCK_PIN': {
      const success = await unlockWithPin(message.pin);
      return { success };
    }

    case 'LOCK': {
      lock();
      return { success: true };
    }

    case 'GET_LOCK_STATUS': {
      const pinConfigured = await isPinSetup();
      return {
        pinConfigured,
        unlocked: isUnlocked(),
      };
    }

    // --- Credential Management ---
    case 'SAVE_CREDENTIALS': {
      await saveCredentials(message.portal, {
        username: message.username,
        password: message.password,
      });
      return { success: true };
    }

    case 'GET_CREDENTIALS': {
      try {
        const creds = await getCredentials(message.portal);
        if (!creds) {
          return { success: false, reason: 'no_credentials' };
        }
        return { success: true, credentials: creds };
      } catch {
        // Vault is locked — return gracefully instead of throwing
        return { success: false, reason: 'vault_locked' };
      }
    }

    // --- Session Management ---
    case 'SESSION_EXPIRED': {
      const tabId = _sender.tab?.id;
      if (tabId) {
        await handleSessionExpired(message.portal, message.returnUrl, tabId);
      }
      return { status: 'acknowledged' };
    }

    case 'LOGIN_SUCCESS': {
      console.debug('[ProcuAsist] Login success for portal:', message.portal);
      return { status: 'ok' };
    }

    // --- Side Panel ---
    case 'OPEN_SIDEPANEL': {
      const windowId = _sender.tab?.windowId;
      if (windowId) {
        await chrome.sidePanel.open({ windowId });
      }
      return { status: 'ok' };
    }

    // --- Bookmarks ---
    case 'ADD_BOOKMARK': {
      const existing = await isBookmarked(
        message.caseData.portal,
        message.caseData.caseNumber
      );
      const bookmark = await addBookmark(message.caseData);
      return { success: true, bookmark, isNew: !existing };
    }

    case 'REMOVE_BOOKMARK': {
      await removeBookmark(message.portal, message.caseNumber);
      return { success: true };
    }

    case 'GET_BOOKMARKS': {
      const bookmarks = message.query
        ? await searchBookmarks(message.query)
        : await getBookmarks();
      return { success: true, bookmarks };
    }

    case 'IS_BOOKMARKED': {
      const result = await isBookmarked(message.portal, message.caseNumber);
      return { success: true, isBookmarked: result };
    }

    // --- Settings ---
    case 'GET_SETTINGS': {
      const settings = await getSettings();
      return { success: true, settings };
    }

    case 'UPDATE_SETTINGS': {
      const updated = await updateSettings(
        message.settings as Parameters<typeof updateSettings>[0]
      );
      return { success: true, settings: updated };
    }

    // --- Case Data ---
    case 'CASE_PAGE_DETECTED': {
      console.debug('[ProcuAsist] Case detected:', message.caseData.caseNumber);
      // Store last detected case for quick-bookmark from sidepanel
      await chrome.storage.session.set({
        lastDetectedCase: message.caseData,
      });
      await backfillMonitorMetadata({
        portal: message.caseData.portal,
        caseNumber: message.caseData.caseNumber,
        title: message.caseData.title,
        court: message.caseData.court,
        portalUrl: message.caseData.portalUrl,
        metadata: {
          nidCausa: message.caseData.metadata?.nidCausa,
          pidJuzgado: message.caseData.metadata?.pidJuzgado,
        },
      });
      return { status: 'ok' };
    }

    case 'GENERATE_ZIP': {
      console.debug('[ProcuAsist] ZIP generation for:', message.caseData.caseNumber);
      try {
        const mevTabId = await findMevTab();
        if (!mevTabId) {
          return { success: false, error: 'No hay una pestaña de MEV abierta. Abrí MEV primero.' };
        }

        const result = await generateCaseZip(message.caseData, mevTabId);

        if (!result.success || !result.blob) {
          return { success: false, error: result.error ?? 'Error al generar ZIP' };
        }

        // Convert Blob to base64 data URI for chrome.downloads
        const arrayBuffer = await result.blob.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
        const base64 = btoa(binary);
        const dataUri = `data:application/zip;base64,${base64}`;

        await chrome.downloads.download({
          url: dataUri,
          filename: result.filename!,
          saveAs: true,
        });

        return { success: true, filename: result.filename, stats: result.stats };
      } catch (err) {
        console.error('[ProcuAsist] ZIP generation error:', err);
        return {
          success: false,
          error: err instanceof Error ? err.message : 'ZIP generation failed',
        };
      }
    }

    case 'DOWNLOAD_ATTACHMENT': {
      const mevTab = await findMevTab();
      if (!mevTab) {
        return {
          success: false,
          error: 'No MEV tab found. Open MEV first.',
        };
      }
      const dlResult = await downloadMevAttachment(
        mevTab,
        message.url,
        message.name
      );
      return dlResult;
    }

    // --- Search Results ---
    case 'SEARCH_RESULTS': {
      console.debug(
        `[ProcuAsist] Search results: ${message.results.length} cases`
      );
      return { status: 'ok' };
    }

    // --- Monitors ---
    case 'ADD_MONITOR': {
      const monitor = await addMonitor({
        portal: message.caseData.portal,
        caseNumber: message.caseData.caseNumber,
        title: message.caseData.title,
        court: message.caseData.court,
        portalUrl: message.caseData.portalUrl,
        metadata: {
          nidCausa: message.caseData.metadata?.nidCausa,
          pidJuzgado: message.caseData.metadata?.pidJuzgado,
        },
      });
      return { success: true, monitor };
    }

    case 'REMOVE_MONITOR': {
      await removeMonitor(message.monitorId);
      return { success: true };
    }

    case 'GET_MONITORS': {
      const monitors = message.activeOnly
        ? await getActiveMonitors()
        : await getMonitors();
      return { success: true, monitors };
    }

    case 'TOGGLE_MONITOR': {
      const toggled = await toggleMonitor(message.monitorId);
      return { success: true, monitor: toggled };
    }

    case 'IS_MONITORED': {
      const monitored = await isMonitored(message.portal, message.caseNumber);
      return { success: true, isMonitored: monitored };
    }

    // --- Alerts ---
    case 'GET_ALERTS': {
      const alerts = message.monitorId
        ? await getAlertsForMonitor(message.monitorId)
        : await getAlerts();
      const unreadCount = await getUnreadAlertCount();
      return { success: true, alerts, unreadCount };
    }

    case 'MARK_ALERT_READ': {
      await markAlertRead(message.alertId);
      return { success: true };
    }

    case 'MARK_ALL_ALERTS_READ': {
      await markAllAlertsRead();
      return { success: true };
    }

    case 'ENRICH_SCBA_MIS_CAUSAS': {
      return enrichScbaMisCausas();
    }

    // --- Scan ---
    case 'RUN_SCAN_NOW': {
      // Run scan in background, don't block the message response
      scanMonitoredCases().catch((err) =>
        console.error('[ProcuAsist] Manual scan error:', err)
      );
      return { success: true, status: 'scan_started' };
    }

    case 'RUN_SCAN_SINCE': {
      // Run scan in background and let the side panel poll session storage.
      scanMonitoredCases({ fromDate: message.fromDate }).catch((err) =>
        console.error('[ProcuAsist] Date-range scan error:', err)
      );
      return { success: true, status: 'scan_started' };
    }

    // --- Bulk Import ---
    case 'BULK_IMPORT': {
      console.debug(
        `[ProcuAsist] Bulk import: ${message.cases.length} cases from ${message.source}`
      );
      let imported = 0;
      let existing = 0;
      let monitored = 0;
      for (const c of message.cases) {
        try {
          const richCaseObj = c;
          const portal = richCaseObj.portal ?? ('mev' as const);
          const wasBookmarked = await isBookmarked(portal, richCaseObj.caseNumber);
          const caseData = {
            id:
              richCaseObj.id ||
              richCaseObj.metadata?.nidCausa ||
              richCaseObj.caseNumber,
            portal,
            caseNumber: richCaseObj.caseNumber,
            title: richCaseObj.title || 'Sin caratula',
            court: richCaseObj.court ?? '',
            fuero: richCaseObj.fuero ?? '',
            portalUrl: richCaseObj.portalUrl ?? '',
            metadata: richCaseObj.metadata,
          };

          await addBookmark(caseData);
          if (wasBookmarked) {
            existing++;
          } else {
            imported++;
          }

          if (
            message.monitor &&
            portal === 'mev' &&
            caseData.metadata?.nidCausa &&
            caseData.metadata?.pidJuzgado
          ) {
            const wasMonitored = await isMonitored(portal, richCaseObj.caseNumber);
            await addMonitor({
              portal,
              caseNumber: richCaseObj.caseNumber,
              title: caseData.title,
              court: caseData.court,
              portalUrl: caseData.portalUrl,
              metadata: {
                nidCausa: caseData.metadata.nidCausa,
                pidJuzgado: caseData.metadata.pidJuzgado,
              },
            });
            if (!wasMonitored) monitored++;
          }
        } catch {
          // Skip duplicates or errors, continue importing
        }
      }
      return { status: 'ok', imported, existing, monitored };
    }

    // --- PJN ZIP de expediente ---
    case 'PJN_GENERATE_ZIP': {
      const scwTabId = await findScwActuacionesTab();
      if (!scwTabId) {
        return {
          success: false,
          error:
            'No hay pestaña scw en expediente.seam ni actuacionesHistoricas.seam.',
        };
      }
      try {
        const result = await generatePjnCaseZip({
          datosGenerales: message.datosGenerales,
          actuaciones: message.actuaciones,
          portalUrl: message.portalUrl,
          scwTabId,
        });
        if (!result.success || !result.blob) {
          return { success: false, error: result.error ?? 'Error desconocido' };
        }
        const buf = await result.blob.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const dataUri = `data:application/zip;base64,${btoa(binary)}`;
        await chrome.downloads.download({
          url: dataUri,
          filename: result.filename!,
          saveAs: true,
        });
        return {
          success: true,
          filename: result.filename,
          stats: result.stats,
        };
      } catch (err) {
        console.error('[ProcuAsist PJN] ZIP error:', err);
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    // --- PJN document download ---
    case 'PJN_DOWNLOAD_PDF': {
      const tabId = await findScwTab();
      if (!tabId) {
        return {
          success: false,
          error:
            'No hay una pestaña de scw.pjn.gov.ar abierta. Abrí el expediente primero.',
        };
      }
      const result = await downloadPjnPdf(
        tabId,
        message.href,
        message.suggestedName
      );
      if (!result.success) return result;

      if (message.saveToDisk) {
        const dataUri = `data:${result.mimeType};base64,${result.base64}`;
        await chrome.downloads.download({
          url: dataUri,
          filename: result.filename,
          saveAs: false,
        });
      }
      return result;
    }

    // --- PJN API (debug) ---
    case 'PJN_GET_EVENTS_DEBUG': {
      const hasToken = !!getToken();
      const tokenAgeMs = getTokenAgeMs();
      console.groupCollapsed(
        `%c[ProcuAsist PJN] getEvents(page=${message.page ?? 0}) — token=${hasToken ? 'sí' : 'no'}${tokenAgeMs !== null ? ` age=${Math.round(tokenAgeMs / 1000)}s` : ''}`,
        'color: #2a5d9f; font-weight: bold;'
      );
      const result = await getEvents({
        page: message.page,
        pageSize: message.pageSize,
        fechaHasta: message.fechaHasta,
      });
      if (result.ok) {
        console.log(
          `hasNext=${result.data.hasNext} items=${result.data.items.length} numberOfItems=${result.data.numberOfItems}`
        );
        console.table(
          result.data.items.map((e) => ({
            fecha: new Date(e.fechaFirma).toISOString(),
            tipo: e.tipo,
            expediente: e.payload?.claveExpediente,
            caratula: e.payload?.caratulaExpediente?.slice(0, 60),
            hasDocument: e.hasDocument,
          }))
        );
      } else {
        console.warn('error:', result.error);
      }
      console.groupEnd();
      return result;
    }

    default:
      console.warn(
        '[ProcuAsist] Unknown message type:',
        (message as unknown as Record<string, unknown>).type
      );
      return { status: 'unknown_message' };
  }
}

interface EnrichCandidate {
  caseNumber: string;
  title: string;
  court: string;
  portalUrl: string;
  nidCausa: string;
  pidJuzgado: string;
}

const SCBA_MEV_LOOKUP_BATCH_SIZE = 12;

async function enrichScbaMisCausas() {
  const bookmarks = await getBookmarks();
  const monitors = await getMonitors();
  const candidates: EnrichCandidate[] = [
    ...bookmarks
      .filter((b) => b.metadata?.nidCausa && b.metadata?.pidJuzgado)
      .map((b) => ({
        caseNumber: b.caseNumber,
        title: b.title,
        court: b.court,
        portalUrl: b.portalUrl,
        nidCausa: b.metadata!.nidCausa!,
        pidJuzgado: b.metadata!.pidJuzgado!,
      })),
    ...monitors
      .filter((m) => m.nidCausa && m.pidJuzgado)
      .map((m) => ({
        caseNumber: m.caseNumber,
        title: m.title,
        court: m.court,
        portalUrl: m.portalUrl,
        nidCausa: m.nidCausa!,
        pidJuzgado: m.pidJuzgado!,
      })),
  ];

  const pending = bookmarks.filter(
    (b) =>
      b.portal === 'mev' &&
      b.metadata?.set === 'scba-mis-causas' &&
      (!b.metadata.nidCausa || !b.metadata.pidJuzgado)
  );

  let enriched = 0;
  let monitored = 0;
  let unmatched = 0;
  let searched = 0;
  let searchMatches = 0;
  let searchErrors = 0;
  let needsMevTab = false;
  let searchLimitReached = false;
  const stillPendingForSearch = [];

  for (const bookmark of pending) {
    const match = findBestMevMatch(bookmark, candidates);
    if (!match || match.score < 82) {
      stillPendingForSearch.push(bookmark);
      unmatched++;
      continue;
    }

    await updateBookmark(bookmark.portal, bookmark.caseNumber, {
      portalUrl: match.candidate.portalUrl || bookmark.portalUrl,
      metadata: {
        ...bookmark.metadata,
        nidCausa: match.candidate.nidCausa,
        pidJuzgado: match.candidate.pidJuzgado,
        mevEnrichedAt: new Date().toISOString(),
        mevMatchScore: String(match.score),
      },
    });
    enriched++;

    const wasMonitored = await isMonitored(bookmark.portal, bookmark.caseNumber);
    await addMonitor({
      portal: bookmark.portal,
      caseNumber: bookmark.caseNumber,
      title: bookmark.title,
      court: bookmark.court,
      portalUrl: match.candidate.portalUrl || bookmark.portalUrl,
      metadata: {
        nidCausa: match.candidate.nidCausa,
        pidJuzgado: match.candidate.pidJuzgado,
      },
    });
    if (!wasMonitored) monitored++;
  }

  if (stillPendingForSearch.length > 0) {
    const mevTabId = await findMevTab();
    if (!mevTabId) {
      needsMevTab = true;
    } else {
      const batch = stillPendingForSearch.slice(0, SCBA_MEV_LOOKUP_BATCH_SIZE);
      searchLimitReached = stillPendingForSearch.length > batch.length;

      for (const bookmark of batch) {
        searched++;
        try {
          const match = await searchBestMevMatchForBookmark(mevTabId, bookmark);
          if (!match || match.score < 88) {
            await updateBookmark(bookmark.portal, bookmark.caseNumber, {
              metadata: {
                ...bookmark.metadata,
                mevLookupAttemptedAt: new Date().toISOString(),
                mevLookupStatus: match
                  ? `low_score:${match.score}`
                  : 'not_found',
              },
            });
            continue;
          }

          await updateBookmark(bookmark.portal, bookmark.caseNumber, {
            portalUrl: match.candidate.portalUrl || bookmark.portalUrl,
            metadata: {
              ...bookmark.metadata,
              nidCausa: match.candidate.nidCausa,
              pidJuzgado: match.candidate.pidJuzgado,
              mevEnrichedAt: new Date().toISOString(),
              mevMatchScore: String(match.score),
              mevLookupAttemptedAt: new Date().toISOString(),
              mevLookupStatus: 'matched_by_mev_search',
            },
          });
          enriched++;
          searchMatches++;

          const wasMonitored = await isMonitored(bookmark.portal, bookmark.caseNumber);
          await addMonitor({
            portal: bookmark.portal,
            caseNumber: bookmark.caseNumber,
            title: bookmark.title,
            court: bookmark.court,
            portalUrl: match.candidate.portalUrl || bookmark.portalUrl,
            metadata: {
              nidCausa: match.candidate.nidCausa,
              pidJuzgado: match.candidate.pidJuzgado,
            },
          });
          if (!wasMonitored) monitored++;
        } catch (err) {
          searchErrors++;
          console.warn(
            `[ProcuAsist] MEV lookup failed for ${bookmark.caseNumber}:`,
            err
          );
        }

        await delay(800);
      }
    }
  }

  return {
    success: true,
    totalPending: pending.length,
    candidates: candidates.length,
    enriched,
    monitored,
    unmatched,
    searched,
    searchMatches,
    searchErrors,
    needsMevTab,
    searchLimitReached,
  };
}

async function searchBestMevMatchForBookmark(
  mevTabId: number,
  bookmark: { caseNumber: string; title: string; court: string }
): Promise<{ candidate: EnrichCandidate; score: number } | null> {
  const queries = buildMevSearchQueries(bookmark);
  let best: { candidate: EnrichCandidate; score: number } | null = null;

  for (const query of queries) {
    const results = await fetchMevSearchResults(mevTabId, query);
    const candidates = results.map((result) => ({
      caseNumber: result.numero,
      title: result.caratula,
      court: '',
      portalUrl: result.url,
      nidCausa: result.nidCausa,
      pidJuzgado: result.pidJuzgado,
    }));
    const match = findBestMevMatch(bookmark, candidates);
    if (match && (!best || match.score > best.score)) best = match;
    if (best && best.score >= 94) break;
  }

  return best;
}

function buildMevSearchQueries(bookmark: { title: string; caseNumber: string }): string[] {
  const normalizedTitle = normalizeWhitespace(bookmark.title);
  const actor = normalizeWhitespace(
    normalizedTitle
      .split(/\s+C\/|\s+S\/|\s+C\s+/i)[0]
      ?.replace(/\s+Y\s+OTROS?.*$/i, '') ?? ''
  );
  const compactNumber = bookmark.caseNumber.replace(/\D+/g, '');

  return Array.from(
    new Set(
      [actor, normalizedTitle.slice(0, 95), compactNumber]
        .map((query) => query.trim())
        .filter((query) => query.length >= 4)
    )
  ).slice(0, 3);
}

async function fetchMevSearchResults(
  mevTabId: number,
  query: string
): Promise<MevSearchResult[]> {
  const results = await chrome.scripting.executeScript({
    target: { tabId: mevTabId },
    world: 'MAIN',
    func: async (baseUrl: string, busquedaPath: string, queryText: string) => {
      try {
        const busquedaUrl = new URL(busquedaPath, baseUrl).href;
        const busquedaResp = await fetch(busquedaUrl, {
          credentials: 'include',
          headers: { Accept: 'text/html' },
        });
        if (!busquedaResp.ok) return { error: `HTTP ${busquedaResp.status}` };

        const busquedaBuffer = await busquedaResp.arrayBuffer();
        const busquedaHtml = new TextDecoder('windows-1252').decode(busquedaBuffer);
        if (
          busquedaHtml.toLowerCase().includes('ingrese los datos del usuario') ||
          (busquedaHtml.toLowerCase().includes('name="usuario"') &&
            busquedaHtml.toLowerCase().includes('name="clave"'))
        ) {
          return { error: 'session_expired' };
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(busquedaHtml, 'text/html');
        const caratulaInput = doc.querySelector("input[name='caratula']");
        const form = caratulaInput?.closest('form') ?? doc.querySelector('form');
        if (!form) return { error: 'search_form_not_found' };

        const formData = new FormData(form as HTMLFormElement);
        formData.set('radio', 'xCa');
        formData.set('caratula', queryText);
        if (formData.has('NCausa')) formData.set('NCausa', '');
        if (!formData.has('Buscar')) formData.set('Buscar', 'Buscar');

        const params = new URLSearchParams();
        for (const [key, value] of formData.entries()) {
          if (typeof value === 'string') params.set(key, value);
        }

        const formEl = form as HTMLFormElement;
        const action = new URL(
          formEl.getAttribute('action') || 'resultados.asp',
          busquedaUrl
        );
        const method = (formEl.method || 'GET').toUpperCase();
        let resultResp: Response;
        if (method === 'POST') {
          resultResp = await fetch(action.href, {
            method: 'POST',
            credentials: 'include',
            headers: {
              Accept: 'text/html',
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params,
          });
        } else {
          params.forEach((value, key) => action.searchParams.set(key, value));
          resultResp = await fetch(action.href, {
            credentials: 'include',
            headers: { Accept: 'text/html' },
          });
        }

        if (!resultResp.ok) return { error: `HTTP ${resultResp.status}` };
        const resultBuffer = await resultResp.arrayBuffer();
        const html = new TextDecoder('windows-1252').decode(resultBuffer);
        const resultDoc = parser.parseFromString(html, 'text/html');
        const links = Array.from(
          resultDoc.querySelectorAll("a[href*='procesales.asp?nidCausa=']")
        ) as HTMLAnchorElement[];
        const seen = new Map<
          string,
          {
            nidCausa: string;
            pidJuzgado: string;
            caratula: string;
            numero: string;
            ultimoMovimiento: string;
            estado: string;
            url: string;
          }
        >();

        for (const link of links) {
          const href = new URL(link.getAttribute('href') || '', baseUrl).href;
          const url = new URL(href);
          const nidCausa = url.searchParams.get('nidCausa') || '';
          const pidJuzgado = url.searchParams.get('pidJuzgado') || '';
          if (!nidCausa) continue;

          const text = link.textContent?.trim() ?? '';
          if (!seen.has(nidCausa)) {
            const row = link.closest('tr');
            const rowText = row?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
            const formattedNumber = rowText.match(/([A-Z]{1,3})\s*-\s*(\d+)\s*-\s*(\d{4})/);
            const plainNumber = rowText.match(/(?:N[úu]mero|Expediente|Receptor[ií]a)?\s*:?\s*(\d{4,8})/i);
            seen.set(nidCausa, {
              nidCausa,
              pidJuzgado,
              caratula: text,
              numero: formattedNumber
                ? `${formattedNumber[1]}-${formattedNumber[2]}-${formattedNumber[3]}`
                : plainNumber?.[1] ?? '',
              ultimoMovimiento: '',
              estado: '',
              url: href,
            });
          } else {
            seen.get(nidCausa)!.ultimoMovimiento = text;
          }
        }

        return { results: Array.from(seen.values()) };
      } catch (e) {
        return { error: String(e) };
      }
    },
    args: [MEV_BASE_URL, MEV_URLS.busqueda, query],
  });

  const response = results[0]?.result as
    | { results: MevSearchResult[] }
    | { error: string }
    | null;

  if (!response || 'error' in response) {
    throw new Error(response?.error ?? 'No MEV search response');
  }

  return response.results;
}

function findBestMevMatch(
  bookmark: { caseNumber: string; title: string; court: string },
  candidates: EnrichCandidate[]
): { candidate: EnrichCandidate; score: number } | null {
  let best: { candidate: EnrichCandidate; score: number } | null = null;

  for (const candidate of candidates) {
    const score = scoreMevMatch(bookmark, candidate);
    if (!best || score > best.score) best = { candidate, score };
  }

  return best;
}

function scoreMevMatch(
  source: { caseNumber: string; title: string; court: string },
  candidate: EnrichCandidate
): number {
  const sourceTitle = normalizeMatchText(source.title);
  const candidateTitle = normalizeMatchText(candidate.title);
  const sourceCourt = normalizeMatchText(source.court);
  const candidateCourt = normalizeMatchText(candidate.court);
  const sourceNumber = normalizeMatchText(source.caseNumber);
  const candidateNumber = normalizeMatchText(candidate.caseNumber);

  let score = Math.round(tokenSimilarity(sourceTitle, candidateTitle) * 100);

  if (
    sourceTitle.length > 24 &&
    candidateTitle.length > 24 &&
    (sourceTitle.includes(candidateTitle) || candidateTitle.includes(sourceTitle))
  ) {
    score = Math.max(score, 88);
  }

  if (sourceNumber && candidateNumber.includes(sourceNumber)) score += 8;
  if (sourceCourt && candidateCourt && tokenSimilarity(sourceCourt, candidateCourt) >= 0.55) {
    score += 10;
  }

  return Math.min(score, 100);
}

function tokenSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const aTokens = significantTokens(a);
  const bTokens = significantTokens(b);
  if (aTokens.length === 0 || bTokens.length === 0) return 0;

  const bSet = new Set(bTokens);
  const shared = aTokens.filter((token) => bSet.has(token)).length;
  return shared / Math.max(aTokens.length, bTokens.length);
}

function significantTokens(value: string): string[] {
  return normalizeMatchText(value)
    .split(' ')
    .filter((token) => token.length > 2 && !MATCH_STOPWORDS.has(token));
}

function normalizeMatchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MATCH_STOPWORDS = new Set([
  'C',
  'S',
  'Y',
  'DE',
  'DEL',
  'LA',
  'LAS',
  'LOS',
  'EL',
  'EN',
  'POR',
  'CON',
  'OTRO',
  'OTROS',
  'SOBRE',
]);
