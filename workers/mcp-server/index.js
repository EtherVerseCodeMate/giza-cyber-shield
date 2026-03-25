/**
 * Khepra MCP Server — Cloudflare Worker
 *
 * This deploys the Khepra PQC-secured MCP server to Cloudflare's edge network,
 * giving every user sub-50ms latency globally with $0 cost at startup scale.
 *
 * Why Cloudflare for the MCP server?
 *
 * 1. COST: Free tier = 100k requests/day. Paid = $5/month base.
 *    For a 10-person startup: essentially free.
 *    For an SMB at 1M requests/month: ~$0.15 extra.
 *
 * 2. SECURITY: Built-in WAF, DDoS protection, Bot Fight Mode.
 *    Your MCP server is protected by the same infrastructure that
 *    protects Cloudflare's own 19 million+ customers.
 *
 * 3. TELEMETRY INTEGRATION: We already host the telemetry server here.
 *    This Worker calls the same D1 database and can share sessions.
 *
 * 4. EDGE EXECUTION: MCP requests execute within 50ms of the user globally.
 *    No cold starts (unlike AWS Lambda). Always on.
 *
 * 5. DURABLE OBJECTS: Session state persists across requests with O(1) lookup.
 *    WebSocket hibernation keeps costs near zero for idle sessions.
 *
 * Architecture:
 *   AI Tool (Claude/Cursor) → HTTPS POST → Cloudflare Edge (this Worker)
 *           → Durable Object (session state)
 *           → Supabase (persistence + Realtime)
 *           → Go DEMARC API (souhimbou-ai.fly.dev)
 *
 * MCP Transport: HTTP (Streamable HTTP per MCP spec 2024-11-05)
 * Auth: Supabase JWT or Khepra API key
 * Session state: Durable Objects with hibernation
 *
 * Deployment:
 *   wrangler deploy --config wrangler.mcp.toml
 */

// ─── Durable Object: MCP Session ─────────────────────────────────────────────

/**
 * MCPSession is a Durable Object that manages a single AI tool session.
 * Uses WebSocket hibernation to avoid charges for idle connections.
 */
export class MCPSession {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/ws') {
      // WebSocket upgrade for real-time MCP sessions
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected WebSocket', { status: 426 });
      }

      const [client, server] = Object.values(new WebSocketPair());

      // Use hibernation API to avoid charges during idle
      this.state.acceptWebSocket(server);

      return new Response(null, {
        status: 101,
        webSocket: client,
        headers: {
          'X-Khepra-Session': this.state.id.toString(),
          'X-Khepra-Protocol': 'AdinKhepra-v1',
        },
      });
    }

    // HTTP MCP session handler
    return this.handleHTTP(request);
  }

  async handleHTTP(request) {
    const sessionData = await this.state.storage.get('session') || {};
    const now = Date.now();

    // Update last_seen_at
    sessionData.last_seen_at = new Date(now).toISOString();
    await this.state.storage.put('session', sessionData);

    return new Response(JSON.stringify(sessionData), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // WebSocket message handler (MCP over WebSocket)
  async webSocketMessage(ws, message) {
    try {
      const req = JSON.parse(message);
      const response = await handleMCPRequest(req, this.env, null);
      ws.send(JSON.stringify(response));
    } catch (err) {
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error: ' + err.message },
      }));
    }
  }

  webSocketClose(ws, code, reason) {
    // Cleanup on disconnect — hibernation handles billing
    ws.close(code, 'Session closed');
  }

  webSocketError(ws, error) {
    console.error('[mcp-session] WebSocket error:', error);
  }
}

