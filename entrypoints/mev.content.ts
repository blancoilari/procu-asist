/**
 * Content script for MEV (Mesa de Entradas Virtual)
 * https://mev.scba.gov.ar/*
 *
 * Handles: auto-login, post-login department selection, session monitoring,
 * case data extraction, and dark mode.
 */

import { MEV_SELECTORS } from '@/modules/portals/mev-selectors';
import type { Movement } from '@/modules/portals/types';
import type { MevCaseData } from '@/modules/portals/mev-parser';
import {
  isLoginPage,
  isPosLoginPage,
  isBusquedaPage,
  isCasePage,
  isResultsPage,
  isProveidoPage,
  parseCaseData,
  parseMovements,
  parseSearchResults,
  parseAdjuntos,
} from '@/modules/portals/mev-parser';
import { PORTAL_COLORS } from '@/modules/ui/portal-colors';
import {
  ICON_STAR,
  ICON_EYE,
  ICON_CHECK,
  ICON_X,
  ICON_LOADER,
  ICON_PACKAGE,
  iconLabel,
} from '@/modules/ui/icon-strings';

const MEV_COLORS = PORTAL_COLORS.mev;
const SUCCESS_COLOR = '#16a34a';
const DANGER_COLOR = '#dc2626';

export default defineContentScript({
  matches: ['https://mev.scba.gov.ar/*'],
  registration: 'manifest',
  runAt: 'document_idle',

  main() {
    console.debug('[ProcuAsist] MEV content script loaded');
    const doc = document;

    if (isLoginPage(doc)) {
      handleLoginPage(doc);
    } else if (isPosLoginPage(doc)) {
      handlePosLoginPage(doc);
    } else {
      // Start session expiry monitoring
      startSessionMonitor();

      if (isBusquedaPage(doc)) {
        handleBusquedaPage(doc);
      } else if (isResultsPage(doc)) {
        handleResultsPage(doc);
      } else if (isCasePage(doc)) {
        handleCasePage(doc);
      } else if (isProveidoPage(doc)) {
        handleProveidoPage(doc);
      }
    }

    applyDarkModeIfEnabled();
  },
});

// --- Login Page ---

async function handleLoginPage(doc: Document) {
  console.debug('[ProcuAsist] MEV login page detected');

  // Check if we have a returnUrl stored (from session expiry)
  const returnUrl = sessionStorage.getItem('procu_asist_return_url');

  // Request credentials from background
  const response = await chrome.runtime.sendMessage({
    type: 'GET_CREDENTIALS',
    portal: 'mev',
  });

  if (!response?.success || !response.credentials) {
    console.debug('[ProcuAsist] No credentials available for auto-login');
    return;
  }

  const { username, password } = response.credentials;

  // Fill login form
  const usuarioInput = doc.querySelector(
    MEV_SELECTORS.login.usuario
  ) as HTMLInputElement | null;
  const claveInput = doc.querySelector(
    MEV_SELECTORS.login.clave
  ) as HTMLInputElement | null;
  const deptoSelect = doc.querySelector(
    MEV_SELECTORS.login.depto
  ) as HTMLSelectElement | null;

  if (!usuarioInput || !claveInput) {
    console.warn('[ProcuAsist] Login form fields not found');
    return;
  }

  // Fill credentials
  usuarioInput.value = username;
  claveInput.value = password;

  // Set department to "TODOS" for initial login
  if (deptoSelect) {
    deptoSelect.value = 'aa';
  }

  // Small delay to mimic human interaction, then submit
  setTimeout(() => {
    const form = doc.querySelector(MEV_SELECTORS.login.form) as HTMLFormElement;
    if (form) {
      console.debug('[ProcuAsist] Submitting login form');
      form.submit();
    }
  }, 500);
}

// --- Post-Login Page (Department Selection) ---

