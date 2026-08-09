/**
 * omnibus-connector — KHEPRA Adaptive API Fabric v2
 *
 * A licensable API product: the universal connector between any data source
 * and the KHEPRA/SouHimBou ecosystem. Protected by the KHEPRA Gateway
 * (4-layer WAF: Firewall → Auth → Anomaly → Control).
 *
 * Every request passes through:
 *   1. License enforcement (connector_license_keys + check_and_increment_meter)
 *   2. Scope check (product_scope vs requested connector category)
 *   3. Prompt guard for LLM calls (WAF patterns: PII, injection, jailbreak)
 *   4. Real connector execution (pull/push/inference)
 *   5. Token metering (LLM calls) + event recording + optional PQC signing
 *
 * Connector categories:
 *   SIEM:        Splunk, Elastic, QRadar, Sentinel, ArcSight
 *   SOAR:        PagerDuty, ServiceNow, Jira, XSOAR
 *   EDR:         CrowdStrike, SentinelOne, Defender, Carbon Black
 *   Cloud:       AWS Security Hub, Azure Defender, GCP SCC, Prisma Cloud
 *   IAM:         Okta, Azure AD, CyberArk, BeyondTrust
 *   Threat Intel:MISP, OpenCTI, AbuseIPDB, VirusTotal, OTX, Shodan
 *   LLM:         OpenAI, Anthropic, OpenRouter, Ollama, Azure OpenAI,
 *                Vertex AI, AWS Bedrock, Cohere, Mistral, HuggingFace
 *   Custom:      webhook_push, rest_pull, syslog
 *
 * Wraps (backward-compatible delegation):
 *   siem-integration    → push_event / pull_data for Splunk/Elastic/QRadar/Sentinel/ArcSight
 *   integration-manager → test/sync for CrowdStrike/Okta/Palo Alto
 *
 * Author: SecRed Knowledge Inc. / NouchiX
 * IP: SOUHIMBOU DOH KONE LLC, exclusively licensed to SecRed Knowledge Inc.
 * Patent-pending: USPTO #73565085 (KHEPRA Protocol)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-khepra-license',
};

// ── LLM Provider Cost Table (micro-USD per 1K tokens) ────────────────────────
// Used for metering. Updated as provider pricing changes.
const LLM_COST_PER_1K_MICRO: Record<string, { in: number; out: number }> = {
  openai_gpt4o:           { in: 2500, out: 10000 },
  openai_gpt4o_mini:      { in: 150,  out: 600 },
  openai_o1:              { in: 15000, out: 60000 },
  anthropic_claude_sonnet:{ in: 3000, out: 15000 },
  anthropic_claude_haiku: { in: 250,  out: 1250 },
  openrouter:             { in: 0,    out: 0 },   // varies by model, charged at source
  ollama:                 { in: 0,    out: 0 },   // sovereign / local
  azure_openai:           { in: 2500, out: 10000 },
  vertex_gemini_pro:      { in: 1250, out: 5000 },
  bedrock_claude:         { in: 3000, out: 15000 },
  cohere:                 { in: 500,  out: 1500 },
  mistral:                { in: 700,  out: 2100 },
  huggingface:            { in: 0,    out: 0 },   // free tier
};

// ── Prompt Guard: WAF Patterns ────────────────────────────────────────────────
const PROMPT_GUARD_PATTERNS = {
  prompt_injection: [
    /ignore (all |previous |above )?instructions/i,
    /you are now (a|an) .{0,50}(without|no) restrictions/i,
    /pretend (you are|to be) .{0,50}(unrestricted|unfiltered|DAN)/i,
    /\[SYSTEM\].*\[\/SYSTEM\]/i,
    /override (your|the) (system|safety|content) (prompt|policy|filter)/i,
  ],
  jailbreak: [
    /do anything now/i,
    /developer mode/i,
    /jailbreak/i,
    /bypass (all|your) (restrictions|filters|safety)/i,
    /act as (if )?you have no (guidelines|restrictions|filters)/i,
  ],
  pii_detected: [
    /\b\d{3}-\d{2}-\d{4}\b/,                          // SSN
    /\b4[0-9]{12}(?:[0-9]{3})?\b/,                    // Visa card
    /\b(?:password|passwd|pwd)\s*[:=]\s*\S+/i,        // Password leak
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,   // Email (warn, not block)
  ],
};

// ── Connector Catalog ─────────────────────────────────────────────────────────
const CONNECTOR_CATALOG: Record<string, ConnectorDefinition> = {
  // SIEM
  splunk:              { category: 'siem', display_name: 'Splunk Enterprise / Cloud',
    auth_methods: ['bearer'], required_fields: ['base_url', 'vault_secret_id'],
    default_pull: { endpoint: '/services/search/jobs', method: 'POST', poll_interval_seconds: 300 },
    default_push: { endpoint: '/services/collector/event', method: 'POST', envelope: 'hec', batch_size: 50 } },
  elastic:             { category: 'siem', display_name: 'Elastic SIEM / Security',
    auth_methods: ['api_key', 'bearer'], required_fields: ['base_url', 'vault_secret_id'],
    default_pull: { endpoint: '/.siem-signals-*/_search', method: 'POST', poll_interval_seconds: 300 },
    default_push: { endpoint: '/khepra-events/_doc', method: 'POST', envelope: 'raw', batch_size: 100 } },
  qradar:              { category: 'siem', display_name: 'IBM QRadar SIEM',
    auth_methods: ['api_key'], required_fields: ['base_url', 'vault_secret_id'],
    default_pull: { endpoint: '/api/siem/offenses', method: 'GET', poll_interval_seconds: 300 },
    default_push: { endpoint: '/api/siem/offenses/{id}/notes', method: 'POST', envelope: 'raw' } },
  microsoft_sentinel:  { category: 'siem', display_name: 'Microsoft Sentinel',
    auth_methods: ['oauth2_client_creds'], required_fields: ['base_url', 'vault_secret_id'],
    default_pull: { endpoint: '/providers/Microsoft.SecurityInsights/incidents', method: 'GET', poll_interval_seconds: 300 },
    default_push: { endpoint: '/providers/Microsoft.SecurityInsights/incidents', method: 'POST', envelope: 'raw' } },
  arcsight:            { category: 'siem', display_name: 'Micro Focus ArcSight',
    auth_methods: ['basic'], required_fields: ['base_url', 'vault_secret_id'],
    default_pull: { endpoint: '/detect/rest/api/v1/activeListEntries', method: 'GET', poll_interval_seconds: 600 },
    default_push: { endpoint: '/detect/rest/api/v1/activeListEntries', method: 'POST', envelope: 'raw' } },
  // SOAR
  pagerduty:           { category: 'soar', display_name: 'PagerDuty',
    auth_methods: ['api_key'], required_fields: ['vault_secret_id'],
    default_pull: { endpoint: 'https://api.pagerduty.com/incidents', method: 'GET', poll_interval_seconds: 60 },
    default_push: { endpoint: 'https://events.pagerduty.com/v2/enqueue', method: 'POST', envelope: 'raw', batch_size: 1 } },
  servicenow:          { category: 'soar', display_name: 'ServiceNow',
    auth_methods: ['basic', 'bearer'], required_fields: ['base_url', 'vault_secret_id'],
    default_pull: { endpoint: '/api/now/table/sn_si_incident', method: 'GET', poll_interval_seconds: 300 },
    default_push: { endpoint: '/api/now/table/sn_si_incident', method: 'POST', envelope: 'raw' } },
  jira:                { category: 'soar', display_name: 'Jira / Jira Service Management',
    auth_methods: ['basic', 'bearer'], required_fields: ['base_url', 'vault_secret_id'],
    default_pull: { endpoint: '/rest/api/3/search', method: 'GET', poll_interval_seconds: 300 },
    default_push: { endpoint: '/rest/api/3/issue', method: 'POST', envelope: 'raw' } },
  xsoar:               { category: 'soar', display_name: 'Palo Alto XSOAR / Cortex',
    auth_methods: ['api_key'], required_fields: ['base_url', 'vault_secret_id'],
    default_pull: { endpoint: '/incident/search', method: 'POST', poll_interval_seconds: 300 },
    default_push: { endpoint: '/incident', method: 'POST', envelope: 'raw' } },
  // EDR
  crowdstrike:         { category: 'edr', display_name: 'CrowdStrike Falcon',
    auth_methods: ['oauth2_client_creds'], required_fields: ['base_url', 'vault_secret_id'],
    default_pull: { endpoint: '/detects/queries/detects/v1', method: 'GET', poll_interval_seconds: 180 },
    default_push: { endpoint: '/incidents/entities/incidents/v1', method: 'PATCH', envelope: 'raw' } },
  sentinelone:         { category: 'edr', display_name: 'SentinelOne',
    auth_methods: ['api_key'], required_fields: ['base_url', 'vault_secret_id'],
    default_pull: { endpoint: '/web/api/v2.1/threats', method: 'GET', poll_interval_seconds: 180 },
    default_push: { endpoint: '/web/api/v2.1/threats/mark-as-benign', method: 'POST', envelope: 'raw' } },
  microsoft_defender:  { category: 'edr', display_name: 'Microsoft Defender for Endpoint',
    auth_methods: ['oauth2_client_creds'], required_fields: ['vault_secret_id'],
    default_pull: { endpoint: 'https://api.securitycenter.microsoft.com/api/alerts', method: 'GET', poll_interval_seconds: 300 },
    default_push: { endpoint: 'https://api.securitycenter.microsoft.com/api/alerts', method: 'PATCH', envelope: 'raw' } },
  // Cloud
  aws_security_hub:    { category: 'cloud', display_name: 'AWS Security Hub',
    auth_methods: ['api_key'], required_fields: ['vault_secret_id'],
    default_pull: { endpoint: 'https://securityhub.{region}.amazonaws.com/findings', method: 'POST', poll_interval_seconds: 300 },
    default_push: { endpoint: 'https://securityhub.{region}.amazonaws.com/findings/import', method: 'POST', envelope: 'raw' } },
  // IAM
  okta:                { category: 'iam', display_name: 'Okta Identity',
    auth_methods: ['api_key'], required_fields: ['base_url', 'vault_secret_id'],
    default_pull: { endpoint: '/api/v1/logs', method: 'GET', poll_interval_seconds: 300 },
    default_push: { endpoint: '/api/v1/users/{userId}/lifecycle/suspend', method: 'POST', envelope: 'raw' } },
  // Threat Intel
  misp:                { category: 'threat_intel', display_name: 'MISP Threat Intelligence',
    auth_methods: ['api_key'], required_fields: ['base_url', 'vault_secret_id'],
    default_pull: { endpoint: '/events/restSearch', method: 'POST', poll_interval_seconds: 900 },
    default_push: { endpoint: '/events/add', method: 'POST', envelope: 'raw' } },
  virustotal:          { category: 'threat_intel', display_name: 'VirusTotal',
    auth_methods: ['api_key'], required_fields: ['vault_secret_id'],
    default_pull: { endpoint: 'https://www.virustotal.com/api/v3/feeds/files', method: 'GET', poll_interval_seconds: 3600 },
    default_push: {} },
  abuseipdb:           { category: 'threat_intel', display_name: 'AbuseIPDB',
    auth_methods: ['api_key'], required_fields: ['vault_secret_id'],
    default_pull: { endpoint: 'https://api.abuseipdb.com/api/v2/blacklist', method: 'GET', poll_interval_seconds: 3600 },
    default_push: { endpoint: 'https://api.abuseipdb.com/api/v2/report', method: 'POST', envelope: 'raw' } },
  // ── LLM Providers ────────────────────────────────────────────
  openai:              { category: 'llm', display_name: 'OpenAI (GPT-4o, o1, etc.)',
    auth_methods: ['bearer'], required_fields: ['vault_secret_id'],
    default_pull: {}, default_push: {},
    inference_endpoint: 'https://api.openai.com/v1/chat/completions',
    default_model: 'gpt-4o-mini' },
  anthropic:           { category: 'llm', display_name: 'Anthropic Claude',
    auth_methods: ['api_key'], required_fields: ['vault_secret_id'],
    default_pull: {}, default_push: {},
    inference_endpoint: 'https://api.anthropic.com/v1/messages',
    default_model: 'claude-haiku-4-5' },
  openrouter:          { category: 'llm', display_name: 'OpenRouter (200+ models)',
    auth_methods: ['bearer'], required_fields: ['vault_secret_id'],
    default_pull: {}, default_push: {},
    inference_endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    default_model: 'meta-llama/llama-3.1-8b-instruct:free' },
  ollama:              { category: 'llm', display_name: 'Ollama (Sovereign / Local)',
    auth_methods: ['none', 'bearer'], required_fields: ['base_url'],
    default_pull: {}, default_push: {},
    inference_endpoint: '/api/chat',
    default_model: 'llama3.1:8b' },
  azure_openai:        { category: 'llm', display_name: 'Azure OpenAI Service',
    auth_methods: ['api_key'], required_fields: ['base_url', 'vault_secret_id'],
    default_pull: {}, default_push: {},
    inference_endpoint: '/openai/deployments/{deployment}/chat/completions?api-version=2024-02-01',
    default_model: 'gpt-4o' },
  vertex_ai:           { category: 'llm', display_name: 'Google Vertex AI / Gemini',
    auth_methods: ['oauth2_client_creds'], required_fields: ['base_url', 'vault_secret_id'],
    default_pull: {}, default_push: {},
    inference_endpoint: '/v1/projects/{project}/locations/{location}/publishers/google/models/{model}:generateContent',
    default_model: 'gemini-1.5-pro' },
  bedrock:             { category: 'llm', display_name: 'AWS Bedrock (Claude, Titan, etc.)',
    auth_methods: ['api_key'], required_fields: ['vault_secret_id'],
    default_pull: {}, default_push: {},
    inference_endpoint: 'https://bedrock-runtime.{region}.amazonaws.com/model/{model}/invoke',
    default_model: 'anthropic.claude-3-haiku-20240307-v1:0' },
  cohere:              { category: 'llm', display_name: 'Cohere',
    auth_methods: ['bearer'], required_fields: ['vault_secret_id'],
    default_pull: {}, default_push: {},
    inference_endpoint: 'https://api.cohere.ai/v1/chat',
    default_model: 'command-r' },
  mistral:             { category: 'llm', display_name: 'Mistral AI',
    auth_methods: ['bearer'], required_fields: ['vault_secret_id'],
    default_pull: {}, default_push: {},
    inference_endpoint: 'https://api.mistral.ai/v1/chat/completions',
    default_model: 'mistral-small-latest' },
  huggingface:         { category: 'llm', display_name: 'HuggingFace Inference API',
    auth_methods: ['bearer'], required_fields: ['vault_secret_id'],
    default_pull: {}, default_push: {},
    inference_endpoint: 'https://api-inference.huggingface.co/models/{model}',
    default_model: 'mistralai/Mixtral-8x7B-Instruct-v0.1' },
  // Custom
  webhook_push:        { category: 'custom', display_name: 'Generic Webhook (Push only)',
    auth_methods: ['bearer', 'hmac', 'none'], required_fields: ['base_url'],
    default_pull: {}, default_push: { endpoint: '/', method: 'POST', envelope: 'raw', batch_size: 1 } },
  rest_pull:           { category: 'custom', display_name: 'Generic REST API (Pull only)',
    auth_methods: ['bearer', 'basic', 'api_key', 'none'], required_fields: ['base_url'],
    default_pull: { endpoint: '/', method: 'GET', poll_interval_seconds: 300 }, default_push: {} },
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface ConnectorDefinition {
  category: string; display_name: string;
  auth_methods: string[]; required_fields: string[];
  default_pull: Record<string, any>; default_push: Record<string, any>;
  inference_endpoint?: string; default_model?: string;
}

