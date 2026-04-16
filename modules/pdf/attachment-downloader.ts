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

/** Full data extracted from a MEV proveido page */
export interface ProveidoPageData {
  text: string;
  adjuntoUrls: string[];
  juzgadoName: string;
  departamento: string;
  datosExpediente: {
    caratula: string;
    fechaInicio: string;
    nroReceptoria: string;
    nroExpediente: string;
    estado: string;
  };
  pasoProcesal: {
    fecha: string;
    tramite: string;
    firmado: boolean;
    fojas: string;
  };
  referencias: {
    adjuntos: Array<{ nombre: string; url: string }>;
    despacho?: string;
    observacion?: string;
    observacionProfesional?: string;
    rawFields: Array<{ label: string; value: string }>;
  };
  datosPresentacion?: {
    fechaEscrito?: string;
    firmadoPor?: string;
    nroPresentacionElectronica?: string;
    presentadoPor?: string;
  };
}

/**
 * Download a single attachment from MEV (or docs.scba.gov.ar) using session cookies.
 * - docs.scba.gov.ar: fetched directly from the service worker (host_permissions
 *   bypasses CORS). Retries up to 3 times with linear backoff.
 * - mev.scba.gov.ar: fetched via executeScript inside the MEV tab (session cookies).
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

  // docs.scba.gov.ar is a public file server but doesn't send CORS headers.
  // We temporarily inject Access-Control-Allow-Origin via declarativeNetRequest
  // so the service worker can read the response, then retry on transient failures.
  if (fullUrl.includes('docs.scba.gov.ar')) {
    return downloadDocsScba(fullUrl, name, 3, 1500);
  }

  const maxRetries = 3;
  const retryDelayMs = 2000;
  let lastError = 'Unknown error';

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
    }

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
        lastError = result?.error ?? 'No result from fetch';
        continue;
      }

      // Validate response is not an HTML error page
      if (result.mimeType.includes('text/html')) {
        lastError = 'El servidor devolvió una página HTML en vez del archivo';
        continue;
      }

      // Validate minimum size
      if (result.sizeBytes < 100) {
        lastError = `Archivo demasiado pequeño (${result.sizeBytes} bytes), probablemente una página de error`;
        continue;
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
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  return {
    success: false,
    error: `${lastError} (tras ${maxRetries} reintentos)`,
  };
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
 * Fetch a MEV proveido page and extract its content cleanly.
 * Runs inside the MEV tab so DOMParser, fetch and cookies all work correctly.
 * Returns full page data including metadata, references, and presentation data.
 */