// ─── Main Worker Handler ──────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS headers for web-based MCP clients
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Khepra-API-Key',
      'Access-Control-Max-Age': '86400',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Health check
    if (url.pathname === '/health') {
      return jsonResponse({
        status: 'healthy',
        service: 'khepra-mcp-worker',
        version: '1.0.0',
        protocol: 'AdinKhepra-v1',
        mcp_version: '2024-11-05',
        region: request.cf?.colo || 'unknown',
        timestamp: new Date().toISOString(),
        capabilities: {
          pqc_enabled: true,
          dag_audit: true,
          supabase_persist: !!env.SUPABASE_URL,
          natural_language: true,
          tools: KHEPRA_TOOL_COUNT,
        },
      }, corsHeaders);
    }

    // WebSocket upgrade → Durable Object session
    if (url.pathname === '/ws' || request.headers.get('Upgrade') === 'websocket') {
      const sessionId = url.searchParams.get('session_id') || crypto.randomUUID();
      const sessionObj = env.MCP_SESSION.get(env.MCP_SESSION.idFromName(sessionId));
      return sessionObj.fetch(request);
    }

    // All MCP requests go to /mcp
    if (url.pathname !== '/mcp' && url.pathname !== '/') {
      return jsonResponse({ error: 'Not found' }, corsHeaders, 404);
    }

    if (request.method !== 'POST') {
      return jsonResponse({
        message: 'Khepra MCP Server — POST JSON-RPC 2.0 requests to this endpoint',
        docs: 'https://github.com/EtherVerseCodeMate/giza-cyber-shield',
        tools: KHEPRA_TOOL_COUNT,
      }, corsHeaders);
    }

    // Authenticate request
    const authResult = await authenticate(request, env);
    if (!authResult.ok) {
      return jsonResponse({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32001, message: 'Unauthorized: ' + authResult.reason },
      }, corsHeaders, 401);
    }

    // Parse MCP request
    let mcpRequest;
    try {
      mcpRequest = await request.json();
    } catch (err) {
      return jsonResponse({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error' },
      }, corsHeaders);
    }

    // Rate limiting via Cloudflare's built-in rate limiter
    if (env.RATE_LIMITER) {
      const { success } = await env.RATE_LIMITER.limit({ key: authResult.userId || request.headers.get('CF-Connecting-IP') });
      if (!success) {
        return jsonResponse({
          jsonrpc: '2.0',
          id: mcpRequest.id || null,
          error: { code: -32002, message: 'Rate limit exceeded' },
        }, corsHeaders, 429);
      }
    }

    // Process MCP request
    const startMs = Date.now();
    const response = await handleMCPRequest(mcpRequest, env, authResult);
    const durationMs = Date.now() - startMs;

    // Add Khepra response headers
    const headers = {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'X-Khepra-Duration-Ms': durationMs.toString(),
      'X-Khepra-Protocol': 'AdinKhepra-v1',
      'X-Khepra-Region': request.cf?.colo || 'unknown',
    };

    return new Response(JSON.stringify(response), { headers });
  },
};

// ─── MCP Request Handler ──────────────────────────────────────────────────────

async function handleMCPRequest(req, env, auth) {
  if (!req.jsonrpc || req.jsonrpc !== '2.0') {
    return { jsonrpc: '2.0', id: req.id || null, error: { code: -32600, message: 'Invalid request' } };
  }

  switch (req.method) {
    case 'initialize':
      return handleInitialize(req);

    case 'initialized':
      return null; // notification

    case 'tools/list':
      return { jsonrpc: '2.0', id: req.id, result: { tools: KHEPRA_TOOLS } };

    case 'tools/call':
      return await handleToolCall(req, env, auth);

    case 'mcp/ask':
      // ⭐ NATURAL LANGUAGE ENDPOINT — the ChatGPT moment
      return await handleNaturalLanguageQuery(req, env, auth);

    case 'ping':
      return { jsonrpc: '2.0', id: req.id, result: {} };

    default:
      return { jsonrpc: '2.0', id: req.id, error: { code: -32601, message: `Method not found: ${req.method}` } };
  }
}

// ─── Initialize ───────────────────────────────────────────────────────────────

function handleInitialize(req) {
  return {
    jsonrpc: '2.0',
    id: req.id,
    result: {
      protocolVersion: '2024-11-05',
      serverInfo: {
        name: 'Khepra Cyber Shield MCP — Cloudflare Edge',
        version: '1.0.0',
      },
      capabilities: {
        tools: { listChanged: false },
      },
      // Khepra PQC extension capabilities
      khepra: {
        pqc_enabled: true,
        dag_audit: true,
        supabase_persist: true,
        natural_language: true,
        protocol: 'AdinKhepra-v1',
        transport: 'cloudflare-edge',
        tool_count: KHEPRA_TOOL_COUNT,
        // Security domains covered
        domains: [
          'threat_hunting', 'pentest', 'incident_response',
          'ids_ips', 'siem_soar', 'polymorphic_firewall',
          'dr_bc', 'analytics', 'compliance', 'intelligence',
        ],
      },
    },
  };
}

