import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-falco-secret',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

function mapPriorityToSeverity(priority?: string): 'INFO' | 'WARNING' | 'CRITICAL' {
  const p = (priority || '').toLowerCase();
  if (['emergency','alert','critical','error'].some(k => p.includes(k))) return 'CRITICAL';
  if (['warning','notice'].some(k => p.includes(k))) return 'WARNING';
  return 'INFO';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const secretHeader = req.headers.get('x-falco-secret');
    const expected = Deno.env.get('FALCO_WEBHOOK_SECRET');
    if (expected && secretHeader !== expected) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const payload = await req.json();
    const severity = mapPriorityToSeverity(payload.priority);
    const rule = payload.rule || 'Falco Alert';

    const details = {
      rule,
      output: payload.output,
      output_fields: payload.output_fields,
      priority: payload.priority,
      time: payload.time,
      namespace: payload.output_fields?.k8s_ns_name,
      pod: payload.output_fields?.k8s_pod_name,
      container: payload.output_fields?.container_id,
    };

    const { error } = await supabase.from('security_events').insert({
      event_type: `Falco: ${rule}`,
      severity,
      source_system: 'falco',
      details,
      created_at: new Date().toISOString(),
    });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('falco-webhook error', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
