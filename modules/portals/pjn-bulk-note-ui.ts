import type { Bookmark } from '@/modules/portals/types';
import { ICON_FILE_PEN, ICON_LOADER, ICON_X } from '@/modules/ui/icon-strings';
import {
  createPortalActionButton,
  setPortalActionButtonState,
} from '@/modules/ui/portal-action-bar';
import { collectScwListRows } from './pjn-list-collector';
import { parseScwList, type PjnCaseRow } from './pjn-parser';

const ACTION_BAR_ID = 'procu-asist-action-bar';
const CONFIG_BUTTON_ID = 'procu-asist-config';
const BUTTON_ID = 'procu-asist-pjn-bulk-note';
const MODAL_ID = 'procu-asist-pjn-bulk-note-modal';

type NoteRowStatus =
  | 'eligible'
  | 'not-bookmarked'
  | 'en-letra'
  | 'missing-case-number';

interface NoteCandidate {
  row: PjnCaseRow;
  status: NoteRowStatus;
  selected: boolean;
}

export function mountPjnBulkNoteButton(url: URL): void {
  if (document.getElementById(BUTTON_ID)) return;

  const parsed = parseScwList(document, url);
  if (parsed.mode !== 'relacionados-letrado') return;

  const bar = document.getElementById(ACTION_BAR_ID);
  if (!(bar instanceof HTMLDivElement)) return;

  const btn = createPortalActionButton({
    id: BUTTON_ID,
    icon: ICON_FILE_PEN,
    label: 'Notas PJN',
    title: 'Preparar nota masiva para relacionados como letrado guardados',
    variant: isPjnNoteDay() ? 'primary' : 'secondary',
  });

  btn.addEventListener('click', () => {
    void openBulkNotePreview(btn);
  });

  const configBtn = document.getElementById(CONFIG_BUTTON_ID);
  if (configBtn?.nextSibling) {
    bar.insertBefore(btn, configBtn.nextSibling);
  } else {
    bar.appendChild(btn);
  }
}

async function openBulkNotePreview(btn: HTMLButtonElement): Promise<void> {
  setPortalActionButtonState(btn, ICON_LOADER, 'Revisando', 'muted');
  btn.disabled = true;

  try {
    const [collected, bookmarks] = await Promise.all([
      collectScwListRows({ maxPages: 25 }),
      getPjnBookmarks(),
    ]);
    const candidates = buildNoteCandidates(collected.rows, bookmarks);
    renderBulkNoteModal(candidates, collected.pagesVisited);
    setPortalActionButtonState(btn, ICON_FILE_PEN, 'Notas PJN', 'primary');
  } catch (err) {
    console.error('[ProcuAsist PJN] bulk note preview error:', err);
    setPortalActionButtonState(btn, ICON_X, 'Error', 'danger');
    window.setTimeout(() => {
      setPortalActionButtonState(btn, ICON_FILE_PEN, 'Notas PJN', 'secondary');
    }, 2500);
  } finally {
    btn.disabled = false;
  }
}

async function getPjnBookmarks(): Promise<Bookmark[]> {
  const response = (await chrome.runtime.sendMessage({
    type: 'GET_BOOKMARKS',
  })) as { success?: boolean; bookmarks?: Bookmark[] };

  if (!response?.success) return [];
  return (response.bookmarks ?? []).filter((bookmark) => bookmark.portal === 'pjn');
}

function buildNoteCandidates(
  rows: PjnCaseRow[],
  bookmarks: Bookmark[]
): NoteCandidate[] {
  const bookmarkedNumbers = new Set(
    bookmarks
      .filter(isPjnLetradoBookmark)
      .map((bookmark) => normalizeCaseNumber(bookmark.caseNumber))
  );

  return rows.map((row) => {
    const caseNumber = normalizeCaseNumber(row.expediente);
    let status: NoteRowStatus = 'eligible';
    if (!caseNumber) status = 'missing-case-number';
    else if (isEnLetra(row.situacion)) status = 'en-letra';
    else if (!bookmarkedNumbers.has(caseNumber)) status = 'not-bookmarked';

    return {
      row,
      status,
      selected: status === 'eligible',
    };
  });
}

