import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import Stripe from "https://esm.sh/stripe@14.21.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

// ── Price ID → License Tier Mapping ──────────────────────────────────────────
// Maps live Stripe price IDs to internal license tier constants.
// Fallback to env vars; defaults are the live IDs created 2026-06-15.
const PRICE_TIER_MAP: Record<string, string> = {
  // One-time services → no recurring tier change, just grant access
  [Deno.env.get("STRIPE_PRICE_CERTIFY")    || "price_1TiVvxDqGyad2D3VlUm3ba6s"]: "certify",
  [Deno.env.get("STRIPE_PRICE_DIAGNOSTIC") || "price_1TiVXpDqGyad2D3VXMnYnrZP"]: "diagnostic",
  [Deno.env.get("STRIPE_PRICE_ADVISORY")   || "price_1TiVXqDqGyad2D3VQizyv9o7"]: "advisory",
  [Deno.env.get("STRIPE_PRICE_SPRINT")     || "price_1TiVw1DqGyad2D3VTs0ewSp0"]: "sprint",
  // Subscriptions → maps to Khepra license tier
  [Deno.env.get("STRIPE_PRICE_AUTOPILOT")  || "price_1TiVvyDqGyad2D3V4mszc5v5"]: "pilot",       // TierPilot
  [Deno.env.get("STRIPE_PRICE_STARTER")    || "price_1TiVXPDqGyad2D3VSpr7L05X"]: "pilot",        // TierPilot
  [Deno.env.get("STRIPE_PRICE_PRO")        || "price_1TiVXoDqGyad2D3V5AZQ0EiW"]: "pilot",        // TierPilot
  [Deno.env.get("STRIPE_PRICE_ENTERPRISE") || "price_1TiVXoDqGyad2D3Vr78bgbTI"]: "enterprise",   // TierEnterprise
};

// Maps internal tier to the features granted
const TIER_FEATURES: Record<string, string[]> = {
  certify:    ["cmmc_certify", "audit_export", "attestation_badge"],
  diagnostic: ["cmmc_certify", "cmmc_diagnostic", "audit_export", "advisory_checkout"],
  advisory:   ["cmmc_certify", "cmmc_diagnostic", "advisory_checkout", "diagnostic_service"],
  sprint:     ["cmmc_certify", "cmmc_diagnostic", "cmmc_sprint", "advisory_checkout"],
  pilot:      ["cmmc_autopilot", "stig_codex", "flight_recorder", "dag_viewer",
               "evidence_engine", "audit_export", "multi_org"],
  enterprise: ["cmmc_autopilot", "stig_codex", "flight_recorder", "pqc_attestation",
               "dag_viewer", "evidence_engine", "soar_integration", "govcloud_deploy",
               "audit_export", "multi_org", "advisory_checkout", "diagnostic_service"],
};

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    console.error("No Stripe signature");
    return new Response("No signature", { status: 400 });
  }

  try {
    const body = await req.text();
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error("Signature verification failed:", err);
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    console.log(`Processing Stripe event: ${event.type}`);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    switch (event.type) {
      // ── One-time payment completed ────────────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(supabase, session);
        break;
      }

      // ── Subscription lifecycle ────────────────────────────────────────────
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(supabase, sub);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(supabase, sub);
        break;
      }

      // ── Invoice payment failure — downgrade to community ─────────────────
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(supabase, invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(`Webhook Error: ${error.message}`, { status: 500 });
  }
});

// ── Helpers ────────────────────────────────────────────────────────────────────

async function handleCheckoutCompleted(supabase: any, session: Stripe.Checkout.Session) {
  const userId = session.metadata?.user_id;
  const planId = session.metadata?.plan_id;
  const customerId = session.customer as string;

  if (!userId) {
    console.error("No user_id in session metadata");
    return;
  }

  console.log(`Checkout completed: user=${userId} plan=${planId}`);

  // Determine tier from plan_id
  const tier = resolveTierFromPlanId(planId, session);

  // Upsert user_profiles (from our onboarding migration)
  await supabase.from("user_profiles").upsert({
    user_id: userId,
    stripe_customer_id: customerId,
    license_tier: tier,
    license_features: TIER_FEATURES[tier] || [],
    license_updated_at: new Date().toISOString(),
    ...(session.mode === "subscription"
      ? { subscription_status: "active" }
      : { [`${planId}_paid`]: true, [`${planId}_paid_at`]: new Date().toISOString() }),
  }, { onConflict: "user_id" });

  // Legacy consulting_access table (keep for backward compat)
  if (planId === "diagnostic" || planId === "advisory") {
    await upsertConsultingAccess(supabase, userId, customerId, planId);
  }

  console.log(`Access granted: user=${userId} tier=${tier} features=${(TIER_FEATURES[tier] || []).join(",")}`);
}

