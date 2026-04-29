/**
 * Floating bookmark/monitor actions for PJN expediente pages.
 *
 * PJN's historical actuaciones page shares the ZIP flow, but it does not always
 * expose the full case header. These actions are intentionally mounted only on
 * `expediente.seam`, where `parseExpedientePage` can build a reliable Case.
 */

import type { Case } from '@/modules/portals/types';
import type { PjnExpedienteData } from './pjn-parser';
import {
  ICON_CHECK,
  ICON_EYE,
  ICON_LOADER,
  ICON_STAR,
  ICON_X,
} from '@/modules/ui/icon-strings';
import {
  createConfigActionButton,
  createPortalActionBar,
  createPortalActionButton,
  setPortalActionButtonState,
} from '@/modules/ui/portal-action-bar';

const ACTION_BAR_ID = 'procu-asist-action-bar';
const CONFIG_BUTTON_ID = 'procu-asist-config';
const BOOKMARK_BUTTON_ID = 'procu-asist-pjn-bookmark';
const MONITOR_BUTTON_ID = 'procu-asist-pjn-monitor';

export function mountPjnCaseActions(data: PjnExpedienteData, url: string): void {
  const caseData = buildPjnCase(data, url);
  if (!caseData) return;

  chrome.runtime
    .sendMessage({ type: 'CASE_PAGE_DETECTED', caseData })
    .catch((err) => {
      console.debug('[ProcuAsist PJN] could not store detected case', err);
    });

  const bar = ensurePjnActionBar();
  mountBookmarkButton(bar, caseData);
  mountMonitorButton(bar, caseData);
}

function buildPjnCase(data: PjnExpedienteData, url: string): Case | null {
  const dg = data.datosGenerales;
  if (!dg) return null;

  const caseNumber = cleanText(dg.expediente) || cleanText(dg.cid);
  if (!caseNumber) return null;

  const firstMovement = data.tabs.actuaciones.rows[0];

  return {
    id: cleanText(dg.cid) || caseNumber,
    portal: 'pjn',
    caseNumber,
    title: cleanText(dg.caratula) || 'Sin caratula',
    court: cleanText(dg.dependencia) || cleanText(dg.jurisdiccion),
    fuero: cleanText(dg.jurisdiccion),
    portalUrl: url,
    lastMovementDate: firstMovement?.fecha,
    lastMovementDesc: firstMovement
      ? [firstMovement.tipo, firstMovement.descripcion].filter(Boolean).join(' - ')
      : undefined,
    metadata: {
      source: 'pjn-expediente',
      sesion: cleanText(dg.jurisdiccion),
      estadoPortal: cleanText(dg.situacionActual),
    },
  };
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

function mountBookmarkButton(bar: HTMLDivElement, caseData: Case): void {
  if (document.getElementById(BOOKMARK_BUTTON_ID)) return;

  const btn = createPortalActionButton({
    id: BOOKMARK_BUTTON_ID,
    icon: ICON_STAR,
    label: 'Guardar',
    title: `Guardar ${caseData.caseNumber} en marcadores`,
    variant: 'secondary',
  });

  chrome.runtime
    .sendMessage({
      type: 'IS_BOOKMARKED',
      portal: 'pjn',
      caseNumber: caseData.caseNumber,
    })
    .then((r) => {
      const resp = r as { success?: boolean; isBookmarked?: boolean };
      if (resp?.success && resp.isBookmarked) {
        setPortalActionButtonState(btn, ICON_CHECK, 'Guardado', 'success');
        btn.dataset.saved = 'true';
      }
    })
    .catch(() => undefined);

  btn.addEventListener('click', async () => {
    if (btn.dataset.saved === 'true') return;

    setPortalActionButtonState(btn, ICON_LOADER, 'Guardando', 'muted');
    btn.disabled = true;

    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'ADD_BOOKMARK',
        caseData,
      })) as { success?: boolean };

      if (response?.success) {
        setPortalActionButtonState(btn, ICON_CHECK, 'Guardado', 'success');
        btn.dataset.saved = 'true';
        return;
      }
      resetButtonAfterError(btn, ICON_STAR, 'Guardar');
    } catch {
      resetButtonAfterError(btn, ICON_STAR, 'Guardar');
    }
  });

  bar.appendChild(btn);
}

function mountMonitorButton(bar: HTMLDivElement, caseData: Case): void {
  if (document.getElementById(MONITOR_BUTTON_ID)) return;

  const btn = createPortalActionButton({
    id: MONITOR_BUTTON_ID,
    icon: ICON_EYE,
    label: 'Monitorear',
    title: `Monitorear ${caseData.caseNumber}`,
    variant: 'secondary',
  });

  chrome.runtime
    .sendMessage({
      type: 'IS_MONITORED',
      portal: 'pjn',
      caseNumber: caseData.caseNumber,
    })
    .then((r) => {
      const resp = r as { success?: boolean; isMonitored?: boolean };
      if (resp?.success && resp.isMonitored) {
        setPortalActionButtonState(btn, ICON_EYE, 'Monitoreando', 'success');
        btn.dataset.monitored = 'true';
      }
    })
    .catch(() => undefined);

  btn.addEventListener('click', async () => {
    if (btn.dataset.monitored === 'true') return;

    setPortalActionButtonState(btn, ICON_LOADER, 'Activando', 'muted');
    btn.disabled = true;

    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'ADD_MONITOR',
        caseData,
      })) as { success?: boolean };

      if (response?.success) {
        setPortalActionButtonState(btn, ICON_EYE, 'Monitoreando', 'success');
        btn.dataset.monitored = 'true';
        return;
      }
      resetButtonAfterError(btn, ICON_EYE, 'Monitorear');
    } catch {
      resetButtonAfterError(btn, ICON_EYE, 'Monitorear');
    }
  });

  bar.appendChild(btn);
}

function resetButtonAfterError(
  btn: HTMLButtonElement,
  icon: string,
  label: string
): void {
  setPortalActionButtonState(btn, ICON_X, 'Error', 'danger');
  window.setTimeout(() => {
    btn.disabled = false;
    setPortalActionButtonState(btn, icon, label, 'secondary');
  }, 2000);
}

function cleanText(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}
