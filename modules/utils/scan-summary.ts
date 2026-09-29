export interface ScanCoverage {
  errors?: number;
  missingIds?: number;
  missingTabs?: number;
  skippedByChallenge?: number;
  skippedByDownload?: number;
}

/** Cada causa pendiente aparece en un solo contador del recorrido. */
export function pendingScans(r: ScanCoverage): number {
  return (r.errors || 0) + (r.missingIds || 0) + (r.missingTabs || 0)
    + (r.skippedByChallenge || 0) + (r.skippedByDownload || 0);
}
