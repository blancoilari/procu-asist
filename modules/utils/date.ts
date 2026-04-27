/**
 * Date helpers for portal dates.
 * Supports Argentine portal dates (dd/mm/yyyy) and ISO dates (yyyy-mm-dd).
 */

export function parseDateOnly(value: string): number | null {
  const clean = value.trim();
  const iso = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const [, year, month, day] = iso;
    return Date.UTC(Number(year), Number(month) - 1, Number(day));
  }

  const ar = clean.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (ar) {
    const [, day, month, year] = ar;
    return Date.UTC(Number(year), Number(month) - 1, Number(day));
  }

  const parsed = new Date(clean).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

export function isDateOnOrAfter(value: string, fromDate: string): boolean {
  const valueTime = parseDateOnly(value);
  const fromTime = parseDateOnly(fromDate);
  if (valueTime === null || fromTime === null) return false;
  return valueTime >= fromTime;
}