async function handleSubscriptionUpdate(supabase: any, sub: Stripe.Subscription) {
  const customerId = sub.customer as string;
  const priceId = sub.items.data[0]?.price?.id;
  const tier = PRICE_TIER_MAP[priceId] || "community";
  const status = sub.status;

  console.log(`Subscription updated: customer=${customerId} price=${priceId} tier=${tier} status=${status}`);

  // Look up user by stripe_customer_id
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (!profile) {
    console.error(`No user_profile for customer ${customerId}`);
    return;
  }

  const activeTier = status === "active" || status === "trialing" ? tier : "community";
  const features = TIER_FEATURES[activeTier] || [];

  await supabase.from("user_profiles").update({
    license_tier: activeTier,
    license_features: features,
    subscription_status: status,
    subscription_id: sub.id,
    license_updated_at: new Date().toISOString(),
  }).eq("user_id", profile.user_id);

  // Legacy consulting_access
  await supabase.from("consulting_access")
    .update({ subscription_status: status, subscription_id: sub.id,
              subscription_updated_at: new Date().toISOString() })
    .eq("stripe_customer_id", customerId);

  console.log(`Updated tier: user=${profile.user_id} tier=${activeTier}`);
}

async function handleSubscriptionDeleted(supabase: any, sub: Stripe.Subscription) {
  const customerId = sub.customer as string;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (profile) {
    await supabase.from("user_profiles").update({
      license_tier: "community",
      license_features: [],
      subscription_status: "canceled",
      license_updated_at: new Date().toISOString(),
    }).eq("user_id", profile.user_id);
  }

  await supabase.from("consulting_access")
    .update({ subscription_status: "canceled", subscription_updated_at: new Date().toISOString() })
    .eq("stripe_customer_id", customerId);

  console.log(`Subscription canceled: customer=${customerId} → community tier`);
}

async function handlePaymentFailed(supabase: any, invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  console.log(`Payment failed: customer=${customerId} — downgrading to community`);

  await supabase.from("user_profiles").update({
    license_tier: "community",
    license_features: [],
    subscription_status: "past_due",
    license_updated_at: new Date().toISOString(),
  }).eq("stripe_customer_id", customerId);
}

function resolveTierFromPlanId(planId: string | null | undefined, session: Stripe.Checkout.Session): string {
  if (!planId) return "community";
  // For subscription plans, derive from the price ID
  if (session.mode === "subscription") {
    const priceId = (session as any).line_items?.data?.[0]?.price?.id;
    if (priceId && PRICE_TIER_MAP[priceId]) return PRICE_TIER_MAP[priceId];
  }
  // One-time service plans
  const directMap: Record<string, string> = {
    certify: "certify", diagnostic: "diagnostic",
    advisory: "advisory", sprint: "sprint",
    autopilot: "pilot", starter: "pilot",
    professional: "pilot", enterprise: "enterprise",
  };
  return directMap[planId] || "community";
}

async function upsertConsultingAccess(supabase: any, userId: string, customerId: string, planId: string) {
  const patch = planId === "diagnostic"
    ? { diagnostic_paid: true, diagnostic_paid_at: new Date().toISOString() }
    : { advisory_requested: true, advisory_requested_at: new Date().toISOString() };

  const { data: existing } = await supabase.from("consulting_access")
    .select("id").eq("user_id", userId).single();

  if (existing) {
    await supabase.from("consulting_access")
      .update({ stripe_customer_id: customerId, ...patch }).eq("user_id", userId);
  } else {
    await supabase.from("consulting_access")
      .insert({ user_id: userId, stripe_customer_id: customerId, ...patch });
  }
}