async function handlePosLoginPage(doc: Document) {
  console.debug('[ProcuAsist] MEV post-login page detected');

  // Get preferred department from settings
  const stored = await chrome.storage.local.get('tl_settings');
  const settings = stored.tl_settings as Record<string, unknown> | undefined;
  const preferredDepto = (settings?.mevDepartamento as string) ?? 'aa';

  // 'aa' = "TODOS los Deptos" is only valid for the first login form.
  // POSloguin.asp only has real department codes — if no specific dept is
  // configured, don't auto-submit and let the user choose manually.
  if (!preferredDepto || preferredDepto === 'aa') {
    console.debug(
      '[ProcuAsist] No specific department configured — skipping auto-submit on POSloguin. ' +
        'Configure a department in Options to enable full auto-login.'
    );
    return;
  }

  const deptoSelect = doc.querySelector(
    MEV_SELECTORS.posLogin.depto
  ) as HTMLSelectElement | null;
  const aceptarBtn = doc.querySelector(
    MEV_SELECTORS.posLogin.aceptar
  ) as HTMLInputElement | null;

  if (!deptoSelect || !aceptarBtn) {
    console.warn('[ProcuAsist] Post-login form elements not found');
    return;
  }

  // First, select the "Departamento Judicial" radio button so the form
  // is in the correct state before we choose the department.
  const deptRadio = doc.querySelector(
    MEV_SELECTORS.posLogin.deptJudRadio
  ) as HTMLInputElement | null;
  if (deptRadio && !deptRadio.checked) {
    deptRadio.click();
    console.debug('[ProcuAsist] Clicked Departamento Judicial radio');
  }

  // Set preferred department
  deptoSelect.value = preferredDepto;

  // Verify the value was actually set (if the code doesn't exist in the
  // dropdown the browser silently ignores the assignment)
  if (deptoSelect.value !== preferredDepto) {
    console.warn(
      `[ProcuAsist] Department code '${preferredDepto}' not found in POSloguin dropdown — skipping auto-submit`
    );
    return;
  }

  // Auto-click Aceptar after short delay
  setTimeout(() => {
    console.debug(
      `[ProcuAsist] Selecting department: ${preferredDepto}, clicking Aceptar`
    );
    aceptarBtn.click();
  }, 600);
}

// --- Búsqueda Page ---

function handleBusquedaPage(_doc: Document) {
  console.debug('[ProcuAsist] MEV search page detected');

  // Notify background that login was successful
  chrome.runtime.sendMessage({ type: 'LOGIN_SUCCESS', portal: 'mev' });

  // Check if there's a returnUrl to navigate back to
  const returnUrl = sessionStorage.getItem('procu_asist_return_url');
  if (returnUrl) {
    sessionStorage.removeItem('procu_asist_return_url');
    console.debug('[ProcuAsist] Navigating back to:', returnUrl);
    window.location.href = returnUrl;
  }
}

// --- Results Page ---

function handleResultsPage(doc: Document) {
  console.debug('[ProcuAsist] MEV results page detected');

  const results = parseSearchResults(doc);
  if (results.length > 0) {
    console.debug(`[ProcuAsist] Found ${results.length} cases in results`);
    // Send results to side panel for display
    chrome.runtime.sendMessage({
      type: 'SEARCH_RESULTS',
      results,
    });
  }
}

// --- Case Detail Page (procesales.asp) ---

function handleCasePage(doc: Document) {
  console.debug('[ProcuAsist] MEV case page detected');

  const caseData = parseCaseData(doc);
  if (!caseData) {
    console.warn('[ProcuAsist] Could not parse case data');
    return;
  }

  const movements = parseMovements(doc);
  console.debug(
    `[ProcuAsist] Case: ${caseData.numero} - ${caseData.caratula} (${movements.length} movements)`
  );

  // Send case data to background/sidepanel
  chrome.runtime.sendMessage({
    type: 'CASE_PAGE_DETECTED',
    caseData: {
      id: caseData.nidCausa,
      portal: 'mev' as const,
      caseNumber: caseData.numero,
      title: caseData.caratula,
      court: caseData.juzgado,
      fuero: '',
      portalUrl: window.location.href,
      metadata: {
        nidCausa: caseData.nidCausa,
        pidJuzgado: caseData.pidJuzgado,
        fechaInicio: caseData.fechaInicio,
        estadoPortal: caseData.estadoPortal,
        numeroReceptoria: caseData.numeroReceptoria,
      },
    },
  });

  // Inject action buttons (bookmark, monitor, PDF, ZIP)
  injectBookmarkButton(caseData);
  injectZipButton(caseData, movements);
}

