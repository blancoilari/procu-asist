/**
 * Bookmark storage: local-first using chrome.storage.local.
 *
 * Identidad de una causa MEV: la importación desde sets NO trae el número de
 * expediente formateado (LP-1234-2024), así que la causa entra identificada
 * por su id interno (nidCausa) usado como caseNumber. El número real recién
 * aparece al abrir la causa en el portal. Por eso el matching de duplicados
 * compara número normalizado O nidCausa, y al re-guardar/detectar la causa
 * los datos pobres se mejoran (nunca al revés).
 */

import type { Bookmark, Case, PortalId } from '@/modules/portals/types';

const STORAGE_KEY = 'tl_bookmarks';

function normalizeCaseNumber(value: string): string {
  return (value ?? '').replace(/\s+/g, '').toUpperCase();
}

function getQueryParam(url: string, param: string): string {
  if (!url) return '';
  try {
    return new URL(url).searchParams.get(param) ?? '';
  } catch {
    return '';
  }
}

/** nidCausa de una causa/marcador (metadata o querystring de su URL). */
export function getCaseNid(item: {
  portalUrl?: string;
  metadata?: Case['metadata'];
}): string {
  return (
    item.metadata?.nidCausa || getQueryParam(item.portalUrl ?? '', 'nidCausa')
  );
}

/** ¿El "número" guardado es en realidad un id interno (solo dígitos)? */
function isNidLike(caseNumber: string): boolean {
  return /^\d+$/.test((caseNumber ?? '').trim());
}

/** El número formateado le gana al id interno; ante dos formateados, el nuevo. */
function pickBetterCaseNumber(oldValue: string, newValue: string): string {
  if (!newValue) return oldValue;
  if (!oldValue) return newValue;
  if (isNidLike(newValue) && !isNidLike(oldValue)) return oldValue;
  return newValue;
}

function pickBetterTitle(oldValue: string, newValue: string): string {
  if (!newValue || newValue === 'Sin caratula') return oldValue || newValue;
  return newValue;
}

function isSameBookmarkCase(
  bookmark: Bookmark,
  target: {
    portal: PortalId;
    caseNumber: string;
    nidCausa?: string;
    portalUrl?: string;
  }
): boolean {
  if (bookmark.portal !== target.portal) return false;

  const a = normalizeCaseNumber(bookmark.caseNumber);
  const b = normalizeCaseNumber(target.caseNumber);
  if (a && b && a === b) return true;

  const bookmarkNid = getCaseNid(bookmark);
  const targetNid =
    target.nidCausa || getQueryParam(target.portalUrl ?? '', 'nidCausa');
  return Boolean(bookmarkNid && targetNid && bookmarkNid === targetNid);
}

/** Get all bookmarks */
export async function getBookmarks(): Promise<Bookmark[]> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return (stored[STORAGE_KEY] as Bookmark[]) ?? [];
}

