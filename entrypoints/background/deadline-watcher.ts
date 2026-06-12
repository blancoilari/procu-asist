/**
 * Vigilante de vencimientos: revisa los plazos cargados y dispara una
 * notificación de Chrome cuando uno está por vencer (3, 2 o 1 días antes),
 * vence hoy, o quedó vencido. Cada umbral se notifica una sola vez por
 * plazo (lastNotifiedDaysLeft).
 *
 * Disparado por la alarma DEADLINE_CHECK (alarm-manager).
 */

import { getDeadlines, updateDeadline } from '@/modules/storage/deadline-store';
import { diffDays, formatDisplayDate, toIsoDate } from '@/modules/plazos/plazos';

const NOTIFY_THRESHOLD_DAYS = 3;

export async function checkDeadlines(): Promise<void> {
  const deadlines = await getDeadlines();
  if (deadlines.length === 0) return;

  const todayIso = toIsoDate(new Date());

  for (const deadline of deadlines) {
    if (deadline.completedAt) continue;

    const daysLeft = diffDays(todayIso, deadline.dueDate);
    if (daysLeft > NOTIFY_THRESHOLD_DAYS) continue;

    // "Vencido" es un único umbral (-1): no re-notificar cada día que pasa.
    const bucket = Math.max(daysLeft, -1);
    if (
      deadline.lastNotifiedDaysLeft !== undefined &&
      deadline.lastNotifiedDaysLeft <= bucket
    ) {
      continue;
    }

    const caseSuffix = deadline.caseNumber ? ` (${deadline.caseNumber})` : '';
    const title =
      daysLeft < 0
        ? `PLAZO VENCIDO: ${deadline.title}`
        : daysLeft === 0
          ? `VENCE HOY: ${deadline.title}`
          : `Vence en ${daysLeft} día${daysLeft === 1 ? '' : 's'}: ${deadline.title}`;
    const message =
      `${caseSuffix ? caseSuffix.trim() + ' — ' : ''}` +
      `Vencimiento: ${formatDisplayDate(deadline.dueDate)}` +
      (deadline.graceDate
        ? ` · Gracia: primeras horas del ${formatDisplayDate(deadline.graceDate)}`
        : '');

    try {
      await chrome.notifications.create(`deadline-${deadline.id}-${bucket}`, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icon/128.png'),
        title,
        message,
        priority: 2,
      });
    } catch (err) {
      console.warn('[ProcuAsist] No se pudo notificar el plazo:', err);
    }

    await updateDeadline(deadline.id, { lastNotifiedDaysLeft: bucket });
  }
}
