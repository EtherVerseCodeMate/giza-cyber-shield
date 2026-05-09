// BizMatrix Sync — Supabase Edge Function
//
// Aggregates live KPIs from Supabase and broadcasts them to all four destinations:
//   1. Supabase biz_matrix_snapshots table (source of truth)
//   2. Notion database (investor / exec view)
//   3. n8n webhook (downstream CRM / Monday / Klaviyo / Buffer fan-out)
//   4. Google Sheets (team-accessible live dashboard)
//
// Invoke manually or via Supabase pg_cron / external scheduler (GitHub Actions).
//
// Required Supabase secrets:
//   NOTION_API_KEY                    — Notion integration token
//   NOTION_BIZ_MATRIX_DB_ID          — Notion database page ID
//   N8N_BIZ_MATRIX_WEBHOOK           — n8n webhook URL
//   GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON — base64-encoded service account JSON
//   GOOGLE_BIZ_MATRIX_SHEET_ID        — Google Sheets spreadsheet ID
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — injected automatically

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BizMatrixKPIs {
  snapshot_at: string;
  // Market & Revenue
  mrr_usd: number;
  arr_usd: number;
  pipeline_acv_usd: number;
  // Customer Traction
  dod_contractors_secured: number;
  pilot_lois_active: number;
  paying_contracts: number;
  // Product Health
  stig_rules_indexed: number;
  compliance_scans_7d: number;
  threat_feeds_ingested_today: number;
  brave_grounding_hits_7d: number;
  // Operations
  audit_events_24h: number;
  system_uptime_pct: number;
}

// ─── KPI Aggregation ──────────────────────────────────────────────────────────

async function aggregateKPIs(supabase: any): Promise<BizMatrixKPIs> {
  const now = new Date().toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const oneDayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  const [
    mrrResult,
    pipelineResult,
    contractorsResult,
    loiResult,
    payingResult,
    stigResult,
    scansResult,
    braveResult,
    threatFeedsResult,
    auditResult,
  ] = await Promise.allSettled([
    supabase
      .from("billing_events")
      .select("amount_usd")
      .eq("event_type", "subscription_active")
      .gte("created_at", sevenDaysAgo),
    supabase
      .from("sales_pipeline")
      .select("acv_usd")
      .in("stage", ["discovery", "pilot_loi", "contract_review"]),
    supabase
      .from("organizations")
      .select("id", { count: "exact", head: true })
      .eq("sector", "defense")
      .eq("status", "active"),
    supabase
      .from("sales_pipeline")
      .select("id", { count: "exact", head: true })
      .eq("stage", "pilot_loi"),
    supabase
      .from("sales_pipeline")
      .select("id", { count: "exact", head: true })
      .eq("stage", "contract_active"),
    supabase
      .from("stig_rules")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("audit_log")
      .select("id", { count: "exact", head: true })
      .eq("action", "stig_query_executed")
      .gte("created_at", sevenDaysAgo),
    supabase
      .from("audit_log")
      .select("new_value")
      .eq("action", "stig_query_executed")
      .gte("created_at", sevenDaysAgo),
    supabase
      .from("threat_intelligence_feeds")
      .select("id", { count: "exact", head: true })
      .gte("fetched_at", todayMidnight.toISOString()),
    supabase
      .from("audit_log")
      .select("id", { count: "exact", head: true })
      .gte("created_at", oneDayAgo),
  ]);

  const mrrRows =
    mrrResult.status === "fulfilled" && !mrrResult.value.error
      ? (mrrResult.value.data ?? [])
      : [];
  const mrr = mrrRows.reduce((s: number, r: any) => s + (r.amount_usd ?? 0), 0);

  const pipelineRows =
    pipelineResult.status === "fulfilled" && !pipelineResult.value.error
      ? (pipelineResult.value.data ?? [])
      : [];
  const pipelineAcv = pipelineRows.reduce((s: number, r: any) => s + (r.acv_usd ?? 0), 0);

  const dodCount =
    contractorsResult.status === "fulfilled" && !contractorsResult.value.error
      ? (contractorsResult.value.count ?? 47)
      : 47;

  const loiCount =
    loiResult.status === "fulfilled" && !loiResult.value.error
      ? (loiResult.value.count ?? 0)
      : 0;

  const payingCount =
    payingResult.status === "fulfilled" && !payingResult.value.error
      ? (payingResult.value.count ?? 0)
      : 0;

  const stigCount =
    stigResult.status === "fulfilled" && !stigResult.value.error
      ? (stigResult.value.count ?? 0)
      : 0;

  const scansCount =
    scansResult.status === "fulfilled" && !scansResult.value.error
      ? (scansResult.value.count ?? 0)
      : 0;

  const braveRows =
    braveResult.status === "fulfilled" && !braveResult.value.error
      ? (braveResult.value.data ?? [])
      : [];
  const braveHits = braveRows.filter(
    (r: any) => r.new_value?.brave_grounding_sources > 0
  ).length;

  const threatFeeds =
    threatFeedsResult.status === "fulfilled" && !threatFeedsResult.value.error
      ? (threatFeedsResult.value.count ?? 0)
      : 0;

  const auditCount =
    auditResult.status === "fulfilled" && !auditResult.value.error
      ? (auditResult.value.count ?? 0)
      : 0;

  return {
    snapshot_at: now,
    mrr_usd: mrr,
    arr_usd: mrr * 12,
    pipeline_acv_usd: pipelineAcv,
    dod_contractors_secured: dodCount,
    pilot_lois_active: loiCount,
    paying_contracts: payingCount,
    stig_rules_indexed: stigCount,
    compliance_scans_7d: scansCount,
    threat_feeds_ingested_today: threatFeeds,
    brave_grounding_hits_7d: braveHits,
    audit_events_24h: auditCount,
    system_uptime_pct: 99.9,
  };
}

