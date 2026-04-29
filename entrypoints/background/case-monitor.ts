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
import { getEvents, type PjnEvent } from '@/modules/portals/pjn-api-client';
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
const PJN_EVENT_PAGES_TO_SCAN = 5;
const PJN_EVENT_PAGE_SIZE = 100;

let pjnEventsCache:
  | { timestamp: number; result: PjnEventFeedResult }
  | null = null;
let pjnVisibleListCache:
  | { timestamp: number; result: PjnVisibleListResult }
  | null = null;

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

  const needsMev = monitors.some((monitor) => monitor.portal === 'mev');
  const mevTabId = needsMev ? await findMevTab() : null;
  const pjnTabId = null;

  if (needsMev && !mevTabId) {
    console.warn('[ProcuAsist] Missing portal tab for scan', {
      needsMev,
      hasMevTab: Boolean(mevTabId),
    });
    await notifyNoSession('mev');
  }

  let totalNew = 0;
  let totalErrors = 0;
  let totalParsedMovements = 0;
  let missingIds = 0;
  let missingTabs = 0;
  const matchedMovements: ScanMovement[] = [];

  // Process in batches
  for (let i = 0; i < monitors.length; i += BATCH_SIZE) {
    const batch = monitors.slice(i, i + BATCH_SIZE);

    for (const monitor of batch) {
      try {
        const tabId = getScanTabId(monitor, { mevTabId, pjnTabId });
        if (!tabId && monitor.portal !== 'pjn') {
          missingTabs++;
          continue;
        }

        const scan = await scanSingleCase(monitor, tabId, options.fromDate);
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
    missingTabs,
    skippedReason:
      missingTabs === monitors.length ? 'no_tab' : undefined,
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
  missingTabs?: number;
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
  tabId: number | null,
  fromDate?: string
): Promise<SingleScanResult> {
  if (monitor.portal === 'pjn') {
    return scanSinglePjnCaseViaApi(monitor, fromDate);
  }

  if (monitor.portal !== 'mev') {
    return { newMovements: 0, matchedMovements: [], totalMovements: 0 };
  }

  if (!tabId) {
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

  return persistScanMovements(monitor, result.movements, fromDate);
}

async function persistScanMovements(
  monitor: Monitor,
  movements: Array<{ date: string; type: string; description: string }>,
  fromDate?: string
): Promise<SingleScanResult> {
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

async function scanSinglePjnCase(
  monitor: Monitor,
  tabId: number,
  fromDate?: string
): Promise<SingleScanResult> {
  const caseUrl = getPjnCaseUrl(monitor);
  if (!caseUrl) {
    console.warn(
      `[ProcuAsist] PJN monitor ${monitor.caseNumber} missing expediente URL, skipping`
    );
    return {
      newMovements: 0,
      matchedMovements: [],
      totalMovements: 0,
      skippedReason: 'missing_ids',
    };
  }

  const opened = await navigateScwTab(tabId, caseUrl);
  if (!opened) {
    throw new Error('Legacy PJN scanner disabled');
  }

  const scanResults = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: async (url: string) => {
      try {
        const resp = await fetch(url, {
          credentials: 'include',
          headers: { Accept: 'text/html' },
        });
        if (!resp.ok) return { error: `HTTP ${resp.status}` };

        const text = await resp.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        const lower = text.toLowerCase();
        const movements: Array<{ date: string; type: string; description: string }> = [];
        const tables = doc.querySelectorAll('table');
        let movTable: HTMLTableElement | null = null;

        for (const table of tables) {
          const headerText = Array.from(table.querySelectorAll('tr'))
            .map((row) => row.textContent ?? '')
            .join(' ')
            .replace(/\s+/g, ' ');
          if (
            /oficina/i.test(headerText) &&
            /fecha/i.test(headerText) &&
            /descripci[oó]n\s*\/\s*detalle|descripcion\s*\/\s*detalle/i.test(headerText)
          ) {
            movTable = table;
            break;
          }
        }

        if (movTable) {
          const rows = movTable.querySelectorAll('tbody tr, tr');
          const datePattern = /^\d{1,2}\/\d{1,2}\/\d{4}$/;

          for (const row of Array.from(rows)) {
            const cells = row.querySelectorAll('td');
            if (cells.length < 4) continue;

            const values = Array.from(cells).map((cell) =>
              (cell.textContent ?? '').replace(/\s+/g, ' ').trim()
            );
            const date = values.find((value) => datePattern.test(value.substring(0, 10)))?.substring(0, 10) ?? '';
            if (!date) continue;

            const type = values[2] ?? '';
            const description = values[3] ?? values.slice(2).join(' ');
            movements.push({ date, type, description });
          }
        }

        return { html: text, loginLike: lower.includes('login') && lower.includes('password'), movements };
      } catch (e) {
        return { error: String(e) };
      }
    },
    args: [caseUrl],
  });

  const result = scanResults[0]?.result as
    | {
        html: string;
        loginLike: boolean;
        movements: Array<{ date: string; type: string; description: string }>;
        error?: never;
      }
    | { error: string; html?: never; movements?: never; loginLike?: never }
    | null;

  if (!result || result.error || !result.html || !result.movements) {
    throw new Error(result?.error ?? 'No result from PJN executeScript');
  }

  if (result.loginLike) {
    await notifyNoSession('pjn');
    throw new Error('session_expired');
  }

  return persistScanMovements(monitor, result.movements, fromDate);
}

async function scanSinglePjnCaseViaApi(
  monitor: Monitor,
  fromDate?: string
): Promise<SingleScanResult> {
  const feed = await getCachedPjnEvents();
  if (!feed.ok) {
    const visibleList = await getCachedPjnVisibleList();
    if (visibleList.ok) {
      const movements = visibleList.rows
        .filter((row) => visiblePjnRowMatchesMonitor(row, monitor))
        .map(visiblePjnRowToMovement)
        .filter((movement) => movement.date)
        .sort((a, b) => parseDateTimeValue(b.date) - parseDateTimeValue(a.date));

      return persistScanMovements(monitor, movements, fromDate);
    }

    return {
      newMovements: 0,
      matchedMovements: [],
      totalMovements: 0,
      skippedReason: feed.errorKind === 'no-session' ? 'missing_ids' : undefined,
    };
  }

  const movements = feed.events
    .filter((event) => eventMatchesPjnMonitor(event, monitor))
    .map(pjnEventToMovement)
    .sort((a, b) => parseDateTimeValue(b.date) - parseDateTimeValue(a.date));

  return persistScanMovements(monitor, movements, fromDate);
}

async function scanSinglePjnCaseViaTab(
  monitor: Monitor,
  tabId: number,
  fromDate?: string
): Promise<SingleScanResult> {
  const caseUrl = getPjnCaseUrl(monitor);
  if (!caseUrl) {
    console.warn(
      `[ProcuAsist] PJN monitor ${monitor.caseNumber} missing expediente URL, skipping`
    );
    return {
      newMovements: 0,
      matchedMovements: [],
      totalMovements: 0,
      skippedReason: 'missing_ids',
    };
  }

  const opened = await navigateScwTab(tabId, caseUrl);
  if (!opened) {
    throw new Error('Legacy PJN scanner disabled');
  }

  const scanResults = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: async () => {
      try {
        const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
        const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();

        const findMovementTable = () => {
          const tables = document.querySelectorAll('table');
          for (const table of tables) {
            const headerText = normalize(
              Array.from(table.querySelectorAll('tr'))
                .slice(0, 3)
                .map((row) => row.textContent ?? '')
                .join(' ')
            );
            if (
              /oficina/i.test(headerText) &&
              /fecha/i.test(headerText) &&
              /descripci[oó]n\s*\/\s*detalle|descripcion\s*\/\s*detalle/i.test(headerText)
            ) {
              return table;
            }
          }
          return null;
        };

        const parseMovements = () => {
          const movements: Array<{ date: string; type: string; description: string }> = [];
          const movTable = findMovementTable();
          if (!movTable) return movements;

          const rows = movTable.querySelectorAll('tbody tr, tr');
          const datePattern = /^\d{1,2}\/\d{1,2}\/\d{4}/;

          for (const row of Array.from(rows)) {
            const cells = row.querySelectorAll('td');
            if (cells.length < 4) continue;

            const values = Array.from(cells).map((cell) =>
              normalize(cell.textContent ?? '')
            );
            const dateIndex = values.findIndex((value) => datePattern.test(value));
            const date = dateIndex >= 0 ? values[dateIndex].substring(0, 10) : '';
            if (!date) continue;

            const type = values[dateIndex + 1] ?? '';
            const description = values[dateIndex + 2] ?? values.slice(dateIndex + 1).join(' ');
            movements.push({ date, type, description });
          }

          return movements;
        };

        let movements = parseMovements();
        for (let i = 0; movements.length === 0 && i < 20; i++) {
          await sleep(250);
          movements = parseMovements();
        }

        const html = document.documentElement?.innerText ?? document.body?.innerText ?? '';
        const lower = html.toLowerCase();
        const loginLike =
          /login|iniciar sesi[oó]n|usuario|contrase(?:n|ñ)a|password/.test(lower) &&
          !/datos generales|actuaciones|expediente/.test(lower);

        return { html, loginLike, movements };
      } catch (e) {
        return { error: String(e) };
      }
    },
  });

  const result = scanResults[0]?.result as
    | {
        html: string;
        loginLike: boolean;
        movements: Array<{ date: string; type: string; description: string }>;
        error?: never;
      }
    | { error: string; html?: never; movements?: never; loginLike?: never }
    | null;

  if (!result || result.error || !result.html || !result.movements) {
    throw new Error(result?.error ?? 'No result from PJN tab scan');
  }

  if (result.loginLike) {
    await notifyNoSession('pjn');
    throw new Error('session_expired');
  }

  return persistScanMovements(monitor, result.movements, fromDate);
}

