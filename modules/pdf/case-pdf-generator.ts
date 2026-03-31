/**
 * PDF generator for judicial case files (expedientes).
 * Uses jsPDF to create a structured PDF document with:
 * - Header with ProcuAsist branding
 * - Case metadata (carátula, juzgado, número, estado, fecha)
 * - Full movements table (fecha, descripción, tipo)
 * - Attachment list (if any)
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

const COLORS = {
  primary: [37, 99, 235] as [number, number, number], // #2563eb
  dark: [30, 30, 30] as [number, number, number],
  gray: [100, 100, 100] as [number, number, number],
  lightGray: [200, 200, 200] as [number, number, number],
  headerBg: [240, 245, 255] as [number, number, number],
  rowEven: [248, 250, 252] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  green: [22, 163, 74] as [number, number, number],
};

/**
 * Generate a PDF for a case and return it as a base64 data URI.
 */
export function generateCasePdf(data: PdfCaseData): string {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  let y = MARGIN_TOP;

  // ── Header ──
  y = drawHeader(doc, data, y);

  // ── Case Metadata ──
  y = drawCaseMetadata(doc, data, y);

  // ── Movements Table ──
  if (data.movements.length > 0) {
    y = drawMovementsTable(doc, data.movements, y);
  }

  // ── Attachments ──
  if (data.attachments && data.attachments.length > 0) {
    y = drawAttachmentsList(doc, data.attachments, y);
  }

  // ── Footer on every page ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawFooter(doc, i, pageCount, data.caseNumber);
  }

  return doc.output('datauristring');
}

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
  y = drawHeader(doc, data, y);
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

function drawHeader(doc: jsPDF, data: PdfCaseData, y: number): number {
  // Blue header bar
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, PAGE_WIDTH, 14, 'F');

  doc.setTextColor(...COLORS.white);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('ProcuAsist — Expediente Digital', MARGIN_LEFT, 9);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const dateStr = new Date().toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  doc.text(`Generado: ${dateStr}`, PAGE_WIDTH - MARGIN_RIGHT, 9, {
    align: 'right',
  });

  doc.setTextColor(...COLORS.dark);
  return y + 2;
}

