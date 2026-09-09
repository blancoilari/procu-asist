/**
 * PDF de un paso procesal (proveído) de la MEV y PDF de informe de texto.
 *
 * Vivía adentro de case-zip-generator.ts. Se separó el 09/09/2026 al sacarle
 * la marca al documento: acá no se toca chrome.* ni el DOM, así que el
 * resultado se puede generar y mirar fuera del navegador.
 *
 * El documento sale sin marca: ni logo, ni color corporativo, ni el nombre de
 * la extensión. Solo contenido: juzgado, número, carátula, fechas, paso
 * procesal, referencias, datos de presentación y el texto del proveído.
 */

import { jsPDF } from 'jspdf';

export interface ProveidoPdfInput {
  date: string;
  fojas?: string;
  description: string;
  caseNumber: string;
  title: string;
  court: string;
  content: string;
  sourceUrl: string;
  // Extended metadata from ProveidoPageData
  juzgadoName?: string;
  departamento?: string;
  datosExpediente?: {
    caratula: string;
    fechaInicio: string;
    nroReceptoria: string;
    nroExpediente: string;
    estado: string;
  };
  pasoProcesal?: {
    fecha: string;
    tramite: string;
    firmado: boolean;
    fojas: string;
  };
  referencias?: {
    adjuntos: Array<{ nombre: string; url: string }>;
    despacho?: string;
    observacion?: string;
    observacionProfesional?: string;
    rawFields?: Array<{ label: string; value: string }>;
  };
  datosPresentacion?: {
    fechaEscrito?: string;
    firmadoPor?: string;
    nroPresentacionElectronica?: string;
    presentadoPor?: string;
  };
}

// Paleta neutra: grises para la jerarquía, negro para el contenido.
const DARK: [number, number, number] = [20, 20, 20];
const GRAY: [number, number, number] = [90, 90, 90];
const LIGHT_GRAY: [number, number, number] = [190, 190, 190];

