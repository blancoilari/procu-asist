/**
 * Content script for EJE/JUSCABA (Poder Judicial de la Ciudad Autónoma de Buenos Aires)
 * https://eje.jus.gov.ar/* and https://sso.pjn.gov.ar/*
 *
 * Handles:
 * - Keycloak SSO auto-login (sso.pjn.gov.ar) — shared con PJN: detecta portal desde redirect_uri
 * - SPA page detection (Angular app)
 * - Case card extraction from search results
 * - API interception for actuaciones data
 * - Session monitoring (401 detection)
 * - Rocket button + bookmark/monitor injection
 */

import { EJE_SELECTORS, EJE_PATTERNS, EJE_API_BASE } from '@/modules/portals/eje-selectors';
import {
  isKeycloakLoginPage,
  isEjeSpa,
  isSearchPage,
  parseResultCards,
  parseActuacionesTable,
  parseActuacionesApi,
  parseCaseHeaderApi,
} from '@/modules/portals/eje-parser';
import type { EjeCaseData, EjeActuacion, EjeActuacionesResponse, EjeEncabezadoResponse } from '@/modules/portals/eje-parser';
import type { PortalId } from '@/modules/portals/types';

export default defineContentScript({
  matches: ['https://eje.jus.gov.ar/*', 'https://sso.pjn.gov.ar/*'],
  registration: 'manifest',
  runAt: 'document_idle',

  main() {
    console.debug('[ProcuAsist] EJE content script loaded on:', window.location.hostname);

    const doc = document;

    if (isKeycloakLoginPage(doc)) {
      handleKeycloakLogin(doc);
    } else if (isEjeSpa(doc)) {
      handleEjeSpa(doc);
    }

    applyDarkModeIfEnabled();
  },
});

// ────────────────────────────────────────────────────────
// Keycloak SSO Login (sso.pjn.gov.ar)
// Compartido entre JUSCABA y PJN — detecta cuál portal usar
// mirando el redirect_uri del query string.
// ────────────────────────────────────────────────────────

function detectPortalFromKeycloakUrl(): PortalId {
  const redirectUri = new URL(window.location.href).searchParams.get('redirect_uri');
  if (!redirectUri) return 'eje';
  try {
    const host = new URL(redirectUri).hostname;
    if (host.endsWith('.jus.gov.ar')) return 'eje';
    if (host.endsWith('.pjn.gov.ar') || host.endsWith('.csjn.gov.ar')) return 'pjn';
  } catch {
    // malformed redirect_uri — caer al default
  }
  return 'eje';
}

async function handleKeycloakLogin(doc: Document) {
  const portal = detectPortalFromKeycloakUrl();
  console.debug(`[ProcuAsist] Keycloak login page detected (portal=${portal})`);

  const response = await chrome.runtime.sendMessage({
    type: 'GET_CREDENTIALS',
    portal,
  });

  if (!response?.success || !response.credentials) {
    console.debug(
      `[ProcuAsist] No ${portal.toUpperCase()} credentials available for auto-login (reason=${response?.reason ?? 'unknown'})`
    );
    return;
  }

  const { username, password } = response.credentials;

  const usernameInput = doc.querySelector('#username') as HTMLInputElement | null;
  const passwordInput = doc.querySelector('#password') as HTMLInputElement | null;

  if (!usernameInput || !passwordInput) {
    console.warn('[ProcuAsist] Keycloak login fields not found');
    return;
  }

  // Fill credentials
  usernameInput.value = username;
  usernameInput.dispatchEvent(new Event('input', { bubbles: true }));
  passwordInput.value = password;
  passwordInput.dispatchEvent(new Event('input', { bubbles: true }));

  // Submit after short delay. Keycloak themes vary (JUSCABA usa el theme
  // estándar con #kc-login; PJN tiene theme custom). Probamos cascada.
  setTimeout(() => {
    const form = usernameInput.closest('form') as HTMLFormElement | null;

    const standardBtn = doc.querySelector('#kc-login') as HTMLElement | null;
    if (standardBtn) {
      console.debug('[ProcuAsist] Submitting Keycloak login via #kc-login');
      standardBtn.click();
      return;
    }

    const formSubmit = form?.querySelector(
      'button[type="submit"], input[type="submit"]'
    ) as HTMLElement | null;
    if (formSubmit) {
      console.debug('[ProcuAsist] Submitting Keycloak login via form submit button');
      formSubmit.click();
      return;
    }

    if (form) {
      console.debug('[ProcuAsist] Submitting Keycloak login via form.requestSubmit()');
      if (typeof form.requestSubmit === 'function') {
        form.requestSubmit();
      } else {
        form.submit();
      }
      return;
    }

    console.warn('[ProcuAsist] No pude encontrar forma de enviar el formulario de Keycloak');
  }, 600);
}

