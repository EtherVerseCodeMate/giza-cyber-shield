import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
const siteUrl = Deno.env.get("SITE_URL") || "http://localhost:5173";

// Price ID for Risk Terminator diagnostic - set this in Stripe
const DIAGNOSTIC_PRICE_ID = Deno.env.get("STRIPE_DIAGNOSTIC_PRICE_ID");

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify the JWT and get user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Invalid authentication");
    }

    console.log(`Creating diagnostic checkout for user: ${user.id}`);

    // Check if user already has diagnostic access
    const { data: existingAccess } = await supabase
      .from("consulting_access")
      .select("diagnostic_paid")
      .eq("user_id", user.id)
      .single();

    if (existingAccess?.diagnostic_paid) {
      return new Response(
        JSON.stringify({ error: "You already have diagnostic access" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if customer already exists in Stripe
    let customerId: string | undefined;
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Create checkout session for one-time payment
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: DIAGNOSTIC_PRICE_ID ? [
        {
          price: DIAGNOSTIC_PRICE_ID,
          quantity: 1,
        },
      ] : [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Enterprise Risk & Readiness Diagnostic",
              description: "Risk Terminator - Comprehensive security diagnostic engagement",
            },
            unit_amount: 249900, // $2,499.00 - adjust as needed
          },
          quantity: 1,
        },
      ],
      metadata: {
        user_id: user.id,
        product_type: "diagnostic",
      },
      success_url: `${siteUrl}/diagnostic?success=true`,
      cancel_url: `${siteUrl}/diagnostic?canceled=true`,
    });

    console.log(`Checkout session created: ${session.id}`);

    return new Response(
      JSON.stringify({ url: session.url }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
