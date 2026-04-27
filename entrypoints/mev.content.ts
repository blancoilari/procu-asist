/**
 * Content script for MEV (Mesa de Entradas Virtual)
 * https://mev.scba.gov.ar/*
 *
 * Handles: auto-login, post-login department selection, session monitoring,
 * case data extraction, and dark mode.
 */

import { MEV_SELECTORS } from '@/modules/portals/mev-selectors';
import type { Movement } from '@/modules/portals/types';
import type { MevCaseData, MevSearchResult } from '@/modules/portals/mev-parser';
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
  ICON_DOWNLOAD,
} from '@/modules/ui/icon-strings';
import {
  createConfigActionButton,
  createPortalActionBar,
  createPortalActionButton,
  createPortalModalButton,
  setPortalActionButtonState,
} from '@/modules/ui/portal-action-bar';

const MEV_COLORS = PORTAL_COLORS.mev;
const MEV_ACTION_BAR_ID = 'procu-asist-action-bar';
const MEV_CONFIG_ID = 'procu-asist-config';
const MEV_SET_IMPORT_SESSION_KEY = 'procu_asist_mev_set_import';
const DANGER_COLOR = '#dc2626';

interface MevSetImportSession {
  collected: MevSearchResult[];
  remainingValues: string[];
  startedAt: number;
  totalOrganisms: number;
}

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
    injectResultsImportButton(results);
    void continueSetImportIfActive(results);
  }
}

function injectResultsImportButton(results: MevSearchResult[]) {
  if (document.getElementById('procu-asist-import-results')) return;

  const bar = ensureMevActionBar();
  const setSelect = findSetOrganismSelect();
  const isSetPage = !!setSelect && getSetOptionValues(setSelect).length > 1;
  const btn = createPortalActionButton({
    id: 'procu-asist-import-results',
    icon: ICON_DOWNLOAD,
    label: isSetPage ? 'Importar set' : 'Importar',
    title: isSetPage
      ? 'Importar y monitorear todas las causas del set'
      : `Importar y monitorear ${results.length} causas visibles`,
    variant: 'secondary',
  });

  btn.addEventListener('click', async () => {
    if (await startSetImportIfPossible(results, btn)) return;

    setPortalActionButtonState(btn, ICON_LOADER, 'Importando', 'muted');
    btn.disabled = true;

    try {
      const response = await bulkImportMevResults(results);

      setPortalActionButtonState(
        btn,
        ICON_CHECK,
        `Importadas ${response.imported}`,
        'success'
      );
      btn.title = `${response.imported} nuevas, ${response.existing} existentes, ${response.monitored} monitoreadas`;
    } catch (err) {
      console.error('[ProcuAsist] MEV results import error:', err);
      setPortalActionButtonState(btn, ICON_X, 'Error', 'danger');
    }

    setTimeout(() => {
      setPortalActionButtonState(btn, ICON_DOWNLOAD, 'Importar', 'secondary');
      btn.disabled = false;
    }, 5000);
  });

  const configBtn = document.getElementById(MEV_CONFIG_ID);
  if (configBtn?.nextSibling) {
    bar.insertBefore(btn, configBtn.nextSibling);
  } else {
    bar.appendChild(btn);
  }
}

async function startSetImportIfPossible(
  results: MevSearchResult[],
  btn: HTMLButtonElement
): Promise<boolean> {
  const select = findSetOrganismSelect();
  if (!select) return false;

  const options = getSetOptionValues(select);
  if (options.length <= 1) return false;

  const currentValue = select.value;
  const remainingValues = options
    .map((option) => option.value)
    .filter((value) => value !== currentValue);

  const session: MevSetImportSession = {
    collected: results,
    remainingValues,
    startedAt: Date.now(),
    totalOrganisms: options.length,
  };

  sessionStorage.setItem(MEV_SET_IMPORT_SESSION_KEY, JSON.stringify(session));

  setPortalActionButtonState(btn, ICON_LOADER, 'Set 1/' + options.length, 'muted');
  btn.disabled = true;

  if (!goToNextSetOrganism(session)) {
    sessionStorage.removeItem(MEV_SET_IMPORT_SESSION_KEY);
    const response = await bulkImportMevResults(results);
    setPortalActionButtonState(btn, ICON_CHECK, `Importadas ${response.imported}`, 'success');
    btn.title = `${response.imported} nuevas, ${response.existing} existentes, ${response.monitored} monitoreadas`;
  }

  return true;
}

