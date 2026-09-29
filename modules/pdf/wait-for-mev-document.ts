import type { PageFetch } from './mev-download-runner';

/** Sondea sólo el documento abierto; read nunca debe hacer fetch ni recargar. */
export async function waitForMevDocument<T>(options: {
  read(): Promise<PageFetch<T> | null>;
  stopped(): boolean;
  now(): number;
  sleep(ms: number): Promise<void>;
  timeoutMs: number;
}): Promise<PageFetch<T>> {
  const start = options.now();
  while (!options.stopped() && options.now() - start < options.timeoutMs) {
    const page = await options.read();
    if (page === null) break;
    if (page.status === 'ok' || page.status === 'login') return page;
    await options.sleep(1000);
  }
  return { status: 'desafio', detail: 'La pestaña de recuperación no llegó a mostrar el documento' };
}
