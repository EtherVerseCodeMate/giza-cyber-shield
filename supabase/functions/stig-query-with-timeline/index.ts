import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ─── CUI Sanitization Guard ───────────────────────────────────────────────────
// CRITICAL: This guard MUST run before any data leaves the Azure Gov boundary
// to an external provider. Per OPSEC analysis (Part IV of GovCloud Assessment):
//   - Brave Search is NOT FedRAMP authorized
//   - CUI query content must never transit external APIs
//   - ZDR Enterprise mitigates retention risk but not transit risk
//
// Strip: IP addresses, system identifiers, hostnames, CVE IDs with system context
function sanitizeCUIFromQuery(rawQuery: string): string {
  return rawQuery
    // Strip IPv4 addresses
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?:\/\d{1,2})?\b/g, "[IP]")
    // Strip IPv6 addresses
    .replace(/\b([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g, "[IPv6]")
    // Strip system identifiers (e.g., SYS-001-RHEL01, HOST-DC-03)
    .replace(/\b[A-Z]{2,}-\d{3,}-[A-Z0-9]+\b/g, "[SYSID]")
    // Strip MAC addresses
    .replace(/\b([0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2}\b/gi, "[MAC]")
    // Strip hostnames that look like internal FQDNs
    .replace(/\b[a-z0-9-]+\.(internal|local|corp|mil|gov|dod)\b/gi, "[HOSTNAME]")
    // Strip UUIDs (often system/session identifiers)
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
      "[UUID]"
    );
}

// ─── Brave Search llm/context Integration ────────────────────────────────────
async function getBraveContext(sanitizedQuery: string): Promise<{
  snippets: string[];
  citations: Array<{ title: string; url: string }>;
} | null> {
  const braveApiKey = Deno.env.get("BRAVE_API_KEY");
  if (!braveApiKey) {
    console.warn("BRAVE_API_KEY not configured — skipping real-time grounding");
    return null;
  }

  try {
    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(sanitizedQuery)}&count=5&result_filter=web`,
      {
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": braveApiKey,
        },
        signal: AbortSignal.timeout(8000), // 8s timeout — don't block compliance response
      }
    );

    if (!response.ok) {
      console.warn(`Brave API returned ${response.status} — proceeding without grounding`);
      return null;
    }

    const data = await response.json();
    const results = data?.web?.results ?? [];

    return {
      snippets: results
        .slice(0, 3)
        .map((r: { description?: string }) => r.description ?? "")
        .filter(Boolean),
      citations: results.slice(0, 3).map((r: { title: string; url: string }) => ({
        title: r.title,
        url: r.url,
      })),
    };
  } catch (err) {
    console.error("Brave API error:", err);
    return null; // Graceful degradation — compliance query still proceeds
  }
}

// ─── Main Handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Auth check — JWT required (function-level verify_jwt is also enforced)
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } },
  });

  let body: {
    controlId?: string;
    stigBenchmarkId?: string;
    findingText?: string;
    severity?: string;
    dataClass?: string;
    systemContext?: string;
  };

  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { controlId, stigBenchmarkId, findingText, severity, dataClass } = body;

  if (!controlId) {
    return new Response(JSON.stringify({ error: "controlId is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── CUI classification gate ────────────────────────────────────────────────
  // If the caller marks this data as CUI, we still process it — but we enforce
  // the sanitization guard on anything going to external APIs.
  const isCUI = dataClass === "CUI" || dataClass === "CLASSIFIED";

  // ── Build sanitized Brave query ────────────────────────────────────────────
  // Construct a generic, system-agnostic query using only the control ID and
  // benchmark name — never system-specific context.
  const rawQuery = stigBenchmarkId
    ? `DISA STIG ${stigBenchmarkId} ${controlId} remediation guidance 2024 2025`
    : `NIST 800-171 ${controlId} implementation guidance DoD CMMC`;

  // Sanitize removes any CUI that may have leaked into the query string.
  // For CUI-classified data, apply an extra check and log the sanitization event.
  const sanitizedQuery = sanitizeCUIFromQuery(rawQuery);

  if (isCUI) {
    // Log sanitization event to audit trail
    await supabase.from("mcp_tool_calls").insert({
      tool_name: "stig-query-with-timeline:cui-sanitization",
      parameters: {
        controlId,
        originalLength: rawQuery.length,
        sanitizedLength: sanitizedQuery.length,
        dataClass,
      },
      data_class: "PUBLIC", // The log entry itself is not CUI
    }).then(({ error }) => {
      if (error) console.warn("Audit log insert failed:", error.message);
    });
  }

  // ── Fetch real-time grounding (Brave) ──────────────────────────────────────
  const braveResult = await getBraveContext(sanitizedQuery);

  // ── Query internal compliance timeline ────────────────────────────────────
  // Pull historical scan results for this control from Supabase
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
  const response = {
    controlId,
    stigBenchmarkId: stigBenchmarkId ?? null,
    severity: severity ?? "unknown",
    dataClass: dataClass ?? "PUBLIC",
    // Real-time grounding from Brave (sanitized query only)
    groundingContext: braveResult
      ? {
          source: "Brave Search (ZDR Enterprise — Zero Data Retention)",
          query: sanitizedQuery, // Return sanitized query for audit visibility
          snippets: braveResult.snippets,
          citations: braveResult.citations,
          note: isCUI
            ? "CUI sanitization guard applied before external API call"
            : undefined,
        }
      : null,
    // Internal compliance history
    complianceTimeline: timeline ?? [],
    // Remediation summary (populated by AI layer upstream)
    remediationGuidance: findingText
      ? `Finding: ${sanitizeCUIFromQuery(findingText)}\n\nFor remediation guidance, review DISA STIG ${stigBenchmarkId ?? controlId} and the grounding context above.`
      : null,
    meta: {
      processedAt: new Date().toISOString(),
      fipsMode: true, // This function processes through FIPS-validated Supabase edge runtime
      cuiSanitizationApplied: isCUI,
    },
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "X-ASAF-CUI-Sanitized": isCUI ? "true" : "false",
      "X-ASAF-Data-Class": dataClass ?? "PUBLIC",
      "Cache-Control": "no-store", // Never cache — compliance data must be fresh
    },
  });
});
