/**
 * Pedidos a la MEV desde la pestaña del usuario (chrome.scripting en el
 * mundo MAIN, con las cookies de su sesión): proveídos, adjuntos y
 * reingreso a la ficha. Cada función hace UN pedido y clasifica la
 * respuesta; reintentos, esperas y ritmo los decide el recorrido de la
 * descarga (mev-download-runner.ts) con el portero (mev-pacer.ts).
 *
 * Excepción: los adjuntos de docs.scba.gov.ar, otro servidor, se piden
 * desde el service worker (host_permissions evita CORS) y conservan sus
 * reintentos propios porque ese servidor falla de a ratos.
 *
 * Las funciones que se inyectan con executeScript se serializan: no pueden
 * usar nada de este módulo, por eso repiten sus expresiones regulares.
 */

import { MEV_BASE_URL } from '@/modules/portals/mev-selectors';
import {
  classifyMevPage,
  describeProbe,
  htmlLooksLikeChallenge,
  htmlLooksLikeLogin,
  MEV_PROBE_SAMPLE_LENGTH,
  MEV_RAW_SAMPLE_LENGTH,
  type MevPageProbe,
} from '@/modules/portals/mev-challenge';
import type { AttachmentFetch, CaseEntry, PageFetch } from '@/modules/pdf/mev-download-runner';

/** Datos de la página de un proveído de la MEV. */
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
  /** Señales de la respuesta cruda, para clasificarla afuera. */
  probe?: MevPageProbe;
}

