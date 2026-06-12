/**
 * User preferences storage.
 */

export interface ProcuAsistSettings {
  darkMode: boolean;
  keepAliveMev: boolean;
  keepAliveEje: boolean;
  keepAlivePjn: boolean;
  autoReconnect: boolean;
  /**
   * When true, the unlock key (derived from the user's PIN) is persisted to
   * chrome.storage.local and restored across browser/SW restarts — i.e. the
   * PIN is never asked again. When false, the key lives only in memory and
   * the user re-enters the PIN after each Chrome restart.
   *
   * Default is `false` so existing users keep their original PIN-protected
   * behavior when updating. The user opts in via the side-panel toggle.
   */
  persistUnlock: boolean;
  /** Preferred MEV judicial department code (e.g., "80" for Avellaneda) */
  mevDepartamento: string;
}

const STORAGE_KEY = 'tl_settings';

export const DEFAULT_SETTINGS: ProcuAsistSettings = {
  darkMode: false,
  keepAliveMev: true,
  keepAliveEje: true,
  keepAlivePjn: true,
  autoReconnect: true,
  persistUnlock: false, // safe default: do not persist the key across restarts
  mevDepartamento: 'aa', // "TODOS los Deptos" by default
};

export async function getSettings(): Promise<ProcuAsistSettings> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return { ...DEFAULT_SETTINGS, ...(stored[STORAGE_KEY] ?? {}) };
}

export async function updateSettings(
  partial: Partial<ProcuAsistSettings>
): Promise<ProcuAsistSettings> {
  const current = await getSettings();
  const updated = { ...current, ...partial };
  await chrome.storage.local.set({ [STORAGE_KEY]: updated });
  return updated;
}
