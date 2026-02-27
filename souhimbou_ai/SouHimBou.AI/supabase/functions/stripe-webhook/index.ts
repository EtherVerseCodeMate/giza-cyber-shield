// Stripe Webhook — SouHimBou AI / AdinKhepra Protocol Pricing
//
// Mirrors the tier definitions from the main stripe-webhook function.
// This instance manages the `subscribers` table used by the SouHimBou.AI
// frontend billing flow, in addition to the canonical `licenses` table.
//
// Pricing tiers (source: nouchix.com/pricing):
//
//   Tier     Price        Nodes   Users  API calls/day
//   ──────── ──────────── ─────── ─────  ─────────────
//   KHEPRI   $50/mo       10      1      500
//   RA       $500/mo      100     5      1,000
//   ATUM     $2,000/mo    1,000   25     unlimited
//   OSIRIS   custom       ∞       ∞      unlimited
//
// Events handled:
//   checkout.session.completed
//   customer.subscription.created / updated
//   customer.subscription.deleted
//   invoice.payment_succeeded
//   invoice.payment_failed

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// ─── Tier Definitions ─────────────────────────────────────────────────────────

interface TierConfig {
  tier: string;
  displayName: string;
  symbol: string;
  priceCents: number | null;
  maxNodes: number;
  maxUsers: number;
  apiCallsDailyLimit: number | null;  // null = unlimited
  capabilities: string[];
  enforcementMode: "strict" | "grace_period" | "monitoring";
}

const UNLIMITED = 2_147_483_647;

const TIERS: Record<string, TierConfig> = {
  khepri: {
    tier: "khepri",
    displayName: "KHEPRI",
    symbol: "🐣",
    priceCents: 5_000,
    maxNodes: 10,
    maxUsers: 1,
    apiCallsDailyLimit: 500,
    capabilities: [
      "pqc_scanning",
      "adinkra_read_only",
      "pdf_reports",
      "community_support",
      "single_user_license",
    ],
    enforcementMode: "grace_period",
  },
  ra: {
    tier: "ra",
    displayName: "RA",
    symbol: "🦅",
    priceCents: 50_000,
    maxNodes: 100,
    maxUsers: 5,
    apiCallsDailyLimit: 1_000,
    capabilities: [
      "pqc_scanning",
      "adinkra_read_only",
      "pdf_reports",
      "community_support",
      "single_user_license",
      "automated_remediation",
      "cmmc_l2_audit_trails",
      "priority_email_support",
      "api_access",
      "multi_user",
    ],
    enforcementMode: "grace_period",
  },
  atum: {
    tier: "atum",
    displayName: "ATUM",
    symbol: "⚛️",
    priceCents: 200_000,
    maxNodes: 1_000,
    maxUsers: 25,
    apiCallsDailyLimit: null,
    capabilities: [
      "pqc_scanning",
      "adinkra_full",
      "pdf_reports",
      "priority_email_support",
      "api_access",
      "multi_user",
      "automated_remediation",
      "cmmc_l2_audit_trails",
      "advanced_heuristic_scanning",
      "dedicated_account_manager",
      "unlimited_api",
      "custom_lattice_config",
    ],
    enforcementMode: "monitoring",
  },
  osiris: {
    tier: "osiris",
    displayName: "OSIRIS",
    symbol: "👁️",
    priceCents: null,
    maxNodes: UNLIMITED,
    maxUsers: UNLIMITED,
    apiCallsDailyLimit: null,
    capabilities: [
      "pqc_scanning",
      "adinkra_full",
      "pdf_reports",
      "priority_support",
      "unlimited_api",
      "multi_user",
      "automated_remediation",
      "cmmc_l2_audit_trails",
      "advanced_heuristic_scanning",
      "dedicated_account_manager",
      "custom_lattice_config",
      "air_gapped_deployment",
      "iron_bank_container",
      "hsm_hardware_anchor",
      "ts_sci_clearance_support",
      "24_7_critical_response",
    ],
    enforcementMode: "monitoring",
  },
};

const FREE_TIER: TierConfig = {
  tier: "free",
  displayName: "Free",
  symbol: "—",
  priceCents: 0,
  maxNodes: 1,
  maxUsers: 1,
  apiCallsDailyLimit: 50,
  capabilities: ["pqc_scanning"],
  enforcementMode: "strict",
};

// ─── Tier Resolution ──────────────────────────────────────────────────────────

