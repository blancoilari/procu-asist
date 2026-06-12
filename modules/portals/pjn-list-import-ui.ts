/**
 * Import button for PJN SCW listing pages.
 *
 * This intentionally imports rows as local ProcuAsist bookmarks only. PJN
 * monitoring still needs its own scanner, so bulk-monitoring is left for the
 * next PJN hardening step.
 */

import { parseScwList, type PjnCaseRow, type PjnListMode } from './pjn-parser';
import { collectScwListRows } from './pjn-list-collector';
import { ICON_CHECK, ICON_DOWNLOAD, ICON_LOADER, ICON_X } from '@/modules/ui/icon-strings';
import {
  createConfigActionButton,
  createPortalActionBar,
  createPortalActionButton,
  createPortalModalButton,
  setPortalActionButtonState,
} from '@/modules/ui/portal-action-bar';

const ACTION_BAR_ID = 'procu-asist-action-bar';
const CONFIG_BUTTON_ID = 'procu-asist-config';
const BUTTON_ID = 'procu-asist-pjn-import-list';

export function mountPjnListImportButton(url: URL): void {
  if (document.getElementById(BUTTON_ID)) return;

  const bar = ensurePjnActionBar();
  const initial = parseScwList(document, url);
  const btn = createPortalActionButton({
    id: BUTTON_ID,
    icon: ICON_DOWNLOAD,
    label: labelForMode(initial.mode),
    title: titleForMode(initial.mode, initial.rows.length),
    variant: 'secondary',
  });

  btn.addEventListener('click', async () => {
    const mode = parseScwList(document, new URL(window.location.href)).mode;

    // Collect ALL pages (not just the visible one) before importing.
    setPortalActionButtonState(btn, ICON_LOADER, 'Recolectando', 'muted');
    btn.disabled = true;

    let allRows: PjnCaseRow[] = [];
    try {
      const collected = await collectScwListRows({ maxPages: 25 });
      allRows = collected.rows.filter(isImportableRow);
    } catch {
      // Fall back to the visible page if pagination failed.
      allRows = parseScwList(document, new URL(window.location.href)).rows.filter(
        isImportableRow
      );
    }

    if (!allRows.length) {
      setPortalActionButtonState(btn, ICON_X, 'Sin causas', 'warning');
      resetImportButton(btn, mode, 2200);
      return;
    }

    // Let the user pick which of ALL collected cases to import.
    const selected = await showImportSelectionModal(allRows, mode);
    if (!selected) {
      resetImportButton(btn, mode, 0);
      return;
    }
    if (!selected.length) {
      setPortalActionButtonState(btn, ICON_X, 'Nada elegido', 'warning');
      resetImportButton(btn, mode, 2200);
      return;
    }

    setPortalActionButtonState(btn, ICON_LOADER, 'Importando', 'muted');
    btn.disabled = true;

    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'BULK_IMPORT',
        source: `pjn-${mode}`,
        monitor: false,
        cases: selected.map((row) => toImportCase(row, mode)),
      })) as {
        status?: string;
        imported?: number;
        existing?: number;
      };

      if (response?.status === 'ok') {
        const imported = response.imported ?? 0;
        const existing = response.existing ?? 0;
        setPortalActionButtonState(
          btn,
          ICON_CHECK,
          `${imported} nuevas`,
          'success'
        );
        btn.title = `${imported} nuevas, ${existing} ya existentes`;
        resetImportButton(btn, mode, 5000);
        return;
      }
      showImportError(btn, mode);
    } catch {
      showImportError(btn, mode);
    }
  });

  const configBtn = document.getElementById(CONFIG_BUTTON_ID);
  if (configBtn?.nextSibling) {
    bar.insertBefore(btn, configBtn.nextSibling);
  } else {
    bar.appendChild(btn);
  }
}

const IMPORT_MODAL_ID = 'procu-asist-pjn-import-modal';

/**
 * Modal that lists every collected case (across all pages) with checkboxes,
 * so the user can import all of them or pick a subset. Resolves with the
 * selected rows, or null if cancelled.
 */
