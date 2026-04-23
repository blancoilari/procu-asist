/**
 * Descarga documentos del SCW (PJN) vía `viewer.seam`.
 *
 * Los IDs de documento son blobs encriptados que la extensión NO puede
 * generar. Los hrefs se obtienen parseando la página de expediente (ver
 * pjn-parser.ts). Este módulo recibe un href crudo y devuelve el PDF
 * como base64.
 *
 * Usa `chrome.scripting.executeScript` en MAIN world dentro de una pestaña
 * abierta de scw.pjn.gov.ar para heredar las cookies de sesión JSESSIONID
 * + F5 BIG-IP — imposible replicarlas desde el service worker.
 */

const SCW_BASE_URL = 'https://scw.pjn.gov.ar';
const SCW_TAB_PATTERN = 'https://scw.pjn.gov.ar/*';

export type PjnDownloadResult =
  | {
      success: true;
      base64: string;
      mimeType: string;
      sizeBytes: number;
      filename: string;
    }
  | { success: false; error: string };

/** Ubica una pestaña abierta de scw.pjn.gov.ar, o null si no hay ninguna. */
export async function findScwTab(): Promise<number | null> {
  const tabs = await chrome.tabs.query({ url: SCW_TAB_PATTERN });
  return tabs[0]?.id ?? null;
}

/**
 * Ubica una pestaña scw abierta en `expediente.seam` o `actuacionesHistoricas.seam`,
 * priorizando la activa. Devuelve null si no hay ninguna.
 */
export async function findScwActuacionesTab(): Promise<number | null> {
  const tabs = await chrome.tabs.query({ url: SCW_TAB_PATTERN });
  const matching = tabs.filter((t) => {
    const u = (t.url ?? '').toLowerCase();
    return u.includes('expediente.seam') || u.includes('actuacioneshistoricas.seam');
  });
  if (!matching.length) return null;
  const active = matching.find((t) => t.active);
  return (active ?? matching[0])?.id ?? null;
}

/**
 * Descarga el PDF apuntado por `href` a través de la pestaña scw indicada.
 * `suggestedName` se usa si el servidor no devuelve Content-Disposition.
 */
export async function downloadPjnPdf(
  tabId: number,
  href: string,
  suggestedName?: string
): Promise<PjnDownloadResult> {
  const url = normalizeViewerUrl(href);

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: async (fetchUrl: string) => {
        try {
          const resp = await fetch(fetchUrl, { credentials: 'include' });
          if (!resp.ok) return { error: `HTTP ${resp.status}` };

          const contentType =
            resp.headers.get('content-type') ?? 'application/pdf';
          const contentDisposition =
            resp.headers.get('content-disposition') ?? '';
          const buffer = await resp.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          return {
            base64: btoa(binary),
            mimeType: contentType,
            sizeBytes: buffer.byteLength,
            contentDisposition,
          };
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
      args: [url],
    });

    const raw = results[0]?.result as
      | {
          base64: string;
          mimeType: string;
          sizeBytes: number;
          contentDisposition: string;
        }
      | { error: string }
      | null
      | undefined;

    if (!raw) {
      return { success: false, error: 'Sin respuesta de executeScript' };
    }
    if ('error' in raw) {
      return { success: false, error: raw.error };
    }
    if (raw.mimeType.includes('text/html')) {
      return {
        success: false,
        error:
          'El servidor devolvió HTML en vez del PDF (sesión expirada o URL inválida).',
      };
    }
    if (raw.sizeBytes < 100) {
      return {
        success: false,
        error: `PDF demasiado chico (${raw.sizeBytes} bytes), probablemente una página de error.`,
      };
    }

    const filename =
      extractFilename(raw.contentDisposition) ||
      suggestedName ||
      buildFallbackName(url);

    return {
      success: true,
      base64: raw.base64,
      mimeType: raw.mimeType,
      sizeBytes: raw.sizeBytes,
      filename,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function normalizeViewerUrl(href: string): string {
  const absolute = href.startsWith('http')
    ? href
    : `${SCW_BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`;
  try {
    const u = new URL(absolute);
    u.searchParams.set('download', 'true');
    return u.toString();
  } catch {
    return absolute;
  }
}

function extractFilename(contentDisposition: string): string {
  if (!contentDisposition) return '';
  const starMatch = contentDisposition.match(
    /filename\*=(?:UTF-8'')?([^;]+)/i
  );
  if (starMatch) {
    try {
      return sanitize(decodeURIComponent(starMatch[1]));
    } catch {
      /* fallthrough */
    }
  }
  const plain = contentDisposition.match(/filename="?([^";]+)"?/i);
  return plain ? sanitize(plain[1]) : '';
}

function buildFallbackName(url: string): string {
  try {
    const u = new URL(url);
    const tipo = u.searchParams.get('tipoDoc') ?? 'documento';
    return `pjn-${sanitize(tipo)}-${Date.now()}.pdf`;
  } catch {
    return `pjn-documento-${Date.now()}.pdf`;
  }
}

function sanitize(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim();
}
