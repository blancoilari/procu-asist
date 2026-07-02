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
  /**
   * Umbral anti-ruido del asistente "Importar todo": si en una corrida se
   * importan MÁS causas nuevas que este número, sus monitores quedan con
   * avisos pausados (el usuario activa el monitoreo de lo que le importa).
   * Por debajo del umbral, monitoreo activo normal.
   */
  importAllPauseThreshold: number;
  /**
   * Escaneo rápido MEV por novedades de set (beta): en vez de recorrer
   * causa por causa, consulta la búsqueda "novedades de set" de la MEV y
   * solo re-lee las causas que se movieron. Ante CUALQUIER falla cae solo
   * al escaneo completo; además hay un barrido completo diario de respaldo
   * y el escaneo manual ("Escanear ahora") siempre revisa causa por causa.
   */
  mevScanBySets: boolean;
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
  importAllPauseThreshold: 50,
  mevScanBySets: true,
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

  // Sanitizar el umbral de pausa: entero entre 1 y 1000 (un valor absurdo
  // rompe el sentido anti-ruido de la función).
  const threshold = Number(updated.importAllPauseThreshold);
  updated.importAllPauseThreshold = Number.isFinite(threshold)
    ? Math.min(1000, Math.max(1, Math.round(threshold)))
    : DEFAULT_SETTINGS.importAllPauseThreshold;

  await chrome.storage.local.set({ [STORAGE_KEY]: updated });
  return updated;
}