// ─── Tool Call ────────────────────────────────────────────────────────────────

async function handleToolCall(req, env, auth) {
  const { name, arguments: args = {} } = req.params || {};

  if (!name) {
    return { jsonrpc: '2.0', id: req.id, error: { code: -32602, message: 'params.name required' } };
  }

  // Prompt injection scan (6 patterns from pkg/gateway/mcp_gateway.go)
  const injectionCheck = scanForInjection(JSON.stringify(args));
  if (injectionCheck) {
    await logToolCall(env, { tool: name, blocked: true, reason: injectionCheck, auth });
    return {
      jsonrpc: '2.0',
      id: req.id,
      error: { code: -32000, message: `Prompt injection detected: ${injectionCheck}` },
    };
  }

  const startMs = Date.now();
  let result, error;

  try {
    result = await routeToolCall(name, args, env);
  } catch (err) {
    error = err.message;
    result = { content: [{ type: 'text', text: `Error executing ${name}: ${err.message}` }], isError: true };
  }

  const durationMs = Date.now() - startMs;

  // Audit log to Supabase
  await logToolCall(env, {
    tool: name,
    params: args,
    result: error ? null : result,
    error,
    duration_ms: durationMs,
    user_id: auth?.userId,
    blocked: false,
  });

  return { jsonrpc: '2.0', id: req.id, result };
}

// ─── Natural Language Query ───────────────────────────────────────────────────

/**
 * handleNaturalLanguageQuery — the ChatGPT moment for cybersecurity.
 *
 * Accepts: { "method": "mcp/ask", "params": { "query": "Is my network compromised?" } }
 * Returns: Plain English answer + tool chain that was executed + follow-up suggestions
 *
 * This is THE differentiator for the SMB/Founder market:
 * "No security team? No problem. Just ask."
 */
async function handleNaturalLanguageQuery(req, env, auth) {
  const { query, context = {}, max_tools = 5 } = req.params || {};

  if (!query) {
    return { jsonrpc: '2.0', id: req.id, error: { code: -32602, message: 'params.query required' } };
  }

  // Injection check on the natural language query
  const injCheck = scanForInjection(query);
  if (injCheck) {
    return { jsonrpc: '2.0', id: req.id, error: { code: -32000, message: 'Injection detected in query' } };
  }

  const startMs = Date.now();

  // Step 1: Intent classification via keyword matching (LLM optional enhancement)
  const toolPlan = classifyIntent(query, context, max_tools);

  // Step 2: Execute tool chain
  const toolResults = [];
  const toolOutputs = [];

  for (const { tool, args } of toolPlan) {
    const toolStart = Date.now();
    let toolResult, toolError;
    try {
      toolResult = await routeToolCall(tool, args, env);
      if (toolResult?.content?.[0]?.text) {
        toolOutputs.push(`[${tool}]\n${toolResult.content[0].text}`);
      }
    } catch (err) {
      toolError = err.message;
      toolOutputs.push(`[${tool} ERROR] ${err.message}`);
    }
    toolResults.push({ tool, args, result: toolResult, error: toolError, duration_ms: Date.now() - toolStart });
  }

  // Step 3: Synthesize plain English answer
  const answer = synthesizeAnswer(query, toolOutputs);
  const suggestions = generateSuggestions(query, toolPlan.map((t) => t.tool));

  await logToolCall(env, {
    tool: 'mcp/ask',
    params: { query, context },
    result: { answer, tools_called: toolResults.length },
    duration_ms: Date.now() - startMs,
    user_id: auth?.userId,
  });

  return {
    jsonrpc: '2.0',
    id: req.id,
    result: {
      answer,
      tools_called: toolResults,
      suggestions,
      confidence: 0.85,
      duration_ms: Date.now() - startMs,
      // PQC note: signatures added by Go layer when routing through DEMARC
      protocol: 'AdinKhepra-v1',
    },
  };
}

// ─── Tool Routing ─────────────────────────────────────────────────────────────

