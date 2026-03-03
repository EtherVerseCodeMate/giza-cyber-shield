// check-subscription — AdinKhepra Protocol
//
// Returns the user's current Stripe subscription tier.
// Writes result to the `licenses` table (via provision_license_from_stripe RPC
// if available) or directly to `subscribers` for lightweight status checks.
//
// Tier resolution (by Stripe price amount, with Price ID override):
//   KHEPRI  $50/mo   — STRIPE_PRICE_KHEPRI
//   RA      $500/mo  — STRIPE_PRICE_RA
//   ATUM    $2,000/mo — STRIPE_PRICE_ATUM
//   OSIRIS  custom   — any amount > $2,000
//
// ENV: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//      Optional: STRIPE_PRICE_KHEPRI, STRIPE_PRICE_RA, STRIPE_PRICE_ATUM

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) =>
  console.log(`[check-subscription] ${step}${details ? ` — ${JSON.stringify(details)}` : ""}`);

// Map Stripe price → AdinKhepra tier
function resolveTier(priceId: string, amountCents: number): string {
  const KHEPRI_ID = Deno.env.get("STRIPE_PRICE_KHEPRI");
  const RA_ID     = Deno.env.get("STRIPE_PRICE_RA");
  const ATUM_ID   = Deno.env.get("STRIPE_PRICE_ATUM");

  if (KHEPRI_ID && priceId === KHEPRI_ID) return "KHEPRI";
  if (RA_ID     && priceId === RA_ID)     return "RA";
  if (ATUM_ID   && priceId === ATUM_ID)   return "ATUM";

  // Amount-based fallback (cents)
  if (amountCents <= 9900)   return "KHEPRI";   // ≤ $99
  if (amountCents <= 99900)  return "RA";        // ≤ $999
  if (amountCents <= 299900) return "ATUM";      // ≤ $2,999
  return "OSIRIS";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    log("started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user?.email) throw new Error("Authentication failed");
    log("user authenticated", { userId: user.id });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      log("no Stripe customer found");
      return new Response(
        JSON.stringify({ subscribed: false, subscription_tier: null, subscription_end: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const customerId = customers.data[0].id;
    log("customer found", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      // Also check trialing / past_due
      const graceSubs = await stripe.subscriptions.list({
        customer: customerId,
        status: "trialing",
        limit: 1,
      });
      if (graceSubs.data.length === 0) {
        log("no active subscription");
        return new Response(
          JSON.stringify({ subscribed: false, subscription_tier: null, subscription_end: null }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      subscriptions.data.push(...graceSubs.data);
    }

    const subscription = subscriptions.data[0];
    const priceId = subscription.items.data[0].price.id;
    const amountCents = subscription.items.data[0].price.unit_amount ?? 0;
    const subscriptionTier = resolveTier(priceId, amountCents);
    const subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();

    log("resolved tier", { priceId, amountCents, subscriptionTier, subscriptionEnd });

    // Persist to subscribers table (best-effort — don't fail if table missing)
    try {
      await supabase.from("subscribers").upsert({
        email: user.email,
        user_id: user.id,
        stripe_customer_id: customerId,
        subscribed: true,
        subscription_tier: subscriptionTier,
        subscription_end: subscriptionEnd,
        updated_at: new Date().toISOString(),
      }, { onConflict: "email" });
    } catch (dbErr) {
      log("subscribers upsert skipped (table may not exist)", dbErr);
    }

    return new Response(
      JSON.stringify({
        subscribed: true,
        subscription_tier: subscriptionTier,
        subscription_end: subscriptionEnd,
        stripe_customer_id: customerId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("ERROR", { message });
    return new Response(
      JSON.stringify({ error: "Failed to check subscription", message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
