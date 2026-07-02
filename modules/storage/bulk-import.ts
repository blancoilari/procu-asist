/**
 * Importación masiva de causas (compartida por el mensaje BULK_IMPORT y el
 * asistente "Importar todo" del background).
 *
 * La deduplicación descansa en las claves existentes: los marcadores dedupen
 * por portal + caseNumber (bookmark-store) y los monitores por portal +
 * caseNumber normalizado o nidCausa (monitor-store). Acá solo se cuenta.
 */

import type { Case } from '@/modules/portals/types';
import { addBookmark, isBookmarked } from '@/modules/storage/bookmark-store';
import { addMonitor, isMonitored } from '@/modules/storage/monitor-store';

export type BulkImportCase = Partial<Case> & {
  caseNumber: string;
  title: string;
};

export interface BulkImportSummary {
  imported: number;
  existing: number;
  monitored: number;
  failed: number;
  /**
   * IDs de monitores CREADOS en esta corrida (no los que ya existían).
   * El asistente "Importar todo" los usa para pausar avisos si el total
   * importado supera el umbral configurado.
   */
  newMonitorIds: string[];
}

export async function runBulkImport(
  cases: BulkImportCase[],
  source: string,
  monitor: boolean
): Promise<BulkImportSummary> {
  console.debug(
    `[ProcuAsist] Bulk import: ${cases.length} cases from ${source}`
  );
  let imported = 0;
  let existing = 0;
  let monitored = 0;
  let failed = 0;
  const newMonitorIds: string[] = [];

  for (const c of cases) {
    try {
      const richCaseObj = c;
      const portal = richCaseObj.portal ?? ('mev' as const);
      const wasBookmarked = await isBookmarked(portal, richCaseObj.caseNumber);
      const caseData = {
        id:
          richCaseObj.id ||
          richCaseObj.metadata?.nidCausa ||
          richCaseObj.caseNumber,
        portal,
        caseNumber: richCaseObj.caseNumber,
        title: richCaseObj.title || 'Sin caratula',
        court: richCaseObj.court ?? '',
        fuero: richCaseObj.fuero ?? '',
        portalUrl: richCaseObj.portalUrl ?? '',
        metadata: richCaseObj.metadata,
      };

      await addBookmark(caseData);
      if (wasBookmarked) {
        existing++;
      } else {
        imported++;
      }

      // MEV requiere nidCausa/pidJuzgado para el escaneo; PJN se monitorea
      // por expediente/carátula contra el feed de la API.
      const canMonitor =
        monitor &&
        (portal === 'pjn' ||
          (portal === 'mev' &&
            caseData.metadata?.nidCausa &&
            caseData.metadata?.pidJuzgado));
      if (canMonitor) {
        const wasMonitored = await isMonitored(portal, richCaseObj.caseNumber);
        const created = await addMonitor({
          portal,
          caseNumber: richCaseObj.caseNumber,
          title: caseData.title,
          court: caseData.court,
          portalUrl: caseData.portalUrl,
          metadata: {
            nidCausa: caseData.metadata?.nidCausa,
            pidJuzgado: caseData.metadata?.pidJuzgado,
          },
        });
        if (!wasMonitored) {
          monitored++;
          newMonitorIds.push(created.id);
        }
      }
    } catch (err) {
      // Skip the failing case but keep importing the rest.
      failed++;
      console.warn(
        `[ProcuAsist] Bulk import failed for ${c?.caseNumber ?? '?'}:`,
        err
      );
    }
  }

  return { imported, existing, monitored, failed, newMonitorIds };
}
