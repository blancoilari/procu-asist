/**
 * MEV HTML parsing functions.
 * Ported from Procuración Digital project (mev_parser.py).
 *
 * These functions extract structured data from MEV portal pages.
 * They work both on live DOM (content scripts) and parsed HTML strings (offscreen).
 */

import type { Movement } from './types';
import { MEV_SELECTORS, MEV_PATTERNS } from './mev-selectors';

/** Parsed case header data from procesales.asp */
export interface MevCaseData {
  numero: string;
  caratula: string;
  juzgado: string;
  fechaInicio: string;
  estadoPortal: string;
  numeroReceptoria: string;
  nidCausa: string;
  pidJuzgado: string;
}

/** Search result item from MuestraCausas.asp */
export interface MevSearchResult {
  nidCausa: string;
  pidJuzgado: string;
  caratula: string;
  numero: string;
  ultimoMovimiento: string;
  estado: string;
  url: string;
}

/** Adjunto (attachment) found in proveido page */
export interface MevAdjunto {
  nombre: string;
  url: string;
}

/**
 * Detect if the current page/HTML is the MEV login page.
 * Mirrors es_pagina_login() from Procuración Digital.
 */
export function isLoginPage(docOrHtml: Document | string): boolean {
  if (typeof docOrHtml === 'string') {
    const lower = docOrHtml.toLowerCase();
    return (
      lower.includes('ingrese los datos del usuario') ||
      (lower.includes('name="usuario"') && lower.includes('name="clave"'))
    );
  }

  // Live DOM check
  const usuario = docOrHtml.querySelector(MEV_SELECTORS.login.usuario);
  const clave = docOrHtml.querySelector(MEV_SELECTORS.login.clave);
  return !!(usuario && clave);
}

/** Detect if current page is POSloguin.asp */
export function isPosLoginPage(doc: Document): boolean {
  return (
    window.location.href.toLowerCase().includes('posloguin') ||
    !!doc.querySelector(MEV_SELECTORS.posLogin.depto)
  );
}

/** Detect if current page is busqueda.asp */
export function isBusquedaPage(doc: Document): boolean {
  return (
    window.location.href.toLowerCase().includes('busqueda') ||
    !!doc.querySelector(MEV_SELECTORS.busqueda.radioNumero)
  );
}

/** Detect if current page is procesales.asp (case detail) */
export function isCasePage(doc: Document): boolean {
  return window.location.href.toLowerCase().includes('procesales');
}

/** Detect if current page is a results page */
export function isResultsPage(doc: Document): boolean {
  const url = window.location.href.toLowerCase();
  return url.includes('muestracausas') || url.includes('resultados');
}

/** Detect if current page is proveido.asp (document view) */
export function isProveidoPage(doc: Document): boolean {
  return window.location.href.toLowerCase().includes('proveido');
}

/**
 * Extract case header data from procesales.asp.
 * Mirrors parse_datos_expediente() from Procuración Digital.
 */
export function parseCaseData(doc: Document): MevCaseData | null {
  const tds = doc.querySelectorAll('td');
  const data: Partial<MevCaseData> = {};

  for (const td of tds) {
    const text = td.textContent?.trim() ?? '';

    if (text.startsWith('Carátula:') || text.startsWith('Caratula:')) {
      data.caratula = text.replace(/^Car[aá]tula:\s*/i, '').trim();
    } else if (text.startsWith('Fecha inicio:')) {
      data.fechaInicio = text.replace('Fecha inicio:', '').trim();
    } else if (text.includes('Receptoría:') || text.includes('Receptor')) {
      const match = text.match(/Receptor[ií]a?:\s*(.*)/i);
      if (match) data.numeroReceptoria = match[1].trim();
    } else if (text.includes('Expediente:')) {
      data.numero = extractCaseNumber(text) || text.replace(/^.*Expediente:\s*/i, '').trim();
    } else if (text.startsWith('Estado:')) {
      data.estadoPortal = text.replace('Estado:', '').trim();
    } else if (
      text.length >= 10 &&
      text.length <= 200 &&
      (text.includes('Juzgado') ||
        text.includes('CAMARA') ||
        text.includes('TRIBUNAL'))
    ) {
      data.juzgado = text.trim();
    }
  }

  // Extract nidCausa and pidJuzgado from URL
  const url = window.location.href;
  const nidMatch = url.match(MEV_PATTERNS.nidCausa);
  const pidMatch = url.match(MEV_PATTERNS.pidJuzgado);
  data.nidCausa = nidMatch?.[1] ?? '';
  data.pidJuzgado = pidMatch?.[1] ?? '';

  // Try to extract case number from other fields if not found
  if (!data.numero && data.numeroReceptoria) {
    data.numero = extractCaseNumber(data.numeroReceptoria);
  }

  if (!data.caratula) return null;

  return {
    numero: data.numero ?? '',
    caratula: data.caratula ?? '',
    juzgado: data.juzgado ?? '',
    fechaInicio: data.fechaInicio ?? '',
    estadoPortal: data.estadoPortal ?? '',
    numeroReceptoria: data.numeroReceptoria ?? '',
    nidCausa: data.nidCausa ?? '',
    pidJuzgado: data.pidJuzgado ?? '',
  };
}

