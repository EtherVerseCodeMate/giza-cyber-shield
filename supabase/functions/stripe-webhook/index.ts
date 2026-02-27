// Stripe Webhook — AdinKhepra Protocol Pricing
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
//   checkout.session.completed          → initial license provisioning
//   customer.subscription.created       → provision license
//   customer.subscription.updated       → update tier / status
//   customer.subscription.deleted       → cancel, downgrade to free
//   invoice.payment_succeeded           → renew / reactivate license
//   invoice.payment_failed              → mark past_due, log event
//
// ENVIRONMENT VARIABLES (Supabase Dashboard → Settings → Edge Functions):
//   STRIPE_SECRET_KEY       — Stripe secret key (sk_live_... or sk_test_...)
//   STRIPE_WEBHOOK_SECRET   — Stripe webhook signing secret (whsec_...)
//   SUPABASE_URL            — Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY — Supabase service role key
//
//   Optional — map Stripe Price IDs to tiers for exact matching:
//   STRIPE_PRICE_KHEPRI     — Stripe price ID for KHEPRI ($50/mo)
//   STRIPE_PRICE_RA         — Stripe price ID for RA ($500/mo)
//   STRIPE_PRICE_ATUM       — Stripe price ID for ATUM ($2,000/mo)
//
//   If price IDs are not set, tier is inferred from unit_amount.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import Stripe from "https://esm.sh/stripe@14.21.0";

// ─── Tier Definitions ─────────────────────────────────────────────────────────