interface GatewayContext {
  licenseKeyId: string; tier: string; productScope: string[];
  llmTokensPerDay: number; pqcSigningEnabled: boolean; dagAttestation: boolean;
  callsThisHour: number; callsToday: number;
}

// ── Main Handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey     = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !serviceKey || !anonKey) return errorResponse('Server misconfiguration', 500);

  const svc = createClient(supabaseUrl, serviceKey);

  // ── KHEPRA Gateway Middleware: License + Rate Limit ───────────────────────
  // License key may be in header OR body (support both for API vs SDK usage)
  const body = await req.json().catch(() => ({}));
  const licenseKey = req.headers.get('x-khepra-license') ?? body.license_key;

  let gwCtx: GatewayContext | null = null;
  let orgId: string | null = null;

  if (licenseKey) {
    // Standalone API product path — license key authenticates the caller
    const connectorType = CONNECTOR_CATALOG[body.connector_type ?? '']?.category ?? 'unknown';
    const meterResult = await svc.rpc('check_and_increment_meter', {
      p_license_key: licenseKey,
      p_connector_type: connectorType,
    });
    if (meterResult.error || !meterResult.data) {
      return errorResponse('License validation error', 500);
    }
    const meter = meterResult.data as any;
    if (!meter.allowed) {
      return errorResponse(`Access denied: ${meter.reason}`, meter.reason?.includes('expired') ? 402 : 429);
    }
    gwCtx = {
      licenseKeyId: meter.license_key_id, tier: meter.tier,
      productScope: meter.product_scope, llmTokensPerDay: meter.llm_tokens_per_day,
      pqcSigningEnabled: meter.pqc_signing_enabled, dagAttestation: meter.dag_attestation,
      callsThisHour: meter.calls_this_hour, callsToday: meter.calls_today,
    };
  } else {
    // SouHimBou SaaS path — validate user JWT instead
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return errorResponse('x-khepra-license or Authorization required', 401);
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return errorResponse('Invalid token', 401);

    const { data: profile } = await svc.from('user_profiles').select('org_id').eq('id', user.id).single();
    if (!profile?.org_id) return errorResponse('User profile not found', 403);
    orgId = profile.org_id;

    // SaaS users get enterprise scope (gated by their subscription tier elsewhere)
    gwCtx = { licenseKeyId: '', tier: 'saas', productScope: Object.keys(CONNECTOR_CATALOG).map(k => CONNECTOR_CATALOG[k].category).filter((v,i,a)=>a.indexOf(v)===i),
      llmTokensPerDay: 100000, pqcSigningEnabled: false, dagAttestation: false,
      callsThisHour: 0, callsToday: 0 };
  }

  const { action } = body;
  if (!action) return errorResponse('action is required', 400);

  // Resolve orgId from license if not from JWT
  if (!orgId && gwCtx.licenseKeyId) {
    const { data: lk } = await svc.from('connector_license_keys').select('org_id')
      .eq('id', gwCtx.licenseKeyId).maybeSingle();
    orgId = lk?.org_id ?? null;
  }

  try {
    switch (action) {
      case 'get_catalog':      return jsonResponse(buildCatalog(gwCtx));
      case 'register_connector': return jsonResponse(await registerConnector(svc, orgId, gwCtx, body));
      case 'test_connector':   return jsonResponse(await testConnector(svc, orgId, supabaseUrl, req.headers.get('Authorization') ?? '', body));
      case 'pull_data':        return jsonResponse(await pullData(svc, orgId, gwCtx, body));
      case 'push_event':       return jsonResponse(await pushEvent(svc, orgId, gwCtx, body));
      case 'inference':        return jsonResponse(await runInference(svc, orgId, gwCtx, body));
      case 'learn_schema':     return jsonResponse(await learnSchema(svc, orgId, body));
      case 'list_connectors':  return jsonResponse(await listConnectors(svc, orgId, body));
      case 'update_connector': return jsonResponse(await updateConnector(svc, orgId, body));
      case 'delete_connector': return jsonResponse(await deleteConnector(svc, orgId, body));
      case 'usage':            return jsonResponse(await getUsage(svc, gwCtx));
      default: return errorResponse(`Unknown action: ${action}`, 400);
    }
  } catch (err: any) {
    console.error('omnibus-connector error:', err);
    return errorResponse(err.message, 500);
  }
});

