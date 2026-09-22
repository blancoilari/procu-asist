/**
 * Session keep-alive heartbeats.
 * Sends periodic lightweight requests to judicial portals
 * to prevent session timeout (~20 min for MEV).
 */

import type { PortalId } from '@/modules/portals/types';
import { MEV_RAW_SAMPLE_LENGTH } from '@/modules/portals/mev-challenge';
import { heartbeatLooksLikeChallenge, type HeartbeatResult } from '@/modules/portals/mev-keepalive';
import { isMevDownloadActive } from './mev-download-job';
import { isMevKeepAliveOnHold, recordMevChallenge } from './mev-verification-state';

const PORTAL_TAB_PATTERNS: Record<PortalId, string> = {
  mev: 'https://mev.scba.gov.ar/*',
  pjn: 'https://scw.pjn.gov.ar/*',
};

const PORTAL_HEARTBEAT_URLS: Record<PortalId, string> = {
  mev: 'https://mev.scba.gov.ar/busqueda.asp',
  pjn: 'https://scw.pjn.gov.ar/scw/homePrivado.seam',
};

/** Tope de espera del pedido de la MEV, para no dejar el script colgado. */
const MEV_HEARTBEAT_TIMEOUT_MS = 20_000;

export async function keepAlive(portal: PortalId): Promise<void> {
  // Check if keep-alive is enabled for this portal
  const stored = await chrome.storage.local.get('tl_settings');
  const settings = stored.tl_settings as Record<string, unknown> | undefined;

  if (portal === 'mev' && settings?.keepAliveMev === false) return;
  if (portal === 'pjn' && settings?.keepAlivePjn === false) return;

  // Durante una descarga, sus propios pedidos mantienen viva la sesión y
  // cada pedido extra gasta cupo del límite de la MEV.
  if (portal === 'mev' && isMevDownloadActive()) return;

  // Con la MEV mostrando su pantalla de verificación, el pedido no mantiene
  // nada y alarga el castigo: se deja de pedir un rato (mev-keepalive.ts).
  if (portal === 'mev' && (await isMevKeepAliveOnHold())) {
    console.debug('[ProcuAsist] Keep-alive de la MEV suspendido por una verificación reciente');
    return;
  }

  // Find open tabs matching the portal
  const tabs = await chrome.tabs.query({ url: PORTAL_TAB_PATTERNS[portal] });

  if (tabs.length === 0) {
    // No portal tabs open, skip heartbeat
    return;
  }

  const tab = tabs[0];
  if (!tab.id) return;

  try {
    if (portal === 'mev') {
      await mevHeartbeat(tab.id);
      return;
    }

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

/**
 * El pedido de la MEV espera la respuesta para mirar si es la pantalla de
 * verificación: si lo es, se anota y el mantener sesión se suspende. Antes
 * era un pedido suelto que nadie miraba, y seguía saliendo cada 4 minutos
 * mientras la MEV frenaba.
 */
async function mevHeartbeat(tabId: number): Promise<void> {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: async (heartbeatUrl: string, sampleLength: number, timeoutMs: number) => {
      try {
        const resp = await fetch(heartbeatUrl, {
          method: 'GET',
          credentials: 'include',
          signal: AbortSignal.timeout(timeoutMs),
        });
        const text = await resp.text();
        return { status: resp.status, sample: text.slice(0, sampleLength) };
      } catch {
        return null;
      }
    },
    args: [PORTAL_HEARTBEAT_URLS.mev, MEV_RAW_SAMPLE_LENGTH, MEV_HEARTBEAT_TIMEOUT_MS],
  });

  const result = results[0]?.result as HeartbeatResult | null | undefined;
  if (heartbeatLooksLikeChallenge(result)) {
    await recordMevChallenge();
    console.warn(
      '[ProcuAsist] La MEV respondió al mantener sesión con su pantalla de verificación; ' +
        'no se le vuelve a pedir por un rato'
    );
    return;
  }
  console.debug('[ProcuAsist] Keep-alive sent for mev');
}
