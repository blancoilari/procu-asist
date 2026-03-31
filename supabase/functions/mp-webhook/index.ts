/**
 * Supabase Edge Function: mp-webhook
 * Handles MercadoPago payment notifications (IPN).
 *
 * Deploy with: supabase functions deploy mp-webhook
 * Set secrets:
 *   supabase secrets set MP_ACCESS_TOKEN=your_mp_access_token
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const url = new URL(req.url);

    // Handle IPN notification (POST from MercadoPago)
    if (req.method === 'POST') {
      const body = await req.json();
      console.log('MP Webhook received:', JSON.stringify(body));

      // MercadoPago sends different notification types
      if (body.type === 'payment') {
        const paymentId = body.data?.id;
        if (!paymentId) {
          return new Response('OK', { status: 200, headers: corsHeaders });
        }

        // Fetch payment details from MercadoPago
        const paymentRes = await fetch(
          `https://api.mercadopago.com/v1/payments/${paymentId}`,
          {
            headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
          }
        );

        if (!paymentRes.ok) {
          console.error('Failed to fetch payment:', await paymentRes.text());
          return new Response('OK', { status: 200, headers: corsHeaders });
        }

        const payment = await paymentRes.json();
        const externalRef = payment.external_reference as string;
        const [userId, plan, billingCycle] = externalRef.split(':');

        if (payment.status === 'approved') {
          // Calculate period end
          const now = new Date();
          const periodEnd = new Date(now);
          if (billingCycle === 'annual') {
            periodEnd.setFullYear(periodEnd.getFullYear() + 1);
          } else {
            periodEnd.setMonth(periodEnd.getMonth() + 1);
          }

          // Update subscription
          await supabase.from('subscriptions').upsert(
            {
              user_id: userId,
              tier: plan,
              billing_cycle: billingCycle,
              status: 'active',
              mp_subscription_id: payment.preference_id,
              mp_payer_id: payment.payer?.id?.toString(),
              current_period_start: now.toISOString(),
              current_period_end: periodEnd.toISOString(),
            },
            { onConflict: 'user_id' }
          );

          // Update user profile tier
          await supabase
            .from('profiles')
            .update({ tier: plan })
            .eq('id', userId);

          console.log(`Subscription activated for user ${userId}: ${plan} (${billingCycle})`);
        } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
          // Mark subscription as cancelled
          await supabase
            .from('subscriptions')
            .update({ status: 'cancelled' })
            .eq('user_id', userId);

          // Revert to free tier
          await supabase
            .from('profiles')
            .update({ tier: 'free' })
            .eq('id', userId);
        }
      }

      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    // Handle redirect back from checkout (GET)
    if (req.method === 'GET') {
      const status = url.searchParams.get('status');
      const externalRef = url.searchParams.get('external_reference');

      // Redirect to a simple confirmation page or close tab
      const html = `
        <!DOCTYPE html>
        <html>
        <head><title>ProcuAsist</title></head>
        <body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;background:#0f172a;color:white;">
          <div style="text-align:center;max-width:400px;">
            ${
              status === 'approved'
                ? '<h1>✅ Pago aprobado</h1><p>Tu suscripción está activa. Podés cerrar esta pestaña y volver a ProcuAsist.</p>'
                : status === 'pending'
                  ? '<h1>⏳ Pago pendiente</h1><p>Tu pago está siendo procesado. Te notificaremos cuando se acredite.</p>'
                  : '<h1>❌ Pago rechazado</h1><p>No se pudo procesar el pago. Intentá nuevamente desde ProcuAsist.</p>'
            }
            <script>
              // Notify extension about payment result
              if (window.opener) window.opener.postMessage({ type: 'PAYMENT_RESULT', status: '${status}' }, '*');
              setTimeout(() => window.close(), 5000);
            </script>
          </div>
        </body>
        </html>
      `;

      return new Response(html, {
        headers: { 'Content-Type': 'text/html', ...corsHeaders },
      });
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  } catch (err) {
    console.error('Webhook error:', err);
    return new Response('Internal error', { status: 500, headers: corsHeaders });
  }
});
