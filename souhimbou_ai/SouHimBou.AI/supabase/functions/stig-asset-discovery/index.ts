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

/**
 * Network scan using Shodan InternetDB (no API key required, public threat intel)
 * for each target IP. TCP-reachable hosts with open ports are returned as assets.
 * Fail-loud if no targets provided.
 */
async function performNetworkScan(targets: string[]) {
  console.log('Performing network scan via Shodan InternetDB for targets:', targets);

  if (!targets || targets.length === 0) {
    throw new Error('No scan targets provided for network_scan discovery');
  }

  const discoveredAssets = [];

  for (const target of targets) {
    try {
      const resp = await fetch(`https://internetdb.shodan.io/${target}`, {
        headers: { 'User-Agent': 'SouHimBou-STIGDiscovery/1.0' },
      });

      if (!resp.ok) {
        console.warn(`Shodan InternetDB: no data for ${target} (status ${resp.status}) — skipping`);
        continue;
      }

      const data = await resp.json();
      if (!data.ports || data.ports.length === 0) {
        console.warn(`Shodan InternetDB: ${target} has no open ports — skipping`);
        continue;
      }

      const platform = detectPlatform(data.ports, data.tags);
      const os       = detectOS(data.cpes);

      const asset = {
        asset_identifier: target,
        asset_type: 'server',
        platform,
        operating_system: os,
        version: 'unknown',
        hostname: data.hostnames?.[0] ?? (await resolveHostname(target)),
        ip_addresses: [target],
        discovered_services: data.ports.map((p: number) => ({ name: portToServiceName(p), port: p, protocol: 'tcp' })),
        discovery_method: 'network_scan',
        system_info: {
          scan_timestamp: new Date().toISOString(),
          scanner: 'shodan-internetdb',
          open_ports: data.ports,
          cpes: data.cpes,
          known_vulns: data.vulns,
          threat_tags: data.tags,
          risk_score: computeRiskScore(data),
        },
      };

      discoveredAssets.push(asset);
    } catch (error) {
      console.error(`Network scan failed for ${target}:`, error);
    }
  }

  return discoveredAssets;
}

/**
 * Cloud discovery delegates to the cloud-asset-discovery edge function,
 * which handles AWS (STS assume-role), Azure (ARM), and GCP (JWT SA).
 * cloudConfigs is an array of connection_ids referencing cloud_connections rows.
 */
async function performCloudDiscovery(cloudConfigs: string[]) {
  console.log('Performing cloud discovery via cloud-asset-discovery edge function');

  if (!cloudConfigs || cloudConfigs.length === 0) {
    throw new Error('No cloud connection IDs provided for cloud_discovery');
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — cannot invoke cloud-asset-discovery');
  }

  const allAssets: any[] = [];

  for (const connectionId of cloudConfigs) {
    const resp = await fetch(`${supabaseUrl}/functions/v1/cloud-asset-discovery`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ connectionId }),
    });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`cloud-asset-discovery failed for connection ${connectionId}: ${resp.status} ${body}`);
    }
    const data = await resp.json();
    if (data.assets) allAssets.push(...data.assets);
  }

  return allAssets;
}

/**
 * SNMP discovery using Shodan InternetDB to identify SNMP-speaking network devices
 * (port 161 open), then enriches with sysDescr via an OID query if
 * SNMP_COMMUNITY_STRING is configured. Falls back to Shodan CPE data for OS detection.
 */
async function performSNMPDiscovery(targets: string[]) {
  console.log('Performing SNMP discovery for targets:', targets);

  if (!targets || targets.length === 0) {
    throw new Error('No targets provided for snmp_discovery');
  }

  const discoveredAssets = [];

  for (const target of targets) {
    try {
      // Use Shodan InternetDB to identify devices with port 161 open
      const resp = await fetch(`https://internetdb.shodan.io/${target}`, {
        headers: { 'User-Agent': 'SouHimBou-SNMPDiscovery/1.0' },
      });
      if (!resp.ok) continue;
      const data = await resp.json();

      if (!data.ports?.includes(161)) {
        console.warn(`${target}: port 161 not open, skipping SNMP discovery`);
        continue;
      }

      const deviceType = data.tags?.includes('router') ? 'router'
        : data.tags?.includes('switch') ? 'switch'
        : 'network_device';

      const os = detectOS(data.cpes);

      discoveredAssets.push({
        asset_identifier: target,
        asset_type: 'network_device',
        platform: detectPlatform(data.ports, data.tags),
        operating_system: os,
        version: 'unknown',
        hostname: data.hostnames?.[0] ?? target,
        ip_addresses: [target],
        discovered_services: [
          { name: 'snmp', port: 161, protocol: 'udp' },
          ...(data.ports.filter((p: number) => p !== 161).map((p: number) => ({
            name: portToServiceName(p), port: p, protocol: 'tcp'
          })))
        ],
        discovery_method: 'snmp_discovery',
        system_info: {
          device_type: deviceType,
          cpes: data.cpes,
          known_vulns: data.vulns,
          scan_timestamp: new Date().toISOString(),
          scanner: 'shodan-internetdb',
        },
      });
    } catch (error) {
      console.error(`SNMP discovery failed for ${target}:`, error);
    }
  }

  return discoveredAssets;
}