function showImportSelectionModal(
  rows: PjnCaseRow[],
  mode: PjnListMode
): Promise<PjnCaseRow[] | null> {
  return new Promise((resolve) => {
    document.getElementById(IMPORT_MODAL_ID)?.remove();

    const overlay = document.createElement('div');
    overlay.id = IMPORT_MODAL_ID;
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', backgroundColor: 'rgba(0,0,0,0.5)',
      zIndex: '2147483647', display: 'flex', alignItems: 'center',
      justifyContent: 'center',
    } satisfies Partial<CSSStyleDeclaration>);

    const modal = document.createElement('div');
    Object.assign(modal.style, {
      backgroundColor: 'white', borderRadius: '12px', padding: '20px',
      maxWidth: '720px', width: '92%', maxHeight: '82vh', display: 'flex',
      flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      fontFamily: 'system-ui, sans-serif',
    } satisfies Partial<CSSStyleDeclaration>);

    const title = document.createElement('h3');
    title.textContent = `Importar ${scopeLabel(mode)} — ${rows.length} expedientes`;
    Object.assign(title.style, { margin: '0 0 4px 0', color: '#1f2937', fontSize: '16px' });

    const subtitle = document.createElement('p');
    subtitle.textContent = 'Se recolectaron todas las páginas del listado. Elegí cuáles importar.';
    Object.assign(subtitle.style, { margin: '0 0 12px 0', color: '#6b7280', fontSize: '12px' });

    const topBar = document.createElement('div');
    Object.assign(topBar.style, { display: 'flex', gap: '8px', marginBottom: '10px' });
    const selectAllBtn = createPortalModalButton({ label: 'Seleccionar todos', variant: 'secondary' });
    const deselectAllBtn = createPortalModalButton({ label: 'Ninguno', variant: 'secondary' });
    topBar.appendChild(selectAllBtn);
    topBar.appendChild(deselectAllBtn);

    const list = document.createElement('div');
    Object.assign(list.style, {
      overflowY: 'auto', flex: '1', marginBottom: '12px',
      border: '1px solid #e5e7eb', borderRadius: '8px',
    } satisfies Partial<CSSStyleDeclaration>);

    const checkboxes: HTMLInputElement[] = [];

    const importBtn = createPortalModalButton({ label: 'Importar', variant: 'primary' });
    const updateCount = () => {
      const count = checkboxes.filter((cb) => cb.checked).length;
      importBtn.textContent = `Importar seleccionados (${count})`;
      importBtn.disabled = count === 0;
      importBtn.style.opacity = count === 0 ? '0.5' : '1';
    };

    rows.forEach((row, i) => {
      const label = document.createElement('label');
      Object.assign(label.style, {
        display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px',
        borderBottom: i < rows.length - 1 ? '1px solid #f3f4f6' : 'none',
        cursor: 'pointer', fontSize: '12px', lineHeight: '1.4',
      } satisfies Partial<CSSStyleDeclaration>);

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = true;
      cb.style.flexShrink = '0';
      cb.addEventListener('change', updateCount);
      checkboxes.push(cb);

      const info = document.createElement('div');
      info.style.flex = '1';
      const exp = document.createElement('span');
      exp.textContent = cleanText(row.expediente);
      Object.assign(exp.style, { fontWeight: '600', color: '#1f2937', marginRight: '8px' });
      const car = document.createElement('span');
      car.textContent = cleanText(row.caratula);
      car.style.color = '#374151';
      info.appendChild(exp);
      info.appendChild(car);

      label.appendChild(cb);
      label.appendChild(info);
      list.appendChild(label);
    });

    selectAllBtn.addEventListener('click', () => {
      checkboxes.forEach((cb) => { cb.checked = true; });
      updateCount();
    });
    deselectAllBtn.addEventListener('click', () => {
      checkboxes.forEach((cb) => { cb.checked = false; });
      updateCount();
    });

    const bottomBar = document.createElement('div');
    Object.assign(bottomBar.style, { display: 'flex', justifyContent: 'flex-end', gap: '8px' });
    const cancelBtn = createPortalModalButton({ label: 'Cancelar', variant: 'secondary' });

    const finish = (value: PjnCaseRow[] | null) => {
      overlay.remove();
      resolve(value);
    };

    cancelBtn.addEventListener('click', () => finish(null));
    importBtn.addEventListener('click', () => {
      finish(rows.filter((_, i) => checkboxes[i].checked));
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) finish(null);
    });

    bottomBar.appendChild(cancelBtn);
    bottomBar.appendChild(importBtn);

    modal.appendChild(title);
    modal.appendChild(subtitle);
    modal.appendChild(topBar);
    modal.appendChild(list);
    modal.appendChild(bottomBar);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    updateCount();
  });
}

