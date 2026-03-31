/**
 * Supabase sync module.
 * Syncs local chrome.storage data with Supabase tables
 * when the user is authenticated.
 */

import { getSupabaseClient } from './client';
import { isSignedIn, getCurrentUser } from './auth';
import type { Bookmark, Monitor, MovementAlert } from '@/modules/portals/types';
import type { ProcuAsistSettings } from '@/modules/storage/settings-store';

// ────────────────────────────────────────────────────────
// Bookmarks Sync
// ────────────────────────────────────────────────────────

/** Push all local bookmarks to Supabase (upsert) */
export async function pushBookmarks(bookmarks: Bookmark[]): Promise<void> {
  if (!(await isSignedIn())) return;
  const user = await getCurrentUser();
  if (!user) return;

  const supabase = getSupabaseClient();

  const rows = bookmarks.map((b) => ({
    id: b.id,
    user_id: user.id,
    portal: b.portal,
    case_number: b.caseNumber,
    title: b.title,
    court: b.court,
    fuero: b.fuero || '',
    portal_url: b.portalUrl || '',
    position: b.position,
    created_at: b.createdAt,
    updated_at: b.updatedAt,
  }));

  if (rows.length === 0) {
    await supabase.from('bookmarks').delete().eq('user_id', user.id);
    return;
  }

  const { error } = await supabase.from('bookmarks').upsert(rows, {
    onConflict: 'user_id,id',
  });

  if (error) {
    console.error('[ProcuAsist] Bookmark push error:', error);
    throw error;
  }

  // Remove remote bookmarks that no longer exist locally
  const localIds = bookmarks.map((b) => b.id);
  await supabase
    .from('bookmarks')
    .delete()
    .eq('user_id', user.id)
    .not('id', 'in', `(${localIds.map((id) => `"${id}"`).join(',')})`);

  // Update sync timestamp
  await supabase.from('sync_metadata').upsert(
    { user_id: user.id, bookmarks_synced_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );
}

/** Pull bookmarks from Supabase to local format */
export async function pullBookmarks(): Promise<Bookmark[]> {
  if (!(await isSignedIn())) return [];
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('bookmarks')
    .select('*')
    .eq('user_id', user.id)
    .order('position', { ascending: true });

  if (error) {
    console.error('[ProcuAsist] Bookmark pull error:', error);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    portal: row.portal as Bookmark['portal'],
    caseNumber: row.case_number,
    title: row.title,
    court: row.court,
    fuero: row.fuero,
    portalUrl: row.portal_url,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

// ────────────────────────────────────────────────────────
// Monitors Sync
// ────────────────────────────────────────────────────────

/** Push all local monitors to Supabase (upsert) */
export async function pushMonitors(monitors: Monitor[]): Promise<void> {
  if (!(await isSignedIn())) return;
  const user = await getCurrentUser();
  if (!user) return;

  const supabase = getSupabaseClient();

  const rows = monitors.map((m) => ({
    id: m.id,
    user_id: user.id,
    portal: m.portal,
    case_number: m.caseNumber,
    title: m.title,
    court: m.court,
    portal_url: m.portalUrl || '',
    active: m.isActive,
    last_known_count: m.lastKnownMovementCount,
    last_checked_at: m.lastScanAt || null,
    nid_causa: m.nidCausa || null,
    pid_juzgado: m.pidJuzgado || null,
  }));

  if (rows.length === 0) {
    await supabase.from('monitors').delete().eq('user_id', user.id);
    return;
  }

  const { error } = await supabase.from('monitors').upsert(rows, {
    onConflict: 'user_id,id',
  });

  if (error) {
    console.error('[ProcuAsist] Monitor push error:', error);
    throw error;
  }

  // Remove remote monitors that no longer exist locally
  const localIds = monitors.map((m) => m.id);
  await supabase
    .from('monitors')
    .delete()
    .eq('user_id', user.id)
    .not('id', 'in', `(${localIds.map((id) => `"${id}"`).join(',')})`);

  await supabase.from('sync_metadata').upsert(
    { user_id: user.id, monitors_synced_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );
}

/** Pull monitors from Supabase to local format */
export async function pullMonitors(): Promise<Monitor[]> {
  if (!(await isSignedIn())) return [];
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('monitors')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[ProcuAsist] Monitor pull error:', error);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    portal: row.portal as Monitor['portal'],
    caseNumber: row.case_number,
    title: row.title,
    court: row.court,
    portalUrl: row.portal_url,
    isActive: row.active,
    lastKnownMovementCount: row.last_known_count,
    lastScanAt: row.last_checked_at || undefined,
    nidCausa: row.nid_causa || undefined,
    pidJuzgado: row.pid_juzgado || undefined,
  }));
}

// ────────────────────────────────────────────────────────
// Alerts Sync
// ────────────────────────────────────────────────────────

/** Push local alerts to Supabase */
export async function pushAlerts(alerts: MovementAlert[]): Promise<void> {
  if (!(await isSignedIn())) return;
  const user = await getCurrentUser();
  if (!user) return;

  const supabase = getSupabaseClient();

  const rows = alerts.map((a) => ({
    id: a.id,
    user_id: user.id,
    monitor_id: a.monitorId,
    portal: '', // Alerts don't have portal directly
    case_number: '', // Derived from monitor
    title: a.movementDescription,
    new_movements: 1,
    previous_count: 0,
    current_count: 0,
    read: a.isRead,
    created_at: a.createdAt,
  }));

  if (rows.length === 0) return;

  const { error } = await supabase.from('alerts').upsert(rows, {
    onConflict: 'user_id,id',
  });

  if (error) {
    console.error('[ProcuAsist] Alert push error:', error);
  }
}

// ────────────────────────────────────────────────────────
// Settings Sync
// ────────────────────────────────────────────────────────

/** Push local settings to Supabase */
export async function pushSettings(settings: ProcuAsistSettings): Promise<void> {
  if (!(await isSignedIn())) return;
  const user = await getCurrentUser();
  if (!user) return;

  const supabase = getSupabaseClient();

  const { error } = await supabase.from('settings').upsert(
    {
      user_id: user.id,
      dark_mode: settings.darkMode,
      keep_alive_mev: settings.keepAliveMev,
      keep_alive_pjn: settings.keepAlivePjn,
      auto_reconnect: settings.autoReconnect,
      mev_departamento: settings.mevDepartamento || '',
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    console.error('[ProcuAsist] Settings push error:', error);
  }

  await supabase.from('sync_metadata').upsert(
    { user_id: user.id, settings_synced_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );
}

/** Pull settings from Supabase */
export async function pullSettings(): Promise<ProcuAsistSettings | null> {
  if (!(await isSignedIn())) return null;
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error || !data) return null;

  return {
    darkMode: data.dark_mode,
    keepAliveMev: data.keep_alive_mev,
    keepAlivePjn: data.keep_alive_pjn,
    autoReconnect: data.auto_reconnect,
    mevDepartamento: data.mev_departamento,
  };
}

// ────────────────────────────────────────────────────────
// Full Sync Orchestration
// ────────────────────────────────────────────────────────

export type SyncDirection = 'push' | 'pull' | 'merge';

/**
 * Full sync: push local data to Supabase.
 * Strategy: local-first — local data is the source of truth,
 * Supabase is a backup + cross-device sync.
 */
export async function syncAll(direction: SyncDirection = 'push'): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    if (!(await isSignedIn())) {
      return { success: false, error: 'not_signed_in' };
    }

    if (direction === 'push') {
      // Read local data
      const stored = await chrome.storage.local.get([
        'tl_bookmarks',
        'tl_monitors',
        'tl_alerts',
        'tl_settings',
      ]);

      const bookmarks = (stored.tl_bookmarks as Bookmark[]) ?? [];
      const monitors = (stored.tl_monitors as Monitor[]) ?? [];
      const alerts = (stored.tl_alerts as MovementAlert[]) ?? [];
      const settings = stored.tl_settings as ProcuAsistSettings | undefined;

      await Promise.all([
        pushBookmarks(bookmarks),
        pushMonitors(monitors),
        pushAlerts(alerts),
        settings ? pushSettings(settings) : Promise.resolve(),
      ]);
    } else if (direction === 'pull') {
      // Pull remote data and overwrite local
      const [bookmarks, monitors, settings] = await Promise.all([
        pullBookmarks(),
        pullMonitors(),
        pullSettings(),
      ]);

      const updates: Record<string, unknown> = {};
      if (bookmarks.length > 0) updates.tl_bookmarks = bookmarks;
      if (monitors.length > 0) updates.tl_monitors = monitors;
      if (settings) updates.tl_settings = settings;

      if (Object.keys(updates).length > 0) {
        await chrome.storage.local.set(updates);
      }
    }

    console.debug(`[ProcuAsist] Sync ${direction} completed successfully`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown sync error';
    console.error('[ProcuAsist] Sync error:', message);
    return { success: false, error: message };
  }
}
