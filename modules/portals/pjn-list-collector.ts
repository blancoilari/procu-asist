import { parseScwList } from './pjn-parser';

export interface PjnCollectedListRows {
  ok: true;
  rows: ReturnType<typeof parseScwList>['rows'];
  pagesVisited: number;
  /** true si se corto por el tope de paginas y quedaban mas por recorrer. */
  truncated: boolean;
}

export async function collectScwListRows(
  options: { maxPages?: number } = {}
): Promise<PjnCollectedListRows> {
  const maxPages = Math.max(1, Math.min(options.maxPages ?? 12, 25));
  const seen = new Set<string>();
  const rows: ReturnType<typeof parseScwList>['rows'] = [];
  let pagesVisited = 0;
  let truncated = false;

  for (let page = 0; page < maxPages; page++) {
    const parsed = parseScwList(document, new URL(window.location.href));
    pagesVisited++;

    for (const row of parsed.rows) {
      const key = [
        normalizeForPaging(row.expediente),
        normalizeForPaging(row.dependencia),
        normalizeForPaging(row.caratula),
      ].join('|');
      if (!key.trim() || seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
    }

    const next = findNextListPageControl();
    if (!next) break;

    // Quedan paginas pero llegamos al tope: avisamos que el resultado esta
    // incompleto en vez de cortar en silencio (y no clickeamos de mas).
    if (page === maxPages - 1) {
      truncated = true;
      break;
    }

    const before = listSignature();
    next.click();
    // El re-render AJAX del SCW puede ser lento: 6s antes de dar por
    // terminada la paginación (cortar antes trunca el listado en silencio).
    const changed = await waitForListSignatureChange(before, 6000);
    if (!changed) break;
  }

  console.debug(
    `[ProcuAsist PJN] Listado recolectado: ${rows.length} filas en ${pagesVisited} página(s)` +
      (truncated ? ' (cortado por tope de páginas, puede haber más)' : '')
  );

  return {
    ok: true,
    rows,
    pagesVisited,
    truncated,
  };
}

/**
 * Find the row matching `targetExpediente` in the current SCW listing and open
 * its detail link (which carries a fresh `cid`). Paginates through the list if
 * needed. Returns true if the case was found and navigation was triggered.
 */
export async function findAndOpenCaseInList(
  targetExpediente: string,
  options: { maxPages?: number } = {}
): Promise<boolean> {
  const maxPages = Math.max(1, Math.min(options.maxPages ?? 15, 25));
  const target = normalizeExpedienteKey(targetExpediente);
  if (!target) return false;

  console.debug(
    `[ProcuAsist PJN] Buscando expediente "${targetExpediente}" (clave: ${target})`
  );

  // SCW server-renders the table, but guard against late hydration.
  await waitForListRows(5000);

  // Attempt 1: search the currently visible list (current tab/sub-tab).
  if (await searchAndOpenInCurrentList(target, maxPages)) return true;

  // Attempt 2 & 3: on Relacionados the rows are split into PARTE / LETRADO
  // sub-tabs and we don't know which one holds the target. Try both.
  const onRelacionados = window.location.pathname
    .toLowerCase()
    .includes('relacionados');
  if (onRelacionados) {
    for (const label of ['LETRADO', 'PARTE'] as const) {
      const btn = findRelacionadosSubTabButton(label);
      if (!btn) continue;
      console.debug(
        `[ProcuAsist PJN] No estaba en la vista actual — probando sub-tab ${label}…`
      );
      const before = listSignature();
      btn.click();
      await waitForListSignatureChange(before, 4000);
      await waitForListRows(3000);
      if (await searchAndOpenInCurrentList(target, maxPages)) return true;
    }
  }

  console.warn(
    `[ProcuAsist PJN] No encontré el expediente "${targetExpediente}" en el listado.`
  );
  return false;
}

async function searchAndOpenInCurrentList(
  target: string,
  maxPages: number
): Promise<boolean> {
  for (let page = 0; page < maxPages; page++) {
    const tr = findRowByExpediente(target);
    if (tr) {
      // Prefer clicking the eye/ver anchor so JSF onclick handlers fire
      // (SCW rows often have href="#" + onclick AJAX submit, so setting
      // window.location.href would no-op).
      const anchor = findRowDetailAnchor(tr);
      if (anchor) {
        console.debug(
          `[ProcuAsist PJN] Clickeando "visualizar" del expediente en la página ${page + 1}`
        );
        anchor.click();
        return true;
      }

      // Fallback: parsed detailHref (real GET URLs only).
      const parsed = parseScwList(document, new URL(window.location.href));
      const match = parsed.rows.find(
        (row) =>
          row.detailHref && normalizeExpedienteKey(row.expediente) === target
      );
      if (match?.detailHref) {
        console.debug(`[ProcuAsist PJN] Fallback a window.location.href`);
        window.location.href = match.detailHref;
        return true;
      }
      console.warn(
        `[ProcuAsist PJN] Fila encontrada pero sin link clickeable`
      );
    }

    const next = findNextListPageControl();
    if (!next) break;

    const before = listSignature();
    next.click();
    const changed = await waitForListSignatureChange(before, 3500);
    if (!changed) break;
  }
  return false;
}

/** Find a row in the visible list whose expediente cell matches `target`. */
function findRowByExpediente(target: string): HTMLTableRowElement | null {
  const rows = document.querySelectorAll<HTMLTableRowElement>('tbody tr');
  for (const tr of rows) {
    for (const cell of tr.querySelectorAll('td')) {
      const text = (cell.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (text && normalizeExpedienteKey(text) === target) {
        return tr;
      }
    }
  }
  return null;
}

/** Locate the row's "ver detalle" anchor (eye icon). Multiple heuristics
 *  because SCW renders the eye differently depending on the list mode. */
function findRowDetailAnchor(tr: Element): HTMLAnchorElement | null {
  // 1. Anchor with a real expediente.seam GET URL.
  const real = tr.querySelector<HTMLAnchorElement>(
    'a[href*="expediente.seam"]'
  );
  if (real) return real;

  // 2. Anchor with accessible name "visualizar..." (SCW's eye icon title).
  const titled = tr.querySelector<HTMLAnchorElement>(
    'a[title*="visualizar" i], a[aria-label*="visualizar" i], a[title*="ver" i]'
  );
  if (titled) return titled;

  // 3. Anchor wrapping a fa-eye / glyphicon-eye-open icon.
  for (const icon of tr.querySelectorAll<HTMLElement>(
    'i.fa-eye, i.glyphicon-eye-open, i.fa-search'
  )) {
    const anchor = icon.closest<HTMLAnchorElement>('a');
    if (anchor) return anchor;
  }

  // 4. Anchor wrapping an eye-like image.
  for (const img of tr.querySelectorAll<HTMLImageElement>('img')) {
    if (/eye|ver|ojo|visualizar/i.test((img.src || '') + (img.alt || ''))) {
      const anchor = img.closest<HTMLAnchorElement>('a');
      if (anchor) return anchor;
    }
  }

  return null;
}

function findRelacionadosSubTabButton(
  label: 'LETRADO' | 'PARTE'
): HTMLElement | null {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      'button, a, input[type="button"], input[type="submit"]'
    )
  );
  const target = label.toUpperCase();
  for (const el of candidates) {
    const text = (
      el.textContent ||
      (el as HTMLInputElement).value ||
      ''
    )
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
    if (text === target) return el;
  }
  return null;
}

