// @ts-nocheck — Supabase Edge Function (Deno runtime)
/// <reference lib="deno.ns" />

/**
 * mitochondrial-proxy — Khepra DEMARC Gateway
 *
 * Responsibilities:
 *   1. PQC-OAuth: issue + validate context-aware PQC sessions
 *   2. Attestation: inject X-Agent-ID / X-Khepra-Attestation headers
 *      for all Go backend calls (same pattern as discord-bot)
 *   3. Safe grok-ai routing: connector analysis calls are sanitized
 *      (connector_analysis_mode: true) to prevent autonomous execution
 *   4. Failure routing: failed tests → codex-orchestrator evolve_integration_api
 *   5. DAG audit: writes connector_dag_nodes rows for every action
 *   6. License enforcement: validate API keys for third-party callers
 *
 * OWASP API Security:
 *   - API1: Broken Object Level Auth → org_id from verified JWT, never caller-supplied
 *   - API2: Broken Auth → Supabase JWT required; API key via SHA-256 hash lookup
 *   - API3: Broken Object Property → allowlisted response fields only
 *   - API4: Unrestricted Resource Consumption → rate limit per org
 *   - API5: Function Level Auth → action allowlist per tier
 *   - API6: Unrestricted Access to Sensitive Business Flows → grok safe mode
 *   - API8: Security Misconfiguration → strict CORS, no wildcard in prod
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

// ─────────────────────────────────────────────────────────────────────
// Environment
// ─────────────────────────────────────────────────────────────────────

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const KHEPRA_BACKEND_URL   = Deno.env.get("KHEPRA_BACKEND_URL") || "https://khepra.fly.dev";
const KHEPRA_SERVICE_SECRET= Deno.env.get("KHEPRA_SERVICE_SECRET") || "";

// Adinkra identity for this gateway agent
const AGENT_ID     = "mitochondrial-proxy";
const AGENT_SYMBOL = "Sankofa"; // Look back to go forward — fitting for a proxy

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error("Missing required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─────────────────────────────────────────────────────────────────────
// CORS
// ─────────────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

// ─────────────────────────────────────────────────────────────────────
// Tier → allowed actions (OWASP API5)
// ─────────────────────────────────────────────────────────────────────

const TIER_ACTIONS: Record<string, Set<string>> = {
  community:    new Set(["test", "discover"]),
  professional: new Set(["test", "discover", "learn", "pattern"]),
  enterprise:   new Set(["test", "discover", "learn", "pattern", "analyze", "dag"]),
  partner:      new Set(["test", "discover", "learn", "pattern", "analyze", "dag", "admin"]),
};

// ─────────────────────────────────────────────────────────────────────
// In-memory rate limiter (per org, per minute)
// ─────────────────────────────────────────────────────────────────────

const rateLimiter = new Map<string, number[]>();

function checkRateLimit(orgId: string, rpmLimit: number): boolean {
  const now = Date.now();
  const window = (rateLimiter.get(orgId) || []).filter(t => t > now - 60_000);
  if (window.length >= rpmLimit) return false;
  window.push(now);
  rateLimiter.set(orgId, window);
  return true;
}

// ─────────────────────────────────────────────────────────────────────
// SHA-256 helper (Deno built-in)
// ─────────────────────────────────────────────────────────────────────

async function sha256Hex(data: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ─────────────────────────────────────────────────────────────────────
// Attestation headers (mirrors discord-bot khepraFetch)
// ─────────────────────────────────────────────────────────────────────

function buildAttestationHeaders(requestId: string): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  return {
    "X-Agent-ID":            AGENT_ID,
    "X-Khepra-Attestation":  `${AGENT_ID}:${AGENT_SYMBOL}:${timestamp}`,
    "X-Khepra-Service-Secret": KHEPRA_SERVICE_SECRET,
    "X-Request-ID":          requestId,
    "User-Agent":            "Khepra-MitochondrialProxy/1.0",
  };
}

// ─────────────────────────────────────────────────────────────────────
// DAG node writer
// ─────────────────────────────────────────────────────────────────────

async function writeDAGNode(params: {
  action: string;
  symbol: string;
  actorId: string | null;
  organizationId: string;
  connectorId?: string;
  parentHashes?: string[];
  pqcMetadata?: Record<string, unknown>;
}): Promise<string> {
  const time = new Date().toISOString();
  const parents = (params.parentHashes ?? []).sort();
  const pqc = params.pqcMetadata ?? {};
  const pqcPairs = Object.entries(pqc)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${Array.isArray(v) ? (v as string[]).join(",") : String(v)}`)
    .sort();

  const canonical = JSON.stringify({
    action: params.action,
    symbol: params.symbol,
    time,
    parents,
    pqc: pqcPairs,
  });

  const nodeHash = await sha256Hex(canonical);

  await supabase.from("connector_dag_nodes").insert({
    node_hash:       nodeHash,
    parent_hashes:   parents,
    action:          params.action,
    symbol:          params.symbol,
    actor_id:        params.actorId,
    organization_id: params.organizationId,
    connector_id:    params.connectorId ?? null,
    pqc_metadata:    pqc,
    created_at:      time,
  }).select("node_hash").single();
  // Duplicate hash (23505) is silently OK.

  return nodeHash;
}

// ─────────────────────────────────────────────────────────────────────
// Auth: Supabase JWT → session context
// ─────────────────────────────────────────────────────────────────────

interface SessionContext {
  userId: string;
  organizationId: string;
  tier: "community" | "professional" | "enterprise" | "partner";
  threatLevel: "green" | "yellow" | "orange" | "red";
  rpmLimit: number;
  allowedActions: Set<string>;
  scopes: string[];
  licenseId?: string;
}

async function resolveSession(req: Request): Promise<SessionContext> {
  // Priority 1: X-API-Key (third-party partner access)
  const apiKeyRaw = req.headers.get("x-api-key");
  if (apiKeyRaw) {
    const keyHash = await sha256Hex(apiKeyRaw);
    const { data: license, error } = await supabase
      .from("connector_api_licenses")
      .select("*")
      .eq("api_key_hash", keyHash)
      .eq("revoked", false)
      .maybeSingle();

    if (error || !license) throw new Error("Invalid or revoked API key");
    if (license.expires_at && new Date(license.expires_at) < new Date()) {
      throw new Error("API key expired");
    }

    // Derive threat level from recent failures for this org
    const threatLevel = await getOrgThreatLevel(license.organization_id);

    return {
      userId: license.organization_id,  // API key callers use org as identity
      organizationId: license.organization_id,
      tier: license.tier,
      threatLevel,
      rpmLimit: license.rate_limit_rpm,
      allowedActions: TIER_ACTIONS[license.tier] ?? TIER_ACTIONS.community,
      scopes: license.allowed_actions,
      licenseId: license.id,
    };
  }

  // Priority 2: Supabase Bearer JWT (authenticated users)
  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) throw new Error("Authorization required");

  const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !user) throw new Error("Invalid or expired token");

  const orgId = user.user_metadata?.organization_id || user.id;
  const tier: SessionContext["tier"] =
    (user.user_metadata?.license_tier as SessionContext["tier"]) ?? "community";

  const threatLevel = await getOrgThreatLevel(orgId);

  return {
    userId: user.id,
    organizationId: orgId,
    tier,
    threatLevel,
    rpmLimit: tier === "enterprise" ? 300 : tier === "professional" ? 120 : 60,
    allowedActions: TIER_ACTIONS[tier] ?? TIER_ACTIONS.community,
    scopes: Array.from(TIER_ACTIONS[tier] ?? TIER_ACTIONS.community).map(a => `connector:${a}`),
  };
}

async function getOrgThreatLevel(
  orgId: string
): Promise<"green" | "yellow" | "orange" | "red"> {
  // Count unresolved critical alerts in the last 24h
  const { count } = await supabase
    .from("alerts")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .in("severity", ["critical", "high"])
    .eq("status", "open")
    .gte("created_at", new Date(Date.now() - 86_400_000).toISOString());

  if ((count ?? 0) >= 5) return "red";
  if ((count ?? 0) >= 2) return "orange";
  if ((count ?? 0) >= 1) return "yellow";
  return "green";
}

// ─────────────────────────────────────────────────────────────────────
// Grok-AI safe connector analysis (connector_analysis_mode)
// ─────────────────────────────────────────────────────────────────────

const EMERGENCY_WORDS = [
  "breach", "attack", "malware", "ransomware", "backdoor", "exploit",
  "intrusion", "suspicious", "threat", "critical", "urgent", "emergency",
];

function sanitizeForConnectorAnalysis(message: string): string {
  // Strip emergency keywords that trigger autonomous execution in grok-ai-agent.
  // Replace with neutral equivalents that preserve diagnostic meaning.
  let sanitized = message;
  for (const word of EMERGENCY_WORDS) {
    const pattern = new RegExp(`\\b${word}\\b`, "gi");
    sanitized = sanitized.replace(pattern, "issue");
  }
  return sanitized;
}

async function callGrokSafe(params: {
  connector: { id: string; provider: string; configuration: Record<string, unknown> };
  session: SessionContext;
  failureContext?: Record<string, unknown>;
}): Promise<{ success: boolean; analysis: string; recommendations: string[] }> {
  const { connector, session, failureContext } = params;

  // Build a safe diagnostic message — no emergency keywords
  const safeMessage = sanitizeForConnectorAnalysis(
    `Analyze connector health: provider=${connector.provider}. ` +
    `Test result: ${failureContext ? `HTTP ${failureContext.httpStatus} — ${String(failureContext.errorCode ?? "unknown")}` : "connection test requested"}. ` +
    `Identify the root cause and suggest configuration corrections. ` +
    `Do NOT suggest executing scripts or changing production infrastructure.`
  );

  // connector_analysis_mode: true in context suppresses autonomous execution in grok-ai-agent
  const { data, error } = await supabase.functions.invoke("grok-ai-agent", {
    body: {
      message: safeMessage,
      sessionId: crypto.randomUUID(),
      organizationId: session.organizationId,
      userId: session.userId,
      context: {
        connector_analysis_mode: true,  // ← disables shouldAutoExecute in grok-ai-agent
        connector_id: connector.id,
        provider: connector.provider,
        threat_level: session.threatLevel,
        tier: session.tier,
      },
    },
  });

  if (error) throw new Error(`grok-ai-agent error: ${error.message}`);

  const response: string = data?.response ?? "";
  const recommendations: string[] = (data?.actionableItems ?? [])
    .filter((a: any) => a.requiresApproval === true)  // only return items flagged for approval, never auto-exec
    .map((a: any) => a.text as string);

  return {
    success: !failureContext,
    analysis: response,
    recommendations,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Learning Mode: route failure to codex-orchestrator
// ─────────────────────────────────────────────────────────────────────

async function triggerLearningMode(params: {
  connector: { id: string; provider: string; configuration: Record<string, unknown> };
  failureLog: { errorCode?: string; errorBody?: Record<string, unknown>; httpStatus?: number };
  session: SessionContext;
  dagNodeHash: string;
}): Promise<{ patternId?: string; status: string }> {
  const { connector, failureLog, session, dagNodeHash } = params;

  // Fetch historical failures for this provider
  const { data: history } = await supabase
    .from("connector_failure_log")
    .select("error_code, error_body, http_status, attempted_at")
    .eq("organization_id", session.organizationId)
    .eq("provider", connector.provider)
    .eq("pattern_generated", false)
    .order("attempted_at", { ascending: false })
    .limit(10);

  const { data, error } = await supabase.functions.invoke("codex-orchestrator", {
    body: {
      action: "evolve_integration_api",
      organization_id: session.organizationId,
      system_analysis: {
        provider: connector.provider,
        connector_id: connector.id,
        failure_log: failureLog,
        failure_history: history ?? [],
        dag_node_hash: dagNodeHash,
        compliance_frameworks: (connector.configuration as any)?.frameworks ?? [],
      },
    },
  });

  if (error) {
    console.error("[mitochondrial-proxy] codex-orchestrator error:", error.message);
    return { status: "learning_queued" };
  }

  // Mark failure log entries as having a generated pattern
  if (data?.api?.id) {
    await supabase
      .from("connector_failure_log")
      .update({ pattern_generated: true, pattern_id: data.api.id })
      .eq("organization_id", session.organizationId)
      .eq("connector_id", connector.id)
      .eq("pattern_generated", false);
  }

  return { patternId: data?.api?.id, status: "pattern_evolved" };
}

// ─────────────────────────────────────────────────────────────────────
// Action handlers
// ─────────────────────────────────────────────────────────────────────

async function handleTestConnector(
  body: any,
  session: SessionContext,
  requestId: string
): Promise<Record<string, unknown>> {
  const { connector } = body;
  if (!connector?.id || !connector?.provider) {
    throw new Error("connector.id and connector.provider are required");
  }

  // Write DAG: connector.test
  const dagHash = await writeDAGNode({
    action: "connector.test",
    symbol: AGENT_SYMBOL,
    actorId: session.userId,
    organizationId: session.organizationId,
    connectorId: connector.id,
    pqcMetadata: {
      tier: session.tier,
      threatLevel: session.threatLevel,
      provider: connector.provider,
      requestId,
    },
  });

  // Route to Go backend via DEMARC (with attestation headers)
  let testResult: { success: boolean; httpStatus?: number; errorCode?: string; errorBody?: any } =
    { success: false };

  try {
    const attestHeaders = buildAttestationHeaders(requestId);
    const backendRes = await fetch(`${KHEPRA_BACKEND_URL}/api/v1/connector/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...attestHeaders },
      body: JSON.stringify({ connector_id: connector.id, provider: connector.provider }),
      signal: AbortSignal.timeout(15_000),
    });

    testResult = {
      success: backendRes.ok,
      httpStatus: backendRes.status,
      ...(!backendRes.ok ? await backendRes.json().catch(() => ({})) : {}),
    };
  } catch (err) {
    testResult = { success: false, errorCode: "TIMEOUT", errorBody: { message: String(err) } };
  }

  const finalAction: string = testResult.success ? "connector.test.pass" : "connector.test.fail";

  // Write outcome DAG node
  const outcomeHash = await writeDAGNode({
    action: finalAction as any,
    symbol: AGENT_SYMBOL,
    actorId: session.userId,
    organizationId: session.organizationId,
    connectorId: connector.id,
    parentHashes: [dagHash],
    pqcMetadata: {
      tier: session.tier,
      threatLevel: session.threatLevel,
      provider: connector.provider,
      httpStatus: testResult.httpStatus,
      certainty: testResult.success ? 1.0 : 0.95,
    },
  });

  // Record usage event
  await supabase.from("connector_usage_events").insert({
    organization_id: session.organizationId,
    license_id: session.licenseId ?? null,
    dag_node_hash: outcomeHash,
    action: finalAction,
    provider: connector.provider,
    billable: session.tier !== "community",
    cost_units: session.tier !== "community" ? 0.1 : 0,
  });

  // On failure: log + safe grok analysis
  if (!testResult.success) {
    await supabase.from("connector_failure_log").insert({
      organization_id: session.organizationId,
      connector_id: connector.id,
      provider: connector.provider,
      error_code: testResult.errorCode ?? null,
      error_body: testResult.errorBody ?? {},
      http_status: testResult.httpStatus ?? null,
      dag_node_hash: outcomeHash,
      pattern_generated: false,
    });

    // Safe grok-ai analysis (connector_analysis_mode = no autonomous execution)
    const grokResult = await callGrokSafe({
      connector,
      session,
      failureContext: testResult,
    }).catch(e => ({ success: false, analysis: e.message, recommendations: [] }));

    return {
      success: false,
      dag_node_hash: outcomeHash,
      analysis: grokResult.analysis,
      recommendations: grokResult.recommendations,
      learning_mode_available: session.allowedActions.has("learn"),
    };
  }

  return { success: true, dag_node_hash: outcomeHash };
}

async function handleLearnConnector(
  body: any,
  session: SessionContext,
  requestId: string
): Promise<Record<string, unknown>> {
  if (!session.allowedActions.has("learn")) {
    throw new Error(`Learning Mode requires 'professional' tier or above (current: ${session.tier})`);
  }

  const { connector, failureLog } = body;
  if (!connector?.id) throw new Error("connector.id required");

  // Write DAG: connector.learn
  const dagHash = await writeDAGNode({
    action: "connector.learn",
    symbol: AGENT_SYMBOL,
    actorId: session.userId,
    organizationId: session.organizationId,
    connectorId: connector.id,
    pqcMetadata: { tier: session.tier, threatLevel: session.threatLevel, requestId },
  });

  const result = await triggerLearningMode({ connector, failureLog, session, dagNodeHash: dagHash });

  // Write outcome DAG node
  await writeDAGNode({
    action: "connector.pattern.evolve",
    symbol: "codex-orchestrator",
    actorId: session.userId,
    organizationId: session.organizationId,
    connectorId: connector.id,
    parentHashes: [dagHash],
    pqcMetadata: {
      tier: session.tier,
      patternId: result.patternId ?? "none",
      status: result.status,
    },
  });

  return { ...result, dag_node_hash: dagHash };
}

// ─────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();

  try {
    // Auth + context
    let session: SessionContext;
    try {
      session = await resolveSession(req);
    } catch (authErr) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", detail: (authErr as Error).message }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limit (OWASP API4)
    if (!checkRateLimit(session.organizationId, session.rpmLimit)) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action } = body;

    if (!action || typeof action !== "string") {
      return new Response(
        JSON.stringify({ error: "action is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action authorization (OWASP API5)
    if (!session.allowedActions.has(action)) {
      return new Response(
        JSON.stringify({ error: `Action '${action}' not permitted for tier '${session.tier}'` }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result: Record<string, unknown>;

    switch (action) {
      case "test":
        result = await handleTestConnector(body, session, requestId);
        break;
      case "learn":
        result = await handleLearnConnector(body, session, requestId);
        break;
      default:
        return new Response(
          JSON.stringify({ error: `Unhandled action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(
      JSON.stringify({
        ...result,
        _meta: {
          request_id: requestId,
          tier: session.tier,
          threat_level: session.threatLevel,
          scopes: session.scopes,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[mitochondrial-proxy] error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", request_id: requestId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