// --- Proveido Page (Document View) ---

function handleProveidoPage(doc: Document) {
  console.debug('[ProcuAsist] MEV proveido page detected');

  const adjuntos = parseAdjuntos(doc);
  if (adjuntos.length > 0) {
    console.debug(`[ProcuAsist] Found ${adjuntos.length} adjuntos`);
  }
}

// --- Session Monitoring ---

function startSessionMonitor() {
  // Poll URL changes to detect session expiry redirect to login
  let lastUrl = window.location.href;

  const checkInterval = setInterval(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      if (currentUrl.toLowerCase().includes('loguin')) {
        clearInterval(checkInterval);
        handleSessionExpired();
      }
    }

    // Also check DOM for login form appearing (e.g., via redirect within same page)
    if (isLoginPage(document)) {
      clearInterval(checkInterval);
      handleSessionExpired();
    }
  }, 3000);

  // Also watch for DOM mutations that might indicate session expiry
  const observer = new MutationObserver(() => {
    if (isLoginPage(document)) {
      observer.disconnect();
      handleSessionExpired();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function handleSessionExpired() {
  console.debug('[ProcuAsist] MEV session expired detected');

  // Store current URL so we can return after re-login
  sessionStorage.setItem('procu_asist_return_url', window.location.href);

  chrome.runtime.sendMessage({
    type: 'SESSION_EXPIRED',
    portal: 'mev',
    returnUrl: window.location.href,
  });
}

// --- UI Injections ---

function injectBookmarkButton(caseData: {
  numero: string;
  caratula: string;
  juzgado: string;
  nidCausa: string;
  pidJuzgado: string;
  fechaInicio: string;
  estadoPortal: string;
  numeroReceptoria: string;
}) {
  if (document.getElementById('procu-asist-bookmark')) return;

  const container = document.createElement('div');
  container.id = 'procu-asist-bookmark';
  Object.assign(container.style, {
    position: 'fixed',
    bottom: '76px',
    right: '20px',
    zIndex: '999999',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '6px',
  });

  const btn = document.createElement('button');
  btn.title = `Guardar ${caseData.numero} en marcadores`;
  Object.assign(btn.style, {
    padding: '8px 16px',
    borderRadius: '24px',
    border: 'none',
    backgroundColor: MEV_COLORS.primary,
    color: 'white',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    transition: 'transform 0.2s, background-color 0.2s',
  });

  // Check if already bookmarked
  chrome.runtime
    .sendMessage({
      type: 'IS_BOOKMARKED',
      portal: 'mev',
      caseNumber: caseData.numero,
    })
    .then((r) => {
      const resp = r as { success: boolean; isBookmarked: boolean };
      if (resp?.success && resp.isBookmarked) {
        btn.innerHTML = iconLabel(ICON_CHECK, 'Guardado');
        btn.style.backgroundColor = SUCCESS_COLOR;
        btn.dataset.saved = 'true';
      } else {
        btn.innerHTML = iconLabel(ICON_STAR, 'Guardar');
      }
    });

  btn.addEventListener('click', async () => {
    if (btn.dataset.saved === 'true') return;

    btn.innerHTML = iconLabel(ICON_LOADER, '');
    btn.disabled = true;

    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'ADD_BOOKMARK',
        caseData: {
          id: caseData.nidCausa,
          portal: 'mev' as const,
          caseNumber: caseData.numero,
          title: caseData.caratula,
          court: caseData.juzgado,
          fuero: '',
          portalUrl: window.location.href,
          metadata: {
            nidCausa: caseData.nidCausa,
            pidJuzgado: caseData.pidJuzgado,
            fechaInicio: caseData.fechaInicio,
            estadoPortal: caseData.estadoPortal,
            numeroReceptoria: caseData.numeroReceptoria,
          },
        },
      })) as { success: boolean };

      if (response?.success) {
        btn.innerHTML = iconLabel(ICON_CHECK, 'Guardado');
        btn.style.backgroundColor = SUCCESS_COLOR;
        btn.dataset.saved = 'true';
      } else {
        btn.innerHTML = iconLabel(ICON_X, 'Error');
        btn.style.backgroundColor = DANGER_COLOR;
        setTimeout(() => {
          btn.innerHTML = iconLabel(ICON_STAR, 'Guardar');
          btn.style.backgroundColor = MEV_COLORS.primary;
          btn.disabled = false;
        }, 2000);
      }
    } catch {
      btn.innerHTML = iconLabel(ICON_X, 'Error');
      btn.style.backgroundColor = DANGER_COLOR;
      setTimeout(() => {
        btn.innerHTML = iconLabel(ICON_STAR, 'Guardar');
        btn.style.backgroundColor = MEV_COLORS.primary;
        btn.disabled = false;
      }, 2000);
    }
  });

  container.appendChild(btn);

  // Monitor button
  const monBtn = document.createElement('button');
  monBtn.title = `Monitorear ${caseData.numero}`;
  Object.assign(monBtn.style, {
    padding: '8px 16px',
    borderRadius: '24px',
    border: `1px solid ${MEV_COLORS.primary}`,
    backgroundColor: 'white',
    color: MEV_COLORS.primary,
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    transition: 'transform 0.2s, background-color 0.2s',
    marginTop: '8px',
  });

  // Check if already monitored
  chrome.runtime
    .sendMessage({
      type: 'IS_MONITORED',
      portal: 'mev',
      caseNumber: caseData.numero,
    })
    .then((r) => {
      const resp = r as { success: boolean; isMonitored: boolean };
      if (resp?.success && resp.isMonitored) {
        monBtn.innerHTML = iconLabel(ICON_EYE, 'Monitoreando');
        monBtn.style.backgroundColor = SUCCESS_COLOR;
        monBtn.style.color = 'white';
        monBtn.style.border = 'none';
        monBtn.dataset.monitored = 'true';
      } else {
        monBtn.innerHTML = iconLabel(ICON_EYE, 'Monitorear');
      }
    });

  monBtn.addEventListener('click', async () => {
    if (monBtn.dataset.monitored === 'true') return;

    monBtn.innerHTML = iconLabel(ICON_LOADER, '');
    monBtn.disabled = true;

    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'ADD_MONITOR',
        caseData: {
          id: caseData.nidCausa,
          portal: 'mev' as const,
          caseNumber: caseData.numero,
          title: caseData.caratula,
          court: caseData.juzgado,
          fuero: '',
          portalUrl: window.location.href,
          metadata: {
            nidCausa: caseData.nidCausa,
            pidJuzgado: caseData.pidJuzgado,
            fechaInicio: caseData.fechaInicio,
            estadoPortal: caseData.estadoPortal,
            numeroReceptoria: caseData.numeroReceptoria,
          },
        },
      })) as { success: boolean };

      if (response?.success) {
        monBtn.innerHTML = iconLabel(ICON_EYE, 'Monitoreando');
        monBtn.style.backgroundColor = SUCCESS_COLOR;
        monBtn.style.color = 'white';
        monBtn.style.border = 'none';
        monBtn.dataset.monitored = 'true';
      } else {
        monBtn.innerHTML = iconLabel(ICON_X, 'Error');
        monBtn.style.backgroundColor = DANGER_COLOR;
        monBtn.style.color = 'white';
        monBtn.style.border = 'none';
        setTimeout(() => {
          monBtn.innerHTML = iconLabel(ICON_EYE, 'Monitorear');
          monBtn.style.backgroundColor = 'white';
          monBtn.style.color = MEV_COLORS.primary;
          monBtn.style.border = `1px solid ${MEV_COLORS.primary}`;
          monBtn.disabled = false;
        }, 2000);
      }
    } catch {
      monBtn.innerHTML = iconLabel(ICON_X, 'Error');
      monBtn.style.backgroundColor = DANGER_COLOR;
      monBtn.style.color = 'white';
      monBtn.style.border = 'none';
      setTimeout(() => {
        monBtn.innerHTML = iconLabel(ICON_EYE, 'Monitorear');
        monBtn.style.backgroundColor = 'white';
        monBtn.style.color = MEV_COLORS.primary;
        monBtn.style.border = `1px solid ${MEV_COLORS.primary}`;
        monBtn.disabled = false;
      }, 2000);
    }
  });

  container.appendChild(monBtn);
  document.body.appendChild(container);
}