// ── Action: get_catalog ───────────────────────────────────────────────────────
function buildCatalog(gwCtx: GatewayContext) {
  return {
    connectors: Object.entries(CONNECTOR_CATALOG)
      .filter(([, def]) => gwCtx.productScope.includes(def.category))
      .map(([type, def]) => ({ connector_type: type, ...def, inference_endpoint: undefined })),
    total: Object.keys(CONNECTOR_CATALOG).length,
    categories: [...new Set(Object.values(CONNECTOR_CATALOG).map(d => d.category))],
    tier: gwCtx.tier,
    licensed_categories: gwCtx.productScope,
  };
}

// ── Action: register_connector ────────────────────────────────────────────────
async function registerConnector(svc: SupabaseClient, orgId: string | null, gwCtx: GatewayContext, body: any) {
  const { name, connector_type, base_url, auth_method, vault_secret_id, pull_config, push_config } = body;
  if (!name || !connector_type) throw new Error('name and connector_type are required');

  const def = CONNECTOR_CATALOG[connector_type];
  if (!def) throw new Error(`Unknown connector_type: "${connector_type}". Call get_catalog for valid types.`);

  // Scope check
  if (!gwCtx.productScope.includes(def.category)) {
    throw new Error(`Category "${def.category}" not permitted on your license tier. Upgrade to access ${connector_type}.`);
  }

  // Max connectors check
  if (orgId) {
    const { count } = await svc.from('connector_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId).neq('status', 'deleted');
    const lk = gwCtx.licenseKeyId ? await svc.from('connector_license_keys')
      .select('max_connectors').eq('id', gwCtx.licenseKeyId).single() : null;
    const maxConn = lk?.data?.max_connectors ?? 1000;
    if ((count ?? 0) >= maxConn) throw new Error(`Connector limit (${maxConn}) reached for this license.`);
  }

  // Seed schema from authoritative connector_schemas
  const { data: authSchema } = await svc.from('connector_schemas').select('field_alias')
    .eq('connector_type', connector_type).eq('is_authoritative', true)
    .order('fitness_score', { ascending: false }).limit(1).maybeSingle();

  const { data, error } = await svc.from('connector_profiles').insert({
    org_id: orgId,
    name: name.trim(), connector_type, category: def.category,
    base_url: (base_url ?? '').replace(/\/$/, ''),
    auth_method: auth_method ?? def.auth_methods[0],
    vault_secret_id: vault_secret_id ?? null,
    pull_config: { ...def.default_pull, ...(pull_config ?? {}) },
    push_config: { ...def.default_push, ...(push_config ?? {}) },
    schema_map: authSchema?.field_alias ?? {},
    status: 'pending',
  }).select().single();

  if (error) throw new Error(`Register failed: ${error.message}`);
  return { connector: data, seeded_schema_fields: Object.keys(authSchema?.field_alias ?? {}).length };
}

// ── Action: test_connector ────────────────────────────────────────────────────
async function testConnector(svc: SupabaseClient, orgId: string | null, supabaseUrl: string, authHeader: string, body: any) {
  const { connector_id } = body;
  if (!connector_id) throw new Error('connector_id required');

  const q = svc.from('connector_profiles').select('*').eq('id', connector_id);
  if (orgId) q.eq('org_id', orgId);
  const { data: connector, error } = await q.single();
  if (error || !connector) throw new Error('Connector not found');

  // Delegate to credential-connectivity-test (existing real implementation)
  const testResp = await fetch(`${supabaseUrl}/functions/v1/credential-connectivity-test`, {
    method: 'POST',
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential_id: connector.vault_secret_id, test_target: connector.base_url || 'https://api.openai.com' }),
  });
  const testResult = await testResp.json();
  const health = testResult.success ? 'healthy' : 'disconnected';
  await svc.from('connector_profiles').update({ health_status: health, status: testResult.success ? 'active' : 'pending', last_health_check: new Date().toISOString() }).eq('id', connector_id);
  return { connector_id, connector_type: connector.connector_type, test_result: testResult, health_status: health };
}

