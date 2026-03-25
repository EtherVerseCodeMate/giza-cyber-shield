import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[USAGE-BILLING-SYNC] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Starting usage billing sync");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Get current month's billing periods that need to be processed
    const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
    const { data: billingPeriods, error: periodsError } = await supabaseClient
      .from('billing_periods')
      .select(`
        *,
        organization_id
      `)
      .eq('period_start', currentMonth)
      .eq('status', 'active')
      .gt('total_usage_cost', 0);

    if (periodsError) throw periodsError;
    logStep("Found billing periods to process", { count: billingPeriods?.length || 0 });

    for (const period of billingPeriods || []) {
      try {
        // Get organization info and user details
        const { data: orgUsers, error: orgError } = await supabaseClient
          .from('user_organizations')
          .select(`
            user_id,
            profiles!inner(email)
          `)
          .eq('organization_id', period.organization_id)
          .eq('role', 'admin')
          .limit(1);

        if (orgError || !orgUsers?.length) {
          logStep("No admin user found for organization", { org_id: period.organization_id });
          continue;
        }

        const adminEmail = orgUsers[0].profiles.email;
        logStep("Processing billing for organization", { 
          org_id: period.organization_id, 
          admin_email: adminEmail,
          usage_cost: period.total_usage_cost 
        });

        // Find or create Stripe customer
        const customers = await stripe.customers.list({ 
          email: adminEmail, 
          limit: 1 
        });
        
        let customerId: string;
        if (customers.data.length === 0) {
          const customer = await stripe.customers.create({
            email: adminEmail,
            metadata: {
              organization_id: period.organization_id
            }
          });
          customerId = customer.id;
        } else {
          customerId = customers.data[0].id;
        }

        // Get usage breakdown for invoice line items
        const { data: usageSummary, error: summaryError } = await supabaseClient
          .from('usage_costs_summary')
          .select('*')
          .eq('organization_id', period.organization_id)
          .eq('billing_period', currentMonth);

        if (summaryError) throw summaryError;

        // Create invoice with line items for each resource type
        const lineItems = usageSummary?.map(usage => ({
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${usage.resource_type} Usage`,
              description: `${usage.total_quantity} ${usage.unit}`,
              metadata: {
                resource_type: usage.resource_type,
                organization_id: period.organization_id
              }
            },
            unit_amount: Math.round(usage.avg_cost_per_unit * 100), // Convert to cents
          },
          quantity: Math.round(usage.total_quantity * 100) / 100 // Ensure 2 decimal places
        })) || [];

        if (lineItems.length === 0) {
          logStep("No usage to bill for organization", { org_id: period.organization_id });
          continue;
        }

        // Create draft invoice
        const invoice = await stripe.invoices.create({
          customer: customerId,
          auto_advance: false, // Don't auto-finalize
          collection_method: 'charge_automatically',
          description: `Usage charges for ${new Date(period.period_start).toLocaleDateString()} - ${new Date(period.period_end).toLocaleDateString()}`,
          metadata: {
            organization_id: period.organization_id,
            billing_period_id: period.id,
            period_start: period.period_start,
            period_end: period.period_end
          }
        });

        // Add line items to invoice
        for (const lineItem of lineItems) {
          await stripe.invoiceItems.create({
            customer: customerId,
            invoice: invoice.id,
            price_data: lineItem.price_data,
            quantity: lineItem.quantity
          });
        }

        // Finalize and send invoice
        await stripe.invoices.finalizeInvoice(invoice.id);
        await stripe.invoices.sendInvoice(invoice.id);

        // Update billing period with Stripe invoice ID
        await supabaseClient
          .from('billing_periods')
          .update({ 
            stripe_invoice_id: invoice.id,
            status: 'billed',
            updated_at: new Date().toISOString()
          })
          .eq('id', period.id);

        logStep("Successfully created and sent invoice", { 
          invoice_id: invoice.id,
          org_id: period.organization_id,
          amount: period.total_usage_cost
        });

      } catch (orgError) {
        logStep("Error processing organization billing", { 
          org_id: period.organization_id, 
          error: orgError.message 
        });
        continue;
      }
    }

    logStep("Usage billing sync completed successfully");
    return new Response(JSON.stringify({ 
      success: true, 
      processed: billingPeriods?.length || 0 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in usage billing sync", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});