// --- Movement Selection Modal ---

function showMovementSelectionModal(movements: Movement[]): Promise<Movement[] | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', backgroundColor: 'rgba(0,0,0,0.5)',
      zIndex: '9999999', display: 'flex', alignItems: 'center', justifyContent: 'center',
    });

    const modal = document.createElement('div');
    Object.assign(modal.style, {
      backgroundColor: 'white', borderRadius: '12px', padding: '24px',
      maxWidth: '650px', width: '92%', maxHeight: '80vh', display: 'flex',
      flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    });

    // Title
    const title = document.createElement('h3');
    title.textContent = 'Seleccionar pasos procesales a descargar';
    Object.assign(title.style, {
      margin: '0 0 12px 0', color: '#1f2937', fontSize: '16px',
    });

    // Top buttons (select all / deselect all)
    const topBar = document.createElement('div');
    Object.assign(topBar.style, {
      display: 'flex', gap: '8px', marginBottom: '12px',
    });

    const selectAllBtn = document.createElement('button');
    selectAllBtn.textContent = 'Seleccionar todos';
    Object.assign(selectAllBtn.style, {
      padding: '4px 12px', borderRadius: '6px', border: '1px solid #d1d5db',
      backgroundColor: 'white', fontSize: '12px', cursor: 'pointer', color: '#374151',
    });

    const deselectAllBtn = document.createElement('button');
    deselectAllBtn.textContent = 'Deseleccionar todos';
    Object.assign(deselectAllBtn.style, {
      padding: '4px 12px', borderRadius: '6px', border: '1px solid #d1d5db',
      backgroundColor: 'white', fontSize: '12px', cursor: 'pointer', color: '#374151',
    });

    topBar.appendChild(selectAllBtn);
    topBar.appendChild(deselectAllBtn);

    // Scrollable list
    const list = document.createElement('div');
    Object.assign(list.style, {
      overflowY: 'auto', flex: '1', marginBottom: '12px', border: '1px solid #e5e7eb',
      borderRadius: '8px',
    });

    // Track checkboxes
    const checkboxes: HTMLInputElement[] = [];

    const updateDownloadBtn = () => {
      const count = checkboxes.filter((cb) => cb.checked).length;
      downloadBtn.textContent = `Descargar seleccionados (${count})`;
      downloadBtn.disabled = count === 0;
      downloadBtn.style.opacity = count === 0 ? '0.5' : '1';
    };

    for (let i = 0; i < movements.length; i++) {
      const mov = movements[i];
      const row = document.createElement('label');
      Object.assign(row.style, {
        display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px',
        borderBottom: i < movements.length - 1 ? '1px solid #f3f4f6' : 'none',
        cursor: 'pointer', fontSize: '12px', lineHeight: '1.4',
      });
      row.addEventListener('mouseenter', () => { row.style.backgroundColor = '#f9fafb'; });
      row.addEventListener('mouseleave', () => { row.style.backgroundColor = 'transparent'; });

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = true; // All selected by default
      cb.style.flexShrink = '0';
      cb.addEventListener('change', updateDownloadBtn);
      checkboxes.push(cb);

      const info = document.createElement('div');
      info.style.flex = '1';

      const dateSpan = document.createElement('span');
      dateSpan.textContent = mov.date;
      Object.assign(dateSpan.style, { fontWeight: '600', color: '#1f2937', marginRight: '8px' });

      const fojasSpan = document.createElement('span');
      fojasSpan.textContent = mov.fojas ? `fs ${mov.fojas}` : '';
      Object.assign(fojasSpan.style, { color: '#9ca3af', marginRight: '8px', fontSize: '11px' });

      const descSpan = document.createElement('span');
      descSpan.textContent = mov.description.length > 50 ? mov.description.substring(0, 50) + '...' : mov.description;
      Object.assign(descSpan.style, { color: '#374151' });

      info.appendChild(dateSpan);
      if (mov.fojas) info.appendChild(fojasSpan);
      info.appendChild(descSpan);

      // Firma badge
      if (mov.type === 'firmado') {
        const firmaBadge = document.createElement('span');
        firmaBadge.textContent = 'Firm.';
        Object.assign(firmaBadge.style, {
          color: '#16a34a', fontSize: '11px', fontWeight: '600',
          backgroundColor: '#f0fdf4', padding: '2px 6px', borderRadius: '4px', flexShrink: '0',
        });
        row.appendChild(cb);
        row.appendChild(info);
        row.appendChild(firmaBadge);
      } else {
        row.appendChild(cb);
        row.appendChild(info);
      }

      list.appendChild(row);
    }

    selectAllBtn.addEventListener('click', () => {
      checkboxes.forEach((cb) => { cb.checked = true; });
      updateDownloadBtn();
    });

    deselectAllBtn.addEventListener('click', () => {
      checkboxes.forEach((cb) => { cb.checked = false; });
      updateDownloadBtn();
    });

    // Bottom buttons
    const bottomBar = document.createElement('div');
    Object.assign(bottomBar.style, {
      display: 'flex', justifyContent: 'flex-end', gap: '8px',
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancelar';
    Object.assign(cancelBtn.style, {
      padding: '8px 20px', borderRadius: '8px', border: '1px solid #d1d5db',
      backgroundColor: 'white', color: '#374151', fontSize: '13px', cursor: 'pointer',
    });

    const downloadBtn = document.createElement('button');
    downloadBtn.textContent = `Descargar seleccionados (${movements.length})`;
    Object.assign(downloadBtn.style, {
      padding: '8px 20px', borderRadius: '8px', border: 'none',
      backgroundColor: '#7c3aed', color: 'white', fontSize: '13px',
      fontWeight: '600', cursor: 'pointer',
    });

    cancelBtn.addEventListener('click', () => {
      overlay.remove();
      resolve(null);
    });

    downloadBtn.addEventListener('click', () => {
      const selected = movements.filter((_, i) => checkboxes[i].checked);
      overlay.remove();
      resolve(selected);
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
        resolve(null);
      }
    });

    bottomBar.appendChild(cancelBtn);
    bottomBar.appendChild(downloadBtn);

    modal.appendChild(title);
    modal.appendChild(topBar);
    modal.appendChild(list);
    modal.appendChild(bottomBar);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  });
}

