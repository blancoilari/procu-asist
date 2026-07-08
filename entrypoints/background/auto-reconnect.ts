/**
 * Auto-reconnection logic.
 * When a session expires, automatically re-authenticates
 * and navigates the user back to their previous page.
 */

import type { PortalId } from '@/modules/portals/types';
import { getCredentials } from '@/modules/storage/credential-store';

export async function handleSessionExpired(
  portal: PortalId,
  returnUrl: string,
  _tabId: number
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

  try {
    const creds = await getCredentials(portal);
    if (!creds) {
      console.debug(
        `[ProcuAsist] No credentials saved for ${portal}. Notifying user.`
      );
      sendExpiryNotification(portal);
      return;
    }

    // The content script handles the actual form filling via GET_CREDENTIALS;
    // the returnUrl is stored in sessionStorage by the content script itself.
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
    message: `Tu sesión en ${portal.toUpperCase()} expiró. Guardá tus credenciales en Ajustes de ProcuAsist para que la reconexión sea automática.`,
  });
}