function waitForListRows(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const check = () => {
      const hasRows =
        parseScwList(document, new URL(window.location.href)).rows.length > 0;
      if (hasRows || Date.now() - startedAt >= timeoutMs) {
        resolve();
        return;
      }
      window.setTimeout(check, 250);
    };
    check();
  });
}

/**
 * Normalize a PJN expediente identifier (e.g. "CIV 012345/2020") to a stable
 * key ignoring leading zeros and spacing, so list rows match stored cases.
 */
function normalizeExpedienteKey(value: string): string {
  const cleaned = String(value ?? '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
  const match = cleaned.match(/\b([A-Z]{2,5})\s*0*(\d{1,8})\s*\/\s*(\d{4})\b/);
  if (match) {
    return `${match[1]}:${Number(match[2])}:${match[3]}`;
  }
  return cleaned.replace(/[^A-Z0-9/]/g, '');
}

/**
 * Control compartido de "pagina siguiente" para todos los flujos que paginan
 * el listado SCW (recoleccion, findAndOpenCaseInList y notas masivas).
 * Primero busca la flecha "siguiente" clasica; si el paginador solo muestra
 * NUMEROS de pagina (pasa en scw.pjn.gov.ar segun la vista), cae al fallback
 * por links numerados. Si tampoco hay, devuelve null y la paginacion termina.
 */
function findNextListPageControl(): HTMLElement | null {
  return findNextArrowControl() ?? findNumberedNextPageControl();
}

function findNextArrowControl(): HTMLElement | null {
  // RichFaces (JSF) renders the datascroller's page buttons as <td>/<div>/
  // <span> with inline onclick — NOT as real links or buttons — so the
  // selector must include those. Class names cover RichFaces 3 (SCW/Seam)
  // and RichFaces 4 scrollers.
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      'a, button, input[type="button"], input[type="submit"], ' +
        '.rich-datascr-button, .rf-ds-btn, td[onclick], span[onclick], div[onclick]'
    )
  );

  for (const el of candidates) {
    if (!isVisibleElement(el) || isDisabledElement(el)) continue;

    const input = el as HTMLInputElement;
    const label = normalizeForPaging(
      [el.textContent, input.value, el.title, el.getAttribute('aria-label')]
        .filter(Boolean)
        .join(' ')
    );
    const compact = label.replace(/\s+/g, '');

    // Exact single-arrow first: '»»'/'>>' (saltar a la ÚLTIMA página) NO
    // sirve como "siguiente" — matchearlo salteaba las páginas del medio.
    if (compact === '>' || compact === '›' || compact === '»') return el;
    if (
      /\b(proximo|siguiente|next)\b/.test(label) &&
      !/\b(ultimo|ultima|last)\b/.test(label)
    ) {
      return el;
    }
  }

  return null;
}

