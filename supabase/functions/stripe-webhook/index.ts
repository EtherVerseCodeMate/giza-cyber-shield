import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import Stripe from "https://esm.sh/stripe@14.21.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

// Product IDs - these should match your Stripe products
const DIAGNOSTIC_PRODUCT_ID = Deno.env.get("STRIPE_DIAGNOSTIC_PRODUCT_ID") || "diagnostic";
const ADVISORY_PRODUCT_ID = Deno.env.get("STRIPE_ADVISORY_PRODUCT_ID") || "advisory";

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  
  if (!signature) {
    console.error("No Stripe signature found");
    return new Response("No signature", { status: 400 });
  }

  try {
    const body = await req.text();
    
    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    console.log(`Processing Stripe event: ${event.type}`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(supabase, session);
        break;
      }
      
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(supabase, subscription);
        break;
      }
      
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(supabase, subscription);
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

async function handleCheckoutCompleted(supabase: any, session: Stripe.Checkout.Session) {
  const customerId = session.customer as string;
  const userId = session.metadata?.user_id;
  const productType = session.metadata?.product_type;

  if (!userId) {
    console.error("No user_id in session metadata");
    return;
  }

  console.log(`Checkout completed for user ${userId}, product: ${productType}`);

  // Check if record exists
  const { data: existingAccess } = await supabase
    .from("consulting_access")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (productType === "diagnostic") {
    // One-time payment for Risk Terminator
    if (existingAccess) {
      await supabase
        .from("consulting_access")
        .update({
          stripe_customer_id: customerId,
          diagnostic_paid: true,
          diagnostic_paid_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
    } else {
      await supabase
        .from("consulting_access")
        .insert({
          user_id: userId,
          stripe_customer_id: customerId,
          diagnostic_paid: true,
          diagnostic_paid_at: new Date().toISOString(),
        });
    }
    console.log(`Diagnostic access granted for user ${userId}`);
  } else if (productType === "advisory") {
    // Subscription for Shadow CISO - only set advisory_requested, NOT advisory_approved
    if (existingAccess) {
      await supabase
        .from("consulting_access")
        .update({
          stripe_customer_id: customerId,
          advisory_requested: true,
          advisory_requested_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
    } else {
      await supabase
        .from("consulting_access")
        .insert({
          user_id: userId,
          stripe_customer_id: customerId,
          advisory_requested: true,
          advisory_requested_at: new Date().toISOString(),
        });
    }
    console.log(`Advisory requested for user ${userId} - pending approval`);
  }
}

async function handleSubscriptionUpdate(supabase: any, subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const status = subscription.status;
  const subscriptionId = subscription.id;

  console.log(`Subscription ${subscriptionId} updated: status=${status}`);

  // Find user by stripe_customer_id
  const { data: access, error } = await supabase
    .from("consulting_access")
    .select("id, user_id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (error || !access) {
    console.error("Could not find user for customer:", customerId);
    return;
  }

  await supabase
    .from("consulting_access")
    .update({
      subscription_id: subscriptionId,
      subscription_status: status,
      subscription_updated_at: new Date().toISOString(),
    })
    .eq("id", access.id);

  console.log(`Updated subscription status for user ${access.user_id}`);
}

async function handleSubscriptionDeleted(supabase: any, subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const subscriptionId = subscription.id;

  console.log(`Subscription ${subscriptionId} deleted for customer ${customerId}`);

  // Find user by stripe_customer_id
  const { data: access, error } = await supabase
    .from("consulting_access")
    .select("id, user_id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (error || !access) {
    console.error("Could not find user for customer:", customerId);
    return;
  }

  await supabase
    .from("consulting_access")
    .update({
      subscription_status: "canceled",
      subscription_updated_at: new Date().toISOString(),
      // Keep advisory_requested true but remove access when subscription ends
    })
    .eq("id", access.id);

  console.log(`Subscription canceled for user ${access.user_id}`);
}
