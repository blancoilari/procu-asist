/**
 * In-memory store for the PJN API bearer token.
 *
 * The portalpjn SPA uses keycloak-js with default in-memory token storage (no
 * localStorage). We can't read the token directly, so the background service
 * worker captures it from outgoing `Authorization: Bearer` headers via
 * chrome.webRequest when the user is on portalpjn and the SPA makes API calls.
 *
 * This module is a singleton; import and use directly from the background.
 * It lives in memory only — the token is sensitive and must not be persisted.
 */

type TokenSnapshot = {
  bearer: string;
  capturedAt: number;
};

let current: TokenSnapshot | null = null;

export function setToken(bearer: string): void {
  if (!bearer || bearer.length < 10) return;
  current = { bearer, capturedAt: Date.now() };
}

export function getToken(): TokenSnapshot | null {
  return current;
}

export function clearToken(): void {
  current = null;
}

/**
 * Age of the last captured token in milliseconds, or `null` if no token.
 * Useful for telling if the token is likely expired (Keycloak access tokens
 * are typically 5 min TTL — after 10 min without a refresh it's probably dead).
 */
export function getTokenAgeMs(): number | null {
  if (!current) return null;
  return Date.now() - current.capturedAt;
}
