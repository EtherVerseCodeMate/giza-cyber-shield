import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Authentication failed');
    }

    const { 
      organizationId, 
      apiProvider, 
      apiEndpoint, 
      tokensUsed = 0, 
      requestMetadata = {} 
    } = await req.json();

    // Get cost configuration for this API provider and endpoint
    const { data: costConfig } = await supabase
      .from('external_api_costs')
      .select('*')
      .eq('api_provider', apiProvider)
      .or(`endpoint_pattern.ilike.%${apiEndpoint}%,endpoint_pattern.eq.*`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Calculate estimated cost
    const costPerRequest = costConfig?.cost_per_request || 0;
    const costPerToken = costConfig?.cost_per_token || 0;
    const estimatedCost = costPerRequest + (tokensUsed * costPerToken);

    // Insert usage record
    const { data: usageRecord, error: usageError } = await supabase
      .from('api_usage_tracking')
      .insert({
        organization_id: organizationId,
        api_provider: apiProvider,
        api_endpoint: apiEndpoint,
        tokens_used: tokensUsed,
        estimated_cost: estimatedCost,
        request_metadata: requestMetadata
      })
      .select()
      .single();

    if (usageError) {
      throw usageError;
    }

    // Update monthly usage billing
    const currentDate = new Date();
    const billingPeriod = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`;

    await supabase
      .from('usage_based_billing')
      .upsert({
        organization_id: organizationId,
        billing_period: billingPeriod,
        total_api_costs: estimatedCost
      }, {
        onConflict: 'organization_id,billing_period',
        ignoreDuplicates: false
      });

    // Check for cost thresholds and create alerts if needed
    const { data: monthlyTotal } = await supabase
      .from('api_usage_tracking')
      .select('estimated_cost')
      .eq('organization_id', organizationId)
      .eq('api_provider', apiProvider)
      .gte('created_at', new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString());

    const totalMonthlyCost = monthlyTotal?.reduce((sum: number, record: any) => sum + record.estimated_cost, 0) || 0;

    // Create alerts at specific thresholds
    const thresholds = [50, 100, 200, 500];
    const threshold = thresholds.find(t => totalMonthlyCost >= t && (totalMonthlyCost - estimatedCost) < t);

    if (threshold) {
      await supabase
        .from('cost_alerts')
        .insert({
          organization_id: organizationId,
          alert_type: 'cost_threshold',
          alert_category: 'billing',
          severity: threshold >= 200 ? 'HIGH' : threshold >= 100 ? 'MEDIUM' : 'LOW',
          message: `${apiProvider.toUpperCase()} API costs reached $${totalMonthlyCost.toFixed(2)} this month`,
          metadata: {
            api_provider: apiProvider,
            current_cost: totalMonthlyCost,
            threshold_amount: threshold,
            billing_period: billingPeriod
          }
        });
    }

    return new Response(JSON.stringify({
      success: true,
      usage_record: usageRecord,
      estimated_cost: estimatedCost,
      total_monthly_cost: totalMonthlyCost
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error tracking API usage:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});