// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

declare const Deno: any;
// @ts-ignore
import Stripe from "https://esm.sh/stripe@14.21.0";
// @ts-ignore
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
// @ts-ignore
import { Resend } from "https://esm.sh/resend@3.1.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!stripeKey || !webhookSecret) {
      throw new Error("Missing Stripe configuration");
    }

    const body = await req.text();
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      const signature = req.headers.get("Stripe-Signature");
      if (!signature) throw new Error("Missing Stripe signature");
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
      logStep("Webhook signature verified", { eventType: event.type });
    } catch (err: any) {
      logStep("Webhook signature verification failed", { error: err.message });
      return new Response(JSON.stringify({ error: "Signature verification failed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Handle different event types
    switch (event.type) {
      case "invoice.payment_succeeded":
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice, supabaseClient);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, supabaseClient);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, supabaseClient);
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Invoice, supabaseClient);
        break;

      default:
        logStep("Unhandled event type", { eventType: event.type });
    }

    logStep("Webhook processed successfully", { eventType: event.type, eventId: event.id });

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in webhook", { message: errorMessage });

    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

async function handlePaymentSucceeded(invoice: Stripe.Invoice, supabase: SupabaseClient) {
  logStep("Processing payment succeeded", { invoiceId: invoice.id, customerId: invoice.customer });

  if (!invoice.customer || !invoice.subscription) return;

  const customer = await getCustomerEmail(invoice.customer as string, supabase);
  if (!customer) return;

  await supabase.from("subscribers").upsert({
    email: customer.email,
    user_id: customer.user_id,
    stripe_customer_id: invoice.customer,
    subscribed: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'email' });

  logStep("Payment succeeded - subscriber updated", { email: customer.email });
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription, supabase: SupabaseClient) {
  logStep("Processing subscription updated", { subscriptionId: subscription.id, customerId: subscription.customer });

  const customer = await getCustomerEmail(subscription.customer as string, supabase);
  if (!customer) return;

  // Get subscription tier from price
  let subscriptionTier = "Basic";
  let licensePrefix = "PRO";
  
  if (subscription.items.data.length > 0) {
    const price = subscription.items.data[0].price;
    const amount = price.unit_amount || 0;

    // Based on KHEPRA pricing: Pro is $19 (~1900), Enterprise is $499 (~49900)
    if (amount >= 49900) {
      subscriptionTier = "Enterprise";
      licensePrefix = "ENT";
    } else if (amount >= 1900) {
      subscriptionTier = "Pro";
      licensePrefix = "PRO";
    }
  }

  const subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
  const isActive = subscription.status === "active";

  // Update subscriber tracking
  await supabase.from("subscribers").upsert({
    email: customer.email,
    user_id: customer.user_id,
    stripe_customer_id: subscription.customer,
    subscribed: isActive,
    subscription_tier: subscriptionTier,
    subscription_end: subscriptionEnd,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'email' });

  // Provision Commercial License if Active
  if (isActive && (subscriptionTier === "Pro" || subscriptionTier === "Enterprise")) {
    await provisionCommercialLicense(customer.email, subscriptionTier, licensePrefix, supabase);
  }

  logStep("Subscription updated", {
    email: customer.email,
    tier: subscriptionTier,
    active: isActive
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription, supabase: SupabaseClient) {
  logStep("Processing subscription deleted", { subscriptionId: subscription.id, customerId: subscription.customer });

  const customer = await getCustomerEmail(subscription.customer as string, supabase);
  if (!customer) return;

  await supabase.from("subscribers").upsert({
    email: customer.email,
    user_id: customer.user_id,
    stripe_customer_id: subscription.customer,
    subscribed: false,
    subscription_tier: null,
    subscription_end: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'email' });
  
  // Mark license as inactive
  await supabase.from("licenses")
    .update({ status: "revoked" })
    .eq("email", customer.email)
    .in("tier", ["Pro", "Enterprise"]);

  logStep("Subscription deleted - subscriber & license updated", { email: customer.email });
}

async function handlePaymentFailed(invoice: Stripe.Invoice, supabase: SupabaseClient) {
  logStep("Processing payment failed", { invoiceId: invoice.id, customerId: invoice.customer });
}

async function getCustomerEmail(customerId: string, supabase: SupabaseClient) {
  const { data: subscriber } = await supabase
    .from("subscribers")
    .select("email, user_id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (subscriber) return subscriber;
  logStep("Customer not found in subscribers table", { customerId });
  return null;
}

async function provisionCommercialLicense(email: string, tier: string, prefix: string, supabase: SupabaseClient) {
  // Check if they already have an active license for this tier
  const { data: existing } = await supabase
    .from("licenses")
    .select("license_key")
    .eq("email", email)
    .eq("tier", tier)
    .eq("status", "active")
    .single();

  if (existing) {
    logStep("License already active for tier", { email, tier });
    return;
  }

  // 1. Sync to Hostinger VPS (License Vault API) to Mint Key
  const vaultApiUrl = Deno.env.get("HOSTINGER_VAULT_API_URL") || "https://agent.souhimbou.ai/api/licenses/mint";
  const vaultSecret = Deno.env.get("HOSTINGER_VAULT_SECRET_KEY") || "";
  let license_key = "";
  
  try {
    const vaultRes = await fetch(vaultApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${vaultSecret}`
      },
      body: JSON.stringify({ email, tier })
    });
    if (!vaultRes.ok) {
      logStep("Hostinger VPS Mint failed", { status: vaultRes.status });
      return;
    }
    const vaultData = await vaultRes.json();
    license_key = vaultData.license_key;
    logStep("Hostinger VPS Mint succeeded", { email, license_key });
  } catch (err: any) {
    logStep("Hostinger VPS Mint request failed", { message: err.message });
    return;
  }

  // 2. Save to Supabase DB
  const { error } = await supabase.from("licenses").upsert({
    email,
    license_key,
    tier,
    status: "active",
    product: "khepra-trust-os",
    registered_at: new Date().toISOString()
  });

  if (error) {
    logStep("Failed to insert commercial license into Supabase", { error });
    return;
  }

  // 3. Send via Resend
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    logStep("Missing RESEND_API_KEY, cannot email license");
    return;
  }
  
  const resend = new Resend(resendApiKey);
  const emailResponse = await resend.emails.send({
    from: 'KHEPRA Protocol <support@nouchix.com>',
    to: email,
    subject: `Your KHEPRA ${tier} License Key`,
    html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome to KHEPRA ${tier}</h2>
            <p>Your commercial subscription is active. Here is your official Cryptographic Governance license key:</p>
            
            <div style="background-color: #f4f4f5; padding: 16px; border-radius: 8px; margin: 24px 0; font-family: monospace; font-size: 18px; text-align: center; letter-spacing: 2px;">
                <strong>${license_key}</strong>
            </div>

            <p>Keep this secure. This key enables continuous compliance scanning, Advanced Cryptographic Protection (ACP), and sovereign deployment capabilities depending on your tier.</p>
            <p>To connect your AI assistant, configure your MCP client:</p>
            <pre style="background-color: #18181b; color: #a1a1aa; padding: 12px; border-radius: 6px; overflow-x: auto;">
{
  "mcpServers": {
    "khepra": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mcp.souhimbou.ai/sse"],
      "env": {
        "KHEPRA_LICENSE_KEY": "${license_key}"
      }
    }
  }
}
            </pre>
            
            <hr style="border: 1px solid #e4e4e7; margin: 32px 0;" />
            <p style="color: #71717a; font-size: 12px;">SecRed Knowledge Inc. dba NouchiX, Albany, NY</p>
        </div>
    `
  });

  if (emailResponse.error) {
    logStep("Resend delivery failed", { error: emailResponse.error });
  } else {
    logStep("Commercial license emailed successfully", { email });
  }
}