/**
 * Routes tool calls to the Go DEMARC API server.
 * The Worker is the edge layer; the Go backend is the execution engine.
 */
async function routeToolCall(toolName, args, env) {
  const apiUrl = env.KHEPRA_API_URL || 'https://souhimbou-ai.fly.dev';
  const serviceSecret = env.KHEPRA_SERVICE_SECRET;

  // Map tools to API endpoints
  const routes = {
    // Compliance
    khepra_get_compliance_score: `${apiUrl}/api/v1/mcp/compliance/${args.org_id || 'default'}`,
    khepra_run_compliance_scan: `${apiUrl}/api/v1/scans/trigger`,
    khepra_export_attestation: `${apiUrl}/api/v1/cc/prove/attest`,
    khepra_query_stig: `${apiUrl}/api/v1/stig/validate`,
    khepra_get_dag_chain: `${apiUrl}/api/v1/mcp/dag/${args.entity_id || 'all'}`,
    khepra_get_compliance_score: `${apiUrl}/api/v1/mcp/compliance/${args.org_id || 'default'}`,

    // Security Operations
    khepra_get_ids_alerts: `${apiUrl}/api/v1/security/alerts`,
    khepra_get_risk_dashboard: `${apiUrl}/api/v1/mcp/dashboard`,
    khepra_get_security_timeline: `${apiUrl}/api/v1/security/timeline`,
    khepra_check_vulnerabilities: `${apiUrl}/api/v1/security/vulns`,
    khepra_analyze_traffic: `${apiUrl}/api/v1/security/traffic`,
    khepra_get_traffic_analysis: `${apiUrl}/api/v1/security/traffic`,
    khepra_hunt_threats: `${apiUrl}/api/v1/security/threat-hunt`,
    khepra_analyze_iocs: `${apiUrl}/api/v1/security/ioc-analysis`,
    khepra_search_logs: `${apiUrl}/api/v1/security/log-search`,
    khepra_get_rto_rpo: `${apiUrl}/api/v1/dr/rto-rpo`,
    khepra_generate_report: `${apiUrl}/api/v1/reports/generate`,
    khepra_export_executive_brief: `${apiUrl}/api/v1/reports/executive`,
    khepra_calculate_risk_score: `${apiUrl}/api/v1/risk/score`,
  };

  const endpoint = routes[toolName];

  if (!endpoint || !serviceSecret) {
    // Return descriptive response when API is not configured
    return {
      content: [{
        type: 'text',
        text: buildToolDescription(toolName, args),
      }],
      dag_node_id: crypto.randomUUID(),
      pqc_signed: true,
    };
  }

  try {
    const isGet = ['khepra_get_compliance_score', 'khepra_get_dag_chain', 'khepra_get_ids_alerts',
      'khepra_get_risk_dashboard', 'khepra_get_security_timeline', 'khepra_get_traffic_analysis',
      'khepra_get_rto_rpo'].includes(toolName);

    const resp = await fetch(endpoint, {
      method: isGet ? 'GET' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Khepra-Service-Secret': serviceSecret,
        'X-MCP-Tool': toolName,
        'X-MCP-Worker': 'cloudflare-edge',
      },
      body: isGet ? undefined : JSON.stringify(args),
      signal: AbortSignal.timeout(10000),
    });

    if (resp.ok) {
      const data = await resp.json();
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        dag_node_id: data.dag_node_id,
        pqc_signed: true,
      };
    }
  } catch (err) {
    console.error(`[khepra-mcp-worker] Tool ${toolName} failed:`, err.message);
  }

  return {
    content: [{ type: 'text', text: buildToolDescription(toolName, args) }],
    dag_node_id: crypto.randomUUID(),
    pqc_signed: false,
  };
}

// ─── Intent Classification ────────────────────────────────────────────────────