export function generateProveidoPdf(input: ProveidoPdfInput): Blob {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const ML = 15;
  const MR = 15;
  const CW = 210 - ML - MR;
  const PH = 297;
  const MB = 20;

  /** Check page break and add page if needed */
  const ensureSpace = (needed: number, currentY: number): number => {
    if (currentY + needed > PH - MB) {
      doc.addPage();
      return 20;
    }
    return currentY;
  };

  // ── 1. Encabezado sobrio: qué es la hoja y a qué foja/fecha corresponde ──
  doc.setTextColor(...DARK);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Paso procesal', ML, 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY);
  const encabezadoDerecha = [
    input.fojas ? `fs ${input.fojas}` : '',
    convertToIsoDate(input.date),
  ]
    .filter(Boolean)
    .join('  |  ');
  doc.text(encabezadoDerecha, 210 - MR, 10, { align: 'right' });
  doc.setDrawColor(...LIGHT_GRAY);
  doc.line(ML, 12.5, 210 - MR, 12.5);

  let y = 17;

  // ── 2. Juzgado + Departamento ──
  if (input.juzgadoName) {
    doc.setTextColor(...DARK);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const juzLine = input.departamento
      ? `${sanitizeForPdf(input.juzgadoName)}  -  ${sanitizeForPdf(input.departamento)}`
      : sanitizeForPdf(input.juzgadoName);
    const juzLines = doc.splitTextToSize(juzLine, CW) as string[];
    doc.text(juzLines, ML, y);
    y += juzLines.length * 4 + 3;
  }

  // ── 3. Datos del expediente (texto sobre blanco, cerrado con una línea) ──
  const datos = input.datosExpediente;
  const caratulaText = sanitizeForPdf(datos?.caratula || input.title || 'Sin caratula');

  const metaItemsStr: string[] = [];
  if (datos?.fechaInicio) metaItemsStr.push(`Inicio: ${sanitizeForPdf(datos.fechaInicio)}`);
  if (datos?.estado) metaItemsStr.push(`Estado: ${sanitizeForPdf(datos.estado)}`);
  if (datos?.nroReceptoria) metaItemsStr.push(`Receptoria: ${sanitizeForPdf(datos.nroReceptoria)}`);
  if (datos?.nroExpediente) metaItemsStr.push(`Expediente: ${sanitizeForPdf(datos.nroExpediente)}`);

  doc.setFontSize(8);
  const caratulaLines = doc.splitTextToSize(caratulaText, CW - 20) as string[];

  y = ensureSpace(14 + caratulaLines.length * 3.5, y);

  doc.setTextColor(...DARK);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(sanitizeForPdf(input.caseNumber), ML, y + 4);
  y += 8;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Caratula:', ML, y);
  doc.setFont('helvetica', 'normal');
  doc.text(caratulaLines, ML + 18, y);
  y += caratulaLines.length * 3.5 + 1;

  if (metaItemsStr.length > 0) {
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY);
    const metaLines = doc.splitTextToSize(metaItemsStr.join('  |  '), CW) as string[];
    doc.text(metaLines, ML, y + 3);
    y += metaLines.length * 3.5 + 1;
  }

  doc.setDrawColor(...LIGHT_GRAY);
  doc.line(ML, y + 2, ML + CW, y + 2);
  y += 6;

  // ── 4. Paso procesal info ──
  const paso = input.pasoProcesal;
  if (paso && paso.tramite) {
    y = ensureSpace(12, y);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text('Paso procesal:', ML, y + 4);
    doc.setFont('helvetica', 'normal');

    let pasoText = '';
    if (paso.fecha) pasoText += `Fecha: ${paso.fecha}`;
    pasoText += ` - Tramite: ${sanitizeForPdf(paso.tramite)}`;
    if (paso.firmado) pasoText += ' (FIRMADO)';
    if (paso.fojas) pasoText += ` - Fojas: ${paso.fojas}`;

    const pasoLines = doc.splitTextToSize(pasoText, CW - 30) as string[];
    doc.text(pasoLines, ML + 30, y + 4);
    y += pasoLines.length * 3.5 + 4;
  } else {
    // Fallback: show basic info
    y = ensureSpace(8, y);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text('Desc.:', ML, y + 4);
    doc.setFont('helvetica', 'normal');
    const descFallback = doc.splitTextToSize(sanitizeForPdf(input.description), CW - 20) as string[];
    doc.text(descFallback, ML + 18, y + 4);
    y += descFallback.length * 3.5 + 2;
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY);
    doc.text(
      `Fojas: ${input.fojas ?? '-'}  |  Juzgado: ${sanitizeForPdf(input.court)}`,
      ML,
      y + 4
    );
    y += 6;
  }

  // ── 5. REFERENCIAS ──
  const refs = input.referencias;
  const hasRefContent = refs && (
    refs.adjuntos.length > 0 ||
    (refs.rawFields && refs.rawFields.length > 0) ||
    refs.despacho || refs.observacion || refs.observacionProfesional
  );
  if (hasRefContent) {
    y = ensureSpace(10, y);

    // Section separator
    doc.setDrawColor(...LIGHT_GRAY);
    doc.line(ML, y, ML + CW, y);
    y += 3;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text('REFERENCIAS', ML, y + 4);
    y += 8;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');

    // Adjuntos: el link sigue siendo clickeable, pero en negro y no en color.
    for (const adj of refs!.adjuntos) {
      y = ensureSpace(6, y);
      doc.setTextColor(...DARK);
      const adjLabel = sanitizeForPdf(`${adj.nombre}  VER ADJUNTO`);
      doc.text(adjLabel, ML + 2, y + 4);
      const textWidth = doc.getTextWidth(adjLabel);
      doc.link(ML + 2, y, textWidth, 5, { url: adj.url });
      y += 6;
    }

    // Render all fields from rawFields (captures everything in REFERENCIAS)
    if (refs!.rawFields && refs!.rawFields.length > 0) {
      for (const field of refs!.rawFields) {
        if (field.value) {
          // Key-value pair
          doc.setFont('helvetica', 'bold');
          const label = sanitizeForPdf(`${field.label}:`);
          // El ancho se mide con la fuente en negrita, que es con la que se
          // dibujó la etiqueta: medirlo después de pasar a normal lo subestima
          // y el valor termina pegado a los dos puntos.
          const labelW = doc.getTextWidth(label) + 3;
          // Una etiqueta más ancha que la sangría máxima no deja lugar al
          // valor en el mismo renglón: antes se lo dibujaba igual a 60 mm del
          // margen y quedaba impreso ENCIMA de la etiqueta, ilegible. Cuando
          // no entra, el valor baja al renglón siguiente y usa todo el ancho.
          const enLinea = labelW <= 60;
          y = ensureSpace(enLinea ? 8 : 12, y);
          doc.setTextColor(...DARK);
          doc.text(label, ML + 2, y + 4);
          doc.setFont('helvetica', 'normal');
          const valueX = enLinea ? ML + 2 + labelW : ML + 2;
          const valueY = enLinea ? y + 4 : y + 8;
          const valLines = doc.splitTextToSize(
            sanitizeForPdf(field.value),
            ML + CW - valueX - 2
          ) as string[];
          doc.text(valLines, valueX, valueY);
          y += (enLinea ? 0 : 4) + valLines.length * 3.5 + 3;
        } else {
          // Sub-section header (e.g., "NOTIFICACION ELECTRONICA")
          y = ensureSpace(8, y);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...GRAY);
          doc.text(sanitizeForPdf(field.label), ML + 2, y + 4);
          y += 6;
        }
      }
    } else {
      // Fallback: render legacy fields if rawFields is empty
      if (refs!.despacho) {
        y = ensureSpace(8, y);
        doc.setTextColor(...DARK);
        doc.setFont('helvetica', 'bold');
        doc.text('Despachado en:', ML + 2, y + 4);
        doc.setFont('helvetica', 'normal');
        const despLines = doc.splitTextToSize(sanitizeForPdf(refs!.despacho), CW - 30) as string[];
        doc.text(despLines, ML + 30, y + 4);
        y += despLines.length * 3.5 + 3;
      }
      if (refs!.observacion) {
        y = ensureSpace(8, y);
        doc.setFont('helvetica', 'bold');
        doc.text('Observacion:', ML + 2, y + 4);
        doc.setFont('helvetica', 'normal');
        const obsLines = doc.splitTextToSize(sanitizeForPdf(refs!.observacion), CW - 28) as string[];
        doc.text(obsLines, ML + 28, y + 4);
        y += obsLines.length * 3.5 + 3;
      }
      if (refs!.observacionProfesional) {
        y = ensureSpace(8, y);
        doc.setFont('helvetica', 'bold');
        doc.text('Obs. Profesional:', ML + 2, y + 4);
        doc.setFont('helvetica', 'normal');
        const obsPLines = doc.splitTextToSize(sanitizeForPdf(refs!.observacionProfesional), CW - 34) as string[];
        doc.text(obsPLines, ML + 34, y + 4);
        y += obsPLines.length * 3.5 + 3;
      }
    }
  }

  // ── 6. DATOS DE PRESENTACIÓN ──
  const pres = input.datosPresentacion;
  if (pres) {
    y = ensureSpace(10, y);

    doc.setDrawColor(...LIGHT_GRAY);
    doc.line(ML, y, ML + CW, y);
    y += 3;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text('DATOS DE PRESENTACION', ML, y + 4);
    y += 8;

    doc.setFontSize(8);

    const presFields: Array<[string, string | undefined]> = [
      ['Fecha del Escrito:', pres.fechaEscrito],
      ['Firmado por:', pres.firmadoPor],
      ['Nro. Presentacion Electronica:', pres.nroPresentacionElectronica],
      ['Presentado por:', pres.presentadoPor],
    ];

    for (const [label, value] of presFields) {
      if (!value) continue;
      y = ensureSpace(6, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...DARK);
      doc.text(label, ML + 2, y + 4);
      // Mismo criterio que arriba: medir en negrita, antes de cambiar la fuente.
      const labelW = doc.getTextWidth(label) + 3;
      doc.setFont('helvetica', 'normal');
      const valLines = doc.splitTextToSize(sanitizeForPdf(value), CW - labelW - 4) as string[];
      doc.text(valLines, ML + 2 + labelW, y + 4);
      y += valLines.length * 3.5 + 2;
    }
  }

  // ── 7. "Texto del Proveído" section ──
  y = ensureSpace(10, y);
  doc.setDrawColor(...LIGHT_GRAY);
  doc.line(ML, y, ML + CW, y);
  y += 3;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text('Texto del Proveido', ML, y + 4);
  y += 8;

  // ── 8. Content text ──
  doc.setTextColor(...DARK);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');

  const sanitizedContent = sanitizeForPdf(input.content);
  const paragraphs = sanitizedContent.split('\n').filter((l) => l.trim().length > 0);

  // Render line by line: a paragraph taller than one page would otherwise be
  // drawn past the bottom margin and silently lost.
  for (const para of paragraphs) {
    const lines = doc.splitTextToSize(para.trim(), CW) as string[];
    for (const line of lines) {
      y = ensureSpace(4, y);
      doc.text(line, ML, y);
      y += 4;
    }
    y += 2;
  }

  // ── 9. Source URL footer note ──
  y = ensureSpace(10, y);
  y += 4;
  doc.setFontSize(6.5);
  doc.setTextColor(...GRAY);
  const urlLines = doc.splitTextToSize(`Fuente: ${input.sourceUrl}`, CW) as string[];
  doc.text(urlLines, ML, y);

  // ── 10. Page numbers ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(6.5);
    doc.setTextColor(...GRAY);
    doc.text(
      `${sanitizeForPdf(input.caseNumber)}  |  ${input.fojas ? 'fs ' + input.fojas : convertToIsoDate(input.date)}  |  Pag. ${i}/${pageCount}`,
      210 - MR,
      PH - 5,
      { align: 'right' }
    );
  }

  return doc.output('blob');
}

