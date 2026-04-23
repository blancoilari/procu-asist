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

// ────────────────────────────────────────────────────────
// Categorías nativas de PJN (plan §6)
// ────────────────────────────────────────────────────────

export type PjnCategoryKey = 'despachos' | 'notificaciones' | 'informacion';

const CATEGORY_ORDER: readonly PjnCategoryKey[] = [
  'despachos',
  'notificaciones',
  'informacion',
] as const;

const CATEGORY_LABELS: Record<PjnCategoryKey, string> = {
  despachos: 'Despachos/Escritos',
  notificaciones: 'Notificaciones',
  informacion: 'Información',
};

/**
 * Agrupa un `tipo` de actuación en una de las tres categorías nativas del
 * portal. Cualquier tipo no reconocido cae en "información" por ser el más
 * genérico (eventos administrativos y movimientos de estado).
 */
function classifyTipo(tipo: string): PjnCategoryKey {
  if (/despach|escrito\s+(?:agregado|incorporado|presentado)/i.test(tipo)) {
    return 'despachos';
  }
  if (/c[eé]dula|notificaci/i.test(tipo)) {
    return 'notificaciones';
  }
  // MOVIMIENTO, EVENTO, DEO, y cualquier otro → información.
  return 'informacion';
}

interface ModalState {
  all: PjnActuacion[];
  selected: Set<number>; // índices en `all`
  visibleCategories: Set<PjnCategoryKey>;
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
    visibleCategories: new Set<PjnCategoryKey>(CATEGORY_ORDER),
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
  renderFooter(footerInfo, footerButtons, state, result, originalBtn, close);
  updateInfo();
}

function renderTable(
  body: HTMLElement,
  state: ModalState,
  updateInfo: () => void
): void {
  body.innerHTML = '';

  const rerender = () => {
    renderTable(body, state, updateInfo);
    updateInfo();
  };

  // Fila 1 — Filtros por categoría nativa (plan §6, capa 1).
  body.appendChild(renderCategoryBar(state, rerender));

  // Fila 2 — Selección rápida (solo opera sobre las visibles).
  const visibleIndices = getVisibleIndices(state);
  const toolbar = document.createElement('div');
  Object.assign(toolbar.style, {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    marginBottom: '10px',
    fontSize: '12px',
  } satisfies Partial<CSSStyleDeclaration>);
  const selectAll = makeLinkButton('Seleccionar visibles', () => {
    for (const i of visibleIndices) state.selected.add(i);
    rerender();
  });
  const selectNone = makeLinkButton('Ninguna visible', () => {
    for (const i of visibleIndices) state.selected.delete(i);
    rerender();
  });
  const selectDocsOnly = makeLinkButton('Solo con documento', () => {
    for (const i of visibleIndices) {
      if (state.all[i].hasDocument) state.selected.add(i);
      else state.selected.delete(i);
    }
    rerender();
  });
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
  for (const i of visibleIndices) {
    const a = state.all[i];
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
  }
  table.appendChild(tbody);
  body.appendChild(table);

  if (visibleIndices.length === 0) {
    const empty = document.createElement('div');
    Object.assign(empty.style, {
      padding: '20px',
      textAlign: 'center',
      color: '#6b7280',
      fontSize: '13px',
      fontStyle: 'italic',
    } satisfies Partial<CSSStyleDeclaration>);
    empty.textContent =
      'Ninguna actuación coincide con los filtros seleccionados. Activá alguna categoría arriba para ver resultados.';
    body.appendChild(empty);
  }
}

function getVisibleIndices(state: ModalState): number[] {
  const indices: number[] = [];
  for (let i = 0; i < state.all.length; i++) {
    if (state.visibleCategories.has(classifyTipo(state.all[i].tipo))) {
      indices.push(i);
    }
  }
  return indices;
}

/**
 * La "selección efectiva" es lo que se lleva al ZIP: intersección entre lo
 * que el usuario tildó y las categorías visibles. Filtrar una categoría
 * excluye automáticamente sus filas del resultado final, sin tocar la marca
 * manual del usuario (si rehabilita la categoría, esas filas vuelven).
 */
function getEffectiveSelection(state: ModalState): number[] {
  const visible = new Set(getVisibleIndices(state));
  const result: number[] = [];
  for (const i of state.selected) {
    if (visible.has(i)) result.push(i);
  }
  return result.sort((a, b) => a - b);
}

function countByCategory(
  state: ModalState
): Record<PjnCategoryKey, number> {
  const counts: Record<PjnCategoryKey, number> = {
    despachos: 0,
    notificaciones: 0,
    informacion: 0,
  };
  for (const a of state.all) counts[classifyTipo(a.tipo)]++;
  return counts;
}