/** Mezcla datos nuevos sobre un marcador existente sin degradar lo bueno. */
function mergeBookmark(existing: Bookmark, caseData: Case): Bookmark {
  return {
    ...existing,
    ...caseData,
    caseNumber: pickBetterCaseNumber(existing.caseNumber, caseData.caseNumber),
    title: pickBetterTitle(existing.title, caseData.title),
    court: caseData.court || existing.court,
    portalUrl: caseData.portalUrl || existing.portalUrl,
    metadata: {
      ...existing.metadata,
      ...caseData.metadata,
    },
    position: existing.position,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
}

/** Add a new bookmark from case data */
export async function addBookmark(caseData: Case): Promise<Bookmark> {
  const bookmarks = await getBookmarks();

  // Check for duplicates (por número normalizado o nidCausa)
  const existing = bookmarks.find((b) =>
    isSameBookmarkCase(b, {
      portal: caseData.portal,
      caseNumber: caseData.caseNumber,
      nidCausa: caseData.metadata?.nidCausa,
      portalUrl: caseData.portalUrl,
    })
  );
  if (existing) {
    const updated = mergeBookmark(existing, caseData);
    const idx = bookmarks.indexOf(existing);
    bookmarks[idx] = updated;
    await chrome.storage.local.set({ [STORAGE_KEY]: bookmarks });
    return updated;
  }

  const bookmark: Bookmark = {
    ...caseData,
    position: bookmarks.length,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  bookmarks.push(bookmark);
  await chrome.storage.local.set({ [STORAGE_KEY]: bookmarks });
  return bookmark;
}

/**
 * Al detectar una causa abierta en el portal, mejorar el marcador existente
 * (número real de expediente, carátula, juzgado) sin crear uno nuevo.
 * Devuelve true si había marcador y se actualizó algo.
 */
export async function backfillBookmarkFromDetection(
  caseData: Case
): Promise<boolean> {
  const bookmarks = await getBookmarks();
  const existing = bookmarks.find((b) =>
    isSameBookmarkCase(b, {
      portal: caseData.portal,
      caseNumber: caseData.caseNumber,
      nidCausa: caseData.metadata?.nidCausa,
      portalUrl: caseData.portalUrl,
    })
  );
  if (!existing) return false;

  const updated = mergeBookmark(existing, caseData);
  // Comparar sin updatedAt (mergeBookmark siempre lo renueva).
  const changed =
    JSON.stringify({ ...updated, updatedAt: '' }) !==
    JSON.stringify({ ...existing, updatedAt: '' });
  if (!changed) return false;
  const idx = bookmarks.indexOf(existing);
  bookmarks[idx] = updated;
  await chrome.storage.local.set({ [STORAGE_KEY]: bookmarks });
  return true;
}

/** Remove a bookmark */
export async function removeBookmark(
  portal: PortalId,
  caseNumber: string
): Promise<void> {
  let bookmarks = await getBookmarks();
  bookmarks = bookmarks.filter(
    (b) => !(b.portal === portal && b.caseNumber === caseNumber)
  );
  // Re-index positions
  bookmarks.forEach((b, i) => {
    b.position = i;
  });
  await chrome.storage.local.set({ [STORAGE_KEY]: bookmarks });
}

/** Update a bookmark's data (e.g., after a new movement is detected) */
export async function updateBookmark(
  portal: PortalId,
  caseNumber: string,
  partial: Partial<Case>
): Promise<Bookmark | null> {
  const bookmarks = await getBookmarks();
  const idx = bookmarks.findIndex(
    (b) => b.portal === portal && b.caseNumber === caseNumber
  );
  if (idx === -1) return null;

  bookmarks[idx] = {
    ...bookmarks[idx],
    ...partial,
    metadata: {
      ...bookmarks[idx].metadata,
      ...partial.metadata,
    },
    updatedAt: new Date().toISOString(),
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: bookmarks });
  return bookmarks[idx];
}

/** Reorder bookmarks by moving one from oldIndex to newIndex */
export async function reorderBookmarks(
  oldIndex: number,
  newIndex: number
): Promise<void> {
  const bookmarks = await getBookmarks();
  if (
    oldIndex < 0 ||
    oldIndex >= bookmarks.length ||
    newIndex < 0 ||
    newIndex >= bookmarks.length
  ) {
    return;
  }

  const [moved] = bookmarks.splice(oldIndex, 1);
  bookmarks.splice(newIndex, 0, moved);

  // Re-index positions
  bookmarks.forEach((b, i) => {
    b.position = i;
  });
  await chrome.storage.local.set({ [STORAGE_KEY]: bookmarks });
}

/** Check if a case is already bookmarked (por número normalizado o nidCausa) */
export async function isBookmarked(
  portal: PortalId,
  caseNumber: string,
  nidCausa?: string
): Promise<boolean> {
  const bookmarks = await getBookmarks();
  return bookmarks.some((b) =>
    isSameBookmarkCase(b, { portal, caseNumber, nidCausa })
  );
}

/** Search bookmarks by query (case number or title) */
export async function searchBookmarks(query: string): Promise<Bookmark[]> {
  const bookmarks = await getBookmarks();
  if (!query.trim()) return bookmarks;

  const lower = query.toLowerCase();
  return bookmarks.filter(
    (b) =>
      b.caseNumber.toLowerCase().includes(lower) ||
      b.title.toLowerCase().includes(lower) ||
      b.court.toLowerCase().includes(lower)
  );
}

/** Get bookmark count (for tier enforcement) */
export async function getBookmarkCount(): Promise<number> {
  const bookmarks = await getBookmarks();
  return bookmarks.length;
}