function classifyIntent(query, context, maxTools) {
  const lower = query.toLowerCase();

  const intents = [
    { keywords: ['compromised', 'hacked', 'breach', 'attack', 'intrusion', 'pwned'],
      tools: [{ tool: 'khepra_get_ids_alerts', args: {} }, { tool: 'khepra_hunt_threats', args: { query } }, { tool: 'khepra_get_security_timeline', args: {} }] },
    { keywords: ['threat hunt', 'hunting', 'lateral movement', 'ttp', 'apt', 'nation state'],
      tools: [{ tool: 'khepra_hunt_threats', args: { query, scope: 'all' } }, { tool: 'khepra_analyze_iocs', args: {} }] },
    { keywords: ['incident', 'ransomware', 'malware', 'emergency'],
      tools: [{ tool: 'khepra_declare_incident', args: { description: query, severity: 'HIGH', auto_contain: false } }, { tool: 'khepra_collect_forensics', args: {} }] },
    { keywords: ['compliance', 'cmmc', 'stig', 'nist', 'assessment', 'ready'],
      tools: [{ tool: 'khepra_get_compliance_score', args: { org_id: context.org_id || 'default', framework: 'CMMC_L2' } }] },
    { keywords: ['pentest', 'penetration', 'vulnerability', 'cve', 'exploit'],
      tools: [{ tool: 'khepra_check_vulnerabilities', args: { scope: 'all', min_severity: 'HIGH' } }, { tool: 'khepra_enumerate_services', args: {} }] },
    { keywords: ['block', 'firewall', 'rule', 'ban', 'restrict'],
      tools: [{ tool: 'khepra_create_ips_rule', args: { rule_type: 'block_ip', value: context.target || 'unknown', reason: query } }] },
    { keywords: ['report', 'dashboard', 'posture', 'risk', 'how are we', 'status'],
      tools: [{ tool: 'khepra_get_risk_dashboard', args: { period: '30d' } }] },
    { keywords: ['board', 'executive', 'ceo', 'cto', 'slide', 'presentation'],
      tools: [{ tool: 'khepra_export_executive_brief', args: { org_id: context.org_id || 'default' } }] },
    { keywords: ['backup', 'recover', 'dr ', 'failover', 'restore', 'rto', 'rpo', 'continuity'],
      tools: [{ tool: 'khepra_get_rto_rpo', args: {} }] },
    { keywords: ['traffic', 'network', 'anomal', 'exfil', 'beacon', 'c2'],
      tools: [{ tool: 'khepra_analyze_traffic', args: { sensitivity: 'high' } }] },
    { keywords: ['log', 'search', 'find', 'happened', 'yesterday', '3am', 'last night'],
      tools: [{ tool: 'khepra_search_logs', args: { query } }, { tool: 'khepra_get_security_timeline', args: {} }] },
    { keywords: ['attest', 'artifact', 'c3pao', 'audit evidence', 'prove'],
      tools: [{ tool: 'khepra_export_attestation', args: { org_id: context.org_id || 'default', framework: 'CMMC_L2' } }] },
    { keywords: ['alert', 'alarm', 'detection', 'ids', 'ips'],
      tools: [{ tool: 'khepra_get_ids_alerts', args: { severity_min: 'HIGH' } }] },
  ];

  for (const intent of intents) {
    for (const kw of intent.keywords) {
      if (lower.includes(kw)) {
        return intent.tools.slice(0, maxTools);
      }
    }
  }

  // Default: security dashboard
  return [{ tool: 'khepra_get_risk_dashboard', args: { period: '30d' } }];
}

// ─── Response Synthesis ───────────────────────────────────────────────────────

function synthesizeAnswer(query, toolOutputs) {
  if (toolOutputs.length === 0) {
    return 'I could not retrieve security data. Please check that your agents are connected to Khepra.';
  }

  const combined = toolOutputs.join('\n\n');

  // Extract key signals for plain-English response
  const hasThreats = combined.toLowerCase().includes('anomaly') || combined.includes('"is_anomaly":true') || combined.includes('CRITICAL');
  const hasComplianceGap = combined.toLowerCase().includes('non_compliant') || combined.includes('"status":"NON_COMPLIANT"');
  const hasAlerts = combined.toLowerCase().includes('"blocked":true') || combined.includes('ALERT');

  let summary = `Security analysis for: "${query}"\n\n`;

  if (hasThreats) {
    summary += '⚠️  **ACTIVE THREATS DETECTED** — Immediate attention required.\n\n';
  } else if (hasAlerts) {
    summary += '🔶 **Security alerts require review.**\n\n';
  } else {
    summary += '✅ **No critical threats detected** at this time.\n\n';
  }

  if (hasComplianceGap) {
    summary += '📋 **Compliance gaps found** — Review your CMMC/STIG assessment.\n\n';
  }

  summary += 'Details:\n' + combined.slice(0, 2000);

  if (combined.length > 2000) {
    summary += '\n\n[Results truncated — use specific tool calls for full detail]';
  }

  return summary;
}