async function continueSetImportIfActive(results: MevSearchResult[]) {
  const session = readSetImportSession();
  if (!session) return;

  session.collected = mergeMevSearchResults(session.collected, results);

  const currentStep = session.totalOrganisms - session.remainingValues.length;
  showSetImportStatus(
    `Importando set completo (${currentStep}/${session.totalOrganisms})...`
  );

  if (session.remainingValues.length > 0) {
    sessionStorage.setItem(MEV_SET_IMPORT_SESSION_KEY, JSON.stringify(session));
    setTimeout(() => {
      const latestSession = readSetImportSession();
      if (latestSession) goToNextSetOrganism(latestSession);
    }, 450);
    return;
  }

  sessionStorage.removeItem(MEV_SET_IMPORT_SESSION_KEY);
  const response = await bulkImportMevResults(session.collected);
  showSetImportStatus(
    `Set importado: ${response.imported} nuevas, ${response.existing} existentes, ${response.monitored} monitoreadas.`,
    'success'
  );
}

function readSetImportSession(): MevSetImportSession | null {
  const raw = sessionStorage.getItem(MEV_SET_IMPORT_SESSION_KEY);
  if (!raw) return null;

  try {
    const session = JSON.parse(raw) as MevSetImportSession;
    if (!Array.isArray(session.collected) || !Array.isArray(session.remainingValues)) {
      return null;
    }
    if (Date.now() - session.startedAt > 10 * 60 * 1000) {
      sessionStorage.removeItem(MEV_SET_IMPORT_SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    sessionStorage.removeItem(MEV_SET_IMPORT_SESSION_KEY);
    return null;
  }
}

function goToNextSetOrganism(session: MevSetImportSession): boolean {
  const nextValue = session.remainingValues.shift();
  if (!nextValue) return false;

  const select = findSetOrganismSelect();
  if (!select) return false;

  select.value = nextValue;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  sessionStorage.setItem(MEV_SET_IMPORT_SESSION_KEY, JSON.stringify(session));

  const consultar = Array.from(
    document.querySelectorAll('input, button')
  ).find((el) => {
    const input = el as HTMLInputElement | HTMLButtonElement;
    return /consultar/i.test(input.value || input.textContent || '');
  }) as HTMLInputElement | HTMLButtonElement | undefined;

  if (consultar) {
    consultar.click();
    return true;
  }

  const form = select.form || select.closest('form');
  if (form) {
    form.requestSubmit?.();
    if (!form.requestSubmit) form.submit();
    return true;
  }

  return false;
}

function findSetOrganismSelect(): HTMLSelectElement | null {
  const selects = Array.from(document.querySelectorAll('select')) as HTMLSelectElement[];
  if (!selects.length) return null;

  const setText = document.body.textContent ?? '';
  if (!/Set de B[uú]squeda|Organismos del Set/i.test(setText)) return null;

  return (
    selects.find((select) => {
      const parentText = select.parentElement?.textContent ?? '';
      return /Organismos del Set/i.test(parentText);
    }) ?? selects[0] ?? null
  );
}

function getSetOptionValues(select: HTMLSelectElement): Array<{ value: string; label: string }> {
  return Array.from(select.options)
    .map((option) => ({
      value: option.value,
      label: option.textContent?.trim() ?? option.value,
    }))
    .filter((option) => option.value);
}

function mergeMevSearchResults(
  previous: MevSearchResult[],
  next: MevSearchResult[]
): MevSearchResult[] {
  const map = new Map<string, MevSearchResult>();
  for (const result of [...previous, ...next]) {
    const key = result.nidCausa || result.numero || result.url;
    if (!key) continue;
    map.set(key, result);
  }
  return Array.from(map.values());
}

async function bulkImportMevResults(results: MevSearchResult[]) {
  return (await chrome.runtime.sendMessage({
    type: 'BULK_IMPORT',
    source: 'mev-results',
    monitor: true,
    cases: results.map((result) => ({
      id: result.nidCausa || result.numero,
      portal: 'mev' as const,
      caseNumber: result.numero || result.nidCausa,
      title: result.caratula || 'Sin caratula',
      court: '',
      fuero: '',
      portalUrl: result.url,
      lastMovementDate: result.ultimoMovimiento,
      metadata: {
        nidCausa: result.nidCausa,
        pidJuzgado: result.pidJuzgado,
      },
    })),
  })) as {
    status: string;
    imported: number;
    existing: number;
    monitored: number;
  };
}

function showSetImportStatus(message: string, variant: 'muted' | 'success' = 'muted') {
  const bar = ensureMevActionBar();
  let status = document.getElementById('procu-asist-set-import-status');
  if (!status) {
    status = document.createElement('div');
    status.id = 'procu-asist-set-import-status';
    Object.assign(status.style, {
      borderRadius: '10px',
      padding: '10px 14px',
      fontSize: '12px',
      fontWeight: '700',
      boxShadow: '0 10px 24px rgba(15, 23, 42, 0.16)',
      textAlign: 'center',
      maxWidth: '220px',
    });
    bar.prepend(status);
  }

  status.textContent = message;
  Object.assign(status.style, {
    backgroundColor: variant === 'success' ? '#16a34a' : '#eff6ff',
    color: variant === 'success' ? '#ffffff' : MEV_COLORS.primary,
    border: variant === 'success' ? '1px solid #16a34a' : '1px solid #bfdbfe',
  });

  if (variant === 'success') {
    setTimeout(() => status?.remove(), 8000);
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

function ensureMevActionBar(): HTMLDivElement {
  const bar = createPortalActionBar(MEV_ACTION_BAR_ID);
  if (!document.getElementById(MEV_CONFIG_ID)) {
    const configBtn = createConfigActionButton();
    configBtn.id = MEV_CONFIG_ID;
    bar.prepend(configBtn);
  }
  return bar;
}

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
  const bar = ensureMevActionBar();
  if (document.getElementById('procu-asist-bookmark')) return;

  const btn = createPortalActionButton({
    id: 'procu-asist-bookmark',
    icon: ICON_STAR,
    label: 'Guardar',
    title: `Guardar ${caseData.numero} en marcadores`,
    variant: 'secondary',
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
        setPortalActionButtonState(btn, ICON_CHECK, 'Guardado', 'success');
        btn.dataset.saved = 'true';
      }
    });

  btn.addEventListener('click', async () => {
    if (btn.dataset.saved === 'true') return;

    setPortalActionButtonState(btn, ICON_LOADER, 'Guardando', 'muted');
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
        setPortalActionButtonState(btn, ICON_CHECK, 'Guardado', 'success');
        btn.dataset.saved = 'true';
      } else {
        setPortalActionButtonState(btn, ICON_X, 'Error', 'danger');
        setTimeout(() => {
          setPortalActionButtonState(btn, ICON_STAR, 'Guardar', 'secondary');
          btn.disabled = false;
        }, 2000);
      }
    } catch {
      setPortalActionButtonState(btn, ICON_X, 'Error', 'danger');
      setTimeout(() => {
        setPortalActionButtonState(btn, ICON_STAR, 'Guardar', 'secondary');
        btn.disabled = false;
      }, 2000);
    }
  });

  bar.appendChild(btn);

  // Monitor button
  const monBtn = createPortalActionButton({
    id: 'procu-asist-monitor',
    icon: ICON_EYE,
    label: 'Monitorear',
    title: `Monitorear ${caseData.numero}`,
    variant: 'secondary',
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
        setPortalActionButtonState(monBtn, ICON_EYE, 'Monitoreando', 'success');
        monBtn.dataset.monitored = 'true';
      }
    });

  monBtn.addEventListener('click', async () => {
    if (monBtn.dataset.monitored === 'true') return;

    setPortalActionButtonState(monBtn, ICON_LOADER, 'Activando', 'muted');
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
        setPortalActionButtonState(monBtn, ICON_EYE, 'Monitoreando', 'success');
        monBtn.dataset.monitored = 'true';
      } else {
        setPortalActionButtonState(monBtn, ICON_X, 'Error', 'danger');
        setTimeout(() => {
          setPortalActionButtonState(monBtn, ICON_EYE, 'Monitorear', 'secondary');
          monBtn.disabled = false;
        }, 2000);
      }
    } catch {
      setPortalActionButtonState(monBtn, ICON_X, 'Error', 'danger');
      setTimeout(() => {
        setPortalActionButtonState(monBtn, ICON_EYE, 'Monitorear', 'secondary');
        monBtn.disabled = false;
      }, 2000);
    }
  });

  bar.appendChild(monBtn);
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

    const selectAllBtn = createPortalModalButton({
      label: 'Seleccionar todos',
      variant: 'secondary',
    });

    const deselectAllBtn = createPortalModalButton({
      label: 'Deseleccionar todos',
      variant: 'secondary',
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

    const cancelBtn = createPortalModalButton({
      label: 'Cancelar',
      variant: 'secondary',
    });

    const downloadBtn = createPortalModalButton({
      label: `Descargar seleccionados (${movements.length})`,
      variant: 'primary',
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

  const bar = ensureMevActionBar();
  const btn = createPortalActionButton({
    id: 'procu-asist-zip',
    icon: ICON_PACKAGE,
    label: 'ZIP',
    title: `Descargar expediente ${caseData.numero} como ZIP (resumen + adjuntos)`,
    variant: 'primary',
  });

  // Progress bar element (hidden by default)
  const progressBar = document.createElement('div');
  Object.assign(progressBar.style, {
    position: 'fixed',
    bottom: '20px',
    right: '188px',
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

  btn.addEventListener('click', async () => {
    // Show selection modal first
    const selectedMovements = await showMovementSelectionModal(movements);
    if (!selectedMovements || selectedMovements.length === 0) return;

    setPortalActionButtonState(btn, ICON_LOADER, 'Preparando', 'muted');
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
        setPortalActionButtonState(
          btn,
          ICON_CHECK,
          'ZIP listo',
          s?.allSuccessful ? 'success' : 'warning'
        );
        progressLabel.textContent = `Listo: ${summary}`;
        progressFill.style.width = '100%';

        // Show error overlay if there were failures
        if (s && !s.allSuccessful && s.failedItems.length > 0) {
          showVerificationOverlay(s.failedItems);
        }
      } else {
        setPortalActionButtonState(btn, ICON_X, 'Error', 'danger');
        progressLabel.textContent = response?.error ?? 'Error';
        progressFill.style.backgroundColor = DANGER_COLOR;
        progressFill.style.width = '100%';
      }
    } catch (err) {
      setPortalActionButtonState(btn, ICON_X, 'Error', 'danger');
      progressLabel.textContent = String(err);
    }

    setTimeout(() => {
      setPortalActionButtonState(btn, ICON_PACKAGE, 'ZIP', 'primary');
      btn.disabled = false;
      progressBar.style.display = 'none';
    }, 5000);
  });

  const configBtn = document.getElementById(MEV_CONFIG_ID);
  if (configBtn?.nextSibling) {
    bar.insertBefore(btn, configBtn.nextSibling);
  } else {
    bar.prepend(btn);
  }
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
