import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SHODAN_API_KEY = Deno.env.get('SHODAN_API_KEY');
    
    if (!SHODAN_API_KEY) {
      throw new Error('SHODAN_API_KEY not configured');
    }

    const { ip } = await req.json();

    if (!ip) {
      return new Response(
        JSON.stringify({ error: 'IP address required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Looking up IP in Shodan: ${ip}`);

    // Call Shodan API
    const shodanUrl = `https://api.shodan.io/shodan/host/${ip}?key=${SHODAN_API_KEY}`;
    const response = await fetch(shodanUrl);

    if (!response.ok) {
      if (response.status === 404) {
        return new Response(
          JSON.stringify({ error: 'IP not found in Shodan database' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Shodan API error: ${response.status}`);
    }

    const hostData = await response.json();

    console.log(`Shodan lookup successful for ${ip}:`, {
      org: hostData.org,
      ports: hostData.ports?.length || 0,
      vulns: hostData.vulns?.length || 0
    });

    return new Response(
      JSON.stringify(hostData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Shodan lookup error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
