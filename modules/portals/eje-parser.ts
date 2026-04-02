/**
 * EJE/JUSCABA HTML + API response parsing functions.
 *
 * The EJE portal is an Angular SPA, so most data comes from API responses
 * rather than static HTML. However, we also provide DOM parsing for cases
 * where we intercept the rendered Angular components.
 */

import { EJE_SELECTORS, EJE_PATTERNS } from './eje-selectors';

// ────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────

/** Parsed case data from EJE */
export interface EjeCaseData {
  expId: string;
  cuij: string;
  numero: string;
  anio: string;
  caratula: string;
  fechaInicio: string;
  estado: string;
  tribunal: string;
  objetoJuicio: string;
}

/** Parsed actuación (movement) from EJE */
export interface EjeActuacion {
  actId: string;
  titulo: string;
  numero: string;
  fechaFirma: string;
  firmantes: string;
  hasAttachment: boolean;
  tipo: string; // despacho, escrito, cedula, nota
}

/** Case header from API response */
export interface EjeEncabezadoResponse {
  tipoExpediente?: string;
  cuij?: string;
  numero?: number;
  anio?: number;
  caratula?: string;
  nivelAcceso?: string;
  estadoAdministrativo?: string;
  esPrivado?: boolean;
  fechaInicio?: number; // ms timestamp
  sufijo?: string;
}

/** Actuaciones page from API response */
export interface EjeActuacionesResponse {
  totalElements: number;
  totalPages: number;
  content: EjeActuacionItem[];
}

export interface EjeActuacionItem {
  actId: number;
  titulo: string;
  numero: string;
  fechaFirma: number; // ms timestamp
  firmantes: string;
  posueAdjunto: boolean;
  esCedula: boolean;
  esNota: boolean;
  codigo: string;
  fechaPublicacion: number;
  anio: number;
  eacId: number;
}

// ────────────────────────────────────────────────────────
// Page Detection
// ────────────────────────────────────────────────────────

/** Check if the current page is the Keycloak SSO login page */
export function isKeycloakLoginPage(doc: Document): boolean {
  return (
    !!doc.querySelector(EJE_SSO_SELECTORS.loginForm) ||
    window.location.hostname === 'sso.pjn.gov.ar'
  );
}

const EJE_SSO_SELECTORS = {
  loginForm: '#kc-form-login',
  username: '#username',
  password: '#password',
  submit: '#kc-login',
};

/** Check if we're on the EJE SPA (Angular app loaded) */
export function isEjeSpa(doc: Document): boolean {
  return !!doc.querySelector(EJE_SELECTORS.appRoot);
}

/** Check if we're on the search/results page */
export function isSearchPage(): boolean {
  return window.location.pathname.includes('/p/expedientes');
}

/** Check if we're on the home page */
export function isHomePage(): boolean {
  return window.location.pathname.includes('/p/inicio');
}

// ────────────────────────────────────────────────────────
// DOM Parsing (for rendered Angular components)
// ────────────────────────────────────────────────────────

/**
 * Extract case cards from the search results page.
 * Each card is an <iol-expediente-tarjeta> element.
 */
export function parseResultCards(
  doc: Document
): EjeCaseData[] {
  const cards = doc.querySelectorAll(EJE_SELECTORS.results.card);
  const results: EjeCaseData[] = [];

  for (const card of cards) {
    const data = parseCardElement(card as HTMLElement);
    if (data) results.push(data);
  }

  return results;
}

/**
 * Parse a single case card element.
 */
