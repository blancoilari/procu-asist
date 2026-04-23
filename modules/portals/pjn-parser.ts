/**
 * PJN SCW HTML parsers.
 *
 * Runs in a content script, so the browser already decoded the ISO-8859-1
 * page into an HTMLDocument. Encoding concerns reappear when we fetch scw
 * responses from a background/offscreen context (M5+).
 *
 * Scope by milestone:
 * - M3: listing pages (Relacionados, Favoritos, Radicaciones).
 * - M4: expediente detail — datos generales + the currently-visible tab.
 *       Tab cycling to pre-load all four is M5/M6 territory.
 */

import {
  PJN_ACTUACIONES_HEADERS,
  PJN_INTERVINIENTES_HEADERS,
  PJN_LIST_HEADERS,
  PJN_SCW_PATHS,
  PJN_SELECTORS,
  type PjnActuacionHeaderKey,
  type PjnHeaderKey,
  type PjnIntervinienteHeaderKey,
} from './pjn-selectors';

export type PjnListMode =
  | 'relacionados-letrado'
  | 'relacionados-parte'
  | 'favoritos'
  | 'radicaciones'
  | 'unknown';

export interface PjnCaseRow {
  expediente: string;
  dependencia: string;
  caratula: string;
  situacion: string;
  ultimaActualizacion: string;
  isFavorito: boolean;
  detailHref: string;
}

export interface PjnParsedList {
  mode: PjnListMode;
  rows: PjnCaseRow[];
  resolvedColumns: Partial<Record<PjnHeaderKey, number>>;
  unresolvedHeaders: string[];
  headerTexts: string[];
}

// ────────────────────────────────────────────────────────
// Page detection
// ────────────────────────────────────────────────────────

function pathIncludes(pathname: string, needle: string): boolean {
  return pathname.toLowerCase().includes(needle.toLowerCase());
}

export function isScwHomePage(pathname: string): boolean {
  return pathIncludes(pathname, PJN_SCW_PATHS.home);
}

export function isScwListadoRelacionados(pathname: string): boolean {
  return pathIncludes(pathname, 'consultalistarelacionados');
}

export function isScwListadoFavoritos(pathname: string): boolean {
  return pathIncludes(pathname, 'consultalistafavoritos');
}

export function isScwListadoRadicaciones(pathname: string): boolean {
  return pathIncludes(pathname, 'consultalistanoiniciados');
}

export function isScwExpediente(pathname: string): boolean {
  return pathIncludes(pathname, 'expediente.seam');
}

export function isScwActuacionesHistoricas(pathname: string): boolean {
  return pathIncludes(pathname, 'actuacioneshistoricas.seam');
}

/** Páginas donde corre el collector de actuaciones (M6a). */
export function isScwActuacionesPage(pathname: string): boolean {
  return isScwExpediente(pathname) || isScwActuacionesHistoricas(pathname);
}

export function isScwListadoPage(pathname: string): boolean {
  return (
    isScwListadoRelacionados(pathname) ||
    isScwListadoFavoritos(pathname) ||
    isScwListadoRadicaciones(pathname)
  );
}

/**
 * The LETRADO/PARTE toggle lives only in Relacionados. Its HTML is unverified
 * against a real page — we look for an active radio/tab mentioning "PARTE".
 * If we can't tell, we default to 'relacionados-letrado' (portal default).
 */
export function detectListMode(url: URL, doc: Document): PjnListMode {
  const path = url.pathname;
  if (isScwListadoFavoritos(path)) return 'favoritos';
  if (isScwListadoRadicaciones(path)) return 'radicaciones';
  if (isScwListadoRelacionados(path)) {
    const parteActive = doc.querySelector(
      'input[type="radio"][checked][value*="PARTE" i], [aria-pressed="true"][data-value*="PARTE" i]'
    );
    return parteActive ? 'relacionados-parte' : 'relacionados-letrado';
  }
  return 'unknown';
}

