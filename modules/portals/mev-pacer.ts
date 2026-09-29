/**
 * Portero de los pedidos de la descarga a la MEV.
 *
 * Medido el 22/09/2026 contra el portal: la MEV deja pasar unos 30 pedidos
 * de proveídos por minuto. Pasado ese número contesta a todo con su
 * pantalla de verificación y, si se sigue pidiendo, el bloqueo no se
 * levanta y cada vez dura más. El portero espacia los pedidos para no
 * reducir la presión (10 por minuto deja margen para lo que el usuario
 * navegue en la MEV al mismo tiempo) y define cuánto se espera cuando igual
 * aparece un bloqueo.
 *
 * Módulo puro: el reloj y la espera se inyectan, así se prueba en node.
 */

/** Pedidos por minuto que se permite la descarga (prioridad a la fiabilidad, 28/09/2026). */
export const MEV_MAX_REQUESTS_PER_MINUTE = 10;

/** Separación mínima entre el inicio de dos pedidos. */
export const MEV_MIN_INTERVAL_MS = Math.ceil(60_000 / MEV_MAX_REQUESTS_PER_MINUTE);

/** Esperas ante un bloqueo, en orden; la última se repite. */
export const MEV_BLOCK_WAITS_MS: readonly number[] = [30_000, 60_000, 120_000, 240_000];

/** Espera que corresponde según cuántos bloqueos seguidos hubo antes (0 = el primero). */
export function blockWaitMs(previousConsecutiveBlocks: number): number {
  const last = MEV_BLOCK_WAITS_MS.length - 1;
  const index = Math.min(Math.max(previousConsecutiveBlocks, 0), last);
  return MEV_BLOCK_WAITS_MS[index];
}

export interface PacerClock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

export interface MevPacer {
  /**
   * Resuelve cuando se puede iniciar el próximo pedido. Los llamados
   * concurrentes hacen fila: nunca salen dos pedidos juntos.
   */
  wait(): Promise<void>;
}

export function createMevPacer(
  clock: PacerClock,
  minIntervalMs: number = MEV_MIN_INTERVAL_MS
): MevPacer {
  let lastStart = Number.NEGATIVE_INFINITY;
  let queue: Promise<void> = Promise.resolve();
  return {
    wait() {
      const turn = queue.then(async () => {
        const remaining = lastStart + minIntervalMs - clock.now();
        if (remaining > 0) await clock.sleep(remaining);
        lastStart = clock.now();
      });
      queue = turn.catch(() => undefined);
      return turn;
    },
  };
}

/** Reloj real, para el service worker. */
export const realClock: PacerClock = {
  now: () => performance.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};