interface SingleScanResult {
  newMovements: number;
  matchedMovements: ScanMovement[];
  totalMovements: number;
  skippedReason?: 'missing_ids';
}

type PjnEventFeedResult =
  | { ok: true; events: PjnEvent[] }
  | { ok: false; errorKind: string; message: string };

type PjnVisibleRow = {
  caseNumber: string;
  title: string;
  court: string;
  status: string;
  lastMovementDate: string;
};

type PjnVisibleListResult =
  | { ok: true; rows: PjnVisibleRow[]; pagesVisited?: number }
  | { ok: false; message: string };

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

async function notifyNoSession(portal: 'mev' | 'pjn' = 'mev') {
  // Only notify once per hour
  const key = `lastNoSessionNotify_${portal}`;
  const stored = await chrome.storage.session.get(key);
  const last = stored[key] as number | undefined;
  if (last && Date.now() - last < 3600_000) return;

  await chrome.storage.session.set({ [key]: Date.now() });

  const portalName = portal === 'pjn' ? 'PJN/SCW' : 'MEV';
  console.debug('[ProcuAsist] Missing portal session:', portalName);

  await chrome.notifications.create(`monitor-no-session-${portal}`, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icon/128.png'),
    title: 'ProcuAsist — Sesión requerida',
    message: portal === 'pjn'
      ? 'Abri PJN/SCW en una pestana e inicia sesion para que el monitoreo funcione.'
      :
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

async function findScwListTab(): Promise<number | null> {
  const tabs = await chrome.tabs.query({
    url: [
      'https://scw.pjn.gov.ar/scw/consultaListaRelacionados.seam*',
      'https://scw.pjn.gov.ar/scw/consultaListaFavoritos.seam*',
      'https://scw.pjn.gov.ar/scw/consultaListaNoIniciados.seam*',
    ],
  });
  return tabs[0]?.id ?? null;
}

function getScanTabId(
  monitor: Monitor,
  tabs: { mevTabId: number | null; pjnTabId: number | null }
): number | null {
  if (monitor.portal === 'mev') return tabs.mevTabId;
  if (monitor.portal === 'pjn') return tabs.pjnTabId;
  return null;
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

function getPjnCaseUrl(_monitor: Monitor): string | null {
  return null;
}

async function navigateScwTab(_tabId: number, _targetUrl: string): Promise<boolean> {
  return false;
}

async function getCachedPjnEvents(): Promise<PjnEventFeedResult> {
  if (pjnEventsCache && Date.now() - pjnEventsCache.timestamp < 60_000) {
    return pjnEventsCache.result;
  }

  const events: PjnEvent[] = [];

  for (let page = 0; page < PJN_EVENT_PAGES_TO_SCAN; page++) {
    const response = await getEvents({
      page,
      pageSize: PJN_EVENT_PAGE_SIZE,
      categoria: 'judicial',
    });

    if (!response.ok) {
      const result: PjnEventFeedResult = {
        ok: false,
        errorKind: response.error.kind,
        message: response.error.message,
      };
      pjnEventsCache = { timestamp: Date.now(), result };
      return result;
    }

    events.push(...response.data.items);
    if (!response.data.hasNext) break;
  }

  const result: PjnEventFeedResult = { ok: true, events };
  pjnEventsCache = { timestamp: Date.now(), result };
  return result;
}

async function getCachedPjnVisibleList(): Promise<PjnVisibleListResult> {
  if (pjnVisibleListCache && Date.now() - pjnVisibleListCache.timestamp < 30_000) {
    return pjnVisibleListCache.result;
  }

  const tabId = await findScwListTab();
  if (!tabId) {
    const result: PjnVisibleListResult = {
      ok: false,
      message: 'No hay una lista PJN/SCW abierta para usar como respaldo.',
    };
    pjnVisibleListCache = { timestamp: Date.now(), result };
    return result;
  }

  try {
    const response = (await chrome.tabs.sendMessage(tabId, {
      type: 'PJN_COLLECT_LIST_ROWS',
      maxPages: 12,
    })) as
      | {
          ok: true;
          rows: Array<{
            expediente: string;
            caratula: string;
            dependencia: string;
            situacion: string;
            ultimaActualizacion: string;
          }>;
          pagesVisited?: number;
        }
      | { ok: false; error?: string }
      | undefined;

    if (response?.ok) {
      const result: PjnVisibleListResult = {
        ok: true,
        pagesVisited: response.pagesVisited,
        rows: response.rows.map((row) => ({
          caseNumber: row.expediente,
          title: row.caratula,
          court: row.dependencia,
          status: row.situacion,
          lastMovementDate: row.ultimaActualizacion,
        })),
      };
      pjnVisibleListCache = { timestamp: Date.now(), result };
      return result;
    }
  } catch (err) {
    console.debug('[ProcuAsist] PJN list content collector unavailable:', err);
  }

  const injected = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: () => {
      const normalize = (value: string) =>
        value
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/\s+/g, ' ')
          .trim();
      const clean = (value: string | null | undefined) =>
        (value ?? '').replace(/\s+/g, ' ').trim();
      const dateOf = (value: string) => value.match(/\d{1,2}\/\d{1,2}\/\d{4}/)?.[0] ?? '';

      const tables = Array.from(document.querySelectorAll('table'));
      let table: HTMLTableElement | null = null;

      for (const candidate of tables) {
        const headers = Array.from(candidate.querySelectorAll('th, thead td')).map((cell) =>
          normalize(cell.textContent ?? '')
        );
        if (
          headers.some((header) => header.includes('expediente')) &&
          headers.some((header) => header.includes('caratula')) &&
          headers.some((header) => header.includes('ult'))
        ) {
          table = candidate;
          break;
        }
      }

      if (!table) return { rows: [] };

      const headers = Array.from(table.querySelectorAll('th, thead td')).map((cell) =>
        normalize(cell.textContent ?? '')
      );
      const indexOf = (needle: string) => headers.findIndex((header) => header.includes(needle));
      const expedienteIndex = indexOf('expediente');
      const dependenciaIndex = indexOf('dependencia');
      const caratulaIndex = indexOf('caratula');
      const situacionIndex = indexOf('situacion');
      const ultimaIndex = headers.findIndex((header) => header.includes('ult'));

      const rows = Array.from(table.querySelectorAll('tbody tr'))
        .map((tr) => {
          const cells = Array.from(tr.querySelectorAll('td')).map((cell) =>
            clean(cell.textContent)
          );
          if (!cells.length) return null;
          const caseNumber = clean(cells[expedienteIndex] ?? cells[0] ?? '');
          const title = clean(cells[caratulaIndex] ?? cells[2] ?? '');
          const court = clean(cells[dependenciaIndex] ?? cells[1] ?? '');
          const status = clean(cells[situacionIndex] ?? cells[3] ?? '');
          const lastMovementDate = dateOf(cells[ultimaIndex] ?? cells[cells.length - 1] ?? '');
          if (!caseNumber || !title) return null;
          return { caseNumber, title, court, status, lastMovementDate };
        })
        .filter(Boolean);

      return { rows };
    },
  });

  const rows = (injected[0]?.result as { rows?: PjnVisibleRow[] } | undefined)?.rows ?? [];
  const result: PjnVisibleListResult = { ok: true, rows };
  pjnVisibleListCache = { timestamp: Date.now(), result };
  return result;
}