// ────────────────────────────────────────────────────────
// EJE Angular SPA Handler
// ────────────────────────────────────────────────────────

function handleEjeSpa(doc: Document) {
  console.debug('[ProcuAsist] EJE SPA detected');

  // Notify login success
  chrome.runtime.sendMessage({ type: 'LOGIN_SUCCESS', portal: 'eje' });

  // Inject rocket button
  injectRocketButton();

  // Start session monitoring
  startSessionMonitor();

  // Intercept API calls for case data
  interceptApiCalls();

  // Watch for SPA navigation (Angular route changes)
  watchSpaNavigation(doc);

  // Check if we're already on the search page
  if (isSearchPage()) {
    // Wait for Angular to render cards
    waitForElement(EJE_SELECTORS.results.card, () => {
      handleSearchResults(doc);
    });
  }
}

// ────────────────────────────────────────────────────────
// Search Results Page
// ────────────────────────────────────────────────────────

function handleSearchResults(doc: Document) {
  console.debug('[ProcuAsist] EJE search results detected');

  const cases = parseResultCards(doc);
  if (cases.length > 0) {
    console.debug(`[ProcuAsist] Found ${cases.length} EJE cases`);

    // Send to background for sidepanel display
    chrome.runtime.sendMessage({
      type: 'SEARCH_RESULTS',
      results: cases.map((c) => ({
        nidCausa: c.expId,
        pidJuzgado: '',
        caratula: c.caratula,
        numero: c.cuij || c.numero,
        url: window.location.href,
      })),
    });
  }

  // Inject bookmark buttons on each card
  injectCardButtons(doc, cases);
}

/**
 * Inject bookmark/monitor buttons on each case card.
 */
function injectCardButtons(doc: Document, cases: EjeCaseData[]) {
  const cards = doc.querySelectorAll(EJE_SELECTORS.results.card);

  cards.forEach((card, idx) => {
    if (card.querySelector('.procu-asist-card-actions')) return;
    const caseData = cases[idx];
    if (!caseData) return;

    const container = document.createElement('div');
    container.className = 'procu-asist-card-actions';
    Object.assign(container.style, {
      display: 'flex',
      gap: '4px',
      padding: '4px 8px',
      borderTop: '1px solid #e5e7eb',
    });

    // Bookmark button
    const bookmarkBtn = createActionButton('⭐', 'Guardar');
    bookmarkBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      bookmarkBtn.textContent = '⏳';

      const resp = (await chrome.runtime.sendMessage({
        type: 'ADD_BOOKMARK',
        caseData: {
          id: caseData.expId || caseData.cuij,
          portal: 'eje' as const,
          caseNumber: caseData.cuij || caseData.numero,
          title: caseData.caratula,
          court: caseData.tribunal,
          fuero: '',
          portalUrl: window.location.href,
          metadata: {
            nidCausa: caseData.expId,
          },
        },
      })) as { success: boolean };

      bookmarkBtn.textContent = resp?.success ? '✅' : '❌';
    });

    // Monitor button
    const monitorBtn = createActionButton('👁', 'Monitorear');
    monitorBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      monitorBtn.textContent = '⏳';

      const resp = (await chrome.runtime.sendMessage({
        type: 'ADD_MONITOR',
        caseData: {
          id: caseData.expId || caseData.cuij,
          portal: 'eje' as const,
          caseNumber: caseData.cuij || caseData.numero,
          title: caseData.caratula,
          court: caseData.tribunal,
          fuero: '',
          portalUrl: window.location.href,
          metadata: {
            nidCausa: caseData.expId,
          },
        },
      })) as { success: boolean };

      monitorBtn.textContent = resp?.success ? '✅' : '❌';
    });

    container.appendChild(bookmarkBtn);
    container.appendChild(monitorBtn);

    // Append to card footer area
    const footer = card.querySelector('iol-expediente-tarjeta-pie') ?? card;
    footer.appendChild(container);
  });
}