function renderBulkNoteModal(candidates: NoteCandidate[], pagesVisited: number): void {
  document.getElementById(MODAL_ID)?.remove();

  const selected = new Set(
    candidates
      .map((candidate, index) => (candidate.selected ? index : -1))
      .filter((index) => index >= 0)
  );

  const overlay = document.createElement('div');
  overlay.id = MODAL_ID;
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '1000000',
    background: 'rgba(15,23,42,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  } satisfies Partial<CSSStyleDeclaration>);

  const modal = document.createElement('div');
  Object.assign(modal.style, {
    width: 'min(920px, calc(100vw - 32px))',
    maxHeight: 'min(720px, calc(100vh - 48px))',
    background: '#ffffff',
    color: '#111827',
    borderRadius: '8px',
    boxShadow: '0 24px 64px rgba(15,23,42,0.28)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  } satisfies Partial<CSSStyleDeclaration>);

  const header = document.createElement('div');
  Object.assign(header.style, {
    padding: '16px 18px',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'space-between',
    gap: '16px',
  } satisfies Partial<CSSStyleDeclaration>);
  header.innerHTML = `<div><strong style="font-size:15px">Dejar nota PJN</strong><div style="font-size:12px;color:#6b7280;margin-top:3px">Relacionados como letrado guardados en marcadores. Paginas revisadas: ${pagesVisited}.</div></div>`;

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = 'Cerrar';
  Object.assign(closeBtn.style, buttonStyle('secondary'));
  closeBtn.addEventListener('click', () => overlay.remove());
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  Object.assign(body.style, {
    overflow: 'auto',
    padding: '14px 18px',
  } satisfies Partial<CSSStyleDeclaration>);

  const summary = document.createElement('div');
  const eligible = candidates.filter((candidate) => candidate.status === 'eligible').length;
  const enLetra = candidates.filter((candidate) => candidate.status === 'en-letra').length;
  const notBookmarked = candidates.filter(
    (candidate) => candidate.status === 'not-bookmarked'
  ).length;
  summary.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:12px">
      ${metric('Seleccionadas', String(selected.size), '#166534')}
      ${metric('Elegibles', String(eligible), '#1d4ed8')}
      ${metric('En letra', String(enLetra), '#92400e')}
      ${metric('No marcadas', String(notBookmarked), '#6b7280')}
    </div>
  `;
  body.appendChild(summary);

  if (!isPjnNoteDay()) {
    const warning = document.createElement('div');
    warning.textContent =
      'Hoy no es martes ni viernes. ProcuAsist prepara el lote, pero no deberia ejecutarse la nota masiva fuera de esos dias.';
    Object.assign(warning.style, {
      marginBottom: '12px',
      padding: '10px 12px',
      border: '1px solid #f59e0b',
      borderRadius: '8px',
      background: '#fffbeb',
      color: '#92400e',
      fontSize: '12px',
      fontWeight: '600',
    } satisfies Partial<CSSStyleDeclaration>);
    body.appendChild(warning);
  }

  const table = document.createElement('table');
  Object.assign(table.style, {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '12px',
  } satisfies Partial<CSSStyleDeclaration>);
  table.innerHTML = `
    <thead>
      <tr style="background:#f3f4f6;text-align:left">
        <th style="${thStyle()}">Nota</th>
        <th style="${thStyle()}">Expediente</th>
        <th style="${thStyle()}">Situacion</th>
        <th style="${thStyle()}">Caratula</th>
        <th style="${thStyle()}">Estado</th>
      </tr>
    </thead>
  `;
  const tbody = document.createElement('tbody');

  candidates.forEach((candidate, index) => {
    const tr = document.createElement('tr');
    tr.style.borderTop = '1px solid #e5e7eb';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = selected.has(index);
    checkbox.disabled = candidate.status !== 'eligible';
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) selected.add(index);
      else selected.delete(index);
      summary.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:12px">
          ${metric('Seleccionadas', String(selected.size), '#166534')}
          ${metric('Elegibles', String(eligible), '#1d4ed8')}
          ${metric('En letra', String(enLetra), '#92400e')}
          ${metric('No marcadas', String(notBookmarked), '#6b7280')}
        </div>
      `;
    });

    tr.appendChild(tdWithNode(checkbox));
    tr.appendChild(td(candidate.row.expediente));
    tr.appendChild(td(candidate.row.situacion || '-'));
    tr.appendChild(td(candidate.row.caratula || '-'));
    tr.appendChild(td(statusLabel(candidate.status)));
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  body.appendChild(table);

  const footer = document.createElement('div');
  Object.assign(footer.style, {
    padding: '12px 18px',
    borderTop: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
  } satisfies Partial<CSSStyleDeclaration>);
  const note = document.createElement('div');
  note.textContent =
    'Siguiente paso: relevar con un expediente real si PJN confirma, navega o deja la nota al hacer click.';
  Object.assign(note.style, {
    color: '#6b7280',
    fontSize: '12px',
  } satisfies Partial<CSSStyleDeclaration>);

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.textContent = 'Copiar detalle';
  Object.assign(copyBtn.style, buttonStyle('primary'));
  copyBtn.addEventListener('click', () => {
    void navigator.clipboard.writeText(buildDetailText(candidates, selected));
    copyBtn.textContent = 'Copiado';
    window.setTimeout(() => {
      copyBtn.textContent = 'Copiar detalle';
    }, 1600);
  });

  footer.appendChild(note);
  footer.appendChild(copyBtn);
  modal.appendChild(header);
  modal.appendChild(body);
  modal.appendChild(footer);
  overlay.appendChild(modal);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
}