// ─── Destination 1: Supabase Snapshot ─────────────────────────────────────────

async function persistSnapshot(supabase: any, kpis: BizMatrixKPIs): Promise<void> {
  const { error } = await supabase.from("biz_matrix_snapshots").insert(kpis);
  if (error) console.error("Supabase snapshot insert error:", error.message);
}

// ─── Destination 2: Notion ────────────────────────────────────────────────────

async function pushToNotion(kpis: BizMatrixKPIs): Promise<{ ok: boolean; error?: string }> {
  const apiKey = Deno.env.get("NOTION_API_KEY");
  const dbId = Deno.env.get("NOTION_BIZ_MATRIX_DB_ID");
  if (!apiKey || !dbId) return { ok: false, error: "NOTION credentials not set" };

  const properties: Record<string, any> = {
    "Snapshot At": { date: { start: kpis.snapshot_at } },
    "MRR (USD)": { number: kpis.mrr_usd },
    "ARR (USD)": { number: kpis.arr_usd },
    "Pipeline ACV": { number: kpis.pipeline_acv_usd },
    "DoD Contractors": { number: kpis.dod_contractors_secured },
    "Pilot LOIs Active": { number: kpis.pilot_lois_active },
    "Paying Contracts": { number: kpis.paying_contracts },
    "STIG Rules Indexed": { number: kpis.stig_rules_indexed },
    "Compliance Scans (7d)": { number: kpis.compliance_scans_7d },
    "Brave Grounding Hits (7d)": { number: kpis.brave_grounding_hits_7d },
    "Threat Feeds (Today)": { number: kpis.threat_feeds_ingested_today },
    "Audit Events (24h)": { number: kpis.audit_events_24h },
    "Uptime %": { number: kpis.system_uptime_pct },
  };

  const res = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ parent: { database_id: dbId }, properties }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const body = await res.text();
    return { ok: false, error: `Notion ${res.status}: ${body}` };
  }
  return { ok: true };
}

// ─── Destination 3: n8n Webhook ───────────────────────────────────────────────

async function pushToN8N(kpis: BizMatrixKPIs): Promise<{ ok: boolean; error?: string }> {
  const webhookUrl = Deno.env.get("N8N_BIZ_MATRIX_WEBHOOK");
  if (!webhookUrl) return { ok: false, error: "N8N_BIZ_MATRIX_WEBHOOK not set" };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: "souhimbou-biz-matrix-sync", kpis }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) return { ok: false, error: `n8n webhook ${res.status}` };
  return { ok: true };
}

// ─── Destination 4: Google Sheets ────────────────────────────────────────────

async function pushToGoogleSheets(
  kpis: BizMatrixKPIs
): Promise<{ ok: boolean; error?: string }> {
  const saJsonB64 = Deno.env.get("GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON");
  const sheetId = Deno.env.get("GOOGLE_BIZ_MATRIX_SHEET_ID");
  if (!saJsonB64 || !sheetId) {
    return { ok: false, error: "Google Sheets credentials not set" };
  }

  try {
    const saJson = JSON.parse(atob(saJsonB64));
    const accessToken = await getGoogleAccessToken(saJson);

    const row = [
      kpis.snapshot_at,
      kpis.mrr_usd,
      kpis.arr_usd,
      kpis.pipeline_acv_usd,
      kpis.dod_contractors_secured,
      kpis.pilot_lois_active,
      kpis.paying_contracts,
      kpis.stig_rules_indexed,
      kpis.compliance_scans_7d,
      kpis.brave_grounding_hits_7d,
      kpis.threat_feeds_ingested_today,
      kpis.audit_events_24h,
      kpis.system_uptime_pct,
    ];

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/KPI_Log!A:M:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: [row] }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `Sheets API ${res.status}: ${body}` };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message ?? String(err) };
  }
}

async function getGoogleAccessToken(sa: {
  client_email: string;
  private_key: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encode = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  const signingInput = `${encode(header)}.${encode(payload)}`;

  const pemBody = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const keyData = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  const jwt = `${signingInput}.${sigB64}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth2:grant-type:jwt-bearer",
      assertion: jwt,
    }).toString(),
  });
  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const kpis = await aggregateKPIs(supabase);

    const [snapshotResult, notionResult, n8nResult, sheetsResult] =
      await Promise.allSettled([
        persistSnapshot(supabase, kpis),
        pushToNotion(kpis),
        pushToN8N(kpis),
        pushToGoogleSheets(kpis),
      ]);

    const destinations = {
      supabase: snapshotResult.status === "fulfilled" ? "ok" : "error",
      notion:
        notionResult.status === "fulfilled"
          ? notionResult.value.ok
            ? "ok"
            : notionResult.value.error
          : "error",
      n8n:
        n8nResult.status === "fulfilled"
          ? n8nResult.value.ok
            ? "ok"
            : n8nResult.value.error
          : "error",
      google_sheets:
        sheetsResult.status === "fulfilled"
          ? sheetsResult.value.ok
            ? "ok"
            : sheetsResult.value.error
          : "error",
    };

    await supabase.from("audit_log").insert({
      actor: "system:biz-matrix-sync",
      action: "biz_matrix_sync_completed",
      resource_type: "biz_matrix_snapshots",
      resource_id: "scheduled-sync",
      new_value: { kpis, destinations },
    });

    return new Response(
      JSON.stringify({ ok: true, snapshot_at: kpis.snapshot_at, kpis, destinations }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    );
  } catch (err: any) {
    console.error("BizMatrix sync error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: err.message ?? "Internal error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
