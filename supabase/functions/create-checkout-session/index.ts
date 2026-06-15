import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const siteUrl = Deno.env.get("SITE_URL") || "https://souhimbou.ai";

// ── Plan → Stripe Price ID mapping (server-side only, never sent to client) ──
// Price IDs from live Stripe account (prod_UhvNflskmq9PoV)
const PLAN_PRICES: Record<string, { priceId: string; mode: "payment" | "subscription"; label: string }> = {
  // Self-serve billing page plans
  certify: {
    priceId: Deno.env.get("STRIPE_PRICE_CERTIFY") || "price_1TiVvxDqGyad2D3VlUm3ba6s",
    mode: "payment",
    label: "ADINKHEPRA Certify — One-Time CMMC Attestation",
  },
  autopilot: {
    priceId: Deno.env.get("STRIPE_PRICE_AUTOPILOT") || "price_1TiVvyDqGyad2D3V4mszc5v5",
    mode: "subscription",
    label: "AdinKhepra Autopilot — Continuous CMMC Compliance",
  },
  // Advisory / consulting plans (triggered from PLANS section)
  diagnostic: {
    priceId: Deno.env.get("STRIPE_PRICE_DIAGNOSTIC") || "price_1TiVXpDqGyad2D3VXMnYnrZP",
    mode: "payment",
    label: "CMMC Readiness Diagnostic",
  },
  advisory: {
    priceId: Deno.env.get("STRIPE_PRICE_ADVISORY") || "price_1TiVXqDqGyad2D3VQizyv9o7",
    mode: "payment",
    label: "CMMC Advisory Package",
  },
  sprint: {
    priceId: Deno.env.get("STRIPE_PRICE_SPRINT") || "price_1TiVw1DqGyad2D3VTs0ewSp0",
    mode: "payment",
    label: "CMMC Deadline Sprint — 14-Day Delivery",
  },
  // SaaS subscription tiers
  starter: {
    priceId: Deno.env.get("STRIPE_PRICE_STARTER") || "price_1TiVXPDqGyad2D3VSpr7L05X",
    mode: "subscription",
    label: "SouHimBou.AI Starter",
  },
  professional: {
    priceId: Deno.env.get("STRIPE_PRICE_PRO") || "price_1TiVXoDqGyad2D3V5AZQ0EiW",
    mode: "subscription",
    label: "SouHimBou.AI Professional",
  },
  enterprise: {
    priceId: Deno.env.get("STRIPE_PRICE_ENTERPRISE") || "price_1TiVXoDqGyad2D3Vr78bgbTI",
    mode: "subscription",
    label: "SouHimBou.AI Enterprise",
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Invalid authentication");

    // ── Validate plan ─────────────────────────────────────────────────────────
    const { planId } = await req.json();
    if (!planId || !PLAN_PRICES[planId]) {
      throw new Error(`Unknown plan: ${planId}. Valid plans: ${Object.keys(PLAN_PRICES).join(", ")}`);
    }

    const plan = PLAN_PRICES[planId];
    console.log(`Creating ${plan.mode} checkout for user=${user.id} plan=${planId}`);

    // ── Stripe customer dedup ─────────────────────────────────────────────────
    let customerId: string | undefined;
    const existing = await stripe.customers.list({ email: user.email, limit: 1 });
    if (existing.data.length > 0) customerId = existing.data[0].id;

    // ── Create checkout session ───────────────────────────────────────────────
    const successPath = planId === "autopilot" || planId === "starter" || planId === "professional" || planId === "enterprise"
      ? "/dashboard?subscription=activated"
      : `/billing?purchased=${planId}`;

    const session = await stripe.checkout.sessions.create({
      mode: plan.mode,
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: plan.priceId, quantity: 1 }],
      metadata: {
        user_id: user.id,
        plan_id: planId,
        product_type: plan.mode === "subscription" ? "saas_subscription" : "one_time_service",
      },
      // Subscriptions: allow promotion codes for BD/referral
      allow_promotion_codes: plan.mode === "subscription",
      // Auto-apply tax based on customer billing address
      automatic_tax: { enabled: true },
      success_url: `${siteUrl}${successPath}`,
      cancel_url: `${siteUrl}/billing?canceled=true`,
    });

    console.log(`Checkout session created: ${session.id} url=${session.url}`);

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Checkout error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