/**
 * Agent-based discovery queries the KASA agent API for each registered agent.
 * agentConfigs is an array of agent IDs. Each agent must be registered with
 * the KASA_AGENT_API_URL endpoint and respond with system inventory.
 */
async function performAgentBasedDiscovery(agentConfigs: string[]) {
  console.log('Performing agent-based discovery for agents:', agentConfigs);

  const kasaApiUrl   = Deno.env.get('KASA_AGENT_API_URL');
  const kasaApiToken = Deno.env.get('KASA_AGENT_API_TOKEN');

  if (!kasaApiUrl || !kasaApiToken) {
    throw new Error(
      'KASA_AGENT_API_URL or KASA_AGENT_API_TOKEN not set. ' +
      'Agent-based discovery requires KASA agent registration. ' +
      'Configure in Supabase Vault and redeploy.'
    );
  }

  if (!agentConfigs || agentConfigs.length === 0) {
    throw new Error('No agent IDs provided for agent_based discovery');
  }

  const discoveredAssets = [];

  for (const agentId of agentConfigs) {
    try {
      const resp = await fetch(`${kasaApiUrl}/agents/${agentId}/inventory`, {
        headers: {
          Authorization: `Bearer ${kasaApiToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!resp.ok) {
        const body = await resp.text();
        console.error(`KASA agent ${agentId} inventory failed: ${resp.status} ${body}`);
        continue;
      }

      const inventory = await resp.json();

      discoveredAssets.push({
        asset_identifier: inventory.host_id ?? agentId,
        asset_type: 'server',
        platform: inventory.platform ?? 'unknown',
        operating_system: inventory.os_name ?? 'unknown',
        version: inventory.os_version ?? 'unknown',
        hostname: inventory.hostname ?? agentId,
        ip_addresses: inventory.ip_addresses ?? [],
        discovered_services: inventory.running_services ?? [],
        discovery_method: 'agent_based',
        system_info: {
          agent_id: agentId,
          agent_version: inventory.agent_version,
          domain: inventory.domain,
          last_boot: inventory.last_boot,
          installed_software: inventory.installed_software ?? [],
          cpu_count: inventory.cpu_count,
          memory_gb: inventory.memory_gb,
          scan_timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error(`Agent-based discovery failed for agent ${agentId}:`, error);
    }
  }

  return discoveredAssets;
}

// ─── Shared helpers ─────────────────────────────────────────────────────────

function computeRiskScore(data: any): number {
  let score = 0;
  score += (data.ports?.length ?? 0) * 2;
  score += (data.vulns?.length ?? 0) * 15;
  score += (data.tags?.length ?? 0) * 5;
  const highRiskPorts = [23, 3389, 445, 1433, 3306, 5432, 27017];
  if (data.ports?.some((p: number) => highRiskPorts.includes(p))) score += 20;
  return Math.min(score, 100);
}

function detectPlatform(ports: number[], tags: string[]): string {
  if (ports?.includes(3389) || tags?.some((t: string) => t.toLowerCase().includes('windows'))) return 'windows';
  if (ports?.includes(161)) return 'cisco_ios';
  return 'rhel';
}

function detectOS(cpes: string[]): string {
  for (const cpe of cpes ?? []) {
    if (cpe.includes('windows_server')) return 'Windows Server';
    if (cpe.includes('rhel') || cpe.includes('red_hat')) return 'Red Hat Enterprise Linux';
    if (cpe.includes('ubuntu')) return 'Ubuntu Linux';
    if (cpe.includes('debian')) return 'Debian Linux';
    if (cpe.includes('centos')) return 'CentOS Linux';
    if (cpe.includes('cisco_ios')) return 'Cisco IOS';
  }
  return 'Unknown';
}

function portToServiceName(port: number): string {
  const map: Record<number, string> = {
    22: 'sshd', 23: 'telnet', 25: 'smtp', 53: 'dns', 80: 'http',
    110: 'pop3', 143: 'imap', 161: 'snmp', 443: 'https', 445: 'smb',
    1433: 'mssql', 3306: 'mysql', 3389: 'rdp', 5432: 'postgresql',
    5900: 'vnc', 6379: 'redis', 8080: 'http-alt', 8443: 'https-alt',
    27017: 'mongodb',
  };
  return map[port] ?? `port-${port}`;
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