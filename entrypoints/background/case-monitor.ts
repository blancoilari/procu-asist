/**
 * Background case monitoring (Procuración Automática).
 * Periodically scans monitored cases for new movements
 * and sends notifications when changes are detected.
 *
 * Strategy:
 * 1. Get active monitors from storage
 * 2. For each MEV monitor: fetch procesales.asp using the session cookies
 *    of an open MEV tab (via chrome.scripting.executeScript in MAIN world)
 * 3. Parse movements inside the MEV tab context
 * 4. Compare movement count with stored lastKnownMovementCount
 * 5. If new movements found: create alert + Chrome notification
 * 6. Update monitor with new scan data
 *
 * Limitation: requires an open MEV tab with active session.
 * If no session is active, the scan is skipped with a warning notification.
 */

import type { Monitor } from '@/modules/portals/types';
import { MEV_BASE_URL, MEV_URLS } from '@/modules/portals/mev-selectors';
import {
  getActiveMonitors,
  updateMonitorScan,
  createAlert,
} from '@/modules/storage/monitor-store';
import { isDateOnOrAfter } from '@/modules/utils/date';

/** How many cases to scan per batch (to avoid overloading) */
const BATCH_SIZE = 5;
/** Delay between fetches within a batch (ms) */
const FETCH_DELAY = 2000;

/**
 * Main scan entry point. Called by alarm-manager every 6 hours
 * or manually via RUN_SCAN_NOW message.
 */
export async function scanMonitoredCases(options: ScanOptions = {}): Promise<ScanResult> {
  console.debug('[ProcuAsist] Starting monitored cases scan...');

  const monitors = await getActiveMonitors();
  if (monitors.length === 0) {
    console.debug('[ProcuAsist] No active monitors, skipping scan');
    const result = { scanned: 0, newMovements: 0, errors: 0, matchedMovements: 0 };
    await storeScanResult(result, options.fromDate, []);
    return result;
  }

  // Find an open MEV tab to use for fetching
  const mevTabId = await findMevTab();
  if (!mevTabId) {
    console.warn('[ProcuAsist] No MEV tab found, cannot scan');
    await notifyNoSession();
    const result = {
      scanned: 0,
      newMovements: 0,
      errors: 0,
      matchedMovements: 0,
      skippedReason: 'no_tab',
    };
    await storeScanResult(result, options.fromDate, []);
    return result;
  }

  let totalNew = 0;
  let totalErrors = 0;
  let totalParsedMovements = 0;
  let missingIds = 0;
  const matchedMovements: ScanMovement[] = [];

  // Process in batches
  for (let i = 0; i < monitors.length; i += BATCH_SIZE) {
    const batch = monitors.slice(i, i + BATCH_SIZE);

    for (const monitor of batch) {
      try {
        const scan = await scanSingleCase(monitor, mevTabId, options.fromDate);
        totalNew += scan.newMovements;
        totalParsedMovements += scan.totalMovements;
        if (scan.skippedReason === 'missing_ids') missingIds++;
        matchedMovements.push(...scan.matchedMovements);
      } catch (err) {
        totalErrors++;
        console.error(
          `[ProcuAsist] Error scanning ${monitor.caseNumber}:`,
          err
        );
      }

      // Delay between fetches to be gentle on the portal
      if (i + batch.indexOf(monitor) < monitors.length - 1) {
        await delay(FETCH_DELAY);
      }
    }
  }

  const result: ScanResult = {
    scanned: monitors.length,
    newMovements: totalNew,
    errors: totalErrors,
    matchedMovements: matchedMovements.length,
    parsedMovements: totalParsedMovements,
    missingIds,
  };

  console.debug(
    `[ProcuAsist] Scan complete: ${result.scanned} cases, ${result.newMovements} new movements, ${result.errors} errors`
  );

  await storeScanResult(result, options.fromDate, matchedMovements);

  return result;
}

export interface ScanOptions {
  /** When present, creates alerts for all matching movements on/after this date. */
  fromDate?: string;
}

export interface ScanResult {
  scanned: number;
  newMovements: number;
  errors: number;
  matchedMovements?: number;
  parsedMovements?: number;
  missingIds?: number;
  skippedReason?: string;
}

