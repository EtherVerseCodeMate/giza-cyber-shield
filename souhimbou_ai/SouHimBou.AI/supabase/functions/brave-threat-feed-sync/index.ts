// Brave Threat Feed Sync — Scheduled Edge Function
//
// Invoked daily (via Supabase pg_cron or an external scheduler).
// Queries Brave Search for:
//   1. DISA STIG publications on public.cyber.mil
//   2. CMMC enforcement and policy updates
//   3. Critical CVEs published today
//
// Results are upserted into `threat_intelligence_feeds` and elevate
// risk scores via `process_behavior_events` where asset tags match.
// A Twilio SMS alert is sent through the existing DG-06 alert channel
// when new DISA STIGs are found.
//
// Required Supabase secrets:
//   BRAVE_API_KEY          — Brave Search subscription token
//   SUPABASE_URL           — injected automatically
//   SUPABASE_SERVICE_ROLE_KEY — injected automatically
//   TWILIO_ACCOUNT_SID     — (optional) DG-06 SMS alerts
//   TWILIO_AUTH_TOKEN      — (optional) DG-06 SMS alerts
//   TWILIO_FROM_NUMBER     — (optional) DG-06 SMS alerts
//   ALERT_RECIPIENT_NUMBER — (optional) DG-06 SMS alerts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Types ───────────────────────────────────────────────────────────────────

interface BraveWebResult {
  title: string;
  url: string;
  description: string;
  published?: string;
}

interface ThreatFeedEntry {
  source: "DISA_STIG" | "CMMC_ENFORCEMENT" | "CVE_CRITICAL";
  title: string;
  url: string;
  description: string;
  published_at: string | null;
  raw_query: string;
  fetched_at: string;
}

interface SyncResult {
  source: ThreatFeedEntry["source"];
  query: string;
  results_fetched: number;
  results_inserted: number;
  error?: string;
}

// ─── Brave Web Search ─────────────────────────────────────────────────────────

const BRAVE_API_KEY = Deno.env.get("BRAVE_API_KEY") ?? "";
const BRAVE_WEB_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search";

async function braveWebSearch(query: string, count = 10): Promise<BraveWebResult[]> {
  if (!BRAVE_API_KEY) {
    console.warn("BRAVE_API_KEY not set — skipping Brave search");
    return [];
  }

  const url = `${BRAVE_WEB_SEARCH_URL}?q=${encodeURIComponent(query)}&count=${count}&freshness=pd`;
  const res = await fetch(url, {
    headers: {
      "X-Subscription-Token": BRAVE_API_KEY,
      "Accept": "application/json",
      "Accept-Encoding": "gzip",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`Brave web search returned ${res.status} for query: "${query}"`);
  }

  const data = await res.json();
  const webResults: any[] = data?.web?.results ?? [];

  return webResults.map((r: any) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    description: r.description ?? "",
    published: r.page_age ?? null,
  }));
}

// ─── Upsert Feed Entries ──────────────────────────────────────────────────────

async function upsertFeedEntries(
  supabase: any,
  entries: ThreatFeedEntry[]
): Promise<number> {
  if (entries.length === 0) return 0;

  const { data, error } = await supabase
    .from("threat_intelligence_feeds")
    .upsert(entries, {
      onConflict: "url",       // deduplicate by canonical URL
      ignoreDuplicates: true,
    });

  if (error) {
    // Non-fatal: table may not exist yet in all environments
    console.error("upsert threat_intelligence_feeds error:", error.message);
    return 0;
  }

  return entries.length;
}

// ─── Risk Score Elevation ─────────────────────────────────────────────────────

// Marks process_behavior_events as elevated when a new DISA STIG matches their
// stig_control tag. A lightweight heuristic — the full scoring pipeline runs
// separately.
async function elevateAffectedAssets(
  supabase: any,
  stigKeywords: string[]
): Promise<void> {
  if (stigKeywords.length === 0) return;

  for (const keyword of stigKeywords) {
    await supabase
      .from("process_behavior_events")
      .update({ severity: "HIGH", compliance_status: "VIOLATION" })
      .ilike("stig_control", `%${keyword}%`)
      .eq("compliance_status", "PENDING");
  }
}

