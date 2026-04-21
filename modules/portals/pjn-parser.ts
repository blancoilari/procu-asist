/**
 * PJN SCW HTML parsers (M3 scope — listings only).
 *
 * Runs in a content script, so the browser already decoded the ISO-8859-1
 * page into an HTMLDocument. Encoding concerns reappear when we fetch scw
 * responses from a background/offscreen context (M5+).
 */

import {
  PJN_LIST_HEADERS,
  PJN_SCW_PATHS,
  PJN_SELECTORS,
  type PjnHeaderKey,
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
