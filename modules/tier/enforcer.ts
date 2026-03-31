/**
 * Tier enforcement: checks limits before performing actions.
 */

import { TIER_LIMITS, type TierPlan } from './limits';
import { getBookmarkCount } from '@/modules/storage/bookmark-store';
import { getMonitorCount } from '@/modules/storage/monitor-store';

const PDF_COUNTER_KEY = 'tl_pdf_downloads';

interface PdfCounter {
  count: number;
  /** ISO string of the first day of the current tracking month */
  monthStart: string;
}

/** Get current month start as ISO string (YYYY-MM-01) */
function getCurrentMonthStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

/** Get PDF download count for the current month */
async function getPdfDownloadCount(): Promise<number> {
  const stored = await chrome.storage.local.get(PDF_COUNTER_KEY);
  const counter = stored[PDF_COUNTER_KEY] as PdfCounter | undefined;
  if (!counter) return 0;

  // Reset if we're in a new month
  if (counter.monthStart !== getCurrentMonthStart()) return 0;
  return counter.count;
}

/** Increment PDF download counter for the current month */
export async function trackPdfDownload(): Promise<void> {
  const monthStart = getCurrentMonthStart();
  const currentCount = await getPdfDownloadCount();
  const counter: PdfCounter = { count: currentCount + 1, monthStart };
  await chrome.storage.local.set({ [PDF_COUNTER_KEY]: counter });
}

export type Action = 'add_bookmark' | 'add_monitor' | 'download_pdf';

export interface EnforcementResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  tierPlan: TierPlan;
}

/** Get the user's current tier plan */
async function getCurrentTier(): Promise<TierPlan> {
  const stored = await chrome.storage.local.get('tl_tier');
  return (stored.tl_tier as TierPlan) ?? 'free';
}

/** Check if an action is allowed under the current tier */
export async function checkLimit(action: Action): Promise<EnforcementResult> {
  const tier = await getCurrentTier();
  const limits = TIER_LIMITS[tier];

  let currentCount = 0;
  let limit = 0;

  switch (action) {
    case 'add_bookmark':
      currentCount = await getBookmarkCount();
      limit = limits.maxBookmarks;
      break;
    case 'add_monitor':
      currentCount = await getMonitorCount();
      limit = limits.maxMonitors;
      break;
    case 'download_pdf':
      currentCount = await getPdfDownloadCount();
      limit = limits.maxPdfMovements;
      break;
  }

  return {
    allowed: limit === -1 || limit === Infinity || currentCount < limit,
    currentCount,
    limit,
    tierPlan: tier,
  };
}
