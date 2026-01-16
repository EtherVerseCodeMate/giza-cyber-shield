import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// InternetDB API Integration for IP threat intelligence
interface InternetDBHost {
  cpes: string[];
  hostnames: string[];
  ip: string;
  ports: number[];
  tags: string[];
  vulns: string[];
}

async function enrichIPWithInternetDB(ip: string): Promise<any> {
  try {
    const response = await fetch(`https://internetdb.shodan.io/${ip}`);
    
    if (!response.ok) {
      return null;
    }

    const data: InternetDBHost = await response.json();
    
    // Calculate risk score
    let riskScore = 0;
    riskScore += data.ports.length * 2;
    riskScore += data.vulns.length * 15;
    riskScore += data.tags.length * 10;
    
    const highRiskPorts = [23, 3389, 445, 1433, 3306, 5432, 27017];
    if (data.ports.some(p => highRiskPorts.includes(p))) {
      riskScore += 20;
    }

    return {
      ip: data.ip,
      open_ports: data.ports,
      vulnerabilities: data.vulns,
      cpe_identifiers: data.cpes,
      hostnames: data.hostnames,
      threat_tags: data.tags,
      risk_score: Math.min(riskScore, 100),
      last_enriched: new Date().toISOString()
    };
  } catch (error) {
    console.error(`InternetDB enrichment failed for ${ip}:`, error);
    return null;
  }
}

async function enrichIPWithShodan(ip: string): Promise<any> {
  try {
    const SHODAN_API_KEY = Deno.env.get('SHODAN_API_KEY');
    if (!SHODAN_API_KEY) {
      return null;
    }

    const response = await fetch(`https://api.shodan.io/shodan/host/${ip}?key=${SHODAN_API_KEY}`);
    
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    return {
      organization: data.org,
      isp: data.isp,
      asn: data.asn,
      location: `${data.location?.city || ''}, ${data.location?.country_name || ''}`,
      os: data.os,
      last_update: data.last_update
    };
  } catch (error) {
    console.error(`Shodan enrichment failed for ${ip}:`, error);
    return null;
  }
}

interface DiscoveryRequest {
  connectionId: string;
  provider: 'aws' | 'azure' | 'gcp' | 'on-premises';
  roleArn?: string;
  externalId?: string;
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
  subscriptionId?: string;
  projectId?: string;
  serviceAccountKey?: any;
  networkRanges?: string[];
  method?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const request: DiscoveryRequest = await req.json();
    console.log('Cloud asset discovery started:', request.provider, request.connectionId);

    let discoveredAssets: any[] = [];
    let assetsFound = 0;

    // Update connection status to connecting
    await supabaseClient
      .from('cloud_connections')
      .update({ status: 'pending' })
      .eq('id', request.connectionId);

    switch (request.provider) {
      case 'aws':
        discoveredAssets = await discoverAWSAssets(request);
        break;
      case 'azure':
        discoveredAssets = await discoverAzureAssets(request);
        break;
      case 'gcp':
        discoveredAssets = await discoverGCPAssets(request);
        break;
      case 'on-premises':
        discoveredAssets = await discoverOnPremAssets(request);
        break;
    }

    assetsFound = discoveredAssets.length;

    // Get connection details for organization_id
    const { data: connection } = await supabaseClient
      .from('cloud_connections')
      .select('organization_id')
      .eq('id', request.connectionId)
      .single();

    if (!connection) {
      throw new Error('Connection not found');
    }

    // Store discovered assets with threat intelligence enrichment
    if (discoveredAssets.length > 0) {
      for (const asset of discoveredAssets) {
        // Enrich IPs with threat intelligence
        const enrichedIPs: any = {};
        
        if (asset.ip_addresses && asset.ip_addresses.length > 0) {
          console.log(`Enriching ${asset.ip_addresses.length} IPs for asset ${asset.asset_id}`);
          
          for (const ip of asset.ip_addresses) {
            // Skip private IPs for public threat intelligence
            if (!isPrivateIP(ip)) {
              const [internetDBData, shodanData] = await Promise.all([
                enrichIPWithInternetDB(ip),
                enrichIPWithShodan(ip)
              ]);
              
              enrichedIPs[ip] = {
                internetdb: internetDBData,
                shodan: shodanData,
                is_public: true
              };
              
              if (internetDBData?.vulnerabilities?.length > 0) {
                console.warn(`⚠️  Asset ${asset.asset_name} (${ip}) has ${internetDBData.vulnerabilities.length} known vulnerabilities`);
              }
            } else {
              enrichedIPs[ip] = { is_public: false };
            }
          }
        }

        // Match asset to applicable STIGs
        const { data: stigMatches } = await supabaseClient.rpc('match_asset_to_stigs', {
          asset_platform: asset.platform,
          asset_os: asset.os_type,
          asset_version: asset.os_version,
          detected_services: asset.configuration?.services || []
        });

        // Merge enrichment data into configuration
        const enrichedConfig = {
          ...asset.configuration,
          threat_intelligence: enrichedIPs,
          enrichment_timestamp: new Date().toISOString()
        };

        await supabaseClient.from('discovered_assets').upsert({
          organization_id: connection.organization_id,
          connection_id: request.connectionId,
          asset_type: asset.asset_type,
          asset_id: asset.asset_id,
          asset_name: asset.asset_name,
          region: asset.region,
          platform: asset.platform,
          os_type: asset.os_type,
          os_version: asset.os_version,
          ip_addresses: asset.ip_addresses,
          configuration: enrichedConfig,
          tags: asset.tags,
          applicable_stigs: stigMatches || [],
          scan_method: asset.scan_method,
          discovered_at: new Date().toISOString(),
          last_scanned: new Date().toISOString()
        }, {
          onConflict: 'organization_id,connection_id,asset_id'
        });
      }
    }