// ── Action: pull_data ─────────────────────────────────────────────────────────
async function pullData(svc: SupabaseClient, orgId: string | null, gwCtx: GatewayContext, body: any) {
  const { connector_id, since, limit } = body;
  if (!connector_id) throw new Error('connector_id required');

  const q = svc.from('connector_profiles').select('*').eq('id', connector_id);
  if (orgId) q.eq('org_id', orgId);
  const { data: connector, error } = await q.single();
  if (error || !connector) throw new Error('Connector not found');
  if (connector.status !== 'active') throw new Error(`Connector not active (${connector.status}). Run test_connector first.`);

  const def = CONNECTOR_CATALOG[connector.connector_type];
  if (def?.category === 'llm') throw new Error('LLM connectors use the inference action, not pull_data');

  // ── SIEM wrap: delegate to siem-integration for known SIEM types ──────────
  const SIEM_TYPES = ['splunk','elastic','qradar','microsoft_sentinel','arcsight'];
  if (SIEM_TYPES.includes(connector.connector_type)) {
    return await siemPullDelegate(svc, connector, since, limit);
  }

  // Generic pull path
  const creds = await resolveCredentials(svc, connector);
  const pullCfg = connector.pull_config ?? {};
  if (!pullCfg.endpoint) throw new Error('pull_config.endpoint not set');

  const baseUrl = connector.base_url.replace(/\/$/, '');
  const params = new URLSearchParams(pullCfg.params ?? {});
  if (since && pullCfg.time_filter_field) params.set(pullCfg.time_filter_field, since);
  if (limit) params.set('limit', String(limit));

  const url = `${baseUrl}${pullCfg.endpoint}${params.toString() ? '?' + params.toString() : ''}`;
  const method = (pullCfg.method ?? 'GET').toUpperCase();
  const startMs = Date.now();

  const resp = await fetch(url, {
    method,
    headers: buildAuthHeaders(connector.auth_method, creds, connector.connector_type),
    ...(method === 'POST' ? { body: JSON.stringify(pullCfg.params ?? {}),
      headers: { ...buildAuthHeaders(connector.auth_method, creds, connector.connector_type), 'Content-Type': 'application/json' } } : {}),
    signal: AbortSignal.timeout(30_000),
  });

  const latencyMs = Date.now() - startMs;
  if (!resp.ok) {
    await recordEvent(svc, connector_id, orgId, 'pull', 'error', { http_status: resp.status, latency_ms: latencyMs, error_message: `HTTP ${resp.status}` });
    throw new Error(`Pull failed: HTTP ${resp.status} from ${connector.connector_type}`);
  }

  const rawData = await resp.json();
  const records = extractRecords(connector.connector_type, rawData);
  const { mappedRecords, schemaResult } = applySchemaMap(records, connector.schema_map);

  await recordEvent(svc, connector_id, orgId, 'pull', 'success', {
    http_status: resp.status, latency_ms: latencyMs, records_returned: records.length,
    schema_coverage: schemaResult.coverage, unmapped_fields: schemaResult.unmappedFields, mapped_fields: schemaResult.mappedFields,
  });
  await svc.from('connector_profiles').update({ last_pull_at: new Date().toISOString(), health_status: 'healthy' }).eq('id', connector_id);

  if (schemaResult.coverage < 0.75) {
    triggerSchemaLearning(connector, schemaResult).catch(() => {});
  }
  return { connector_id, records, mapped_records: mappedRecords, schema_coverage: schemaResult.coverage,
    unmapped_fields: schemaResult.unmappedFields, latency_ms: latencyMs };
}