function createActionButton(emoji: string, label: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.textContent = `${emoji} ${label}`;
  Object.assign(btn.style, {
    padding: '3px 10px',
    borderRadius: '12px',
    border: '1px solid #d1d5db',
    backgroundColor: 'white',
    fontSize: '11px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  });
  btn.addEventListener('mouseenter', () => {
    btn.style.backgroundColor = '#f3f4f6';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.backgroundColor = 'white';
  });
  return btn;
}

// ────────────────────────────────────────────────────────
// API Interception
// ────────────────────────────────────────────────────────

/**
 * Intercept XHR/fetch calls to the EJE API to capture case data.
 * This lets us get structured data without parsing the DOM.
 */
function interceptApiCalls() {
  // Intercept fetch
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);

    try {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url ?? '';

      // Intercept case header responses
      if (url.includes('/expedientes/encabezado')) {
        const clone = response.clone();
        clone.json().then((data: EjeEncabezadoResponse) => {
          const expIdMatch = url.match(EJE_PATTERNS.expId);
          const expId = expIdMatch?.[1] ?? '';
          const caseData = parseCaseHeaderApi(data, expId);
          console.debug('[ProcuAsist] EJE case header intercepted:', caseData.cuij);

          // Send to background
          chrome.runtime.sendMessage({
            type: 'CASE_PAGE_DETECTED',
            caseData: {
              id: expId,
              portal: 'eje' as const,
              caseNumber: caseData.cuij || caseData.numero,
              title: caseData.caratula,
              court: caseData.tribunal,
              fuero: '',
              portalUrl: window.location.href,
              metadata: {
                nidCausa: expId,
              },
            },
          });
        }).catch(() => {});
      }

      // Intercept actuaciones responses
      if (url.includes('/expedientes/actuaciones') && !url.includes('idEstadoActuacion')) {
        const clone = response.clone();
        clone.json().then((data: EjeActuacionesResponse) => {
          const actuaciones = parseActuacionesApi(data);
          console.debug(`[ProcuAsist] EJE actuaciones intercepted: ${actuaciones.length} items`);
        }).catch(() => {});
      }
    } catch {
      // Silently ignore interception errors
    }

    return response;
  };
}

// ────────────────────────────────────────────────────────
// Session Monitoring
// ────────────────────────────────────────────────────────

function startSessionMonitor() {
  // EJE is an SPA — intercept fetch 401 responses
  const originalFetch = window.fetch;
  const wrappedFetch = window.fetch;

  // Only wrap if not already wrapped by interceptApiCalls
  if (wrappedFetch === originalFetch) return;

  // The fetch interceptor in interceptApiCalls already handles this implicitly
  // But we also add a dedicated 401 check
  const sessionCheckFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await sessionCheckFetch.apply(this, args);

    if (response.status === 401 || response.status === 403) {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url ?? '';
      // Only trigger for API calls, not all requests
      if (url.includes('/iol-api/') || url.includes('/api/')) {
        console.debug('[ProcuAsist] EJE session expired (401/403)');
        chrome.runtime.sendMessage({
          type: 'SESSION_EXPIRED',
          portal: 'eje',
          returnUrl: window.location.href,
        });
      }
    }

    return response;
  };
}

// ────────────────────────────────────────────────────────
// SPA Navigation Watcher
// ────────────────────────────────────────────────────────

function watchSpaNavigation(doc: Document) {
  let lastPath = window.location.pathname + window.location.search;

  // Angular uses pushState for navigation
  const originalPushState = history.pushState;
  history.pushState = function (...args) {
    originalPushState.apply(this, args);
    checkRouteChange();
  };

  const originalReplaceState = history.replaceState;
  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    checkRouteChange();
  };

  window.addEventListener('popstate', checkRouteChange);

  function checkRouteChange() {
    const currentPath = window.location.pathname + window.location.search;
    if (currentPath !== lastPath) {
      lastPath = currentPath;
      console.debug('[ProcuAsist] EJE route changed:', currentPath);

      if (isSearchPage()) {
        // Wait for Angular to render new content
        waitForElement(EJE_SELECTORS.results.card, () => {
          handleSearchResults(doc);
        });
      }
    }
  }
}

// ────────────────────────────────────────────────────────
// UI Injections
// ────────────────────────────────────────────────────────

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

// ────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────

/**
 * Wait for an element to appear in the DOM (useful for Angular rendering).
 */
function waitForElement(
  selector: string,
  callback: () => void,
  timeoutMs = 10000
) {
  const existing = document.querySelector(selector);
  if (existing) {
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

  // Timeout safety
  setTimeout(() => {
    observer.disconnect();
  }, timeoutMs);
}

function applyDarkModeIfEnabled() {
  chrome.storage.local.get('tl_settings', (result) => {
    const settings = result.tl_settings as Record<string, unknown> | undefined;
    if (settings?.darkMode) {
      console.debug('[ProcuAsist] Dark mode enabled (EJE CSS injection pending)');
    }
  });
}
