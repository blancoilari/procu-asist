/**
 * Offscreen document for DOM parsing.
 * MV3 service workers cannot access DOM APIs,
 * so we use an offscreen document for HTML parsing tasks.
 */

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'PARSE_CASE_HTML') {
    const { html, portal } = message as {
      type: string;
      html: string;
      portal: 'mev' | 'pjn';
    };
    try {
      const result = parseCaseHtml(html, portal);
      sendResponse({ status: 'ok', data: result });
    } catch (err) {
      sendResponse({
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
    return true;
  }
});

interface ParsedMovement {
  date: string;
  type: string;
  description: string;
}

interface ParseResult {
  movements: ParsedMovement[];
  caseNumber?: string;
  title?: string;
  court?: string;
  isLoginPage: boolean;
}

function parseCaseHtml(html: string, portal: 'mev' | 'pjn'): ParseResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  if (portal === 'mev') {
    return parseMevHtml(doc, html);
  }

  if (portal === 'pjn') {
    return parsePjnHtml(doc);
  }

  return { movements: [], isLoginPage: false };
}

/**
 * Parse PJN/EJE HTML.
 * Since EJE is an Angular SPA, the HTML we receive from API intercepts
 * may be limited. We extract what we can from the rendered content.
 */
function parsePjnHtml(doc: Document): ParseResult {
  const movements: ParsedMovement[] = [];

  // Try to find actuaciones table (mat-table with mat-row elements)
  const rows = doc.querySelectorAll('mat-row, tr[role="row"]');
  for (const row of rows) {
    const cells = row.querySelectorAll('mat-cell, td');
    if (cells.length < 3) continue;

    const titulo = cells[0]?.textContent?.trim() ?? '';
    const numero = cells[1]?.textContent?.trim() ?? '';
    const fecha = cells[2]?.textContent?.trim() ?? '';

    if (!titulo || !fecha) continue;

    let tipo = '';
    if (titulo.match(/^(ESC|ESCR)/i)) tipo = 'escrito';
    else if (titulo.match(/^(CED|CÉD)/i)) tipo = 'cedula';
    else if (titulo.match(/^(NOT|NOTA)/i)) tipo = 'nota';
    else tipo = 'despacho';

    movements.push({
      date: fecha.substring(0, 10),
      type: tipo,
      description: `${titulo} (${numero})`,
    });
  }

  // Extract case info if available
  let caseNumber = '';
  let title = '';
  const caratulaEl = doc.querySelector('.fontSizeEncabezadoCaratula');
  if (caratulaEl) {
    const text = caratulaEl.textContent?.trim() ?? '';
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    caseNumber = lines[0] ?? '';
    title = lines.slice(1).join(' ');
  }

  return {
    movements,
    caseNumber,
    title,
    isLoginPage: false,
  };
}

/**
 * Parse MEV procesales.asp HTML.
 * Extracts movements table + basic case info.
 * This mirrors the logic in mev-parser.ts but works on parsed HTML strings
 * rather than the live DOM.
 */
function parseMevHtml(doc: Document, rawHtml: string): ParseResult {
  // Check if this is a login page
  const isLoginPage =
    rawHtml.toLowerCase().includes('ingrese los datos del usuario') ||
    !!(
      doc.querySelector("input[name='usuario']") &&
      doc.querySelector("input[name='clave']")
    );

  if (isLoginPage) {
    return { movements: [], isLoginPage: true };
  }

  // Extract basic case info from <td> elements
  let caseNumber = '';
  let title = '';
  let court = '';

  const tds = doc.querySelectorAll('td');
  for (const td of tds) {
    const text = td.textContent?.trim() ?? '';
    if (text.startsWith('Expediente:')) {
      caseNumber = text.replace('Expediente:', '').trim();
    } else if (
      text.startsWith('Carátula:') ||
      text.startsWith('Caratula:')
    ) {
      title = text.replace(/^Car[aá]tula:\s*/i, '').trim();
    } else if (
      text.length >= 10 &&
      text.length <= 200 &&
      (text.includes('Juzgado') ||
        text.includes('CAMARA') ||
        text.includes('TRIBUNAL'))
    ) {
      court = text.trim();
    }
  }

  // Extract movements from the table
  const movements: ParsedMovement[] = [];
  const tables = doc.querySelectorAll('table');
  let movTable: HTMLTableElement | null = null;

  for (const table of tables) {
    const firstRow = table.querySelector('tr');
    if (!firstRow) continue;
    const headerText = firstRow.textContent ?? '';
    if (headerText.includes('Fecha') && headerText.includes('Descripci')) {
      movTable = table;
      break;
    }
  }

  if (movTable) {
    const rows = movTable.querySelectorAll('tr');
    // Date pattern: dd/mm/yyyy
    const datePattern = /^\d{2}\/\d{2}\/\d{4}$/;

    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i].querySelectorAll('td');
      if (cells.length < 4) continue;

      const fecha = (cells[0].textContent?.trim() ?? '').substring(0, 10);
      if (!datePattern.test(fecha)) continue;

      const descripcion = cells[3].textContent?.trim() ?? '';
      const hasFirma = !!cells[2]?.querySelector("img[src*='firma']");

      movements.push({
        date: fecha,
        type: hasFirma ? 'firmado' : '',
        description: descripcion,
      });
    }
  }

  return {
    movements,
    caseNumber,
    title,
    court,
    isLoginPage: false,
  };
}