// --- ZIP Download Button ---

function injectZipButton(caseData: MevCaseData, movements: Movement[]) {
  if (document.getElementById('procu-asist-zip')) return;

  const btn = document.createElement('button');
  btn.id = 'procu-asist-zip';
  btn.innerHTML = iconLabel(ICON_PACKAGE, 'ZIP');
  btn.title = `Descargar expediente ${caseData.numero} como ZIP (resumen + adjuntos)`;
  Object.assign(btn.style, {
    position: 'fixed',
    bottom: '20px',
    right: '76px',
    padding: '8px 16px',
    borderRadius: '24px',
    border: 'none',
    backgroundColor: MEV_COLORS.primary,
    color: 'white',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    zIndex: '999999',
    transition: 'transform 0.2s, background-color 0.2s',
  });

  // Progress bar element (hidden by default)
  const progressBar = document.createElement('div');
  Object.assign(progressBar.style, {
    position: 'fixed',
    bottom: '56px',
    right: '20px',
    width: '280px',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    padding: '8px 12px',
    fontSize: '11px',
    zIndex: '999999',
    display: 'none',
    flexDirection: 'column',
    gap: '4px',
  });

  const progressLabel = document.createElement('span');
  progressLabel.style.color = '#374151';
  progressLabel.textContent = '';

  const progressTrack = document.createElement('div');
  Object.assign(progressTrack.style, {
    height: '6px',
    backgroundColor: '#e5e7eb',
    borderRadius: '3px',
    overflow: 'hidden',
  });

  const progressFill = document.createElement('div');
  Object.assign(progressFill.style, {
    height: '100%',
    backgroundColor: MEV_COLORS.primary,
    borderRadius: '3px',
    width: '0%',
    transition: 'width 0.3s',
  });

  progressTrack.appendChild(progressFill);
  progressBar.appendChild(progressLabel);
  progressBar.appendChild(progressTrack);
  document.body.appendChild(progressBar);

  btn.addEventListener('mouseenter', () => { btn.style.transform = 'scale(1.05)'; });
  btn.addEventListener('mouseleave', () => { btn.style.transform = 'scale(1)'; });

  btn.addEventListener('click', async () => {
    // Show selection modal first
    const selectedMovements = await showMovementSelectionModal(movements);
    if (!selectedMovements || selectedMovements.length === 0) return;

    btn.innerHTML = iconLabel(ICON_LOADER, 'Preparando...');
    btn.style.backgroundColor = '#9ca3af';
    btn.disabled = true;
    progressBar.style.display = 'flex';
    progressLabel.textContent = 'Iniciando...';
    progressFill.style.width = '5%';

    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'GENERATE_ZIP',
        caseData: {
          caseNumber: caseData.numero,
          title: caseData.caratula,
          court: caseData.juzgado,
          portal: 'mev',
          portalUrl: window.location.href,
          fechaInicio: caseData.fechaInicio,
          estadoPortal: caseData.estadoPortal,
          numeroReceptoria: caseData.numeroReceptoria,
          movements: selectedMovements.map((m) => ({
            date: m.date,
            fojas: m.fojas,
            description: m.description,
            type: m.type,
            hasDocuments: m.hasDocuments,
            documentUrls: m.documentUrls,
          })),
        },
      })) as {
        success: boolean;
        filename?: string;
        error?: string;
        stats?: {
          totalMovements: number;
          proveidosDownloaded: number;
          proveidosFailed: number;
          adjuntosDownloaded: number;
          adjuntosFailed: number;
          allSuccessful: boolean;
          failedItems: Array<{
            type: string;
            index: number;
            date: string;
            description: string;
            url: string;
            error: string;
          }>;
        };
      };

      if (response?.success) {
        const s = response.stats;
        const totalOk = (s?.proveidosDownloaded ?? 0) + (s?.adjuntosDownloaded ?? 0);
        const totalFailed = (s?.proveidosFailed ?? 0) + (s?.adjuntosFailed ?? 0);
        const summary = s
          ? `${totalOk} descargados${totalFailed > 0 ? `, ${totalFailed} fallaron` : ''}`
          : 'listo';
        btn.innerHTML = iconLabel(ICON_CHECK, `ZIP (${summary})`);
        btn.style.backgroundColor = s?.allSuccessful ? SUCCESS_COLOR : '#f59e0b';
        progressLabel.textContent = `Listo: ${summary}`;
        progressFill.style.width = '100%';

        // Show error overlay if there were failures
        if (s && !s.allSuccessful && s.failedItems.length > 0) {
          showVerificationOverlay(s.failedItems);
        }
      } else {
        btn.innerHTML = iconLabel(ICON_X, response?.error ?? 'Error');
        btn.style.backgroundColor = DANGER_COLOR;
        progressLabel.textContent = response?.error ?? 'Error';
        progressFill.style.backgroundColor = DANGER_COLOR;
        progressFill.style.width = '100%';
      }
    } catch (err) {
      btn.innerHTML = iconLabel(ICON_X, 'Error');
      btn.style.backgroundColor = DANGER_COLOR;
      progressLabel.textContent = String(err);
    }

    setTimeout(() => {
      btn.innerHTML = iconLabel(ICON_PACKAGE, 'ZIP');
      btn.style.backgroundColor = MEV_COLORS.primary;
      btn.disabled = false;
      progressBar.style.display = 'none';
    }, 5000);
  });

  document.body.appendChild(btn);
}

