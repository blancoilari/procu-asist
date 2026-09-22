/**
 * Última vez que la MEV mostró su pantalla de verificación, vista por
 * cualquier camino de la extensión (mantener sesión, descarga, monitoreo).
 * Vive en chrome.storage.session: sobrevive a que Chrome duerma el service
 * worker y se borra al cerrar el navegador. La usa el mantener sesión para
 * no pedirle nada a la MEV mientras está frenando (ver mev-keepalive.ts).
 */

import { shouldSkipMevKeepAlive } from '@/modules/portals/mev-keepalive';

const LAST_CHALLENGE_KEY = 'procu_mev_verificacion_vista';

/** Anota que la MEV respondió con la pantalla de verificación. */
export async function recordMevChallenge(at: number = Date.now()): Promise<void> {
  try {
    await chrome.storage.session.set({ [LAST_CHALLENGE_KEY]: at });
  } catch (err) {
    console.warn('[ProcuAsist] No se pudo anotar la verificación de la MEV:', err);
  }
}

/** ¿El mantener sesión de la MEV está suspendido por una verificación reciente? */
export async function isMevKeepAliveOnHold(now: number = Date.now()): Promise<boolean> {
  try {
    const stored = await chrome.storage.session.get(LAST_CHALLENGE_KEY);
    return shouldSkipMevKeepAlive(stored[LAST_CHALLENGE_KEY] as number | undefined, now);
  } catch {
    return false;
  }
}