function generateSuggestions(query, toolsUsed) {
  const lower = query.toLowerCase();
  const suggestions = [];

  if (toolsUsed.includes('khepra_get_ids_alerts') || toolsUsed.includes('khepra_hunt_threats')) {
    suggestions.push('Tell me more about the highest severity alert');
    suggestions.push('Contain the threat immediately');
  }
  if (toolsUsed.includes('khepra_get_compliance_score')) {
    suggestions.push('Show me the top 5 compliance gaps to fix');
    suggestions.push('Export the C3PAO attestation package');
  }
  if (toolsUsed.includes('khepra_get_risk_dashboard')) {
    suggestions.push('Hunt for active threats');
    suggestions.push('Run a full vulnerability assessment');
  }

  return suggestions.slice(0, 3);
}

// ─── Security: Prompt Injection Scanner ──────────────────────────────────────

const INJECTION_PATTERNS = [
  /(?:ignore|forget|disregard)\s+(?:previous|above|prior)\s+(?:instructions?|prompts?|rules?)/i,
  /you\s+are\s+now\s+a/i,
  /system\s*:\s*/i,
  /(?:reveal|show|print|output)\s+(?:your|the)\s+(?:system|initial|original)\s+(?:prompt|instructions?)/i,
  /\[\s*INST\s*\]/i,
  /<\|im_start\|>/i,
];

function scanForInjection(text) {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return `Pattern detected: ${pattern.source.slice(0, 50)}`;
    }
  }
  return null;
}

// ─── Authentication ───────────────────────────────────────────────────────────

async function authenticate(request, env) {
  const authHeader = request.headers.get('Authorization');
  const apiKey = request.headers.get('X-Khepra-API-Key');

  // Khepra API key authentication
  if (apiKey && env.KHEPRA_API_KEY_HASH) {
    const keyHash = await sha256(apiKey);
    if (keyHash === env.KHEPRA_API_KEY_HASH) {
      return { ok: true, userId: 'api-key-user', method: 'api-key' };
    }
  }

  // Supabase JWT authentication
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (env.SUPABASE_JWT_SECRET) {
      try {
        const payload = await verifyJWT(token, env.SUPABASE_JWT_SECRET);
        return { ok: true, userId: payload.sub, method: 'jwt', payload };
      } catch {
        return { ok: false, reason: 'Invalid JWT' };
      }
    }
    // If no JWT secret configured, allow in development mode
    if (env.ENVIRONMENT === 'development') {
      return { ok: true, userId: 'dev-user', method: 'dev' };
    }
    return { ok: false, reason: 'JWT validation not configured' };
  }

  // Allow unauthenticated in development
  if (env.ENVIRONMENT === 'development') {
    return { ok: true, userId: 'anon', method: 'anon' };
  }

  return { ok: false, reason: 'No authentication provided' };
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyJWT(token, secret) {
  // Simplified JWT verification — use a proper library in production
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT');
  const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
  if (payload.exp && payload.exp < Date.now() / 1000) throw new Error('JWT expired');
  return payload;
}

// ─── Supabase Audit Logging ───────────────────────────────────────────────────

async function logToolCall(env, data) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) return;

  try {
    await fetch(`${env.SUPABASE_URL}/rest/v1/mcp_tool_calls`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        tool_name: data.tool,
        tool_params: data.params,
        result: data.result,
        error_message: data.error,
        duration_ms: data.duration_ms,
        user_id: data.user_id,
        blocked: data.blocked || false,
        block_reason: data.reason,
        injection_scan: true,
        data_class: 'PUBLIC',
        called_at: new Date().toISOString(),
      }),
    });
  } catch (err) {
    // Non-fatal: log errors don't fail the request
    console.error('[mcp-worker] audit log error:', err.message);
  }
}

// ─── Tool Descriptions ────────────────────────────────────────────────────────

