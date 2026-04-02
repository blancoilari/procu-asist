/**
 * Tier enforcement — no-op module.
 * ProcuAsist is free: all actions are always allowed.
 */

export type Action = 'add_bookmark' | 'add_monitor' | 'download_pdf';

export interface EnforcementResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  tierPlan: 'free';
}

/** All actions are always allowed — ProcuAsist is free */
export async function checkLimit(_action: Action): Promise<EnforcementResult> {
  return {
    allowed: true,
    currentCount: 0,
    limit: -1,
    tierPlan: 'free',
  };
}
