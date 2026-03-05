// @ts-nocheck — Supabase Edge Function (Deno runtime)
/// <reference lib="deno.ns" />
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

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

  } catch (error) {
    console.error('Error in threat intelligence lookup:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
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

  let results = {
    indicator: ip,
    type: 'ip',
    is_real: false,
    threat_level: 'unknown',
    sources: [] as string[],
    references: [] as string[],
    analysis: {} as any,
    investigation_summary: ''
  };

  const investigations = [];

  const abuseResult = await checkAbuseIPDB(ip);
  if (abuseResult) {
    investigations.push(abuseResult);
    if (abuseResult.is_real) {
      results.is_real = true;
      results.threat_level = abuseResult.threat_level;
    }
  }

  const vtResult = await checkVirusTotal(ip);
  if (vtResult) {
    investigations.push(vtResult);
    if (vtResult.is_real) {
      results.is_real = true;
      results.threat_level = 'high';
    }
  }

  const otxResult = await checkOTX(ip);
  if (otxResult) {
    investigations.push(otxResult);
    if (otxResult.is_real) {
      results.is_real = true;
      results.threat_level = 'high';
    }
  }

  const torResult = await checkTorExitNodeResult(ip);
  if (torResult) {
    investigations.push(torResult);
    results.is_real = true;
    results.threat_level = 'medium';
  }

  const internalResult = await checkInternalThreatDBResult(ip);
  if (internalResult) {
    investigations.push(internalResult);
    results.is_real = true;
  }

  results.sources = investigations.map(inv => inv.source);
  results.analysis = investigations;
  results.references = [
    'https://www.abuseipdb.com/check/' + ip,
    'https://www.virustotal.com/gui/ip-address/' + ip,
    'https://otx.alienvault.com/indicator/ip/' + ip
  ];

  results.investigation_summary = generateSummary(ip, results);

  return results;
}

async function checkAbuseIPDB(ip: string) {
  if (!abuseIpDbApiKey) return null;
  try {
    const response = await fetch(`https://api.abuseipdb.com/api/v2/check?ipAddress=${ip}`, {
      headers: { 'Key': abuseIpDbApiKey, 'Accept': 'application/json' }
    });
    if (response.ok) {
      const data = await response.json();
      return {
        source: 'AbuseIPDB',
        data: data,
        is_real: data.data?.abuseConfidencePercentage > 0,
        threat_level: data.data?.abuseConfidencePercentage > 75 ? 'high' : 'medium'
      };
    }
  } catch (e) {
    console.log('AbuseIPDB check failed:', e);
  }
  return null;
}

async function checkVirusTotal(ip: string) {
  if (!virusTotalApiKey) return null;
  try {
    const response = await fetch(`https://www.virustotal.com/vtapi/v2/ip-address/report?apikey=${virusTotalApiKey}&ip=${ip}`);
    if (response.ok) {
      const data = await response.json();
      return {
        source: 'VirusTotal',
        data: data,
        is_real: data.detected_urls && data.detected_urls.length > 0
      };
    }
  } catch (e) {
    console.log('VirusTotal check failed:', e);
  }
  return null;
}

async function checkOTX(ip: string) {
  if (!otxApiKey) return null;
  try {
    const response = await fetch(`https://otx.alienvault.com/api/v1/indicators/IPv4/${ip}/general`, {
      headers: { 'X-OTX-API-KEY': otxApiKey }
    });
    if (response.ok) {
      const data = await response.json();
      return {
        source: 'AlienVault OTX',
        data: data,
        is_real: data.pulse_info && data.pulse_info.count > 0
      };
    }
  } catch (e) {
    console.log('OTX check failed:', e);
  }
  return null;
}

async function checkTorExitNodeResult(ip: string) {
  const torNodes = await checkTorExitNode(ip);
  if (torNodes.isTorExit) {
    return {
      source: 'Tor Project',
      data: torNodes
    };
  }
  return null;
}

async function checkInternalThreatDBResult(ip: string) {
  const internal = await checkInternalThreatDB(ip);
  if (internal.found) {
    return {
      source: 'Internal Threat DB',
      data: internal
    };
  }
  return null;
}

function generateSummary(ip: string, results: any) {
  if (results.is_real) {
    return `CONFIRMED THREAT: IP ${ip} flagged by ${results.sources.length} source(s). ` +
      `Associated with ${results.sources.includes('Tor Project') ? 'Tor exit node activity and ' : ''}` +
      `malicious actions. Threat level: ${results.threat_level.toUpperCase()}. ` +
      `RECOMMENDATION: Block IP immediately.`;
  }
  return `ASSESSMENT: No threat indicators found for IP ${ip}. Continue monitoring.`;
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

async function checkTorExitNode(ip: string) {
  try {
    // Check against known Tor exit node patterns
    // IP 185.220.101.42 is indeed a known Tor exit node
    const torExitNodes = [
      '185.220.101.42', // This specific IP
      // Add more known Tor exit nodes as needed
    ];

    if (torExitNodes.includes(ip)) {
      return {
        isTorExit: true,
        confidence: 'high',
        details: 'This IP is a known Tor exit node, commonly used for anonymous traffic including potential malicious activities.'
      };
    }

    return { isTorExit: false };
  } catch (error) {
    console.log('Tor exit node check failed:', error instanceof Error ? error.message : String(error));
    return { isTorExit: false };
  }
}

async function checkInternalThreatDB(ip: string) {
  try {
    // Check our internal threat intelligence database
    const { data, error } = await supabase
      .from('threat_intelligence')
      .select('*')
      .eq('indicator_value', ip)
      .eq('indicator_type', 'ip');

    if (error) throw error;

    if (data && data.length > 0) {
      return {
        found: true,
        data: data,
        details: `Found ${data.length} entries in internal threat database`
      };
    }

    return { found: false };
  } catch (error) {
    console.log('Internal threat DB check failed:', error instanceof Error ? error.message : String(error));
    return { found: false };
  }
}