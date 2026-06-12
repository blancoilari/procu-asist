/**
 * Cálculo de plazos procesales (días hábiles judiciales).
 *
 * Reglas implementadas (CPCCN art. 156/124 y CPCC PBA art. 156/124):
 *  - El plazo en días hábiles corre desde el día hábil siguiente a la
 *    notificación; el vencimiento es el N-ésimo día hábil.
 *  - El plazo en días corridos se cuenta desde el día siguiente a la
 *    notificación; si vence en día inhábil se corre al primer hábil siguiente.
 *  - "Plazo de gracia": la presentación es válida dentro de las primeras
 *    horas del despacho del día hábil inmediato siguiente al vencimiento.
 *
 * Días inhábiles = fines de semana + feriados nacionales (lista embebida
 * 2026–2027) + rangos personalizados (ferias judiciales, asuetos locales)
 * que el usuario administra desde la pestaña Plazos.
 *
 * IMPORTANTE: los traslados de feriados por decreto y las ferias de invierno
 * varían por año y jurisdicción — el usuario debe cargarlos como rangos
 * personalizados. La UI lo aclara.
 */

export type PlazoKind = 'habiles' | 'corridos';

export interface InhabilRange {
  /** YYYY-MM-DD inclusive */
  from: string;
  /** YYYY-MM-DD inclusive */
  to: string;
  label: string;
}

/**
 * Feriados nacionales argentinos (fijos + carnaval/semana santa calculados).
 * No incluye feriados puente por decreto ni feriados provinciales.
 */
export const FERIADOS_NACIONALES: ReadonlyArray<string> = [
  // 2026
  '2026-01-01', // Año Nuevo
  '2026-02-16', // Carnaval
  '2026-02-17', // Carnaval
  '2026-03-24', // Día de la Memoria
  '2026-04-02', // Malvinas (coincide con Jueves Santo)
  '2026-04-03', // Viernes Santo
  '2026-05-01', // Día del Trabajador
  '2026-05-25', // Revolución de Mayo
  '2026-06-17', // Paso a la Inmortalidad del Gral. Güemes
  '2026-06-20', // Paso a la Inmortalidad del Gral. Belgrano
  '2026-07-09', // Independencia
  '2026-08-17', // Paso a la Inmortalidad del Gral. San Martín
  '2026-10-12', // Diversidad Cultural
  '2026-11-20', // Soberanía Nacional
  '2026-12-08', // Inmaculada Concepción
  '2026-12-25', // Navidad
  // 2027
  '2027-01-01',
  '2027-02-08', // Carnaval
  '2027-02-09', // Carnaval
  '2027-03-24', // Día de la Memoria
  '2027-03-25', // Jueves Santo
  '2027-03-26', // Viernes Santo
  '2027-04-02', // Malvinas
  '2027-05-01',
  '2027-05-25',
  '2027-06-17',
  '2027-06-20',
  '2027-07-09',
  '2027-08-17',
  '2027-10-12',
  '2027-11-20',
  '2027-12-08',
  '2027-12-25',
];

/** Ferias judiciales por defecto (editable por el usuario). */
export const DEFAULT_INHABILES: InhabilRange[] = [
  { from: '2026-01-01', to: '2026-01-31', label: 'Feria judicial de enero 2026' },
  { from: '2027-01-01', to: '2027-01-31', label: 'Feria judicial de enero 2027' },
];

// ────────────────────────────────────────────────────────
// Config (rangos inhábiles personalizados)
// ────────────────────────────────────────────────────────

const PLAZOS_CONFIG_KEY = 'tl_plazos_config';

export interface PlazosConfig {
  customInhabiles: InhabilRange[];
}

export async function getPlazosConfig(): Promise<PlazosConfig> {
  const stored = await chrome.storage.local.get(PLAZOS_CONFIG_KEY);
  const cfg = stored[PLAZOS_CONFIG_KEY] as PlazosConfig | undefined;
  if (cfg && Array.isArray(cfg.customInhabiles)) return cfg;
  return { customInhabiles: [...DEFAULT_INHABILES] };
}

export async function savePlazosConfig(cfg: PlazosConfig): Promise<void> {
  await chrome.storage.local.set({ [PLAZOS_CONFIG_KEY]: cfg });
}

// ────────────────────────────────────────────────────────
// Fechas (strings YYYY-MM-DD para evitar problemas de zona horaria)
// ────────────────────────────────────────────────────────

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toIsoDate(date: Date): string {
  return [
    String(date.getFullYear()),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

/** YYYY-MM-DD → DD/MM/YYYY para mostrar. */
export function formatDisplayDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function nextDayIso(iso: string): string {
  const d = parseIsoDate(iso);
  d.setDate(d.getDate() + 1);
  return toIsoDate(d);
}

/** Diferencia en días calendario (target - base). */
export function diffDays(baseIso: string, targetIso: string): number {
  const ms = parseIsoDate(targetIso).getTime() - parseIsoDate(baseIso).getTime();
  return Math.round(ms / 86_400_000);
}

// ────────────────────────────────────────────────────────
// Días hábiles
// ────────────────────────────────────────────────────────

export function isHabil(iso: string, extraInhabiles: InhabilRange[]): boolean {
  const day = parseIsoDate(iso).getDay();
  if (day === 0 || day === 6) return false;
  if (FERIADOS_NACIONALES.includes(iso)) return false;
  // Comparación lexicográfica: válida porque el formato es YYYY-MM-DD.
  return !extraInhabiles.some((r) => iso >= r.from && iso <= r.to);
}

/** Primer día hábil estrictamente posterior a `iso`. */
export function nextHabil(iso: string, extraInhabiles: InhabilRange[]): string {
  let cur = nextDayIso(iso);
  // Tope de seguridad: 1000 días evita un loop infinito si el usuario carga
  // un rango inhábil absurdo (p. ej. décadas enteras).
  for (let i = 0; i < 1000; i++) {
    if (isHabil(cur, extraInhabiles)) return cur;
    cur = nextDayIso(cur);
  }
  return cur;
}

// ────────────────────────────────────────────────────────
// Cálculo del plazo
// ────────────────────────────────────────────────────────

export interface PlazoResult {
  /** Último día del plazo (vencimiento). */
  dueDate: string;
  /** Día del plazo de gracia (primeras horas hábiles del día siguiente). */
  graceDate: string;
}

export function computePlazo(
  notifIso: string,
  days: number,
  kind: PlazoKind,
  extraInhabiles: InhabilRange[]
): PlazoResult {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(notifIso)) {
    throw new Error('Fecha de notificación inválida');
  }
  if (!Number.isInteger(days) || days <= 0 || days > 3650) {
    throw new Error('Cantidad de días inválida');
  }

  let dueDate: string;
  if (kind === 'habiles') {
    let cur = notifIso;
    for (let i = 0; i < days; i++) {
      cur = nextHabil(cur, extraInhabiles);
    }
    dueDate = cur;
  } else {
    const d = parseIsoDate(notifIso);
    d.setDate(d.getDate() + days);
    dueDate = toIsoDate(d);
    if (!isHabil(dueDate, extraInhabiles)) {
      dueDate = nextHabil(dueDate, extraInhabiles);
    }
  }

  return { dueDate, graceDate: nextHabil(dueDate, extraInhabiles) };
}