interface TierConfig {
  tier: string;
  displayName: string;
  symbol: string;
  priceCents: number | null;       // null = custom / OSIRIS
  maxNodes: number;                // 2147483647 = unlimited
  maxUsers: number;                // 2147483647 = unlimited
  apiCallsDailyLimit: number | null; // null = unlimited
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
    apiCallsDailyLimit: null,      // unlimited
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
    priceCents: null,              // custom
    maxNodes: UNLIMITED,
    maxUsers: UNLIMITED,
    apiCallsDailyLimit: null,      // unlimited
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

// Fallback: downgraded / free state (subscription canceled or payment failed > 7 days)
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

function resolveTierFromSubscription(
  subscription: Stripe.Subscription,
  priceIdMap: Record<string, string>
): TierConfig {
  if (!subscription.items.data.length) return FREE_TIER;

  const price = subscription.items.data[0].price;
  const priceId = price.id;
  const amountCents = price.unit_amount ?? 0;

  // 1. Match by configured Stripe Price ID (most reliable)
  for (const [tierName, configuredPriceId] of Object.entries(priceIdMap)) {
    if (configuredPriceId && priceId === configuredPriceId) {
      return TIERS[tierName] ?? FREE_TIER;
    }
  }

  // 2. Fallback: match by amount thresholds
  //    Use ≥ thresholds so annual plans (e.g. $2,000 × 12 = $24,000) resolve to ATUM
  if (amountCents >= 200_000) return TIERS.atum;
  if (amountCents >= 50_000)  return TIERS.ra;
  if (amountCents >= 5_000)   return TIERS.khepri;

  return FREE_TIER;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const log = (step: string, details?: unknown) => {
  const suffix = details ? ` — ${JSON.stringify(details)}` : "";
  console.log(`[stripe-webhook] ${step}${suffix}`);
};

// ─── Main Handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  const stripeKey     = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

  if (!stripeKey || !webhookSecret) {
    return new Response("Missing Stripe configuration", { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const body = await req.text();
  const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    log("Signature verification failed", { error: (err as Error).message });
    return new Response(`Webhook Error: ${(err as Error).message}`, { status: 400 });
  }

  log("Event received", { type: event.type, id: event.id });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  // Price ID → tier name map (from env vars)
  const priceIdMap: Record<string, string> = {
    khepri: Deno.env.get("STRIPE_PRICE_KHEPRI") ?? "",
    ra:     Deno.env.get("STRIPE_PRICE_RA") ?? "",
    atum:   Deno.env.get("STRIPE_PRICE_ATUM") ?? "",
  };

  try {
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
        log("Unhandled event type", { type: event.type });
    }
  } catch (err) {
    log("Handler error", { type: event.type, error: (err as Error).message });
    return new Response(`Handler error: ${(err as Error).message}`, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

// ─── checkout.session.completed ───────────────────────────────────────────────
// Fires after a successful Checkout payment. We retrieve the subscription that
// was just created to get the full price/tier data, then provision the license.

async function handleCheckoutCompleted(
  supabase: ReturnType<typeof createClient>,
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  priceIdMap: Record<string, string>
) {
  const customerId = session.customer as string;
  const userId     = session.metadata?.user_id;
  const tenantId   = session.metadata?.tenant_id ?? userId ?? customerId;

  log("Checkout completed", { customerId, userId, tenantId });

  if (!tenantId) {
    log("No tenant_id or user_id in checkout metadata — cannot provision license");
    return;
  }

  // If the session has a subscription, provision via that path
  if (session.subscription) {
    const sub = await stripe.subscriptions.retrieve(session.subscription as string);
    const tierCfg = resolveTierFromSubscription(sub, priceIdMap);
    await upsertLicense(supabase, {
      tenantId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: sub.id,
      tierCfg,
      subscriptionStatus: sub.status,
      currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
    });
    return;
  }

  // One-time payment (e.g. OSIRIS setup fee) — provision with KHEPRI defaults
  // until sales manually upgrades to the correct tier
  await upsertLicense(supabase, {
    tenantId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: null,
    tierCfg: session.metadata?.tier
      ? (TIERS[session.metadata.tier] ?? TIERS.khepri)
      : TIERS.khepri,
    subscriptionStatus: "active",
    currentPeriodEnd: null,
  });
}

// ─── customer.subscription.created / updated ──────────────────────────────────

async function handleSubscriptionUpsert(
  supabase: ReturnType<typeof createClient>,
  subscription: Stripe.Subscription,
  priceIdMap: Record<string, string>
) {
  const customerId = subscription.customer as string;
  log("Subscription upsert", { id: subscription.id, status: subscription.status });

  // Resolve tenant_id: prefer subscription metadata, fall back to customer lookup
  const tenantId = subscription.metadata?.tenant_id
    ?? await lookupTenantByCustomerId(supabase, customerId)
    ?? customerId;  // last resort: use Stripe customer ID as tenant ID

  const tierCfg = resolveTierFromSubscription(subscription, priceIdMap);

  await upsertLicense(supabase, {
    tenantId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    tierCfg,
    subscriptionStatus: subscription.status,
    currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
  });

  // Log billing event
  await logLicenseEvent(supabase, tenantId, "subscription_updated", {
    subscription_id: subscription.id,
    tier: tierCfg.tier,
    status: subscription.status,
    price_cents: tierCfg.priceCents,
  });
}

// ─── customer.subscription.deleted ────────────────────────────────────────────

async function handleSubscriptionDeleted(
  supabase: ReturnType<typeof createClient>,
  subscription: Stripe.Subscription
) {
  const customerId = subscription.customer as string;
  log("Subscription deleted", { id: subscription.id, customerId });

  const tenantId = subscription.metadata?.tenant_id
    ?? await lookupTenantByCustomerId(supabase, customerId)
    ?? customerId;

  // Downgrade to free tier limits, mark canceled
  await upsertLicense(supabase, {
    tenantId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    tierCfg: FREE_TIER,
    subscriptionStatus: "canceled",
    currentPeriodEnd: null,
  });

  await logLicenseEvent(supabase, tenantId, "subscription_canceled", {
    subscription_id: subscription.id,
    previous_tier: subscription.metadata?.tier,
  });
}

// ─── invoice.payment_succeeded ────────────────────────────────────────────────

async function handlePaymentSucceeded(
  supabase: ReturnType<typeof createClient>,
  invoice: Stripe.Invoice
) {
  if (!invoice.subscription) return;

  const customerId = invoice.customer as string;
  log("Payment succeeded", { invoiceId: invoice.id, customerId });

  const tenantId = await lookupTenantByCustomerId(supabase, customerId) ?? customerId;

  // Reactivate subscription if it was past_due
  const { error } = await supabase
    .from("licenses")
    .update({
      subscription_status: "active",
      last_renewal: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .in("subscription_status", ["past_due", "unpaid"]);

  if (error) {
    log("Failed to reactivate license on payment", { error: error.message, tenantId });
  } else {
    log("License reactivated on payment", { tenantId });
  }

  await logLicenseEvent(supabase, tenantId, "payment_succeeded", {
    invoice_id: invoice.id,
    amount_paid: invoice.amount_paid,
  });
}

// ─── invoice.payment_failed ───────────────────────────────────────────────────

async function handlePaymentFailed(
  supabase: ReturnType<typeof createClient>,
  invoice: Stripe.Invoice
) {
  if (!invoice.subscription) return;

  const customerId = invoice.customer as string;
  log("Payment FAILED", { invoiceId: invoice.id, customerId });

  const tenantId = await lookupTenantByCustomerId(supabase, customerId) ?? customerId;

  await supabase
    .from("licenses")
    .update({
      subscription_status: "past_due",
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId);

  await logLicenseEvent(supabase, tenantId, "payment_failed", {
    invoice_id: invoice.id,
    amount_due: invoice.amount_due,
    attempt_count: invoice.attempt_count,
  });
}

// ─── Core: upsertLicense ──────────────────────────────────────────────────────
// Single source of truth for writing to the licenses table.
// Calls the provision_license_from_stripe SQL function defined in the migration.

async function upsertLicense(
  supabase: ReturnType<typeof createClient>,
  opts: {
    tenantId: string;
    stripeCustomerId: string;
    stripeSubscriptionId: string | null;
    tierCfg: TierConfig;
    subscriptionStatus: string;
    currentPeriodEnd: string | null;
  }
) {
  log("Provisioning license", {
    tenantId: opts.tenantId,
    tier: opts.tierCfg.tier,
    maxNodes: opts.tierCfg.maxNodes,
    maxUsers: opts.tierCfg.maxUsers,
    status: opts.subscriptionStatus,
  });

  // Use the SQL helper function for atomic upsert
  const { data, error } = await supabase.rpc("provision_license_from_stripe", {
    p_tenant_id:              opts.tenantId,
    p_stripe_customer_id:     opts.stripeCustomerId,
    p_stripe_subscription_id: opts.stripeSubscriptionId ?? "",
    p_tier:                   opts.tierCfg.tier,
    p_subscription_status:    opts.subscriptionStatus,
    p_current_period_end:     opts.currentPeriodEnd,
  });

  if (error) {
    log("RPC provision_license_from_stripe failed — falling back to direct upsert", {
      error: error.message,
    });

    // Direct upsert fallback if the RPC isn't deployed yet
    const { error: upsertError } = await supabase
      .from("licenses")
      .upsert({
        tenant_id:              opts.tenantId,
        stripe_customer_id:     opts.stripeCustomerId,
        stripe_subscription_id: opts.stripeSubscriptionId,
        tier:                   opts.tierCfg.tier,
        max_nodes:              opts.tierCfg.maxNodes,
        max_users:              opts.tierCfg.maxUsers,
        api_calls_daily_limit:  opts.tierCfg.apiCallsDailyLimit,
        price_cents:            opts.tierCfg.priceCents,
        capabilities:           opts.tierCfg.capabilities,
        subscription_status:    opts.subscriptionStatus,
        enforcement_mode:       opts.tierCfg.enforcementMode,
        expires_at:             opts.currentPeriodEnd,
        last_renewal:           opts.subscriptionStatus === "active"
                                  ? new Date().toISOString() : undefined,
        updated_at:             new Date().toISOString(),
      }, { onConflict: "tenant_id" });

    if (upsertError) {
      throw new Error(`License upsert failed: ${upsertError.message}`);
    }
  } else {
    log("License provisioned via RPC", { licenseId: data, tier: opts.tierCfg.tier });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function lookupTenantByCustomerId(
  supabase: ReturnType<typeof createClient>,
  stripeCustomerId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("licenses")
    .select("tenant_id")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();
  return data?.tenant_id ?? null;
}

async function logLicenseEvent(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  eventType: string,
  eventData: Record<string, unknown>
) {
  // Get license ID for the event foreign key
  const { data: license } = await supabase
    .from("licenses")
    .select("id")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!license?.id) return;

  await supabase.from("license_events").insert({
    license_id:  license.id,
    event_type:  eventType,
    event_data:  eventData,
    triggered_by: "stripe-webhook",
  });
}