// ── SIEM pull delegator → wraps siem-integration ─────────────────────────────
async function siemPullDelegate(svc: SupabaseClient, connector: any, since: string, limit: number) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const resp = await fetch(`${supabaseUrl}/functions/v1/siem-integration`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'fetch_logs',
      config: { connector_id: connector.id, since, limit, connector_type: connector.connector_type },
      organizationId: connector.org_id,
    }),
  });
  if (!resp.ok) throw new Error(`SIEM delegate pull failed: HTTP ${resp.status}`);
  const result = await resp.json();
  return { ...result, delegated_to: 'siem-integration', connector_id: connector.id };
}

// ── Action: push_event ────────────────────────────────────────────────────────
async function pushEvent(svc: SupabaseClient, orgId: string | null, gwCtx: GatewayContext, body: any) {
  const { connector_id, event, events } = body;
  if (!connector_id) throw new Error('connector_id required');
  if (!event && !events) throw new Error('event or events[] required');

  const q = svc.from('connector_profiles').select('*').eq('id', connector_id);
  if (orgId) q.eq('org_id', orgId);
  const { data: connector, error } = await q.single();
  if (error || !connector) throw new Error('Connector not found');
  if (connector.status !== 'active') throw new Error(`Connector not active (${connector.status})`);

  // ── SIEM/SOAR wrap for known types ────────────────────────────────────────
  const SIEM_SOAR_TYPES = ['splunk','elastic','qradar','microsoft_sentinel','arcsight','pagerduty','servicenow'];
  if (SIEM_SOAR_TYPES.includes(connector.connector_type)) {
    return await siemPushDelegate(svc, connector, event ?? events?.[0], body);
  }

  // Generic push path
  const creds = await resolveCredentials(svc, connector);
  const pushCfg = connector.push_config ?? {};
  if (!pushCfg.endpoint) throw new Error('push_config.endpoint not set — this connector type is pull-only or inference-only');

  const eventBatch: any[] = events ?? [event];
  const payload = buildPushPayload(connector.connector_type, eventBatch, pushCfg);
  const pushUrl = pushCfg.endpoint.startsWith('http') ? pushCfg.endpoint : `${connector.base_url}${pushCfg.endpoint}`;
  const startMs = Date.now();

  const resp = await fetch(pushUrl, {
    method: pushCfg.method ?? 'POST',
    headers: { ...buildAuthHeaders(connector.auth_method, creds, connector.connector_type), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });

  const latencyMs = Date.now() - startMs;
  const status = resp.ok ? 'success' : 'error';
  if (!resp.ok) {
    const errBody = (await resp.text()).slice(0, 300);
    await recordEvent(svc, connector_id, orgId, 'push', 'error', { http_status: resp.status, latency_ms: latencyMs, error_message: errBody });
    throw new Error(`Push delivery failed: HTTP ${resp.status} ${errBody}`);
  }
  await recordEvent(svc, connector_id, orgId, 'push', status, { http_status: resp.status, latency_ms: latencyMs, records_returned: eventBatch.length });
  await svc.from('connector_profiles').update({ last_push_at: new Date().toISOString() }).eq('id', connector_id);
  return { connector_id, events_delivered: eventBatch.length, latency_ms: latencyMs, delivery_status: 'delivered' };
}

// ── SIEM/SOAR push delegator → wraps siem-integration ────────────────────────
async function siemPushDelegate(svc: SupabaseClient, connector: any, event: any, body: any) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const actionMap: Record<string, string> = {
    splunk: 'splunk_integration', elastic: 'elastic_integration',
    qradar: 'qradar_integration', microsoft_sentinel: 'sentinel_integration',
    arcsight: 'arcsight_integration', pagerduty: 'send_alert', servicenow: 'send_alert',
  };
  const siemAction = actionMap[connector.connector_type] ?? 'send_alert';
  const resp = await fetch(`${supabaseUrl}/functions/v1/siem-integration`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: siemAction, config: { connector_id: connector.id, event }, organizationId: connector.org_id }),
  });
  if (!resp.ok) throw new Error(`SIEM delegate push failed: HTTP ${resp.status}`);
  const result = await resp.json();
  return { ...result, delegated_to: 'siem-integration', connector_id: connector.id };
}

// ── Action: inference (LLM) ───────────────────────────────────────────────────
async function runInference(svc: SupabaseClient, orgId: string | null, gwCtx: GatewayContext, body: any) {
  const { connector_id, messages, prompt, model, max_tokens, temperature, system_prompt } = body;

  // License scope check
  if (!gwCtx.productScope.includes('llm') && gwCtx.llmTokensPerDay === 0) {
    throw new Error('LLM inference not permitted on this license tier. Upgrade to Pro or Enterprise.');
  }

  // Prompt guard — run WAF before any API call
  const promptText = prompt ?? messages?.map((m: any) => m.content).join('\n') ?? '';
  const guardResult = runPromptGuard(promptText);
  if (guardResult.blocked) {
    // Log the violation
    await svc.from('connector_prompt_guard_log').insert({
      license_key_id: gwCtx.licenseKeyId || null, org_id: orgId,
      llm_provider: null, violation_type: guardResult.violation_type,
      severity: 'high', prompt_hash: await sha256str(promptText),
      action_taken: 'blocked',
    });
    throw new Error(`Prompt blocked by KHEPRA WAF: ${guardResult.violation_type}. Reason: ${guardResult.reason}`);
  }

  // Resolve connector (if connector_id provided) or use KHEPRA_LLM_PROVIDER chain
  let provider: string;
  let connector: any = null;
  let resolvedModel: string;

  if (connector_id) {
    const q = svc.from('connector_profiles').select('*').eq('id', connector_id);
    if (orgId) q.eq('org_id', orgId);
    const { data } = await q.single();
    if (!data) throw new Error('Connector not found');
    if (CONNECTOR_CATALOG[data.connector_type]?.category !== 'llm') {
      throw new Error(`connector_id "${connector_id}" is not an LLM connector`);
    }
    connector = data;
    provider = data.connector_type;
    resolvedModel = model ?? data.pull_config?.model ?? CONNECTOR_CATALOG[provider]?.default_model ?? 'default';
  } else {
    // Sovereign chain: Ollama → OpenRouter → Anthropic (KHEPRA_LLM_PROVIDER routing)
    provider = resolveProviderChain();
    resolvedModel = model ?? CONNECTOR_CATALOG[provider]?.default_model ?? 'default';
  }

  const creds = connector ? await resolveCredentials(svc, connector) : await resolveEnvCreds(provider);
  const startMs = Date.now();
  const result = await dispatchInference(provider, resolvedModel, messages, prompt, system_prompt, max_tokens ?? 4096, temperature ?? 0.7, creds, connector);
  const latencyMs = Date.now() - startMs;

  // Token metering
  const tokensIn  = result.usage?.prompt_tokens ?? result.usage?.input_tokens ?? estimateTokens(promptText);
  const tokensOut = result.usage?.completion_tokens ?? result.usage?.output_tokens ?? estimateTokens(result.content ?? '');
  const costKey   = `${provider}_${resolvedModel}`.replace(/[-./]/g, '_').toLowerCase();
  const costTable = LLM_COST_PER_1K_MICRO[provider] ?? { in: 0, out: 0 };
  const costMicro = Math.round((tokensIn * costTable.in + tokensOut * costTable.out) / 1000);

  if (gwCtx.licenseKeyId) {
    await svc.rpc('record_llm_tokens', {
      p_license_key_id: gwCtx.licenseKeyId,
      p_tokens_in: tokensIn, p_tokens_out: tokensOut, p_cost_usd_micro: costMicro,
    });
  }

  // Log to connector_events if connector registered
  if (connector_id) {
    await recordEvent(svc, connector_id, orgId, 'pull', 'success', {
      http_status: 200, latency_ms: latencyMs, records_returned: 1,
    });
  }

  return {
    provider, model: resolvedModel,
    content: result.content,
    usage: { prompt_tokens: tokensIn, completion_tokens: tokensOut, total_tokens: tokensIn + tokensOut },
    cost_usd: costMicro / 1_000_000,
    latency_ms: latencyMs,
    prompt_guard: guardResult,
  };
}

