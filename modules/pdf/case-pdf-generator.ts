/**
 * PDF generator for judicial case files (expedientes).
 * Uses jsPDF to create a structured PDF document with:
 * - Case metadata (carátula, juzgado, número, estado, fecha)
 * - Full movements table (fecha, descripción, tipo)
 * - Attachment list (if any)
 *
 * El documento sale sin marca: ni logo, ni color corporativo, ni el nombre de
 * la extensión en el encabezado o el pie. Es una pieza de trabajo del
 * expediente y se lee como tal (decisión del 09/09/2026). Lo único que se
 * imprime es contenido: número, carátula, fechas, movimientos y documentos.
 *
 * Runs in the background service worker (jsPDF doesn't need DOM).
 */

import { jsPDF } from 'jspdf';

/** Data structure for PDF generation */
export interface PdfCaseData {
  caseNumber: string;
  title: string; // carátula
  court: string; // juzgado
  portal: string;
  portalUrl: string;
  fechaInicio?: string;
  estadoPortal?: string;
  numeroReceptoria?: string;
  movements: PdfMovement[];
  attachments?: PdfAttachment[];
}

export interface PdfMovement {
  date: string;
  fojas?: string;
  description: string;
  type?: string; // 'firmado' etc
  hasDocuments: boolean;
}

export interface PdfAttachment {
  name: string;
  url: string;
  movementDate?: string;
}

// ────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────

const PAGE_WIDTH = 210; // A4 mm
const PAGE_HEIGHT = 297;
const MARGIN_LEFT = 15;
const MARGIN_RIGHT = 15;
const MARGIN_TOP = 20;
const MARGIN_BOTTOM = 20;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

// Paleta neutra en grises: nada de color corporativo. Los grises están para
// separar jerarquías y para que una tabla larga se siga leyendo, no para
// decorar.
const COLORS = {
  dark: [20, 20, 20] as [number, number, number],
  gray: [90, 90, 90] as [number, number, number],
  lightGray: [190, 190, 190] as [number, number, number],
  headerBg: [232, 232, 232] as [number, number, number],
  rowEven: [246, 246, 246] as [number, number, number],
};

/**
 * Generate a PDF and return as Blob for download.
 */
export function generateCasePdfBlob(data: PdfCaseData): Blob {
  const doc = createPdfDoc(data);
  return doc.output('blob');
}

/**
 * Generate PDF and return the jsPDF instance (for flexibility).
 */
function createPdfDoc(data: PdfCaseData): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  let y = MARGIN_TOP;
  y = drawHeader(doc, y);
  y = drawCaseMetadata(doc, data, y);

  if (data.movements.length > 0) {
    y = drawMovementsTable(doc, data.movements, y);
  }

  if (data.attachments && data.attachments.length > 0) {
    y = drawAttachmentsList(doc, data.attachments, y);
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawFooter(doc, i, pageCount, data.caseNumber);
  }

  return doc;
}

// ────────────────────────────────────────────────────────
// Drawing Functions
// ────────────────────────────────────────────────────────

function drawHeader(doc: jsPDF, y: number): number {
  // Sin barra de marca. Solo el título del documento y la fecha en que se
  // armó, en gris chico, como una impresión del portal.
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Expediente', MARGIN_LEFT, 12);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.gray);
  const dateStr = new Date().toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  doc.text(`Generado: ${dateStr}`, PAGE_WIDTH - MARGIN_RIGHT, 12, {
    align: 'right',
  });

  doc.setDrawColor(...COLORS.lightGray);
  doc.line(MARGIN_LEFT, 14.5, PAGE_WIDTH - MARGIN_RIGHT, 14.5);

  doc.setTextColor(...COLORS.dark);
  return y + 2;
}

function drawCaseMetadata(
  doc: jsPDF,
  data: PdfCaseData,
  y: number
): number {
  // Sin recuadro de color: el bloque es texto sobre blanco, cerrado por una
  // línea fina. Igual se mide primero, porque de esa medida sale dónde
  // termina el bloque y arranca la tabla.
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const titleLines = doc.splitTextToSize(
    data.title || 'Sin carátula',
    CONTENT_WIDTH - 22
  ) as string[];

  // El portal deja de ser una insignia de color y pasa a ser un dato más.
  const metaItems: string[] = [];
  if (data.portal) metaItems.push(`Portal: ${data.portal.toUpperCase()}`);
  if (data.court) metaItems.push(`Juzgado: ${data.court}`);
  if (data.fechaInicio) metaItems.push(`Inicio: ${data.fechaInicio}`);
  if (data.estadoPortal) metaItems.push(`Estado: ${data.estadoPortal}`);
  if (data.numeroReceptoria) metaItems.push(`Receptoría: ${data.numeroReceptoria}`);
  const col1 = metaItems.slice(0, 2).join('  |  ');
  const col2 = metaItems.slice(2).join('  |  ');

  // Número de expediente
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(data.caseNumber || 'Sin número', MARGIN_LEFT, y + 6);

  // Carátula
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Carátula:', MARGIN_LEFT, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.text(titleLines, MARGIN_LEFT + 20, y + 14);

  let bottom = y + 14 + titleLines.length * 4;

  // Metadatos
  if (metaItems.length > 0) {
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.gray);
    doc.text(col1, MARGIN_LEFT, bottom + 1);
    bottom += 1;
    if (col2) {
      doc.text(col2, MARGIN_LEFT, bottom + 4);
      bottom += 4;
    }
  }

  // Línea de cierre del bloque
  doc.setDrawColor(...COLORS.lightGray);
  doc.line(MARGIN_LEFT, bottom + 3, PAGE_WIDTH - MARGIN_RIGHT, bottom + 3);

  return bottom + 7;
}

