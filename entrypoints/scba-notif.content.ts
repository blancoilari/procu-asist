/**
 * Content script for SCBA-Notificaciones
 * https://notificaciones.scba.gov.ar/*
 *
 * Enables:
 * - Auto-login to SCBA Notificaciones
 * - Bulk import of cases from the notifications table into ProcuAsist bookmarks
 */

import {
  SCBA_NOTIF_SELECTORS,
  SCBA_NOTIF_COLUMN_HEADERS,
} from '@/modules/portals/scba-notif-selectors';
import { SCBA_NOTIF_COLOR } from '@/modules/ui/portal-colors';
import {
  ICON_DOWNLOAD,
  ICON_CHECK,
  ICON_X,
  ICON_LOADER,
  ICON_ALERT,
  iconLabel,
} from '@/modules/ui/icon-strings';

const SUCCESS_COLOR = '#16a34a';
const DANGER_COLOR = '#dc2626';
const WARN_COLOR = '#f59e0b';
const MIS_CAUSAS_IMPORT_SESSION_KEY = 'procu_asist_scba_mis_causas_import';

interface ScbaNotifCase {
  id?: string;
  portal?: 'mev';
  caseNumber: string;
  title: string;
  court?: string;
  fuero?: string;
  portalUrl?: string;
  metadata?: {
    set?: string;
    numeroReceptoria?: string;
  };
}

interface MisCausasImportSession {
  collected: ScbaNotifCase[];
  visitedPages: string[];
  startedAt: number;
}

export default defineContentScript({
  matches: ['https://notificaciones.scba.gov.ar/*'],
  registration: 'manifest',
  runAt: 'document_idle',

  main() {
    console.debug('[ProcuAsist] SCBA-Notificaciones content script loaded');

    const doc = document;

    if (isLoginPage()) {
      handleLoginPage(doc);
    } else if (isMisCausasPage()) {
      handleMisCausasPage(doc);
    } else if (isNovedadesPage()) {
      handleNovedadesPage(doc);
    }
  },
});

// ────────────────────────────────────────────────────────
// Page Detection
// ────────────────────────────────────────────────────────

function isLoginPage(): boolean {
  return (
    window.location.pathname.toLowerCase().includes('login') ||
    !!document.querySelector(SCBA_NOTIF_SELECTORS.login.email)
  );
}

function isNovedadesPage(): boolean {
  return (
    window.location.pathname.toLowerCase().includes('novedades') ||
    !!document.querySelector(SCBA_NOTIF_SELECTORS.novedades.table)
  );
}

function isMisCausasPage(): boolean {
  return (
    window.location.pathname.toLowerCase().includes('vercausas') ||
    /MIS CAUSAS/i.test(document.body.textContent ?? '')
  );
}

// ────────────────────────────────────────────────────────
// Auto-Login
// ────────────────────────────────────────────────────────

async function handleLoginPage(doc: Document) {
  console.debug('[ProcuAsist] SCBA-Notificaciones login page detected');

  // For SCBA-Notificaciones we reuse MEV credentials (same SCBA ecosystem)
  // Or a separate credential set could be added later
  // For now, we just detect the page and don't auto-fill
  // since SCBA-Notif uses a different credential (domicilio electrónico)

  const emailInput = doc.querySelector(
    SCBA_NOTIF_SELECTORS.login.email
  ) as HTMLInputElement | null;
  const passwordInput = doc.querySelector(
    SCBA_NOTIF_SELECTORS.login.password
  ) as HTMLInputElement | null;

  if (emailInput && passwordInput) {
    console.debug('[ProcuAsist] SCBA-Notif login form found (auto-login not configured for this portal)');
  }
}

// ────────────────────────────────────────────────────────
// Novedades Page (Main Notifications List)
// ────────────────────────────────────────────────────────