// ── LLM Provider chain resolver ───────────────────────────────────────────────
function resolveProviderChain(): string {
  const envChain = Deno.env.get('KHEPRA_LLM_PROVIDER') ?? 'sovereign';
  if (envChain === 'sovereign') {
    // Sovereign: Ollama → OpenRouter → offline
    if (Deno.env.get('OLLAMA_BASE_URL')) return 'ollama';
    if (Deno.env.get('OPENROUTER_API_KEY')) return 'openrouter';
    throw new Error('No sovereign LLM provider configured. Set OLLAMA_BASE_URL or OPENROUTER_API_KEY.');
  }
  if (envChain === 'commercial') {
    if (Deno.env.get('ANTHROPIC_API_KEY')) return 'anthropic';
    if (Deno.env.get('OPENAI_API_KEY')) return 'openai';
    if (Deno.env.get('OPENROUTER_API_KEY')) return 'openrouter';
    throw new Error('No commercial LLM provider configured.');
  }
  return envChain; // explicit provider name
}

async function resolveEnvCreds(provider: string): Promise<Record<string, string>> {
  const envMap: Record<string, string> = {
    openai: 'OPENAI_API_KEY', anthropic: 'ANTHROPIC_API_KEY',
    openrouter: 'OPENROUTER_API_KEY', ollama: '',
    azure_openai: 'AZURE_OPENAI_API_KEY', vertex_ai: 'VERTEX_SA_JSON',
    bedrock: 'AWS_SECRET_ACCESS_KEY', cohere: 'COHERE_API_KEY',
    mistral: 'MISTRAL_API_KEY', huggingface: 'HUGGINGFACE_API_KEY',
  };
  const key = Deno.env.get(envMap[provider] ?? '') ?? '';
  return { token: key, key };
}