function eventMatchesPjnMonitor(event: PjnEvent, monitor: Monitor): boolean {
  const monitorKey = normalizePjnCaseKey(monitor.caseNumber);
  const eventKey = normalizePjnCaseKey(event.payload?.claveExpediente ?? '');
  if (monitorKey && eventKey && monitorKey === eventKey) return true;

  const monitorTitle = normalizeLoose(monitor.title);
  const eventTitle = normalizeLoose(event.payload?.caratulaExpediente ?? '');
  return Boolean(
    monitorTitle &&
      eventTitle &&
      (monitorTitle.includes(eventTitle) || eventTitle.includes(monitorTitle))
  );
}

function visiblePjnRowMatchesMonitor(row: PjnVisibleRow, monitor: Monitor): boolean {
  const monitorKey = normalizePjnCaseKey(monitor.caseNumber);
  const rowKey = normalizePjnCaseKey(row.caseNumber);
  if (monitorKey && rowKey && monitorKey === rowKey) return true;

  const monitorTitle = normalizeLoose(monitor.title);
  const rowTitle = normalizeLoose(row.title);
  return Boolean(
    monitorTitle &&
      rowTitle &&
      (monitorTitle.includes(rowTitle) || rowTitle.includes(monitorTitle))
  );
}

function visiblePjnRowToMovement(row: PjnVisibleRow): {
  date: string;
  type: string;
  description: string;
} {
  return {
    date: normalizeDateString(row.lastMovementDate),
    type: row.status,
    description: row.status || 'Ultima actualizacion PJN',
  };
}

