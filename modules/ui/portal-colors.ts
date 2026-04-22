/**
 * Portal color palette.
 *
 * Each portal gets its own institutional color used for injected UI in its
 * pages (content scripts) and portal-identifying badges inside ProcuAsist.
 *
 * `primary`   → solid buttons / FAB background.
 * `hover`     → same tone slightly darker for hover state.
 * `bgSoft`    → pill / badge background (light mode).
 * `textSoft`  → pill / badge foreground (light mode).
 * `bgDark`    → pill / badge background (dark mode).
 * `textDark`  → pill / badge foreground (dark mode).
 */

import type { PortalId } from '@/modules/portals/types';

export type PortalColor = {
  primary: string;
  hover: string;
  bgSoft: string;
  textSoft: string;
  bgDark: string;
  textDark: string;
};

export const PORTAL_COLORS: Record<PortalId, PortalColor> = {
  mev: {
    primary: '#1e3a5f',
    hover: '#162c47',
    bgSoft: '#dbeafe',
    textSoft: '#1e3a5f',
    bgDark: '#1e3a8a',
    textDark: '#bfdbfe',
  },
  eje: {
    primary: '#0891b2',
    hover: '#0e7490',
    bgSoft: '#cffafe',
    textSoft: '#155e75',
    bgDark: '#155e75',
    textDark: '#a5f3fc',
  },
  pjn: {
    primary: '#991b1b',
    hover: '#7f1d1d',
    bgSoft: '#fee2e2',
    textSoft: '#991b1b',
    bgDark: '#7f1d1d',
    textDark: '#fecaca',
  },
};

/** Same navy as MEV (SCBA family) for the Notificaciones portal. */
export const SCBA_NOTIF_COLOR: PortalColor = PORTAL_COLORS.mev;

/** ProcuAsist brand color — used in the extension's own UI, not inside portals. */
export const BRAND_PRIMARY = '#2563eb';
export const BRAND_PRIMARY_HOVER = '#1d4ed8';
