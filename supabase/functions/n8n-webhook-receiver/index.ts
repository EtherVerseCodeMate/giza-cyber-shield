// n8n Webhook Receiver — Khepra Supabase Edge Function
//
// Receives events FROM n8n workflows and routes them into the Khepra platform.
// Enables n8n's 400+ integrations (Slack, Jira, PagerDuty, GitHub, ServiceNow, etc.)
// to feed security events directly into Supabase security_alerts + security_incidents.
//
// n8n workflow config:
//   Node: HTTP Request (POST)
//   URL: https://xjknkjbrjgljuovaazeu.supabase.co/functions/v1/n8n-webhook-receiver
//   Headers: Authorization: Bearer <SUPABASE_ANON_KEY>
//            X-N8n-Signature: <hmac-sha256 of body with KHEPRA_WEBHOOK_SECRET>
//   Body: { "event_type": "...", "source": "...", "payload": { ... } }
//
// Supported event_types:
//   security_alert    — IDS/SIEM alert from any source (Splunk, Sentinel, Falco, etc.)
//   incident_trigger  — PagerDuty/OpsGenie incident → Khepra incident declaration
//   vulnerability     — Jira ticket / Snyk finding → vulnerability record
//   compliance_check  — Scheduled compliance check result
//   threat_intel      — MISP / VirusTotal IOC feed update
//   custom_tool       — Execute any Khepra MCP tool from n8n

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { hmac } from 'https://deno.land/x/hmac@v2.0.1/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-n8n-signature',
};

interface N8nWebhookPayload {
  event_type: string;          // security_alert | incident_trigger | vulnerability | compliance_check | threat_intel | custom_tool
  source: string;              // "slack", "jira", "pagerduty", "splunk", "github", etc.
  source_ref?: string;         // External reference ID (Jira ticket, PagerDuty incident ID)
  org_id?: string;
  severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  tool_name?: string;          // For custom_tool events
  tool_args?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const webhookSecret = Deno.env.get('KHEPRA_WEBHOOK_SECRET') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const demarcUrl = Deno.env.get('DEMARC_API_URL') ?? 'https://api.souhimbou.ai';

  try {
    const bodyText = await req.text();

    // ── Verify n8n HMAC-SHA256 signature ─────────────────────────────────────
    if (webhookSecret) {
      const signature = req.headers.get('x-n8n-signature') ?? '';
      const expectedSig = await hmac('sha256', webhookSecret, bodyText, 'utf8', 'hex');
      if (signature !== `sha256=${expectedSig}`) {
        return new Response(
          JSON.stringify({ error: 'invalid_signature', hint: 'Check KHEPRA_WEBHOOK_SECRET in n8n credentials' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    const payload: N8nWebhookPayload = JSON.parse(bodyText);
    const supabase = createClient(supabaseUrl, supabaseKey);
    const processedAt = new Date().toISOString();
    const dagNodeId = crypto.randomUUID();

    let result: Record<string, unknown> = { dag_node_id: dagNodeId, processed_at: processedAt };

    switch (payload.event_type) {

      // ── Security Alert (from Slack, Splunk, Sentinel, Falco, etc.) ───────────
      case 'security_alert': {
        const { error } = await supabase.from('security_alerts').insert({
          id: crypto.randomUUID(),
          title: payload.title,
          description: payload.description ?? '',
          severity: payload.severity ?? 'MEDIUM',
          source: payload.source,
          source_ref: payload.source_ref,
          org_id: payload.org_id ?? 'default',
          status: 'OPEN',
          metadata: payload.metadata ?? {},
          dag_node_id: dagNodeId,
          detected_at: processedAt,
        });
        if (error) throw new Error(`security_alert insert: ${error.message}`);
        result = { ...result, status: 'alert_created', table: 'security_alerts' };
        break;
      }

      // ── Incident Trigger (from PagerDuty, OpsGenie, etc.) ────────────────────
      case 'incident_trigger': {
        const { data, error } = await supabase.from('security_incidents').insert({
          id: crypto.randomUUID(),
          title: payload.title,
          description: payload.description ?? '',
          severity: payload.severity ?? 'HIGH',
          status: 'OPEN',
          phase: 'identification',
          source: payload.source,
          external_ref: payload.source_ref,
          org_id: payload.org_id ?? 'default',
          metadata: payload.metadata ?? {},
          dag_node_id: dagNodeId,
          detected_at: processedAt,
        }).select('id').single();

        if (error) throw new Error(`incident insert: ${error.message}`);
        result = { ...result, status: 'incident_declared', incident_id: data?.id, table: 'security_incidents' };
        break;
      }

      // ── Vulnerability (from Jira, Snyk, Dependabot, etc.) ────────────────────
      case 'vulnerability': {
        const { error } = await supabase.from('vulnerability_findings').insert({
          id: crypto.randomUUID(),
          title: payload.title,
          description: payload.description ?? '',
          severity: payload.severity ?? 'MEDIUM',
          source: payload.source,
          external_ref: payload.source_ref,
          org_id: payload.org_id ?? 'default',
          status: 'OPEN',
          metadata: payload.metadata ?? {},
          dag_node_id: dagNodeId,
          found_at: processedAt,
        });
        if (error) throw new Error(`vulnerability insert: ${error.message}`);
        result = { ...result, status: 'vulnerability_recorded', table: 'vulnerability_findings' };
        break;
      }

      // ── Custom MCP Tool Execution ─────────────────────────────────────────────
      case 'custom_tool': {
        if (!payload.tool_name) {
          throw new Error('custom_tool requires tool_name field');
        }
        // Route to DEMARC API
        const toolResp = await fetch(`${demarcUrl}/api/v1/mcp/tool`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-N8n-Source': payload.source,
          },
          body: JSON.stringify({
            tool_name: payload.tool_name,
            arguments: payload.tool_args ?? {},
          }),
        });
        const toolResult = await toolResp.json();
        result = { ...result, status: 'tool_executed', tool_result: toolResult };
        break;
      }

      // ── Natural Language Query from n8n ────────────────────────────────────────
      case 'nl_query': {
        const nlResp = await fetch(`${demarcUrl}/api/v1/mcp/ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: payload.title,
            context: { org_id: payload.org_id ?? 'default', source: payload.source },
          }),
        });
        const nlResult = await nlResp.json();
        result = { ...result, status: 'nl_query_processed', nl_result: nlResult };
        break;
      }

      default:
        result = { ...result, status: 'ignored', reason: `unknown event_type: ${payload.event_type}` };
    }

    // ── Log all webhook events to audit table ─────────────────────────────────
    await supabase.from('nl_query_log').insert({
      id: dagNodeId,
      query_text: payload.title,
      source: `n8n:${payload.source}`,
      event_type: payload.event_type,
      result_summary: JSON.stringify(result).slice(0, 500),
      logged_at: processedAt,
    }).throwOnError();

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[n8n-webhook-receiver]', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