export async function fetchMevPageContent(
  tabId: number,
  url: string
): Promise<ProveidoPageData | { error: string }> {
  const fullUrl = url.startsWith('http')
    ? url
    : `${MEV_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: async (pageUrl: string) => {
        try {
          const resp = await fetch(pageUrl, { credentials: 'include' });
          if (!resp.ok) return { error: `HTTP ${resp.status}` };

          // MEV is ASP Classic with ISO-8859-1/Windows-1252 encoding.
          // Using resp.text() defaults to UTF-8 and corrupts special chars like "Nº".
          const rawBuffer = await resp.arrayBuffer();
          const html = new TextDecoder('windows-1252').decode(rawBuffer);
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');

          // Remove noise elements
          doc.querySelectorAll('script, style, noscript, link, meta').forEach(
            (el) => el.remove()
          );

          // ── Helper: get text from all <td> cells ──
          const allTds = Array.from(doc.querySelectorAll('td'));
          const findTdText = (prefix: string): string => {
            for (const td of allTds) {
              const t = td.textContent?.trim() ?? '';
              if (t.startsWith(prefix)) return t.replace(prefix, '').trim();
            }
            return '';
          };
          const findTdContaining = (keyword: string): string => {
            for (const td of allTds) {
              const t = td.textContent?.trim() ?? '';
              if (t.includes(keyword) && !t.includes('UsuarioMEV') && !t.includes('Usuario apto')) return t.trim();
            }
            return '';
          };

          // ── Juzgado name and departamento ──
          // The juzgado is typically in a <td> that contains "Juzgado", "CAMARA", or "TRIBUNAL"
          // but NOT the user info. The departamento is usually in an adjacent <td>.
          let juzgadoName = '';
          let departamento = '';
          for (const td of allTds) {
            const t = td.textContent?.trim() ?? '';
            if (t.includes('UsuarioMEV') || t.includes('Usuario apto') || t.includes('Nombre:')) continue;
            if ((t.includes('Juzgado') || t.includes('CAMARA') || t.includes('TRIBUNAL') || t.includes('Cámara') || t.includes('Tribunal'))
                && t.length >= 10 && t.length <= 200 && !juzgadoName) {
              juzgadoName = t;
              // Look for departamento in adjacent cells in the same row
              const row = td.closest('tr');
              if (row) {
                const cells = row.querySelectorAll('td');
                for (const cell of cells) {
                  const ct = cell.textContent?.trim() ?? '';
                  if (ct !== t && ct.length > 3 && ct.length < 100
                      && !ct.includes('UsuarioMEV') && !ct.includes('Usuario apto') && !ct.includes('Nombre:')
                      && !ct.includes('Volver') && !ct.includes('Desconectarse') && !ct.includes('Imprimir')) {
                    departamento = ct;
                    break;
                  }
                }
              }
            }
          }

          // ── Datos del Expediente ──
          const caratula = findTdText('Carátula:') || findTdText('Caratula:');
          const fechaInicio = findTdText('Fecha inicio:');
          let nroReceptoria = '';
          const recMatch = findTdContaining('Receptoría:') || findTdContaining('Receptor');
          if (recMatch) {
            const m = recMatch.match(/Receptor[ií]a?:\s*(.*)/i);
            if (m) nroReceptoria = m[1].trim();
          }
          let nroExpediente = '';
          const expTd = findTdText('Expediente:') || findTdText('Nº de Expediente:');
          if (expTd) nroExpediente = expTd;
          // Also look for "Nº de Expediente" pattern
          for (const td of allTds) {
            const t = td.textContent?.trim() ?? '';
            if (t.includes('Expediente:') && !t.includes('Receptoría') && !nroExpediente) {
              nroExpediente = t.replace(/.*Expediente:\s*/i, '').trim();
            }
          }
          const estado = findTdText('Estado:');

          // ── Paso procesal (from dropdown/select or visible info) ──
          let pasoFecha = '';
          let pasoTramite = '';
          let pasoFirmado = false;
          let pasoFojas = '';
          const selectEl = doc.querySelector('select[name*="Paso"], select[name*="paso"]') as HTMLSelectElement | null;
          if (selectEl) {
            const selectedOpt = selectEl.options[selectEl.selectedIndex];
            if (selectedOpt) {
              const optText = selectedOpt.textContent?.trim() ?? '';
              // Format: "Fecha: 04/02/2026 - Trámite: RECURSO DE APELACION - DEDUCE - ( FIRMADO ) - Foja: 29/36"
              const fechaMatch = optText.match(/Fecha:\s*(\d{2}\/\d{2}\/\d{4})/);
              if (fechaMatch) pasoFecha = fechaMatch[1];
              const tramMatch = optText.match(/Tr[aá]mite:\s*(.*?)(?:\s*-\s*\(\s*FIRMADO\s*\)|\s*-\s*Foja)/i);
              if (tramMatch) pasoTramite = tramMatch[1].trim();
              pasoFirmado = /FIRMADO/i.test(optText);
              const fojaMatch = optText.match(/Foja[s]?:\s*([\d\/]+)/i);
              if (fojaMatch) pasoFojas = fojaMatch[1];
            }
          }
          // Fallback: look for "Pasos procesales" dropdown in different format
          if (!pasoFecha) {
            const allSelects = doc.querySelectorAll('select');
            for (const sel of allSelects) {
              const opt = (sel as HTMLSelectElement).options[(sel as HTMLSelectElement).selectedIndex];
              if (opt) {
                const t = opt.textContent?.trim() ?? '';
                if (t.includes('Fecha:') && t.includes('Foja')) {
                  const fm = t.match(/Fecha:\s*(\d{2}\/\d{2}\/\d{4})/);
                  if (fm) pasoFecha = fm[1];
                  const tm = t.match(/Tr[aá]mite:\s*(.*?)(?:\s*-\s*\(\s*FIRMADO\s*\)|\s*-\s*Foja)/i);
                  if (tm) pasoTramite = tm[1].trim();
                  pasoFirmado = /FIRMADO/i.test(t);
                  const fom = t.match(/Foja[s]?:\s*([\d\/]+)/i);
                  if (fom) pasoFojas = fom[1];
                  break;
                }
              }
            }
          }

          // ── REFERENCIAS section ──
          const adjuntos: Array<{ nombre: string; url: string }> = [];
          let despacho = '';
          let observacion = '';
          let observacionProfesional = '';
          const rawFields: Array<{ label: string; value: string }> = [];

          // Capture ALL content between "REFERENCIAS" and the next section
          let inRef = false;
          for (const td of allTds) {
            const t = td.textContent?.trim() ?? '';
            if (t === 'REFERENCIAS') {
              inRef = true;
              continue;
            }
            if (inRef) {
              if (t.includes('DATOS DE PRESENTACI') || t.includes('Texto del Prove')) {
                break;
              }
              if (!t || t.length < 3) continue;

              // Try to split into label:value pairs
              const colonIdx = t.indexOf(':');
              if (colonIdx > 0 && colonIdx < 60) {
                const label = t.substring(0, colonIdx).trim();
                const value = t.substring(colonIdx + 1).trim();
                rawFields.push({ label, value });
                // Also populate legacy fields
                if (label.startsWith('Despachado en')) despacho = value;
                else if (label === 'Observacion' || label === 'Observación') observacion = value;
                else if (label.startsWith('Observaci') && label.includes('Profesional')) observacionProfesional = value;
              } else if (t.length > 3) {
                // Sub-section headers (e.g., "NOTIFICACION ELECTRONICA")
                rawFields.push({ label: t, value: '' });
              }
            }
          }

          // Find adjuntos (VER ADJUNTO links) with their names
          doc.querySelectorAll('a').forEach((a) => {
            const linkText = a.textContent?.toUpperCase().trim() ?? '';
            if (linkText.includes('VER ADJUNTO') || linkText.includes('ADJUNTO')) {
              const href = a.getAttribute('href');
              if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
              let nombre = '';
              const parent = a.parentElement;
              if (parent) {
                const parentText = parent.textContent?.trim() ?? '';
                nombre = parentText.replace(/VER ADJUNTO/gi, '').trim();
              }
              try {
                const absolute = new URL(href, 'https://mev.scba.gov.ar/').href;
                adjuntos.push({ nombre: nombre || 'Adjunto', url: absolute });
              } catch { /* skip malformed */ }
            }
          });

          // ── DATOS DE PRESENTACIÓN ──
          let fechaEscrito = '';
          let firmadoPor = '';
          let nroPresentacionElectronica = '';
          let presentadoPor = '';

          for (const td of allTds) {
            const t = td.textContent?.trim() ?? '';
            if (t.startsWith('Fecha del Escrito')) {
              fechaEscrito = t.replace(/^Fecha del Escrito\s*/i, '').trim();
            } else if (t.startsWith('Firmado por')) {
              firmadoPor = t.replace(/^Firmado por\s*/i, '').trim();
            } else if (t.startsWith('Nro. Presentación') || t.startsWith('Nro. Presentaci')) {
              nroPresentacionElectronica = t.replace(/^Nro\.\s*Presentaci[oó]n\s*Electr[oó]nica\s*/i, '').trim();
            } else if (t.startsWith('Presentado por')) {
              presentadoPor = t.replace(/^Presentado por\s*/i, '').trim();
            }
          }

          const hasDatosPresentacion = fechaEscrito || firmadoPor || nroPresentacionElectronica || presentadoPor;

          // ── Texto del proveído (#contenidoTxt) ──
          const contentDiv = doc.getElementById('contenidoTxt');
          let text = '';
          if (contentDiv) {
            text = contentDiv.innerText?.trim() ?? contentDiv.textContent?.trim() ?? '';
          } else {
            text = doc.body?.innerText?.trim() ?? doc.body?.textContent?.trim() ?? '';
          }
          text = text.replace(/^[- ]*Para copiar y pegar el texto seleccione.*$/gm, '');
          text = text.replace(/\r\n/g, '\n').replace(/[ \t]{2,}/g, ' ').replace(/\n{4,}/g, '\n\n\n').trim();

          // ── Adjunto URLs for download ──
          const adjuntoUrls = adjuntos.map(a => a.url);

          return {
            text,
            adjuntoUrls,
            juzgadoName,
            departamento,
            datosExpediente: { caratula, fechaInicio, nroReceptoria, nroExpediente, estado },
            pasoProcesal: { fecha: pasoFecha, tramite: pasoTramite, firmado: pasoFirmado, fojas: pasoFojas },
            referencias: { adjuntos, despacho, observacion, observacionProfesional, rawFields },
            datosPresentacion: hasDatosPresentacion ? { fechaEscrito, firmadoPor, nroPresentacionElectronica, presentadoPor } : undefined,
          };
        } catch (e) {
          return { error: String(e) };
        }
      },
      args: [fullUrl],
    });

    const result = results[0]?.result as ProveidoPageData | { error: string } | null;

    if (!result) return { error: 'No result from executeScript' };
    return result;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Find an open MEV tab to use for downloading.
 */
export async function findMevTab(): Promise<number | null> {
  const tabs = await chrome.tabs.query({ url: 'https://mev.scba.gov.ar/*' });
  return tabs[0]?.id ?? null;
}

/**
 * Download a file from docs.scba.gov.ar using a direct fetch from the
 * service worker. This works because the extension declares
 * host_permissions for docs.scba.gov.ar/* in the manifest, which lets
 * the service worker bypass CORS restrictions for that host.
 *
 * Retries with linear backoff because the server is intermittently unreliable.
 */
async function downloadDocsScba(
  url: string,
  name: string,
  maxRetries: number,
  delayMs: number
): Promise<AttachmentDownloadResult> {
  let lastError = 'Unknown error';

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, delayMs * attempt));
    }
    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        lastError = `HTTP ${resp.status}`;
        continue;
      }
      const contentType = resp.headers.get('content-type') ?? 'application/pdf';
      if (contentType.includes('text/html')) {
        lastError = 'Servidor devolvio HTML en vez del archivo';
        continue;
      }
      const buffer = await resp.arrayBuffer();
      if (buffer.byteLength < 100) {
        lastError = `Archivo muy pequeno (${buffer.byteLength} bytes)`;
        continue;
      }
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      return {
        success: true,
        attachment: {
          name, url,
          base64: btoa(binary),
          mimeType: contentType,
          sizeBytes: buffer.byteLength,
        },
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  return { success: false, error: `${lastError} (tras ${maxRetries} reintentos)` };
}