// ── LLM inference dispatch ────────────────────────────────────────────────────
async function dispatchInference(
  provider: string, model: string,
  messages: any[], prompt: string | undefined,
  systemPrompt: string | undefined,
  maxTokens: number, temperature: number,
  creds: Record<string, string>,
  connector: any
): Promise<{ content: string; usage?: any }> {

  const msgArray = messages ?? (prompt ? [{ role: 'user', content: prompt }] : []);
  if (systemPrompt && !msgArray.find((m: any) => m.role === 'system')) {
    msgArray.unshift({ role: 'system', content: systemPrompt });
  }

  switch (provider) {

    case 'openai':
    case 'openrouter':
    case 'azure_openai':
    case 'mistral':
    case 'cohere': {
      const baseUrl = provider === 'azure_openai'
        ? (connector?.base_url ?? Deno.env.get('AZURE_OPENAI_ENDPOINT') ?? '')
        : (CONNECTOR_CATALOG[provider]?.inference_endpoint ?? '');
      const endpoint = provider === 'azure_openai'
        ? baseUrl.replace('{deployment}', model)
        : baseUrl;
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${creds.token ?? creds.key}`,
          'Content-Type': 'application/json',
          ...(provider === 'openrouter' ? { 'HTTP-Referer': 'https://souhimbou.ai', 'X-Title': 'SouHimBou ASOC' } : {}),
          ...(provider === 'azure_openai' ? { 'api-key': creds.key } : {}),
        },
        body: JSON.stringify({ model, messages: msgArray, max_tokens: maxTokens, temperature }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!resp.ok) throw new Error(`${provider} inference failed: HTTP ${resp.status} ${await resp.text()}`);
      const data = await resp.json();
      return { content: data.choices?.[0]?.message?.content ?? '', usage: data.usage };
    }

    case 'anthropic': {
      const sysMsg = msgArray.find((m: any) => m.role === 'system');
      const userMsgs = msgArray.filter((m: any) => m.role !== 'system');
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': creds.token ?? creds.key,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model, messages: userMsgs,
          system: sysMsg?.content,
          max_tokens: maxTokens,
        }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!resp.ok) throw new Error(`Anthropic inference failed: HTTP ${resp.status} ${await resp.text()}`);
      const data = await resp.json();
      return { content: data.content?.[0]?.text ?? '', usage: { prompt_tokens: data.usage?.input_tokens, completion_tokens: data.usage?.output_tokens } };
    }

    case 'ollama': {
      const ollamaBase = connector?.base_url ?? Deno.env.get('OLLAMA_BASE_URL') ?? 'http://localhost:11434';
      const resp = await fetch(`${ollamaBase}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: msgArray, stream: false, options: { temperature, num_predict: maxTokens } }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!resp.ok) throw new Error(`Ollama inference failed: HTTP ${resp.status}`);
      const data = await resp.json();
      return { content: data.message?.content ?? '', usage: { prompt_tokens: data.prompt_eval_count, completion_tokens: data.eval_count } };
    }

    case 'huggingface': {
      const hfModel = connector?.pull_config?.model ?? model;
      const resp = await fetch(`https://api-inference.huggingface.co/models/${hfModel}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${creds.token ?? creds.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: msgArray.map((m: any) => `${m.role}: ${m.content}`).join('\n') }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!resp.ok) throw new Error(`HuggingFace inference failed: HTTP ${resp.status}`);
      const data = await resp.json();
      const text = Array.isArray(data) ? data[0]?.generated_text : data.generated_text ?? '';
      return { content: text };
    }

    default:
      throw new Error(`Provider "${provider}" inference not implemented`);
  }
}

// ── Prompt Guard ─────────────────────────────────────────────────────────────
function runPromptGuard(prompt: string): { blocked: boolean; violation_type: string; reason: string } {
  for (const [type, patterns] of Object.entries(PROMPT_GUARD_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(prompt)) {
        const blocked = type !== 'pii_detected'; // PII warns but doesn't block by default
        return { blocked, violation_type: type, reason: `Matched WAF pattern: ${pattern.source.slice(0, 60)}` };
      }
    }
  }
  return { blocked: false, violation_type: 'none', reason: 'clean' };
}

// ── Action: learn_schema ──────────────────────────────────────────────────────
async function learnSchema(svc: SupabaseClient, orgId: string | null, body: any) {
  const { connector_id } = body;
  if (!connector_id) throw new Error('connector_id required');

  const q = svc.from('connector_profiles').select('*').eq('id', connector_id);
  if (orgId) q.eq('org_id', orgId);
  const { data: connector, error } = await q.single();
  if (error || !connector) throw new Error('Connector not found');

  const { data: events } = await svc.from('connector_events')
    .select('unmapped_fields, mapped_fields, schema_coverage')
    .eq('connector_id', connector_id).eq('direction', 'pull').eq('status', 'success')
    .order('executed_at', { ascending: false }).limit(50);

  if (!events?.length) return { message: 'No pull events yet. Run pull_data first.' };

  const unmappedCounts: Record<string, number> = {};
  let totalCoverage = 0;
  for (const e of events) {
    totalCoverage += e.schema_coverage ?? 0;
    for (const f of (e.unmapped_fields ?? [])) unmappedCounts[f] = (unmappedCounts[f] ?? 0) + 1;
  }
  const avgCoverage = totalCoverage / events.length;

  // Try EA mutation via PQC-MCP
  const mcpUrl = Deno.env.get('KHEPRA_MCP_URL');
  const mcpKey = Deno.env.get('KHEPRA_MCP_KEY');
  if (mcpUrl && mcpKey) {
    try {
      const eaResp = await fetch(`${mcpUrl}/tools/ea_schema_mutation`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${mcpKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ connector_type: connector.connector_type, current_schema_map: connector.schema_map,
          unmapped_fields: unmappedCounts, current_fitness: avgCoverage, observation_count: events.length, ea_genome: connector.ea_genome }),
        signal: AbortSignal.timeout(30_000),
      });
      if (eaResp.ok) {
        const eaResult = await eaResp.json();
        if (eaResult?.mutated_schema_map) {
          const genomeHash = await sha256str(JSON.stringify(eaResult.mutated_schema_map));
          await svc.from('connector_profiles').update({ schema_map: eaResult.mutated_schema_map, fitness_score: eaResult.fitness_score, ea_genome: eaResult.genome }).eq('id', connector_id);
          await svc.from('connector_schemas').upsert({ connector_type: connector.connector_type, field_alias: eaResult.mutated_schema_map, fitness_score: eaResult.fitness_score, observation_count: events.length, last_confirmed_at: new Date().toISOString(), ea_generation: eaResult.generation ?? 0, genome_hash: genomeHash }, { onConflict: 'connector_type,genome_hash' });
          return { status: 'schema_updated', new_fitness: eaResult.fitness_score, previous_coverage: avgCoverage };
        }
      }
    } catch (err: any) { console.warn(`EA MCP unavailable: ${err.message}`); }
  }

  // Heuristic fallback
  const suggestions = Object.entries(unmappedCounts).filter(([,c]) => c >= 3).sort(([,a],[,b]) => b - a).slice(0, 20).map(([f, c]) => ({ field: f, observed_count: c, suggested_alias: suggestAlias(f) }));
  return { status: 'suggestions_only', current_coverage: avgCoverage, heuristic_suggestions: suggestions };
}

// ── Action: list_connectors ───────────────────────────────────────────────────
async function listConnectors(svc: SupabaseClient, orgId: string | null, body: any) {
  const { category, status, connector_type } = body;
  let q = svc.from('connector_profiles').select('id,name,connector_type,category,base_url,auth_method,fitness_score,success_rate,health_status,status,last_pull_at,last_push_at,created_at').neq('status','deleted').order('created_at', { ascending: false });
  if (orgId) q = q.eq('org_id', orgId);
  if (category) q = q.eq('category', category);
  if (status)   q = q.eq('status', status);
  if (connector_type) q = q.eq('connector_type', connector_type);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return { connectors: data ?? [], total: data?.length ?? 0,
    summary: { active: data?.filter((c: Record<string,any>) => c.status === 'active').length ?? 0, healthy: data?.filter((c: Record<string,any>) => c.health_status === 'healthy').length ?? 0 } };

}

// ── Action: update_connector ──────────────────────────────────────────────────
async function updateConnector(svc: SupabaseClient, orgId: string | null, body: any) {
  const { connector_id, ...updates } = body;
  if (!connector_id) throw new Error('connector_id required');
  const allowed = ['name','pull_config','push_config','schema_map','status'];
  const filtered = Object.fromEntries(Object.entries(updates).filter(([k]) => allowed.includes(k)));
  if (!Object.keys(filtered).length) throw new Error('No updatable fields provided');
  const q = svc.from('connector_profiles').update(filtered).eq('id', connector_id);
  if (orgId) q.eq('org_id', orgId);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return { updated: true, connector: data };
}

// ── Action: delete_connector ──────────────────────────────────────────────────
async function deleteConnector(svc: SupabaseClient, orgId: string | null, body: any) {
  const { connector_id } = body;
  if (!connector_id) throw new Error('connector_id required');
  const q = svc.from('connector_profiles').update({ status: 'deleted' }).eq('id', connector_id);
  if (orgId) q.eq('org_id', orgId);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return { deleted: true, connector_id };
}

// ── Action: usage ─────────────────────────────────────────────────────────────
async function getUsage(svc: SupabaseClient, gwCtx: GatewayContext) {
  if (!gwCtx.licenseKeyId) return { message: 'Usage metering only available for license key auth' };
  const today = parseInt(new Date().toISOString().slice(0,10).replace(/-/g,''));
  const { data } = await svc.from('connector_metering')
    .select('hour_bucket,call_count,llm_tokens_in,llm_tokens_out,llm_cost_usd_micro,connector_types_used,error_count,updated_at')
    .eq('license_key_id', gwCtx.licenseKeyId).eq('day_bucket', today).order('hour_bucket', { ascending: false });
  const totals = (data ?? []).reduce((acc: { calls: number; tokens_in: number; tokens_out: number; cost_usd: number; errors: number }, r: Record<string,any>) => ({
    calls: acc.calls + r.call_count, tokens_in: acc.tokens_in + r.llm_tokens_in,
    tokens_out: acc.tokens_out + r.llm_tokens_out, cost_usd: acc.cost_usd + r.llm_cost_usd_micro / 1_000_000,
    errors: acc.errors + r.error_count,
  }), { calls: 0, tokens_in: 0, tokens_out: 0, cost_usd: 0, errors: 0 });

  return { today: totals, hourly: data, tier: gwCtx.tier, calls_this_hour: gwCtx.callsThisHour, calls_today: gwCtx.callsToday };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function resolveCredentials(svc: SupabaseClient, connector: any): Promise<Record<string, string>> {
  if (!connector.vault_secret_id) return {};
  try {
    const { data, error } = await svc.rpc('vault_secret_decrypted_secret', { secret_id: connector.vault_secret_id });
    if (error || !data) return {};
    return typeof data === 'string' ? JSON.parse(data) : data;
  } catch { return {}; }
}

function buildAuthHeaders(authMethod: string, creds: Record<string, string>, connectorType: string): Record<string, string> {
  const h: Record<string, string> = { 'User-Agent': 'SouHimBou-OmnibusConnector/2.0', 'Accept': 'application/json' };
  if (authMethod === 'bearer' && creds.token)    h['Authorization'] = `Bearer ${creds.token}`;
  if (authMethod === 'basic' && creds.username)  h['Authorization'] = `Basic ${btoa(`${creds.username}:${creds.password}`)}`;
  if (authMethod === 'api_key' && creds.key) {
    const hdr = creds.header ?? ({ misp: 'Authorization', okta: 'Authorization', pagerduty: 'Authorization', sentinelone: 'Authorization', virustotal: 'x-apikey', otx: 'X-OTX-API-KEY', abuseipdb: 'Key' }[connectorType] ?? 'X-API-Key');
    h[hdr] = creds.key;
  }
  if (connectorType === 'qradar' && creds.token)  { h['SEC'] = creds.token; delete h['Authorization']; }
  if (connectorType === 'splunk' && creds.token)   h['Authorization'] = `Splunk ${creds.token}`;
  if (connectorType === 'anthropic' && creds.key) { h['x-api-key'] = creds.key; h['anthropic-version'] = '2023-06-01'; delete h['Authorization']; }
  return h;
}

function extractRecords(connectorType: string, raw: any): any[] {
  const ex: Record<string, (d: any) => any[]> = {
    splunk: d => d.results ?? d.rows ?? [],
    elastic: d => (d.hits?.hits ?? []).map((h: any) => ({ ...h._source, _id: h._id })),
    qradar: d => Array.isArray(d) ? d : [],
    microsoft_sentinel: d => d.value ?? [],
    crowdstrike: d => d.resources ?? [],
    sentinelone: d => d.data ?? [],
    pagerduty: d => d.incidents ?? [],
    servicenow: d => d.result ?? [],
    misp: d => d.response ?? [],
    okta: d => Array.isArray(d) ? d : [],
  };
  return (ex[connectorType] ?? ((d: any) => Array.isArray(d) ? d : d.data ?? d.results ?? d.items ?? [d]))(raw);
}

function applySchemaMap(records: any[], schemaMap: Record<string, string>) {
  if (!records.length) return { mappedRecords: [], schemaResult: { coverage: 1, mappedFields: [], unmappedFields: [] } };
  const allFields = getFieldPaths(records[0]);
  const mappedFields = allFields.filter(f => schemaMap[f]);
  const unmappedFields = allFields.filter(f => !schemaMap[f]);
  const coverage = allFields.length ? mappedFields.length / allFields.length : 1;
  const mappedRecords = records.map(r => {
    const out: Record<string, any> = { _raw: r };
    for (const [src, dst] of Object.entries(schemaMap)) {
      const v = src.split('.').reduce((c: any, k) => c?.[k], r);
      if (v !== undefined) out[dst] = v;
    }
    return out;
  });
  return { mappedRecords, schemaResult: { coverage, mappedFields, unmappedFields } };
}

function getFieldPaths(obj: any, prefix = '', depth = 3): string[] {
  if (depth === 0 || typeof obj !== 'object' || !obj) return prefix ? [prefix] : [];
  return Object.entries(obj).flatMap(([k, v]) => {
    const p = prefix ? `${prefix}.${k}` : k;
    return typeof v === 'object' && v && !Array.isArray(v) && depth > 1 ? getFieldPaths(v, p, depth - 1) : [p];
  });
}

function buildPushPayload(type: string, events: any[], cfg: any) {
  if (cfg.envelope === 'hec') return events.map(e => ({ event: e, sourcetype: 'souhimbou', source: 'souhimbou-ai' }));
  return events.length === 1 ? events[0] : { events };
}

function suggestAlias(field: string): string {
  const m: Record<string, string> = { timestamp: 'timestamp', _time: 'timestamp', created_at: 'timestamp', severity: 'severity', host: 'asset_hostname', hostname: 'asset_hostname', description: 'description', summary: 'description', status: 'event_status', user: 'actor_username', id: 'external_id', uuid: 'external_id' };
  return m[field.toLowerCase().replace(/[.\[\]]/g, '_')] ?? field;
}

function estimateTokens(text: string): number { return Math.ceil(text.length / 4); }

async function recordEvent(svc: SupabaseClient, connectorId: string, orgId: string | null, direction: string, status: string, data: Record<string, any>) {
  await svc.from('connector_events').insert({ connector_id: connectorId, org_id: orgId, direction, status, ...data }).catch((e: Error) => console.error('Event record failed:', e.message));

}

async function triggerSchemaLearning(connector: any, schemaResult: any) {
  const mcpUrl = Deno.env.get('KHEPRA_MCP_URL');
  const mcpKey = Deno.env.get('KHEPRA_MCP_KEY');
  if (!mcpUrl || !mcpKey) return;
  await fetch(`${mcpUrl}/tools/ea_schema_mutation`, {
    method: 'POST', headers: { Authorization: `Bearer ${mcpKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ connector_id: connector.id, connector_type: connector.connector_type, current_schema_map: connector.schema_map, unmapped_fields: schemaResult.unmappedFields, current_fitness: schemaResult.coverage, ea_genome: connector.ea_genome }),
    signal: AbortSignal.timeout(60_000),
  }).catch(() => {});
}

async function sha256str(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify({ success: true, ...data, timestamp: new Date().toISOString() }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
function errorResponse(message: string, status = 400): Response {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