// --- Verification Error Overlay ---

function showVerificationOverlay(
  failedItems: Array<{ type: string; index: number; date: string; description: string; url: string; error: string }>
) {
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: '9999999', display: 'flex', alignItems: 'center', justifyContent: 'center',
  });

  const modal = document.createElement('div');
  Object.assign(modal.style, {
    backgroundColor: 'white', borderRadius: '12px', padding: '24px',
    maxWidth: '550px', width: '90%', maxHeight: '70vh', display: 'flex',
    flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
  });

  const title = document.createElement('h3');
  title.textContent = `Descarga con ${failedItems.length} error(es)`;
  Object.assign(title.style, {
    margin: '0 0 12px 0', color: '#dc2626', fontSize: '16px',
  });

  const subtitle = document.createElement('p');
  subtitle.textContent = 'El ZIP se genero pero algunos archivos no pudieron descargarse. Ver archivo _verificacion.txt dentro del ZIP para mas detalles.';
  Object.assign(subtitle.style, {
    margin: '0 0 12px 0', color: '#6b7280', fontSize: '13px',
  });

  const list = document.createElement('div');
  Object.assign(list.style, {
    overflowY: 'auto', flex: '1', marginBottom: '12px',
  });

  for (const item of failedItems) {
    const row = document.createElement('div');
    Object.assign(row.style, {
      padding: '8px', borderBottom: '1px solid #e5e7eb', fontSize: '12px',
    });
    const badge = item.type === 'proveido' ? 'DOC' : 'ADJ';
    row.innerHTML = `<strong style="color:#dc2626">[${badge}]</strong> Paso ${item.index} — ${item.date}<br>` +
      `<span style="color:#374151">${item.description}</span><br>` +
      `<span style="color:#9ca3af;font-size:11px">Error: ${item.error}</span>`;
    list.appendChild(row);
  }

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Cerrar';
  Object.assign(closeBtn.style, {
    padding: '8px 20px', borderRadius: '8px', border: 'none',
    backgroundColor: '#7c3aed', color: 'white', fontSize: '13px',
    fontWeight: '600', cursor: 'pointer', alignSelf: 'flex-end',
  });
  closeBtn.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  modal.appendChild(title);
  modal.appendChild(subtitle);
  modal.appendChild(list);
  modal.appendChild(closeBtn);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

// --- Dark Mode ---

function applyDarkModeIfEnabled() {
  chrome.storage.local.get('tl_settings', (result) => {
    const settings = result.tl_settings as Record<string, unknown> | undefined;
    if (settings?.darkMode) {
      // TODO Phase 7: Inject dark mode CSS for MEV
      console.debug('[ProcuAsist] Dark mode enabled (CSS injection pending)');
    }
  });
}