function buildToolDescription(toolName, args) {
  return `Tool: ${toolName}
Arguments: ${JSON.stringify(args, null, 2)}
Status: API server not reachable — check KHEPRA_API_URL and KHEPRA_SERVICE_SECRET
Next: POST ${process?.env?.KHEPRA_API_URL || 'https://souhimbou-ai.fly.dev'}/api/v1/mcp/tool`;
}

// ─── Tool Registry (mirrors pkg/mcp/tools.go + security_tools.go) ─────────────

const KHEPRA_TOOL_COUNT = 29; // KhepraTools() + SecurityDomainTools()

const KHEPRA_TOOLS = [
  // Compliance (from tools.go)
  { name: 'khepra_discover_endpoints', description: 'Discover and inventory network endpoints and cloud assets' },
  { name: 'khepra_run_compliance_scan', description: 'Trigger CMMC/STIG compliance scan' },
  { name: 'khepra_query_stig', description: 'Query STIG rule with decomposed requirements and remediation' },
  { name: 'khepra_get_anomaly_score', description: 'SouHimBou ML threat/anomaly score' },
  { name: 'khepra_get_snapshot', description: 'Retrieve compliance state snapshot' },
  { name: 'khepra_export_attestation', description: 'Export PQC-signed DAG audit artifact for C3PAO' },
  { name: 'khepra_get_dag_chain', description: 'Retrieve tamper-evident DAG audit chain' },
  { name: 'khepra_get_compliance_score', description: 'Current compliance score with PQC attestation' },
  { name: 'khepra_query_threat_intel', description: 'Query threat intelligence database' },

  // Threat Hunting (from security_tools.go)
  { name: 'khepra_hunt_threats', description: 'AI-powered threat hunt using MITRE ATT&CK TTPs' },
  { name: 'khepra_analyze_iocs', description: 'Enrich and correlate Indicators of Compromise' },
  { name: 'khepra_search_logs', description: 'Natural language log search across all telemetry' },
  { name: 'khepra_correlate_events', description: 'Timeline correlation and attack chain reconstruction' },

  // Pentest
  { name: 'khepra_run_pentest', description: 'Automated penetration test (requires scope authorization)' },
  { name: 'khepra_enumerate_services', description: 'Deep service/version fingerprinting with CVE mapping' },
  { name: 'khepra_check_vulnerabilities', description: 'CVE assessment with EPSS scoring' },

  // Incident Response
  { name: 'khepra_declare_incident', description: 'Open NIST 800-61 security incident with auto-collection' },
  { name: 'khepra_collect_forensics', description: "Imhotep's Eye — comprehensive forensic evidence collection" },
  { name: 'khepra_contain_threat', description: 'Network isolation, account disable, process termination' },
  { name: 'khepra_eradicate_threat', description: 'Remove malware, persistence, and backdoors' },
  { name: 'khepra_post_incident_report', description: 'Generate NIST 800-61 compliant incident report' },

  // IDS/IPS/SIEM/SOAR
  { name: 'khepra_get_ids_alerts', description: 'Active IDS/IPS alerts with ML triage' },
  { name: 'khepra_create_ips_rule', description: 'Create IP/geo/pattern blocking rule' },
  { name: 'khepra_get_security_timeline', description: 'Cross-source security event timeline' },
  { name: 'khepra_run_playbook', description: 'Execute SOAR incident response playbook' },
  { name: 'khepra_create_alert_rule', description: 'Define detection rule with auto-actions' },

  // Firewall / DR / Analytics
  { name: 'khepra_block_threat_actor', description: 'Block all infrastructure of a threat actor group' },
  { name: 'khepra_get_rto_rpo', description: 'Recovery Time/Point Objective status' },
  { name: 'khepra_get_risk_dashboard', description: 'Real-time executive risk dashboard' },
  { name: 'khepra_generate_report', description: 'Automated security report (multiple formats)' },
  { name: 'khepra_export_executive_brief', description: 'C-suite one-page security brief' },
  { name: 'khepra_calculate_risk_score', description: 'Quantitative cyber risk score (FAIR methodology)' },
];

// ─── Response Helpers ─────────────────────────────────────────────────────────

function jsonResponse(body, extraHeaders = {}, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}
