import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DiscoveryRequest {
  action: 'start_discovery' | 'get_status' | 'stop_discovery' | 'get_results';
  discovery_job_id?: string;
  discovery_config?: {
    type: 'network_scan' | 'cloud_discovery' | 'agent_based' | 'snmp_discovery';
    targets: string[];
    credential_ids?: string[];
    scan_options?: any;
  };
  organization_id: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action, discovery_job_id, discovery_config, organization_id }: DiscoveryRequest = await req.json();

    switch (action) {
      case 'start_discovery':
        return await handleStartDiscovery(supabase, organization_id, discovery_config!);
      case 'get_status':
        return await handleGetStatus(supabase, discovery_job_id!);
      case 'stop_discovery':
        return await handleStopDiscovery(supabase, discovery_job_id!);
      case 'get_results':
        return await handleGetResults(supabase, organization_id, discovery_job_id);
      default:
        throw new Error('Invalid action');
    }
  } catch (error) {
    console.error('Error in stig-asset-discovery:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function handleStartDiscovery(supabase: any, organizationId: string, config: any) {
  console.log('Starting discovery for organization:', organizationId, 'with config:', config);

  // Create discovery job
  const { data: job, error: jobError } = await supabase
    .from('discovery_jobs')
    .insert({
      organization_id: organizationId,
      job_name: `${config.type} - ${new Date().toISOString()}`,
      discovery_type: config.type,
      target_specification: { targets: config.targets },
      credential_ids: config.credential_ids || [],
      discovery_config: config.scan_options || {},
      status: 'running'
    })
    .select()
    .single();

  if (jobError) throw jobError;

  // Create execution record
  const { data: execution, error: execError } = await supabase
    .from('discovery_executions')
    .insert({
      discovery_job_id: job.id,
      organization_id: organizationId,
      execution_status: 'running'
    })
    .select()
    .single();

  if (execError) throw execError;

  // Start discovery process based on type
  const discoveredAssets = await performDiscovery(config);

  // Process and classify discovered assets
  const processedAssets = await classifyAssets(supabase, discoveredAssets, job.id, organizationId);

  // Insert discovered assets
  if (processedAssets.length > 0) {
    const { error: assetsError } = await supabase
      .from('discovered_assets')
      .insert(processedAssets);

    if (assetsError) throw assetsError;
  }

  // Update execution status
  await supabase
    .from('discovery_executions')
    .update({
      execution_status: 'completed',
      completed_at: new Date().toISOString(),
      assets_discovered: processedAssets.length,
      discovered_asset_ids: processedAssets.map(a => a.id)
    })
    .eq('id', execution.id);

  // Update job status
  await supabase
    .from('discovery_jobs')
    .update({
      status: 'completed',
      last_run_at: new Date().toISOString()
    })
    .eq('id', job.id);

  return new Response(JSON.stringify({
    success: true,
    job_id: job.id,
    execution_id: execution.id,
    assets_discovered: processedAssets.length,
    assets: processedAssets
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function performDiscovery(config: any) {
  console.log('Performing discovery:', config.type);

  switch (config.type) {
    case 'network_scan':
      return await performNetworkScan(config.targets);
    case 'cloud_discovery':
      return await performCloudDiscovery(config.targets);
    case 'snmp_discovery':
      return await performSNMPDiscovery(config.targets);
    case 'agent_based':
      return await performAgentBasedDiscovery(config.targets);
    default:
      throw new Error(`Unsupported discovery type: ${config.type}`);
  }
}

async function performNetworkScan(targets: string[]) {
  console.log('Performing network scan on targets:', targets);
  
  const discoveredAssets = [];

  for (const target of targets) {
    try {
      // Simulate network discovery - in production this would use actual network scanning
      const asset = {
        asset_identifier: target,
        asset_type: 'server',
        platform: await detectPlatform(target),
        operating_system: await detectOS(target),
        version: await detectVersion(target),
        hostname: await resolveHostname(target),
        ip_addresses: [target],
        discovered_services: await scanPorts(target),
        discovery_method: 'network_scan',
        system_info: {
          scan_timestamp: new Date().toISOString(),
          scanner: 'stig-connector-v1'
        }
      };

      discoveredAssets.push(asset);
    } catch (error) {
      console.error(`Failed to scan ${target}:`, error);
    }
  }

  return discoveredAssets;
}

async function performCloudDiscovery(cloudConfigs: string[]) {
  console.log('Performing cloud discovery');
  
  // Simulate cloud discovery - would integrate with AWS, Azure, GCP APIs
  return [
    {
      asset_identifier: 'i-0123456789abcdef0',
      asset_type: 'server',
      platform: 'aws',
      operating_system: 'Amazon Linux 2',
      version: '2.0.20230912',
      hostname: 'ip-10-0-1-100.ec2.internal',
      ip_addresses: ['10.0.1.100'],
      discovered_services: [{ name: 'ssh', port: 22, protocol: 'tcp' }],
      discovery_method: 'cloud_discovery',
      system_info: {
        instance_type: 't3.medium',
        region: 'us-east-1',
        vpc_id: 'vpc-0123456789abcdef0'
      }
    }
  ];
}

async function performSNMPDiscovery(targets: string[]) {
  console.log('Performing SNMP discovery on targets:', targets);
  
  // Simulate SNMP discovery for network devices
  return targets.map(target => ({
    asset_identifier: target,
    asset_type: 'network_device',
    platform: 'cisco_ios',
    operating_system: 'Cisco IOS',
    version: '15.1(4)M12a',
    hostname: `switch-${target.split('.').pop()}`,
    ip_addresses: [target],
    discovered_services: [
      { name: 'snmp', port: 161, protocol: 'udp' },
      { name: 'ssh', port: 22, protocol: 'tcp' }
    ],
    discovery_method: 'snmp_discovery',
    system_info: {
      device_type: 'switch',
      model: 'Catalyst 2960',
      interfaces: 24
    }
  }));
}

async function performAgentBasedDiscovery(agentConfigs: string[]) {
  console.log('Performing agent-based discovery');
  
  // Simulate agent-based discovery
  return [
    {
      asset_identifier: 'agent-001',
      asset_type: 'server',
      platform: 'windows',
      operating_system: 'Windows Server 2019',
      version: '10.0.17763',
      hostname: 'WIN-SRV-001',
      ip_addresses: ['192.168.1.10'],
      discovered_services: [
        { name: 'iis', port: 80, protocol: 'tcp', version: '10.0' },
        { name: 'rdp', port: 3389, protocol: 'tcp' }
      ],
      discovery_method: 'agent_based',
      system_info: {
        domain: 'corp.local',
        last_boot: '2024-01-15T08:30:00Z',
        installed_software: ['IIS', 'SQL Server 2019']
      }
    }
  ];
}

async function classifyAssets(supabase: any, assets: any[], jobId: string, organizationId: string) {
  console.log('Classifying assets for STIG applicability');

  // Get STIG applicability rules
  const { data: stigRules, error } = await supabase
    .from('stig_applicability_rules')
    .select('*');

  if (error) {
    console.error('Error fetching STIG rules:', error);
    return assets.map(asset => ({
      ...asset,
      id: crypto.randomUUID(),
      organization_id: organizationId,
      discovery_job_id: jobId,
      applicable_stigs: [],
      risk_score: 50
    }));
  }

  return assets.map(asset => {
    const applicableStigs = [];
    let riskScore = 0;

    // Apply STIG classification rules
    for (const rule of stigRules || []) {
      if (isSTIGApplicable(asset, rule)) {
        applicableStigs.push(rule.stig_id);
        riskScore += 10; // Increase risk for each applicable STIG
      }
    }

    return {
      ...asset,
      id: crypto.randomUUID(),
      organization_id: organizationId,
      discovery_job_id: jobId,
      applicable_stigs: applicableStigs,
      stig_version_mapping: getSTIGVersionMapping(applicableStigs, stigRules),
      risk_score: Math.min(riskScore, 100),
      compliance_status: {
        total_stigs: applicableStigs.length,
        scanned: 0,
        compliant: 0,
        last_scan: null
      }
    };
  });
}

function isSTIGApplicable(asset: any, stigRule: any): boolean {
  // Check platform patterns
  const platformPatterns = stigRule.platform_patterns;
  if (platformPatterns && platformPatterns.length > 0) {
    const platformMatch = platformPatterns.some((pattern: string) => {
      try {
        const regex = new RegExp(pattern, 'i');
        return regex.test(asset.platform) || regex.test(asset.operating_system);
      } catch {
        return pattern.toLowerCase() === asset.platform?.toLowerCase();
      }
    });
    if (!platformMatch) return false;
  }

  // Check version patterns
  const versionPatterns = stigRule.version_patterns;
  if (versionPatterns && versionPatterns.length > 0 && asset.version) {
    const versionMatch = versionPatterns.some((pattern: string) => {
      try {
        const regex = new RegExp(pattern, 'i');
        return regex.test(asset.version);
      } catch {
        return pattern === asset.version;
      }
    });
    if (!versionMatch) return false;
  }

  return true;
}

function getSTIGVersionMapping(applicableStigs: string[], stigRules: any[]) {
  const mapping: any = {};
  for (const stigId of applicableStigs) {
    const rule = stigRules.find(r => r.stig_id === stigId);
    if (rule) {
      mapping[stigId] = rule.stig_version;
    }
  }
  return mapping;
}

// Helper functions for asset detection
async function detectPlatform(target: string): Promise<string> {
  // Determine platform based on target patterns
  if (target.includes('windows') || target.includes('win')) return 'windows';
  if (target.includes('linux') || target.includes('ubuntu') || target.includes('rhel')) return 'linux';
  if (target.includes('cisco') || target.includes('ios')) return 'cisco_ios';
  if (target.includes('vmware') || target.includes('esx')) return 'vmware';
  // Default to linux for most servers
  return 'linux';
}

async function detectOS(target: string): Promise<string> {
  // Determine OS based on target name patterns
  if (target.includes('windows') || target.includes('win')) return 'Windows Server 2019';
  if (target.includes('ubuntu')) return 'Ubuntu 22.04';
  if (target.includes('rhel') || target.includes('redhat')) return 'Red Hat Enterprise Linux 8';
  if (target.includes('cisco')) return 'Cisco IOS';
  // Default to Ubuntu
  return 'Ubuntu 22.04';
}

async function detectVersion(target: string): Promise<string> {
  return '1.0.0';
}

async function resolveHostname(target: string): Promise<string> {
  return `host-${target.split('.').pop()}`;
}

async function scanPorts(target: string) {
  // Return common secure ports (deterministic)
  // In production, actual port scanning would be performed
  const commonPorts = [
    { name: 'ssh', port: 22, protocol: 'tcp' },
    { name: 'https', port: 443, protocol: 'tcp' }
  ];

  return commonPorts;
}

async function handleGetStatus(supabase: any, jobId: string) {
  const { data: execution, error } = await supabase
    .from('discovery_executions')
    .select('*')
    .eq('discovery_job_id', jobId)
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  if (error) throw error;

  return new Response(JSON.stringify({
    status: execution.execution_status,
    assets_discovered: execution.assets_discovered,
    started_at: execution.started_at,
    completed_at: execution.completed_at
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleStopDiscovery(supabase: any, jobId: string) {
  await supabase
    .from('discovery_jobs')
    .update({ status: 'cancelled' })
    .eq('id', jobId);

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleGetResults(supabase: any, organizationId: string, jobId?: string) {
  let query = supabase
    .from('discovered_assets')
    .select('*')
    .eq('organization_id', organizationId)
    .order('last_discovered', { ascending: false });

  if (jobId) {
    query = query.eq('discovery_job_id', jobId);
  }

  const { data: assets, error } = await query;

  if (error) throw error;

  return new Response(JSON.stringify({
    assets: assets || [],
    total_count: assets?.length || 0
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}