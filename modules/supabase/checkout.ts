/**
 * MercadoPago checkout integration.
 * Creates checkout sessions via Supabase Edge Function.
 */

import { getSupabaseClient } from './client';
import { getCurrentUser } from './auth';
import type { TierPlan } from '@/modules/tier/limits';

export interface CheckoutSession {
  url: string;
  preferenceId: string;
}

/**
 * Create a MercadoPago checkout session for a subscription plan.
 * Calls a Supabase Edge Function that creates the MP preference.
 */
export async function createCheckout(
  plan: Exclude<TierPlan, 'free' | 'custom'>,
  billingCycle: 'monthly' | 'annual'
): Promise<CheckoutSession> {
  const user = await getCurrentUser();
  if (!user) throw new Error('User must be signed in to subscribe');

  const supabase = getSupabaseClient();

  const { data, error } = await supabase.functions.invoke('create-checkout', {
    body: {
      plan,
      billingCycle,
      userId: user.id,
      email: user.email,
    },
  });

  if (error) throw new Error(error.message ?? 'Checkout creation failed');
  if (!data?.url) throw new Error('No checkout URL returned');

  return {
    url: data.url,
    preferenceId: data.preferenceId,
  };
}

/**
 * Open the MercadoPago checkout in a new tab.
 */
export async function openCheckout(
  plan: Exclude<TierPlan, 'free' | 'custom'>,
  billingCycle: 'monthly' | 'annual'
): Promise<void> {
  const session = await createCheckout(plan, billingCycle);
  await chrome.tabs.create({ url: session.url });
}

/**
 * Get current subscription status from Supabase.
 */
export async function getSubscriptionStatus(): Promise<{
  tier: TierPlan;
  status: string;
  currentPeriodEnd?: string;
  billingCycle?: string;
} | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('subscriptions')
    .select('tier, status, current_period_end, billing_cycle')
    .eq('user_id', user.id)
    .single();

  if (error || !data) return null;

  return {
    tier: data.tier as TierPlan,
    status: data.status,
    currentPeriodEnd: data.current_period_end,
    billingCycle: data.billing_cycle,
  };
}
