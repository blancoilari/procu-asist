/**
 * Store for the PJN API bearer token.
 *
 * The portalpjn SPA uses keycloak-js with default in-memory token storage (no
 * localStorage). We can't read the token directly, so the background service
 * worker captures it from outgoing `Authorization: Bearer` headers via
 * chrome.webRequest when the user is on portalpjn and the SPA makes API calls.
 *
 * The snapshot is kept in memory and mirrored to chrome.storage.session so it
 * survives MV3 service-worker restarts (~30s idle). storage.session is
 * memory-backed — it never touches disk and is cleared when the browser
 * closes — and is only visible to trusted extension contexts.
 */

type TokenSnapshot = {
  bearer: string;
  capturedAt: number;
};

const SESSION_STORAGE_KEY = 'tl_pjn_token';

let current: TokenSnapshot | null = null;

export function setToken(bearer: string): void {
  if (!bearer || bearer.length < 10) return;
  current = { bearer, capturedAt: Date.now() };
  // Mirror to session storage (fire-and-forget) so a restarted service
  // worker can keep using a still-valid token.
  void chrome.storage.session
    .set({ [SESSION_STORAGE_KEY]: current })
    .catch(() => {});
}

export function getToken(): TokenSnapshot | null {
  return current;
}

/**
 * Like {@link getToken}, but falls back to the session-storage mirror when
 * the in-memory copy was lost to a service-worker restart.
 */
export async function restoreToken(): Promise<TokenSnapshot | null> {
  if (current) return current;
  try {
    const stored = await chrome.storage.session.get(SESSION_STORAGE_KEY);
    const snapshot = stored[SESSION_STORAGE_KEY] as TokenSnapshot | undefined;
    if (snapshot?.bearer) current = snapshot;
  } catch {
    // session storage unavailable — keep returning null
  }
  return current;
}

export function clearToken(): void {
  current = null;
  void chrome.storage.session.remove(SESSION_STORAGE_KEY).catch(() => {});
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
