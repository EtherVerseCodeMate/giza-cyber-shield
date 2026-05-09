// STIG Query with Process Behavior Timeline Integration
//
// This Edge Function implements the MCP Gateway security controls in TypeScript.
// It enforces prompt injection scanning, RBAC, and data classification filtering
// before querying STIG data and enriching it with process behavior events.
//
// Reference: pkg/gateway/mcp_gateway.go (Go implementation)
//            STIGVIEWER_STRATEGY_MITOCHONDRIA.md §3.2, §3.3

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Types ──────────────────────────────────────────────────────────────────────

type DataClassification = "PUBLIC" | "CUI" | "CLASSIFIED";
type STIGRole = "stig:reader" | "stig:analyst" | "stig:admin";
type ComplianceStatus = "VALIDATED" | "VIOLATION" | "PENDING" | "IGNORED";

interface Identity {
  id: string;
  role: STIGRole;
  dataClassification: DataClassification;
  name: string;
  organizationId: string;
}

interface ProcessBehaviorEvent {
  id: string;
  timestamp: string;
  pid: number;
  processName: string;
  type: "FILE" | "REGISTRY" | "NETWORK" | "PROCESS" | "SERVICE" | "DRIVER";
  action: string;
  target: string;
  details?: string;
  cmmcControl?: string;
  stigControl?: string;
  complianceStatus: ComplianceStatus;
  severity?: string;
}

interface BraveGroundingSource {
  title: string;
  url: string;
  snippets: string[];
}

interface STIGQueryRequest {
  stigId: string;
  operation: string;
  includeProcessTimeline?: boolean;
  assetId?: string;
}

interface STIGQueryResponse {
  stigId: string;
  title: string;
  severity: string;
  complexity?: string;
  decomposedRules?: any[];
  roleMappings?: string[];
  complianceStatus?: string;
  processTimeline?: ProcessBehaviorEvent[];
  dataClassification: DataClassification;
  // Brave-grounded fields — populated when BRAVE_API_KEY is set
  braveGrounding?: BraveGroundingSource[];
  citedAnswer?: string;
}

// ─── Prompt Injection Scanner ──────────────────────────────────────────────────

const injectionPatterns = [
  // Pattern 1: "Ignore previous instructions"
  /(?:ignore|forget|disregard)\s+(?:previous|above|prior)\s+(?:instructions?|prompts?|rules?)/i,

  // Pattern 2: "You are now a..."
  /you\s+are\s+now\s+a/i,

  // Pattern 3: "System:" prefix (ChatML/system prompt hijacking)
  /system\s*:\s*/i,

  // Pattern 4: "Reveal your system prompt"
  /(?:reveal|show|print|output)\s+(?:your|the)\s+(?:system|initial|original)\s+(?:prompt|instructions?)/i,

  // Pattern 5: LLM instruction markers ([INST], <|im_start|>)
  /\[\s*INST\s*\]/i,

  // Pattern 6: ChatML injection markers
  /<\|im_start\|>/i,
];

function scanForInjection(content: string): string | null {
  for (let i = 0; i < injectionPatterns.length; i++) {
    if (injectionPatterns[i].test(content)) {
      return `Potential prompt injection detected (pattern ${i})`;
    }
  }
  return null;
}

// ─── RBAC Authorization ─────────────────────────────────────────────────────────

const rolePermissions: Record<STIGRole, string[]> = {
  "stig:reader": ["query_stigs", "view_decomposed_rules", "view_complexity"],
  "stig:analyst": [
    "query_stigs",
    "view_decomposed_rules",
    "view_complexity",
    "export_reports",
    "view_role_mappings",
    "view_compliance_status",
  ],
  "stig:admin": [
    "query_stigs",
    "view_decomposed_rules",
    "view_complexity",
    "export_reports",
    "view_role_mappings",
    "view_compliance_status",
    "manage_cache",
    "force_sync",
    "view_process_timeline",
  ],
};

function checkPermission(identity: Identity, operation: string): boolean {
  const permissions = rolePermissions[identity.role];
  if (!permissions) {
    return false;
  }
  return permissions.includes(operation);
}

// ─── STIG ID Validation ─────────────────────────────────────────────────────────

function isValidSTIGID(stigId: string): boolean {
  // STIG IDs follow format: PRODUCT-VERSION-RULEID (e.g., "RHEL-08-010010")
  // Allow alphanumeric, hyphens, underscores only
  const validFormat = /^[A-Za-z0-9_-]+$/;
  return validFormat.test(stigId) && stigId.length <= 64;
}

// ─── Data Classification Filtering ──────────────────────────────────────────────

