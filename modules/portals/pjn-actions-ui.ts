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
  ICON_ALERT,
  ICON_CHECK,
  ICON_EYE,
  ICON_FILE_PEN,
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
const LEAVE_NOTE_BUTTON_ID = 'procu-asist-pjn-leave-note';

type LeaveNoteStatus = 'success' | 'duplicate';

export function mountPjnCaseActions(data: PjnExpedienteData, url: string): void {
  const caseData = buildPjnCase(data, url);
  if (!caseData) return;

  chrome.runtime
    .sendMessage({ type: 'CASE_PAGE_DETECTED', caseData })
    .catch((err) => {
      console.debug('[ProcuAsist PJN] could not store detected case', err);
    });

  const bar = ensurePjnActionBar();
  mountLeaveNoteButton(bar, caseData);
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

function mountLeaveNoteButton(bar: HTMLDivElement, caseData: Case): void {
  if (document.getElementById(LEAVE_NOTE_BUTTON_ID)) return;

  const nativeControl = findNativeLeaveNoteControl();
  const btn = createPortalActionButton({
    id: LEAVE_NOTE_BUTTON_ID,
    icon: ICON_FILE_PEN,
    label: 'Nota',
    title: `Abrir Dejar Nota para ${caseData.caseNumber}`,
    variant: nativeControl ? 'primary' : 'muted',
  });

  if (!nativeControl) {
    btn.disabled = true;
    btn.title = 'PJN no muestra Dejar Nota para este expediente';
  }

  applyLeaveNotePortalStatus(btn, caseData);
  observeLeaveNotePortalStatus(btn, caseData);

  btn.addEventListener('click', () => {
    if (applyLeaveNotePortalStatus(btn, caseData)) return;

    const control = findNativeLeaveNoteControl();
    if (!control) {
      resetButtonAfterError(btn, ICON_FILE_PEN, 'Nota');
      return;
    }

    if (!isPjnNoteDay()) {
      const shouldOpen = window.confirm(
        'Hoy no es martes ni viernes, que son los dias habituales para dejar nota. ProcuAsist solo va a abrir el flujo oficial de PJN. Queres continuar?'
      );
      if (!shouldOpen) return;
    }

    setPortalActionButtonState(btn, ICON_LOADER, 'Abriendo', 'muted');
    btn.disabled = true;
    control.click();
    window.setTimeout(() => {
      if (applyLeaveNotePortalStatus(btn, caseData)) return;
      btn.disabled = false;
      setPortalActionButtonState(btn, ICON_FILE_PEN, 'Nota', 'primary');
    }, 1500);
  });

  bar.appendChild(btn);
}

function applyLeaveNotePortalStatus(
  btn: HTMLButtonElement,
  caseData: Case
): boolean {
  const status = readLeaveNotePortalStatus();
  if (!status) return false;
  if (btn.dataset.leaveNoteStatus === status) return true;

  btn.disabled = true;
  btn.dataset.leaveNoteStatus = status;
  if (status === 'success') {
    setPortalActionButtonState(btn, ICON_CHECK, 'Nota hecha', 'success');
    btn.title = `PJN informa que se dejo nota en ${caseData.caseNumber}`;
    return true;
  }

  setPortalActionButtonState(btn, ICON_ALERT, 'Ya hecha', 'warning');
  btn.title = `PJN informa que ya se dejo nota hoy en ${caseData.caseNumber}`;
  return true;
}

function observeLeaveNotePortalStatus(
  btn: HTMLButtonElement,
  caseData: Case
): void {
  const observer = new MutationObserver(() => {
    applyLeaveNotePortalStatus(btn, caseData);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
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

function findNativeLeaveNoteControl(): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>(
    'a, button, input[type="button"], input[type="submit"]'
  );

  for (const el of Array.from(candidates)) {
    if (el.id.startsWith('procu-asist-')) continue;
    if (!isVisibleElement(el) || isDisabledElement(el)) continue;

    const input = el as HTMLInputElement;
    const label = normalizeActionText(
      [
        el.textContent,
        input.value,
        el.title,
        el.getAttribute('aria-label'),
        el.getAttribute('data-original-title'),
      ]
        .filter(Boolean)
        .join(' ')
    );

    if (/\bdejar\s+nota\b/.test(label)) return el;
  }

  return null;
}

function readLeaveNotePortalStatus(): LeaveNoteStatus | null {
  const candidates = document.querySelectorAll<HTMLElement>(
    '.alert, [class*="alert"], .ui-messages, .ui-message, .ui-growl, .messages, .message'
  );

  for (const el of Array.from(candidates)) {
    if (!isVisibleElement(el)) continue;
    const status = classifyLeaveNoteStatusText(el.textContent ?? '');
    if (status) return status;
  }

  return classifyLeaveNoteStatusText(document.body.textContent ?? '');
}

function classifyLeaveNoteStatusText(value: string): LeaveNoteStatus | null {
  const text = normalizeActionText(value);

  if (
    text.includes('se ha dejado nota') &&
    text.includes('forma correcta')
  ) {
    return 'success';
  }

  if (
    text.includes('ya se ha dejado nota') ||
    text.includes('no es posible realizar dicha accion mas de una vez')
  ) {
    return 'duplicate';
  }

  return null;
}

function isPjnNoteDay(date = new Date()): boolean {
  const day = date.getDay();
  return day === 2 || day === 5;
}

function isVisibleElement(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function isDisabledElement(el: HTMLElement): boolean {
  const input = el as HTMLInputElement;
  return (
    input.disabled ||
    el.getAttribute('aria-disabled') === 'true' ||
    /\b(disabled|ui-state-disabled|rf-dsbl)\b/i.test(el.className)
  );
}

function normalizeActionText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanText(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}
