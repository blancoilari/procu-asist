/**
 * Import button for PJN SCW listing pages.
 *
 * This intentionally imports rows as local ProcuAsist bookmarks only. PJN
 * monitoring still needs its own scanner, so bulk-monitoring is left for the
 * next PJN hardening step.
 */

import { parseScwList, type PjnCaseRow, type PjnListMode } from './pjn-parser';
import { ICON_CHECK, ICON_DOWNLOAD, ICON_LOADER, ICON_X } from '@/modules/ui/icon-strings';
import {
  createConfigActionButton,
  createPortalActionBar,
  createPortalActionButton,
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
    const parsed = parseScwList(document, new URL(window.location.href));
    const rows = parsed.rows.filter(isImportableRow);
    if (!rows.length) {
      setPortalActionButtonState(btn, ICON_X, 'Sin causas', 'warning');
      resetImportButton(btn, parsed.mode, 2200);
      return;
    }

    setPortalActionButtonState(btn, ICON_LOADER, 'Importando', 'muted');
    btn.disabled = true;

    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'BULK_IMPORT',
        source: `pjn-${parsed.mode}`,
        monitor: false,
        cases: rows.map((row) => toImportCase(row, parsed.mode)),
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
        resetImportButton(btn, parsed.mode, 5000);
        return;
      }
      showImportError(btn, parsed.mode);
    } catch {
      showImportError(btn, parsed.mode);
    }
  });

  const configBtn = document.getElementById(CONFIG_BUTTON_ID);
  if (configBtn?.nextSibling) {
    bar.insertBefore(btn, configBtn.nextSibling);
  } else {
    bar.appendChild(btn);
  }
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
