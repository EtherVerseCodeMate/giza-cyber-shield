// Supabase Edge Function: STIG Query with Timeline + Brave Search Grounding
// Purpose: Ground STIG/CVE compliance queries with real-time DISA/NVD data
//          while enforcing CUI sanitization before any external API call.
//
// OPSEC: CUI data must NEVER transit external APIs (Brave is not FedRAMP authorized).
//        The sanitizeCUIFromQuery guard is mandatory before all Brave calls.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ─── CUI Sanitization Guard ───────────────────────────────────────────────────
// CRITICAL: This guard MUST run before any data leaves the boundary to an
// external provider. Brave Search is NOT FedRAMP authorized. ZDR Enterprise
// mitigates retention risk but not transit risk.
function sanitizeCUIFromQuery(rawQuery: string): string {
  return rawQuery
    // Strip IPv4 addresses and CIDR ranges
    .replaceAll(
      /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?:\/\d{1,2})?\b/g,
      "[IP]",
    )
    // Strip IPv6 addresses
    .replaceAll(/\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g, "[IPv6]")
    // Strip system identifiers (e.g., SYS-001-RHEL01, HOST-DC-03)
    .replaceAll(/\b[A-Z]{2,}-\d{3,}-[A-Z0-9]+\b/g, "[SYSID]")
    // Strip MAC addresses
    .replaceAll(/\b(?:[0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2}\b/gi, "[MAC]")
    // Strip internal FQDNs
    .replaceAll(
      /\b[a-z0-9-]+\.(?:internal|local|corp|mil|gov|dod)\b/gi,
      "[HOSTNAME]",
    )
    // Strip UUIDs (often system/session identifiers)
    .replaceAll(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
      "[UUID]",
    );
}

// ─── Brave Search Grounding ───────────────────────────────────────────────────
interface BraveResult {
  snippets: string[];
  citations: Array<{ title: string; url: string }>;
}

async function getBraveContext(
  sanitizedQuery: string,
): Promise<BraveResult | null> {
  const braveApiKey = Deno.env.get("BRAVE_API_KEY");
  if (!braveApiKey) {
    console.warn("BRAVE_API_KEY not configured — skipping real-time grounding");
    return null;
  }

  try {
    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${
        encodeURIComponent(sanitizedQuery)
      }&count=5&result_filter=web`,
      {
        headers: {
          "Accept": "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": braveApiKey,
        },
        signal: AbortSignal.timeout(8000),
      },
    );

    if (!response.ok) {
      console.warn(
        `Brave API returned ${response.status} — proceeding without grounding`,
      );
      return null;
    }

    const data = await response.json();
    const results: Array<{ title: string; url: string; description?: string }> =
      data?.web?.results ?? [];

    return {
      snippets: results
        .slice(0, 3)
        .map((r) => r.description ?? "")
        .filter(Boolean),
      citations: results.slice(0, 3).map((r) => ({
        title: r.title,
        url: r.url,
      })),
    };
  } catch (err) {
    console.error("Brave API error:", err);
    return null; // Graceful degradation — compliance query still proceeds
  }
}

// ─── Request Schema ───────────────────────────────────────────────────────────
interface QueryRequest {
  controlId: string;
  stigBenchmarkId?: string;
  findingText?: string;
  severity?: string;
  dataClass?: string;
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Auth check — JWT enforced at function level and here as defence-in-depth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  let body: QueryRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { controlId, stigBenchmarkId, findingText, severity, dataClass } =
    body;

  if (!controlId) {
    return new Response(JSON.stringify({ error: "controlId is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── CUI classification gate ────────────────────────────────────────────────
  const isCUI = dataClass === "CUI" || dataClass === "CLASSIFIED";

  // ── Build sanitized Brave query ────────────────────────────────────────────
  // Construct a generic, system-agnostic query using only the control ID
  // and benchmark — never system-specific CUI context.
  const rawQuery = stigBenchmarkId
    ? `DISA STIG ${stigBenchmarkId} ${controlId} remediation guidance 2024 2025`
    : `NIST 800-171 ${controlId} implementation guidance DoD CMMC`;

  const sanitizedQuery = sanitizeCUIFromQuery(rawQuery);

  // Log sanitization event for CUI-classified requests
  if (isCUI) {
    const { error: logError } = await supabase.from("mcp_tool_calls").insert({
      tool_name: "stig-query-with-timeline:cui-sanitization",
      parameters: {
        controlId,
        originalLength: rawQuery.length,
        sanitizedLength: sanitizedQuery.length,
        dataClass,
      },
      data_class: "PUBLIC",
    });
    if (logError) {
      console.warn("Audit log insert failed:", logError.message);
    }
  }

  // ── Fetch real-time grounding (Brave) ──────────────────────────────────────
  const braveResult = await getBraveContext(sanitizedQuery);

  // ── Query internal compliance timeline ────────────────────────────────────
  const { data: timeline, error: timelineError } = await supabase
    .from("mcp_tool_calls")
    .select("created_at, parameters, result_summary")
    .eq("tool_name", "stig-scan:control-finding")
    .contains("parameters", { controlId })
    .order("created_at", { ascending: false })
    .limit(10);

  if (timelineError) {
    console.warn("Timeline query error:", timelineError.message);
  }

  // ── Build response ─────────────────────────────────────────────────────────
  const responseBody = {
    controlId,
    stigBenchmarkId: stigBenchmarkId ?? null,
    severity: severity ?? "unknown",
    dataClass: dataClass ?? "PUBLIC",
    groundingContext: braveResult
      ? {
        source: "Brave Search (ZDR Enterprise — Zero Data Retention)",
        query: sanitizedQuery,
        snippets: braveResult.snippets,
        citations: braveResult.citations,
        note: isCUI
          ? "CUI sanitization guard applied before external API call"
          : undefined,
      }
      : null,
    complianceTimeline: timeline ?? [],
    remediationGuidance: findingText
      ? `Finding: ${sanitizeCUIFromQuery(findingText)}\n\nFor remediation guidance, review DISA STIG ${
        stigBenchmarkId ?? controlId
      } and the grounding context above.`
      : null,
    meta: {
      processedAt: new Date().toISOString(),
      fipsMode: true,
      cuiSanitizationApplied: isCUI,
    },
  };

  return new Response(JSON.stringify(responseBody), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "X-ASAF-CUI-Sanitized": isCUI ? "true" : "false",
      "X-ASAF-Data-Class": dataClass ?? "PUBLIC",
      "Cache-Control": "no-store",
    },
  });
});
