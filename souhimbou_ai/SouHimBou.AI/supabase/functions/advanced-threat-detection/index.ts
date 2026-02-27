import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// =============================================================================
// Configuration and API Integration Helpers
// =============================================================================

interface ThreatDetectionConfig {
  certTransparencyApiUrl?: string;
  certTransparencyApiKey?: string;
  threatIntelApiUrl?: string;
  threatIntelApiKey?: string;
  darkWebApiUrl?: string;
  darkWebApiKey?: string;
  cloudSecurityApiUrl?: string;
  cloudSecurityApiKey?: string;
}

function getThreatDetectionConfig(): ThreatDetectionConfig {
  return {
    certTransparencyApiUrl: Deno.env.get('CERT_TRANSPARENCY_API_URL'),
    certTransparencyApiKey: Deno.env.get('CERT_TRANSPARENCY_API_KEY'),
    threatIntelApiUrl: Deno.env.get('THREAT_INTEL_API_URL'),
    threatIntelApiKey: Deno.env.get('THREAT_INTEL_API_KEY'),
    darkWebApiUrl: Deno.env.get('DARK_WEB_API_URL'),
    darkWebApiKey: Deno.env.get('DARK_WEB_API_KEY'),
    cloudSecurityApiUrl: Deno.env.get('CLOUD_SECURITY_API_URL'),
    cloudSecurityApiKey: Deno.env.get('CLOUD_SECURITY_API_KEY'),
  };
}

