/**
 * Content script para PJN (Poder Judicial de la Nación).
 *
 * M1: confirma sesión desde portalpjn.pjn.gov.ar (LOGIN_SUCCESS).
 * M3: parsea listados de scw.pjn.gov.ar (Relacionados / Favoritos) y muestra
 *     un panel flotante de verificación. Sin UI de descarga todavía — eso
 *     llega en M5-M8.
 *
 * El auto-login contra Keycloak vive en eje.content.ts (compartido vía
 * detectPortalFromKeycloakUrl).
 */

import {
  isScwListadoPage,
  parseScwList,
} from '@/modules/portals/pjn-parser';
import { renderDebugPanel } from '@/modules/portals/pjn-debug-panel';

export default defineContentScript({
  matches: [
    'https://portalpjn.pjn.gov.ar/*',
    'https://scw.pjn.gov.ar/*',
  ],
  registration: 'manifest',
  runAt: 'document_idle',

  main() {
    console.debug('[ProcuAsist PJN] content script loaded on:', window.location.hostname);

    if (window.location.hostname === 'portalpjn.pjn.gov.ar') {
      chrome.runtime.sendMessage({ type: 'LOGIN_SUCCESS', portal: 'pjn' });
      return;
    }

    if (window.location.hostname === 'scw.pjn.gov.ar') {
      initScwDebug();
    }
  },
});

function initScwDebug(): void {
  const url = new URL(window.location.href);
  if (!isScwListadoPage(url.pathname)) return;

  let debounce: number | undefined;
  let lastSignature = '';

  const parseAndRender = () => {
    const result = parseScwList(document, url);
    // Dedupe: SCW has constantly-ticking DOM (analytics, timers) that
    // retriggers the observer. Only log/render on real content change.
    const signature =
      result.mode +
      '|' +
      result.rows.length +
      '|' +
      result.rows
        .map((r) => r.expediente + ':' + r.ultimaActualizacion + ':' + r.isFavorito)
        .join(';');
    if (signature === lastSignature) return;
    lastSignature = signature;

    console.groupCollapsed(
      `%c[ProcuAsist PJN] ${result.mode} — ${result.rows.length} causas parseadas`,
      'color: #2a5d9f; font-weight: bold;'
    );
    console.table(result.rows);
    if (result.unresolvedHeaders.length) {
      console.warn('Headers sin mapear:', result.unresolvedHeaders);
    }
    if (!result.rows.length) {
      console.warn('Sin filas. Headers detectados:', result.headerTexts);
    }
    console.groupEnd();
    renderDebugPanel(result);
  };

  parseAndRender();

  // SCW uses JSF AJAX postbacks for pagination/filters. Re-parse when the
  // body subtree changes, debounced + deduped.
  const mo = new MutationObserver(() => {
    window.clearTimeout(debounce);
    debounce = window.setTimeout(parseAndRender, 300);
  });
  mo.observe(document.body, { childList: true, subtree: true });
}