/**
 * Fallback de paginacion por links NUMERADOS.
 *
 * Algunas vistas del SCW muestran la paginacion solo con numeros (1 2 3 ...),
 * sin flecha "siguiente"; sin este fallback la recoleccion cortaba en la
 * pagina 1 y el usuario veia que "importa de a 15". La estrategia replica la
 * solucion server-side de Estudio_OS: (a) detectar el numero de pagina ACTIVA
 * (elemento marcado como activo/current, o el unico numero NO clickeable) y
 * (b) clickear el control cuyo texto compacto es EXACTAMENTE el numero
 * siguiente (activa + 1). Cubre Bootstrap (ul.pagination li a) y RichFaces
 * (td/span/div con onclick, clases rich-datascr-* y rf-ds-*).
 *
 * Casos que NO deben matchear, documentados aca porque el repo no tiene
 * infraestructura de tests DOM (no hay vitest) y no vale la pena inventarla
 * para un helper solo:
 * - '»»' / '>>' (saltar a la ULTIMA pagina): quedan afuera porque su texto
 *   compacto no es un numero pelado (/^\d+$/).
 * - Numeros dentro de otros textos ("Pagina 2 de 8", "15 resultados"): se
 *   exige igualdad exacta del texto compacto con el numero buscado.
 * - Estar parado en la ultima pagina (no existe activa + 1 clickeable):
 *   devuelve null y la recoleccion termina como corresponde.
 * - Paginador ausente o con un solo numero: devuelve null.
 */
function findNumberedNextPageControl(): HTMLElement | null {
  const items = collectNumericPagingItems();
  if (items.length < 2) return null;

  const active = findActivePageNumber(items);
  if (active === null) return null;

  const wanted = active + 1;
  for (const item of items) {
    if (item.value === wanted && item.clickable) return item.el;
  }
  return null;
}

interface NumericPagingItem {
  el: HTMLElement;
  value: number;
  clickable: boolean;
  active: boolean;
}

// Contenedores tipicos de paginacion: Bootstrap, RichFaces 3 (rich-datascr-*),
// RichFaces 4 (rf-ds-*) y variantes genericas de paginadores JSF.
const PAGING_CONTAINER_SELECTOR = [
  'ul.pagination',
  '.pagination',
  '[class*="datascr"]',
  '[class*="rf-ds"]',
  '[class*="paginator"]',
  '[class*="pager"]',
].join(', ');

/**
 * Junta los elementos de paginacion cuyo texto compacto es un numero pelado,
 * SOLO dentro de contenedores de paginacion (para no confundir numeros de
 * celdas del listado con numeros de pagina).
 */
