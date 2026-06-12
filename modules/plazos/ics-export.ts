/**
 * Export de plazos a un calendario .ics (iCalendar, RFC 5545).
 * Cada plazo pendiente se exporta como evento de día completo en su fecha
 * de vencimiento, con una alarma el día anterior. Compatible con Google
 * Calendar, Outlook y Apple Calendar (importar el archivo descargado).
 */

import type { Deadline } from '@/modules/storage/deadline-store';
import { formatDisplayDate, parseIsoDate, toIsoDate } from './plazos';

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function isoToBasic(iso: string): string {
  return iso.replace(/-/g, '');
}

function nextDayBasic(iso: string): string {
  const d = parseIsoDate(iso);
  d.setDate(d.getDate() + 1);
  return isoToBasic(toIsoDate(d));
}

function utcStamp(): string {
  return new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

export function buildDeadlinesIcs(deadlines: Deadline[]): string {
  const stamp = utcStamp();
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ProcuAsist//Plazos//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const d of deadlines) {
    const summary = `Vence: ${d.title}${d.caseNumber ? ` (${d.caseNumber})` : ''}`;
    const descParts = [
      `Plazo de ${d.days} días ${d.kind === 'habiles' ? 'hábiles' : 'corridos'}`,
      `Notificación: ${formatDisplayDate(d.notifDate)}`,
    ];
    if (d.graceDate) {
      descParts.push(
        `Plazo de gracia: primeras horas del ${formatDisplayDate(d.graceDate)}`
      );
    }
    if (d.notes) descParts.push(d.notes);
    descParts.push('Generado por ProcuAsist');

    lines.push(
      'BEGIN:VEVENT',
      `UID:procuasist-${d.id}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${isoToBasic(d.dueDate)}`,
      `DTEND;VALUE=DATE:${nextDayBasic(d.dueDate)}`,
      `SUMMARY:${escapeIcsText(summary)}`,
      `DESCRIPTION:${escapeIcsText(descParts.join('\n'))}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeIcsText(summary)}`,
      'TRIGGER:-P1D',
      'END:VALARM',
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
