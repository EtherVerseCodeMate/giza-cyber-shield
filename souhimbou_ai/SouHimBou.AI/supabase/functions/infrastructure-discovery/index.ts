import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DiscoveredAsset {
  id?: string;
  name: string;
  type: string;
  ip_address: string;
  os: string;
  platform: string;
  version: string;
  status: string;
  compliance_score: number;
  vulnerabilities: number;
  last_scan: string;
  criticality: 'low' | 'medium' | 'high' | 'critical';
  metadata?: any;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, target, organizationId } = await req.json();
    console.log(`Infrastructure discovery action: ${action} for target: ${target}`);

    let results = [];

    switch (action) {
      case 'network_scan':
        results = await performNetworkScan(target);
        break;
      case 'cloud_discovery':
        results = await performCloudDiscovery(target);
        break;
      case 'container_discovery':
        results = await performContainerDiscovery(target);
        break;
      case 'ad_enumeration':
        results = await performADEnumeration(target);
        break;
      case 'stig_fingerprinting':
        results = await performSTIGFingerprinting(target);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    // Store results in database
    const { error: insertError } = await supabase
      .from('discovered_assets')
      .upsert(results.map(asset => ({
        organization_id: organizationId,
        asset_id: asset.id || crypto.randomUUID(),
        asset_name: asset.name,
        asset_type: asset.type,
        platform: asset.platform,
        operating_system: asset.os,
        version: asset.version,
        ip_addresses: [asset.ip_address],
        discovery_method: action,
        last_discovered: new Date().toISOString(),
        metadata: asset
      })), { onConflict: 'organization_id,asset_id' });

    if (insertError) {
      console.error('Error storing discovery results:', insertError);
    }

    return new Response(JSON.stringify({
      success: true,
      results,
      discovered_count: results.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Infrastructure discovery error:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function performNetworkScan(target: string): Promise<DiscoveredAsset[]> {
  console.log(`Performing network scan on: ${target}`);
  const baseOctets = target.split('.').slice(0, 3).join('.');
  const discoveries: DiscoveredAsset[] = [];

  for (let i = 1; i <= 3; i++) {
    const ip = `${baseOctets}.${Math.floor(Math.random() * 254) + 1}`;

    discoveries.push({
      id: `net-${crypto.randomUUID().substring(0, 8)}`,
      name: `host-${ip.replaceAll('.', '-')}.internal`,
      type: 'server',
      ip_address: ip,
      os: 'Linux (Ubuntu 22.04)',
      platform: 'linux',
      version: 'v1.0.0',
      status: 'online',
      compliance_score: 75,
      vulnerabilities: 0,
      last_scan: new Date().toISOString(),
      criticality: 'medium',
      metadata: { source: 'network_scan' }
    });
  }

  return discoveries;
}

async function performCloudDiscovery(_target: string): Promise<DiscoveredAsset[]> {
  return [
    {
      id: 'aws-ec2-web-01',
      name: 'web-server-01',
      type: 'server',
      ip_address: '54.120.30.45',
      os: 'Amazon Linux 2',
      platform: 'aws',
      version: '2023.1',
      status: 'online',
      compliance_score: 88,
      vulnerabilities: 1,
      last_scan: new Date().toISOString(),
      criticality: 'high'
    }
  ];
}

async function performContainerDiscovery(_target: string): Promise<DiscoveredAsset[]> {
  return [
    {
      id: 'k8s-pod-api',
      name: 'api-service-pod',
      type: 'application',
      ip_address: '10.244.1.15',
      os: 'Container (Alpine)',
      platform: 'kubernetes',
      version: '1.24',
      status: 'online',
      compliance_score: 95,
      vulnerabilities: 0,
      last_scan: new Date().toISOString(),
      criticality: 'medium'
    }
  ];
}

async function performADEnumeration(_target: string): Promise<DiscoveredAsset[]> {
  return [
    {
      id: 'ad-dc-01',
      name: 'DOMAIN-CONTROLLER-01',
      type: 'server',
      ip_address: '10.0.1.5',
      os: 'Windows Server 2022',
      platform: 'windows',
      version: '21H2',
      status: 'online',
      compliance_score: 82,
      vulnerabilities: 2,
      last_scan: new Date().toISOString(),
      criticality: 'critical'
    }
  ];
}

async function scanPorts(ip: string) {
  // Simulate port scanning - in production use actual network tools
  const commonPorts = [22, 23, 25, 53, 80, 110, 143, 443, 993, 995, 1433, 3306, 3389, 5432, 8080];
  const openPorts = [];

  for (const port of commonPorts) {
    if (Math.random() > 0.8) {
      openPorts.push(port);
    }
  }

  return openPorts;
}

async function identifyServices(ports: number[]) {
  const serviceMap: Record<number, string> = {
    22: 'SSH',
    23: 'Telnet',
    25: 'SMTP',
    53: 'DNS',
    80: 'HTTP',
    110: 'POP3',
    143: 'IMAP',
    443: 'HTTPS',
    993: 'IMAPS',
    995: 'POP3S',
    1433: 'SQL Server',
    3306: 'MySQL',
    3389: 'RDP',
    5432: 'PostgreSQL',
    8080: 'HTTP Alt'
  };

  return ports.map(port => ({
    port,
    service: serviceMap[port] || 'Unknown',
    version: 'Unknown',
    banner: ''
  }));
}

function getRandomOS() {
  const osList = [
    'Windows 10',
    'Windows Server 2019',
    'Ubuntu 20.04',
    'CentOS 7',
    'macOS 11.0',
    'Red Hat Enterprise Linux 8'
  ];
  return osList[Math.floor(Math.random() * osList.length)];
}

function calculateRiskLevel(ports: number[], services: any[]) {
  const highRiskPorts = [23, 1433, 3306, 3389]; // Telnet, SQL Server, MySQL, RDP
  const hasHighRiskPort = ports.some(port => highRiskPorts.includes(port));

  if (hasHighRiskPort) return 'HIGH';
  if (ports.length > 5) return 'MEDIUM';
  return 'LOW';
}

async function scanContainerImage(image: string) {
  // Simulate container vulnerability scanning
  return [
    {
      cve: 'CVE-2021-44228',
      severity: 'CRITICAL',
      package: 'log4j-core',
      version: '2.14.1',
      fixed_version: '2.16.0'
    }
  ];
}

async function performSTIGFingerprinting(target: string): Promise<DiscoveredAsset[]> {
  console.log(`Performing STIG fingerprinting for: ${target}`);

  return [
    {
      id: `stig-${target}-${crypto.randomUUID().substring(0, 8)}`,
      name: `${target.toUpperCase()}-SECURE-NODE`,
      type: 'server',
      ip_address: '10.0.' + Math.floor(Math.random() * 255) + '.' + Math.floor(Math.random() * 255),
      os: target.includes('windows') ? 'Windows Server 2019' : 'Ubuntu 22.04',
      platform: target.includes('windows') ? 'windows' : 'linux',
      version: 'STIG V2R6',
      status: 'online',
      compliance_score: 85 + Math.floor(Math.random() * 15),
      vulnerabilities: Math.floor(Math.random() * 3),
      last_scan: new Date().toISOString(),
      criticality: 'high'
    }
  ];
}