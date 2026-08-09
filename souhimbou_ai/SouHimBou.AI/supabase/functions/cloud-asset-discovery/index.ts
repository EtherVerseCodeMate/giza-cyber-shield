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
  console.log('Discovering AWS assets via IAM role:', request.roleArn);

  if (!request.roleArn) {
    throw new Error(
      'roleArn is required for AWS discovery. ' +
      'Provide a cross-account IAM role ARN with ec2:DescribeInstances, rds:DescribeDBInstances permissions.'
    );
  }

  // Step 1: Assume the cross-account role via STS
  const stsResp = await fetch('https://sts.amazonaws.com/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      Action: 'AssumeRole',
      RoleArn: request.roleArn,
      RoleSessionName: 'SouHimBouDiscovery',
      ExternalId: request.externalId ?? '',
      Version: '2011-06-15',
    }),
  });
  if (!stsResp.ok) {
    const body = await stsResp.text();
    throw new Error(`AWS STS AssumeRole failed: ${stsResp.status} ${body}`);
  }
  const stsXml = await stsResp.text();
  const accessKeyMatch  = stsXml.match(/<AccessKeyId>(.*?)<\/AccessKeyId>/);
  const secretKeyMatch  = stsXml.match(/<SecretAccessKey>(.*?)<\/SecretAccessKey>/);
  const sessionTokMatch = stsXml.match(/<SessionToken>(.*?)<\/SessionToken>/);

  if (!accessKeyMatch || !secretKeyMatch || !sessionTokMatch) {
    throw new Error('AWS STS response did not contain expected credential fields');
  }

  const awsCreds = {
    accessKeyId:     accessKeyMatch[1],
    secretAccessKey: secretKeyMatch[1],
    sessionToken:    sessionTokMatch[1],
  };

  // Step 2: Enumerate EC2 instances across regions
  const regions = ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'];
  const assets: any[] = [];

  for (const region of regions) {
    try {
      const ec2Resp = await awsSignedRequest(
        `https://ec2.${region}.amazonaws.com/?Action=DescribeInstances&Version=2016-11-15`,
        'GET', region, 'ec2', awsCreds
      );
      if (!ec2Resp.ok) continue;
      const ec2Xml = await ec2Resp.text();

      // Parse instance IDs and IPs from XML response
      const instanceMatches = [...ec2Xml.matchAll(/<instanceId>(i-[a-f0-9]+)<\/instanceId>/g)];
      const ipMatches        = [...ec2Xml.matchAll(/<privateIpAddress>([\d.]+)<\/privateIpAddress>/g)];
      const typeMatches      = [...ec2Xml.matchAll(/<instanceType>([^<]+)<\/instanceType>/g)];
      const stateMatches     = [...ec2Xml.matchAll(/<name>(running|stopped|pending)<\/name>/g)];

      instanceMatches.forEach((m, idx) => {
        if (stateMatches[idx]?.[1] !== 'running') return; // Skip non-running
        assets.push({
          asset_type: 'ec2',
          asset_id: m[1],
          asset_name: m[1],
          region,
          platform: 'linux',
          os_type: 'Amazon Linux',
          os_version: 'unknown',
          ip_addresses: ipMatches[idx] ? [ipMatches[idx][1]] : [],
          configuration: {
            instanceType: typeMatches[idx]?.[1] ?? 'unknown',
            services: [],
          },
          tags: {},
          scan_method: 'aws_api',
        });
      });
    } catch (err) {
      console.warn(`EC2 discovery failed for region ${region}:`, err);
    }
  }

  if (assets.length === 0) {
    console.warn('AWS discovery returned 0 assets — verify IAM role permissions and region coverage');
  }

  return assets;
}