function resolveTier(
  subscription: Stripe.Subscription,
  priceIdMap: Record<string, string>
): TierConfig {
  if (!subscription.items.data.length) return FREE_TIER;

  const price = subscription.items.data[0].price;
  const priceId = price.id;
  const amountCents = price.unit_amount ?? 0;

  // Match by configured Stripe Price ID first
  for (const [tierName, configuredPriceId] of Object.entries(priceIdMap)) {
    if (configuredPriceId && priceId === configuredPriceId) {
      return TIERS[tierName] ?? FREE_TIER;
    }
  }

  // Fallback: match by amount
  if (amountCents >= 200_000) return TIERS.atum;
  if (amountCents >= 50_000)  return TIERS.ra;
  if (amountCents >= 5_000)   return TIERS.khepri;

  return FREE_TIER;
}

// ─── Logger ───────────────────────────────────────────────────────────────────

const logStep = (step: string, details?: unknown) => {
  const suffix = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${suffix}`);
};

// ─── Main Handler ─────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");

    const stripeKey     = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!stripeKey || !webhookSecret) {
      throw new Error("Missing Stripe configuration");
    }

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      throw new Error("Missing Stripe signature");
    }

    const body = await req.text();
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      logStep("Signature verified", { type: event.type });
    } catch (err) {
      logStep("Signature verification failed", { error: (err as Error).message });
      return new Response(
        JSON.stringify({ error: "Signature verification failed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const priceIdMap: Record<string, string> = {
      khepri: Deno.env.get("STRIPE_PRICE_KHEPRI") ?? "",
      ra:     Deno.env.get("STRIPE_PRICE_RA") ?? "",
      atum:   Deno.env.get("STRIPE_PRICE_ATUM") ?? "",
    };

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(
          supabase, stripe, event.data.object as Stripe.Checkout.Session, priceIdMap
        );
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpsert(
          supabase, event.data.object as Stripe.Subscription, priceIdMap
        );
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(
          supabase, event.data.object as Stripe.Subscription
        );
        break;

      case "invoice.payment_succeeded":
        await handlePaymentSucceeded(
          supabase, event.data.object as Stripe.Invoice
        );
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(
          supabase, event.data.object as Stripe.Invoice
        );
        break;

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    logStep("Processed", { type: event.type, id: event.id });

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(
      JSON.stringify({ error: "Internal Server Error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── checkout.session.completed ───────────────────────────────────────────────

async function handleCheckoutCompleted(
  supabase: ReturnType<typeof createClient>,
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  priceIdMap: Record<string, string>
) {
  const customerId = session.customer as string;
  const userId     = session.metadata?.user_id;
  const tenantId   = session.metadata?.tenant_id ?? userId ?? customerId;

  logStep("Checkout completed", { customerId, userId, tenantId });

  if (!tenantId) {
    logStep("No tenant_id in session metadata");
    return;
  }

  if (session.subscription) {
    const sub = await stripe.subscriptions.retrieve(session.subscription as string);
    const tierCfg = resolveTier(sub, priceIdMap);
    await upsertSubscriber(supabase, {
      email: session.customer_details?.email ?? "",
      userId,
      customerId,
      subscriptionId: sub.id,
      tenantId,
      tierCfg,
      subscriptionStatus: sub.status,
      subscriptionEnd: new Date(sub.current_period_end * 1000).toISOString(),
    });
    return;
  }

  // One-time payment — provision KHEPRI as default
  await upsertSubscriber(supabase, {
    email: session.customer_details?.email ?? "",
    userId,
    customerId,
    subscriptionId: null,
    tenantId,
    tierCfg: TIERS[session.metadata?.tier ?? ""] ?? TIERS.khepri,
    subscriptionStatus: "active",
    subscriptionEnd: null,
  });
}

// ─── customer.subscription.created / updated ──────────────────────────────────

async function handleSubscriptionUpsert(
  supabase: ReturnType<typeof createClient>,
  subscription: Stripe.Subscription,
  priceIdMap: Record<string, string>
) {
  const customerId = subscription.customer as string;
  logStep("Subscription upsert", { id: subscription.id, status: subscription.status });

  const tierCfg = resolveTier(subscription, priceIdMap);
  const email   = await lookupEmailByCustomerId(supabase, customerId);
  const userId  = await lookupUserIdByCustomerId(supabase, customerId);

  if (!email) {
    logStep("No subscriber found for customer", { customerId });
    return;
  }

  await upsertSubscriber(supabase, {
    email,
    userId,
    customerId,
    subscriptionId: subscription.id,
    tenantId: subscription.metadata?.tenant_id ?? userId ?? customerId,
    tierCfg,
    subscriptionStatus: subscription.status,
    subscriptionEnd: new Date(subscription.current_period_end * 1000).toISOString(),
  });
}

// ─── customer.subscription.deleted ────────────────────────────────────────────

async function handleSubscriptionDeleted(
  supabase: ReturnType<typeof createClient>,
  subscription: Stripe.Subscription
) {
  const customerId = subscription.customer as string;
  logStep("Subscription deleted", { id: subscription.id });

  const email = await lookupEmailByCustomerId(supabase, customerId);
  if (!email) return;

  await supabase
    .from("subscribers")
    .update({
      subscribed: false,
      subscription_tier: "free",
      subscription_end: null,
      updated_at: new Date().toISOString(),
    })
    .eq("email", email);

  logStep("Subscriber downgraded to free", { email });
}

// ─── invoice.payment_succeeded ────────────────────────────────────────────────

async function handlePaymentSucceeded(
  supabase: ReturnType<typeof createClient>,
  invoice: Stripe.Invoice
) {
  if (!invoice.subscription) return;

  const customerId = invoice.customer as string;
  logStep("Payment succeeded", { invoiceId: invoice.id });

  const email = await lookupEmailByCustomerId(supabase, customerId);
  if (!email) return;

  await supabase
    .from("subscribers")
    .update({
      subscribed: true,
      updated_at: new Date().toISOString(),
    })
    .eq("email", email)
    .eq("stripe_customer_id", customerId);

  logStep("Subscriber reactivated", { email });
}

// ─── invoice.payment_failed ───────────────────────────────────────────────────

async function handlePaymentFailed(
  supabase: ReturnType<typeof createClient>,
  invoice: Stripe.Invoice
) {
  if (!invoice.subscription) return;

  const customerId = invoice.customer as string;
  logStep("Payment FAILED", { invoiceId: invoice.id, attempts: invoice.attempt_count });

  const email = await lookupEmailByCustomerId(supabase, customerId);
  if (!email) return;

  await supabase
    .from("subscribers")
    .update({
      subscription_tier: "past_due",
      updated_at: new Date().toISOString(),
    })
    .eq("email", email);

  logStep("Subscriber marked past_due", { email });
}

// ─── Core: upsertSubscriber ───────────────────────────────────────────────────

async function upsertSubscriber(
  supabase: ReturnType<typeof createClient>,
  opts: {
    email: string;
    userId: string | null | undefined;
    customerId: string;
    subscriptionId: string | null;
    tenantId: string;
    tierCfg: TierConfig;
    subscriptionStatus: string;
    subscriptionEnd: string | null;
  }
) {
  logStep("Upserting subscriber", {
    email: opts.email,
    tier: opts.tierCfg.tier,
    status: opts.subscriptionStatus,
  });

  const isActive = ["active", "trialing"].includes(opts.subscriptionStatus);

  // Update subscribers table (frontend billing state)
  const { error: subError } = await supabase
    .from("subscribers")
    .upsert({
      email:                 opts.email,
      user_id:               opts.userId,
      stripe_customer_id:    opts.customerId,
      stripe_subscription_id: opts.subscriptionId,
      subscribed:            isActive,
      subscription_tier:     opts.tierCfg.tier,
      subscription_end:      opts.subscriptionEnd,
      updated_at:            new Date().toISOString(),
    }, { onConflict: "email" });

  if (subError) {
    logStep("subscribers upsert failed", { error: subError.message });
  }

  // Also provision the canonical licenses record so license enforcement works
  if (opts.userId || opts.tenantId) {
    const tenantId = opts.tenantId;
    const { error: licError } = await supabase.rpc("provision_license_from_stripe", {
      p_tenant_id:              tenantId,
      p_stripe_customer_id:     opts.customerId,
      p_stripe_subscription_id: opts.subscriptionId ?? "",
      p_tier:                   opts.tierCfg.tier,
      p_subscription_status:    opts.subscriptionStatus,
      p_current_period_end:     opts.subscriptionEnd,
    });

    if (licError) {
      // RPC may not be deployed yet — direct fallback
      await supabase.from("licenses").upsert({
        tenant_id:              tenantId,
        stripe_customer_id:     opts.customerId,
        stripe_subscription_id: opts.subscriptionId,
        tier:                   opts.tierCfg.tier,
        max_nodes:              opts.tierCfg.maxNodes,
        max_users:              opts.tierCfg.maxUsers,
        api_calls_daily_limit:  opts.tierCfg.apiCallsDailyLimit,
        price_cents:            opts.tierCfg.priceCents,
        capabilities:           opts.tierCfg.capabilities,
        subscription_status:    opts.subscriptionStatus,
        enforcement_mode:       opts.tierCfg.enforcementMode,
        expires_at:             opts.subscriptionEnd,
        updated_at:             new Date().toISOString(),
      }, { onConflict: "tenant_id" });
    }
  }
}

// ─── Lookup Helpers ───────────────────────────────────────────────────────────

async function lookupEmailByCustomerId(
  supabase: ReturnType<typeof createClient>,
  customerId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("subscribers")
    .select("email")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.email ?? null;
}

async function lookupUserIdByCustomerId(
  supabase: ReturnType<typeof createClient>,
  customerId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("subscribers")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.user_id ?? null;
}
