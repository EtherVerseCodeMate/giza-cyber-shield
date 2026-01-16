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
  
  // Mock Open Controls intelligence sync - Ready for real integration
  const mockResults = {
    intelligence_updates: 0,
    configuration_updates: 0,
    performance_insights: 0,
    new_recommendations: [],
    sync_duration_ms: 0
  };

  if (syncType === 'intelligence' || syncType === 'full') {
    // Mock intelligence updates
    mockResults.intelligence_updates = Math.floor(Math.random() * 25) + 5;
    
    // Simulate fetching latest security intelligence
    const intelligenceData = [
      {
        source: 'DISA',
        category: 'vulnerability_intelligence',
        data: {
          new_cves: ['CVE-2024-1234', 'CVE-2024-5678'],
          threat_level: 'ELEVATED',
          affected_platforms: ['RHEL 8', 'Windows Server 2022']
        }
      },
      {
        source: 'NIST',
        category: 'framework_updates',
        data: {
          framework: 'CSF 2.0',
          updated_controls: ['ID.AM', 'PR.AC', 'DE.AE'],
          effective_date: '2024-02-26'
        }
      }
    ];

    // Store intelligence updates
    for (const intel of intelligenceData) {
      await supabase
        .from('open_controls_performance_metrics')
        .insert({
          organization_id: organizationId,
          metric_type: 'intelligence_update',
          metric_name: `${intel.source}_${intel.category}_${Date.now()}`,
          metric_value: 1,
          metric_metadata: intel
        });
    }
  }

  if (syncType === 'configurations' || syncType === 'full') {
    // Mock configuration updates
    mockResults.configuration_updates = Math.floor(Math.random() * 15) + 3;
    
    const configurationRecommendations = [
      {
        id: 'OC_CONFIG_001',
        priority: 'HIGH',
        category: 'SSH_HARDENING',
        title: 'Update SSH Configuration for Enhanced Security',
        description: 'Latest DISA guidelines recommend additional SSH hardening measures',
        affected_assets: ['rhel-servers', 'ubuntu-systems'],
        implementation_script: 'sudo sed -i "s/#PermitRootLogin yes/PermitRootLogin no/" /etc/ssh/sshd_config',
        compliance_impact: '+5% STIG compliance score'
      },
      {
        id: 'OC_CONFIG_002',
        priority: 'MEDIUM',
        category: 'FIREWALL_RULES',
        title: 'Optimize Firewall Rules Based on Traffic Analysis',
        description: 'ML analysis suggests optimizing firewall rules for better performance',
        affected_assets: ['network-firewalls'],
        implementation_script: 'firewall-cmd --add-rich-rule="rule family="ipv4" source address="10.0.0.0/8" accept"',
        compliance_impact: 'Improved network security posture'
      }
    ];

    mockResults.new_recommendations = configurationRecommendations;
  }

  if (syncType === 'performance' || syncType === 'full') {
    // Mock performance insights
    mockResults.performance_insights = Math.floor(Math.random() * 10) + 2;
    
    // Generate performance optimization suggestions
    const performanceInsights = [
      {
        insight_type: 'resource_optimization',
        confidence: 0.87,
        recommendation: 'Database connection pooling optimization could improve response times by 15%',
        estimated_impact: { performance: '+15%', cost: '-5%' }
      },
      {
        insight_type: 'security_enhancement',
        confidence: 0.92,
        recommendation: 'Implementing additional access controls would improve security score by 8%',
        estimated_impact: { security: '+8%', compliance: '+12%' }
      }
    ];

    for (const insight of performanceInsights) {
      await supabase
        .from('open_controls_performance_metrics')
        .insert({
          organization_id: organizationId,
          metric_type: 'performance_insight',
          metric_name: `insight_${insight.insight_type}_${Date.now()}`,
          metric_value: insight.confidence,
          metric_metadata: insight
        });
    }
  }

  mockResults.sync_duration_ms = Date.now() - startTime;
  
  return mockResults;
}