function handleNovedadesPage(doc: Document) {
  console.debug('[ProcuAsist] SCBA-Notificaciones novedades page detected');

  // Wait for DataTable to render
  waitForElement(SCBA_NOTIF_SELECTORS.novedades.rows, () => {
    injectImportButton(doc);
  });
}

function handleMisCausasPage(doc: Document) {
  console.debug('[ProcuAsist] SCBA-Notificaciones Mis Causas page detected');

  waitForMisCausasCards(() => {
    const cases = extractMisCausasFromPage(doc);
    if (cases.length > 0) {
      injectMisCausasImportButton(cases);
      void continueMisCausasImportIfActive(cases);
    }
  });
}

// ────────────────────────────────────────────────────────
// Bulk Import
// ────────────────────────────────────────────────────────

function injectImportButton(doc: Document) {
  if (document.getElementById('procu-asist-import')) return;

  const container = document.createElement('div');
  container.id = 'procu-asist-import';
  Object.assign(container.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    zIndex: '999999',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    alignItems: 'flex-end',
  });

  // Import all button
  const importAllBtn = document.createElement('button');
  importAllBtn.innerHTML = iconLabel(ICON_DOWNLOAD, 'Importar todas las causas');
  Object.assign(importAllBtn.style, {
    padding: '10px 20px',
    borderRadius: '12px',
    border: 'none',
    backgroundColor: SCBA_NOTIF_COLOR.primary,
    color: 'white',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    transition: 'transform 0.2s, background-color 0.2s',
  });

  importAllBtn.addEventListener('mouseenter', () => {
    importAllBtn.style.transform = 'scale(1.03)';
  });
  importAllBtn.addEventListener('mouseleave', () => {
    importAllBtn.style.transform = 'scale(1)';
  });

  importAllBtn.addEventListener('click', async () => {
    importAllBtn.innerHTML = iconLabel(ICON_LOADER, 'Extrayendo causas...');
    importAllBtn.style.backgroundColor = '#9ca3af';
    importAllBtn.disabled = true;

    try {
      const cases = extractCasesFromTable(doc);

      if (cases.length === 0) {
        importAllBtn.innerHTML = iconLabel(ICON_ALERT, 'No se encontraron causas');
        importAllBtn.style.backgroundColor = WARN_COLOR;
        setTimeout(() => {
          importAllBtn.innerHTML = iconLabel(ICON_DOWNLOAD, 'Importar todas las causas');
          importAllBtn.style.backgroundColor = SCBA_NOTIF_COLOR.primary;
          importAllBtn.disabled = false;
        }, 3000);
        return;
      }

      importAllBtn.innerHTML = iconLabel(ICON_LOADER, `Importando ${cases.length} causas...`);

      // Send to background for bulk bookmark creation
      const response = (await chrome.runtime.sendMessage({
        type: 'BULK_IMPORT',
        cases,
        source: 'scba-notificaciones',
      })) as { status: string; imported: number; existing: number };

      importAllBtn.innerHTML = iconLabel(
        ICON_CHECK,
        `${response?.imported ?? cases.length} nuevas, ${response?.existing ?? 0} existentes`
      );
      importAllBtn.style.backgroundColor = SUCCESS_COLOR;

      // Show count badge
      showImportResult(container, cases.length);
    } catch (err) {
      console.error('[ProcuAsist] Bulk import error:', err);
      importAllBtn.innerHTML = iconLabel(ICON_X, 'Error al importar');
      importAllBtn.style.backgroundColor = DANGER_COLOR;
    }

    setTimeout(() => {
      importAllBtn.innerHTML = iconLabel(ICON_DOWNLOAD, 'Importar todas las causas');
      importAllBtn.style.backgroundColor = SCBA_NOTIF_COLOR.primary;
      importAllBtn.disabled = false;
    }, 4000);
  });

  container.appendChild(importAllBtn);

  // Info text
  const info = document.createElement('span');
  info.textContent = 'ProcuAsist — Importación masiva';
  Object.assign(info.style, {
    fontSize: '10px',
    color: '#6b7280',
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: '2px 8px',
    borderRadius: '4px',
  });
  container.appendChild(info);

  document.body.appendChild(container);
}

