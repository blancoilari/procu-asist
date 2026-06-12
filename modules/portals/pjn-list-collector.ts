import { parseScwList } from './pjn-parser';

export interface PjnCollectedListRows {
  ok: true;
  rows: ReturnType<typeof parseScwList>['rows'];
  pagesVisited: number;
}

export async function collectScwListRows(
  options: { maxPages?: number } = {}
): Promise<PjnCollectedListRows> {
  const maxPages = Math.max(1, Math.min(options.maxPages ?? 12, 25));
  const seen = new Set<string>();
  const rows: ReturnType<typeof parseScwList>['rows'] = [];
  let pagesVisited = 0;

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

    const before = listSignature();
    next.click();
    const changed = await waitForListSignatureChange(before, 3500);
    if (!changed) break;
  }

  return {
    ok: true,
    rows,
    pagesVisited,
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

function findNextListPageControl(): HTMLElement | null {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      'a, button, input[type="button"], input[type="submit"]'
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

    if (/\b(proximo|siguiente|next)\b|[>›»]/.test(label)) {
      return el;
    }
  }

  return null;
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
    /\b(disabled|ui-state-disabled|rf-dsbl)\b/i.test(el.className)
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