export interface ScanMovement {
  monitorId: string;
  caseNumber: string;
  title: string;
  court: string;
  portalUrl: string;
  movementDate: string;
  movementType?: string;
  movementDescription: string;
}

// ────────────────────────────────────────────────────────
// Single Case Scan
// ────────────────────────────────────────────────────────

async function scanSingleCase(
  monitor: Monitor,
  tabId: number,
  fromDate?: string
): Promise<SingleScanResult> {
  if (monitor.portal !== 'mev') {
    // EJE scan not yet implemented
    return { newMovements: 0, matchedMovements: [], totalMovements: 0 };
  }

  const caseIds = getMevCaseIds(monitor);

  if (!caseIds) {
    console.warn(
      `[ProcuAsist] Monitor ${monitor.caseNumber} missing nidCausa/pidJuzgado, skipping`
    );
    return {
      newMovements: 0,
      matchedMovements: [],
      totalMovements: 0,
      skippedReason: 'missing_ids',
    };
  }

  // Build the procesales.asp URL
  const caseUrl =
    `${MEV_BASE_URL}${MEV_URLS.procesales}` +
    `?nidCausa=${encodeURIComponent(caseIds.nidCausa)}` +
    `&pidJuzgado=${encodeURIComponent(caseIds.pidJuzgado)}`;

  // Fetch and parse HTML from the MEV tab context (using session cookies).
  // Parsing in the tab avoids relying on an offscreen listener that MV3 may suspend.
  const scanResults = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: async (url: string) => {
      try {
        const resp = await fetch(url, {
          credentials: 'include',
          headers: {
            Accept: 'text/html',
          },
        });
        if (!resp.ok) return { error: `HTTP ${resp.status}` };
        const text = await resp.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        const movements: Array<{ date: string; type: string; description: string }> = [];
        const tables = doc.querySelectorAll('table');
        let movTable: HTMLTableElement | null = null;

        for (const table of tables) {
          const headerText = Array.from(table.querySelectorAll('tr'))
            .map((row) => row.textContent ?? '')
            .join(' ');
          if (headerText.includes('Fecha') && headerText.includes('Descripci')) {
            movTable = table;
            break;
          }
        }

        if (movTable) {
          const rows = movTable.querySelectorAll('tr');
          const datePattern = /^\d{2}\/\d{2}\/\d{4}$/;

          for (let i = 1; i < rows.length; i++) {
            const cells = rows[i].querySelectorAll('td');
            if (cells.length < 4) continue;

            const date = (cells[0].textContent?.trim() ?? '').substring(0, 10);
            if (!datePattern.test(date)) continue;

            movements.push({
              date,
              type: cells[2]?.querySelector("img[src*='firma']") ? 'firmado' : '',
              description: cells[3].textContent?.trim() ?? '',
            });
          }
        }

        return { html: text, movements };
      } catch (e) {
        return { error: String(e) };
      }
    },
    args: [caseUrl],
  });

  const result = scanResults[0]?.result as
    | {
        html: string;
        movements: Array<{ date: string; type: string; description: string }>;
        error?: never;
      }
    | { error: string; html?: never; movements?: never }
    | null;

  if (!result || result.error || !result.html || !result.movements) {
    throw new Error(result?.error ?? 'No result from executeScript');
  }

  const html: string = result.html;

  // Check if the response is a login page (session expired)
  if (
    html.toLowerCase().includes('ingrese los datos del usuario') ||
    (html.toLowerCase().includes('name="usuario"') &&
      html.toLowerCase().includes('name="clave"'))
  ) {
    console.warn('[ProcuAsist] Session expired during scan');
    await notifyNoSession();
    throw new Error('session_expired');
  }

  const movements = result.movements;
  const currentCount = movements.length;
  const previousCount = monitor.lastKnownMovementCount;
  const newMovementCount = Math.max(0, currentCount - previousCount);
  let matchedMovements: ScanMovement[] = [];

  if (fromDate) {
    const matching = movements.filter((mov) => isDateOnOrAfter(mov.date, fromDate));
    matchedMovements = matching.map((mov) => ({
      monitorId: monitor.id,
      caseNumber: monitor.caseNumber,
      title: monitor.title,
      court: monitor.court,
      portalUrl: monitor.portalUrl,
      movementDate: mov.date,
      movementType: mov.type || undefined,
      movementDescription: mov.description,
    }));

    for (const mov of matching) {
      await createAlert(
        monitor.id,
        mov.date,
        mov.description,
        mov.type || undefined,
        { isRead: true }
      );
    }
  }

  // Detect new movements
  if (!fromDate && newMovementCount > 0 && previousCount > 0) {
    // Get the new movements (they appear at the top/beginning of the list in MEV)
    const newMovements = movements.slice(0, newMovementCount);

    for (const mov of newMovements) {
      await createAlert(
        monitor.id,
        mov.date,
        mov.description,
        mov.type || undefined
      );
    }

    // Send Chrome notification
    await sendMovementNotification(monitor, newMovementCount, newMovements[0]);
  }

  // Update monitor scan data
  const latestDate = movements[0]?.date ?? monitor.lastKnownMovementDate ?? '';
  await updateMonitorScan(monitor.id, latestDate, currentCount);

  return {
    newMovements: fromDate ? matchedMovements.length : newMovementCount,
    matchedMovements,
    totalMovements: currentCount,
  };
}

