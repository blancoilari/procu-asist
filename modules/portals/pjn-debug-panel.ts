/**
 * M3/M4 debug panel — floating widget on scw.pjn.gov.ar pages.
 *
 * - M3 (list pages): shows parsed rows from Relacionados/Favoritos/Radicaciones.
 * - M4 (expediente.seam): shows datos generales + per-tab status; accumulates
 *   tab data as the user clicks through the four tabs.
 *
 * Gated to SCW pages only; removed/flag-gated in M8 once there is real UI.
 */

import type {
  PjnExpedienteData,
  PjnParsedList,
  PjnTabName,
} from './pjn-parser';

const PANEL_ID = 'procuasist-pjn-debug-panel';

const MODE_LABELS: Record<string, string> = {
  'relacionados-letrado': 'Relacionados (Letrado)',
  'relacionados-parte': 'Relacionados (Parte)',
  favoritos: 'Favoritos',
  radicaciones: 'Radicaciones',
  unknown: 'Desconocido',
};

const TAB_LABELS: Record<PjnTabName, string> = {
  actuaciones: 'Actuaciones',
  intervinientes: 'Intervinientes',
  vinculados: 'Vinculados',
  recursos: 'Recursos',
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function ensurePanel(): { panel: HTMLElement; wasOpen: boolean } {
  let panel = document.getElementById(PANEL_ID);
  const wasOpen = panel?.getAttribute('data-open') === 'true';

  if (!panel) {
    panel = document.createElement('div');
    panel.id = PANEL_ID;
    document.body.appendChild(panel);
  }

  panel.innerHTML = '';

  const style = document.createElement('style');
  style.textContent = `
    #${PANEL_ID} {
      position: fixed; bottom: 16px; right: 16px; z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px; line-height: 1.4; color: #1a1a1a;
      background: #fff; border: 1px solid #2a5d9f; border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.15); overflow: hidden;
      max-width: 680px;
    }
    #${PANEL_ID} header {
      display: flex; align-items: center; justify-content: space-between;
      gap: 12px; padding: 8px 12px; background: #2a5d9f; color: #fff;
      cursor: pointer; user-select: none; font-size: 13px;
    }
    #${PANEL_ID} .pa-body { padding: 8px 12px; max-height: 480px; overflow: auto; display: none; }
    #${PANEL_ID}[data-open="true"] .pa-body { display: block; }
    #${PANEL_ID} table { width: 100%; border-collapse: collapse; font-size: 12px; }
    #${PANEL_ID} th, #${PANEL_ID} td { text-align: left; padding: 4px 6px; border-bottom: 1px solid #eee; vertical-align: top; }
    #${PANEL_ID} th { font-weight: 600; color: #2a5d9f; background: #f6f8fb; position: sticky; top: 0; }
    #${PANEL_ID} .pa-warn { color: #a84; font-style: italic; margin-top: 6px; font-size: 12px; }
    #${PANEL_ID} .pa-empty { color: #888; font-style: italic; padding: 12px; text-align: center; }
    #${PANEL_ID} section { margin-top: 10px; }
    #${PANEL_ID} section:first-child { margin-top: 0; }
    #${PANEL_ID} h4 {
      margin: 0 0 4px; padding: 0; font-size: 12px; font-weight: 700;
      color: #2a5d9f; text-transform: uppercase; letter-spacing: 0.03em;
    }
    #${PANEL_ID} .pa-dg { display: grid; grid-template-columns: max-content 1fr; gap: 2px 10px; font-size: 12px; }
    #${PANEL_ID} .pa-dg dt { color: #555; font-weight: 600; }
    #${PANEL_ID} .pa-dg dd { margin: 0; }
    #${PANEL_ID} .pa-tab { border: 1px solid #e6e9ef; border-radius: 4px; padding: 6px 8px; margin-top: 6px; }
    #${PANEL_ID} .pa-tab-hd { display: flex; align-items: center; gap: 6px; font-size: 12px; margin-bottom: 4px; }
    #${PANEL_ID} .pa-tab-hd strong { font-weight: 700; color: #2a5d9f; }
    #${PANEL_ID} .pa-badge {
      display: inline-block; font-size: 10px; padding: 1px 6px; border-radius: 10px;
      background: #eee; color: #555;
    }
    #${PANEL_ID} .pa-badge.pa-ok { background: #dff0d8; color: #3c763d; }
    #${PANEL_ID} .pa-badge.pa-empty-badge { background: #fcf8e3; color: #8a6d3b; }
    #${PANEL_ID} .pa-badge.pa-pending { background: #f2dede; color: #a94442; }
    #${PANEL_ID} .pa-badge.pa-active { background: #2a5d9f; color: #fff; }
    #${PANEL_ID} .pa-muted { color: #888; font-size: 11px; }
  `;
  panel.appendChild(style);

  return { panel, wasOpen };
}

function wireCollapse(panel: HTMLElement, header: HTMLElement, wasOpen: boolean): void {
  panel.setAttribute('data-open', wasOpen ? 'true' : 'false');
  header.addEventListener('click', () => {
    const open = panel.getAttribute('data-open') === 'true';
    panel.setAttribute('data-open', open ? 'false' : 'true');
  });
}

// ────────────────────────────────────────────────────────
// M3 — list view
// ────────────────────────────────────────────────────────

export function renderDebugPanel(result: PjnParsedList): void {
  const { panel, wasOpen } = ensurePanel();

  const header = document.createElement('header');
  header.innerHTML = `
    <span><strong>ProcuAsist</strong> — ${escapeHtml(MODE_LABELS[result.mode] ?? result.mode)}</span>
    <span>${result.rows.length} causas ▾</span>
  `;
  panel.appendChild(header);

  const body = document.createElement('div');
  body.className = 'pa-body';

  if (result.rows.length === 0) {
    const headersFound = result.headerTexts.join(' | ') || '(ninguno)';
    body.innerHTML = `<div class="pa-empty">No se detectaron causas.<br><small>Headers detectados: ${escapeHtml(headersFound)}</small></div>`;
  } else {
    const rowsHtml = result.rows
      .map(
        (r) => `
        <tr>
          <td>${escapeHtml(r.expediente)}</td>
          <td>${escapeHtml(r.caratula)}</td>
          <td>${escapeHtml(r.situacion)}</td>
          <td>${escapeHtml(r.ultimaActualizacion)}</td>
          <td>${r.isFavorito ? '★' : '☆'}</td>
        </tr>`
      )
      .join('');
    body.innerHTML = `
      <table>
        <thead><tr>
          <th>Expediente</th><th>Carátula</th><th>Situación</th><th>Últ. Act.</th><th>★</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    `;
  }

  if (result.unresolvedHeaders.length) {
    const warn = document.createElement('div');
    warn.className = 'pa-warn';
    warn.textContent = `Headers sin mapear: ${result.unresolvedHeaders.join(', ')}`;
    body.appendChild(warn);
  }

  panel.appendChild(body);
  wireCollapse(panel, header, wasOpen);
}

// ────────────────────────────────────────────────────────
// M4 — expediente detail view
// ────────────────────────────────────────────────────────

function renderDatosGenerales(data: PjnExpedienteData): string {
  const dg = data.datosGenerales;
  if (!dg) {
    return `<section><h4>Datos generales</h4><div class="pa-muted">No se pudo parsear la cabecera del expediente.</div></section>`;
  }
  const rows: Array<[string, string]> = [
    ['Expediente', dg.expediente],
    ['Carátula', dg.caratula],
    ['Jurisdicción', dg.jurisdiccion],
    ['Dependencia', dg.dependencia],
    ['Situación', dg.situacionActual],
    ['Favorito', dg.isFavorito ? '★ sí' : '☆ no'],
    ['cid', dg.cid],
  ];
  const body = rows
    .filter(([, v]) => v)
    .map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`)
    .join('');
  return `<section><h4>Datos generales</h4><dl class="pa-dg">${body}</dl></section>`;
}

function tabBadge(
  name: PjnTabName,
  state: { loaded: boolean; isEmpty: boolean; rows: unknown[] },
  activeTab: PjnTabName | 'unknown'
): string {
  const parts: string[] = [];
  if (activeTab === name) {
    parts.push('<span class="pa-badge pa-active">activa</span>');
  }
  if (!state.loaded) {
    parts.push('<span class="pa-badge pa-pending">no visitada</span>');
  } else if (state.isEmpty) {
    parts.push('<span class="pa-badge pa-empty-badge">vacía</span>');
  } else {
    parts.push(`<span class="pa-badge pa-ok">${state.rows.length} filas</span>`);
  }
  return parts.join(' ');
}

function renderActuaciones(data: PjnExpedienteData): string {
  const st = data.tabs.actuaciones;
  const badge = tabBadge('actuaciones', st, data.activeTab);
  const vh = st.verHistoricasAvailable
    ? '<span class="pa-badge pa-ok">Ver históricas disponible</span>'
    : '<span class="pa-badge">sin Ver históricas</span>';

  if (!st.loaded) {
    return `<div class="pa-tab">
      <div class="pa-tab-hd"><strong>${TAB_LABELS.actuaciones}</strong> ${badge} ${vh}</div>
      <div class="pa-muted">Hacé click en la pestaña Actuaciones para parsearla.</div>
    </div>`;
  }
  if (st.isEmpty) {
    return `<div class="pa-tab">
      <div class="pa-tab-hd"><strong>${TAB_LABELS.actuaciones}</strong> ${badge} ${vh}</div>
      <div class="pa-muted">Sin filas. Headers: ${escapeHtml((st.headerTexts ?? []).join(' | '))}</div>
    </div>`;
  }

  const rowsHtml = st.rows
    .slice(0, 50)
    .map(
      (r) => `
      <tr>
        <td>${escapeHtml(r.fecha)}</td>
        <td>${escapeHtml(r.tipo)}</td>
        <td>${escapeHtml(r.descripcion)}</td>
        <td>${escapeHtml(r.foja)}</td>
        <td>${r.hasDocument ? `📎 ${r.documentos.length}` : ''}</td>
      </tr>`
    )
    .join('');
  const truncated = st.rows.length > 50
    ? `<div class="pa-muted">(mostrando 50 de ${st.rows.length})</div>`
    : '';

  return `<div class="pa-tab">
    <div class="pa-tab-hd"><strong>${TAB_LABELS.actuaciones}</strong> ${badge} ${vh}</div>
    <table>
      <thead><tr>
        <th>Fecha</th><th>Tipo</th><th>Descripción</th><th>Fs</th><th>Docs</th>
      </tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    ${truncated}
  </div>`;
}

function renderIntervinientes(data: PjnExpedienteData): string {
  const st = data.tabs.intervinientes;
  const badge = tabBadge('intervinientes', st, data.activeTab);

  if (!st.loaded) {
    return `<div class="pa-tab">
      <div class="pa-tab-hd"><strong>${TAB_LABELS.intervinientes}</strong> ${badge}</div>
      <div class="pa-muted">Hacé click en la pestaña Intervinientes para parsearla.</div>
    </div>`;
  }
  if (st.isEmpty) {
    return `<div class="pa-tab">
      <div class="pa-tab-hd"><strong>${TAB_LABELS.intervinientes}</strong> ${badge}</div>
      <div class="pa-muted">Sin filas. Headers: ${escapeHtml((st.headerTexts ?? []).join(' | '))}</div>
    </div>`;
  }

  const rowsHtml = st.rows
    .map(
      (r) => `
      <tr>
        <td>${escapeHtml(r.tipo)}</td>
        <td>${escapeHtml(r.nombre)}</td>
        <td>${escapeHtml(r.tomoFolio)}</td>
        <td>${escapeHtml(r.iej)}</td>
      </tr>`
    )
    .join('');

  return `<div class="pa-tab">
    <div class="pa-tab-hd"><strong>${TAB_LABELS.intervinientes}</strong> ${badge}</div>
    <table>
      <thead><tr>
        <th>Tipo</th><th>Nombre</th><th>Tomo/Folio</th><th>I.E.J.</th>
      </tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </div>`;
}

function renderStubTab(
  name: 'vinculados' | 'recursos',
  data: PjnExpedienteData
): string {
  const st = data.tabs[name];
  const badge = tabBadge(name, st, data.activeTab);

  if (!st.loaded) {
    return `<div class="pa-tab">
      <div class="pa-tab-hd"><strong>${TAB_LABELS[name]}</strong> ${badge}</div>
      <div class="pa-muted">Hacé click en la pestaña ${TAB_LABELS[name]} para parsearla.</div>
    </div>`;
  }
  if (st.isEmpty) {
    return `<div class="pa-tab">
      <div class="pa-tab-hd"><strong>${TAB_LABELS[name]}</strong> ${badge}</div>
      <div class="pa-muted">Sin ${name} (empty-state detectado).</div>
    </div>`;
  }

  const rowsHtml = (st.rows as Array<{ raw: string }>)
    .slice(0, 30)
    .map((r) => `<tr><td>${escapeHtml(r.raw)}</td></tr>`)
    .join('');

  return `<div class="pa-tab">
    <div class="pa-tab-hd"><strong>${TAB_LABELS[name]}</strong> ${badge}</div>
    <table>
      <thead><tr><th>Contenido crudo (pendiente refinar en M5+)</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </div>`;
}

export function renderExpedienteDebugPanel(data: PjnExpedienteData): void {
  const { panel, wasOpen } = ensurePanel();

  const expLabel = data.datosGenerales?.expediente || 'Expediente';
  const loadedCount =
    Number(data.tabs.actuaciones.loaded) +
    Number(data.tabs.intervinientes.loaded) +
    Number(data.tabs.vinculados.loaded) +
    Number(data.tabs.recursos.loaded);

  const header = document.createElement('header');
  header.innerHTML = `
    <span><strong>ProcuAsist</strong> — ${escapeHtml(expLabel)}</span>
    <span>${loadedCount}/4 tabs ▾</span>
  `;
  panel.appendChild(header);

  const body = document.createElement('div');
  body.className = 'pa-body';
  body.innerHTML = `
    ${renderDatosGenerales(data)}
    <section>
      <h4>Pestañas</h4>
      ${renderActuaciones(data)}
      ${renderIntervinientes(data)}
      ${renderStubTab('vinculados', data)}
      ${renderStubTab('recursos', data)}
    </section>
    ${data.notas ? `<section><h4>Notas</h4><div>${escapeHtml(data.notas)}</div></section>` : ''}
  `;

  panel.appendChild(body);
  wireCollapse(panel, header, wasOpen);
}