/** Render a plain-text report (e.g. the verification log) as a simple PDF. */
export function generateTextReportPdf(title: string, lines: string[]): Blob {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const ML = 15;
  const CW = 210 - ML * 2;
  const PH = 297;
  const MB = 15;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  doc.text(sanitizeForPdf(title), ML, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...DARK);

  let y = 28;
  for (const rawLine of lines) {
    const wrapped = doc.splitTextToSize(sanitizeForPdf(rawLine) || ' ', CW) as string[];
    for (const line of wrapped) {
      if (y + 4 > PH - MB) {
        doc.addPage();
        y = 18;
      }
      doc.text(line, ML, y);
      y += 4;
    }
  }

  return doc.output('blob');
}

/** Sanitize text for jsPDF's built-in helvetica font (WinAnsiEncoding).
 *  Los caracteres van escapados (\uXXXX) a propósito: el archivo se compila y
 *  se empaqueta en varias etapas, y un escape no depende de que todas ellas
 *  respeten la codificación del fuente. */
export function sanitizeForPdf(text: string): string {
  return text
    .replace(/\u00ba/g, '\u00b0')    // ordinal masculino -> grado (mejor soporte de fuente)
    .replace(/\u00aa/g, 'a.')        // ordinal femenino
    .replace(/[\u2018\u2019]/g, "'") // comillas tipograficas -> rectas
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2013/g, '-')         // raya corta
    .replace(/\u2014/g, '--')        // raya larga
    .replace(/\u2026/g, '...');      // puntos suspensivos
}

/** Convert dd/mm/yyyy or dd-mm-yyyy to yyyy-mm-dd (ISO) for correct alphabetical sorting */
export function convertToIsoDate(dateStr: string): string {
  const parts = dateStr.split(/[\/\-]/);
  if (parts.length === 3 && parts[0].length <= 2) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return dateStr.replace(/\//g, '-');
}
