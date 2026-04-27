/**
 * Monitor storage: tracks cases being monitored for new movements.
 * Also manages movement alerts (notifications of changes).
 */

import type { Monitor, MovementAlert, PortalId } from '@/modules/portals/types';

const MONITORS_KEY = 'tl_monitors';
const ALERTS_KEY = 'tl_alerts';

// ────────────────────────────────────────────────────────
// Monitors CRUD
// ────────────────────────────────────────────────────────

/** Get all monitors */
export async function getMonitors(): Promise<Monitor[]> {
  const stored = await chrome.storage.local.get(MONITORS_KEY);
  return (stored[MONITORS_KEY] as Monitor[]) ?? [];
}

/** Get active monitors only */
export async function getActiveMonitors(): Promise<Monitor[]> {
  const monitors = await getMonitors();
  return monitors.filter((m) => m.isActive);
}

/** Add a case to monitoring */
export async function addMonitor(
  caseData: Pick<
    Monitor,
    'portal' | 'caseNumber' | 'title' | 'court' | 'portalUrl'
  > & {
    metadata?: { nidCausa?: string; pidJuzgado?: string };
  }
): Promise<Monitor> {
  const monitors = await getMonitors();

  const existing = monitors.find((m) => isSameMonitorCase(m, caseData));
  if (existing) {
    let changed = false;

    if (!existing.caseNumber && caseData.caseNumber) {
      existing.caseNumber = caseData.caseNumber;
      changed = true;
    }
    if (!existing.portalUrl && caseData.portalUrl) {
      existing.portalUrl = caseData.portalUrl;
      changed = true;
    }
    if (!existing.nidCausa && caseData.metadata?.nidCausa) {
      existing.nidCausa = caseData.metadata.nidCausa;
      changed = true;
    }
    if (!existing.pidJuzgado && caseData.metadata?.pidJuzgado) {
      existing.pidJuzgado = caseData.metadata.pidJuzgado;
      changed = true;
    }

    if (changed) {
      await chrome.storage.local.set({ [MONITORS_KEY]: monitors });
    }

    return existing;
  }

  const monitor: Monitor = {
    id: crypto.randomUUID(),
    portal: caseData.portal,
    caseNumber: caseData.caseNumber,
    title: caseData.title,
    court: caseData.court,
    portalUrl: caseData.portalUrl,
    isActive: true,
    lastKnownMovementCount: 0,
    nidCausa: caseData.metadata?.nidCausa,
    pidJuzgado: caseData.metadata?.pidJuzgado,
  };

  monitors.push(monitor);
  await chrome.storage.local.set({ [MONITORS_KEY]: monitors });

  return monitor;
}

/** Update metadata for an already monitored case without creating a new monitor. */
export async function backfillMonitorMetadata(
  caseData: Pick<
    Monitor,
    'portal' | 'caseNumber' | 'title' | 'court' | 'portalUrl'
  > & {
    metadata?: { nidCausa?: string; pidJuzgado?: string };
  }
): Promise<boolean> {
  const monitors = await getMonitors();
  const existing = monitors.find((m) => isSameMonitorCase(m, caseData));
  if (!existing) return false;

  let changed = false;
  if (!existing.caseNumber && caseData.caseNumber) {
    existing.caseNumber = caseData.caseNumber;
    changed = true;
  }
  if (!existing.portalUrl && caseData.portalUrl) {
    existing.portalUrl = caseData.portalUrl;
    changed = true;
  }
  if (!existing.nidCausa && caseData.metadata?.nidCausa) {
    existing.nidCausa = caseData.metadata.nidCausa;
    changed = true;
  }
  if (!existing.pidJuzgado && caseData.metadata?.pidJuzgado) {
    existing.pidJuzgado = caseData.metadata.pidJuzgado;
    changed = true;
  }
  if (!existing.title && caseData.title) {
    existing.title = caseData.title;
    changed = true;
  }
  if (!existing.court && caseData.court) {
    existing.court = caseData.court;
    changed = true;
  }

  if (changed) {
    await chrome.storage.local.set({ [MONITORS_KEY]: monitors });
  }

  return changed;
}

/** Remove a monitor and its alerts */
export async function removeMonitor(id: string): Promise<void> {
  let monitors = await getMonitors();
  monitors = monitors.filter((m) => m.id !== id);
  await chrome.storage.local.set({ [MONITORS_KEY]: monitors });

  // Also remove associated alerts
  let alerts = await getAlerts();
  alerts = alerts.filter((a) => a.monitorId !== id);
  await chrome.storage.local.set({ [ALERTS_KEY]: alerts });
}

/** Toggle monitor active state */
export async function toggleMonitor(
  id: string
): Promise<Monitor | null> {
  const monitors = await getMonitors();
  const monitor = monitors.find((m) => m.id === id);
  if (!monitor) return null;

  monitor.isActive = !monitor.isActive;
  await chrome.storage.local.set({ [MONITORS_KEY]: monitors });
  return monitor;
}