function drawMovementsTable(
  doc: jsPDF,
  movements: PdfMovement[],
  y: number
): number {
  // Section title
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Movimientos (${movements.length})`, MARGIN_LEFT, y + 5);
  y += 10;

  // Column widths: Fecha | Fojas | Firmado | Descripcion
  const colDate = 22;
  const colFojas = 14;
  const colFirma = 14;
  const colDesc = CONTENT_WIDTH - colDate - colFojas - colFirma;

  const drawTableHeader = (yPos: number) => {
    doc.setFillColor(...COLORS.headerBg);
    doc.rect(MARGIN_LEFT, yPos, CONTENT_WIDTH, 7, 'F');
    doc.setTextColor(...COLORS.dark);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Fecha', MARGIN_LEFT + 2, yPos + 5);
    doc.text('Fojas', MARGIN_LEFT + colDate + 2, yPos + 5);
    doc.text('Firma', MARGIN_LEFT + colDate + colFojas + 2, yPos + 5);
    doc.text('Descripcion', MARGIN_LEFT + colDate + colFojas + colFirma + 2, yPos + 5);
  };

  drawTableHeader(y);
  y += 7;

  // Table rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  for (let i = 0; i < movements.length; i++) {
    const mov = movements[i];

    const descLines = doc.splitTextToSize(
      mov.description || '',
      colDesc - 4
    ) as string[];
    const rowHeight = Math.max(6, descLines.length * 3.5 + 2);

    // Page break check
    if (y + rowHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
      doc.addPage();
      y = MARGIN_TOP;
      drawTableHeader(y);
      y += 7;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
    }

    // Alternate row background
    if (i % 2 === 0) {
      doc.setFillColor(...COLORS.rowEven);
      doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, rowHeight, 'F');
    }

    // Row bottom border
    doc.setDrawColor(...COLORS.lightGray);
    doc.line(MARGIN_LEFT, y + rowHeight, MARGIN_LEFT + CONTENT_WIDTH, y + rowHeight);

    // Date
    doc.setTextColor(...COLORS.dark);
    doc.text(mov.date, MARGIN_LEFT + 2, y + 4);

    // Fojas
    doc.setTextColor(...COLORS.gray);
    doc.text(mov.fojas ?? '', MARGIN_LEFT + colDate + 2, y + 4);

    // Firma indicator (text, no emoji)
    if (mov.type === 'firmado') {
      doc.setTextColor(...COLORS.dark);
      doc.text('Firm.', MARGIN_LEFT + colDate + colFojas + 2, y + 4);
    }

    // Description
    doc.setTextColor(...COLORS.dark);
    doc.text(
      descLines,
      MARGIN_LEFT + colDate + colFojas + colFirma + 2,
      y + 4
    );

    y += rowHeight;
  }

  return y + 5;
}

function drawAttachmentsList(
  doc: jsPDF,
  attachments: PdfAttachment[],
  y: number
): number {
  if (attachments.length === 0) return y;

  // Salto de página: hay que reservar el título, la aclaración y al menos dos
  // renglones. Con menos, el título quedaba solo al pie de una hoja y la lista
  // empezaba en la siguiente.
  if (y + 34 > PAGE_HEIGHT - MARGIN_BOTTOM) {
    doc.addPage();
    y = MARGIN_TOP;
  }

  // Section title
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Documentos del expediente (${attachments.length})`, MARGIN_LEFT, y + 5);
  y += 8;

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.gray);
  doc.text(
    'Los links abajo abren el documento firmado en el portal MEV.',
    MARGIN_LEFT + 2,
    y + 4
  );
  y += 8;

  doc.setFontSize(8);

  for (const att of attachments) {
    if (y + 6 > PAGE_HEIGHT - MARGIN_BOTTOM) {
      doc.addPage();
      y = MARGIN_TOP;
    }

    // Bullet + name (no emoji: jsPDF Helvetica doesn't support them)
    doc.setTextColor(...COLORS.dark);
    const label = att.movementDate
      ? `[doc] ${att.name} (${att.movementDate})`
      : `[doc] ${att.name}`;
    doc.text(label, MARGIN_LEFT + 2, y + 4);

    // Clickable link over the text
    doc.link(MARGIN_LEFT + 2, y, CONTENT_WIDTH - 4, 5, { url: att.url });

    y += 6;
  }

  return y + 3;
}

function drawFooter(
  doc: jsPDF,
  pageNum: number,
  pageCount: number,
  caseNumber: string
) {
  const footerY = PAGE_HEIGHT - 8;

  doc.setDrawColor(...COLORS.lightGray);
  doc.line(MARGIN_LEFT, footerY - 2, PAGE_WIDTH - MARGIN_RIGHT, footerY - 2);

  doc.setFontSize(7);
  doc.setTextColor(...COLORS.gray);
  doc.setFont('helvetica', 'normal');
  // El pie lleva el número de expediente, que es contenido. Nada más.
  doc.text(caseNumber, MARGIN_LEFT, footerY + 1);
  doc.text(
    `Página ${pageNum} de ${pageCount}`,
    PAGE_WIDTH - MARGIN_RIGHT,
    footerY + 1,
    { align: 'right' }
  );
}
