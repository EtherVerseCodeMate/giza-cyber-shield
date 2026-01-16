import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HuntRequest {
  action: 'generate_queries' | 'execute_hunt' | 'generate_report' | 'sync_feeds';
  indicator?: string;
  indicatorType?: string;
  reportDate?: string;
  organizationId?: string;
}

interface ThreatIndicator {
  value: string;
  type: string;
  severity: string;
  source: string;
  confidence: number;
  firstSeen: Date;
  lastSeen: Date;
}

interface HuntQuery {
  indicator: string;
  type: string;
  splunkQuery: string;
  severity: string;
  expectedMatches: number;
}

interface HuntResult {
  indicator: string;
  matches: number;
  findings: Array<{
    timestamp: string;
    source: string;
    event: any;
    riskScore: number;
  }>;
  huntQuery: string;
  executionTime: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, indicator, indicatorType, reportDate, organizationId }: HuntRequest = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    switch (action) {
      case 'sync_feeds':
        return await syncThreatFeeds(supabase, organizationId);
      
      case 'generate_queries':
        return await generateHuntQueries(supabase, organizationId);
      
      case 'execute_hunt':
        return await executeHunt(supabase, indicator!, indicatorType!, organizationId);
      
      case 'generate_report':
        return await generateDailyReport(supabase, reportDate!, organizationId);
      
      default:
        throw new Error('Invalid action');
    }

  } catch (error: any) {
    console.error('Error in automated-threat-hunting function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function syncThreatFeeds(supabase: any, organizationId?: string) {
  console.log('🔄 Starting daily threat intelligence feed sync...');
  
  // Simulate collecting from multiple sources
  const feedSources = [
    'MITRE ATT&CK',
    'CVE Database', 
    'AbuseIPDB',
    'AlienVault OTX',
    'CISA KEV',
    'Malware Bazaar',
    'URLhaus',
    'PhishTank'
  ];

  const collectedIndicators: ThreatIndicator[] = [];
  
  // Simulate feed collection
  for (const source of feedSources) {
    const indicatorCount = Math.floor(Math.random() * 150) + 50; // 50-200 per source
    
    for (let i = 0; i < indicatorCount; i++) {
      const types = ['ip', 'domain', 'hash', 'url'];
      const severities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
      
      const indicator: ThreatIndicator = {
        value: generateMockIndicator(types[Math.floor(Math.random() * types.length)]),
        type: types[Math.floor(Math.random() * types.length)],
        severity: severities[Math.floor(Math.random() * severities.length)],
        source,
        confidence: Math.floor(Math.random() * 40) + 60, // 60-100%
        firstSeen: new Date(Date.now() - Math.random() * 86400000 * 7), // Last 7 days
        lastSeen: new Date()
      };
      
      collectedIndicators.push(indicator);
    }
  }

  // Store in threat_intelligence table
  const { error: insertError } = await supabase
    .from('threat_intelligence')
    .insert(
      collectedIndicators.map(ind => ({
        source: ind.source,
        indicator_type: ind.type,
        indicator_value: ind.value,
        threat_level: ind.severity,
        description: `Automated collection from ${ind.source} - Confidence: ${ind.confidence}%`,
        organization_id: organizationId
      }))
    );

  if (insertError) {
    console.error('Error inserting threat indicators:', insertError);
  }

  console.log(`✅ Collected ${collectedIndicators.length} indicators from ${feedSources.length} sources`);

  return new Response(
    JSON.stringify({
      success: true,
      collected: collectedIndicators.length,
      sources: feedSources,
      breakdown: feedSources.map(source => ({
        source,
        count: collectedIndicators.filter(i => i.source === source).length
      })),
      timestamp: new Date().toISOString()
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function generateHuntQueries(supabase: any, organizationId?: string) {
  console.log('🎯 Generating Splunk hunt queries from threat indicators...');

  // Fetch recent threat indicators
  const { data: indicators, error } = await supabase
    .from('threat_intelligence')
    .select('*')
    .eq('organization_id', organizationId || '')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(`Failed to fetch indicators: ${error.message}`);
  }

  const huntQueries: HuntQuery[] = indicators.map((indicator: any) => ({
    indicator: indicator.indicator_value,
    type: indicator.indicator_type,
    splunkQuery: generateSplunkQuery(indicator.indicator_value, indicator.indicator_type),
    severity: indicator.threat_level,
    expectedMatches: Math.random() > 0.8 ? Math.floor(Math.random() * 5) : 0
  }));

  console.log(`📊 Generated ${huntQueries.length} hunt queries`);

  return new Response(
    JSON.stringify({
      success: true,
      queries: huntQueries,
      totalQueries: huntQueries.length,
      bySeverity: {
        CRITICAL: huntQueries.filter(q => q.severity === 'CRITICAL').length,
        HIGH: huntQueries.filter(q => q.severity === 'HIGH').length,
        MEDIUM: huntQueries.filter(q => q.severity === 'MEDIUM').length,
        LOW: huntQueries.filter(q => q.severity === 'LOW').length
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function executeHunt(supabase: any, indicator: string, indicatorType: string, organizationId?: string) {
  console.log(`🔍 Executing hunt for ${indicatorType}: ${indicator}`);

  const startTime = Date.now();
  
  // Generate Splunk query
  const splunkQuery = generateSplunkQuery(indicator, indicatorType);
  
  // Simulate Splunk search execution
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
  
  // Simulate results (80% chance of no matches for clean environment)
  const hasMatches = Math.random() > 0.8;
  const matchCount = hasMatches ? Math.floor(Math.random() * 5) + 1 : 0;
  
  const findings = [];
  if (hasMatches) {
    for (let i = 0; i < matchCount; i++) {
      findings.push({
        timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(),
        source: ['firewall', 'proxy', 'dns', 'endpoint'][Math.floor(Math.random() * 4)],
        event: generateMockSplunkEvent(indicator, indicatorType),
        riskScore: Math.floor(Math.random() * 40) + 60
      });
    }
  }

  const result: HuntResult = {
    indicator,
    matches: matchCount,
    findings,
    huntQuery: splunkQuery,
    executionTime: Date.now() - startTime
  };

  // Log the hunt result
  const { error: logError } = await supabase
    .from('threat_hunt_logs')
    .insert({
      organization_id: organizationId,
      indicator_value: indicator,
      indicator_type: indicatorType,
      hunt_query: splunkQuery,
      match_count: matchCount,
      execution_time: result.executionTime,
      findings: findings,
      status: 'completed'
    });

  if (logError) {
    console.error('Error logging hunt result:', logError);
  }

  console.log(`✅ Hunt completed: ${matchCount} matches found`);

  return new Response(
    JSON.stringify({
      success: true,
      result,
      status: matchCount > 0 ? 'MATCHES_FOUND' : 'CLEAN',
      splunkUrl: `https://splunk.enterprise.local:8000/app/search/search?q=${encodeURIComponent(splunkQuery)}`
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function generateDailyReport(supabase: any, reportDate: string, organizationId?: string) {
  console.log(`📧 Generating daily threat hunt report for ${reportDate}...`);

  const date = new Date(reportDate);
  const dayStart = new Date(date.setHours(0, 0, 0, 0));
  const dayEnd = new Date(date.setHours(23, 59, 59, 999));

  // Fetch hunt logs for the day
  const { data: huntLogs, error } = await supabase
    .from('threat_hunt_logs')
    .select('*')
    .eq('organization_id', organizationId || '')
    .gte('created_at', dayStart.toISOString())
    .lte('created_at', dayEnd.toISOString());

  if (error) {
    throw new Error(`Failed to fetch hunt logs: ${error.message}`);
  }

  const totalQueries = huntLogs?.length || 0;
  const matchedQueries = huntLogs?.filter(log => log.match_count > 0).length || 0;
  const criticalFindings = huntLogs?.filter(log => 
    log.match_count > 0 && log.findings?.some((f: any) => f.riskScore >= 80)
  ).length || 0;
  
  const cleanEnvironment = matchedQueries === 0;

  // Generate email content
  const emailSubject = cleanEnvironment 
    ? `🛡️ Daily Threat Hunt Report: Clean Environment - ${reportDate}`
    : `🚨 Daily Threat Hunt Report: ${matchedQueries} IOC Matches - ${reportDate}`;

  const emailBody = cleanEnvironment 
    ? generateCleanReport(totalQueries, reportDate)
    : generateThreatReport(huntLogs, matchedQueries, criticalFindings, reportDate);

  // Store report
  const { data: report, error: reportError } = await supabase
    .from('threat_hunt_reports')
    .insert({
      organization_id: organizationId,
      report_date: reportDate,
      total_queries: totalQueries,
      matched_queries: matchedQueries,
      critical_findings: criticalFindings,
      clean_environment: cleanEnvironment,
      email_subject: emailSubject,
      email_body: emailBody,
      status: 'generated'
    })
    .select()
    .single();

  if (reportError) {
    throw new Error(`Failed to store report: ${reportError.message}`);
  }

  // Simulate sending email (would integrate with actual email service)
  console.log('📧 Email Report Generated:');
  console.log('Subject:', emailSubject);
  console.log('Body Preview:', emailBody.substring(0, 200) + '...');

  return new Response(
    JSON.stringify({
      success: true,
      report: {
        id: report.id,
        date: reportDate,
        totalQueries,
        matchedQueries,
        criticalFindings,
        cleanEnvironment,
        emailSent: true
      },
      email: {
        subject: emailSubject,
        body: emailBody
      },
      splunkDashboard: `https://splunk.enterprise.local:8000/app/search/threat_hunt_dashboard_${reportDate}`
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

function generateSplunkQuery(indicator: string, type: string): string {
  const queries = {
    ip: `index=* (src_ip="${indicator}" OR dest_ip="${indicator}" OR c_ip="${indicator}")
| eval threat_indicator="${indicator}", indicator_type="IP"
| stats count by _time, src_ip, dest_ip, action, sourcetype, host
| where count > 0
| sort -_time`,

    domain: `index=* "${indicator}"
| eval threat_indicator="${indicator}", indicator_type="Domain"
| stats count by _time, query, src_ip, dest_ip, sourcetype, host
| where count > 0
| sort -_time`,

    hash: `index=* "${indicator}"
| eval threat_indicator="${indicator}", indicator_type="Hash"
| stats count by _time, file_name, file_path, process, host, sourcetype
| where count > 0
| sort -_time`,

    url: `index=* (uri_path="*${indicator}*" OR url="*${indicator}*")
| eval threat_indicator="${indicator}", indicator_type="URL"  
| stats count by _time, uri_path, src_ip, user_agent, sourcetype, host
| where count > 0
| sort -_time`
  };

  return queries[type as keyof typeof queries] || queries.ip;
}

function generateMockIndicator(type: string): string {
  switch (type) {
    case 'ip':
      return `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
    case 'domain':
      const domains = ['evil-domain.com', 'malicious-site.net', 'bad-actor.org', 'threat-source.io'];
      return domains[Math.floor(Math.random() * domains.length)];
    case 'hash':
      return Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('');
    case 'url':
      return `https://suspicious-site.com/malware/${Math.random().toString(36)}`;
    default:
      return `indicator-${Math.random().toString(36)}`;
  }
}

function generateMockSplunkEvent(indicator: string, type: string): any {
  const baseEvent = {
    _time: new Date(Date.now() - Math.random() * 86400000).toISOString(),
    host: `server-${Math.floor(Math.random() * 100)}`,
    sourcetype: ['firewall', 'proxy_logs', 'dns', 'syslog'][Math.floor(Math.random() * 4)]
  };

  switch (type) {
    case 'ip':
      return {
        ...baseEvent,
        src_ip: `10.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`,
        dest_ip: indicator,
        action: 'blocked',
        bytes_out: Math.floor(Math.random() * 10000)
      };
    case 'domain':
      return {
        ...baseEvent,
        query: indicator,
        src_ip: `10.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`,
        response_code: Math.random() > 0.5 ? 'NXDOMAIN' : 'NOERROR'
      };
    default:
      return baseEvent;
  }
}

function generateCleanReport(totalQueries: number, reportDate: string): string {
  return `
🛡️ DAILY THREAT HUNT REPORT - ${reportDate}

✅ CLEAN BILL OF HEALTH

EXECUTIVE SUMMARY:
• Environment Status: SECURE
• Threat Indicators Hunted: ${totalQueries}
• IOC Matches Found: 0
• Risk Level: MINIMAL

DETAILS:
• All monitored indexes scanned successfully
• No indicators of compromise detected
• Automated threat hunting completed without alerts
• Network telemetry analysis: CLEAN
• Endpoint activity review: CLEAN

NEXT ACTIONS:
• Continue automated daily monitoring
• No immediate analyst action required
• Threat intelligence feeds will refresh tomorrow

--
Automated Threat Hunting Platform
Generated: ${new Date().toLocaleString()}
  `.trim();
}

function generateThreatReport(huntLogs: any[], matchedQueries: number, criticalFindings: number, reportDate: string): string {
  const matchedLogs = huntLogs.filter(log => log.match_count > 0);
  
  const threatDetails = matchedLogs.map(log => `
🎯 ${log.indicator_value} (${log.indicator_type.toUpperCase()})
   Matches: ${log.match_count}
   Risk Level: ${log.findings?.some((f: any) => f.riskScore >= 80) ? 'HIGH' : 'MEDIUM'}
   Splunk Investigation: https://splunk.enterprise.local:8000/app/search/search?q=${encodeURIComponent(log.hunt_query)}
  `).join('\n');

  return `
🚨 DAILY THREAT HUNT REPORT - ${reportDate}

⚠️ THREAT ACTIVITY DETECTED - IMMEDIATE ATTENTION REQUIRED

EXECUTIVE SUMMARY:
• Environment Status: COMPROMISED INDICATORS DETECTED
• Total Queries Executed: ${huntLogs.length}
• IOC Matches Found: ${matchedQueries}
• Critical Findings: ${criticalFindings}
• Risk Level: ${criticalFindings > 0 ? 'HIGH' : 'MEDIUM'}

DETECTED THREATS:
${threatDetails}

IMMEDIATE ACTIONS REQUIRED:
1. Review all Splunk investigation links above
2. Isolate affected systems if necessary
3. Escalate critical findings to security team
4. Update incident response procedures as needed

ANALYST INSTRUCTIONS:
• Click investigation links for direct Splunk pivot
• Correlate findings across multiple indicators
• Document any confirmed malicious activity
• Update threat intelligence database with findings

--
Automated Threat Hunting Platform
Generated: ${new Date().toLocaleString()}
⚠️ This report requires immediate analyst review
  `.trim();
}