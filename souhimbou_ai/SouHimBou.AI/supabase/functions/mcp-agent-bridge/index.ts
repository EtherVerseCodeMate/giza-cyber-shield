/**
 * mcp-agent-bridge — Transparent MCP proxy with ASAF flight recording.
 *
 * Every MCP tool call from any AI agent (Claude Code, Cursor, Copilot, Cline, …)
 * is intercepted, hashed for privacy, logged to the ASAF DAG backend, and forwarded
 * to the real MCP server. The AI agent never knows about the proxy layer.
 *
 * Required env vars:
 *   MCP_TARGET_URL       — default upstream MCP server (overridden per-request by X-MCP-Target)
 *   ASAF_API_URL         — Go backend base URL (e.g. https://sekhem.yourdomain.com)
 *   KHEPRA_SERVICE_SECRET — shared HMAC secret for generating service tokens (same as Go side)
 *
 * Optional:
 *   ASAF_BRIDGE_API_KEY  — if set, all non-health requests must provide this key in
 *                          X-ASAF-Bridge-Key or Authorization: Bearer <key>
 *
 * Response headers added (X-ASAF-*):
 *   X-ASAF-Session      — session ID for this agent session (sticky across calls)
 *   X-ASAF-Method       — MCP method that was intercepted
 *   X-ASAF-Params-Hash  — SHA-256 of the request body
 *   X-ASAF-Timestamp    — ISO-8601 timestamp of the intercept
 *   X-ASAF-DAG-Node     — DAG node ID written to the flight recorder (if ASAF is reachable)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const MCP_TARGET_URL = Deno.env.get("MCP_TARGET_URL") ?? "";
const ASAF_API_URL = Deno.env.get("ASAF_API_URL") ?? "";
const KHEPRA_SERVICE_SECRET = Deno.env.get("KHEPRA_SERVICE_SECRET") ??
  "khepra-service-secret-v1-change-me-in-production";
const ASAF_BRIDGE_API_KEY = Deno.env.get("ASAF_BRIDGE_API_KEY") ?? "";

const SERVICE_ACCOUNT_NAME = "asaf-bridge";
const SERVICE_TOKEN_PREFIX = "khepra-svc-";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": [
    "authorization",
    "x-client-info",
    "apikey",
    "content-type",
    "x-mcp-target",
    "x-asaf-session",
    "x-agent-id",
    "x-agent-type",
    "x-asaf-bridge-key",
  ].join(", "),
  "Access-Control-Expose-Headers": [
    "x-asaf-session",
    "x-asaf-method",
    "x-asaf-params-hash",
    "x-asaf-timestamp",
    "x-asaf-dag-node",
  ].join(", "),
};

interface MCPRequest {
  jsonrpc: string;
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

interface ASAFEntry {
  timestamp: string;
  session_id: string;
  agent_id: string;
  agent_type: string;
  mcp_method: string;
  tool_name?: string;
  params_hash: string;
  result_hash?: string;
  latency_ms: number;
}

// --- Crypto helpers ---

async function sha256Hex(data: string): Promise<string> {
  const buf = new TextEncoder().encode(data);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function encodeTimestampBigEndianHex(unixSec: number): string {
  const buf = new Uint8Array(8);
  let t = unixSec;
  for (let i = 7; i >= 0; i--) {
    buf[i] = t & 0xff;
    t = Math.floor(t / 256);
  }
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function generateServiceToken(serviceName: string): Promise<string> {
  const timestampHex = encodeTimestampBigEndianHex(
    Math.floor(Date.now() / 1000),
  );
  const message = `${SERVICE_TOKEN_PREFIX}${serviceName}-${timestampHex}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(KHEPRA_SERVICE_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  const sigHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${message}-${sigHex}`;
}

// --- ASAF logger (fire-and-forget; never blocks the proxy response) ---

async function logToASAF(entry: ASAFEntry): Promise<string | null> {
  if (!ASAF_API_URL) return null;
  try {
    const token = await generateServiceToken(SERVICE_ACCOUNT_NAME);
    const resp = await fetch(`${ASAF_API_URL}/api/v1/asaf/record`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(entry),
      signal: AbortSignal.timeout(2000),
    });
    if (!resp.ok) return null;
    const result = await resp.json() as { dag_node_id?: string };
    return result.dag_node_id ?? null;
  } catch {
    return null;
  }
}

// --- Agent type detection ---

function deriveAgentType(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes("claude")) return "claude-code";
  if (ua.includes("copilot")) return "copilot";
  if (ua.includes("cursor")) return "cursor";
  if (ua.includes("cline")) return "cline";
  if (ua.includes("continue")) return "continue";
  return "custom";
}

// --- Bridge key validation (optional guard) ---

function validateBridgeKey(req: Request): boolean {
  if (!ASAF_BRIDGE_API_KEY) return true; // key enforcement is off
  const fromHeader = req.headers.get("x-asaf-bridge-key");
  if (fromHeader === ASAF_BRIDGE_API_KEY) return true;
  const auth = req.headers.get("authorization") ?? "";
  return auth.replace(/^Bearer\s+/i, "") === ASAF_BRIDGE_API_KEY;
}

// --- Core transparent proxy handler ---

async function handleMCPProxy(req: Request): Promise<Response> {
  if (!validateBridgeKey(req)) {
    return new Response(
      JSON.stringify({ error: "Unauthorized: invalid or missing bridge key" }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const targetURL = req.headers.get("x-mcp-target") ?? MCP_TARGET_URL;
  if (!targetURL) {
    return new Response(
      JSON.stringify({
        error:
          "No MCP target configured: set X-MCP-Target header or MCP_TARGET_URL env var",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const sessionID =
    req.headers.get("x-asaf-session") ??
    `asaf-${crypto.randomUUID().replaceAll("-", "")}`;

  const agentID =
    req.headers.get("x-agent-id") ??
    req.headers.get("user-agent") ??
    "unknown";

  const agentType =
    req.headers.get("x-agent-type") ??
    deriveAgentType(req.headers.get("user-agent") ?? "");

  const rawBody = await req.text();
  const paramsHash = await sha256Hex(rawBody);
  const timestamp = new Date().toISOString();

  let mcpReq: MCPRequest | null = null;
  try {
    mcpReq = JSON.parse(rawBody);
  } catch {
    // Non-JSON body — pass through; still record with method="raw"
  }

  // Build forwarding headers — strip proxy-specific headers
  const forwardHeaders = new Headers();
  for (const [k, v] of req.headers.entries()) {
    const lower = k.toLowerCase();
    if (
      lower === "x-mcp-target" ||
      lower === "x-asaf-session" ||
      lower === "x-agent-id" ||
      lower === "x-agent-type" ||
      lower === "x-asaf-bridge-key" ||
      lower === "host"
    ) {
      continue;
    }
    forwardHeaders.set(k, v);
  }

  const startTime = Date.now();

  const upstreamResp = await fetch(targetURL, {
    method: req.method,
    headers: forwardHeaders,
    body: rawBody || undefined,
  });

  const latencyMS = Date.now() - startTime;
  const respBody = await upstreamResp.text();
  const resultHash = await sha256Hex(respBody);

  const mcpMethod = mcpReq?.method ?? "raw";
  const toolName =
    mcpMethod === "tools/call"
      ? ((mcpReq?.params as Record<string, string>)?.name ?? mcpMethod)
      : mcpMethod;

  const entry: ASAFEntry = {
    timestamp,
    session_id: sessionID,
    agent_id: agentID,
    agent_type: agentType,
    mcp_method: mcpMethod,
    tool_name: toolName,
    params_hash: paramsHash,
    result_hash: resultHash,
    latency_ms: latencyMS,
  };

  // Fire-and-forget — ASAF logging must never delay the agent response
  const dagNodeID = await Promise.race([
    logToASAF(entry),
    Promise.resolve(null),
  ]);

  const respHeaders = new Headers(upstreamResp.headers);
  for (const [k, v] of Object.entries(corsHeaders)) {
    respHeaders.set(k, v);
  }
  respHeaders.set("x-asaf-session", sessionID);
  respHeaders.set("x-asaf-method", mcpMethod);
  respHeaders.set("x-asaf-params-hash", paramsHash);
  respHeaders.set("x-asaf-timestamp", timestamp);
  if (dagNodeID) {
    respHeaders.set("x-asaf-dag-node", dagNodeID);
  }

  return new Response(respBody, {
    status: upstreamResp.status,
    headers: respHeaders,
  });
}

// --- Entry point ---

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return new Response(
      JSON.stringify({
        status: "ok",
        service: "mcp-agent-bridge",
        framework: "ASAF",
        target_configured: Boolean(MCP_TARGET_URL),
        asaf_configured: Boolean(ASAF_API_URL),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    return await handleMCPProxy(req);
  } catch (err) {
    console.error("[mcp-agent-bridge] proxy error:", err);
    return new Response(
      JSON.stringify({ error: "Proxy error", detail: String(err) }),
      {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
