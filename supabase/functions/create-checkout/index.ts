/**
 * Supabase Edge Function: create-checkout
 * Creates a MercadoPago preference for subscription checkout.
 *
 * Deploy with: supabase functions deploy create-checkout
 * Set secrets:
 *   supabase secrets set MP_ACCESS_TOKEN=your_mp_access_token
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const PLANS = {
  junior: {
    monthly: { price: 8900, title: 'ProcuAsist Junior - Mensual' },
    annual: { price: 85440, title: 'ProcuAsist Junior - Anual' },
  },
  senior: {
    monthly: { price: 15275, title: 'ProcuAsist Senior - Mensual' },
    annual: { price: 146640, title: 'ProcuAsist Senior - Anual' },
  },
} as const;

/** Build CORS headers. Chrome extensions send origin as chrome-extension://ID */
function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { plan, billingCycle, userId, email } = await req.json();

    if (!plan || !billingCycle || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const planConfig = PLANS[plan as keyof typeof PLANS];
    if (!planConfig) {
      return new Response(
        JSON.stringify({ error: 'Invalid plan' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cycleConfig = planConfig[billingCycle as keyof typeof planConfig];

    // Create MercadoPago preference
    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        items: [
          {
            title: cycleConfig.title,
            quantity: 1,
            unit_price: cycleConfig.price,
            currency_id: 'ARS',
          },
        ],
        payer: {
          email: email || undefined,
        },
        external_reference: `${userId}:${plan}:${billingCycle}`,
        back_urls: {
          success: `${SUPABASE_URL}/functions/v1/mp-webhook?status=approved`,
          failure: `${SUPABASE_URL}/functions/v1/mp-webhook?status=rejected`,
          pending: `${SUPABASE_URL}/functions/v1/mp-webhook?status=pending`,
        },
        auto_return: 'approved',
        notification_url: `${SUPABASE_URL}/functions/v1/mp-webhook`,
      }),
    });

    if (!mpResponse.ok) {
      const mpError = await mpResponse.text();
      console.error('MercadoPago error:', mpError);
      return new Response(
        JSON.stringify({ error: 'MercadoPago preference creation failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const mpData = await mpResponse.json();

    // Create or update subscription record as 'pending'
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    await supabase.from('subscriptions').upsert(
      {
        user_id: userId,
        tier: plan,
        billing_cycle: billingCycle,
        status: 'trialing',
        mp_subscription_id: mpData.id,
      },
      { onConflict: 'user_id' }
    );

    return new Response(
      JSON.stringify({
        url: mpData.init_point,
        preferenceId: mpData.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Checkout error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