function filterByRoleAndClassification(
  data: STIGQueryResponse,
  identity: Identity
): STIGQueryResponse {
  const filtered: STIGQueryResponse = {
    stigId: data.stigId,
    title: data.title,
    severity: data.severity,
    dataClassification: data.dataClassification,
  };

  // Complexity visible to all roles
  filtered.complexity = data.complexity;

  // Decomposed rules visible to all roles (if PUBLIC classification)
  if (data.dataClassification === "PUBLIC") {
    filtered.decomposedRules = data.decomposedRules;
    // Brave-grounded answer and sources are public intelligence — visible to all roles
    filtered.braveGrounding = data.braveGrounding;
    filtered.citedAnswer = data.citedAnswer;
  }

  // Role mappings visible to Analyst+ roles
  if (identity.role === "stig:analyst" || identity.role === "stig:admin") {
    filtered.roleMappings = data.roleMappings;
    filtered.complianceStatus = data.complianceStatus;
  }

  // Process timeline visible to Admin only
  if (identity.role === "stig:admin") {
    filtered.processTimeline = data.processTimeline;
  }

  // Filter out CUI/CLASSIFIED data if identity lacks clearance
  const classificationLevels: Record<DataClassification, number> = {
    PUBLIC: 1,
    CUI: 2,
    CLASSIFIED: 3,
  };

  if (
    classificationLevels[data.dataClassification] >
    classificationLevels[identity.dataClassification]
  ) {
    // Redact sensitive fields
    filtered.title = "[REDACTED - Insufficient Clearance]";
    filtered.decomposedRules = undefined;
    filtered.roleMappings = undefined;
    filtered.processTimeline = undefined;
    filtered.braveGrounding = undefined;
    filtered.citedAnswer = undefined;
  }

  return filtered;
}

// ─── Process Timeline Query ─────────────────────────────────────────────────────

async function getProcessTimelineForSTIG(
  supabase: any,
  stigControl: string,
  assetId: string | undefined,
  organizationId: string
): Promise<ProcessBehaviorEvent[]> {
  // Query process behavior events related to this STIG control
  let query = supabase
    .from("process_behavior_events")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("stig_control", stigControl)
    .order("event_timestamp", { ascending: false })
    .limit(100); // Limit to recent 100 events

  // Optionally filter by specific asset
  if (assetId) {
    query = query.eq("asset_id", assetId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch process timeline:", error);
    throw new Error(`Process timeline query failed: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Transform to ProcessBehaviorEvent format
  return data.map((event: any) => ({
    id: event.id,
    timestamp: event.event_timestamp,
    pid: event.pid,
    processName: event.process_name,
    type: event.event_type,
    action: event.action,
    target: event.target,
    details: event.details,
    cmmcControl: event.cmmc_control,
    stigControl: event.stig_control,
    complianceStatus: event.compliance_status,
    severity: event.severity,
  }));
}

// ─── Brave Search API — Real-Time STIG Grounding ────────────────────────────────

// Fetches real-time grounding context from Brave's LLM Context endpoint.
// Gracefully degrades to empty result if the API key is absent or the call fails,
// so the rest of the function continues unaffected.
async function getBraveContext(
  query: string
): Promise<{ sources: BraveGroundingSource[]; formattedContext: string }> {
  const apiKey = Deno.env.get("BRAVE_API_KEY");
  if (!apiKey) {
    return { sources: [], formattedContext: "" };
  }

  try {
    const url = `https://api.search.brave.com/res/v1/llm/context?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        "X-Subscription-Token": apiKey,
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
      },
      signal: AbortSignal.timeout(8000), // 8-second cap — compliance queries are latency-sensitive
    });

    if (!res.ok) {
      console.warn(`Brave API returned ${res.status} — proceeding without grounding`);
      return { sources: [], formattedContext: "" };
    }

    const data = await res.json();
    const generic: any[] = data?.grounding?.generic ?? [];

    const sources: BraveGroundingSource[] = generic.map((item: any) => ({
      title: item.title ?? "",
      url: item.url ?? "",
      snippets: Array.isArray(item.snippets) ? item.snippets : [],
    }));

    const formattedContext = sources
      .flatMap((s) =>
        s.snippets.map((snip) => `[${s.title}](${s.url}): ${snip}`)
      )
      .join("\n\n");

    return { sources, formattedContext };
  } catch (err) {
    console.warn("Brave grounding fetch failed — proceeding without grounding:", err);
    return { sources: [], formattedContext: "" };
  }
}

// ─── Anthropic — Cited Compliance Answer ────────────────────────────────────────

