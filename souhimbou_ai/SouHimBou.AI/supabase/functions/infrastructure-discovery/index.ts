import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? ''
);

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
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    // Store results in database
    const { error: insertError } = await supabase
      .from('infrastructure_assets')
      .insert({
        organization_id: organizationId,
        asset_type: action,
        target: target,
        discovery_results: results,
        discovered_at: new Date().toISOString()
      });

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

  } catch (error) {
    console.error('Infrastructure discovery error:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function performNetworkScan(target: string) {
  console.log(`Performing network scan on: ${target}`);
  
  // Simulate Nmap-style network discovery
  // In production, this would integrate with actual network scanning tools
  const baseOctets = target.split('.').slice(0, 3).join('.');
  const discoveries = [];
  
  // Simulate discovering active hosts
  for (let i = 1; i <= 254; i++) {
    const ip = `${baseOctets}.${i}`;
    
    // Simulate random discovery (in production, use actual ping/port scan)
    if (Math.random() > 0.7) {
      const ports = await scanPorts(ip);
      const services = await identifyServices(ports);
      
      discoveries.push({
        ip_address: ip,
        hostname: `host-${i}.local`,
        open_ports: ports,
        services: services,
        os_fingerprint: getRandomOS(),
        last_seen: new Date().toISOString(),
        risk_level: calculateRiskLevel(ports, services)
      });
    }
  }
  
  return discoveries;
}

async function performCloudDiscovery(target: string) {
  console.log(`Performing cloud discovery for: ${target}`);
  
  // In production, this would use AWS/Azure/GCP APIs
  const cloudAssets = [
    {
      provider: 'AWS',
      region: 'us-east-1',
      resource_type: 'EC2',
      resource_id: 'i-0123456789abcdef0',
      name: 'web-server-01',
      status: 'running',
      security_groups: ['sg-web', 'sg-ssh'],
      tags: { Environment: 'production', Team: 'devops' },
      compliance_status: 'compliant'
    },
    {
      provider: 'Azure',
      region: 'East US',
      resource_type: 'Virtual Machine',
      resource_id: '/subscriptions/xxx/resourceGroups/rg-prod/providers/Microsoft.Compute/virtualMachines/db-server',
      name: 'db-server-01',
      status: 'running',
      network_security_groups: ['nsg-database'],
      tags: { Environment: 'production', DataClassification: 'sensitive' },
      compliance_status: 'non-compliant'
    }
  ];
  
  return cloudAssets;
}

async function performContainerDiscovery(target: string) {
  console.log(`Performing container discovery for: ${target}`);
  
  // In production, this would integrate with Docker/Kubernetes APIs
  const containers = [
    {
      platform: 'Docker',
      container_id: 'abc123def456',
      image: 'nginx:1.21',
      status: 'running',
      ports: ['80:8080', '443:8443'],
      volumes: ['/data:/app/data'],
      environment_vars: ['ENV=production'],
      security_context: { privileged: false, user: 'nginx' },
      vulnerabilities: await scanContainerImage('nginx:1.21')
    },
    {
      platform: 'Kubernetes',
      namespace: 'production',
      pod_name: 'api-deployment-7d8b9c456-xyz12',
      image: 'myapp:v1.2.3',
      status: 'running',
      node: 'worker-node-01',
      security_context: { runAsNonRoot: true, readOnlyRootFilesystem: true },
      vulnerabilities: await scanContainerImage('myapp:v1.2.3')
    }
  ];
  
  return containers;
}

async function performADEnumeration(target: string) {
  console.log(`Performing Active Directory enumeration for: ${target}`);
  
  // In production, this would use LDAP queries or AD APIs
  const adObjects = [
    {
      type: 'User',
      dn: 'CN=John Doe,OU=Users,DC=company,DC=com',
      samAccountName: 'jdoe',
      userPrincipalName: 'jdoe@company.com',
      groups: ['Domain Users', 'IT Admins', 'VPN Users'],
      lastLogon: new Date(Date.now() - 86400000).toISOString(),
      passwordLastSet: new Date(Date.now() - 7776000000).toISOString(),
      accountStatus: 'enabled',
      privileges: ['SeServiceLogonRight', 'SeRemoteInteractiveLogonRight']
    },
    {
      type: 'Computer',
      dn: 'CN=WORKSTATION01,CN=Computers,DC=company,DC=com',
      samAccountName: 'WORKSTATION01$',
      operatingSystem: 'Windows 10 Enterprise',
      lastLogon: new Date(Date.now() - 3600000).toISOString(),
      servicePrincipalNames: ['HOST/workstation01.company.com'],
      accountStatus: 'enabled'
    }
  ];
  
  return adObjects;
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