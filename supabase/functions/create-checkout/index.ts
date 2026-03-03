// create-checkout — AdinKhepra Protocol
//
// Creates a Stripe Checkout session for a given subscription plan.
//
// Accepts: { plan: "KHEPRI" | "RA" | "ATUM" | "trailblazer_plus" }
//
// Tier → Price ID resolution (prefer env vars, fall back to inline price_data):
//   KHEPRI         $50/mo   — STRIPE_PRICE_KHEPRI
//   RA             $500/mo  — STRIPE_PRICE_RA
//   ATUM           $2,000/mo — STRIPE_PRICE_ATUM
//   trailblazer_plus $19/mo — STRIPE_PRICE_TRAILBLAZER_PLUS
//
// ENV: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SITE_URL
//      Optional: STRIPE_PRICE_KHEPRI, STRIPE_PRICE_RA, STRIPE_PRICE_ATUM,
//                STRIPE_PRICE_TRAILBLAZER_PLUS

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) =>
  console.log(`[create-checkout] ${step}${details ? ` — ${JSON.stringify(details)}` : ""}`);

interface PlanConfig {
  name: string;
  description: string;
  unitAmount: number; // cents
  envKey: string;
}

const PLANS: Record<string, PlanConfig> = {
  KHEPRI: {
    name: "Khepra Shield — KHEPRI",
    description: "10 nodes • 1 user • 500 API calls/day • PQC scanning",
    unitAmount: 5000,    // $50/mo
    envKey: "STRIPE_PRICE_KHEPRI",
  },
  RA: {
    name: "Khepra Shield — RA",
    description: "100 nodes • 5 users • 1,000 API calls/day • Automated remediation",
    unitAmount: 50000,   // $500/mo
    envKey: "STRIPE_PRICE_RA",
  },
  ATUM: {
    name: "Khepra Shield — ATUM",
    description: "1,000 nodes • 25 users • Unlimited API • Advanced heuristic scanning",
    unitAmount: 200000,  // $2,000/mo
    envKey: "STRIPE_PRICE_ATUM",
  },
  trailblazer_plus: {
    name: "Trailblazer Plus",
    description: "Enhanced features and customization",
    unitAmount: 1900,    // $19/mo
    envKey: "STRIPE_PRICE_TRAILBLAZER_PLUS",
  },
  // Aliases
  khepri: {
    name: "Khepra Shield — KHEPRI",
    description: "10 nodes • 1 user • 500 API calls/day • PQC scanning",
    unitAmount: 5000,
    envKey: "STRIPE_PRICE_KHEPRI",
  },
  ra: {
    name: "Khepra Shield — RA",
    description: "100 nodes • 5 users • 1,000 API calls/day • Automated remediation",
    unitAmount: 50000,
    envKey: "STRIPE_PRICE_RA",
  },
  atum: {
    name: "Khepra Shield — ATUM",
    description: "1,000 nodes • 25 users • Unlimited API • Advanced heuristic scanning",
    unitAmount: 200000,
    envKey: "STRIPE_PRICE_ATUM",
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
    apiVersion: "2023-10-16",
  });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );
  const siteUrl = Deno.env.get("SITE_URL") ?? "http://localhost:5173";

  try {
    log("started");

    if (!Deno.env.get("STRIPE_SECRET_KEY")) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user?.email) throw new Error("Authentication failed");
    log("user authenticated", { userId: user.id });

    const body = await req.json();
    const planKey = (body.plan ?? "KHEPRI") as string;
    const planConfig = PLANS[planKey];

    if (!planConfig) {
      return new Response(
        JSON.stringify({ error: `Unknown plan: ${planKey}. Valid: KHEPRI, RA, ATUM, trailblazer_plus` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    log("plan selected", { planKey, planConfig });

    // Reuse existing Stripe customer if present
    let customerId: string | undefined;
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }
    log("customer lookup", { customerId: customerId ?? "new" });

    // Resolve Price ID — prefer env var, fall back to inline price_data
    const priceId = Deno.env.get(planConfig.envKey);

    const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = priceId
      ? { price: priceId, quantity: 1 }
      : {
          price_data: {
            currency: "usd",
            product_data: {
              name: planConfig.name,
              description: planConfig.description,
            },
            unit_amount: planConfig.unitAmount,
            recurring: { interval: "month" },
          },
          quantity: 1,
        };

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [lineItem],
      metadata: {
        user_id: user.id,
        plan: planKey,
      },
      success_url: `${siteUrl}/billing?checkout=success&plan=${planKey}`,
      cancel_url: `${siteUrl}/billing?checkout=cancelled`,
      allow_promotion_codes: true,
    });

    log("checkout session created", { sessionId: session.id, plan: planKey });

    return new Response(
      JSON.stringify({ url: session.url }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("ERROR", { message });
    return new Response(
      JSON.stringify({ error: "Failed to create checkout session", message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