/**
 * Extract case data from the notifications DataTable.
 * Detects column layout dynamically from <th> headers.
 */
function extractCasesFromTable(
  doc: Document
): Array<{ caseNumber: string; title: string; court?: string }> {
  const cases: Array<{ caseNumber: string; title: string; court?: string }> = [];

  // First, detect column indices from table headers
  const columnMap = detectColumnIndices(doc);
  if (columnMap.causa === -1) {
    console.warn('[ProcuAsist] Could not detect causa column in table');
    // Fallback: try to extract from all rows with heuristics
    return extractCasesFallback(doc);
  }

  const rows = doc.querySelectorAll(SCBA_NOTIF_SELECTORS.novedades.rows);

  for (const row of rows) {
    const cells = row.querySelectorAll('td');
    if (cells.length < 2) continue;

    const caseNumber = cells[columnMap.causa]?.textContent?.trim() ?? '';
    const title =
      columnMap.caratula >= 0
        ? (cells[columnMap.caratula]?.textContent?.trim() ?? '')
        : '';
    const court =
      columnMap.juzgado >= 0
        ? (cells[columnMap.juzgado]?.textContent?.trim() ?? '')
        : undefined;

    if (!caseNumber) continue;

    // Avoid duplicates
    if (!cases.some((c) => c.caseNumber === caseNumber)) {
      cases.push({ caseNumber, title, court });
    }
  }

  console.debug(
    `[ProcuAsist] Extracted ${cases.length} unique cases from ${rows.length} rows`
  );
  return cases;
}

/**
 * Detect which table column contains which data type.
 */
function detectColumnIndices(doc: Document): {
  causa: number;
  caratula: number;
  juzgado: number;
} {
  const result = { causa: -1, caratula: -1, juzgado: -1 };

  const headerRow = doc.querySelector(SCBA_NOTIF_SELECTORS.columns.headerRow);
  if (!headerRow) return result;

  const ths = headerRow.querySelectorAll('th');
  ths.forEach((th, idx) => {
    const text = th.textContent?.trim().toLowerCase() ?? '';

    if (
      result.causa === -1 &&
      SCBA_NOTIF_COLUMN_HEADERS.causa.some((h) => text.includes(h))
    ) {
      result.causa = idx;
    }
    if (
      result.caratula === -1 &&
      SCBA_NOTIF_COLUMN_HEADERS.caratula.some((h) => text.includes(h))
    ) {
      result.caratula = idx;
    }
    if (
      result.juzgado === -1 &&
      SCBA_NOTIF_COLUMN_HEADERS.juzgado.some((h) => text.includes(h))
    ) {
      result.juzgado = idx;
    }
  });

  return result;
}

/**
 * Fallback extraction when column headers can't be detected.
 * Uses heuristics: look for cells matching case number patterns.
 */
function extractCasesFallback(
  doc: Document
): Array<{ caseNumber: string; title: string }> {
  const cases: Array<{ caseNumber: string; title: string }> = [];
  const casePattern = /[A-Z]{2}\s*-\s*\d+\s*-\s*\d{4}/;

  const rows = doc.querySelectorAll(SCBA_NOTIF_SELECTORS.novedades.rows);

  for (const row of rows) {
    const cells = row.querySelectorAll('td');
    let caseNumber = '';
    let title = '';

    for (const cell of cells) {
      const text = cell.textContent?.trim() ?? '';

      // Find case number by pattern
      if (!caseNumber && casePattern.test(text)) {
        caseNumber = text;
      }
      // Title is typically the longest text cell
      if (text.length > title.length && !casePattern.test(text) && text.length > 10) {
        title = text;
      }
    }

    if (caseNumber && !cases.some((c) => c.caseNumber === caseNumber)) {
      cases.push({ caseNumber, title });
    }
  }

  return cases;
}