function collectNumericPagingItems(): NumericPagingItem[] {
  const items: NumericPagingItem[] = [];
  const seen = new Set<HTMLElement>();

  for (const container of document.querySelectorAll<HTMLElement>(
    PAGING_CONTAINER_SELECTOR
  )) {
    // El contenedor matcheado tambien es candidato: en RichFaces 3 el numero
    // es el <td class="rich-datascr-*"> MISMO (texto directo, sin hijos), y
    // querySelectorAll solo mira descendientes.
    const candidates: HTMLElement[] = [
      container,
      ...container.querySelectorAll<HTMLElement>('a, button, td, span, div, li'),
    ];
    for (const el of candidates) {
      if (seen.has(el)) continue;
      // Los wrappers con varios hijos concatenan digitos ("1" + "2" = "12"):
      // no son un numero de pagina, se descartan.
      if (el.childElementCount > 1) continue;

      const compact = compactPagingLabel(el);
      if (!/^\d{1,4}$/.test(compact)) continue;

      // Nos quedamos con el elemento MAS INTERNO que porta el numero, para
      // no contar dos veces el <li> y su <a>.
      const inner = el.querySelector<HTMLElement>('a, button, td, span, div');
      if (inner && compactPagingLabel(inner) === compact) continue;

      if (!isVisibleElement(el) || isDisabledElement(el)) continue;

      seen.add(el);
      items.push({
        el,
        value: Number(compact),
        clickable: isClickablePagingControl(el),
        active: isActivePagingControl(el),
      });
    }
  }

  return items;
}

/**
 * Numero de la pagina activa, o null si no se puede determinar sin
 * ambiguedad (mejor no paginar a ciegas que clickear cualquier cosa).
 */
function findActivePageNumber(items: NumericPagingItem[]): number | null {
  // 1. Marcado explicito de "pagina actual" (clase active/current, etc.).
  const marked = items.filter((item) => item.active);
  if (marked.length === 1) return marked[0].value;
  if (marked.length > 1) return null;

  // 2. Heuristica: la pagina activa suele ser el UNICO numero no clickeable
  //    del paginador (los demas son links).
  const inert = items.filter((item) => !item.clickable);
  if (inert.length === 1) return inert[0].value;
  return null;
}

function isClickablePagingControl(el: HTMLElement): boolean {
  if (el.hasAttribute('onclick')) return true;
  if (el instanceof HTMLButtonElement) return !el.disabled;
  if (el instanceof HTMLAnchorElement) {
    // JSF suele renderizar href="#" + onclick; un <a> sin href ni onclick
    // no es un control, es tipografia.
    return el.hasAttribute('href');
  }
  if (el instanceof HTMLInputElement) {
    return (el.type === 'button' || el.type === 'submit') && !el.disabled;
  }
  return false;
}

function isActivePagingControl(el: HTMLElement): boolean {
  const ACTIVE_RE =
    /\b(active|current|rich-datascr-act|rf-ds-act|rf-ds-cur|ui-state-active)\b/;
  // Se mira el elemento y su item contenedor inmediato (li o td), NO
  // ancestros arbitrarios: un panel con clase "active" mas arriba marcaria
  // como activos a TODOS los numeros.
  const scopes = [el, el.closest<HTMLElement>('li, td')];
  for (const scope of scopes) {
    if (!scope) continue;
    if (ACTIVE_RE.test(scope.className)) return true;
    const aria = scope.getAttribute('aria-current');
    if (aria === 'page' || aria === 'true') return true;
  }
  return false;
}

function compactPagingLabel(el: HTMLElement): string {
  return normalizeForPaging(el.textContent).replace(/\s+/g, '');
}

function waitForListSignatureChange(
  previousSignature: string,
  timeoutMs: number
): Promise<boolean> {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const check = () => {
      if (listSignature() !== previousSignature) {
        resolve(true);
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        resolve(false);
        return;
      }
      window.setTimeout(check, 150);
    };
    window.setTimeout(check, 150);
  });
}

function listSignature(): string {
  const parsed = parseScwList(document, new URL(window.location.href));
  return parsed.rows
    .map((row) =>
      [
        normalizeForPaging(row.expediente),
        normalizeForPaging(row.ultimaActualizacion),
        normalizeForPaging(row.situacion),
      ].join(':')
    )
    .join(';');
}

function isVisibleElement(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function isDisabledElement(el: HTMLElement): boolean {
  const input = el as HTMLInputElement;
  return (
    input.disabled ||
    el.getAttribute('aria-disabled') === 'true' ||
    /\b(disabled|ui-state-disabled|rf-dsbl|rf-ds-dis|rich-datascr-button-dsbld)\b/i.test(
      el.className
    )
  );
}

function normalizeForPaging(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