/** Minimal AWS SigV4 request signing for Deno (no SDK available). */
async function awsSignedRequest(
  url: string,
  method: string,
  region: string,
  service: string,
  creds: { accessKeyId: string; secretAccessKey: string; sessionToken: string }
): Promise<Response> {
  const now = new Date();
  const amzDate  = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const dateStamp = amzDate.slice(0, 8);

  const headers: Record<string, string> = {
    host:                 new URL(url).hostname,
    'x-amz-date':        amzDate,
    'x-amz-security-token': creds.sessionToken,
  };

  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.entries(headers).sort(([a],[b]) => a.localeCompare(b))
    .map(([k,v]) => `${k}:${v}\n`).join('');

  const payloadHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'; // SHA256('')
  const canonicalRequest = `${method}\n/\n${new URL(url).search.slice(1)}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const credScope   = `${dateStamp}/${region}/${service}/aws4_request`;
  const hashFn      = async (msg: string) => {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
  };
  const hmacFn = async (key: ArrayBuffer, msg: string) => {
    const k = await crypto.subtle.importKey('raw', key, { name:'HMAC', hash:'SHA-256'}, false, ['sign']);
    return crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg));
  };

  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credScope}\n${await hashFn(canonicalRequest)}`;

  let sigKey = await hmacFn(new TextEncoder().encode(`AWS4${creds.secretAccessKey}`), dateStamp);
  sigKey = await hmacFn(sigKey, region);
  sigKey = await hmacFn(sigKey, service);
  sigKey = await hmacFn(sigKey, 'aws4_request');

  const sigArray = await hmacFn(sigKey, stringToSign);
  const signature = Array.from(new Uint8Array(sigArray)).map(b => b.toString(16).padStart(2,'0')).join('');

  const authHeader = `AWS4-HMAC-SHA256 Credential=${creds.accessKeyId}/${credScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return fetch(url, {
    method,
    headers: { ...headers, Authorization: authHeader },
  });
}

async function discoverAzureAssets(request: DiscoveryRequest): Promise<any[]> {
  console.log('Discovering Azure assets for subscription:', request.subscriptionId);

  if (!request.tenantId || !request.clientId || !request.clientSecret || !request.subscriptionId) {
    throw new Error(
      'tenantId, clientId, clientSecret, and subscriptionId are required for Azure discovery. ' +
      'Create a Service Principal with Reader role on the subscription.'
    );
  }

  // Get OAuth2 token from Azure AD
  const tokenResp = await fetch(
    `https://login.microsoftonline.com/${request.tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: request.clientId,
        client_secret: request.clientSecret!,
        scope: 'https://management.azure.com/.default',
      }),
    }
  );
  if (!tokenResp.ok) throw new Error(`Azure token request failed: ${tokenResp.status} ${await tokenResp.text()}`);
  const tokenData = await tokenResp.json();
  const accessToken: string = tokenData.access_token;

  // List all VMs via ARM
  const vmResp = await fetch(
    `https://management.azure.com/subscriptions/${request.subscriptionId}/providers/Microsoft.Compute/virtualMachines?api-version=2023-07-01`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!vmResp.ok) throw new Error(`Azure VM list failed: ${vmResp.status} ${await vmResp.text()}`);
  const vmData = await vmResp.json();

  const assets: any[] = [];

  for (const vm of vmData.value ?? []) {
    // Get NIC IPs
    const nics = vm.properties?.networkProfile?.networkInterfaces ?? [];
    const ips: string[] = [];
    for (const nic of nics) {
      const nicId = nic.id;
      const nicResp = await fetch(
        `https://management.azure.com${nicId}?api-version=2023-09-01`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      ).catch(() => null);
      if (nicResp?.ok) {
        const nicData = await nicResp.json();
        for (const cfg of nicData.properties?.ipConfigurations ?? []) {
          const ip = cfg.properties?.privateIPAddress;
          if (ip) ips.push(ip);
        }
      }
    }

    assets.push({
      asset_type: 'vm',
      asset_id: vm.id,
      asset_name: vm.name,
      region: vm.location,
      platform: vm.properties?.storageProfile?.osDisk?.osType?.toLowerCase() ?? 'linux',
      os_type: vm.properties?.storageProfile?.imageReference?.offer ?? 'unknown',
      os_version: vm.properties?.storageProfile?.imageReference?.sku ?? 'unknown',
      ip_addresses: ips,
      configuration: {
        vmSize: vm.properties?.hardwareProfile?.vmSize,
        services: [],
      },
      tags: vm.tags ?? {},
      scan_method: 'azure_api',
    });
  }

  if (assets.length === 0) {
    console.warn('Azure discovery returned 0 VMs — verify Service Principal permissions');
  }

  return assets;
}

async function discoverGCPAssets(request: DiscoveryRequest): Promise<any[]> {
  console.log('Discovering GCP assets for project:', request.projectId);

  if (!request.projectId || !request.serviceAccountKey) {
    throw new Error(
      'projectId and serviceAccountKey are required for GCP discovery. ' +
      'Provide a Service Account JSON key with compute.instances.list permission.'
    );
  }

  // Get OAuth2 token using service account JWT
  const sa = request.serviceAccountKey;
  const now = Math.floor(Date.now() / 1000);
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).replace(/=/g, '');
  const payload = btoa(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })).replace(/=/g, '');

  const pemHeader = '-----BEGIN RSA PRIVATE KEY-----';
  const pemFooter = '-----END RSA PRIVATE KEY-----';
  const pemContents = sa.private_key
    .replace(pemHeader, '').replace(pemFooter, '')
    .replace(/\s/g, '');
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  const privateKey = await crypto.subtle.importKey(
    'pkcs8', binaryDer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']
  );
  const jwtInput = new TextEncoder().encode(`${header}.${payload}`);
  const sigBytes = await crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, privateKey, jwtInput);
  const signature = btoa(String.fromCharCode(...new Uint8Array(sigBytes))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const jwt = `${header}.${payload}.${signature}`;

  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  if (!tokenResp.ok) throw new Error(`GCP token failed: ${tokenResp.status} ${await tokenResp.text()}`);
  const tokenData = await tokenResp.json();
  const accessToken: string = tokenData.access_token;

  // List compute instances via GCP Compute API
  const computeResp = await fetch(
    `https://compute.googleapis.com/compute/v1/projects/${request.projectId}/aggregated/instances`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!computeResp.ok) throw new Error(`GCP compute list failed: ${computeResp.status} ${await computeResp.text()}`);
  const computeData = await computeResp.json();

  const assets: any[] = [];
  for (const [zone, zoneData] of Object.entries(computeData.items ?? {}) as any) {
    for (const instance of zoneData.instances ?? []) {
      if (instance.status !== 'RUNNING') continue;
      const ips: string[] = [];
      for (const ni of instance.networkInterfaces ?? []) {
        if (ni.networkIP) ips.push(ni.networkIP);
      }
      assets.push({
        asset_type: 'compute_instance',
        asset_id: `${instance.selfLink}`,
        asset_name: instance.name,
        region: zone.replace('zones/', ''),
        platform: 'linux',
        os_type: instance.disks?.[0]?.licenses?.join(',') ?? 'unknown',
        os_version: 'unknown',
        ip_addresses: ips,
        configuration: {
          machineType: instance.machineType?.split('/').pop(),
          services: [],
        },
        tags: instance.labels ?? {},
        scan_method: 'gcp_api',
      });
    }
  }

  return assets;
}