function extractCaseNumber(text: string): string {
  const numMatch = text.match(MEV_PATTERNS.caseNumber);
  return numMatch ? `${numMatch[1]}-${numMatch[2]}-${numMatch[3]}` : '';
}

/**
 * Extract movements table from procesales.asp.
 * Mirrors parse_movimientos() from Procuración Digital.
 */
export function parseMovements(doc: Document): Movement[] {
  const movements: Movement[] = [];

  // Find the movements table by looking for headers "Fecha" + "Descripción"
  const tables = doc.querySelectorAll('table');
  let movTable: HTMLTableElement | null = null;

  for (const table of tables) {
    const headerText = Array.from(table.querySelectorAll('tr'))
      .map((row) => row.textContent ?? '')
      .join(' ');
    if (headerText.includes('Fecha') && headerText.includes('Descripci')) {
      movTable = table;
      break;
    }
  }

  if (!movTable) return movements;

  const rows = movTable.querySelectorAll('tr');

  // Skip header row (index 0)
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i].querySelectorAll('td');
    if (cells.length < 4) continue;

    const fecha = (cells[0].textContent?.trim() ?? '').substring(0, 10);
    if (!MEV_PATTERNS.date.test(fecha)) continue;

    const fojas = cells[1].textContent?.trim() ?? '';
    const descripcion = cells[3].textContent?.trim() ?? '';

    // Check for proveido link (document)
    const proveidoLink = cells[3].querySelector(
      MEV_SELECTORS.procesales.proveidoLink
    ) as HTMLAnchorElement | null;
    const hasDocument = !!proveidoLink;
    const documentUrl = proveidoLink?.href ?? '';

    // Check for digital signature
    const hasFirma = !!cells[2]?.querySelector(MEV_SELECTORS.procesales.firmaImg);

    // Extract document URLs from adjuntos if any
    const documentUrls: string[] = [];
    if (documentUrl) documentUrls.push(documentUrl);

    movements.push({
      date: fecha,
      fojas,
      type: hasFirma ? 'firmado' : '',
      description: descripcion,
      hasDocuments: hasDocument,
      documentUrls,
    });
  }

  return movements;
}

/**
 * Parse search results from MuestraCausas.asp.
 * Mirrors parse_resultados_busqueda() from Procuración Digital.
 */
export function parseSearchResults(doc: Document): MevSearchResult[] {
  const results: MevSearchResult[] = [];
  const links = doc.querySelectorAll(
    MEV_SELECTORS.resultados.casoLink
  ) as NodeListOf<HTMLAnchorElement>;

  // Links appear in pairs: first is caratula, second is last movement
  const seen = new Map<string, MevSearchResult>();

  for (const link of links) {
    const href = link.href;
    const nidMatch = href.match(MEV_PATTERNS.nidCausa);
    const pidMatch = href.match(MEV_PATTERNS.pidJuzgado);
    if (!nidMatch) continue;

    const nidCausa = nidMatch[1];
    const pidJuzgado = pidMatch?.[1] ?? '';
    const text = link.textContent?.trim() ?? '';

    if (!seen.has(nidCausa)) {
      // First occurrence = caratula
      const result: MevSearchResult = {
        nidCausa,
        pidJuzgado,
        caratula: text,
        numero: '',
        ultimoMovimiento: '',
        estado: '',
        url: href,
      };

      // Try to extract case number from sibling cells
      const row = link.closest('tr');
      if (row) {
        const cells = row.querySelectorAll('td');
        for (const cell of cells) {
          const cellText = cell.textContent?.trim() ?? '';
          const numMatch = cellText.match(MEV_PATTERNS.caseNumber);
          if (numMatch) {
            result.numero = `${numMatch[1]}-${numMatch[2]}-${numMatch[3]}`;
            break;
          }
        }
      }

      seen.set(nidCausa, result);
    } else {
      // Second occurrence = last movement
      seen.get(nidCausa)!.ultimoMovimiento = text;
    }
  }

  return Array.from(seen.values());
}

/**
 * Parse adjuntos (attachments) from proveido.asp.
 * Mirrors parse_adjuntos_proveido() from Procuración Digital.
 */
export function parseAdjuntos(doc: Document): MevAdjunto[] {
  const adjuntos: MevAdjunto[] = [];
  const links = doc.querySelectorAll('a');

  for (const link of links) {
    const text = link.textContent?.trim() ?? '';
    if (text.toUpperCase().includes(MEV_SELECTORS.proveido.adjuntoLinkText)) {
      // Get adjunto name from preceding text or parent
      let nombre = '';
      const parent = link.parentElement;
      if (parent) {
        const parentText = parent.textContent?.trim() ?? '';
        nombre = parentText.replace(/VER ADJUNTO/gi, '').trim();
      }

      adjuntos.push({
        nombre: nombre || 'Adjunto',
        url: link.href,
      });
    }
  }

  return adjuntos;
}
