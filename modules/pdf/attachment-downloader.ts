/**
 * Downloads attachments (adjuntos) from MEV proveido pages.
 * Uses chrome.scripting.executeScript to fetch PDFs using the
 * portal's session cookies, then returns them as base64.
 *
 * Strategy:
 * 1. Find an open MEV tab
 * 2. Inject a fetch() in MAIN world to download the PDF (with cookies)
 * 3. Convert ArrayBuffer → base64
 * 4. Return to background for merging into the case PDF
 */

import { MEV_BASE_URL } from '@/modules/portals/mev-selectors';

export interface DownloadedAttachment {
  name: string;
  url: string;
  base64: string;
  mimeType: string;
  sizeBytes: number;
}

export interface AttachmentDownloadResult {
  success: boolean;
  attachment?: DownloadedAttachment;
  error?: string;
}

/**
 * Download a single attachment from MEV using an open tab's session.
 */
export async function downloadMevAttachment(
  tabId: number,
  attachmentUrl: string,
  name: string
): Promise<AttachmentDownloadResult> {
  // Ensure URL is absolute
  const fullUrl = attachmentUrl.startsWith('http')
    ? attachmentUrl
    : `${MEV_BASE_URL}${attachmentUrl.startsWith('/') ? '' : '/'}${attachmentUrl}`;

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: async (url: string) => {
        try {
          const resp = await fetch(url, {
            credentials: 'include',
          });
          if (!resp.ok) {
            return { error: `HTTP ${resp.status}` };
          }
          const contentType =
            resp.headers.get('content-type') || 'application/pdf';
          const buffer = await resp.arrayBuffer();

          // Convert ArrayBuffer to base64
          const bytes = new Uint8Array(buffer);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);

          return {
            base64,
            mimeType: contentType,
            sizeBytes: buffer.byteLength,
          };
        } catch (e) {
          return { error: String(e) };
        }
      },
      args: [fullUrl],
    });

    const result = results[0]?.result as
      | { base64: string; mimeType: string; sizeBytes: number }
      | { error: string }
      | null;

    if (!result || 'error' in result) {
      return {
        success: false,
        error: result?.error ?? 'No result from fetch',
      };
    }

    return {
      success: true,
      attachment: {
        name,
        url: fullUrl,
        base64: result.base64,
        mimeType: result.mimeType,
        sizeBytes: result.sizeBytes,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Download multiple attachments sequentially.
 * Returns results for each attachment (some may fail).
 */
export async function downloadMevAttachments(
  tabId: number,
  attachments: Array<{ name: string; url: string }>
): Promise<AttachmentDownloadResult[]> {
  const results: AttachmentDownloadResult[] = [];

  for (const att of attachments) {
    const result = await downloadMevAttachment(tabId, att.url, att.name);
    results.push(result);

    // Small delay between downloads
    if (attachments.indexOf(att) < attachments.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return results;
}

/**
 * Find an open MEV tab to use for downloading.
 */
export async function findMevTab(): Promise<number | null> {
  const tabs = await chrome.tabs.query({ url: 'https://mev.scba.gov.ar/*' });
  return tabs[0]?.id ?? null;
}