function showImportResult(container: HTMLElement, count: number) {
  const badge = document.createElement('div');
  badge.textContent = `${count} causas listas en el side panel →`;
  Object.assign(badge.style, {
    padding: '6px 12px',
    borderRadius: '8px',
    backgroundColor: '#dcfce7',
    color: '#166534',
    fontSize: '12px',
    fontWeight: '500',
    boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
  });
  container.appendChild(badge);

  // Auto-remove after 5s
  setTimeout(() => badge.remove(), 5000);
}

// ────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────

// Mis Causas Import

function injectMisCausasImportButton(cases: ScbaNotifCase[]) {
  if (document.getElementById('procu-asist-import-mis-causas')) return;

  const container = document.createElement('div');
  container.id = 'procu-asist-import-mis-causas';
  Object.assign(container.style, {
    position: 'fixed',
    right: '18px',
    bottom: '96px',
    zIndex: '999999',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    alignItems: 'flex-end',
  });

  const btn = document.createElement('button');
  btn.innerHTML = iconLabel(ICON_DOWNLOAD, 'Importar Mis Causas');
  btn.title = `Importar ${cases.length} causas visibles y recorrer la paginacion`;
  Object.assign(btn.style, {
    padding: '10px 16px',
    borderRadius: '12px',
    border: 'none',
    backgroundColor: SCBA_NOTIF_COLOR.primary,
    color: 'white',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 8px 22px rgba(15, 23, 42, 0.22)',
  });

  btn.addEventListener('click', async () => {
    await startMisCausasImport(cases, btn);
  });

  container.appendChild(btn);
  document.body.appendChild(container);
}

async function startMisCausasImport(cases: ScbaNotifCase[], btn: HTMLButtonElement) {
  const session: MisCausasImportSession = {
    collected: cases,
    visitedPages: [getMisCausasPageKey()],
    startedAt: Date.now(),
  };
  sessionStorage.setItem(MIS_CAUSAS_IMPORT_SESSION_KEY, JSON.stringify(session));

  btn.innerHTML = iconLabel(ICON_LOADER, `Importando ${cases.length}...`);
  btn.style.backgroundColor = '#64748b';
  btn.disabled = true;

  if (goToNextMisCausasPage(session, getMisCausasPageKey())) {
    showMisCausasStatus(`Leyendo pagina ${session.visitedPages.length + 1}...`);
    return;
  }

  const response = await finishMisCausasImport(cases);
  btn.innerHTML = iconLabel(
    ICON_CHECK,
    `${response.imported} nuevas, ${response.existing} existentes`
  );
  btn.style.backgroundColor = SUCCESS_COLOR;
}

async function continueMisCausasImportIfActive(cases: ScbaNotifCase[]) {
  const session = readMisCausasImportSession();
  if (!session) return;

  const pageKey = getMisCausasPageKey();
  if (!session.visitedPages.includes(pageKey)) {
    session.collected = mergeScbaNotifCases(session.collected, cases);
    session.visitedPages.push(pageKey);
  }

  showMisCausasStatus(
    `Importando Mis Causas: ${session.collected.length} causas en ${session.visitedPages.length} pagina(s)...`
  );

  if (goToNextMisCausasPage(session, pageKey)) return;

  const response = await finishMisCausasImport(session.collected);
  showMisCausasStatus(
    `Mis Causas importadas: ${response.imported} nuevas, ${response.existing} existentes.`,
    'success'
  );
}

async function finishMisCausasImport(cases: ScbaNotifCase[]) {
  sessionStorage.removeItem(MIS_CAUSAS_IMPORT_SESSION_KEY);
  return bulkImportScbaNotifCases(cases, 'scba-mis-causas');
}

