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

export default defineContentScript({
  matches: ['https://notificaciones.scba.gov.ar/*'],
  registration: 'manifest',
  runAt: 'document_idle',

  main() {
    console.debug('[ProcuAsist] SCBA-Notificaciones content script loaded');

    const doc = document;

    if (isLoginPage()) {
      handleLoginPage(doc);
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
      })) as { status: string; imported: number };

      importAllBtn.innerHTML = iconLabel(ICON_CHECK, `${response?.imported ?? cases.length} causas importadas`);
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

