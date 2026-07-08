/**
 * User preferences storage.
 */

export interface ProcuAsistSettings {
  darkMode: boolean;
  keepAliveMev: boolean;
  keepAliveEje: boolean;
  keepAlivePjn: boolean;
  autoReconnect: boolean;
  /** Preferred MEV judicial department code (e.g., "80" for Avellaneda) */
  mevDepartamento: string;
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
  mevDepartamento: 'aa', // "TODOS los Deptos" by default
  // Escaneo rapido por novedades de set: OFF por defecto. Depende del form de
  // busqueda de la MEV (novedades por fecha), que no esta verificado a fondo
  // en vivo; el escaneo causa por causa (default) es confiable. Se puede
  // activar como beta desde Ajustes.
  mevScanBySets: false,
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
