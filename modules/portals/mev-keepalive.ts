/**
 * Mantener sesión frente a la verificación de la MEV (22/09/2026).
 *
 * El mantener sesión le pide busqueda.asp a la MEV cada 4 minutos mientras
 * haya una pestaña de la MEV abierta. Con la MEV mostrando su pantalla de
 * verificación ese pedido no mantiene nada (la sesión no se puede usar) y
 * suma pedidos contra un portal que ya está frenando: medido el 22/09, el
 * castigo crece si los pedidos siguen, y ese día el bloqueo duró más de dos
 * horas con pestañas de la MEV abiertas. Desde que alguien ve la pantalla
 * (el propio mantener sesión, la descarga o el monitoreo), el mantener
 * sesión deja de pedir durante MEV_KEEPALIVE_BACKOFF_MS.
 *
 * Módulo puro: sin chrome.*, para probarlo con node --test.
 */

import { htmlLooksLikeChallenge } from './mev-challenge.ts';

/** Lapso sin pedidos del mantener sesión desde la última pantalla vista. */
export const MEV_KEEPALIVE_BACKOFF_MS = 30 * 60_000;

/** Estados HTTP con los que la MEV (o su frente) corta por exceso de pedidos. */
const RATE_LIMIT_STATUSES: readonly number[] = [429, 503];

/**
 * ¿Hay que saltear el mantener sesión de la MEV? Sí, mientras no haya pasado
 * el lapso desde la última pantalla de verificación vista. Una marca que no
 * es un número o que quedó en el futuro (reloj corrido) no suspende nada:
 * mejor un pedido de más que un mantener sesión apagado para siempre.
 */
export function shouldSkipMevKeepAlive(
  lastChallengeAt: number | undefined,
  now: number,
  backoffMs: number = MEV_KEEPALIVE_BACKOFF_MS
): boolean {
  if (typeof lastChallengeAt !== 'number' || !Number.isFinite(lastChallengeAt)) return false;
  const elapsed = now - lastChallengeAt;
  return elapsed >= 0 && elapsed < backoffMs;
}

/** Lo que devuelve el pedido del mantener sesión: estado y comienzo del HTML. */
export interface HeartbeatResult {
  status: number;
  sample: string;
}

/** ¿La respuesta del mantener sesión es la pantalla de verificación? */
export function heartbeatLooksLikeChallenge(result: HeartbeatResult | null | undefined): boolean {
  if (!result) return false;
  if (RATE_LIMIT_STATUSES.includes(result.status)) return true;
  return htmlLooksLikeChallenge(result.sample ?? '');
}
