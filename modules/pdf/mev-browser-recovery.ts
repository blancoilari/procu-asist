import { waitForMevDocument } from './wait-for-mev-document';
import { fetchMevPageContent, toAbsoluteMevUrl, type ProveidoPageData } from './attachment-downloader';
import type { PageFetch, StopRequest } from './mev-download-runner';

/** Una navegación normal, sin resolver ni manipular el verificador. */
export async function recoverMevDocument(
  url: string,
  shouldStop: () => StopRequest,
  onStatus: (message: string) => void,
): Promise<PageFetch<ProveidoPageData>> {
  const fullUrl = toAbsoluteMevUrl(url);
  if (new URL(fullUrl).origin !== 'https://mev.scba.gov.ar') {
    return { status: 'error', detail: 'La recuperación sólo admite documentos de la MEV' };
  }
  onStatus('La MEV está validando el acceso en una pestaña de recuperación. Esperando el documento...');
  const tab = await chrome.tabs.create({ url: fullUrl, active: true });
  if (tab.id === undefined) return { status: 'error', detail: 'No se pudo abrir la pestaña de recuperación' };
  let success = false;
  try {
    const result = await waitForMevDocument<ProveidoPageData>({
      read: async () => {
        const current = await chrome.tabs.get(tab.id!).catch(() => null);
        if (!current) return null;
        if (current.status === 'complete' && current.url?.startsWith('https://mev.scba.gov.ar/')) {
          return fetchMevPageContent(tab.id!, fullUrl, true);
        }
        return { status: 'desafio', detail: 'Esperando la navegación' };
      },
      stopped: () => !!shouldStop(),
      now: () => performance.now(),
      sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
      timeoutMs: 180_000,
    });
    success = result.status === 'ok';
    return result;
  } finally {
    // Si hace falta intervención, se conserva la pestaña para el usuario.
    if (success || shouldStop()) await chrome.tabs.remove(tab.id).catch(() => undefined);
    onStatus(success ? 'Acceso recuperado. Continuando la descarga...' : 'La recuperación no terminó; se conserva el avance.');
  }
}
