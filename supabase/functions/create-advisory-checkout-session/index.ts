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

// Price ID for Shadow CISO subscription - set this in Stripe
const ADVISORY_PRICE_ID = Deno.env.get("STRIPE_ADVISORY_PRICE_ID");

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

    console.log(`Creating advisory checkout for user: ${user.id}`);

    // Check if user already has an active subscription
    const { data: existingAccess } = await supabase
      .from("consulting_access")
      .select("advisory_requested, subscription_status")
      .eq("user_id", user.id)
      .single();

    if (existingAccess?.subscription_status === "active") {
      return new Response(
        JSON.stringify({ error: "You already have an active advisory subscription" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if customer already exists in Stripe
    let customerId: string | undefined;
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Create checkout session for subscription
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: ADVISORY_PRICE_ID ? [
        {
          price: ADVISORY_PRICE_ID,
          quantity: 1,
        },
      ] : [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Embedded Strategic Advisor",
              description: "Shadow CISO - Ongoing executive advisory engagement",
            },
            unit_amount: 499900, // $4,999.00/month - adjust as needed
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        user_id: user.id,
        product_type: "advisory",
      },
      success_url: `${siteUrl}/advisory?requested=true`,
      cancel_url: `${siteUrl}/advisory?canceled=true`,
    });

    console.log(`Advisory checkout session created: ${session.id}`);

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
