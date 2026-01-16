import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domains, organizationId } = await req.json();
    console.log('Infrastructure discovery started for:', { domains, organizationId });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Simulate progressive discovery with realistic delays
    const discoveredAssets = await performDiscovery(domains);

    // Store discovered assets in database
    if (organizationId) {
      for (const asset of discoveredAssets) {
        await supabase.from('infrastructure_assets').insert({
          organization_id: organizationId,
          name: asset.name,
          type: asset.type,
          version: asset.version,
          risk_level: asset.riskLevel,
          compliance_score: asset.complianceScore,
          metadata: {
            discovered_at: new Date().toISOString(),
            discovery_method: 'automated_scan',
            domains: domains,
            ...asset
          }
        });
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      discoveredAssets,
      totalAssets: discoveredAssets.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in automated-infrastructure-discovery:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function performDiscovery(domains: string[]): Promise<any[]> {
  // Simulate realistic infrastructure discovery
  const assetTemplates = [
    { name: 'Microsoft Exchange Server', type: 'email', version: '2019 CU12', riskLevel: 'medium', complianceScore: 72 },
    { name: 'Active Directory Domain Controller', type: 'identity', version: '2022', riskLevel: 'high', complianceScore: 85 },
    { name: 'Windows Server', type: 'server', version: '2022 Standard', riskLevel: 'medium', complianceScore: 78 },
    { name: 'IIS Web Server', type: 'web', version: '10.0', riskLevel: 'high', complianceScore: 65 },
    { name: 'SQL Server', type: 'database', version: '2022 Enterprise', riskLevel: 'high', complianceScore: 82 },
    { name: 'VMware vSphere', type: 'virtualization', version: '8.0', riskLevel: 'medium', complianceScore: 88 },
    { name: 'Cisco ASA Firewall', type: 'network', version: '9.18', riskLevel: 'medium', complianceScore: 91 },
    { name: 'Office 365', type: 'cloud', version: 'Enterprise E3', riskLevel: 'low', complianceScore: 94 },
    { name: 'CrowdStrike Falcon', type: 'security', version: '7.08', riskLevel: 'low', complianceScore: 96 },
    { name: 'Splunk Enterprise', type: 'monitoring', version: '9.1.2', riskLevel: 'low', complianceScore: 89 }
  ];

  // Randomly select 4-8 assets for discovery
  const numAssets = Math.floor(Math.random() * 5) + 4;
  const discoveredAssets = [];

  for (let i = 0; i < numAssets; i++) {
    const template = assetTemplates[Math.floor(Math.random() * assetTemplates.length)];
    
    // Add some variance to make it realistic
    const asset = {
      ...template,
      id: `asset-${Date.now()}-${i}`,
      complianceScore: template.complianceScore + Math.floor(Math.random() * 10) - 5,
      integrability: Math.floor(Math.random() * 30) + 70, // 70-100%
      discoveredAt: new Date().toISOString(),
      status: 'active'
    };

    discoveredAssets.push(asset);
    
    // Add small delay to simulate real discovery
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return discoveredAssets;
}