function buildDetailText(candidates: NoteCandidate[], selected: Set<number>): string {
  const lines = ['Preparacion de nota PJN'];
  candidates.forEach((candidate, index) => {
    const mark = selected.has(index) ? '[x]' : '[ ]';
    lines.push(
      `${mark} ${candidate.row.expediente} | ${candidate.row.situacion || '-'} | ${statusLabel(candidate.status)} | ${candidate.row.caratula}`
    );
  });
  return lines.join('\n');
}

function statusLabel(status: NoteRowStatus): string {
  switch (status) {
    case 'eligible':
      return 'Lista para nota';
    case 'en-letra':
      return 'Excluida: EN LETRA';
    case 'not-bookmarked':
      return 'Excluida: no esta en marcadores letrado';
    case 'missing-case-number':
      return 'Excluida: sin expediente';
  }
}

function isPjnLetradoBookmark(bookmark: Bookmark): boolean {
  return bookmark.metadata?.source === 'pjn-relacionados-letrado';
}

function metric(label: string, value: string, color: string): string {
  return `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:8px 10px"><div style="font-size:10px;color:#6b7280;text-transform:uppercase;font-weight:700">${label}</div><div style="font-size:18px;color:${color};font-weight:800">${value}</div></div>`;
}

function thStyle(): string {
  return 'padding:8px;border-bottom:1px solid #d1d5db;font-size:11px;color:#374151';
}

function td(textValue: string): HTMLTableCellElement {
  const cell = document.createElement('td');
  cell.textContent = textValue;
  Object.assign(cell.style, {
    padding: '8px',
    verticalAlign: 'top',
    maxWidth: '360px',
  } satisfies Partial<CSSStyleDeclaration>);
  return cell;
}

function tdWithNode(node: Node): HTMLTableCellElement {
  const cell = td('');
  cell.appendChild(node);
  return cell;
}

function buttonStyle(variant: 'primary' | 'secondary'): Partial<CSSStyleDeclaration> {
  return {
    borderRadius: '8px',
    border: variant === 'primary' ? '1px solid #2a5d9f' : '1px solid #d1d5db',
    background: variant === 'primary' ? '#2a5d9f' : '#ffffff',
    color: variant === 'primary' ? '#ffffff' : '#374151',
    fontSize: '12px',
    fontWeight: '700',
    padding: '8px 12px',
    cursor: 'pointer',
  };
}

function isPjnNoteDay(date = new Date()): boolean {
  const day = date.getDay();
  return day === 2 || day === 5;
}

function isEnLetra(value: string): boolean {
  return normalizeText(value) === 'en letra';
}

function normalizeCaseNumber(value: string): string {
  return normalizeText(value).replace(/[^a-z0-9/]+/g, '');
}

function normalizeText(value: string): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
