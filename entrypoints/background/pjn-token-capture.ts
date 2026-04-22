/**
 * Captures the PJN API bearer token from outgoing requests to api.pjn.gov.ar.
 *
 * The portalpjn SPA keeps the access token in memory (keycloak-js default).
 * Whenever it calls the API, it sends `Authorization: Bearer {JWT}`. We listen
 * with chrome.webRequest, extract the header, and stash it in the in-memory
 * token store so the background can reuse it for its own requests.
 *
 * Requires `webRequest` permission and a host permission matching the URL.
 */

import { setToken } from '@/modules/portals/pjn-token-store';

const API_URL_PATTERN = 'https://api.pjn.gov.ar/*';

export function setupPjnTokenCapture(): void {
  if (!chrome.webRequest?.onBeforeSendHeaders) {
    console.warn('[ProcuAsist PJN] webRequest.onBeforeSendHeaders no disponible');
    return;
  }

  chrome.webRequest.onBeforeSendHeaders.addListener(
    (details): undefined => {
      const headers = details.requestHeaders;
      if (!headers) return undefined;

      for (const header of headers) {
        if (header.name.toLowerCase() !== 'authorization') continue;
        const value = header.value;
        if (!value || !value.toLowerCase().startsWith('bearer ')) continue;
        setToken(value);
        return undefined;
      }
      return undefined;
    },
    { urls: [API_URL_PATTERN] },
    ['requestHeaders', 'extraHeaders']
  );

  console.debug('[ProcuAsist PJN] Token capture listener registered');
}