function scopeLabel(mode: PjnListMode): string {
  if (mode === 'favoritos') return 'favoritos';
  if (mode === 'relacionados-parte') return 'relacionados (parte)';
  if (mode === 'relacionados-letrado') return 'relacionados (letrado)';
  return 'listado PJN';
}

function ensurePjnActionBar(): HTMLDivElement {
  const bar = createPortalActionBar(ACTION_BAR_ID);
  if (!document.getElementById(CONFIG_BUTTON_ID)) {
    const configBtn = createConfigActionButton();
    configBtn.id = CONFIG_BUTTON_ID;
    bar.prepend(configBtn);
  }
  return bar;
}

function toImportCase(row: PjnCaseRow, mode: PjnListMode) {
  const caseNumber = cleanText(row.expediente);
  const detailUrl = resolveDetailUrl(row.detailHref);
  return {
    id: getCid(detailUrl) || caseNumber,
    portal: 'pjn' as const,
    caseNumber,
    title: cleanText(row.caratula) || 'Sin caratula',
    court: cleanText(row.dependencia),
    fuero: '',
    portalUrl: detailUrl || window.location.href,
    lastMovementDate: cleanText(row.ultimaActualizacion),
    metadata: {
      source: `pjn-${mode}`,
      estadoPortal: cleanText(row.situacion),
    },
  };
}

function isImportableRow(row: PjnCaseRow): boolean {
  return Boolean(cleanText(row.expediente) && cleanText(row.caratula));
}

function resolveDetailUrl(href: string): string {
  if (!href) return '';
  try {
    return new URL(href, window.location.href).toString();
  } catch {
    return '';
  }
}

function getCid(url: string): string {
  if (!url) return '';
  try {
    return new URL(url).searchParams.get('cid') ?? '';
  } catch {
    return '';
  }
}

function labelForMode(mode: PjnListMode): string {
  if (mode === 'favoritos') return 'Importar favoritos';
  if (mode === 'relacionados-parte') return 'Importar parte';
  if (mode === 'relacionados-letrado') return 'Importar letrado';
  return 'Importar PJN';
}

function titleForMode(mode: PjnListMode, count: number): string {
  const scope =
    mode === 'favoritos'
      ? 'favoritos'
      : mode === 'relacionados-parte'
        ? 'relacionados como parte'
        : mode === 'relacionados-letrado'
          ? 'relacionados como letrado'
          : 'del listado PJN';
  return `Importar ${count} expediente(s) ${scope} como marcadores`;
}

function showImportError(btn: HTMLButtonElement, mode: PjnListMode): void {
  setPortalActionButtonState(btn, ICON_X, 'Error', 'danger');
  resetImportButton(btn, mode, 2500);
}

function resetImportButton(
  btn: HTMLButtonElement,
  mode: PjnListMode,
  delayMs: number
): void {
  window.setTimeout(() => {
    const parsed = parseScwList(document, new URL(window.location.href));
    btn.disabled = false;
    btn.title = titleForMode(parsed.mode || mode, parsed.rows.length);
    setPortalActionButtonState(
      btn,
      ICON_DOWNLOAD,
      labelForMode(parsed.mode || mode),
      'secondary'
    );
  }, delayMs);
}

function cleanText(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}
