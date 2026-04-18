/**
 * Content script para PJN (Poder Judicial de la Nación).
 *
 * M1 scope — solo verificación de sesión. Los milestones posteriores van a
 * agregar parsing (M3-M4), descarga (M5-M6) y sincronización de favoritos (M7).
 *
 * Matches:
 * - portalpjn.pjn.gov.ar → landing SPA del portal nuevo
 * - scw.pjn.gov.ar → Sistema de Consultas Web (placeholder para M3+)
 *
 * El auto-login contra Keycloak vive en eje.content.ts (compartido vía
 * detectPortalFromKeycloakUrl).
 */

export default defineContentScript({
  matches: [
    'https://portalpjn.pjn.gov.ar/*',
    'https://scw.pjn.gov.ar/*',
  ],
  registration: 'manifest',
  runAt: 'document_idle',

  main() {
    console.debug('[ProcuAsist] PJN content script loaded on:', window.location.hostname);

    if (window.location.hostname === 'portalpjn.pjn.gov.ar') {
      chrome.runtime.sendMessage({ type: 'LOGIN_SUCCESS', portal: 'pjn' });
    }
  },
});