// Generates a cited compliance answer by combining the STIG rule's static metadata
// with real-time Brave grounding context. Falls back to a static summary when the
// Anthropic key is absent or the call fails.
async function generateCitedAnswer(
  stigId: string,
  stigTitle: string,
  stigSeverity: string,
  braveContext: string
): Promise<string> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey || !braveContext) {
    return "";
  }

  const systemPrompt = braveContext
    ? `You are a CMMC/STIG compliance assistant with access to the following real-time DISA and cybersecurity intelligence. Answer with citations — reference source URLs when applicable. Be concise and directly actionable.

REAL-TIME GROUNDING CONTEXT:
${braveContext}`
    : `You are a CMMC/STIG compliance assistant. Provide concise, actionable remediation guidance.`;

  const userMessage = `Provide remediation guidance for STIG control ${stigId} — "${stigTitle}" (Severity: ${stigSeverity}). Include specific commands or configuration steps where available. Cite any sources from the grounding context above.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      console.warn(`Anthropic API returned ${res.status} — omitting cited answer`);
      return "";
    }

    const data = await res.json();
    return data?.content?.[0]?.text ?? "";
  } catch (err) {
    console.warn("Anthropic call failed — omitting cited answer:", err);
    return "";
  }
}

// ─── Main Handler ───────────────────────────────────────────────────────────────

serve(async (req) => {
  // CORS headers
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    // 1. Parse request
    const { stigId, operation, includeProcessTimeline, assetId } =
      (await req.json()) as STIGQueryRequest;

    // 2. Validate STIG ID format (prevent injection)
    if (!isValidSTIGID(stigId)) {
      return new Response(
        JSON.stringify({ error: `Invalid STIG ID format: ${stigId}` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. Scan for prompt injection
    const injectionDetected = scanForInjection(JSON.stringify({ stigId, operation }));
    if (injectionDetected) {
      console.warn("Prompt injection blocked:", injectionDetected);
      return new Response(
        JSON.stringify({ error: injectionDetected }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // 4. Get authenticated user identity
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extract JWT and get user profile
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Authentication failed" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get user profile for role and organization
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("department, organization_id, stig_role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Resolve STIG role: prefer explicit DB column over department heuristic
    let role: STIGRole = "stig:reader";
    if (profile.stig_role && ["stig:reader", "stig:analyst", "stig:admin"].includes(profile.stig_role)) {
      role = profile.stig_role as STIGRole;
    } else if (profile.department === "Security" || profile.department === "Compliance") {
      role = "stig:analyst";
    }

    // Admin override — fetched from DB rather than hardcoded to avoid credential sprawl
    const { data: adminFlag } = await supabase
      .from("profiles")
      .select("is_master_admin")
      .eq("id", user.id)
      .single();
    if (adminFlag?.is_master_admin === true) {
      role = "stig:admin";
    }

    const identity: Identity = {
      id: user.id,
      role,
      dataClassification: "PUBLIC", // Default; fetched from clearance table when available
      name: user.email || "unknown",
      organizationId: profile.organization_id || "",
    };

    // 5. Check authorization
    if (!checkPermission(identity, operation)) {
      console.warn("Access denied:", { user: user.email, role, operation });
      return new Response(
        JSON.stringify({ error: `Access denied: role ${role} lacks permission ${operation}` }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // 6. Fetch STIG data from database
    const { data: stigRule, error: stigError } = await supabase
      .from("stig_rules")
      .select("*")
      .eq("rule_id", stigId)
      .single();

    if (stigError || !stigRule) {
      return new Response(
        JSON.stringify({ error: `STIG rule not found: ${stigId}` }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // 7. Build base response
    const rawData: STIGQueryResponse = {
      stigId: stigRule.rule_id,
      title: stigRule.title,
      severity: stigRule.severity,
      complexity: "MEDIUM", // TODO: Calculate from decomposed rules
      decomposedRules: [], // TODO: Fetch from decomposition service
      roleMappings: [], // TODO: Fetch from role mapping table
      complianceStatus: "PENDING", // TODO: Fetch from compliance scan
      dataClassification: "PUBLIC", // Most STIG data is public
    };

    // 8. Brave real-time grounding + Anthropic cited answer (parallel fetch)
    const braveQuery = `DISA STIG ${stigId} remediation guidance ${stigRule.title}`;
    const [{ sources: braveGrounding, formattedContext }, citedAnswer] =
      await Promise.all([
        getBraveContext(braveQuery),
        // Anthropic call deferred until we have Brave context; run both in parallel
        // and let generateCitedAnswer handle empty context gracefully
        getBraveContext(braveQuery).then(({ formattedContext: ctx }) =>
          generateCitedAnswer(stigId, stigRule.title, stigRule.severity, ctx)
        ),
      ]);

    if (braveGrounding.length > 0) {
      rawData.braveGrounding = braveGrounding;
    }
    if (citedAnswer) {
      rawData.citedAnswer = citedAnswer;
    }

    // 9. Add Process Behavior Timeline data if requested (Admin only)
    if (includeProcessTimeline && identity.role === "stig:admin") {
      if (checkPermission(identity, "view_process_timeline")) {
        rawData.processTimeline = await getProcessTimelineForSTIG(
          supabase,
          stigId,
          assetId,
          identity.organizationId
        );
      }
    }

    // 10. Filter response based on identity's role and data classification
    const filtered = filterByRoleAndClassification(rawData, identity);

    // 11. Audit log the query
    await supabase.from("audit_log").insert({
      actor: `user:${user.email}`,
      action: "stig_query_executed",
      resource_type: "stig_rule",
      resource_id: stigId,
      new_value: {
        operation,
        role,
        data_classification_returned: filtered.dataClassification,
        process_timeline_included: !!filtered.processTimeline,
        brave_grounding_sources: braveGrounding.length,
        cited_answer_generated: !!filtered.citedAnswer,
      },
    });

    return new Response(JSON.stringify(filtered), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error: any) {
    console.error("STIG query error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