function pjnEventToMovement(event: PjnEvent): {
  date: string;
  type: string;
  description: string;
} {
  const timestamp =
    event.payload?.fechaFirma ||
    event.fechaFirma ||
    event.fechaAccion ||
    event.fechaCreacion;
  const type = event.payload?.tipoEvento || event.tipo || event.categoria || '';
  const description = type || event.payload?.caratulaExpediente || 'Movimiento PJN';

  return {
    date: formatPjnTimestamp(timestamp),
    type,
    description,
  };
}

function normalizePjnCaseKey(value: string): string {
  const cleaned = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
  const match = cleaned.match(/\b([A-Z]{2,5})\s*0*(\d{1,8})\s*\/\s*(\d{4})\b/);
  if (match) {
    return `${match[1]}:${Number(match[2])}:${match[3]}`;
  }
  return cleaned.replace(/[^A-Z0-9/]/g, '');
}

function normalizeLoose(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatPjnTimestamp(value: number): string {
  const ms = value < 10_000_000_000 ? value * 1000 : value;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return '';
  return [
    String(date.getDate()).padStart(2, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getFullYear()),
  ].join('/');
}

function normalizeDateString(value: string): string {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return '';
  return [
    match[1].padStart(2, '0'),
    match[2].padStart(2, '0'),
    match[3],
  ].join('/');
}

function parseDateTimeValue(date: string): number {
  const match = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return 0;
  return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])).getTime();
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
