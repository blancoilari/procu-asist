/**
 * Backup y restauración de los datos del usuario en un JSON portable.
 *
 * Incluye: marcadores, monitores, alertas, plazos, días inhábiles
 * personalizados y preferencias.
 * NO incluye (a propósito): credenciales cifradas, salt/test del PIN ni la
 * clave persistida — el material sensible no sale del dispositivo.
 *
 * La importación es un MERGE: nunca borra lo existente; saltea duplicados.
 */

import type { Bookmark, Monitor, MovementAlert } from '@/modules/portals/types';
import type { Deadline } from './deadline-store';
import type { ProcuAsistSettings } from './settings-store';
import {
  getPlazosConfig,
  savePlazosConfig,
  type InhabilRange,
  type PlazosConfig,
} from '@/modules/plazos/plazos';

// Claves espejo de los stores (bookmark-store, monitor-store, deadline-store,
// settings-store). Mantener sincronizadas si algún store cambia de clave.
const KEY_BOOKMARKS = 'tl_bookmarks';
const KEY_MONITORS = 'tl_monitors';
const KEY_ALERTS = 'tl_alerts';
const KEY_DEADLINES = 'tl_deadlines';
const KEY_SETTINGS = 'tl_settings';

export interface BackupPayload {
  app: 'procu-asist';
  backupVersion: 1;
  exportedAt: string;
  appVersion: string;
  bookmarks: Bookmark[];
  monitors: Monitor[];
  alerts: MovementAlert[];
  deadlines: Deadline[];
  plazosConfig: PlazosConfig;
  settings: Partial<ProcuAsistSettings>;
}

export interface ImportSummary {
  bookmarks: number;
  monitors: number;
  alerts: number;
  deadlines: number;
  inhabiles: number;
}

export async function exportBackup(): Promise<BackupPayload> {
  const stored = await chrome.storage.local.get([
    KEY_BOOKMARKS,
    KEY_MONITORS,
    KEY_ALERTS,
    KEY_DEADLINES,
    KEY_SETTINGS,
  ]);
  const settings = {
    ...((stored[KEY_SETTINGS] as Partial<ProcuAsistSettings>) ?? {}),
  };
  // La persistencia de la clave es una decisión por dispositivo: no viaja.
  delete settings.persistUnlock;

  return {
    app: 'procu-asist',
    backupVersion: 1,
    exportedAt: new Date().toISOString(),
    appVersion: chrome.runtime.getManifest().version,
    bookmarks: (stored[KEY_BOOKMARKS] as Bookmark[]) ?? [],
    monitors: (stored[KEY_MONITORS] as Monitor[]) ?? [],
    alerts: (stored[KEY_ALERTS] as MovementAlert[]) ?? [],
    deadlines: (stored[KEY_DEADLINES] as Deadline[]) ?? [],
    plazosConfig: await getPlazosConfig(),
    settings,
  };
}