interface SingleScanResult {
  newMovements: number;
  matchedMovements: ScanMovement[];
  totalMovements: number;
  skippedReason?: 'missing_ids';
}

// ────────────────────────────────────────────────────────
// Chrome Notifications
// ────────────────────────────────────────────────────────

async function sendMovementNotification(
  monitor: Monitor,
  count: number,
  latestMovement: { date: string; description: string }
) {
  const title =
    count === 1
      ? `Nuevo movimiento en ${monitor.caseNumber}`
      : `${count} nuevos movimientos en ${monitor.caseNumber}`;

  const message =
    count === 1
      ? `${latestMovement.date} — ${latestMovement.description}`
      : `Último: ${latestMovement.date} — ${latestMovement.description}`;

  await chrome.notifications.create(`monitor-${monitor.id}-${Date.now()}`, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icon/128.png'),
    title,
    message,
    priority: 2,
  });
}

async function notifyNoSession() {
  // Only notify once per hour
  const stored = await chrome.storage.session.get('lastNoSessionNotify');
  const last = stored.lastNoSessionNotify as number | undefined;
  if (last && Date.now() - last < 3600_000) return;

  await chrome.storage.session.set({ lastNoSessionNotify: Date.now() });

  await chrome.notifications.create('monitor-no-session', {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icon/128.png'),
    title: 'ProcuAsist — Sesión requerida',
    message:
      'Abrí MEV en una pestaña e iniciá sesión para que el monitoreo de causas funcione.',
    priority: 1,
  });
}

// ────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────

async function findMevTab(): Promise<number | null> {
  const tabs = await chrome.tabs.query({ url: 'https://mev.scba.gov.ar/*' });
  return tabs[0]?.id ?? null;
}

async function ensureOffscreen(): Promise<void> {
  // Check if offscreen document already exists
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT' as chrome.runtime.ContextType],
  });

  if (contexts.length > 0) return;

  try {
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL('offscreen.html'),
      reasons: ['DOM_PARSING' as chrome.offscreen.Reason],
      justification: 'Parse MEV HTML for movement extraction',
    });
  } catch {
    // May already exist (race condition), ignore
  }
}

async function storeScanResult(
  result: ScanResult,
  fromDate: string | undefined,
  movements: ScanMovement[]
): Promise<void> {
  const timestamp = new Date().toISOString();
  const sessionData: Record<string, unknown> = {
    lastScanResult: { ...result, timestamp },
  };

  if (fromDate) {
    sessionData.lastSinceScanReport = {
      ...result,
      fromDate,
      timestamp,
      movements,
    };
  }

  await chrome.storage.session.set(sessionData);
}

function getMevCaseIds(
  monitor: Monitor
): { nidCausa: string; pidJuzgado: string } | null {
  const nidCausa = monitor.nidCausa || getQueryParam(monitor.portalUrl, 'nidCausa');
  const pidJuzgado = monitor.pidJuzgado || getQueryParam(monitor.portalUrl, 'pidJuzgado');

  if (!nidCausa || !pidJuzgado) return null;
  return { nidCausa, pidJuzgado };
}

function getQueryParam(url: string, param: string): string {
  if (!url) return '';
  try {
    return new URL(url).searchParams.get(param) ?? '';
  } catch {
    return '';
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
