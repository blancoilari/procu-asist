/**
 * Nombres de los archivos de la descarga de un expediente de la MEV.
 *
 * Formato: AAAA-MM-DD_fs-X_DESCRIPCION (sin fojas: AAAA-MM-DD_DESCRIPCION).
 * La fecha adelante ordena los archivos por fecha y hace que una descarga
 * parcial encaje en la carpeta de una anterior sin pisar nada (decisión del
 * titular del 22/09/2026; antes el número inicial era la posición dentro de
 * lo tildado y volvía a 001 en cada descarga). Limitación aceptada: dentro
 * de un mismo día el Explorador ordena por fojas como texto, no en el orden
 * de la MEV.
 *
 * Módulo puro: sin chrome.* ni DOM, se prueba en node.
 */

export interface NamingMovement {
  date: string;
  fojas?: string;
  description: string;
  hasDocuments: boolean;
}

/** Marcas de combinación Unicode (los acentos que deja NFD). */
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g');

/** dd/mm/aaaa (con o sin hora) a AAAA-MM-DD; si no se reconoce, 'sin-fecha'. */
export function isoDateForName(date: string): string {
  const match = (date ?? '').trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (!match) return 'sin-fecha';
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/** Fojas para el nombre: la barra pasa a guion y se descarta lo demás. */
export function safeFojas(fojas?: string): string {
  return (fojas ?? '').trim().replace(/\//g, '-').replace(/[^a-zA-Z0-9-]/g, '');
}

/**
 * Descripción para el nombre: tildes y eñe a su letra base (antes
 * "ACOMPAÑA" quedaba "ACOMPAA"), primeros 35 caracteres, solo letras,
 * números, espacios y guiones, y los espacios pasan a guion bajo.
 */
export function safeDescription(description: string): string {
  return (description ?? '')
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .substring(0, 35)
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

/** Nombre base de un paso procesal, sin extensión y sin sufijo de colisión. */
export function buildFileBase(mov: { date: string; fojas?: string; description: string }): string {
  const parts = [isoDateForName(mov.date)];
  const fojas = safeFojas(mov.fojas);
  if (fojas) parts.push(`fs-${fojas}`);
  const description = safeDescription(mov.description);
  if (description) parts.push(description);
  return parts.join('_');
}

/**
 * Nombre de cada movimiento con documentos, calculado sobre la lista
 * COMPLETA de la ficha, del más viejo al más nuevo. Si dos quedan iguales,
 * el segundo lleva _2, el tercero _3, salteando cualquier nombre ya usado.
 * La comparación no distingue mayúsculas, igual que Windows: "OFICIO" y
 * "Oficio" del mismo día y fojas se pisarían al descomprimir. Como el
 * cálculo es sobre la lista completa y no sobre lo tildado, el nombre de un
 * documento no cambia entre una descarga y otra.
 *
 * Devuelve un array paralelo a la entrada: null para los movimientos sin
 * documentos.
 */
export function assignFileBases(movementsOldestFirst: NamingMovement[]): Array<string | null> {
  const used = new Set<string>();
  return movementsOldestFirst.map((mov) => {
    if (!mov.hasDocuments) return null;
    const base = buildFileBase(mov);
    let name = base;
    let n = 1;
    while (used.has(name.toLowerCase())) {
      n += 1;
      name = `${base}_${n}`;
    }
    used.add(name.toLowerCase());
    return name;
  });
}

/**
 * Lo mismo que assignFileBases, para una lista en el orden en que la
 * muestra la MEV (más nuevo primero): el cálculo se hace del más viejo al
 * más nuevo y el resultado vuelve en el orden de la entrada. Así los pasos
 * que aparecen mañana arriba de la lista no cambian el nombre de los de hoy.
 */
export function fileBasesInMevOrder(movementsNewestFirst: NamingMovement[]): Array<string | null> {
  return assignFileBases(movementsNewestFirst.slice().reverse()).reverse();
}

/** Fecha y hora para nombres de archivo: AAAA-MM-DD_HHMM. */
export function downloadStamp(at: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${at.getFullYear()}-${p(at.getMonth() + 1)}-${p(at.getDate())}_${p(at.getHours())}${p(at.getMinutes())}`;
}

/** Nombre del informe de faltantes, con fecha y hora para no pisar el de otra descarga. */
export function verificationFileName(at: Date): string {
  return `_verificacion_${downloadStamp(at)}.txt`;
}
