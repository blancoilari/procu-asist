const port = chrome.runtime.connect({ name: location.hash.slice(1) });
let started = false;
port.onMessage.addListener(async ({ url }: { url: string }) => {
  if (started) return;
  started = true;
  try {
    if (new URL(url).origin !== 'https://docs.scba.gov.ar') throw new Error('Servidor no permitido');
    const response = await fetch(url, { signal: AbortSignal.timeout(600_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const mimeType = response.headers.get('content-type') || 'application/pdf';
    if (mimeType.includes('text/html')) throw new Error('El servidor devolvió una página en vez del archivo');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length < 100) throw new Error('El archivo recibido está vacío o incompleto');
    let binary = '';
    for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
    const base64 = btoa(binary);
    for (let i = 0; i < base64.length; i += 1024 * 1024) {
      port.postMessage({ type: 'chunk', data: base64.slice(i, i + 1024 * 1024) });
    }
    port.postMessage({ status: 'ok', base64: '', mimeType });
  } catch (error) {
    port.postMessage({ status: 'error', detail: error instanceof Error ? error.message : String(error) });
  }
});