function readMisCausasImportSession(): MisCausasImportSession | null {
  const raw = sessionStorage.getItem(MIS_CAUSAS_IMPORT_SESSION_KEY);
  if (!raw) return null;

  try {
    const session = JSON.parse(raw) as MisCausasImportSession;
    if (!Array.isArray(session.collected) || !Array.isArray(session.visitedPages)) {
      return null;
    }
    if (Date.now() - session.startedAt > 10 * 60 * 1000) {
      sessionStorage.removeItem(MIS_CAUSAS_IMPORT_SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    sessionStorage.removeItem(MIS_CAUSAS_IMPORT_SESSION_KEY);
    return null;
  }
}

function goToNextMisCausasPage(
  session: MisCausasImportSession,
  currentPageKey: string
): boolean {
  const next = findMisCausasNextPageControl();
  if (!next) return false;

  sessionStorage.setItem(MIS_CAUSAS_IMPORT_SESSION_KEY, JSON.stringify(session));
  next.click();

  setTimeout(() => {
    const latestSession = readMisCausasImportSession();
    if (!latestSession) return;
    if (getMisCausasPageKey() === currentPageKey) {
      void finishMisCausasImport(latestSession.collected).then((response) => {
        showMisCausasStatus(
          `Mis Causas importadas: ${response.imported} nuevas, ${response.existing} existentes.`,
          'success'
        );
      });
      return;
    }
    const freshCases = extractMisCausasFromPage(document);
    if (freshCases.length > 0) void continueMisCausasImportIfActive(freshCases);
  }, 1200);

  return true;
}

function findMisCausasNextPageControl(): HTMLElement | null {
  const controls = Array.from(
    document.querySelectorAll('a, button, input[type="button"], input[type="submit"]')
  ) as HTMLElement[];

  return (
    controls.find((control) => {
      const label =
        (control as HTMLInputElement).value || control.textContent?.trim() || '';
      const parentClass = control.parentElement?.className?.toString() ?? '';
      const ownClass = control.className?.toString() ?? '';
      const inlineHandler = control.getAttribute('onclick') ?? '';
      const callsMissingProximo =
        /proximo\s*\(/i.test(inlineHandler) &&
        typeof (window as unknown as { proximo?: unknown }).proximo !== 'function';
      const disabled =
        control.hasAttribute('disabled') ||
        /disabled/i.test(parentClass) ||
        /disabled/i.test(ownClass);
      if (callsMissingProximo) return false;
      return !disabled && /^(proximo|pr[oó]ximo|siguiente)$/i.test(label.trim());
    }) ?? null
  );
}

function extractMisCausasFromPage(doc: Document): ScbaNotifCase[] {
  const cards = findMisCausasCards(doc);
  const cases: ScbaNotifCase[] = [];

  for (const card of cards) {
    const text = normalizeText(card.textContent ?? '');
    const number = firstMatch(text, /N[uú]mero:\s*([^\s]+)/i);
    const title = firstMatch(text, /Car[aá]tula:\s*(.+?)\s+Juzgado:/i);
    const court = firstMatch(
      text,
      /Juzgado:\s*(.+?)(?:\s+Ver Tr[aá]mites|\s+Crear Presentaci[oó]n|\s+Ver Cuentas|\s+Autorizada|\s*$)/i
    );

    if (!number || !title) continue;

    const normalizedCourt = court || '';
    const id = `scba-notif:${normalizeKey(number)}:${normalizeKey(normalizedCourt)}`;
    if (cases.some((c) => c.id === id)) continue;

    cases.push({
      id,
      portal: 'mev',
      caseNumber: number,
      title,
      court: normalizedCourt,
      fuero: '',
      portalUrl: window.location.href,
      metadata: {
        set: 'scba-mis-causas',
        numeroReceptoria: number,
      },
    });
  }

  console.debug(`[ProcuAsist] Mis Causas parsed: ${cases.length}`);
  return cases;
}

function findMisCausasCards(doc: Document): HTMLElement[] {
  const actionButtons = Array.from(
    doc.querySelectorAll('a, button, input[type="button"], input[type="submit"]')
  ) as HTMLElement[];
  const cards: HTMLElement[] = [];

  for (const button of actionButtons) {
    const label =
      (button as HTMLInputElement).value || button.textContent?.trim() || '';
    if (!/Ver Tr[aá]mites|Crear Presentaci[oó]n/i.test(label)) continue;

    let current = button.parentElement;
    for (let depth = 0; current && depth < 8; depth++) {
      const text = current.textContent ?? '';
      if (
        /N[uú]mero:/i.test(text) &&
        /Car[aá]tula:/i.test(text) &&
        /Juzgado:/i.test(text) &&
        text.length < 2500
      ) {
        if (!cards.includes(current)) cards.push(current);
        break;
      }
      current = current.parentElement;
    }
  }

  return cards;
}

function waitForMisCausasCards(callback: () => void, timeoutMs = 10000) {
  if (extractMisCausasFromPage(document).length > 0) {
    callback();
    return;
  }

  const observer = new MutationObserver(() => {
    if (extractMisCausasFromPage(document).length > 0) {
      observer.disconnect();
      callback();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), timeoutMs);
}

async function bulkImportScbaNotifCases(cases: ScbaNotifCase[], source: string) {
  return (await chrome.runtime.sendMessage({
    type: 'BULK_IMPORT',
    cases,
    source,
  })) as { status: string; imported: number; existing: number };
}

function mergeScbaNotifCases(
  previous: ScbaNotifCase[],
  next: ScbaNotifCase[]
): ScbaNotifCase[] {
  const map = new Map<string, ScbaNotifCase>();
  for (const item of [...previous, ...next]) {
    const key = item.id || `${item.caseNumber}:${item.court ?? ''}`;
    map.set(key, item);
  }
  return Array.from(map.values());
}

function getMisCausasPageKey(): string {
  const activePage =
    document.querySelector('.pagination .active')?.textContent?.trim() ||
    document.querySelector('li.active')?.textContent?.trim() ||
    '';
  const firstCase =
    firstMatch(normalizeText(document.body.textContent ?? ''), /N[uú]mero:\s*([^\s]+)/i) ||
    '';
  return `${activePage || window.location.href}|${firstCase}`;
}

function showMisCausasStatus(message: string, variant: 'muted' | 'success' = 'muted') {
  let status = document.getElementById('procu-asist-mis-causas-status');
  if (!status) {
    status = document.createElement('div');
    status.id = 'procu-asist-mis-causas-status';
    Object.assign(status.style, {
      position: 'fixed',
      right: '18px',
      bottom: '150px',
      zIndex: '999999',
      maxWidth: '230px',
      padding: '10px 14px',
      borderRadius: '12px',
      boxShadow: '0 8px 22px rgba(15, 23, 42, 0.22)',
      fontSize: '12px',
      fontWeight: '700',
      textAlign: 'center',
    });
    document.body.appendChild(status);
  }

  status.textContent = message;
  Object.assign(status.style, {
    backgroundColor: variant === 'success' ? SUCCESS_COLOR : '#eff6ff',
    color: variant === 'success' ? 'white' : SCBA_NOTIF_COLOR.primary,
    border: variant === 'success' ? `1px solid ${SUCCESS_COLOR}` : '1px solid #bfdbfe',
  });

  if (variant === 'success') {
    setTimeout(() => status?.remove(), 8000);
  }
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function firstMatch(value: string, pattern: RegExp): string {
  return value.match(pattern)?.[1]?.trim() ?? '';
}

function normalizeKey(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase();
}

function waitForElement(selector: string, callback: () => void, timeoutMs = 10000) {
  if (document.querySelector(selector)) {
    callback();
    return;
  }

  const observer = new MutationObserver(() => {
    if (document.querySelector(selector)) {
      observer.disconnect();
      callback();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), timeoutMs);
}
