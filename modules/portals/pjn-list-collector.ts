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