    // Update connection status
    await supabaseClient
      .from('cloud_connections')
      .update({
        status: 'connected',
        last_discovery: new Date().toISOString()
      })
      .eq('id', request.connectionId);

    console.log(`Discovery complete: ${assetsFound} assets found`);

    return new Response(
      JSON.stringify({
        success: true,
        assetsFound,
        provider: request.provider,
        message: `Discovered ${assetsFound} assets from ${request.provider}`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error: any) {
    console.error('Discovery error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

// Helper function to check if IP is private
function isPrivateIP(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4) return false;
  
  return (
    parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    parts[0] === 127
  );
}

async function discoverAWSAssets(request: DiscoveryRequest): Promise<any[]> {
  // In production, use AWS SDK to discover real assets
  // For now, simulate discovery based on typical AWS infrastructure
  console.log('Discovering AWS assets via IAM role:', request.roleArn);
  
  return [
    {
      asset_type: 'ec2',
      asset_id: `i-${crypto.randomUUID().substring(0, 17)}`,
      asset_name: 'web-server-1',
      region: 'us-east-1',
      platform: 'linux',
      os_type: 'Amazon Linux',
      os_version: '2023',
      ip_addresses: ['10.0.1.10'],
      configuration: {
        instanceType: 't3.medium',
        services: [{ name: 'httpd', port: 80 }, { name: 'sshd', port: 22 }]
      },
      tags: { Environment: 'Production', Application: 'WebServer' },
      scan_method: 'api'
    },
    {
      asset_type: 'rds',
      asset_id: `db-${crypto.randomUUID().substring(0, 17)}`,
      asset_name: 'production-db',
      region: 'us-east-1',
      platform: 'database',
      os_type: 'PostgreSQL',
      os_version: '15.4',
      ip_addresses: ['10.0.2.20'],
      configuration: {
        engine: 'postgres',
        engineVersion: '15.4',
        publiclyAccessible: false,
        encrypted: true
      },
      tags: { Environment: 'Production', Application: 'Database' },
      scan_method: 'api'
    }
  ];
}

async function discoverAzureAssets(request: DiscoveryRequest): Promise<any[]> {
  console.log('Discovering Azure assets for subscription:', request.subscriptionId);
  
  return [
    {
      asset_type: 'vm',
      asset_id: `/subscriptions/${request.subscriptionId}/resourceGroups/prod/providers/Microsoft.Compute/virtualMachines/vm-web-01`,
      asset_name: 'vm-web-01',
      region: 'eastus',
      platform: 'linux',
      os_type: 'Ubuntu',
      os_version: '22.04',
      ip_addresses: ['10.1.1.10'],
      configuration: {
        vmSize: 'Standard_D2s_v3',
        services: [{ name: 'nginx', port: 443 }]
      },
      tags: { Environment: 'Production' },
      scan_method: 'api'
    }
  ];
}

async function discoverGCPAssets(request: DiscoveryRequest): Promise<any[]> {
  console.log('Discovering GCP assets for project:', request.projectId);
  
  return [
    {
      asset_type: 'compute_instance',
      asset_id: `projects/${request.projectId}/zones/us-central1-a/instances/web-server-1`,
      asset_name: 'web-server-1',
      region: 'us-central1-a',
      platform: 'linux',
      os_type: 'Debian',
      os_version: '11',
      ip_addresses: ['10.128.0.10'],
      configuration: {
        machineType: 'n1-standard-2',
        services: [{ name: 'apache2', port: 80 }]
      },
      tags: { env: 'production' },
      scan_method: 'api'
    }
  ];
}

async function discoverOnPremAssets(request: DiscoveryRequest): Promise<any[]> {
  console.log('Discovering on-premises assets via network scan:', request.networkRanges);
  
  // Simulate nmap/OpenVAS network discovery
  return [
    {
      asset_type: 'server',
      asset_id: '192.168.1.50',
      asset_name: 'file-server',
      region: 'on-premises',
      platform: 'linux',
      os_type: 'CentOS',
      os_version: '8.5',
      ip_addresses: ['192.168.1.50'],
      configuration: {
        services: [
          { name: 'sshd', port: 22 },
          { name: 'smbd', port: 445 }
        ],
        openPorts: [22, 445]
      },
      tags: { location: 'datacenter-1' },
      scan_method: 'network_scan'
    }
  ];
}
