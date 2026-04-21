/**
 * M3 debug panel — floating widget on scw.pjn.gov.ar list pages that reports
 * how many rows the parser resolved and lets you expand a table to verify
 * them. Gated to list pages only; removed/flag-gated in M8 once there is
 * real UI.
 */

import type { PjnParsedList } from './pjn-parser';

const PANEL_ID = 'procuasist-pjn-debug-panel';

const MODE_LABELS: Record<string, string> = {
  'relacionados-letrado': 'Relacionados (Letrado)',
  'relacionados-parte': 'Relacionados (Parte)',
  favoritos: 'Favoritos',
  radicaciones: 'Radicaciones',
  unknown: 'Desconocido',
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderDebugPanel(result: PjnParsedList): void {
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
      max-width: 640px;
    }
    #${PANEL_ID} header {
      display: flex; align-items: center; justify-content: space-between;
      gap: 12px; padding: 8px 12px; background: #2a5d9f; color: #fff;
      cursor: pointer; user-select: none; font-size: 13px;
    }
    #${PANEL_ID} .pa-body { padding: 8px 12px; max-height: 400px; overflow: auto; display: none; }
    #${PANEL_ID}[data-open="true"] .pa-body { display: block; }
    #${PANEL_ID} table { width: 100%; border-collapse: collapse; font-size: 12px; }
    #${PANEL_ID} th, #${PANEL_ID} td { text-align: left; padding: 4px 6px; border-bottom: 1px solid #eee; vertical-align: top; }
    #${PANEL_ID} th { font-weight: 600; color: #2a5d9f; background: #f6f8fb; position: sticky; top: 0; }
    #${PANEL_ID} .pa-warn { color: #a84; font-style: italic; margin-top: 6px; font-size: 12px; }
    #${PANEL_ID} .pa-empty { color: #888; font-style: italic; padding: 12px; text-align: center; }
  `;
  panel.appendChild(style);

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
  panel.setAttribute('data-open', wasOpen ? 'true' : 'false');

  header.addEventListener('click', () => {
    const open = panel!.getAttribute('data-open') === 'true';
    panel!.setAttribute('data-open', open ? 'false' : 'true');
  });
}