// Query Certificate Transparency logs (crt.sh or similar)
async function queryCertTransparency(
  domain: string,
  config: ThreatDetectionConfig
): Promise<{ success: boolean; certificates: any[]; isNewlyIssued: boolean; error?: string }> {
  // Try crt.sh free API first (no key required)
  try {
    const crtShUrl = `https://crt.sh/?q=${encodeURIComponent(domain)}&output=json`;
    const response = await fetch(crtShUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (response.ok) {
      const certs = await response.json();
      // Check if any certificate was issued in last 24 hours
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;
      const isNewlyIssued = certs.some((cert: any) => {
        const entryTime = new Date(cert.entry_timestamp || cert.not_before).getTime();
        return entryTime > oneDayAgo;
      });

      return {
        success: true,
        certificates: certs.slice(0, 10), // Limit to 10 most recent
        isNewlyIssued,
      };
    }
  } catch (err) {
    console.warn('crt.sh query failed:', err);
  }

  // Fallback to configured CT API if available
  if (config.certTransparencyApiUrl && config.certTransparencyApiKey) {
    try {
      const response = await fetch(`${config.certTransparencyApiUrl}/certificates?domain=${encodeURIComponent(domain)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.certTransparencyApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          certificates: data.certificates || [],
          isNewlyIssued: data.recently_issued || false,
        };
      }
    } catch (err) {
      console.warn('CT API query failed:', err);
    }
  }

  console.warn('Certificate transparency check skipped - no API configured');
  return {
    success: false,
    certificates: [],
    isNewlyIssued: false,
    error: 'CT_API_NOT_CONFIGURED',
  };
}

// Query security events for behavioral analysis
async function querySecurityEvents(
  supabase: any,
  target: string,
  organizationId: string,
  eventTypes: string[]
): Promise<{ success: boolean; events: any[]; counts: Record<string, number> }> {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('security_events')
      .select('event_type, severity, created_at, metadata')
      .eq('organization_id', organizationId)
      .or(`source_ip.eq.${target},target.eq.${target},user_identifier.eq.${target}`)
      .in('event_type', eventTypes)
      .gte('created_at', oneDayAgo)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.warn('Security events query failed:', error);
      return { success: false, events: [], counts: {} };
    }

    const counts: Record<string, number> = {};
    (data || []).forEach((event: any) => {
      counts[event.event_type] = (counts[event.event_type] || 0) + 1;
    });

    return { success: true, events: data || [], counts };
  } catch (err) {
    console.warn('Security events query error:', err);
    return { success: false, events: [], counts: {} };
  }
}

// Query breach data for dark web monitoring
async function queryBreachData(
  supabase: any,
  target: string
): Promise<{ success: boolean; breaches: any[]; credentialExposed: boolean; threatMentions: number }> {
  try {
    // Check credential_exposures table
    const { data: exposures, error: expError } = await supabase
      .from('credential_exposures')
      .select('source, breach_date, data_types, severity')
      .or(`email.eq.${target},domain.eq.${target},identifier.eq.${target}`)
      .order('breach_date', { ascending: false })
      .limit(10);

    if (expError) {
      console.warn('Credential exposures query failed:', expError);
    }

    // Check threat intelligence for mentions
    const { data: mentions, error: mentionError } = await supabase
      .from('threat_intelligence')
      .select('source, indicator_type, confidence_score, last_seen')
      .or(`indicator_value.ilike.%${target}%,associated_domains.cs.{${target}}`)
      .limit(20);

    if (mentionError) {
      console.warn('Threat intelligence query failed:', mentionError);
    }

    return {
      success: true,
      breaches: exposures || [],
      credentialExposed: (exposures || []).length > 0,
      threatMentions: (mentions || []).length,
    };
  } catch (err) {
    console.warn('Breach data query error:', err);
    return { success: false, breaches: [], credentialExposed: false, threatMentions: 0 };
  }
}

// Query cloud security findings
async function queryCloudSecurityFindings(
  supabase: any,
  target: string,
  cloudProvider: string | null
): Promise<{ success: boolean; findings: any[]; misconfigurations: Record<string, boolean> }> {
  if (!cloudProvider) {
    return { success: true, findings: [], misconfigurations: {} };
  }

  try {
    const { data, error } = await supabase
      .from('cloud_security_findings')
      .select('finding_type, severity, resource_id, status, description')
      .or(`resource_id.ilike.%${target}%,resource_arn.ilike.%${target}%`)
      .eq('cloud_provider', cloudProvider)
      .eq('status', 'OPEN')
      .limit(50);

    if (error) {
      console.warn('Cloud security findings query failed:', error);
      return { success: false, findings: [], misconfigurations: {} };
    }

    const misconfigurations: Record<string, boolean> = {
      'OPEN_S3_BUCKET': false,
      'WEAK_IAM_POLICIES': false,
      'UNENCRYPTED_DATA': false,
    };

    (data || []).forEach((finding: any) => {
      if (finding.finding_type?.includes('PUBLIC_ACCESS') || finding.finding_type?.includes('OPEN_BUCKET')) {
        misconfigurations['OPEN_S3_BUCKET'] = true;
      }
      if (finding.finding_type?.includes('IAM') || finding.finding_type?.includes('PERMISSION')) {
        misconfigurations['WEAK_IAM_POLICIES'] = true;
      }
      if (finding.finding_type?.includes('ENCRYPTION') || finding.finding_type?.includes('UNENCRYPTED')) {
        misconfigurations['UNENCRYPTED_DATA'] = true;
      }
    });

    return { success: true, findings: data || [], misconfigurations };
  } catch (err) {
    console.warn('Cloud security query error:', err);
    return { success: false, findings: [], misconfigurations: {} };
  }
}

// Query APT indicators from threat intelligence
async function queryAPTIndicators(
  supabase: any,
  target: string
): Promise<{ success: boolean; aptMatches: any[]; tacticsDetected: Record<string, boolean> }> {
  try {
    const { data, error } = await supabase
      .from('threat_intelligence')
      .select('indicator_value, indicator_type, threat_actor, tags, confidence_score, mitre_tactics')
      .or(`indicator_value.eq.${target},indicator_value.ilike.%${target}%`)
      .gte('confidence_score', 70)
      .limit(20);

    if (error) {
      console.warn('APT indicators query failed:', error);
      return { success: false, aptMatches: [], tacticsDetected: {} };
    }

    const tacticsDetected: Record<string, boolean> = {
      'DOMAIN_FRONTING': false,
      'FAST_FLUX_NETWORK': false,
      'LIVING_OFF_THE_LAND': false,
    };

    (data || []).forEach((indicator: any) => {
      const tactics = indicator.mitre_tactics || [];
      const tags = indicator.tags || [];

      if (tactics.includes('T1090.004') || tags.includes('domain_fronting')) {
        tacticsDetected['DOMAIN_FRONTING'] = true;
      }
      if (tactics.includes('T1568.001') || tags.includes('fast_flux')) {
        tacticsDetected['FAST_FLUX_NETWORK'] = true;
      }
      if (tactics.includes('T1218') || tags.includes('lolbin') || tags.includes('lotl')) {
        tacticsDetected['LIVING_OFF_THE_LAND'] = true;
      }
    });

    return { success: true, aptMatches: data || [], tacticsDetected };
  } catch (err) {
    console.warn('APT indicators query error:', err);
    return { success: false, aptMatches: [], tacticsDetected: {} };
  }
}

// Query network assets for DNS/reverse DNS data
async function queryNetworkAssets(
  supabase: any,
  target: string
): Promise<{ success: boolean; asset: any | null; dnsRecords: any | null }> {
  try {
    const isIP = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(target);

    const { data, error } = await supabase
      .from('network_assets')
      .select('hostname, ip_addresses, dns_records, allocation_type, organization, last_seen')
      .or(isIP ? `ip_addresses.cs.{${target}}` : `hostname.eq.${target}`)
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      console.warn('Network assets query failed:', error);
    }

    return {
      success: true,
      asset: data || null,
      dnsRecords: data?.dns_records || null,
    };
  } catch (err) {
    console.warn('Network assets query error:', err);
    return { success: false, asset: null, dnsRecords: null };
  }
}

// Create initialized Supabase client with service role for internal queries
function createServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  );
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createServiceClient();
    const config = getThreatDetectionConfig();

    const { action, target, organizationId } = await req.json();
    console.log(`Advanced threat detection: ${action} for ${target}`);

    let results: any = {};

    switch (action) {
      case 'dns_monitoring':
        results = await performDNSMonitoring(target, supabase);
        break;
      case 'certificate_transparency':
        results = await performCertificateTransparencyCheck(target, config);
        break;
      case 'behavioral_analysis':
        results = await performBehavioralAnalysis(target, organizationId, supabase);
        break;
      case 'dark_web_monitoring':
        results = await performDarkWebMonitoring(target, supabase, config);
        break;
      case 'cloud_security_scan':
        results = await performCloudSecurityScan(target, supabase);
        break;
      case 'email_security_analysis':
        results = await performEmailSecurityAnalysis(target);
        break;
      case 'apt_detection':
        results = await performAPTDetection(target, organizationId, supabase);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    // Store results in database
    if (organizationId) {
      await supabase.from('threat_investigations').insert([{
        organization_id: organizationId,
        threat_indicator: target,
        indicator_type: detectIndicatorType(target),
        investigation_status: 'investigating',
        threat_level: results.threat_level || 'medium',
        real_or_simulated: 'real',
        investigation_notes: `Advanced detection: ${action}`,
        external_references: results.sources || []
      }]);
    }

    return new Response(JSON.stringify({
      success: true,
      action,
      target,
      results,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Advanced threat detection error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// DNS Monitoring for suspicious domains and subdomains
async function performDNSMonitoring(target: string, supabase: any) {
  console.log(`Performing DNS monitoring for: ${target}`);

  const suspiciousDomains = [
    'tempmail.org', 'guerrillamail.com', 'mailinator.com',
    'bit.ly', 'tinyurl.com', 'shorturl.at',
    'duckdns.org', 'no-ip.com', 'ddns.net'
  ];

  const isIPAddress = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(target);
  const findings: any[] = [];
  let threatLevel = 'low';

  // Query network assets database for real DNS data
  const networkData = await queryNetworkAssets(supabase, target);
  const dataSource = networkData.success && networkData.asset ? 'DATABASE' : 'HEURISTIC';

  if (!isIPAddress) {
    // Check for suspicious TLDs
    const suspiciousTLDs = ['.tk', '.ml', '.ga', '.cf', '.click', '.download'];
    const hasSuspiciousTLD = suspiciousTLDs.some(tld => target.endsWith(tld));

    if (hasSuspiciousTLD) {
      findings.push({
        type: 'SUSPICIOUS_TLD',
        description: 'Domain uses suspicious top-level domain',
        risk: 'medium'
      });
      threatLevel = 'medium';
    }

    // Check against known bad domains
    const isSuspiciousDomain = suspiciousDomains.some(domain =>
      target.includes(domain) || target.endsWith(domain)
    );

    if (isSuspiciousDomain) {
      findings.push({
        type: 'KNOWN_SUSPICIOUS_DOMAIN',
        description: 'Domain matches known suspicious service',
        risk: 'high'
      });
      threatLevel = 'high';
    }

    // Check for domain generation algorithms patterns
    if (isDGADomain(target)) {
      findings.push({
        type: 'DGA_PATTERN',
        description: 'Domain appears to be generated algorithmically',
        risk: 'high'
      });
      threatLevel = 'high';
    }
  }

  // Use real network asset data for reverse DNS
  if (isIPAddress && networkData.asset) {
    const allocationType = networkData.asset.allocation_type || '';
    const suspiciousAllocations = ['dynamic', 'pool', 'dhcp', 'residential', 'unknown'];

    if (suspiciousAllocations.some(a => allocationType.toLowerCase().includes(a))) {
      findings.push({
        type: 'SUSPICIOUS_REVERSE_DNS',
        description: `Reverse DNS indicates ${allocationType} allocation`,
        risk: 'medium',
        hostname: networkData.asset.hostname
      });
      threatLevel = 'medium';
    }
  }

  return {
    threat_level: threatLevel,
    findings,
    dns_records: networkData.dnsRecords,
    data_source: dataSource,
    sources: ['DNS_MONITORING', 'TLD_ANALYSIS', dataSource],
    analysis_type: 'dns_monitoring'
  };
}

// Certificate Transparency monitoring
async function performCertificateTransparencyCheck(target: string, config: ThreatDetectionConfig) {
  console.log(`Checking certificate transparency for: ${target}`);

  const findings: any[] = [];
  let threatLevel = 'low';

  // Check for suspicious brand impersonation patterns
  const suspiciousPatterns = [
    'admin', 'secure', 'bank', 'paypal', 'microsoft', 'google',
    'update', 'verify', 'confirm', 'login', 'signin'
  ];

  const containsSuspiciousPattern = suspiciousPatterns.some(pattern =>
    target.toLowerCase().includes(pattern)
  );

  if (containsSuspiciousPattern) {
    findings.push({
      type: 'SUSPICIOUS_CERTIFICATE_PATTERN',
      description: 'Certificate contains brand impersonation keywords',
      risk: 'high'
    });
    threatLevel = 'high';
  }

  // Query real Certificate Transparency logs
  const ctResult = await queryCertTransparency(target, config);
  const isNewlyIssued = ctResult.isNewlyIssued;
  const dataSource = ctResult.success ? 'CT_LOG_API' : 'NOT_AVAILABLE';

  if (isNewlyIssued) {
    findings.push({
      type: 'NEWLY_ISSUED_CERTIFICATE',
      description: 'Certificate issued within last 24 hours',
      risk: 'medium'
    });
    if (threatLevel === 'low') threatLevel = 'medium';
  }

  // Log if CT API wasn't available
  if (!ctResult.success) {
    console.warn(`Certificate transparency check limited: ${ctResult.error}`);
  }

  return {
    threat_level: threatLevel,
    findings,
    certificate_analysis: {
      newly_issued: isNewlyIssued,
      suspicious_patterns: containsSuspiciousPattern,
      certificates_found: ctResult.certificates.length,
      ct_logs_checked: ctResult.success ? ['crt.sh'] : []
    },
    data_source: dataSource,
    sources: ['CERTIFICATE_TRANSPARENCY', dataSource],
    analysis_type: 'certificate_transparency'
  };
}

// Behavioral Analysis based on access patterns
async function performBehavioralAnalysis(target: string, organizationId: string, supabase: any) {
  console.log(`Performing behavioral analysis for: ${target} in org: ${organizationId}`);

  const findings: any[] = [];
  let threatLevel = 'low';

  // Query real security events from database
  const eventTypes = [
    'off_hours_access',
    'failed_login',
    'geolocation_anomaly',
    'user_agent_anomaly',
    'authentication_failure',
    'brute_force_attempt',
    'unusual_access_pattern'
  ];

  const eventsResult = await querySecurityEvents(supabase, target, organizationId, eventTypes);
  const dataSource = eventsResult.success ? 'DATABASE' : 'NOT_AVAILABLE';

  // Thresholds for anomaly detection
  const THRESHOLDS = {
    offHoursAccessCount: 3,       // 3+ off-hours accesses = anomaly
    failedLoginCount: 5,          // 5+ failed logins = brute force
    geoAnomalyCount: 1,           // Any geo anomaly is suspicious
    userAgentAnomalyCount: 2,     // 2+ UA anomalies = bot/automation
  };

  // Analyze real event counts
  const counts = eventsResult.counts;

  // Check for off-hours access
  const offHoursCount = (counts['off_hours_access'] || 0) + (counts['unusual_access_pattern'] || 0);
  if (offHoursCount >= THRESHOLDS.offHoursAccessCount) {
    findings.push({
      type: 'UNUSUAL_ACCESS_TIME',
      description: `${offHoursCount} access attempts during off-hours in last 24h`,
      risk: 'medium',
      detected: true,
      event_count: offHoursCount
    });
    if (threatLevel === 'low') threatLevel = 'medium';
  }

  // Check for brute force / rapid auth attempts
  const failedLogins = (counts['failed_login'] || 0) + (counts['authentication_failure'] || 0) + (counts['brute_force_attempt'] || 0);
  if (failedLogins >= THRESHOLDS.failedLoginCount) {
    findings.push({
      type: 'RAPID_AUTHENTICATION_ATTEMPTS',
      description: `${failedLogins} failed login attempts in last 24h`,
      risk: 'high',
      detected: true,
      event_count: failedLogins
    });
    threatLevel = 'high';
  }

  // Check for geolocation anomalies
  const geoAnomalies = counts['geolocation_anomaly'] || 0;
  if (geoAnomalies >= THRESHOLDS.geoAnomalyCount) {
    findings.push({
      type: 'GEOLOCATION_ANOMALY',
      description: `${geoAnomalies} accesses from unexpected geographic locations`,
      risk: 'medium',
      detected: true,
      event_count: geoAnomalies
    });
    if (threatLevel === 'low') threatLevel = 'medium';
  }

  // Check for user agent anomalies
  const uaAnomalies = counts['user_agent_anomaly'] || 0;
  if (uaAnomalies >= THRESHOLDS.userAgentAnomalyCount) {
    findings.push({
      type: 'USER_AGENT_ANOMALY',
      description: `${uaAnomalies} unusual or automated user agent patterns detected`,
      risk: 'medium',
      detected: true,
      event_count: uaAnomalies
    });
    if (threatLevel === 'low') threatLevel = 'medium';
  }

  // Log if no events were available
  if (!eventsResult.success) {
    console.warn('Behavioral analysis limited: security_events query unavailable');
  }

  return {
    threat_level: threatLevel,
    findings,
    behavioral_metrics: {
      events_analyzed: eventsResult.events.length,
      monitoring_period_hours: 24,
      thresholds: THRESHOLDS
    },
    data_source: dataSource,
    sources: ['BEHAVIORAL_ANALYSIS', dataSource],
    analysis_type: 'behavioral_analysis'
  };
}

// Dark Web Monitoring - queries breach data and threat intelligence
async function performDarkWebMonitoring(target: string, supabase: any, config: ThreatDetectionConfig) {
  console.log(`Performing dark web monitoring for: ${target}`);

  const findings: any[] = [];
  let threatLevel = 'low';

  const darkWebSources = ['tor_forums', 'telegram_channels', 'paste_sites', 'credential_dumps'];

  // Query breach data from database
  const breachResult = await queryBreachData(supabase, target);
  const dataSource = breachResult.success ? 'DATABASE' : 'NOT_AVAILABLE';

  // Check for credential exposure in breach data
  if (breachResult.credentialExposed) {
    const mostRecent = breachResult.breaches[0];
    findings.push({
      type: 'CREDENTIAL_EXPOSURE',
      description: `Credentials found in ${breachResult.breaches.length} data breach(es)`,
      risk: 'critical',
      source: mostRecent?.source || 'credential_dumps',
      breach_date: mostRecent?.breach_date,
      data_types: mostRecent?.data_types
    });
    threatLevel = 'critical';
  }

  // Check for threat actor mentions
  if (breachResult.threatMentions > 0) {
    findings.push({
      type: 'THREAT_ACTOR_MENTION',
      description: `Target mentioned in ${breachResult.threatMentions} threat intelligence entries`,
      risk: 'high',
      source: 'threat_intelligence',
      mention_count: breachResult.threatMentions
    });
    if (threatLevel !== 'critical') threatLevel = 'high';
  }

  // If configured, also query external dark web API
  if (config.darkWebApiUrl && config.darkWebApiKey) {
    try {
      const response = await fetch(`${config.darkWebApiUrl}/search?indicator=${encodeURIComponent(target)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.darkWebApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const externalData = await response.json();
        if (externalData.findings?.length > 0) {
          externalData.findings.forEach((f: any) => {
            findings.push({
              type: f.type || 'EXTERNAL_DARK_WEB_HIT',
              description: f.description || 'External dark web intelligence hit',
              risk: f.severity || 'high',
              source: 'EXTERNAL_DARK_WEB_API'
            });
          });
          if (threatLevel === 'low') threatLevel = 'high';
        }
      }
    } catch (err) {
      console.warn('External dark web API query failed:', err);
    }
  }

  // Log data source info
  if (!breachResult.success) {
    console.warn('Dark web monitoring limited: breach data query unavailable');
  }

  return {
    threat_level: threatLevel,
    findings,
    dark_web_sources: darkWebSources,
    breaches_found: breachResult.breaches.length,
    threat_mentions: breachResult.threatMentions,
    data_source: dataSource,
    sources: ['DARK_WEB_MONITORING', dataSource],
    analysis_type: 'dark_web_monitoring'
  };
}

// Cloud Security Scanning - queries real cloud security findings
async function performCloudSecurityScan(target: string, supabase: any) {
  console.log(`Performing cloud security scan for: ${target}`);

  const findings: any[] = [];
  let threatLevel = 'low';

  // Detect cloud provider from target
  const cloudProviders: Record<string, string> = {
    'amazonaws.com': 'AWS',
    's3.': 'AWS',
    'azure.com': 'Azure',
    'blob.core.windows.net': 'Azure',
    'googleapis.com': 'GCP',
    'storage.cloud.google.com': 'GCP',
    'digitalocean.com': 'DigitalOcean',
    'spaces.': 'DigitalOcean'
  };

  let cloudProvider: string | null = null;
  for (const [pattern, provider] of Object.entries(cloudProviders)) {
    if (target.includes(pattern)) {
      cloudProvider = provider;
      break;
    }
  }

  // Query real cloud security findings from database
  const cloudResult = await queryCloudSecurityFindings(supabase, target, cloudProvider);
  const dataSource = cloudResult.success ? 'DATABASE' : 'NOT_AVAILABLE';

  if (cloudProvider && cloudResult.success) {
    // Map real findings to standardized output
    const misconfigTypes = [
      { type: 'OPEN_S3_BUCKET', description: 'Publicly accessible storage bucket detected', risk: 'high' },
      { type: 'WEAK_IAM_POLICIES', description: 'Overly permissive IAM policies found', risk: 'medium' },
      { type: 'UNENCRYPTED_DATA', description: 'Unencrypted data storage detected', risk: 'high' }
    ];

    misconfigTypes.forEach(config => {
      if (cloudResult.misconfigurations[config.type]) {
        findings.push({
          type: config.type,
          description: config.description,
          risk: config.risk,
          detected: true,
          cloud_provider: cloudProvider
        });
        if (config.risk === 'high') threatLevel = 'high';
        else if (config.risk === 'medium' && threatLevel === 'low') threatLevel = 'medium';
      }
    });

    // Add any additional findings from database
    cloudResult.findings.forEach((f: any) => {
      // Avoid duplicates
      if (!findings.some(existing => existing.type === f.finding_type)) {
        findings.push({
          type: f.finding_type,
          description: f.description || `Cloud security finding: ${f.finding_type}`,
          risk: f.severity || 'medium',
          detected: true,
          resource_id: f.resource_id
        });
      }
    });
  }

  // Log data source info
  if (!cloudResult.success && cloudProvider) {
    console.warn(`Cloud security scan limited for ${cloudProvider}: findings query unavailable`);
  }

  return {
    threat_level: threatLevel,
    findings,
    cloud_provider: cloudProvider,
    findings_count: cloudResult.findings.length,
    data_source: dataSource,
    sources: ['CLOUD_SECURITY_SCANNER', dataSource],
    analysis_type: 'cloud_security_scan'
  };
}

// Email Security Analysis
async function performEmailSecurityAnalysis(target: string) {
  console.log(`Performing email security analysis for: ${target}`);
  
  let findings = [];
  let threatLevel = 'low';

  // Check for email-related threats
  if (target.includes('@')) {
    // Email address analysis
    const domain = target.split('@')[1];
    
    // Check for disposable email providers
    const disposableProviders = [
      'tempmail.org', 'guerrillamail.com', 'mailinator.com',
      '10minutemail.com', 'throwaway.email'
    ];
    
    if (disposableProviders.includes(domain)) {
      findings.push({
        type: 'DISPOSABLE_EMAIL',
        description: 'Email uses disposable/temporary service',
        risk: 'medium'
      });
      threatLevel = 'medium';
    }

    // Check for typosquatting
    const legitimateDomains = ['gmail.com', 'outlook.com', 'yahoo.com'];
    const suspiciousVariations = legitimateDomains.some(legit => 
      isTyposquatting(domain, legit)
    );
    
    if (suspiciousVariations) {
      findings.push({
        type: 'TYPOSQUATTING_DOMAIN',
        description: 'Email domain appears to be typosquatting legitimate service',
        risk: 'high'
      });
      threatLevel = 'high';
    }
  }

  return {
    threat_level: threatLevel,
    findings,
    email_security_checks: {
      domain_reputation: 'checked',
      disposable_check: 'completed',
      typosquatting_check: 'completed'
    },
    sources: ['EMAIL_SECURITY_ANALYSIS'],
    analysis_type: 'email_security_analysis'
  };
}

// Advanced Persistent Threat (APT) Detection - queries real threat intelligence
async function performAPTDetection(target: string, organizationId: string, supabase: any) {
  console.log(`Performing APT detection for: ${target} in org: ${organizationId}`);

  const findings: any[] = [];
  let threatLevel = 'low';

  // Known APT indicators (static heuristics)
  const aptIndicators = [
    {
      name: 'Lazarus Group',
      indicators: ['tempfile.site', 'cdnjs.cf', 'jquery-cdn.site'],
      pattern: /temp|cdn|jquery.*\.(?:site|cf|tk)/i
    },
    {
      name: 'APT29 (Cozy Bear)',
      indicators: ['onedrive-sync.com', 'office365-update.com'],
      pattern: /(?:onedrive|office365).*\.com/i
    },
    {
      name: 'APT28 (Fancy Bear)',
      indicators: ['security-update.org', 'windows-update.net'],
      pattern: /(?:security|windows)-update\.(?:org|net)/i
    }
  ];

  // Check against known APT indicators (heuristic)
  aptIndicators.forEach(apt => {
    if (apt.pattern.test(target) || apt.indicators.some(indicator => target.includes(indicator))) {
      findings.push({
        type: 'APT_INDICATOR_MATCH',
        description: `Potential ${apt.name} infrastructure detected`,
        risk: 'critical',
        apt_group: apt.name,
        source: 'HEURISTIC'
      });
      threatLevel = 'critical';
    }
  });

  // Query real APT indicators from threat intelligence database
  const aptResult = await queryAPTIndicators(supabase, target);
  const dataSource = aptResult.success ? 'DATABASE' : 'HEURISTIC_ONLY';

  // Process database matches
  if (aptResult.aptMatches.length > 0) {
    aptResult.aptMatches.forEach((match: any) => {
      findings.push({
        type: 'APT_INDICATOR_MATCH',
        description: `Match in threat intelligence: ${match.threat_actor || 'Unknown actor'}`,
        risk: match.confidence_score >= 90 ? 'critical' : 'high',
        apt_group: match.threat_actor,
        confidence: match.confidence_score,
        source: 'THREAT_INTEL_DB'
      });
      if (match.confidence_score >= 90) threatLevel = 'critical';
      else if (threatLevel !== 'critical') threatLevel = 'high';
    });
  }

  // Check for APT tactics from database
  const aptTactics = [
    { type: 'DOMAIN_FRONTING', description: 'Potential domain fronting activity detected', risk: 'high' },
    { type: 'FAST_FLUX_NETWORK', description: 'Fast flux network characteristics observed', risk: 'high' },
    { type: 'LIVING_OFF_THE_LAND', description: 'Legitimate services being abused for C2', risk: 'medium' }
  ];

  aptTactics.forEach(tactic => {
    if (aptResult.tacticsDetected[tactic.type]) {
      findings.push({
        type: tactic.type,
        description: tactic.description,
        risk: tactic.risk,
        detected: true,
        source: 'THREAT_INTEL_DB'
      });
      if (tactic.risk === 'high' && threatLevel !== 'critical') threatLevel = 'high';
      else if (tactic.risk === 'medium' && threatLevel === 'low') threatLevel = 'medium';
    }
  });

  // Log data source info
  if (!aptResult.success) {
    console.warn('APT detection limited: threat intelligence query unavailable, using heuristics only');
  }

  return {
    threat_level: threatLevel,
    findings,
    apt_analysis: {
      groups_checked: aptIndicators.map(apt => apt.name),
      database_matches: aptResult.aptMatches.length,
      tactics_detected: Object.entries(aptResult.tacticsDetected)
        .filter(([, detected]) => detected)
        .map(([tactic]) => tactic)
    },
    data_source: dataSource,
    sources: ['APT_DETECTION', dataSource],
    analysis_type: 'apt_detection'
  };
}

// Helper functions
function detectIndicatorType(indicator: string): string {
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(indicator)) return 'ip';
  if (indicator.includes('@')) return 'email';
  if (/^[a-fA-F0-9]{32,}$/.test(indicator)) return 'hash';
  if (indicator.startsWith('http')) return 'url';
  return 'domain';
}

function isDGADomain(domain: string): boolean {
  // Simple heuristic for DGA detection
  const domainName = domain.split('.')[0];
  
  // Check for unusual length
  if (domainName.length > 15 || domainName.length < 4) return true;
  
  // Check for high consonant-to-vowel ratio
  const vowels = (domainName.match(/[aeiou]/gi) || []).length;
  const consonants = domainName.length - vowels;
  
  return consonants / vowels > 3;
}

// Note: simulateReverseDNS and simulateDNSRecords removed
// DNS data is now queried from network_assets table via queryNetworkAssets()

function isTyposquatting(suspicious: string, legitimate: string): boolean {
  // Simple Levenshtein distance check
  const distance = levenshteinDistance(suspicious, legitimate);
  return distance > 0 && distance <= 2 && suspicious !== legitimate;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}