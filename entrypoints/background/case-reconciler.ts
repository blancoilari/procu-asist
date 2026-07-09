/**
 * Marcador = monitoreo: concilia ambos stores para que cada causa guardada
 * tenga su monitor (cuando el portal lo permite) y cada monitor tenga su
 * marcador. Corre al iniciar el service worker; es idempotente y barato.
 *
 * Excepciones:
 *  - MEV sin nidCausa/pidJuzgado: no se puede escanear — queda guardada
 *    como causa "sin escaneo" hasta que el usuario la abra en MEV.
 *  - eje (oculto de la UI): no se monitorea.
 */

import {
  getBookmarks,
  addBookmark,
  getCaseNid,
} from '@/modules/storage/bookmark-store';
import { getMonitors, addMonitor } from '@/modules/storage/monitor-store';
import type { Bookmark } from '@/modules/portals/types';

function caseKey(portal: string, caseNumber: string): string {
  return `${portal}:${caseNumber.replace(/\s+/g, '').toUpperCase()}`;
}

/**
 * Dedup de marcadores por nidCausa: una causa importada desde un set MEV
 * (identificada por su id interno) y la misma causa guardada a mano desde su
 * página (número formateado) quedaban como dos marcadores. Se fusionan en
 * uno, prefiriendo el número formateado y los datos más completos.
 */
async function dedupeBookmarksByNid(bookmarks: Bookmark[]): Promise<Bookmark[]> {
  const byNid = new Map<string, Bookmark>();
  const result: Bookmark[] = [];
  let removed = 0;

  const isNidLike = (v: string) => /^\d+$/.test((v ?? '').trim());

  for (const b of bookmarks) {
    const nid = b.portal === 'mev' ? getCaseNid(b) : '';
    if (!nid) {
      result.push(b);
      continue;
    }
    const key = `${b.portal}:${nid}`;
    const prev = byNid.get(key);
    if (!prev) {
      byNid.set(key, b);
      result.push(b);
      continue;
    }
    // Fusionar b dentro de prev (in place: prev ya está en result).
    if (isNidLike(prev.caseNumber) && !isNidLike(b.caseNumber)) {
      prev.caseNumber = b.caseNumber;
    }
    if (!prev.title || prev.title === 'Sin caratula') prev.title = b.title;
    if (!prev.court) prev.court = b.court;
    if (!prev.portalUrl) prev.portalUrl = b.portalUrl;
    prev.metadata = { ...b.metadata, ...prev.metadata };
    if (b.createdAt < prev.createdAt) prev.createdAt = b.createdAt;
    removed++;
  }

  if (removed > 0) {
    result.forEach((b, i) => {
      b.position = i;
    });
    await chrome.storage.local.set({ tl_bookmarks: result });
    console.debug(
      `[ProcuAsist] Dedup de marcadores por nidCausa: ${removed} fusionados`
    );
  }
  return result;
}

export async function reconcileBookmarksAndMonitors(): Promise<void> {
  try {
    const [rawBookmarks, monitors] = await Promise.all([
      getBookmarks(),
      getMonitors(),
    ]);
    const bookmarks = await dedupeBookmarksByNid(rawBookmarks);

    const monitorKeys = new Set(
      monitors.map((m) => caseKey(m.portal, m.caseNumber))
    );
    const bookmarkKeys = new Set(
      bookmarks.map((b) => caseKey(b.portal, b.caseNumber))
    );

    let monitorsAdded = 0;
    let bookmarksAdded = 0;

    // Cada marcador escaneable → monitor.
    for (const b of bookmarks) {
      if (monitorKeys.has(caseKey(b.portal, b.caseNumber))) continue;
      if (b.portal === 'eje') continue;
      if (
        b.portal === 'mev' &&
        !(b.metadata?.nidCausa && b.metadata?.pidJuzgado)
      ) {
        continue;
      }
      await addMonitor({
        portal: b.portal,
        caseNumber: b.caseNumber,
        title: b.title,
        court: b.court,
        portalUrl: b.portalUrl,
        metadata: {
          nidCausa: b.metadata?.nidCausa,
          pidJuzgado: b.metadata?.pidJuzgado,
        },
      });
      monitorsAdded++;
    }

    // Cada monitor huérfano → marcador (para que aparezca en la lista única).
    for (const m of monitors) {
      if (bookmarkKeys.has(caseKey(m.portal, m.caseNumber))) continue;
      await addBookmark({
        id: m.nidCausa || m.caseNumber,
        portal: m.portal,
        caseNumber: m.caseNumber,
        title: m.title,
        court: m.court,
        fuero: '',
        portalUrl: m.portalUrl,
        metadata: {
          nidCausa: m.nidCausa,
          pidJuzgado: m.pidJuzgado,
        },
      });
      bookmarksAdded++;
    }

    if (monitorsAdded || bookmarksAdded) {
      console.debug(
        `[ProcuAsist] Conciliación marcador=monitoreo: +${monitorsAdded} monitores, +${bookmarksAdded} marcadores`
      );
    }
  } catch (err) {
    console.warn('[ProcuAsist] Falló la conciliación marcador=monitoreo:', err);
  }
}
