/**
 * Auto-reconnection logic.
 * When a session expires, automatically re-authenticates
 * and navigates the user back to their previous page.
 */

import type { PortalId } from '@/modules/portals/types';
import { isUnlocked } from '@/modules/crypto/key-manager';
import { getCredentials } from '@/modules/storage/credential-store';

/** Pending reconnection requests (portal -> returnUrl) */
const pendingReconnects = new Map<
  string,
  { returnUrl: string; tabId: number }
>();

export async function handleSessionExpired(
  portal: PortalId,
  returnUrl: string,
  tabId: number
): Promise<void> {
  console.debug(
    `[ProcuAsist] Auto-reconnect initiated for ${portal}, return URL: ${returnUrl}`
  );

  // Check if auto-reconnect is enabled
  const stored = await chrome.storage.local.get('tl_settings');
  const settings = stored.tl_settings as Record<string, unknown> | undefined;
  if (settings?.autoReconnect === false) {
    sendExpiryNotification(portal);
    return;
  }

  // Check if vault is unlocked (PIN was entered this session)
  if (!isUnlocked()) {
    console.debug(
      '[ProcuAsist] Vault is locked — skipping auto-reconnect silently.'
    );
    // Don't throw, don't notify — the session monitor will retry later
    return;
  }

  // Get credentials
  try {
    const creds = await getCredentials(portal);
    if (!creds) {
      console.debug(
        `[ProcuAsist] No credentials saved for ${portal}. Notifying user.`
      );
      sendExpiryNotification(portal);
      return;
    }

    // Store the returnUrl so the content script can navigate back after re-login
    // The content script handles the actual form filling via GET_CREDENTIALS message
    // The returnUrl is stored in sessionStorage by the content script itself
    pendingReconnects.set(portal, { returnUrl, tabId });

    console.debug(
      `[ProcuAsist] Credentials available for ${portal}, content script will handle re-login`
    );
  } catch (err) {
    console.error(`[ProcuAsist] Auto-reconnect error for ${portal}:`, err);
    sendExpiryNotification(portal);
  }
}

function sendExpiryNotification(portal: PortalId) {
  chrome.notifications.create(`session-expired-${portal}-${Date.now()}`, {
    type: 'basic',
    iconUrl: '/icon/128.png',
    title: 'ProcuAsist - Sesión Expirada',
    message: `Tu sesión en ${portal.toUpperCase()} ha expirado. Ingresá tu PIN para reconectar automáticamente.`,
  });
}

/** Get pending reconnect info for a portal */
export function getPendingReconnect(
  portal: PortalId
): { returnUrl: string; tabId: number } | undefined {
  return pendingReconnects.get(portal);
}

/** Clear pending reconnect after successful login */
export function clearPendingReconnect(portal: PortalId): void {
  pendingReconnects.delete(portal);
}