function renderCategoryBar(
  state: ModalState,
  rerender: () => void
): HTMLElement {
  const wrap = document.createElement('div');
  Object.assign(wrap.style, {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    marginBottom: '10px',
    padding: '8px 10px',
    background: '#f3f4f6',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    fontSize: '12px',
    flexWrap: 'wrap',
  } satisfies Partial<CSSStyleDeclaration>);

  const label = document.createElement('span');
  label.textContent = 'Categorías:';
  label.style.fontWeight = '600';
  label.style.color = '#374151';
  wrap.appendChild(label);

  const counts = countByCategory(state);

  for (const key of CATEGORY_ORDER) {
    const box = document.createElement('label');
    Object.assign(box.style, {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      cursor: 'pointer',
      padding: '2px 6px',
      borderRadius: '4px',
    } satisfies Partial<CSSStyleDeclaration>);
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = state.visibleCategories.has(key);
    cb.addEventListener('change', () => {
      if (cb.checked) state.visibleCategories.add(key);
      else state.visibleCategories.delete(key);
      rerender();
    });
    const text = document.createElement('span');
    text.textContent = `${CATEGORY_LABELS[key]} (${counts[key]})`;
    text.style.color = '#1f2937';
    box.appendChild(cb);
    box.appendChild(text);
    wrap.appendChild(box);
  }

  // Separator
  const sep = document.createElement('span');
  sep.textContent = '·';
  sep.style.color = '#9ca3af';
  wrap.appendChild(sep);

  // "Ver todos" — atajo. Checked cuando las 3 categorías están activas.
  const allBox = document.createElement('label');
  Object.assign(allBox.style, {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: '4px',
  } satisfies Partial<CSSStyleDeclaration>);
  const allCb = document.createElement('input');
  allCb.type = 'checkbox';
  allCb.checked = state.visibleCategories.size === CATEGORY_ORDER.length;
  allCb.addEventListener('change', () => {
    if (allCb.checked) {
      for (const k of CATEGORY_ORDER) state.visibleCategories.add(k);
    } else {
      state.visibleCategories.clear();
    }
    rerender();
  });
  const allText = document.createElement('span');
  allText.textContent = 'Ver todos';
  allText.style.color = '#1f2937';
  allText.style.fontWeight = '500';
  allBox.appendChild(allCb);
  allBox.appendChild(allText);
  wrap.appendChild(allBox);

  return wrap;
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
  result: PjnCollectorResult,
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
  continueBtn.textContent = 'Descargar ZIP';
  continueBtn.title = 'Generar el ZIP con las actuaciones seleccionadas';
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

  continueBtn.addEventListener('click', async () => {
    const picked = getEffectiveSelection(state).map((i) => state.all[i]);
    if (picked.length === 0) {
      info.innerHTML = `<span style="color:#b91c1c; font-weight:600;">
        Seleccioná al menos una actuación antes de descargar.
      </span>`;
      return;
    }

    const withDocs = picked.filter((a) => a.hasDocument).length;
    const confirmText = `Se van a descargar ${withDocs} PDFs (de ${picked.length} actuaciones). Esto puede tardar varios minutos con ${withDocs > 50 ? 'la gran cantidad de documentos' : 'documentos con adjuntos'}. ¿Continuar?`;
    if (withDocs > 20 && !window.confirm(confirmText)) {
      return;
    }

    // UI: disable buttons, show progress
    continueBtn.disabled = true;
    continueBtn.textContent = 'Generando ZIP…';
    continueBtn.style.opacity = '0.7';
    cancelBtn.disabled = true;
    info.innerHTML = `<span style="color:${FAB_COLOR}; font-weight:600;">
      Descargando ${withDocs} PDFs y empaquetando… Esto puede tardar.
    </span>`;
    originalBtn.innerHTML = iconLabel(ICON_PACKAGE, 'Generando…');

    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'PJN_GENERATE_ZIP',
        actuaciones: picked.map((a) => ({
          fecha: a.fecha,
          tipo: a.tipo,
          descripcion: a.descripcion,
          oficina: a.oficina,
          foja: a.foja,
          hasDocument: a.hasDocument,
          documentos: a.documentos,
        })),
        datosGenerales: result.datosGenerales,
        portalUrl: window.location.href,
      })) as {
        success: boolean;
        filename?: string;
        error?: string;
        stats?: {
          totalActuaciones: number;
          actuacionesConDoc: number;
          docsDescargados: number;
          docsFallidos: number;
          allSuccessful: boolean;
        };
      };

      if (response?.success) {
        const s = response.stats;
        const msg = s
          ? `ZIP listo: ${s.docsDescargados} PDFs descargados${s.docsFallidos > 0 ? `, ${s.docsFallidos} fallaron (ver _verificacion.txt)` : ''}.`
          : 'ZIP generado.';
        info.innerHTML = `<span style="color:#15803d; font-weight:600;">✓ ${escapeHtml(msg)}</span>`;
        originalBtn.innerHTML = iconLabel(ICON_PACKAGE, 'ZIP listo');
        setTimeout(() => {
          originalBtn.innerHTML = iconLabel(ICON_PACKAGE, 'Descargar ZIP');
        }, 6000);
      } else {
        info.innerHTML = `<span style="color:#b91c1c; font-weight:600;">✗ ${escapeHtml(response?.error ?? 'Error desconocido')}</span>`;
        originalBtn.innerHTML = iconLabel(ICON_PACKAGE, 'Descargar ZIP');
      }
    } catch (err) {
      info.innerHTML = `<span style="color:#b91c1c; font-weight:600;">✗ ${escapeHtml(err instanceof Error ? err.message : String(err))}</span>`;
      originalBtn.innerHTML = iconLabel(ICON_PACKAGE, 'Descargar ZIP');
    } finally {
      continueBtn.disabled = false;
      continueBtn.textContent = 'Descargar ZIP';
      continueBtn.style.opacity = '1';
      cancelBtn.disabled = false;
    }
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
  const effective = getEffectiveSelection(state).length;
  const visible = getVisibleIndices(state).length;
  const filtered =
    state.visibleCategories.size < CATEGORY_ORDER.length
      ? ` · ${visible} visibles (filtradas)`
      : '';
  info.textContent = `${effective} / ${state.all.length} seleccionadas para descargar${filtered} · origen: ${pageKindLabel} · ${result.pages.length} página(s)`;
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
