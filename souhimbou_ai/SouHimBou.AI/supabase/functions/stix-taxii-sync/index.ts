import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface StixIndicator {
  type: string;
  id: string;
  created: string;
  modified: string;
  pattern_type?: string;
  pattern?: string;
  description?: string;
  valid_from?: string;
  labels?: string[];
  confidence?: number;
}

function mapPatternToIndicator(pattern?: string) {
  if (!pattern) return null;
  // Basic extraction for common STIX patterns
  const ipv4 = /\[ipv4-addr:value\s*=\s*'([^']+)'\]/i.exec(pattern);
  const domain = /\[domain-name:value\s*=\s*'([^']+)'\]/i.exec(pattern);
  const url = /\[url:value\s*=\s*'([^']+)'\]/i.exec(pattern);
  const hash = /\[file:hashes\.'?(MD5|SHA-1|SHA-256)'?\s*=\s*'([^']+)'\]/i.exec(pattern);

  if (ipv4) return { indicator_type: 'IP', indicator_value: ipv4[1] };
  if (domain) return { indicator_type: 'Domain', indicator_value: domain[1] };
  if (url) return { indicator_type: 'URL', indicator_value: url[1] };
  if (hash) return { indicator_type: 'Hash', indicator_value: hash[2] };
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'sync_all';

    const TAXII_URL = Deno.env.get('TAXII_URL');
    const TAXII_USERNAME = Deno.env.get('TAXII_USERNAME');
    const TAXII_PASSWORD = Deno.env.get('TAXII_PASSWORD');

    if (!TAXII_URL || !TAXII_USERNAME || !TAXII_PASSWORD) {
      // Safe fallback: generate sample indicators so UI can work without secrets
      const sample = [
        { source: 'STIX/TAXII', indicator_type: 'IP', indicator_value: '203.0.113.10', threat_level: 'HIGH', description: 'Sample TAXII IP', confidence: 70 },
        { source: 'STIX/TAXII', indicator_type: 'Domain', indicator_value: 'mal.example.org', threat_level: 'MEDIUM', description: 'Sample TAXII domain', confidence: 60 },
      ];
      await supabase.from('threat_intelligence').insert(sample).select('id');
      return new Response(JSON.stringify({ success: true, note: 'Sample data inserted (no TAXII secrets configured)' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'sync_all') {
      const collectionsRes = await fetch(`${TAXII_URL}/collections/`, {
        headers: {
          'Accept': 'application/taxii+json;version=2.1',
          'Authorization': 'Basic ' + btoa(`${TAXII_USERNAME}:${TAXII_PASSWORD}`),
        },
      });
      if (!collectionsRes.ok) throw new Error(`TAXII collections error: ${collectionsRes.status}`);
      const collections = await collectionsRes.json();
      const insertedCounts: number[] = [];

      for (const coll of (collections?.collections || []).slice(0, 2)) {
        const objsRes = await fetch(`${TAXII_URL}/collections/${coll.id}/objects/`, {
          headers: {
            'Accept': 'application/taxii+json;version=2.1',
            'Authorization': 'Basic ' + btoa(`${TAXII_USERNAME}:${TAXII_PASSWORD}`),
          },
        });
        if (!objsRes.ok) continue;
        const bundle = await objsRes.json();
        const indicators: any[] = [];
        for (const obj of (bundle?.objects || []) as StixIndicator[]) {
          if (obj.type !== 'indicator') continue;
          const mapped = mapPatternToIndicator(obj.pattern);
          if (!mapped) continue;
          indicators.push({
            source: 'STIX/TAXII',
            indicator_type: mapped.indicator_type,
            indicator_value: mapped.indicator_value,
            threat_level: (obj.confidence || 50) > 75 ? 'HIGH' : 'MEDIUM',
            description: obj.description || 'STIX indicator',
            confidence: obj.confidence || 50,
            first_seen: obj.created,
            last_seen: obj.modified,
            tags: obj.labels || [],
          });
        }
        if (indicators.length) {
          const { data, error } = await supabase.from('threat_intelligence').insert(indicators).select('id');
          if (error) console.error('Insert error', error);
          insertedCounts.push(data?.length || 0);
        }
      }

      return new Response(JSON.stringify({ success: true, inserted: insertedCounts.reduce((a,b)=>a+b,0) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('stix-taxii-sync error', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
