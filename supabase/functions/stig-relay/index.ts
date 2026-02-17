import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY_URL = 'https://souhimbou-ai.fly.dev/api/stigs';

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { action, organization_id, ...params } = await req.json();

        console.log(`STIG Relay: ${action} for org ${organization_id}`);

        // Build the request to the Go Gateway on Fly.io
        // In production, mTLS would be handled here or via a secure tunnel
        const queryParams = new URLSearchParams();
        if (params.stig_id) queryParams.append('stig_id', params.stig_id);
        if (params.rule_id) queryParams.append('rule_id', params.rule_id);
        if (params.severity) queryParams.append('severity', params.severity);
        if (params.q) queryParams.append('q', params.q);

        const targetUrl = `${GATEWAY_URL}?${queryParams.toString()}`;

        // Add identity header for the Gateway
        const headers = new Headers();
        headers.set('X-Identity-ID', organization_id || 'anonymous');
        headers.set('Accept', 'application/json');

        const response = await fetch(targetUrl, {
            method: 'GET',
            headers: headers,
        });

        if (!response.ok) {
            const errorText = await response.text();
            return new Response(JSON.stringify({
                success: false,
                error: `Gateway error: ${response.status}`,
                details: errorText
            }), {
                status: response.status,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const data = await response.json();

        return new Response(JSON.stringify({
            success: true,
            data: data,
            source: 'live-gateway'
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('STIG Relay Error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