export function toAbsoluteMevUrl(url: string): string {
  return url.startsWith('http') ? url : `${MEV_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

/** true si el archivo se pide a la MEV (cuenta para el límite de pedidos). */
export function isMevHostedUrl(url: string): boolean {
  return !toAbsoluteMevUrl(url).includes('docs.scba.gov.ar');
}

/** Un pedido de adjunto. Los de docs.scba.gov.ar van por el service worker. */
export async function downloadMevAttachment(tabId: number, attachmentUrl: string): Promise<AttachmentFetch> {
  const fullUrl = toAbsoluteMevUrl(attachmentUrl);
  if (!isMevHostedUrl(fullUrl)) return downloadDocsScba(fullUrl, 3, 1500);

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: async (url: string, rawLength: number) => {
        try {
          const resp = await fetch(url, { credentials: 'include' });
          if (!resp.ok) return { error: `HTTP ${resp.status}` };
          const contentType = resp.headers.get('content-type') || 'application/pdf';
          const buffer = await resp.arrayBuffer();
          // Una respuesta HTML nunca es el adjunto: puede ser la pantalla de
          // verificación, el login o un error. Se devuelve el comienzo para
          // que el llamador distinga.
          if (contentType.includes('text/html')) {
            return {
              error: 'La MEV devolvió una página en vez del archivo',
              htmlSample: new TextDecoder('windows-1252').decode(buffer.slice(0, rawLength)),
            };
          }
          const bytes = new Uint8Array(buffer);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          return { base64: btoa(binary), mimeType: contentType, sizeBytes: buffer.byteLength };
        } catch (e) {
          return { error: String(e) };
        }
      },
      args: [fullUrl, MEV_RAW_SAMPLE_LENGTH],
    });

    const result = results[0]?.result as
      | { base64: string; mimeType: string; sizeBytes: number }
      | { error: string; htmlSample?: string }
      | null
      | undefined;
    if (!result) return { status: 'error', detail: 'La pestaña de la MEV no respondió' };
    if ('error' in result) {
      const sample = result.htmlSample ?? '';
      if (sample && htmlLooksLikeChallenge(sample)) {
        return { status: 'desafio', detail: 'pantalla de verificación en vez del adjunto' };
      }
      if (sample && htmlLooksLikeLogin(sample)) {
        return { status: 'login', detail: 'formulario de login en vez del adjunto' };
      }
      return { status: 'error', detail: result.error };
    }
    if (result.sizeBytes < 100) {
      return { status: 'error', detail: `Archivo demasiado chico (${result.sizeBytes} bytes)` };
    }
    return { status: 'ok', base64: result.base64, mimeType: result.mimeType };
  } catch (err) {
    return { status: 'error', detail: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Un pedido de proveído, parseado dentro de la pestaña de la MEV (así
 * DOMParser, fetch y las cookies funcionan) y clasificado afuera con
 * classifyMevPage.
 */
export async function fetchMevPageContent(tabId: number, url: string): Promise<PageFetch<ProveidoPageData>> {
  const fullUrl = toAbsoluteMevUrl(url);

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: async (pageUrl: string, sampleLength: number, rawLength: number) => {
        try {
          const resp = await fetch(pageUrl, { credentials: 'include' });
          if (!resp.ok) return { error: `HTTP ${resp.status}` };

          // La MEV es ASP clásico en Windows-1252: resp.text() rompería la ñ y el º.
          const rawBuffer = await resp.arrayBuffer();
          const html = new TextDecoder('windows-1252').decode(rawBuffer);
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');

          // Señales que se leen ANTES de sacar los scripts: el título y el
          // script de Turnstile son la firma de la pantalla de verificación.
          const title = (doc.title || '').trim();
          const hasTurnstile = Array.from(doc.querySelectorAll('script[src]')).some((s) =>
            /challenges\.cloudflare\.com\/turnstile/i.test(s.getAttribute('src') || '')
          );
          const looksLikeLogin =
            !!doc.querySelector("input[name='usuario']") && !!doc.querySelector("input[name='clave']");
          let finalPath = '';
          try {
            finalPath = new URL(resp.url).pathname.toLowerCase();
          } catch {
            finalPath = '';
          }

          doc.querySelectorAll('script, style, noscript, link, meta').forEach((el) => el.remove());

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

          // Juzgado y departamento: una celda con "Juzgado", "Cámara" o
          // "Tribunal" que no sea la del usuario; el departamento suele estar
          // en una celda de la misma fila.
          let juzgadoName = '';
          let departamento = '';
          for (const td of allTds) {
            const t = td.textContent?.trim() ?? '';
            if (t.includes('UsuarioMEV') || t.includes('Usuario apto') || t.includes('Nombre:')) continue;
            if ((t.includes('Juzgado') || t.includes('CAMARA') || t.includes('TRIBUNAL') || t.includes('Cámara') || t.includes('Tribunal'))
                && t.length >= 10 && t.length <= 200 && !juzgadoName) {
              juzgadoName = t;
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

          // Datos del expediente
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
          for (const td of allTds) {
            const t = td.textContent?.trim() ?? '';
            if (t.includes('Expediente:') && !t.includes('Receptoría') && !nroExpediente) {
              nroExpediente = t.replace(/.*Expediente:\s*/i, '').trim();
            }
          }
          const estado = findTdText('Estado:');

          // Paso procesal (combo de pasos o texto visible)
          let pasoFecha = '';
          let pasoTramite = '';
          let pasoFirmado = false;
          let pasoFojas = '';
          const selectEl = doc.querySelector('select[name*="Paso"], select[name*="paso"]') as HTMLSelectElement | null;
          if (selectEl) {
            const selectedOpt = selectEl.options[selectEl.selectedIndex];
            if (selectedOpt) {
              // Formato: "Fecha: 04/02/2026 - Trámite: RECURSO DE APELACION - DEDUCE - ( FIRMADO ) - Foja: 29/36"
              const optText = selectedOpt.textContent?.trim() ?? '';
              const fechaMatch = optText.match(/Fecha:\s*(\d{2}\/\d{2}\/\d{4})/);
              if (fechaMatch) pasoFecha = fechaMatch[1];
              const tramMatch = optText.match(/Tr[aá]mite:\s*(.*?)(?:\s*-\s*\(\s*FIRMADO\s*\)|\s*-\s*Foja)/i);
              if (tramMatch) pasoTramite = tramMatch[1].trim();
              pasoFirmado = /FIRMADO/i.test(optText);
              const fojaMatch = optText.match(/Foja[s]?:\s*([\d\/]+)/i);
              if (fojaMatch) pasoFojas = fojaMatch[1];
            }
          }
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

          // REFERENCIAS: todo lo que hay entre ese título y la sección siguiente
          const adjuntos: Array<{ nombre: string; url: string }> = [];
          let despacho = '';
          let observacion = '';
          let observacionProfesional = '';
          const rawFields: Array<{ label: string; value: string }> = [];
          let inRef = false;
          for (const td of allTds) {
            const t = td.textContent?.trim() ?? '';
            if (t === 'REFERENCIAS') {
              inRef = true;
              continue;
            }
            if (inRef) {
              if (t.includes('DATOS DE PRESENTACI') || t.includes('Texto del Prove')) break;
              if (!t || t.length < 3) continue;
              const colonIdx = t.indexOf(':');
              if (colonIdx > 0 && colonIdx < 60) {
                const label = t.substring(0, colonIdx).trim();
                const value = t.substring(colonIdx + 1).trim();
                rawFields.push({ label, value });
                if (label.startsWith('Despachado en')) despacho = value;
                else if (label === 'Observacion' || label === 'Observación') observacion = value;
                else if (label.startsWith('Observaci') && label.includes('Profesional')) observacionProfesional = value;
              } else if (t.length > 3) {
                // Subtítulos de sección (por ejemplo "NOTIFICACION ELECTRONICA")
                rawFields.push({ label: t, value: '' });
              }
            }
          }

          // Adjuntos (links VER ADJUNTO) con su nombre
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
              } catch { /* href roto: se saltea */ }
            }
          });

          // DATOS DE PRESENTACIÓN
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

          // Texto del proveído (#contenidoTxt)
          const contentDiv = doc.getElementById('contenidoTxt');
          let text = '';
          if (contentDiv) {
            text = contentDiv.innerText?.trim() ?? contentDiv.textContent?.trim() ?? '';
          } else {
            text = doc.body?.innerText?.trim() ?? doc.body?.textContent?.trim() ?? '';
          }
          text = text.replace(/^[- ]*Para copiar y pegar el texto seleccione.*$/gm, '');
          text = text.replace(/\r\n/g, '\n').replace(/[ \t]{2,}/g, ' ').replace(/\n{4,}/g, '\n\n\n').trim();

          // Marcas estructurales de un proveído (regla de oro de la clasificación):
          // el div del texto, el combo de pasos, la carátula o el bloque REFERENCIAS.
          const hasProveidoStructure =
            !!contentDiv ||
            !!selectEl ||
            allTds.some((td) => /^car[aá]tula\s*:/i.test(td.textContent?.trim() ?? '')) ||
            allTds.some((td) => (td.textContent?.trim() ?? '') === 'REFERENCIAS');
          const bodyTextSample = (doc.body?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, sampleLength);

          return {
            probe: {
              htmlLength: html.length,
              bodyTextSample,
              hasProveidoStructure,
              title,
              hasTurnstile,
              finalPath,
              looksLikeLogin,
              rawHtmlSample: html.slice(0, rawLength),
            },
            text,
            adjuntoUrls: adjuntos.map((a) => a.url),
            juzgadoName,
            departamento,
            datosExpediente: { caratula, fechaInicio, nroReceptoria, nroExpediente, estado },
            pasoProcesal: { fecha: pasoFecha, tramite: pasoTramite, firmado: pasoFirmado, fojas: pasoFojas },
            referencias: { adjuntos, despacho, observacion, observacionProfesional, rawFields },
            datosPresentacion: hasDatosPresentacion
              ? { fechaEscrito, firmadoPor, nroPresentacionElectronica, presentadoPor }
              : undefined,
          };
        } catch (e) {
          return { error: String(e) };
        }
      },
      args: [fullUrl, MEV_PROBE_SAMPLE_LENGTH, MEV_RAW_SAMPLE_LENGTH],
    });

    const result = results[0]?.result as ProveidoPageData | { error: string } | null | undefined;
    if (!result) return { status: 'error', detail: 'La pestaña de la MEV no respondió' };
    if ('error' in result) return { status: 'error', detail: result.error };

    const verdict = result.probe ? classifyMevPage(result.probe) : { status: 'ok' as const };
    if (verdict.status === 'ok') return { status: 'ok', data: result };

    console.warn(
      `[ProcuAsist] La MEV no devolvió el proveído (${verdict.status}${verdict.marker ? ': ' + verdict.marker : ''}):`,
      fullUrl
    );
    return { status: verdict.status, detail: result.probe ? describeProbe(result.probe) : '' };
  } catch (err) {
    return { status: 'error', detail: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Reingresa a la ficha de la causa (procesales.asp). Sirve para que la
 * sesión vuelva a tener la causa: sin esa visita, proveido.asp redirige a
 * la búsqueda (medido el 22/09/2026).
 */
export async function enterMevCase(tabId: number, caseUrl: string): Promise<CaseEntry> {
  const fullUrl = toAbsoluteMevUrl(caseUrl);
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: async (url: string, rawLength: number) => {
        try {
          const resp = await fetch(url, { credentials: 'include' });
          if (!resp.ok) return { error: `HTTP ${resp.status}` };
          const html = new TextDecoder('windows-1252').decode(await resp.arrayBuffer());
          return { hasSteps: /Pasos Procesales/i.test(html), sample: html.slice(0, rawLength), length: html.length };
        } catch (e) {
          return { error: String(e) };
        }
      },
      args: [fullUrl, MEV_RAW_SAMPLE_LENGTH],
    });
    const r = results[0]?.result as
      | { hasSteps: boolean; sample: string; length: number }
      | { error: string }
      | null
      | undefined;
    if (!r) return { status: 'error', detail: 'La pestaña de la MEV no respondió' };
    if ('error' in r) return { status: 'error', detail: r.error };
    if (r.hasSteps) return { status: 'ok', detail: '' };
    if (htmlLooksLikeChallenge(r.sample)) {
      return { status: 'desafio', detail: 'pantalla de verificación al reingresar a la ficha' };
    }
    if (htmlLooksLikeLogin(r.sample)) {
      return { status: 'login', detail: 'formulario de login al reingresar a la ficha' };
    }
    return { status: 'error', detail: `la ficha no se pudo abrir (${r.length} caracteres)` };
  } catch (err) {
    return { status: 'error', detail: err instanceof Error ? err.message : String(err) };
  }
}

/** Una pestaña abierta de la MEV (la usa el importador de resultados). */
export async function findMevTab(): Promise<number | null> {
  const tabs = await chrome.tabs.query({ url: 'https://mev.scba.gov.ar/*' });
  return tabs[0]?.id ?? null;
}

/**
 * docs.scba.gov.ar: servidor público de archivos sin cabeceras CORS. Se
 * pide desde el service worker (host_permissions lo permite) y con
 * reintentos, porque ese servidor falla de a ratos. No cuenta para el
 * límite de la MEV (otro servidor).
 */
async function downloadDocsScba(url: string, maxRetries: number, delayMs: number): Promise<AttachmentFetch> {
  let lastError = 'error desconocido';
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, delayMs * attempt));
    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        lastError = `HTTP ${resp.status}`;
        continue;
      }
      const contentType = resp.headers.get('content-type') ?? 'application/pdf';
      if (contentType.includes('text/html')) {
        lastError = 'El servidor devolvió una página en vez del archivo';
        continue;
      }
      const buffer = await resp.arrayBuffer();
      if (buffer.byteLength < 100) {
        lastError = `Archivo demasiado chico (${buffer.byteLength} bytes)`;
        continue;
      }
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      return { status: 'ok', base64: btoa(binary), mimeType: contentType };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  return { status: 'error', detail: `${lastError} (tras ${maxRetries} reintentos)` };
}
