/**
 * Background case monitoring (Procuración Automática).
 * Periodically scans monitored cases for new movements
 * and sends notifications when changes are detected.
 *
 * Strategy:
 * 1. Get active monitors from storage
 * 2. For each MEV monitor: fetch procesales.asp using the session cookies
 *    of an open MEV tab (via chrome.scripting.executeScript in MAIN world)
 * 3. Send the HTML to the offscreen document for DOM parsing
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

/** How many cases to scan per batch (to avoid overloading) */
const BATCH_SIZE = 5;
/** Delay between fetches within a batch (ms) */
const FETCH_DELAY = 2000;

/**
 * Main scan entry point. Called by alarm-manager every 6 hours
 * or manually via RUN_SCAN_NOW message.
 */
export async function scanMonitoredCases(): Promise<ScanResult> {
  console.debug('[ProcuAsist] Starting monitored cases scan...');

  const monitors = await getActiveMonitors();
  if (monitors.length === 0) {
    console.debug('[ProcuAsist] No active monitors, skipping scan');
    return { scanned: 0, newMovements: 0, errors: 0 };
  }

  // Find an open MEV tab to use for fetching
  const mevTabId = await findMevTab();
  if (!mevTabId) {
    console.warn('[ProcuAsist] No MEV tab found, cannot scan');
    await notifyNoSession();
    return { scanned: 0, newMovements: 0, errors: 0, skippedReason: 'no_tab' };
  }

  // Ensure offscreen document is alive for parsing
  await ensureOffscreen();

  let totalNew = 0;
  let totalErrors = 0;

  // Process in batches
  for (let i = 0; i < monitors.length; i += BATCH_SIZE) {
    const batch = monitors.slice(i, i + BATCH_SIZE);

    for (const monitor of batch) {
      try {
        const newCount = await scanSingleCase(monitor, mevTabId);
        totalNew += newCount;
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
  };

  console.debug(
    `[ProcuAsist] Scan complete: ${result.scanned} cases, ${result.newMovements} new movements, ${result.errors} errors`
  );

  // Store last scan summary in session for the UI
  await chrome.storage.session.set({
    lastScanResult: { ...result, timestamp: new Date().toISOString() },
  });

  return result;
}

export interface ScanResult {
  scanned: number;
  newMovements: number;
  errors: number;
  skippedReason?: string;
}

// ────────────────────────────────────────────────────────
// Single Case Scan
// ────────────────────────────────────────────────────────

async function scanSingleCase(
  monitor: Monitor,
  tabId: number
): Promise<number> {
  if (monitor.portal !== 'mev') {
    // PJN scan not yet implemented
    return 0;
  }

  if (!monitor.nidCausa || !monitor.pidJuzgado) {
    console.warn(
      `[ProcuAsist] Monitor ${monitor.caseNumber} missing nidCausa/pidJuzgado, skipping`
    );
    return 0;
  }

  // Build the procesales.asp URL
  const caseUrl = `${MEV_BASE_URL}${MEV_URLS.procesales}?nidCausa=${monitor.nidCausa}&pidJuzgado=${monitor.pidJuzgado}`;

  // Fetch HTML from the MEV tab context (using session cookies)
  const htmlResults = await chrome.scripting.executeScript({
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
        return { html: text };
      } catch (e) {
        return { error: String(e) };
      }
    },
    args: [caseUrl],
  });

  const result = htmlResults[0]?.result as
    | { html: string; error?: never }
    | { error: string; html?: never }
    | null;

  if (!result || result.error || !result.html) {
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

  // Send HTML to offscreen document for DOM parsing
  const parseResult = (await chrome.runtime.sendMessage({
    type: 'PARSE_CASE_HTML',
    html,
    portal: 'mev',
  })) as {
    status: string;
    data?: { movements: Array<{ date: string; type: string; description: string }> };
    error?: string;
  };

  if (parseResult.status !== 'ok' || !parseResult.data) {
    throw new Error(parseResult.error ?? 'Parse failed');
  }

  const movements = parseResult.data.movements;
  const currentCount = movements.length;
  const previousCount = monitor.lastKnownMovementCount;
  const newMovementCount = Math.max(0, currentCount - previousCount);

  // Detect new movements
  if (newMovementCount > 0 && previousCount > 0) {
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

  return newMovementCount;
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
