/**
 * M6b.1 — Botón flotante + modal de selección de actuaciones en páginas SCW.
 *
 * Aparece en `expediente.seam` y `actuacionesHistoricas.seam`. Al clickear,
 * llama al collector M6a (`collectAllActuaciones`) para obtener la lista
 * completa de actuaciones y las muestra en un modal con checkboxes. En
 * M6b.1 solo se verifica la UI y la recolección — la descarga del ZIP llega
 * en M6b.3.
 *
 * Sigue el patrón del botón ZIP de MEV (ver `entrypoints/mev.content.ts`):
 * FAB en la esquina inferior derecha con color del portal.
 */

import {
  collectAllActuaciones,
  type PjnCollectorResult,
} from './pjn-actuaciones-collector';
import type { PjnActuacion } from './pjn-parser';
import {
  ICON_PACKAGE,
  ICON_LOADER,
  ICON_X,
  iconLabel,
} from '@/modules/ui/icon-strings';

// Azul de ProcuAsist (mismo tono que el panel de debug) — preferencia del
// usuario sobre el granate PJN del plan original.
const FAB_COLOR = '#2a5d9f';
const FAB_HOVER = '#1e4577';
const BUTTON_ID = 'procu-asist-pjn-zip';
const MODAL_ID = 'procu-asist-pjn-zip-modal';

export function mountPjnZipButton(): void {
  if (document.getElementById(BUTTON_ID)) return;

  const btn = document.createElement('button');
  btn.id = BUTTON_ID;
  btn.innerHTML = iconLabel(ICON_PACKAGE, 'Descargar ZIP');
  btn.title = 'Descargar actuaciones del expediente como ZIP';
  Object.assign(btn.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    padding: '10px 18px',
    borderRadius: '24px',
    border: 'none',
    backgroundColor: FAB_COLOR,
    color: 'white',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    zIndex: '999999',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'transform 0.2s, background-color 0.2s',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  } satisfies Partial<CSSStyleDeclaration>);

  btn.addEventListener('mouseenter', () => {
    btn.style.transform = 'scale(1.04)';
    btn.style.backgroundColor = FAB_HOVER;
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.transform = 'scale(1)';
    btn.style.backgroundColor = FAB_COLOR;
  });

  btn.addEventListener('click', () => openZipModal(btn));

  document.body.appendChild(btn);
}

// ────────────────────────────────────────────────────────
// Modal
// ────────────────────────────────────────────────────────

interface ModalState {
  all: PjnActuacion[];
  selected: Set<number>; // índices en `all`
}

function openZipModal(btn: HTMLButtonElement): void {
  if (document.getElementById(MODAL_ID)) return;

  const overlay = document.createElement('div');
  overlay.id = MODAL_ID;
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: '9999999',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  } satisfies Partial<CSSStyleDeclaration>);

  const modal = document.createElement('div');
  Object.assign(modal.style, {
    backgroundColor: '#fff',
    borderRadius: '12px',
    width: 'min(920px, 92vw)',
    maxHeight: '86vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
    color: '#1a1a1a',
  } satisfies Partial<CSSStyleDeclaration>);

  // Header
  const header = document.createElement('div');
  Object.assign(header.style, {
    backgroundColor: FAB_COLOR,
    color: 'white',
    padding: '14px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  } satisfies Partial<CSSStyleDeclaration>);
  const title = document.createElement('div');
  title.innerHTML = `<strong style="font-size:15px">Descargar ZIP — PJN</strong>
    <div style="font-size:12px; opacity:0.85; margin-top:2px">Elegí las actuaciones a incluir</div>`;
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = ICON_X;
  Object.assign(closeBtn.style, {
    background: 'transparent',
    border: 'none',
    color: 'white',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
  } satisfies Partial<CSSStyleDeclaration>);
  closeBtn.title = 'Cerrar';
  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onEsc);
  };
  const onEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  closeBtn.addEventListener('click', close);
  header.appendChild(title);
  header.appendChild(closeBtn);

  // Body (se llena asincrónicamente)
  const body = document.createElement('div');
  Object.assign(body.style, {
    padding: '16px 20px',
    overflow: 'auto',
    flex: '1 1 auto',
    fontSize: '13px',
  } satisfies Partial<CSSStyleDeclaration>);
  body.innerHTML = `
    <div style="display:flex; align-items:center; gap:10px; color:#555;">
      <span style="display:inline-flex;">${ICON_LOADER}</span>
      <span>Recolectando actuaciones del expediente…</span>
    </div>
  `;

  // Footer
  const footer = document.createElement('div');
  Object.assign(footer.style, {
    padding: '12px 20px',
    borderTop: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
    background: '#f9fafb',
  } satisfies Partial<CSSStyleDeclaration>);
  const footerInfo = document.createElement('div');
  footerInfo.style.fontSize = '12px';
  footerInfo.style.color = '#555';
  footerInfo.textContent = '';
  const footerButtons = document.createElement('div');
  footerButtons.style.display = 'flex';
  footerButtons.style.gap = '8px';
  footer.appendChild(footerInfo);
  footer.appendChild(footerButtons);

  modal.appendChild(header);
  modal.appendChild(body);
  modal.appendChild(footer);
  overlay.appendChild(modal);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', onEsc);

  document.body.appendChild(overlay);

  runCollectorAndRender(body, footerInfo, footerButtons, btn, close);
}