async function discoverOnPremAssets(request: DiscoveryRequest): Promise<any[]> {
  console.log('Discovering on-premises assets via Shodan InternetDB + TCP probing:', request.networkRanges);

  if (!request.networkRanges || request.networkRanges.length === 0) {
    throw new Error('networkRanges required for on-premises discovery (e.g. ["192.168.1.0/24"])');
  }

  const assets: any[] = [];

  for (const cidr of request.networkRanges) {
    // Expand CIDR to individual IPs (max /24 = 254 hosts)
    const ips = expandCIDR(cidr);
    if (ips.length > 254) {
      throw new Error(`CIDR ${cidr} expands to ${ips.length} hosts — limit to /24 or smaller`);
    }

    // Query Shodan InternetDB for each IP (no key required, rate-limited)
    const enrichResults = await Promise.allSettled(
      ips.map(async (ip) => {
        const resp = await fetch(`https://internetdb.shodan.io/${ip}`, {
          headers: { 'User-Agent': 'SouHimBou-Discovery/1.0' },
        });
        if (!resp.ok) return null;
        const data = await resp.json();
        if (!data.ports || data.ports.length === 0) return null; // No open ports = no host
        return {
          asset_type: 'server',
          asset_id: ip,
          asset_name: data.hostnames?.[0] ?? ip,
          region: 'on-premises',
          platform: detectPlatformFromPorts(data.ports, data.tags),
          os_type: detectOSFromCPEs(data.cpes),
          os_version: 'unknown',
          ip_addresses: [ip],
          configuration: {
            services: data.ports.map((p: number) => ({ port: p, protocol: 'tcp' })),
            cpes: data.cpes,
            threat_tags: data.tags,
            known_vulns: data.vulns,
          },
          tags: { discovery_method: 'shodan_internetdb', cidr },
          scan_method: 'network_scan',
        };
      })
    );

    for (const r of enrichResults) {
      if (r.status === 'fulfilled' && r.value !== null) {
        assets.push(r.value);
      }
    }
  }

  return assets;
}

/** Expand a CIDR notation string to an array of host IPs (e.g. 192.168.1.0/24 → 254 IPs). */
function expandCIDR(cidr: string): string[] {
  const [base, bits] = cidr.split('/');
  const prefix = parseInt(bits, 10);
  if (prefix < 16 || prefix > 30) throw new Error(`CIDR prefix /${prefix} out of allowed range [/16-/30]`);
  const [a,b,c,d] = base.split('.').map(Number);
  const baseNum = ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
  const hostBits = 32 - prefix;
  const count    = (1 << hostBits) - 2;
  const ips: string[] = [];
  for (let i = 1; i <= count; i++) {
    const n = (baseNum + i) >>> 0;
    ips.push(`${(n >> 24) & 255}.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`);
  }
  return ips;
}

function detectPlatformFromPorts(ports: number[], tags: string[]): string {
  if (ports.includes(3389) || tags.some(t => t.toLowerCase().includes('windows'))) return 'windows';
  if (ports.includes(161))  return 'network_device';
  return 'linux';
}

function detectOSFromCPEs(cpes: string[]): string {
  for (const cpe of cpes ?? []) {
    if (cpe.includes('windows_server')) return 'Windows Server';
    if (cpe.includes('windows'))        return 'Windows';
    if (cpe.includes('rhel') || cpe.includes('red_hat')) return 'RHEL';
    if (cpe.includes('ubuntu'))         return 'Ubuntu';
    if (cpe.includes('debian'))         return 'Debian';
    if (cpe.includes('centos'))         return 'CentOS';
    if (cpe.includes('cisco'))          return 'Cisco IOS';
  }
  return 'unknown';
}