/** Update last scan info for a monitor */
export async function updateMonitorScan(
  id: string,
  lastMovementDate: string,
  movementCount: number
): Promise<void> {
  const monitors = await getMonitors();
  const monitor = monitors.find((m) => m.id === id);
  if (monitor) {
    monitor.lastScanAt = new Date().toISOString();
    monitor.lastKnownMovementDate = lastMovementDate;
    monitor.lastKnownMovementCount = movementCount;
    await chrome.storage.local.set({ [MONITORS_KEY]: monitors });
  }
}

/** Check if a case is being monitored */
export async function isMonitored(
  portal: PortalId,
  caseNumber: string
): Promise<boolean> {
  const monitors = await getMonitors();
  return monitors.some(
    (m) =>
      m.portal === portal &&
      normalizeCaseNumber(m.caseNumber) === normalizeCaseNumber(caseNumber)
  );
}

/** Get monitor count (for tier enforcement) */
export async function getMonitorCount(): Promise<number> {
  const monitors = await getMonitors();
  return monitors.length;
}

function isSameMonitorCase(
  monitor: Monitor,
  caseData: Pick<
    Monitor,
    'portal' | 'caseNumber' | 'title' | 'court' | 'portalUrl'
  > & {
    metadata?: { nidCausa?: string; pidJuzgado?: string };
  }
): boolean {
  if (monitor.portal !== caseData.portal) return false;

  const monitorNumber = normalizeCaseNumber(monitor.caseNumber);
  const caseNumber = normalizeCaseNumber(caseData.caseNumber);
  if (monitorNumber && caseNumber && monitorNumber === caseNumber) return true;

  const monitorNid = monitor.nidCausa || getQueryParam(monitor.portalUrl, 'nidCausa');
  const caseNid = caseData.metadata?.nidCausa || getQueryParam(caseData.portalUrl, 'nidCausa');
  if (monitorNid && caseNid && monitorNid === caseNid) return true;

  return false;
}

function normalizeCaseNumber(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase();
}

function getQueryParam(url: string, param: string): string {
  if (!url) return '';
  try {
    return new URL(url).searchParams.get(param) ?? '';
  } catch {
    return '';
  }
}

// ────────────────────────────────────────────────────────
// Movement Alerts
// ────────────────────────────────────────────────────────

/** Get all alerts, newest first */
export async function getAlerts(): Promise<MovementAlert[]> {
  const stored = await chrome.storage.local.get(ALERTS_KEY);
  const alerts = (stored[ALERTS_KEY] as MovementAlert[]) ?? [];
  return alerts.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/** Get unread alerts count */
export async function getUnreadAlertCount(): Promise<number> {
  const alerts = await getAlerts();
  return alerts.filter((a) => !a.isRead).length;
}

/** Get alerts for a specific monitor */
export async function getAlertsForMonitor(
  monitorId: string
): Promise<MovementAlert[]> {
  const alerts = await getAlerts();
  return alerts.filter((a) => a.monitorId === monitorId);
}

/** Create a new movement alert */
export async function createAlert(
  monitorId: string,
  movementDate: string,
  movementDescription: string,
  movementType?: string,
  options: { isRead?: boolean } = {}
): Promise<MovementAlert> {
  const alerts = await getAlerts();

  // Avoid duplicate alert for same monitor + same date + same description
  const dup = alerts.find(
    (a) =>
      a.monitorId === monitorId &&
      a.movementDate === movementDate &&
      a.movementDescription === movementDescription
  );
  if (dup) return dup;

  const alert: MovementAlert = {
    id: crypto.randomUUID(),
    monitorId,
    movementDate,
    movementType,
    movementDescription,
    isRead: options.isRead ?? false,
    createdAt: new Date().toISOString(),
  };

  alerts.unshift(alert);

  // Keep max 200 alerts
  const trimmed = alerts.slice(0, 200);
  await chrome.storage.local.set({ [ALERTS_KEY]: trimmed });

  return alert;
}

/** Mark an alert as read */
export async function markAlertRead(alertId: string): Promise<void> {
  const alerts = await getAlerts();
  const alert = alerts.find((a) => a.id === alertId);
  if (alert) {
    alert.isRead = true;
    await chrome.storage.local.set({ [ALERTS_KEY]: alerts });
  }
}

/** Mark all alerts as read */
export async function markAllAlertsRead(): Promise<void> {
  const alerts = await getAlerts();
  for (const alert of alerts) {
    alert.isRead = true;
  }
  await chrome.storage.local.set({ [ALERTS_KEY]: alerts });
}

/** Clear all alerts for a monitor */
export async function clearAlertsForMonitor(
  monitorId: string
): Promise<void> {
  let alerts = await getAlerts();
  alerts = alerts.filter((a) => a.monitorId !== monitorId);
  await chrome.storage.local.set({ [ALERTS_KEY]: alerts });
}