function parseCardElement(card: HTMLElement): EjeCaseData | null {
  // CUIJ + Carátula are in the title area
  const caratulaEl = card.querySelector(EJE_SELECTORS.results.caratulaText);
  if (!caratulaEl) return null;

  const fullText = caratulaEl.textContent?.trim() ?? '';
  const lines = fullText.split('\n').map((l) => l.trim()).filter(Boolean);

  // First line = CUIJ (e.g., "EXP J-01-00061062-9/2026-0")
  const cuijLine = lines[0] ?? '';
  // Rest = carátula
  const caratula = lines.slice(1).join(' ').trim();

  // Extract case number from CUIJ
  const numMatch = cuijLine.match(EJE_PATTERNS.caseNumber);
  const numero = numMatch ? `${numMatch[1]}/${numMatch[2]}-${numMatch[3]}` : '';

  // Fecha inicio
  const fechaEl = card.querySelector(EJE_SELECTORS.results.fechaInicio);
  const fechaText = fechaEl?.textContent?.trim() ?? '';
  const fechaInicio = fechaText.replace(/^Inicio:\s*/i, '').trim();

  // Estado badge
  const badgeEl = card.querySelector(EJE_SELECTORS.results.statusBadge);
  const estado = badgeEl?.textContent?.trim() ?? '';

  // Last action
  const lastActionEl = card.querySelector(EJE_SELECTORS.results.lastActionText);
  const lastAction = lastActionEl?.textContent?.trim() ?? '';

  // Try to extract expId from any API call or data attribute
  // Angular components may store it — check href or data attrs
  const linkEl = card.querySelector(EJE_SELECTORS.results.titleLink) as HTMLAnchorElement | null;
  let expId = '';
  if (linkEl) {
    const href = linkEl.getAttribute('href') ?? '';
    const expIdMatch = href.match(EJE_PATTERNS.expId);
    if (expIdMatch) expId = expIdMatch[1];
  }

  return {
    expId,
    cuij: cuijLine,
    numero,
    anio: numMatch?.[2] ?? '',
    caratula: caratula || cuijLine,
    fechaInicio,
    estado,
    tribunal: '', // Only available in Ficha tab
    objetoJuicio: '',
  };
}

/**
 * Parse actuaciones (movements) from the rendered Angular table.
 */
export function parseActuacionesTable(
  doc: Document
): EjeActuacion[] {
  const rows = doc.querySelectorAll(EJE_SELECTORS.actuaciones.row);
  const actuaciones: EjeActuacion[] = [];

  for (const row of rows) {
    const cells = row.querySelectorAll(EJE_SELECTORS.actuaciones.cells);
    if (cells.length < 5) continue;

    const titleLink = cells[0]?.querySelector('a');
    const titulo = titleLink?.textContent?.trim() ?? cells[0]?.textContent?.trim() ?? '';
    const numero = cells[1]?.textContent?.trim() ?? '';
    const fechaFirma = cells[2]?.textContent?.trim() ?? '';
    const firmantes = cells[3]?.textContent?.trim() ?? '';
    const hasAttachment = !!cells[4]?.querySelector('i.material-icons');

    // Determine type from titulo prefix
    let tipo = 'despacho';
    if (titulo.match(/^(ESC|ESCR)/i)) tipo = 'escrito';
    else if (titulo.match(/^(CED|CÉD)/i)) tipo = 'cedula';
    else if (titulo.match(/^(NOT|NOTA)/i)) tipo = 'nota';

    actuaciones.push({
      actId: '', // Not easily extractable from DOM
      titulo,
      numero,
      fechaFirma,
      firmantes,
      hasAttachment,
      tipo,
    });
  }

  return actuaciones;
}

// ────────────────────────────────────────────────────────
// API Response Parsing
// ────────────────────────────────────────────────────────

/**
 * Parse case header from API /expedientes/encabezado response.
 */
export function parseCaseHeaderApi(
  data: EjeEncabezadoResponse,
  expId: string
): EjeCaseData {
  const fechaMs = data.fechaInicio ?? 0;
  const fechaInicio = fechaMs
    ? new Date(fechaMs).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '';

  return {
    expId,
    cuij: data.cuij ?? '',
    numero: data.numero ? `${data.numero}/${data.anio ?? ''}-${data.sufijo ?? '0'}` : '',
    anio: String(data.anio ?? ''),
    caratula: data.caratula ?? '',
    fechaInicio,
    estado: data.estadoAdministrativo ?? '',
    tribunal: '',
    objetoJuicio: '',
  };
}

/**
 * Parse actuaciones from API /expedientes/actuaciones response.
 */
export function parseActuacionesApi(
  data: EjeActuacionesResponse
): EjeActuacion[] {
  return data.content.map((item) => {
    const fechaMs = item.fechaFirma ?? item.fechaPublicacion ?? 0;
    const fechaFirma = fechaMs
      ? new Date(fechaMs).toLocaleDateString('es-AR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';

    let tipo = 'despacho';
    if (item.esCedula) tipo = 'cedula';
    else if (item.esNota) tipo = 'nota';
    else if (item.titulo?.match(/^(ESC|ESCR)/i)) tipo = 'escrito';

    return {
      actId: String(item.actId),
      titulo: item.titulo ?? '',
      numero: item.numero ?? '',
      fechaFirma,
      firmantes: item.firmantes ?? '',
      hasAttachment: item.posueAdjunto ?? false,
      tipo,
    };
  });
}

/**
 * Convert ms timestamp to dd/mm/yyyy string.
 */
export function msToDate(ms: number): string {
  if (!ms) return '';
  return new Date(ms).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
