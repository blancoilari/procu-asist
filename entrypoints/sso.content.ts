/**
 * Content script para el SSO Keycloak del Poder Judicial de la Nación
 * (https://sso.pjn.gov.ar/*).
 *
 * Única responsabilidad: auto-login contra Keycloak con las credenciales PJN
 * guardadas, con freno de reintentos para no bloquear la cuenta.
 *
 * Hasta la 0.8.0 esta lógica vivía en `eje.content.ts` y se compartía con el
 * portal EJE/JusCABA. Retirado ese portal en la 0.8.1, queda solo el camino
 * PJN.
 */

import { PJN_SSO } from '@/modules/portals/pjn-selectors';

export default defineContentScript({
  matches: ['https://sso.pjn.gov.ar/*'],
  registration: 'manifest',
  runAt: 'document_idle',

  main() {
    const doc = document;
    if (!isKeycloakLoginPage(doc)) return;
    console.debug('[ProcuAsist] SSO content script cargado en', window.location.hostname);
    void handleKeycloakLogin(doc);
  },
});

/** ¿Estamos parados en la página de login de Keycloak? */
export function isKeycloakLoginPage(doc: Document): boolean {
  return (
    !!doc.querySelector(PJN_SSO.loginFormId) ||
    window.location.hostname === 'sso.pjn.gov.ar'
  );
}

const KC_ATTEMPTS_KEY = 'procu_asist_kc_login_attempts';
const KC_MAX_AUTO_LOGIN_ATTEMPTS = 2;
const KC_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;

/**
 * Freno de reintentos del auto-login. Con credenciales guardadas incorrectas
 * el ciclo se repetiría solo (submit, Keycloak vuelve a renderizar el login
 * con error, el script corre de nuevo, submit) contra sso.pjn.gov.ar, con
 * riesgo de bloqueo de la cuenta.
 */
function canAttemptKeycloakLogin(): boolean {
  try {
    const raw = sessionStorage.getItem(KC_ATTEMPTS_KEY);
    if (!raw) return true;
    const data = JSON.parse(raw) as { count: number; firstAt: number };
    if (Date.now() - data.firstAt > KC_ATTEMPT_WINDOW_MS) return true;
    return data.count < KC_MAX_AUTO_LOGIN_ATTEMPTS;
  } catch {
    return true;
  }
}

function recordKeycloakLoginAttempt(): void {
  try {
    const now = Date.now();
    const raw = sessionStorage.getItem(KC_ATTEMPTS_KEY);
    let data = { count: 0, firstAt: now };
    if (raw) {
      const parsed = JSON.parse(raw) as { count: number; firstAt: number };
      if (now - parsed.firstAt <= KC_ATTEMPT_WINDOW_MS) data = parsed;
    }
    data.count += 1;
    sessionStorage.setItem(KC_ATTEMPTS_KEY, JSON.stringify(data));
  } catch {
    // sessionStorage no disponible: no hay nada que registrar
  }
}

async function handleKeycloakLogin(doc: Document) {
  console.debug('[ProcuAsist] Página de login de Keycloak detectada (portal=pjn)');

  // Después de un intento fallido Keycloak re-renderiza el login con un
  // mensaje de error: reintentar las mismas credenciales guardadas haría ciclo.
  const loginError = doc.querySelector(
    '#input-error, .kc-feedback-text, .alert-error, .pf-c-alert__title'
  );
  if (loginError?.textContent?.trim()) {
    console.warn(
      `[ProcuAsist] Keycloak muestra un error de login ("${loginError.textContent.trim().slice(0, 80)}"): no se intenta el auto-login`
    );
    return;
  }

  if (!canAttemptKeycloakLogin()) {
    console.warn(
      '[ProcuAsist] Límite de intentos de auto-login de Keycloak alcanzado, entrá a mano'
    );
    return;
  }

  const response = await chrome.runtime.sendMessage({
    type: 'GET_CREDENTIALS',
    portal: 'pjn',
  });

  if (!response?.success || !response.credentials) {
    console.debug(
      `[ProcuAsist] No hay credenciales PJN disponibles para el auto-login (reason=${response?.reason ?? 'unknown'})`
    );
    return;
  }

  const { username, password } = response.credentials;

  const usernameInput = doc.querySelector(PJN_SSO.usernameField) as HTMLInputElement | null;
  const passwordInput = doc.querySelector(PJN_SSO.passwordField) as HTMLInputElement | null;

  if (!usernameInput || !passwordInput) {
    console.warn('[ProcuAsist] No aparecen los campos de login de Keycloak');
    return;
  }

  usernameInput.value = username;
  usernameInput.dispatchEvent(new Event('input', { bubbles: true }));
  passwordInput.value = password;
  passwordInput.dispatchEvent(new Event('input', { bubbles: true }));

  // Envío con demora corta. Los themes de Keycloak varían (PJN tiene theme
  // propio), así que se prueba en cascada.
  setTimeout(() => {
    recordKeycloakLoginAttempt();
    const form = usernameInput.closest('form') as HTMLFormElement | null;

    const standardBtn = doc.querySelector(PJN_SSO.submitButton) as HTMLElement | null;
    if (standardBtn) {
      console.debug('[ProcuAsist] Enviando el login de Keycloak por #kc-login');
      standardBtn.click();
      return;
    }

    const formSubmit = form?.querySelector(
      'button[type="submit"], input[type="submit"]'
    ) as HTMLElement | null;
    if (formSubmit) {
      console.debug('[ProcuAsist] Enviando el login de Keycloak por el botón submit del form');
      formSubmit.click();
      return;
    }

    if (form) {
      console.debug('[ProcuAsist] Enviando el login de Keycloak por form.requestSubmit()');
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
