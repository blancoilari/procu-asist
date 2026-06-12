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

import { getBookmarks, addBookmark } from '@/modules/storage/bookmark-store';
import { getMonitors, addMonitor } from '@/modules/storage/monitor-store';

function caseKey(portal: string, caseNumber: string): string {
  return `${portal}:${caseNumber.replace(/\s+/g, '').toUpperCase()}`;
}

export async function reconcileBookmarksAndMonitors(): Promise<void> {
  try {
    const [bookmarks, monitors] = await Promise.all([
      getBookmarks(),
      getMonitors(),
    ]);

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
