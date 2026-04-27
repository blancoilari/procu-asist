/**
 * Bookmark storage: local-first using chrome.storage.local.
 */

import type { Bookmark, Case, PortalId } from '@/modules/portals/types';

const STORAGE_KEY = 'tl_bookmarks';

/** Get all bookmarks */
export async function getBookmarks(): Promise<Bookmark[]> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return (stored[STORAGE_KEY] as Bookmark[]) ?? [];
}

/** Add a new bookmark from case data */
export async function addBookmark(caseData: Case): Promise<Bookmark> {
  const bookmarks = await getBookmarks();

  // Check for duplicates
  const existing = bookmarks.find(
    (b) => b.portal === caseData.portal && b.caseNumber === caseData.caseNumber
  );
  if (existing) {
    const updated: Bookmark = {
      ...existing,
      ...caseData,
      metadata: {
        ...existing.metadata,
        ...caseData.metadata,
      },
      position: existing.position,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
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

/** Check if a case is already bookmarked */
export async function isBookmarked(
  portal: PortalId,
  caseNumber: string
): Promise<boolean> {
  const bookmarks = await getBookmarks();
  return bookmarks.some(
    (b) => b.portal === portal && b.caseNumber === caseNumber
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
