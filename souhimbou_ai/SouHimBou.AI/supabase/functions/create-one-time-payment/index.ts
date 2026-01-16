import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper logging function for debugging
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-ONE-TIME-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    
    // Allow guest purchases for some payment types
    const { paymentType, amount, customAmount } = await req.json();
    logStep("Received payment request", { paymentType, amount, customAmount, hasUser: !!user });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    
    let customerId;
    if (user?.email) {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        logStep("Found existing customer", { customerId });
      } else {
        logStep("No existing customer found");
      }
    }

    // Define payment configurations
    const paymentConfigs = {
      'founding-member': {
        name: 'Founding Member - Lifetime Access',
        description: 'Lifetime access to the platform with exclusive founding member benefits',
        amount: amount || 9700, // $97 default
        metadata: { type: 'founding_member', userId: user?.id || 'guest' }
      },
      'supporter': {
        name: 'Platform Supporter',
        description: 'Support the development and help provide free access to others',
        amount: amount || 4700, // $47 default
        metadata: { type: 'supporter', userId: user?.id || 'guest' }
      },
      'donation': {
        name: 'Tip Jar - Buy Me a Coffee',
        description: 'Thank you for supporting our mission!',
        amount: customAmount || amount || 500, // $5 default
        metadata: { type: 'donation', userId: user?.id || 'guest' }
      },
      'beta-access': {
        name: 'Future Beta Group Access',
        description: 'Pre-purchase access to future beta programs and exclusive features',
        amount: amount || 14700, // $147 default
        metadata: { type: 'beta_access', userId: user?.id || 'guest' }
      }
    };

    const config = paymentConfigs[paymentType as keyof typeof paymentConfigs];
    if (!config) throw new Error('Invalid payment type');

    logStep("Payment config selected", { paymentType, config });

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : (user?.email || undefined),
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { 
              name: config.name,
              description: config.description
            },
            unit_amount: config.amount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/billing?success=true&type=${paymentType}`,
      cancel_url: `${req.headers.get("origin")}/billing?canceled=true`,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      metadata: config.metadata
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-one-time-payment", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});