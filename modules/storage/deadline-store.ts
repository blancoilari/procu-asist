/**
 * Almacenamiento de plazos/vencimientos (pestaña Plazos del sidepanel).
 * Accedido directamente (chrome.storage.local) desde sidepanel y background.
 */

import type { PlazoKind } from '@/modules/plazos/plazos';

const DEADLINES_KEY = 'tl_deadlines';

export interface Deadline {
  id: string;
  /** Qué vence, p. ej. "Contestar demanda". */
  title: string;
  /** Expediente vinculado (texto libre). */
  caseNumber?: string;
  /** Fecha de notificación, YYYY-MM-DD. */
  notifDate: string;
  days: number;
  kind: PlazoKind;
  /** Vencimiento calculado, YYYY-MM-DD. */
  dueDate: string;
  /** Día del plazo de gracia, YYYY-MM-DD. */
  graceDate?: string;
  notes?: string;
  createdAt: string;
  /** Seteado cuando el usuario lo marca como cumplido. */
  completedAt?: string;
  /**
   * Último umbral notificado (días restantes, -1 = vencido). Evita repetir
   * la misma notificación en cada chequeo.
   */
  lastNotifiedDaysLeft?: number;
}

/** Todos los plazos, ordenados por vencimiento ascendente. */
export async function getDeadlines(): Promise<Deadline[]> {
  const stored = await chrome.storage.local.get(DEADLINES_KEY);
  const deadlines = (stored[DEADLINES_KEY] as Deadline[]) ?? [];
  return deadlines.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export async function addDeadline(
  input: Omit<Deadline, 'id' | 'createdAt'>
): Promise<Deadline> {
  const deadlines = await getDeadlines();
  const deadline: Deadline = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  deadlines.push(deadline);
  await chrome.storage.local.set({ [DEADLINES_KEY]: deadlines });
  return deadline;
}

export async function updateDeadline(
  id: string,
  partial: Partial<Deadline>
): Promise<Deadline | null> {
  const deadlines = await getDeadlines();
  const idx = deadlines.findIndex((d) => d.id === id);
  if (idx === -1) return null;
  deadlines[idx] = { ...deadlines[idx], ...partial };
  await chrome.storage.local.set({ [DEADLINES_KEY]: deadlines });
  return deadlines[idx];
}

export async function removeDeadline(id: string): Promise<void> {
  const deadlines = await getDeadlines();
  await chrome.storage.local.set({
    [DEADLINES_KEY]: deadlines.filter((d) => d.id !== id),
  });
}