// ─── DG-06 SMS Alert (Twilio) ─────────────────────────────────────────────────

async function sendSMSAlert(message: string): Promise<void> {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const fromNumber = Deno.env.get("TWILIO_FROM_NUMBER");
  const toNumber = Deno.env.get("ALERT_RECIPIENT_NUMBER");

  if (!accountSid || !authToken || !fromNumber || !toNumber) return;

  const body = new URLSearchParams({ From: fromNumber, To: toNumber, Body: message });
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    }
  );

  if (!res.ok) {
    console.warn("DG-06 SMS alert failed:", res.status);
  }
}

// ─── Feed Queries ─────────────────────────────────────────────────────────────

const FEED_QUERIES: Array<{
  source: ThreatFeedEntry["source"];
  query: string;
  count: number;
}> = [
  {
    source: "DISA_STIG",
    query: "DISA STIG update site:public.cyber.mil",
    count: 10,
  },
  {
    source: "CMMC_ENFORCEMENT",
    query: "CMMC enforcement 2025",
    count: 10,
  },
  {
    source: "CVE_CRITICAL",
    query: "CVE severity critical published today",
    count: 15,
  },
];

// ─── Main Handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  // Support both scheduled invocation (POST with empty body) and manual GET
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

  const fetchedAt = new Date().toISOString();
  const syncResults: SyncResult[] = [];
  const allDisaKeywords: string[] = [];

  for (const feed of FEED_QUERIES) {
    const result: SyncResult = {
      source: feed.source,
      query: feed.query,
      results_fetched: 0,
      results_inserted: 0,
    };

    try {
      const webResults = await braveWebSearch(feed.query, feed.count);
      result.results_fetched = webResults.length;

      const entries: ThreatFeedEntry[] = webResults.map((r) => ({
        source: feed.source,
        title: r.title,
        url: r.url,
        description: r.description,
        published_at: r.published ?? null,
        raw_query: feed.query,
        fetched_at: fetchedAt,
      }));

      result.results_inserted = await upsertFeedEntries(supabase, entries);

      // Collect STIG control identifiers for risk elevation (e.g. "RHEL-08-010010")
      if (feed.source === "DISA_STIG") {
        for (const r of webResults) {
          const matches = `${r.title} ${r.description}`.match(/[A-Z]{2,}-\d{2}-\d{6}/g);
          if (matches) allDisaKeywords.push(...matches);
        }
      }
    } catch (err: any) {
      result.error = err.message ?? String(err);
      console.error(`Feed sync error [${feed.source}]:`, result.error);
    }

    syncResults.push(result);
  }

  // Elevate risk scores for assets tagged with newly published STIG controls
  const uniqueKeywords = [...new Set(allDisaKeywords)];
  await elevateAffectedAssets(supabase, uniqueKeywords);

  // DG-06 SMS alert when new DISA content was found
  const disaResult = syncResults.find((r) => r.source === "DISA_STIG");
  if (disaResult && disaResult.results_inserted > 0) {
    const affectedCount = uniqueKeywords.length;
    await sendSMSAlert(
      `AdinKhepra Alert: ${disaResult.results_inserted} new DISA STIG publication(s) detected today. ` +
        (affectedCount > 0
          ? `${affectedCount} of your monitored assets may be affected. Log in to review.`
          : "Log in to review your compliance posture.")
    );
  }

  // Audit log the sync run
  await supabase.from("audit_log").insert({
    actor: "system:brave-threat-feed-sync",
    action: "threat_feed_sync_completed",
    resource_type: "threat_intelligence_feeds",
    resource_id: "daily-sync",
    new_value: {
      fetched_at: fetchedAt,
      results: syncResults,
      disa_stig_keywords_found: uniqueKeywords,
    },
  });

  return new Response(
    JSON.stringify({
      ok: true,
      fetched_at: fetchedAt,
      results: syncResults,
      disa_keywords_elevated: uniqueKeywords,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
});
