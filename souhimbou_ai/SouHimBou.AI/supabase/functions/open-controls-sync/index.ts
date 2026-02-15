import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OpenControlsSyncRequest {
  organization_id: string;
  sync_type: 'intelligence' | 'configurations' | 'performance' | 'full';
  force_refresh?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const {
      organization_id,
      sync_type = 'full',
      force_refresh = false
    }: OpenControlsSyncRequest = await req.json();

    console.log(`Open Controls Sync: ${sync_type} for org ${organization_id}`);

    // Check if sync is needed (unless forced)
    if (!force_refresh) {
      const { data: lastSync } = await supabase
        .from('enhanced_open_controls_integrations')
        .select('last_sync_timestamp')
        .eq('organization_id', organization_id)
        .eq('integration_name', 'Open Controls Intelligence')
        .single();

      if (lastSync?.last_sync_timestamp) {
        const lastSyncTime = new Date(lastSync.last_sync_timestamp);
        const hoursSinceSync = (Date.now() - lastSyncTime.getTime()) / (1000 * 60 * 60);

        if (hoursSinceSync < 1) {
          return new Response(JSON.stringify({
            success: true,
            message: 'Sync not needed - recent sync available',
            last_sync: lastSync.last_sync_timestamp,
            next_sync_due: new Date(lastSyncTime.getTime() + 60 * 60 * 1000).toISOString()
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    const syncResults = await performOpenControlsSync(supabase, organization_id, sync_type);

    // Update integration status
    await supabase
      .from('enhanced_open_controls_integrations')
      .upsert({
        organization_id,
        integration_name: 'Open Controls Intelligence',
        api_endpoint: 'https://opencontrols.github.io',
        authentication_method: 'none',
        last_sync_timestamp: new Date().toISOString(),
        sync_status: 'success',
        performance_metrics: {
          sync_duration_ms: syncResults.sync_duration_ms,
          intelligence_updates: syncResults.intelligence_updates,
          configuration_updates: syncResults.configuration_updates
        },
        is_active: true
      });

    // Record performance metrics
    await supabase
      .from('open_controls_performance_metrics')
      .insert({
        organization_id,
        metric_type: 'open_controls_sync',
        metric_name: `sync_${sync_type}_${Date.now()}`,
        metric_value: syncResults.intelligence_updates,
        metric_metadata: {
          sync_type,
          sync_results: syncResults,
          forced_refresh: force_refresh
        }
      });

    console.log(`Open Controls Sync completed: ${syncResults.intelligence_updates} updates`);

    return new Response(JSON.stringify({
      success: true,
      sync_results: syncResults,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Open Controls Sync Error:', error);

    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      message: 'Open Controls sync encountered an error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function performOpenControlsSync(supabase: any, organizationId: string, syncType: string) {
  const startTime = Date.now();

  // TRL10 PRODUCTION: Mock data generation removed for security integrity
  // Real integration requires valid API configurations for Open Controls, DISA, and NIST

  const syncResults = {
    intelligence_updates: 0,
    configuration_updates: 0,
    performance_insights: 0,
    new_recommendations: [],
    sync_duration_ms: 0,
    status: 'INTEGRATION_REQUIRED',
    message: `Open Controls ${syncType} sync requires external provider configuration for organization ${organizationId}`
  };

  // Log that a sync was attempted but skipped due to missing integration
  await supabase
    .from('open_controls_performance_metrics')
    .insert({
      organization_id: organizationId,
      metric_type: 'sync_skip',
      metric_name: `skip_${syncType}_${Date.now()}`,
      metric_value: 0,
      metric_metadata: {
        reason: 'MOCK_DATA_REMOVED',
        sync_type: syncType,
        production_mode: true
      }
    });

  syncResults.sync_duration_ms = Date.now() - startTime;

  return syncResults;
}
