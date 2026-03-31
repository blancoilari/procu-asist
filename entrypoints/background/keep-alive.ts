/**
 * Session keep-alive heartbeats.
 * Sends periodic lightweight requests to judicial portals
 * to prevent session timeout (~20 min for MEV).
 */

import type { PortalId } from '@/modules/portals/types';

const PORTAL_TAB_PATTERNS: Record<PortalId, string> = {
  mev: 'https://mev.scba.gov.ar/*',
  pjn: 'https://eje.jus.gov.ar/*',
};

const PORTAL_HEARTBEAT_URLS: Record<PortalId, string> = {
  mev: 'https://mev.scba.gov.ar/busqueda.asp',
  pjn: 'https://eje.jus.gov.ar/iol-api/session',
};

export async function keepAlive(portal: PortalId): Promise<void> {
  // Check if keep-alive is enabled for this portal
  const stored = await chrome.storage.local.get('tl_settings');
  const settings = stored.tl_settings as Record<string, unknown> | undefined;

  if (portal === 'mev' && settings?.keepAliveMev === false) return;
  if (portal === 'pjn' && settings?.keepAlivePjn === false) return;

  // Find open tabs matching the portal
  const tabs = await chrome.tabs.query({ url: PORTAL_TAB_PATTERNS[portal] });

  if (tabs.length === 0) {
    // No portal tabs open, skip heartbeat
    return;
  }

  const tab = tabs[0];
  if (!tab.id) return;

  try {
    // Inject a lightweight fetch into the portal page context
    // This uses the page's session cookies
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: (heartbeatUrl: string) => {
        fetch(heartbeatUrl, {
          method: 'GET',
          credentials: 'include',
        }).catch(() => {
          // Silently ignore fetch errors for heartbeat
        });
      },
      args: [PORTAL_HEARTBEAT_URLS[portal]],
    });

    console.debug(`[ProcuAsist] Keep-alive sent for ${portal}`);
  } catch (err) {
    console.warn(`[ProcuAsist] Keep-alive failed for ${portal}:`, err);
  }
}
