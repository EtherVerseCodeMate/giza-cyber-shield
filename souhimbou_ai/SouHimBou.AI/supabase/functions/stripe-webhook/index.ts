import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
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

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      throw new Error("Missing Stripe signature");
    }

    const body = await req.text();
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      logStep("Webhook signature verified", { eventType: event.type });
    } catch (err) {
      logStep("Webhook signature verification failed", { error: err.message });
      return new Response(`Webhook signature verification failed: ${err.message}`, { status: 400 });
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
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, supabaseClient, stripe);
        break;
      
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, supabaseClient, stripe);
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

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in webhook", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

async function handlePaymentSucceeded(invoice: Stripe.Invoice, supabase: any) {
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

async function handleSubscriptionUpdated(subscription: Stripe.Subscription, supabase: any, stripe: Stripe) {
  logStep("Processing subscription updated", { subscriptionId: subscription.id, customerId: subscription.customer });
  
  const customer = await getCustomerEmail(subscription.customer as string, supabase);
  if (!customer) return;

  // Get subscription tier from price
  let subscriptionTier = "Basic";
  if (subscription.items.data.length > 0) {
    const price = subscription.items.data[0].price;
    const amount = price.unit_amount || 0;
    
    if (amount <= 999) {
      subscriptionTier = "Basic";
    } else if (amount <= 9999) {
      subscriptionTier = "Standard";
    } else if (amount <= 19999) {
      subscriptionTier = "Premium";
    } else {
      subscriptionTier = "Enterprise";
    }
  }

  const subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
  const isActive = subscription.status === "active";

  await supabase.from("subscribers").upsert({
    email: customer.email,
    user_id: customer.user_id,
    stripe_customer_id: subscription.customer,
    subscribed: isActive,
    subscription_tier: subscriptionTier,
    subscription_end: subscriptionEnd,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'email' });

  logStep("Subscription updated", { 
    email: customer.email, 
    tier: subscriptionTier, 
    active: isActive 
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription, supabase: any, stripe: Stripe) {
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

  logStep("Subscription deleted - subscriber updated", { email: customer.email });
}

async function handlePaymentFailed(invoice: Stripe.Invoice, supabase: any) {
  logStep("Processing payment failed", { invoiceId: invoice.id, customerId: invoice.customer });
  
  // Could implement logic here to mark accounts as past due
  // For now, just log the event
}

async function getCustomerEmail(customerId: string, supabase: any) {
  // First try to get from our subscribers table
  const { data: subscriber } = await supabase
    .from("subscribers")
    .select("email, user_id")
    .eq("stripe_customer_id", customerId)
    .single();
  
  if (subscriber) {
    return subscriber;
  }

  // If not found, we might need to get from Stripe and find the user
  // For now, return null - the customer should exist in our system first
  logStep("Customer not found in subscribers table", { customerId });
  return null;
}