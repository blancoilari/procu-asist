/**
 * Tier plan limits and definitions.
 */

export type TierPlan = 'free' | 'junior' | 'senior' | 'custom';

export interface TierLimits {
  maxBookmarks: number;
  maxMonitors: number;
  maxPdfMovements: number; // per download, -1 = unlimited
  label: string;
  priceMonthly: number; // ARS
  priceAnnualMonthly: number; // ARS per month, billed annually
}

export const TIER_LIMITS: Record<TierPlan, TierLimits> = {
  free: {
    maxBookmarks: 3,
    maxMonitors: 1,
    maxPdfMovements: 5,
    label: 'Free',
    priceMonthly: 0,
    priceAnnualMonthly: 0,
  },
  junior: {
    maxBookmarks: 50,
    maxMonitors: 50,
    maxPdfMovements: 50,
    label: 'Junior',
    priceMonthly: 8900,
    priceAnnualMonthly: 7120,
  },
  senior: {
    maxBookmarks: 500,
    maxMonitors: 500,
    maxPdfMovements: -1,
    label: 'Senior',
    priceMonthly: 15275,
    priceAnnualMonthly: 12220,
  },
  custom: {
    maxBookmarks: Infinity,
    maxMonitors: Infinity,
    maxPdfMovements: -1,
    label: 'Custom',
    priceMonthly: 0,
    priceAnnualMonthly: 0,
  },
};

export const TRIAL_DURATION_DAYS = 15;