export async function importBackup(raw: unknown): Promise<ImportSummary> {
  const payload = raw as Partial<BackupPayload> | null;
  if (
    !payload ||
    payload.app !== 'procu-asist' ||
    typeof payload.backupVersion !== 'number'
  ) {
    throw new Error('El archivo no es un backup de ProcuAsist.');
  }

  const summary: ImportSummary = {
    bookmarks: 0,
    monitors: 0,
    alerts: 0,
    deadlines: 0,
    inhabiles: 0,
  };

  const stored = await chrome.storage.local.get([
    KEY_BOOKMARKS,
    KEY_MONITORS,
    KEY_ALERTS,
    KEY_DEADLINES,
    KEY_SETTINGS,
  ]);

  // ── Marcadores (dedup por portal + número de expediente) ──
  const bookmarks = (stored[KEY_BOOKMARKS] as Bookmark[]) ?? [];
  const bmKey = (b: Pick<Bookmark, 'portal' | 'caseNumber'>) =>
    `${b.portal}::${(b.caseNumber ?? '').replace(/\s+/g, '').toUpperCase()}`;
  const bmSeen = new Set(bookmarks.map(bmKey));
  for (const b of payload.bookmarks ?? []) {
    if (!b?.caseNumber || !b.portal || bmSeen.has(bmKey(b))) continue;
    bmSeen.add(bmKey(b));
    bookmarks.push({ ...b, position: bookmarks.length });
    summary.bookmarks++;
  }

  // ── Monitores (mismo criterio de dedup; conserva ids del backup) ──
  const monitors = (stored[KEY_MONITORS] as Monitor[]) ?? [];
  const monKey = (m: Pick<Monitor, 'portal' | 'caseNumber'>) =>
    `${m.portal}::${(m.caseNumber ?? '').replace(/\s+/g, '').toUpperCase()}`;
  const monSeen = new Set(monitors.map(monKey));
  const monIds = new Set(monitors.map((m) => m.id));
  for (const m of payload.monitors ?? []) {
    if (!m?.caseNumber || !m.portal || monSeen.has(monKey(m))) continue;
    monSeen.add(monKey(m));
    const id = monIds.has(m.id) ? crypto.randomUUID() : m.id;
    monIds.add(id);
    monitors.push({ ...m, id });
    summary.monitors++;
  }

  // ── Alertas (solo de monitores existentes; dedup por contenido) ──
  const alerts = (stored[KEY_ALERTS] as MovementAlert[]) ?? [];
  const alertKey = (a: MovementAlert) =>
    `${a.monitorId}::${a.movementDate}::${a.movementDescription}`;
  const alertSeen = new Set(alerts.map(alertKey));
  const alertIds = new Set(alerts.map((a) => a.id));
  for (const a of payload.alerts ?? []) {
    if (!a?.monitorId || !monIds.has(a.monitorId)) continue;
    if (alertSeen.has(alertKey(a)) || alertIds.has(a.id)) continue;
    alertSeen.add(alertKey(a));
    alertIds.add(a.id);
    alerts.push(a);
    summary.alerts++;
  }

  // ── Plazos (dedup por id) ──
  const deadlines = (stored[KEY_DEADLINES] as Deadline[]) ?? [];
  const dlIds = new Set(deadlines.map((d) => d.id));
  for (const d of payload.deadlines ?? []) {
    if (!d?.id || !d.dueDate || dlIds.has(d.id)) continue;
    dlIds.add(d.id);
    deadlines.push(d);
    summary.deadlines++;
  }

  // ── Días inhábiles personalizados (dedup por rango + etiqueta) ──
  const plazosConfig = await getPlazosConfig();
  const rangeKey = (r: InhabilRange) => `${r.from}::${r.to}::${r.label}`;
  const rangeSeen = new Set(plazosConfig.customInhabiles.map(rangeKey));
  for (const r of payload.plazosConfig?.customInhabiles ?? []) {
    if (!r?.from || !r.to || rangeSeen.has(rangeKey(r))) continue;
    rangeSeen.add(rangeKey(r));
    plazosConfig.customInhabiles.push(r);
    summary.inhabiles++;
  }

  // ── Preferencias (merge superficial, sin persistUnlock) ──
  const settings = {
    ...((stored[KEY_SETTINGS] as Record<string, unknown>) ?? {}),
  };
  const incomingSettings = { ...(payload.settings ?? {}) } as Record<
    string,
    unknown
  >;
  delete incomingSettings.persistUnlock;
  Object.assign(settings, incomingSettings);

  await chrome.storage.local.set({
    [KEY_BOOKMARKS]: bookmarks,
    [KEY_MONITORS]: monitors,
    [KEY_ALERTS]: alerts.slice(0, 200),
    [KEY_DEADLINES]: deadlines,
    [KEY_SETTINGS]: settings,
  });
  await savePlazosConfig(plazosConfig);

  return summary;
}
