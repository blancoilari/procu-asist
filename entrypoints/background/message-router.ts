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
  searchBookmarks,
  isBookmarked,
} from '@/modules/storage/bookmark-store';
import {
  addMonitor,
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
import { handleSessionExpired } from './auto-reconnect';
import { scanMonitoredCases } from './case-monitor';
import { getEvents } from '@/modules/portals/pjn-api-client';
import { getToken, getTokenAgeMs } from '@/modules/portals/pjn-token-store';

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

    // --- Scan ---
    case 'RUN_SCAN_NOW': {
      // Run scan in background, don't block the message response
      scanMonitoredCases().catch((err) =>
        console.error('[ProcuAsist] Manual scan error:', err)
      );
      return { success: true, status: 'scan_started' };
    }

    // --- Bulk Import ---
    case 'BULK_IMPORT': {
      console.debug(
        `[ProcuAsist] Bulk import: ${message.cases.length} cases from ${message.source}`
      );
      let imported = 0;
      for (const c of message.cases) {
        try {
          const caseObj = c as { caseNumber: string; title: string; court?: string };
          await addBookmark({
            id: caseObj.caseNumber,
            portal: 'mev' as const, // SCBA-Notif cases are from provincia (MEV)
            caseNumber: caseObj.caseNumber,
            title: caseObj.title || 'Sin carátula',
            court: caseObj.court ?? '',
            fuero: '',
            portalUrl: '',
          });
          imported++;
        } catch {
          // Skip duplicates or errors, continue importing
        }
      }
      return { status: 'ok', imported };
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