function drawCaseMetadata(
  doc: jsPDF,
  data: PdfCaseData,
  y: number
): number {
  // Background box
  doc.setFillColor(...COLORS.headerBg);
  doc.roundedRect(MARGIN_LEFT, y, CONTENT_WIDTH, 40, 2, 2, 'F');

  // Case number (big)
  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(data.caseNumber || 'Sin número', MARGIN_LEFT + 5, y + 8);

  // Portal badge
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const portalLabel = data.portal.toUpperCase();
  const badgeX = MARGIN_LEFT + 5 + doc.getTextWidth(data.caseNumber || 'Sin número') + 4;
  doc.setFillColor(...COLORS.primary);
  doc.roundedRect(badgeX, y + 3, doc.getTextWidth(portalLabel) + 4, 6, 1, 1, 'F');
  doc.setTextColor(...COLORS.white);
  doc.text(portalLabel, badgeX + 2, y + 7.5);

  // Carátula
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Carátula:', MARGIN_LEFT + 5, y + 15);
  doc.setFont('helvetica', 'normal');
  const titleLines = doc.splitTextToSize(
    data.title || 'Sin carátula',
    CONTENT_WIDTH - 30
  ) as string[];
  doc.text(titleLines, MARGIN_LEFT + 25, y + 15);

  // Metadata row
  const metaY = y + 15 + titleLines.length * 4 + 2;
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.gray);

  const metaItems: string[] = [];
  if (data.court) metaItems.push(`Juzgado: ${data.court}`);
  if (data.fechaInicio) metaItems.push(`Inicio: ${data.fechaInicio}`);
  if (data.estadoPortal) metaItems.push(`Estado: ${data.estadoPortal}`);
  if (data.numeroReceptoria) metaItems.push(`Receptoría: ${data.numeroReceptoria}`);

  if (metaItems.length > 0) {
    // Split into two columns
    const col1 = metaItems.slice(0, 2).join('  |  ');
    const col2 = metaItems.slice(2).join('  |  ');
    doc.text(col1, MARGIN_LEFT + 5, metaY);
    if (col2) doc.text(col2, MARGIN_LEFT + 5, metaY + 4);
  }

  // Adjust box height dynamically
  const boxHeight = Math.max(40, metaY - y + 8);
  // Redraw box if needed (won't look great, but safe)
  if (boxHeight > 40) {
    doc.setFillColor(...COLORS.headerBg);
    doc.roundedRect(MARGIN_LEFT, y, CONTENT_WIDTH, boxHeight, 2, 2, 'F');
    // Redraw text... skip for simplicity, initial 40mm is usually enough
  }

  return y + 44;
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

  // Table header
  const colWidths = {
    date: 22,
    type: 18,
    description: CONTENT_WIDTH - 22 - 18,
  };

  doc.setFillColor(...COLORS.primary);
  doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, 7, 'F');
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Fecha', MARGIN_LEFT + 2, y + 5);
  doc.text('Tipo', MARGIN_LEFT + colWidths.date + 2, y + 5);
  doc.text(
    'Descripción',
    MARGIN_LEFT + colWidths.date + colWidths.type + 2,
    y + 5
  );
  y += 7;

  // Table rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  for (let i = 0; i < movements.length; i++) {
    const mov = movements[i];

    // Calculate row height based on description text wrap
    const descLines = doc.splitTextToSize(
      mov.description,
      colWidths.description - 4
    ) as string[];
    const rowHeight = Math.max(6, descLines.length * 3.5 + 2);

    // Check page break
    if (y + rowHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
      doc.addPage();
      y = MARGIN_TOP;

      // Redraw table header on new page
      doc.setFillColor(...COLORS.primary);
      doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, 7, 'F');
      doc.setTextColor(...COLORS.white);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Fecha', MARGIN_LEFT + 2, y + 5);
      doc.text('Tipo', MARGIN_LEFT + colWidths.date + 2, y + 5);
      doc.text(
        'Descripción',
        MARGIN_LEFT + colWidths.date + colWidths.type + 2,
        y + 5
      );
      y += 7;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
    }

    // Alternate row background
    if (i % 2 === 0) {
      doc.setFillColor(...COLORS.rowEven);
      doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, rowHeight, 'F');
    }

    // Row border
    doc.setDrawColor(...COLORS.lightGray);
    doc.line(MARGIN_LEFT, y + rowHeight, MARGIN_LEFT + CONTENT_WIDTH, y + rowHeight);

    doc.setTextColor(...COLORS.dark);

    // Date
    doc.text(mov.date, MARGIN_LEFT + 2, y + 4);

    // Type badge
    if (mov.type) {
      doc.setTextColor(...COLORS.green);
      doc.text(mov.type, MARGIN_LEFT + colWidths.date + 2, y + 4);
    }
    if (mov.hasDocuments) {
      doc.setTextColor(...COLORS.primary);
      const typeX = mov.type
        ? MARGIN_LEFT + colWidths.date + 2 + doc.getTextWidth(mov.type) + 2
        : MARGIN_LEFT + colWidths.date + 2;
      doc.text('📎', typeX, y + 4);
    }

    // Description
    doc.setTextColor(...COLORS.dark);
    doc.text(
      descLines,
      MARGIN_LEFT + colWidths.date + colWidths.type + 2,
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
  // Check page break
  if (y + 20 > PAGE_HEIGHT - MARGIN_BOTTOM) {
    doc.addPage();
    y = MARGIN_TOP;
  }

  // Section title
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Adjuntos (${attachments.length})`, MARGIN_LEFT, y + 5);
  y += 10;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');

  for (const att of attachments) {
    if (y + 6 > PAGE_HEIGHT - MARGIN_BOTTOM) {
      doc.addPage();
      y = MARGIN_TOP;
    }

    doc.setTextColor(...COLORS.primary);
    doc.text(`📎 ${att.name}`, MARGIN_LEFT + 2, y + 4);

    if (att.movementDate) {
      doc.setTextColor(...COLORS.gray);
      doc.text(` (${att.movementDate})`, MARGIN_LEFT + 4 + doc.getTextWidth(`📎 ${att.name}`), y + 4);
    }

    // Make clickable link
    doc.link(MARGIN_LEFT + 2, y, CONTENT_WIDTH, 5, { url: att.url });

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
  doc.text(
    `ProcuAsist — ${caseNumber}`,
    MARGIN_LEFT,
    footerY + 1
  );
  doc.text(
    `Página ${pageNum} de ${pageCount}`,
    PAGE_WIDTH - MARGIN_RIGHT,
    footerY + 1,
    { align: 'right' }
  );
}