// ────────────────────────────────────────────────────────
// List parsing
// ────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function cellText(cell: Element | undefined | null): string {
  return (cell?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Extract "safe" visible text from an element — stops at the first interactive
 * or embedded child (<a>, <button>, <script>, <style>). Used for datos-generales
 * values where the row may contain a favorite-toggle link or inline JS that we
 * must not include in the field value.
 */
function extractSafeText(el: Element): string {
  const parts: string[] = [];
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.textContent ?? '');
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const child = node as Element;
    const tag = child.tagName.toLowerCase();
    if (tag === 'a' || tag === 'button' || tag === 'script' || tag === 'style') break;
    parts.push(extractSafeText(child));
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Strip responsive mobile labels that SCW injects into each <td> as hidden
 * prefix text (e.g. "Fecha: 13/04/2026", "Tipo actuacion: MOVIMIENTO",
 * "Detalle: EN LETRA"). `cellText` concatenates them with the actual value,
 * so we remove known prefixes up front.
 */
const CELL_PREFIX_RE =
  /^(?:fecha|tipo\s*actuaci[óo]n|tipo|descripci[óo]n|detalle|foja|fs|oficina|nombre|tomo(?:\s*\/?\s*folio)?|e\.?j\.?|situaci[óo]n|dependencia|expediente|car[áa]tula)\s*:\s*/i;

function stripCellPrefix(text: string): string {
  return text.replace(CELL_PREFIX_RE, '').trim();
}

function cellValue(cell: Element | undefined | null): string {
  return stripCellPrefix(cellText(cell));
}

/**
 * Detail-link detection. JSF often renders the eye icon as <a href="#"> +
 * onclick postback, so a plain href selector misses it. We try three anchors
 * in order and resolve to '' if all fail — M4 handles JSF navigation.
 */
function findDetailHref(tr: Element): string {
  const direct = tr.querySelector<HTMLAnchorElement>(
    PJN_SELECTORS.scw.detailLink
  );
  if (direct?.href && !direct.href.endsWith('#')) return direct.href;

  const iconWrappers = tr.querySelectorAll<HTMLElement>(
    'i.fa-eye, i.glyphicon-eye-open, i.fa-search'
  );
  for (const icon of iconWrappers) {
    const anchor = icon.closest('a');
    if (anchor?.href && !anchor.href.endsWith('#')) return anchor.href;
  }
  return '';
}

/**
 * SCW pages contain many <table> elements from legacy layout. We pick the
 * first one whose header cells contain at least two known column names.
 */
export function findListTable(doc: Document): HTMLTableElement | null {
  const knownHeaders = Object.values(PJN_LIST_HEADERS).map(normalize);

  for (const selector of PJN_SELECTORS.scw.listTableCandidates) {
    const tables = doc.querySelectorAll<HTMLTableElement>(selector);
    for (const table of tables) {
      const headerCells = table.querySelectorAll('th, thead td');
      if (headerCells.length < 2) continue;

      const headerTexts = Array.from(headerCells).map((c) =>
        normalize(c.textContent ?? '')
      );
      const matches = headerTexts.filter((h) =>
        knownHeaders.some((kh) => h.includes(kh))
      );
      if (matches.length >= 2) return table;
    }
  }
  return null;
}

function resolveColumns(headerTexts: string[]): {
  columns: Partial<Record<PjnHeaderKey, number>>;
  unresolved: string[];
} {
  const columns: Partial<Record<PjnHeaderKey, number>> = {};
  const unresolved: string[] = [];

  headerTexts.forEach((raw, idx) => {
    const h = normalize(raw);
    let matched: PjnHeaderKey | null = null;
    for (const [key, needle] of Object.entries(PJN_LIST_HEADERS) as Array<
      [PjnHeaderKey, string]
    >) {
      if (columns[key] !== undefined) continue;
      if (h.includes(normalize(needle))) {
        matched = key;
        break;
      }
    }
    if (matched) columns[matched] = idx;
    else if (raw) unresolved.push(raw);
  });

  return { columns, unresolved };
}

export function parseScwList(doc: Document, url: URL): PjnParsedList {
  const mode = detectListMode(url, doc);
  const table = findListTable(doc);

  if (!table) {
    return {
      mode,
      rows: [],
      resolvedColumns: {},
      unresolvedHeaders: [],
      headerTexts: [],
    };
  }

  const headerCells = table.querySelectorAll('th, thead td');
  const headerTexts = Array.from(headerCells).map((c) => cellText(c));
  const { columns, unresolved } = resolveColumns(headerTexts);

  const rows: PjnCaseRow[] = [];
  const bodyRows = table.querySelectorAll('tbody tr');

  for (const tr of bodyRows) {
    const cells = tr.querySelectorAll('td');
    if (cells.length === 0) continue;

    const detailHref = findDetailHref(tr);

    let isFavorito = mode === 'favoritos';
    if (!isFavorito) {
      const favoritoAnchor =
        tr.querySelector<HTMLAnchorElement>(PJN_SELECTORS.scw.favoritoLink) ||
        tr.querySelector<HTMLAnchorElement>(
          PJN_SELECTORS.scw.favoritoLinkFallback
        );
      if (favoritoAnchor) {
        const inner = favoritoAnchor.querySelector('img, i');
        const signals = [
          favoritoAnchor.getAttribute('title') ?? '',
          favoritoAnchor.getAttribute('aria-label') ?? '',
          favoritoAnchor.className,
          inner?.getAttribute('alt') ?? '',
          inner?.getAttribute('src') ?? '',
          inner?.className ?? '',
        ]
          .join(' ')
          .toLowerCase();
        // "On" signals (filled star): active/activa/activo, _on/-on, llena, filled,
        // fa-star without the -o suffix, "quitar" in tooltip (means currently favorite).
        const positive = /\b(activ|llen|filled)|[_-]on\b|fa-star(?!-o)|quitar/.test(signals);
        // Negative overrides: explicit empty-star signals.
        const negative = /\b(inactiv|vaci|empty)|[_-]off\b|fa-star-o|agregar/.test(signals);
        isFavorito = positive && !negative;
      }
    }

    rows.push({
      expediente: cellText(cells[columns.expediente ?? -1]),
      dependencia: cellText(cells[columns.dependencia ?? -1]),
      caratula: cellText(cells[columns.caratula ?? -1]),
      situacion: cellText(cells[columns.situacion ?? -1]),
      ultimaActualizacion: cellText(cells[columns.ultimaActualizacion ?? -1]),
      isFavorito,
      detailHref,
    });
  }

  return {
    mode,
    rows,
    resolvedColumns: columns,
    unresolvedHeaders: unresolved,
    headerTexts,
  };
}

// ════════════════════════════════════════════════════════
// M4 — Expediente detail
// ════════════════════════════════════════════════════════

export interface PjnDatosGenerales {
  cid: string;
  expediente: string;
  jurisdiccion: string;
  dependencia: string;
  situacionActual: string;
  caratula: string;
  isFavorito: boolean;
}

export interface PjnActuacionDoc {
  kind: 'download' | 'view';
  href: string;
}

export interface PjnActuacion {
  oficina: string;
  fecha: string;
  tipo: string;
  descripcion: string;
  foja: string;
  hasDocument: boolean;
  documentos: PjnActuacionDoc[];
}

export interface PjnInterviniente {
  tipo: string;
  nombre: string;
  tomoFolio: string;
  iej: string;
}

export interface PjnVinculado {
  raw: string;
}

export interface PjnRecurso {
  raw: string;
  detailHref: string;
}

export type PjnTabName =
  | 'actuaciones'
  | 'intervinientes'
  | 'vinculados'
  | 'recursos';

export interface PjnTabState<T> {
  /** true if the tab's DOM was populated at parse time (user has visited it). */
  loaded: boolean;
  /** true if the tab explicitly shows an empty-state message. */
  isEmpty: boolean;
  rows: T[];
  /** Header texts for debugging — mirrors the M3 list parser. */
  headerTexts?: string[];
}

export interface PjnExpedienteData {
  datosGenerales: PjnDatosGenerales | null;
  activeTab: PjnTabName | 'unknown';
  tabs: {
    actuaciones: PjnTabState<PjnActuacion> & {
      verHistoricasAvailable: boolean;
    };
    intervinientes: PjnTabState<PjnInterviniente>;
    vinculados: PjnTabState<PjnVinculado>;
    recursos: PjnTabState<PjnRecurso>;
  };
  notas: string;
}

// ────────────────────────────────────────────────────────
// Datos generales
// ────────────────────────────────────────────────────────

const DATOS_LABELS: Array<[keyof Omit<PjnDatosGenerales, 'cid' | 'isFavorito'>, RegExp]> = [
  ['expediente', /^expediente$/i],
  ['jurisdiccion', /^jurisdicci[óo]n$/i],
  ['dependencia', /^dependencia$/i],
  ['situacionActual', /^(?:situaci[óo]n(?:\s+actual)?|sit\.?\s*actual)$/i],
  ['caratula', /^car[áa]tula$/i],
];

/**
 * Find the value element adjacent to a label element. Tries:
 *   1. Next element sibling (covers th+td, dt+dd, label+span).
 *   2. Following text nodes until the next element (covers inline "Label: value").
 */
function valueNearLabel(label: Element): string {
  const next = label.nextElementSibling;
  if (next) {
    const t = extractSafeText(next);
    if (t) return t;
  }
  const parts: string[] = [];
  let sib = label.nextSibling;
  while (sib) {
    if (sib.nodeType === Node.TEXT_NODE) {
      parts.push(sib.textContent ?? '');
    } else if (sib.nodeType === Node.ELEMENT_NODE) {
      break;
    }
    sib = sib.nextSibling;
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

export function parseDatosGenerales(doc: Document, url: URL): PjnDatosGenerales | null {
  const cid = new URLSearchParams(url.search).get('cid') ?? '';
  const found: Partial<Omit<PjnDatosGenerales, 'cid' | 'isFavorito'>> = {};

  const candidates = doc.querySelectorAll<HTMLElement>(
    'th, td, dt, dd, label, strong, b, span, div, p, li'
  );

  for (const el of candidates) {
    const raw = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (!raw || raw.length > 40) continue;
    const clean = raw.replace(/[:\s]+$/, '');

    for (const [field, rx] of DATOS_LABELS) {
      if (found[field]) continue;
      if (!rx.test(clean)) continue;
      const val = valueNearLabel(el);
      if (val && val !== raw) found[field] = val;
      break;
    }
  }

  const anyFound = found.expediente || found.caratula || found.dependencia;
  if (!anyFound) return null;

  return {
    cid,
    expediente: found.expediente ?? '',
    jurisdiccion: found.jurisdiccion ?? '',
    dependencia: found.dependencia ?? '',
    situacionActual: found.situacionActual ?? '',
    caratula: found.caratula ?? '',
    isFavorito: detectExpedienteFavoritoStar(doc),
  };
}

function detectExpedienteFavoritoStar(doc: Document): boolean {
  const anchor =
    doc.querySelector<HTMLElement>(PJN_SELECTORS.scw.favoritoLink) ||
    doc.querySelector<HTMLElement>(PJN_SELECTORS.scw.favoritoLinkFallback);
  if (!anchor) return false;
  const inner = anchor.querySelector('img, i');
  const signals = [
    anchor.getAttribute('title') ?? '',
    anchor.getAttribute('aria-label') ?? '',
    anchor.className,
    inner?.getAttribute('alt') ?? '',
    inner?.getAttribute('src') ?? '',
    inner?.className ?? '',
  ]
    .join(' ')
    .toLowerCase();
  const positive = /\b(activ|llen|filled)|[_-]on\b|fa-star(?!-o)|quitar/.test(signals);
  const negative = /\b(inactiv|vaci|empty)|[_-]off\b|fa-star-o|agregar/.test(signals);
  return positive && !negative;
}

// ────────────────────────────────────────────────────────
// Tab detection
// ────────────────────────────────────────────────────────

export function detectActiveTab(doc: Document): PjnTabName | 'unknown' {
  for (const sel of PJN_SELECTORS.expediente.activeTabCandidates) {
    const el = doc.querySelector(sel);
    if (!el) continue;
    const text = normalize(el.textContent ?? '');
    for (const name of PJN_SELECTORS.expediente.tabNames) {
      if (text.includes(name)) return name;
    }
  }
  return 'unknown';
}

// ────────────────────────────────────────────────────────
// Actuaciones tab
// ────────────────────────────────────────────────────────

function resolveActuacionColumns(headerTexts: string[]): {
  columns: Partial<Record<PjnActuacionHeaderKey, number>>;
  unresolved: string[];
} {
  const columns: Partial<Record<PjnActuacionHeaderKey, number>> = {};
  const unresolved: string[] = [];
  headerTexts.forEach((raw, idx) => {
    const h = normalize(raw);
    if (!h) return;
    let matched: PjnActuacionHeaderKey | null = null;
    for (const [key, needle] of Object.entries(PJN_ACTUACIONES_HEADERS) as Array<
      [PjnActuacionHeaderKey, string]
    >) {
      if (columns[key] !== undefined) continue;
      if (h.includes(normalize(needle))) {
        matched = key;
        break;
      }
    }
    if (matched) columns[matched] = idx;
    else unresolved.push(raw);
  });
  return { columns, unresolved };
}

function findActuacionesTable(doc: Document): HTMLTableElement | null {
  const knownHeaders = Object.values(PJN_ACTUACIONES_HEADERS).map(normalize);
  for (const selector of PJN_SELECTORS.scw.listTableCandidates) {
    const tables = doc.querySelectorAll<HTMLTableElement>(selector);
    for (const table of tables) {
      const headerCells = table.querySelectorAll('th, thead td');
      if (headerCells.length < 3) continue;
      const texts = Array.from(headerCells).map((c) => normalize(c.textContent ?? ''));
      const matches = texts.filter((h) => knownHeaders.some((kh) => h.includes(kh)));
      // Require fecha + tipo — distinguishes actuaciones from the listing table.
      if (
        matches.length >= 3 &&
        texts.some((t) => t.includes('fecha')) &&
        texts.some((t) => t.includes('tipo'))
      ) {
        return table;
      }
    }
  }
  return null;
}

function findRowDocuments(tr: Element): PjnActuacionDoc[] {
  const docs: PjnActuacionDoc[] = [];
  const anchors = tr.querySelectorAll<HTMLAnchorElement>('a');
  for (const a of anchors) {
    const title = (a.getAttribute('title') ?? '').toLowerCase();
    const href = a.href || '';
    if (!href.includes('viewer.seam')) continue;
    const downloadFlag = href.includes('download=true') || /descarg/i.test(title);
    const eye =
      !!a.querySelector('i.fa-eye, i.glyphicon-eye-open') || /ver|inline/i.test(title);
    docs.push({ kind: downloadFlag ? 'download' : eye ? 'view' : 'download', href });
  }
  return docs;
}

export function parseActuacionesTab(doc: Document): PjnTabState<PjnActuacion> & {
  verHistoricasAvailable: boolean;
} {
  const table = findActuacionesTable(doc);
  const verHistoricasAvailable = !!Array.from(
    doc.querySelectorAll<HTMLElement>('button, a, input[type="button"], input[type="submit"]')
  ).find((el) =>
    PJN_SELECTORS.expediente.verHistoricasPattern.test(
      el.textContent ?? el.getAttribute('value') ?? ''
    )
  );

  if (!table) {
    return {
      loaded: false,
      isEmpty: false,
      rows: [],
      headerTexts: [],
      verHistoricasAvailable,
    };
  }

  const headerCells = table.querySelectorAll('th, thead td');
  const headerTexts = Array.from(headerCells).map((c) => cellText(c));
  const { columns } = resolveActuacionColumns(headerTexts);

  const rows: PjnActuacion[] = [];
  const bodyRows = table.querySelectorAll('tbody tr');
  for (const tr of bodyRows) {
    const cells = tr.querySelectorAll('td');
    if (cells.length === 0) continue;
    const documentos = findRowDocuments(tr);
    rows.push({
      oficina: cellValue(cells[columns.oficina ?? -1]),
      fecha: cellValue(cells[columns.fecha ?? -1]),
      tipo: cellValue(cells[columns.tipo ?? -1]),
      descripcion: cellValue(cells[columns.descripcion ?? -1]),
      foja: cellValue(cells[columns.foja ?? -1]),
      hasDocument: documentos.length > 0,
      documentos,
    });
  }

  return {
    loaded: true,
    isEmpty: rows.length === 0,
    rows,
    headerTexts,
    verHistoricasAvailable,
  };
}

// ────────────────────────────────────────────────────────
// Intervinientes tab
// ────────────────────────────────────────────────────────

function findIntervinientesTable(doc: Document): HTMLTableElement | null {
  const knownHeaders = Object.values(PJN_INTERVINIENTES_HEADERS).map(normalize);
  for (const selector of PJN_SELECTORS.scw.listTableCandidates) {
    const tables = doc.querySelectorAll<HTMLTableElement>(selector);
    for (const table of tables) {
      const headerCells = table.querySelectorAll('th, thead td');
      if (headerCells.length < 2) continue;
      const texts = Array.from(headerCells).map((c) => normalize(c.textContent ?? ''));
      const matches = texts.filter((h) => knownHeaders.some((kh) => h.includes(kh)));
      if (
        matches.length >= 2 &&
        texts.some((t) => t.includes('nombre')) &&
        texts.some((t) => t.includes('tipo'))
      ) {
        return table;
      }
    }
  }
  return null;
}

export function parseIntervinientesTab(doc: Document): PjnTabState<PjnInterviniente> {
  const table = findIntervinientesTable(doc);
  if (!table) {
    return { loaded: false, isEmpty: false, rows: [], headerTexts: [] };
  }

  const headerCells = table.querySelectorAll('th, thead td');
  const headerTexts = Array.from(headerCells).map((c) => cellText(c));
  const columns: Partial<Record<PjnIntervinienteHeaderKey, number>> = {};
  headerTexts.forEach((raw, idx) => {
    const h = normalize(raw);
    for (const [key, needle] of Object.entries(PJN_INTERVINIENTES_HEADERS) as Array<
      [PjnIntervinienteHeaderKey, string]
    >) {
      if (columns[key] !== undefined) continue;
      if (h.includes(normalize(needle))) {
        columns[key] = idx;
        break;
      }
    }
  });

  const rows: PjnInterviniente[] = [];
  const bodyRows = table.querySelectorAll('tbody tr');
  for (const tr of bodyRows) {
    const cells = tr.querySelectorAll('td');
    if (cells.length === 0) continue;
    rows.push({
      tipo: cellValue(cells[columns.tipo ?? -1]),
      nombre: cellValue(cells[columns.nombre ?? -1]),
      tomoFolio: cellValue(cells[columns.tomoFolio ?? -1]),
      iej: cellValue(cells[columns.iej ?? -1]),
    });
  }

  return {
    loaded: true,
    isEmpty: rows.length === 0,
    rows,
    headerTexts,
  };
}

// ────────────────────────────────────────────────────────
// Vinculados and Recursos tabs
// ────────────────────────────────────────────────────────

/**
 * Vinculados and Recursos tabs are structurally under-specified in the plan
 * (§5.5.5-5.5.6) because real data was not available at relevamiento time.
 * We detect the known empty-state message and, when present, capture rows as
 * raw text stubs so M5+ can refine once we see real HTML.
 */
function parseStubTab<T extends { raw: string }>(
  doc: Document,
  emptyPattern: RegExp,
  rowBuilder: (tr: Element) => T | null
): PjnTabState<T> {
  const fullText = doc.body.textContent ?? '';
  if (emptyPattern.test(fullText)) {
    return { loaded: true, isEmpty: true, rows: [], headerTexts: [] };
  }

  const tables = doc.querySelectorAll<HTMLTableElement>('table');
  for (const table of tables) {
    const headerCells = table.querySelectorAll('th, thead td');
    if (headerCells.length < 2) continue;
    const texts = Array.from(headerCells).map((c) => normalize(c.textContent ?? ''));
    // Skip the actuaciones and intervinientes tables already handled.
    if (texts.some((t) => t.includes('fecha')) && texts.some((t) => t.includes('tipo'))) continue;
    if (texts.some((t) => t.includes('nombre')) && texts.some((t) => t.includes('tipo'))) continue;
    // Skip the listing table (if somehow present in detail view).
    if (texts.some((t) => t.includes('caratula')) && texts.some((t) => t.includes('dependencia'))) continue;

    const rows: T[] = [];
    const bodyRows = table.querySelectorAll('tbody tr');
    for (const tr of bodyRows) {
      const built = rowBuilder(tr);
      if (built) rows.push(built);
    }
    if (rows.length > 0) {
      return { loaded: true, isEmpty: false, rows, headerTexts: texts };
    }
  }
  return { loaded: false, isEmpty: false, rows: [], headerTexts: [] };
}

export function parseVinculadosTab(doc: Document): PjnTabState<PjnVinculado> {
  return parseStubTab<PjnVinculado>(
    doc,
    /no posee vinculados/i,
    (tr) => {
      const text = cellText(tr);
      return text ? { raw: text } : null;
    }
  );
}

export function parseRecursosTab(doc: Document): PjnTabState<PjnRecurso> {
  return parseStubTab<PjnRecurso>(
    doc,
    /no posee recursos/i,
    (tr) => {
      const text = cellText(tr);
      if (!text) return null;
      const detailLink = tr.querySelector<HTMLAnchorElement>('a[href*="expediente.seam"]');
      return {
        raw: text,
        detailHref:
          detailLink?.href && !detailLink.href.endsWith('#') ? detailLink.href : '',
      };
    }
  );
}

// ────────────────────────────────────────────────────────
// Notas (footer block of the expediente page)
// ────────────────────────────────────────────────────────

export function parseNotas(doc: Document): string {
  const candidates = doc.querySelectorAll<HTMLElement>(
    'h1, h2, h3, h4, h5, strong, b, legend, label'
  );
  for (const el of candidates) {
    const text = (el.textContent ?? '').trim();
    if (!PJN_SELECTORS.expediente.notasLabelPattern.test(text)) continue;
    const container = el.parentElement;
    if (!container) continue;
    const raw = (container.textContent ?? '').replace(/\s+/g, ' ').trim();
    return raw.replace(/^notas[:\s]*/i, '').trim();
  }
  return '';
}

// ────────────────────────────────────────────────────────
// Orchestrator
// ────────────────────────────────────────────────────────

/**
 * Parse the currently-visible expediente page. Tabs not loaded by the user
 * return { loaded: false } — M4 is parse-on-visit; the caller accumulates
 * results across tab clicks.
 */
export function parseExpedientePage(doc: Document, url: URL): PjnExpedienteData {
  return {
    datosGenerales: parseDatosGenerales(doc, url),
    activeTab: detectActiveTab(doc),
    tabs: {
      actuaciones: parseActuacionesTab(doc),
      intervinientes: parseIntervinientesTab(doc),
      vinculados: parseVinculadosTab(doc),
      recursos: parseRecursosTab(doc),
    },
    notas: parseNotas(doc),
  };
}
