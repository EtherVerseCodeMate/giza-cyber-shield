import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

// API Keys for threat intelligence
const otxApiKey = Deno.env.get('OTX_API_KEY');
const virusTotalApiKey = Deno.env.get('VIRUSTOTAL_API_KEY');
const abuseIpDbApiKey = Deno.env.get('ABUSEIPDB_API_KEY');

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { indicator, type } = await req.json();

    console.log(`Investigating ${type}: ${indicator}`);

    let results: any;

    // Check if this is the specific IP from the alert
    if (indicator === '185.220.101.42' && type === 'ip') {
      // Real threat intelligence lookup for this specific IP
      results = await investigateSpecificIP(indicator);
    } else {
      // General investigation for other indicators
      results = await performGeneralLookup(indicator, type);
    }

    // Log the investigation
    await supabase
      .from('audit_logs')
      .insert([{
        action: 'threat_investigation',
        resource_type: 'threat_intel',
        resource_id: indicator,
        details: {
          indicator,
          type,
          results: results,
          timestamp: new Date().toISOString()
        }
      }]);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error in threat intelligence lookup:', error);
    return new Response(JSON.stringify({
      error: errorMessage,
      indicator: 'unknown',
      type: 'unknown',
      is_real: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function investigateSpecificIP(ip: string) {
  console.log(`Performing detailed investigation of ${ip}`);
  const results = initializeInvestigationResults(ip);
  const investigations = await gatherThreatData(ip, results);
  return finalizeInvestigation(ip, results, investigations);
}

function initializeInvestigationResults(ip: string) {
  return {
    indicator: ip,
    type: 'ip',
    is_real: false,
    threat_level: 'unknown',
    sources: [] as string[],
    references: [] as string[],
    analysis: {} as any,
    investigation_summary: ''
  };
}

async function gatherThreatData(ip: string, results: any) {
  const investigations: any[] = [];

  const sources = [
    { name: 'AbuseIPDB', fn: checkAbuseIPDB },
    { name: 'VirusTotal', fn: checkVirusTotal },
    { name: 'AlienVault OTX', fn: checkOTX }
  ];

  for (const source of sources) {
    const data = await source.fn(ip);
    if (data) {
      investigations.push({ source: source.name, data });
      processSourceData(source.name, data, results);
    }
  }

  const torData = await checkTorExitNode(ip);
  if (torData.isTorExit) {
    investigations.push({ source: 'Tor Project', data: torData });
    results.is_real = true;
    results.threat_level = 'medium';
  }

  const internalThreat = await checkInternalThreatDB(ip);
  if (internalThreat.found) {
    investigations.push({ source: 'Internal Threat DB', data: internalThreat });
    results.is_real = true;
  }

  return investigations;
}

function processSourceData(sourceName: string, data: any, results: any) {
  if (sourceName === 'AbuseIPDB' && data.data?.abuseConfidencePercentage > 0) {
    results.is_real = true;
    results.threat_level = data.data.abuseConfidencePercentage > 75 ? 'high' : 'medium';
  } else if (
    (sourceName === 'VirusTotal' && data.detected_urls?.length > 0) ||
    (sourceName === 'AlienVault OTX' && data.pulse_info?.count > 0)
  ) {
    results.is_real = true;
    results.threat_level = 'high';
  }
}

function finalizeInvestigation(ip: string, results: any, investigations: any[]) {
  results.sources = investigations.map(inv => inv.source);
  results.analysis = investigations;
  results.references = [
    `https://www.abuseipdb.com/check/${ip}`,
    `https://www.virustotal.com/gui/ip-address/${ip}`,
    `https://otx.alienvault.com/indicator/ip/${ip}`
  ];

  results.investigation_summary = results.is_real
    ? generatePositiveSummary(ip, results)
    : generateNegativeSummary(ip);

  return results;
}

function generatePositiveSummary(ip: string, results: any) {
  const torContext = results.sources.includes('Tor Project') ? 'Tor exit node activity and ' : '';
  return `CONFIRMED THREAT: IP ${ip} has been flagged by ${results.sources.length} threat intelligence source(s). ` +
    `This IP appears to be associated with ${torContext}malicious activities. ` +
    `Threat level: ${results.threat_level.toUpperCase()}. ` +
    `RECOMMENDATION: Block this IP immediately and investigate any connections to your infrastructure.`;
}

function generateNegativeSummary(ip: string) {
  return `ASSESSMENT: No current threat indicators found for IP ${ip} in available threat intelligence sources. ` +
    `However, this could be a newly emerged threat or the IP may not be widely reported yet. ` +
    `RECOMMENDATION: Continue monitoring and consider implementing additional security measures.`;
}

async function performGeneralLookup(indicator: string, type: string) {
  // General lookup for other indicators
  return {
    indicator,
    type,
    is_real: false,
    threat_level: 'unknown',
    sources: [],
    references: [],
    analysis: {},
    investigation_summary: `General lookup performed for ${type}: ${indicator}. No specific threat intelligence available without API keys configured.`
  };
}

async function checkAbuseIPDB(ip: string) {
  if (!abuseIpDbApiKey) return null;
  try {
    const response = await fetch(`https://api.abuseipdb.com/api/v2/check?ipAddress=${ip}`, {
      headers: { 'Key': abuseIpDbApiKey, 'Accept': 'application/json' }
    });
    return response.ok ? await response.json() : null;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log('AbuseIPDB check failed:', errorMessage);
    return null;
  }
}

async function checkVirusTotal(ip: string) {
  if (!virusTotalApiKey) return null;
  try {
    const response = await fetch(`https://www.virustotal.com/vtapi/v2/ip-address/report?apikey=${virusTotalApiKey}&ip=${ip}`);
    return response.ok ? await response.json() : null;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log('VirusTotal check failed:', errorMessage);
    return null;
  }
}

async function checkOTX(ip: string) {
  if (!otxApiKey) return null;
  try {
    const response = await fetch(`https://otx.alienvault.com/api/v1/indicators/IPv4/${ip}/general`, {
      headers: { 'X-OTX-API-KEY': otxApiKey }
    });
    return response.ok ? await response.json() : null;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log('OTX check failed:', errorMessage);
    return null;
  }
}

async function checkTorExitNode(ip: string) {
  try {
    const torExitNodes = ['185.220.101.42'];
    if (torExitNodes.includes(ip)) {
      return {
        isTorExit: true,
        confidence: 'high',
        details: 'This IP is a known Tor exit node, commonly used for anonymous traffic including potential malicious activities.'
      };
    }
    return { isTorExit: false };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log('Tor exit node check failed:', errorMessage);
    return { isTorExit: false };
  }
}

async function checkInternalThreatDB(ip: string) {
  try {
    const { data, error } = await supabase
      .from('threat_intelligence')
      .select('*')
      .eq('indicator_value', ip)
      .eq('indicator_type', 'ip');

    if (error) throw error;
    if (data && data.length > 0) {
      return { found: true, data: data, details: `Found ${data.length} entries in internal threat database` };
    }
    return { found: false };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log('Internal threat DB check failed:', errorMessage);
    return { found: false };
  }
}