async function runCollectorAndRender(
  body: HTMLElement,
  footerInfo: HTMLElement,
  footerButtons: HTMLElement,
  originalBtn: HTMLButtonElement,
  close: () => void
): Promise<void> {
  let result: PjnCollectorResult;
  try {
    result = await collectAllActuaciones();
  } catch (err) {
    body.innerHTML = `<div style="color:${FAB_COLOR}; font-size:13px;">
      Error recolectando actuaciones: ${escapeHtml(
        err instanceof Error ? err.message : String(err)
      )}
    </div>`;
    return;
  }

  if (!result.ok) {
    body.innerHTML = `<div style="color:${FAB_COLOR}; font-size:13px;">
      ${escapeHtml(result.error ?? 'Error desconocido')}
    </div>`;
    return;
  }

  if (result.actuaciones.length === 0) {
    const hint = result.verHistoricasHref
      ? `<div style="margin-top:10px; font-size:12px; color:#555;">
          Este expediente tiene actuaciones históricas en otra página.
          <a href="${escapeAttr(result.verHistoricasHref)}" target="_blank" style="color:${FAB_COLOR};">
            Abrir "Ver históricas"
          </a> y volver a intentar desde ahí.
        </div>`
      : '';
    body.innerHTML = `<div style="color:#555; font-size:13px;">
      No se encontraron actuaciones en esta página.
      ${hint}
    </div>`;
    return;
  }

  const state: ModalState = {
    all: result.actuaciones,
    selected: new Set<number>(result.actuaciones.map((_, i) => i)),
  };

  const updateInfo = () => updateFooterCount(footerInfo, state, result);

  renderTable(body, state, updateInfo);

  // Hint: si estamos en expediente.seam y hay botón "Ver históricas" pero no
  // pudimos auto-fetchar (href='#'), avisamos al usuario para que navegue.
  if (
    result.pageKind === 'expediente' &&
    result.verHistoricasHref === '#jsf-button'
  ) {
    const banner = document.createElement('div');
    Object.assign(banner.style, {
      padding: '10px 12px',
      background: '#fef3c7',
      border: '1px solid #fcd34d',
      borderRadius: '8px',
      color: '#78350f',
      fontSize: '12px',
      marginBottom: '12px',
    } satisfies Partial<CSSStyleDeclaration>);
    banner.innerHTML = `<strong>Este expediente tiene actuaciones históricas adicionales.</strong><br>
      Para incluirlas, cerrá este diálogo, clickeá "Ver históricas" abajo a la derecha de la página, y volvé a abrir "Descargar ZIP" desde ahí.`;
    body.insertBefore(banner, body.firstChild);
  }
  renderFooter(footerInfo, footerButtons, state, originalBtn, close);
  updateInfo();
}

