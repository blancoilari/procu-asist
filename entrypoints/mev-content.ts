/**
 * Content script for MEV (Mesa de Entradas Virtual)
 * https://mev.scba.gov.ar/*
 *
 * Handles: auto-login, post-login department selection, session monitoring,
 * case data extraction, rocket button injection, and dark mode.
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

export default defineContentScript({
  matches: ['https://mev.scba.gov.ar/*'],
  runAt: 'document_idle',

  main() {
    console.debug('[ProcuAsist] MEV content script loaded');
    const doc = document;

    if (isLoginPage(doc)) {
      handleLoginPage(doc);
    } else if (isPosLoginPage(doc)) {
      handlePosLoginPage(doc);
    } else {
      // Inject rocket button on all non-login pages
      injectRocketButton();

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

  // Select preferred department
  deptoSelect.value = preferredDepto;

  // Auto-click Aceptar after short delay
  setTimeout(() => {
    console.debug(
      `[ProcuAsist] Selecting department: ${preferredDepto}, clicking Aceptar`
    );
    aceptarBtn.click();
  }, 500);
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

  // Inject action buttons (bookmark, monitor, PDF)
  injectBookmarkButton(caseData);
  injectPdfButton(caseData, movements);
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

function injectRocketButton() {
  if (document.getElementById('procu-asist-rocket')) return;

  const btn = document.createElement('button');
  btn.id = 'procu-asist-rocket';
  btn.innerHTML = '🚀';
  btn.title = 'Abrir ProcuAsist';
  Object.assign(btn.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: '#2563eb',
    color: 'white',
    fontSize: '24px',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    zIndex: '999999',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.2s',
  });
  btn.addEventListener('mouseenter', () => {
    btn.style.transform = 'scale(1.1)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.transform = 'scale(1)';
  });
  btn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_SIDEPANEL' });
  });
  document.body.appendChild(btn);
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
    backgroundColor: '#2563eb',
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
        btn.innerHTML = '✅ Guardado';
        btn.style.backgroundColor = '#16a34a';
        btn.dataset.saved = 'true';
      } else {
        btn.innerHTML = '⭐ Guardar';
      }
    });

  btn.addEventListener('click', async () => {
    if (btn.dataset.saved === 'true') return;

    btn.innerHTML = '⏳...';
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
        btn.innerHTML = '✅ Guardado';
        btn.style.backgroundColor = '#16a34a';
        btn.dataset.saved = 'true';
      } else {
        btn.innerHTML = '❌ Error';
        setTimeout(() => {
          btn.innerHTML = '⭐ Guardar';
          btn.disabled = false;
        }, 2000);
      }
    } catch {
      btn.innerHTML = '❌ Error';
      setTimeout(() => {
        btn.innerHTML = '⭐ Guardar';
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
    border: 'none',
    backgroundColor: '#7c3aed',
    color: 'white',
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
        monBtn.innerHTML = '👁 Monitoreando';
        monBtn.style.backgroundColor = '#16a34a';
        monBtn.dataset.monitored = 'true';
      } else {
        monBtn.innerHTML = '👁 Monitorear';
      }
    });

  monBtn.addEventListener('click', async () => {
    if (monBtn.dataset.monitored === 'true') return;

    monBtn.innerHTML = '⏳...';
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
        monBtn.innerHTML = '👁 Monitoreando';
        monBtn.style.backgroundColor = '#16a34a';
        monBtn.dataset.monitored = 'true';
      } else {
        monBtn.innerHTML = '❌ Error';
        setTimeout(() => {
          monBtn.innerHTML = '👁 Monitorear';
          monBtn.disabled = false;
        }, 2000);
      }
    } catch {
      monBtn.innerHTML = '❌ Error';
      setTimeout(() => {
        monBtn.innerHTML = '👁 Monitorear';
        monBtn.disabled = false;
      }, 2000);
    }
  });

  container.appendChild(monBtn);
  document.body.appendChild(container);
}

// --- PDF Download Button ---

function injectPdfButton(caseData: MevCaseData, movements: Movement[]) {
  if (document.getElementById('procu-asist-pdf')) return;

  const btn = document.createElement('button');
  btn.id = 'procu-asist-pdf';
  btn.innerHTML = '📄 PDF';
  btn.title = `Descargar expediente ${caseData.numero} como PDF`;
  Object.assign(btn.style, {
    position: 'fixed',
    bottom: '20px',
    right: '76px',
    padding: '8px 16px',
    borderRadius: '24px',
    border: 'none',
    backgroundColor: '#dc2626',
    color: 'white',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    zIndex: '999999',
    transition: 'transform 0.2s, background-color 0.2s',
  });

  btn.addEventListener('mouseenter', () => {
    btn.style.transform = 'scale(1.05)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.transform = 'scale(1)';
  });

  btn.addEventListener('click', async () => {
    btn.innerHTML = '⏳ Generando...';
    btn.style.backgroundColor = '#9ca3af';
    btn.disabled = true;

    try {
      // Collect adjuntos from proveido links
      const adjuntos: Array<{ name: string; url: string; movementDate?: string }> = [];
      for (const mov of movements) {
        if (mov.hasDocuments && mov.documentUrls.length > 0) {
          for (const url of mov.documentUrls) {
            adjuntos.push({
              name: `Proveido ${mov.date}`,
              url,
              movementDate: mov.date,
            });
          }
        }
      }

      const response = (await chrome.runtime.sendMessage({
        type: 'GENERATE_PDF',
        caseData: {
          caseNumber: caseData.numero,
          title: caseData.caratula,
          court: caseData.juzgado,
          portal: 'mev',
          portalUrl: window.location.href,
          fechaInicio: caseData.fechaInicio,
          estadoPortal: caseData.estadoPortal,
          numeroReceptoria: caseData.numeroReceptoria,
          movements: movements.map((m) => ({
            date: m.date,
            description: m.description,
            type: m.type,
            hasDocuments: m.hasDocuments,
            documentUrls: m.documentUrls,
          })),
          attachments: adjuntos.length > 0 ? adjuntos : undefined,
        },
      })) as { success: boolean; filename?: string; error?: string };

      if (response?.success) {
        btn.innerHTML = '✅ Descargado';
        btn.style.backgroundColor = '#16a34a';
        setTimeout(() => {
          btn.innerHTML = '📄 PDF';
          btn.style.backgroundColor = '#dc2626';
          btn.disabled = false;
        }, 3000);
      } else {
        btn.innerHTML = `❌ ${response?.error ?? 'Error'}`;
        btn.style.backgroundColor = '#dc2626';
        setTimeout(() => {
          btn.innerHTML = '📄 PDF';
          btn.disabled = false;
        }, 3000);
      }
    } catch {
      btn.innerHTML = '❌ Error';
      setTimeout(() => {
        btn.innerHTML = '📄 PDF';
        btn.style.backgroundColor = '#dc2626';
        btn.disabled = false;
      }, 3000);
    }
  });

  document.body.appendChild(btn);
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
