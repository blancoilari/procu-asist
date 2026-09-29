import type { AttachmentFetch, StopRequest } from './mev-download-runner';

/** El fetch vive en una página de extensión, no en el service worker. */
export async function downloadLongAttachment(url: string, shouldStop: () => StopRequest = () => null): Promise<AttachmentFetch> {
  if (new URL(url).origin !== 'https://docs.scba.gov.ar') {
    return { status: 'error', detail: 'Servidor de adjuntos no permitido' };
  }
  const token = crypto.randomUUID();
  const pageUrl = chrome.runtime.getURL('attachment-worker.html');
  let tabId: number | undefined;
  let port: chrome.runtime.Port | undefined;
  let finish!: (result: AttachmentFetch) => void;
  const result = new Promise<AttachmentFetch>(resolve => { finish = resolve; });
  const listener = (candidate: chrome.runtime.Port) => {
    if (candidate.name !== token || candidate.sender?.url !== `${pageUrl}#${token}`) return;
    port = candidate;
    const chunks: string[] = [];
    candidate.onMessage.addListener((message: AttachmentFetch | { type: 'chunk'; data: string }) => {
      if ('type' in message && message.type === 'chunk') { chunks.push(message.data); return; }
      if ('status' in message) {
        finish(message.status === 'ok' ? { ...message, base64: chunks.join('') || message.base64 } : message);
      }
    });
    candidate.onDisconnect.addListener(() => finish({ status: 'error', detail: 'Se cerró la pestaña del adjunto' }));
    candidate.postMessage({ url });
  };
  chrome.runtime.onConnect.addListener(listener);
  const timer = setTimeout(() => finish({ status: 'error', detail: 'El adjunto no terminó de descargarse en 10 minutos' }), 610_000);
  const cancellation = setInterval(() => {
    if (shouldStop()) finish({ status: 'error', detail: 'Descarga detenida' });
  }, 500);
  try {
    tabId = (await chrome.tabs.create({ url: `${pageUrl}#${token}`, active: false })).id;
    return await result;
  } catch (error) {
    return { status: 'error', detail: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
    clearInterval(cancellation);
    chrome.runtime.onConnect.removeListener(listener);
    port?.disconnect();
    if (tabId !== undefined) await chrome.tabs.remove(tabId).catch(() => undefined);
  }
}
