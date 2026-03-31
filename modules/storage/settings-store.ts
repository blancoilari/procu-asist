/**
 * User preferences storage.
 */

export interface ProcuAsistSettings {
  darkMode: boolean;
  keepAliveMev: boolean;
  keepAlivePjn: boolean;
  autoReconnect: boolean;
  /** Preferred MEV judicial department code (e.g., "80" for Avellaneda) */
  mevDepartamento: string;
}

const STORAGE_KEY = 'tl_settings';

const DEFAULT_SETTINGS: ProcuAsistSettings = {
  darkMode: false,
  keepAliveMev: true,
  keepAlivePjn: true,
  autoReconnect: true,
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