function renderTable(
  body: HTMLElement,
  state: ModalState,
  updateInfo: () => void
): void {
  body.innerHTML = '';

  // Barra de selección rápida
  const toolbar = document.createElement('div');
  Object.assign(toolbar.style, {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    marginBottom: '10px',
    fontSize: '12px',
  } satisfies Partial<CSSStyleDeclaration>);
  const selectAll = makeLinkButton('Seleccionar todas', () => {
    for (let i = 0; i < state.all.length; i++) state.selected.add(i);
    renderTable(body, state, updateInfo);
    updateInfo();
  });
  const selectNone = makeLinkButton('Ninguna', () => {
    state.selected.clear();
    renderTable(body, state, updateInfo);
    updateInfo();
  });
  const selectDocsOnly = makeLinkButton(
    'Solo con documento',
    () => {
      state.selected.clear();
      state.all.forEach((a, i) => {
        if (a.hasDocument) state.selected.add(i);
      });
      renderTable(body, state, updateInfo);
      updateInfo();
    }
  );
  toolbar.appendChild(selectAll);
  toolbar.appendChild(selectNone);
  toolbar.appendChild(selectDocsOnly);
  body.appendChild(toolbar);

  const table = document.createElement('table');
  Object.assign(table.style, {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '12px',
  } satisfies Partial<CSSStyleDeclaration>);

  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr style="background:#f3f4f6; text-align:left; color:#374151;">
      <th style="padding:6px 8px; width:36px;"></th>
      <th style="padding:6px 8px; width:92px;">Fecha</th>
      <th style="padding:6px 8px; width:160px;">Tipo</th>
      <th style="padding:6px 8px;">Descripción</th>
      <th style="padding:6px 8px; width:70px;">Fs.</th>
      <th style="padding:6px 8px; width:56px;">Doc.</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  state.all.forEach((a, i) => {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid #eee';
    tr.style.cursor = 'pointer';
    tr.addEventListener('click', (e) => {
      // Click en la fila alterna el checkbox (salvo si el click fue en el checkbox mismo).
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (state.selected.has(i)) state.selected.delete(i);
      else state.selected.add(i);
      renderTable(body, state, updateInfo);
      updateInfo();
    });

    const checked = state.selected.has(i);
    tr.innerHTML = `
      <td style="padding:6px 8px;">
        <input type="checkbox" ${checked ? 'checked' : ''} data-idx="${i}" />
      </td>
      <td style="padding:6px 8px; white-space:nowrap;">${escapeHtml(a.fecha)}</td>
      <td style="padding:6px 8px;">${escapeHtml(a.tipo)}</td>
      <td style="padding:6px 8px; color:#374151;">${escapeHtml(a.descripcion)}</td>
      <td style="padding:6px 8px; white-space:nowrap;">${escapeHtml(a.foja)}</td>
      <td style="padding:6px 8px; text-align:center;">${a.hasDocument ? '📎 ' + a.documentos.length : '—'}</td>
    `;
    const cb = tr.querySelector<HTMLInputElement>('input[type="checkbox"]');
    cb?.addEventListener('change', () => {
      if (cb.checked) state.selected.add(i);
      else state.selected.delete(i);
      updateInfo();
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  body.appendChild(table);
}

function makeLinkButton(text: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  Object.assign(b.style, {
    background: 'transparent',
    border: '1px solid #d1d5db',
    borderRadius: '999px',
    padding: '3px 10px',
    fontSize: '11px',
    color: '#374151',
    cursor: 'pointer',
  } satisfies Partial<CSSStyleDeclaration>);
  b.addEventListener('click', onClick);
  return b;
}

function renderFooter(
  info: HTMLElement,
  buttons: HTMLElement,
  state: ModalState,
  originalBtn: HTMLButtonElement,
  close: () => void
): void {
  buttons.innerHTML = '';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancelar';
  Object.assign(cancelBtn.style, {
    background: 'transparent',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    padding: '8px 14px',
    fontSize: '13px',
    cursor: 'pointer',
    color: '#374151',
  } satisfies Partial<CSSStyleDeclaration>);
  cancelBtn.addEventListener('click', close);

  const continueBtn = document.createElement('button');
  continueBtn.textContent = 'Continuar (M6b.3)';
  continueBtn.title =
    'La descarga del ZIP todavía no está implementada. En M6b.1 solo verificamos la selección.';
  Object.assign(continueBtn.style, {
    background: FAB_COLOR,
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  } satisfies Partial<CSSStyleDeclaration>);
  continueBtn.addEventListener('click', () => {
    const picked = Array.from(state.selected)
      .sort((a, b) => a - b)
      .map((i) => state.all[i]);
    console.groupCollapsed(
      `%c[ProcuAsist PJN M6b.1] selección confirmada (${picked.length} actuaciones)`,
      `color: ${FAB_COLOR}; font-weight: bold;`
    );
    console.table(
      picked.map((a) => ({
        fecha: a.fecha,
        tipo: a.tipo,
        descripcion: a.descripcion.slice(0, 60),
        foja: a.foja,
        docs: a.documentos.length,
      }))
    );
    console.log('Actuaciones seleccionadas:', picked);
    console.groupEnd();

    // Feedback visible en el propio modal
    info.innerHTML = `<span style="color:${FAB_COLOR}; font-weight:600;">
      Selección registrada (${picked.length}). La descarga del ZIP llega en M6b.3.
      Ver detalles en la consola.
    </span>`;

    // Indicador también en el botón flotante
    originalBtn.innerHTML = iconLabel(ICON_PACKAGE, `ZIP (${picked.length})`);
    setTimeout(() => {
      originalBtn.innerHTML = iconLabel(ICON_PACKAGE, 'Descargar ZIP');
    }, 4000);
  });

  buttons.appendChild(cancelBtn);
  buttons.appendChild(continueBtn);
}

function updateFooterCount(
  info: HTMLElement,
  state: ModalState,
  result: PjnCollectorResult
): void {
  const pageKindLabel =
    result.pageKind === 'historicas'
      ? 'históricas'
      : result.pageKind === 'expediente'
      ? 'expediente'
      : '—';
  info.textContent = `${state.selected.size} / ${state.all.length} seleccionadas · origen: ${pageKindLabel} · ${result.pages.length} página(s)`;
}

// ────────────────────────────────────────────────────────
// Utilidades
// ────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, '&#39;');
}
