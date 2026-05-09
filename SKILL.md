# SKILL.md — AdinKhepra / NouchiX Operational Playbook

> **Who reads this:** Claude Code, Manus, any AI agent working inside this repo.
> **What it is:** The single source of truth for how to operate safely, what
> guardrails must never be bypassed, how the flight recorder works, and the
> standard runbooks for every recurring task in the codebase.

---

## 0. Non-Negotiable Safety Rules

These apply to every agent, every session, without exception.

| Rule | Rationale |
|---|---|
| **Never push to `main` directly** | All changes go through a feature branch → PR → human merge |
| **Never commit secrets, keys, or `.env` content** | PQC keys and API credentials in the wrong place compromise the entire sovereign architecture |
| **Never disable ASAF recording** | The flight recorder logs everything — do not call `WrapMCPAgent` and then suppress its output |
| **Never bypass `AllowAutonomousRemediation = false`** | Autonomous STIG remediation is Iron Bank–only; setting it to `true` on a standard VPS will attempt to install DoD packages and fail noisily |
| **Never store secrets as Fly.io `[env]` or Vercel env vars** | Use `fly secrets set` / `supabase secrets set` — the Vercel 2024 breach vector was build-time env vars |
| **Never make external AI API calls outside `pkg/g0dm0d3/`** | The Go layer has one egress point for Anthropic/OpenRouter; Deno edge functions call Anthropic directly only when `pkg/g0dm0d3` is unreachable |
| **Never skip `scanForInjection()` before LLM calls** | Every STIG query passes through the 6-pattern prompt injection scanner in `stig-query-with-timeline/index.ts` |

---

## 1. Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────────────┐
│  TIER 3 — PUBLIC SURFACE  (zero secrets, CDN-distributed)           │
│  Vercel (Next.js SPA)  •  Vercel CDN edge nodes                     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTPS + X-Khepra-Attestation header
┌──────────────────────────────▼──────────────────────────────────────┐
│  TIER 2 — BACKEND LOGIC  (Fly.io — Docker, Fly secrets)             │
│  Go API server (pkg/apiserver)  •  RBAC  •  Session management      │
│  G0DM0D3 AI brain (pkg/g0dm0d3) — sole Anthropic egress point       │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ mTLS port 8443
┌──────────────────────────────▼──────────────────────────────────────┐
│  TIER 1 — SOVEREIGN / VPS  (Hostinger VPS, non-negotiable)          │
│  AdinKhepra binary (ASAF MCP wrapper + KASA engine)                 │
│  Telemetry server + ASAF flight recorder                             │
│  PQC key distribution (Kyber-1024 / ML-DSA-65 / Dilithium3)         │
│  License authority                                                   │
│  stig-intelligence-orchestrator (raw scan data)                     │
└─────────────────────────────────────────────────────────────────────┘

  Supabase Cloud ─ SOC 2 Type II, customer-owned encryption keys, PITR
  Brave Search API ─ Zero Data Retention (ZDR), no query persistence
```

**Decision rule for "where does this run?"**

- Contains PQC keys, raw audit findings, or proprietary IP → **VPS only**
- Contains RBAC logic, session tokens, or Go business logic → **Fly.io (Docker + secrets)**
- Is static HTML/CSS/JS with no secrets → **Vercel**
- Needs a database → **Supabase** (you own the encryption keys)
- Needs real-time DISA intelligence → **Brave Search API** (ZDR-grade, defensible to DoD buyers)

---

## 2. AdinKhepra — The Flight Recorder

AdinKhepra is the **security camera + flight recorder** for every AI agent that
touches this codebase. It is implemented in `pkg/asaf/` and runs as a
transparent MCP wrapper — the agent being recorded does not need to be modified.

### 2.1 What It Records

Every MCP tool call produces a **signed DAG node** containing:

| Field | Value |
|---|---|
| `agent_id` | e.g. `claude-code-session-abc123` |
| `agent_type` | `claude-code`, `copilot`, `cursor`, `custom` |
| `tool` | MCP tool name: `read_file`, `write_file`, `run_command`, etc. |
| `parameters` | Tool input (file paths, queries, shell commands) |
| `result` | Tool output (truncated to 4096 bytes) |
| `timestamp` | RFC3339 UTC |
| `session_id` | UUID for this recording session |

The node is signed with **Dilithium3** (ML-DSA-65) before being appended to the
immutable global DAG. Nodes cannot be deleted or modified after writing.

### 2.2 Starting a Recording Session

```go
// In any Go service that spawns an AI agent:
wrapper := asaf.NewASAFWrapper(dag.GlobalDAG(), logger)
agent, err := wrapper.WrapMCPAgent("claude-code-session-xyz", "claude-code")

// For every tool call the agent makes:
err = wrapper.RecordAction(agent.SessionID, asaf.MCPAction{
    AgentID:    agent.AgentID,
    AgentType:  agent.AgentType,
    Tool:       "write_file",
    Parameters: map[string]string{"path": "/etc/config", "content": "..."},
    Result:     "ok",
})

// At session end:
history, _ := wrapper.GetActionHistory(agent.SessionID)
drift, _   := wrapper.DetectDrift(agent.SessionID)
```

### 2.3 Live Feed (Security Camera)

The recorder publishes events via Server-Sent Events at `/api/asaf/stream`.
Any dashboard client (browser, monitoring system) can connect and see every
AI agent action as it happens — in real time, cryptographically signed.

```
GET /api/asaf/stream
Accept: text/event-stream

data: {"type":"action","node_id":"dag-abc","session_id":"sess-xyz",
       "agent_type":"claude-code","tool":"write_file","timestamp":"..."}

data: {"type":"drift","session_id":"sess-xyz","drift_detected":true,
       "score":0.72,"anomalies":["write_ratio above baseline","new tool: delete_file"]}
```

### 2.4 Drift Detection

ASAF compares every session's tool usage against **signed baselines** for each
agent type. Drift score ranges from `0.0` (identical to baseline) to `1.0`
(completely different behavior).

**Default baselines** (`pkg/asaf/drift.go` — `DefaultBaselines`):

| Agent | Expected read ratio | Expected write ratio | Avg session length |
|---|---|---|---|
| `claude-code` | 35% | 20% | 25 actions |
| `copilot` | 40% | 30% | 40 actions |
| `cursor` | 30% | 40% | 30 actions |

**Anomaly triggers:**
- Write ratio > 2× baseline
- New tool not in baseline profile
- Session length > 3× baseline average
- `delete_file` / `drop_table` / `rm -rf` patterns in tool parameters

When drift score exceeds `0.6`, ASAF writes a signed drift event to the DAG and
broadcasts it to all SSE subscribers. The Maat Guardian (`pkg/maat/`) is
notified and consults KASA for a recommended response action.

### 2.5 DAG Integrity

The global DAG is initialized once via `dag.GlobalDAG()` (singleton). Storage
path defaults to `./data/dag` or `$KHEPRA_DAG_PATH`. The genesis node
(`GENESIS_CONSTELLATION`, symbol `KHEPRA`) is created on first run and never
re-created — it is the cryptographic root of the entire audit chain.

**To verify DAG integrity:**
```bash
adinkhepra verify-dag --path ./data/dag
```

**To read the last N actions for a session:**
```bash
adinkhepra session-history --session-id <uuid> --limit 50
```

---

## 3. KASA — The AI Guardrail Engine

KASA (Khepra Agentic Security Auditor) is the AI reasoning layer that advises
on security decisions. It runs inside the `pkg/agi` engine and is consulted by
the **Maat Guardian** whenever a threat (Isfet) is detected.

### 3.1 KASA Response Actions

| Action constant | What it does | Autonomous? |
|---|---|---|
| `ActionObserve` | Log and monitor, no intervention | Yes (always) |
| `ActionBanish` | Firewall rule via `khopesh-firewall` | Yes, if certainty ≥ 0.8 and burden ≤ 0.3 |
| `ActionPurify` | STIG remediation via `khopesh-remediation` | **Iron Bank only** (`AllowAutonomousRemediation = true`) |
| `ActionSeal` | Full isolation via `khopesh-isolation` | **Never autonomous** — requires human approval |
| `ActionIsolate` | Network quarantine via `khopesh-network` | **Never autonomous** — requires human approval |

### 3.2 Guardrail: Autonomous Remediation Gate

`AllowAutonomousRemediation` defaults to `false` in `pkg/maat/guardian.go`.
**Do not set it to `true` unless the deployment is a hardened Iron Bank DoD image.**

On a standard VPS (ModeEdge), attempting autonomous STIG remediation will:
- Try to install `scap-security-guide`, `firewalld`, FIPS mode
- Fail with `exit status 1` on every Ouroboros cycle tick
- Produce noisy audit log entries with no security improvement

```go
// Correct for Hostinger VPS / Fly.io:
guardian := maat.NewGuardian("vps-realm", kasa, chronicle)
// AllowAutonomousRemediation stays false — do NOT call .WithAutonomousRemediation(true)

// Correct only for Iron Bank:
guardian := maat.NewGuardian("ironbank-realm", kasa, chronicle).
    WithAutonomousRemediation(true)
```

### 3.3 KASA in the Maat Decision Cycle

```
Isfet detected (threat/anomaly)
         │
         ▼
Anubis weighs options (pkg/maat AnubisWeigher)
         │
         ▼
KASA consulted → returns Wisdom string (AI recommendation)
         │
         ▼
Best option selected by potency score
         │
         ▼
shouldAutomate() check:
  - ActionSeal / ActionIsolate → always false
  - ActionPurify + !AllowAutonomousRemediation → false
  - certainty < 0.8 or burden > 0.3 → false
  - else → true
         │
         ▼
Heka (action) written to Seshat Chronicle
```

---

## 4. Security Controls Reference (DG-0x)

These are the named alert and control gates referenced across the codebase.
Use these exact names in audit logs, Slack notifications, and Twilio SMS bodies.

| ID | Name | Trigger | Response |
|---|---|---|---|
| **DG-01** | PQC Key Rotation Alert | Dilithium3 key age > 90 days | SMS + audit log + block new sessions |
| **DG-02** | License Heartbeat Failure | License server unreachable > 5 min | Graceful degradation to offline mode |
| **DG-03** | ASAF Drift Threshold Breach | Drift score > 0.6 | SSE broadcast + Maat notification + human review required |
| **DG-04** | Prompt Injection Blocked | Any of the 6 injection patterns hit | 403 response + audit log + SMS if repeated |
| **DG-05** | RBAC Escalation Attempt | Role check failed + > 3 attempts in 5 min | Lock account + audit log + SMS |
| **DG-06** | New DISA STIG Published | `brave-threat-feed-sync` finds new `site:public.cyber.mil` content | Twilio SMS alert + risk score elevation on matching assets |
| **DG-07** | CVE Critical Ingested | `brave-threat-feed-sync` CVE query returns severity:critical result | `threat_intelligence_feeds` insert + process_behavior_events elevation |
| **DG-08** | DAG Integrity Violation | DAG node hash mismatch on read | System halt + emergency audit + SMS |
| **DG-09** | VPS SSH Brute Force | > 10 failed SSH attempts in 60 s | `khopesh-firewall` auto-ban + DG-03 escalation |
| **DG-10** | Supabase Admin Override | `is_master_admin` set without audit trail | Alert + suspend access pending review |

---

## 5. MCP Gateway Security Controls

The STIG query function (`stig-query-with-timeline/index.ts`) enforces these
controls in order on every request. **Do not reorder them.**

```
Request
  │
  ▼ 1. STIG ID format validation (alphanumeric/hyphen, ≤ 64 chars)
  │
  ▼ 2. Prompt injection scan (6 regex patterns)
  │
  ▼ 3. JWT authentication + user profile fetch
  │
  ▼ 4. RBAC authorization check
  │     stig:reader  → query_stigs, view_decomposed_rules, view_complexity
  │     stig:analyst → + export_reports, view_role_mappings, view_compliance_status
  │     stig:admin   → + manage_cache, force_sync, view_process_timeline
  │
  ▼ 5. Data classification filter
  │     PUBLIC (1) → CUI (2) → CLASSIFIED (3)
  │     Identity clearance < data classification → redact
  │
  ▼ 6. STIG DB fetch
  │
  ▼ 7. Brave grounding (parallel, fail-open)
  │     GET /res/v1/llm/context?q=DISA+STIG+{id}+remediation
  │     8-second timeout, degrades gracefully if BRAVE_API_KEY absent
  │
  ▼ 8. Anthropic cited answer (parallel, fail-open)
  │     claude-sonnet-4-6, 1024 tokens, Brave context injected as system prompt
  │     30-second timeout
  │
  ▼ 9. Response filter (apply classification + role rules)
  │
  ▼ 10. Audit log INSERT (always — even on denied requests)
  │
Response
```

**Role resolution priority** (hardcoded email removed — see security audit):
1. `profiles.stig_role` column (explicit DB assignment)
2. `profiles.department` heuristic (`Security` / `Compliance` → `stig:analyst`)
3. `profiles.is_master_admin` boolean → `stig:admin`

---

## 6. Deployment Runbooks

### 6.1 Deploy an Edge Function

```bash
# Deploy single function
supabase functions deploy stig-query-with-timeline
supabase functions deploy brave-threat-feed-sync
supabase functions deploy biz-matrix-sync

# Set required secrets (one-time, per function)
supabase secrets set BRAVE_API_KEY=<key>
supabase secrets set ANTHROPIC_API_KEY=<key>
supabase secrets set NOTION_API_KEY=<key>
supabase secrets set NOTION_BIZ_MATRIX_DB_ID=<id>
supabase secrets set N8N_BIZ_MATRIX_WEBHOOK=<url>
supabase secrets set GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON=$(cat sa.json | base64)
supabase secrets set GOOGLE_BIZ_MATRIX_SHEET_ID=<id>
supabase secrets set TWILIO_ACCOUNT_SID=<sid>
supabase secrets set TWILIO_AUTH_TOKEN=<token>
supabase secrets set TWILIO_FROM_NUMBER=+1...
supabase secrets set ALERT_RECIPIENT_NUMBER=+1...
```

### 6.2 Run the BizMatrix Sync Manually

```bash
# Via curl (triggers all 4 destination fan-out)
curl -X POST \
  "${SUPABASE_URL}/functions/v1/biz-matrix-sync" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"

# Or trigger the GitHub Actions workflow manually:
# Actions → "BizMatrix Sync + Pitch Deck Auto-Update" → Run workflow
```

### 6.3 Patch the Pitch Deck

```bash
pip install python-pptx requests
export SUPABASE_URL=...
export SUPABASE_SERVICE_ROLE_KEY=...

# Dry-run to preview changes:
python scripts/sync_pitch_deck.py --deck assets/SouHimBouAI_PitchDeck_NouchiX.pptx --dry-run

# Apply and write:
python scripts/sync_pitch_deck.py \
  --deck assets/SouHimBouAI_PitchDeck_NouchiX.pptx \
  --out  assets/SouHimBouAI_PitchDeck_NouchiX_latest.pptx
```

### 6.4 Deploy the Go API Server (Fly.io)

```bash
# Never store secrets in fly.toml [env] — use fly secrets:
fly secrets set ANTHROPIC_API_KEY=<key>
fly secrets set OPENROUTER_API_KEY=<key>
fly secrets set KHEPRA_DAG_PATH=/app/data/dag
fly secrets set SUPABASE_URL=<url>
fly secrets set SUPABASE_SERVICE_ROLE_KEY=<key>

# Deploy
fly deploy --app souhimbou-ai
```

### 6.5 VPS Hardening Checklist (Sovereign Tier)

Run before placing any Tier 1 service on the Hostinger VPS:

- [ ] SSH key-only auth (`PasswordAuthentication no` in sshd_config)
- [ ] `fail2ban` installed and monitoring SSH (DG-09 trigger)
- [ ] UFW: deny all inbound except 443, 8443 (mTLS), 22 (restricted source)
- [ ] `certbot` auto-renew configured for TLS certs
- [ ] ASAF telemetry server running as systemd service, not root
- [ ] `KHEPRA_DAG_PATH` points to a directory on an encrypted volume
- [ ] Dilithium3 key rotation reminder set in calendar (DG-01: 90-day)
- [ ] No `.env` files on disk — secrets injected via systemd `EnvironmentFile` with `600` permissions

---

## 7. Brave Search API — Integration Reference

**Endpoint used:** `GET /res/v1/llm/context` (pre-processed grounding for LLM injection)

**Authentication:** `X-Subscription-Token: <BRAVE_API_KEY>` header

**Timeout:** 8 seconds (compliance queries are latency-sensitive)

**Failure mode:** Returns `{ sources: [], formattedContext: "" }` — the main
function continues and returns the STIG record without the grounding context.
No error is surfaced to the client.

**ZDR procurement statement** (use verbatim in pilot conversations):
> "AdinKhepra's AI compliance research assistant is powered by Brave Search,
> a SOC 2 Type II certified provider. Under our Enterprise agreement, no search
> query data is retained by Brave's infrastructure (Full-funnel Zero Data
> Retention). Compliance questions asked through the ASAF MCP interface leave
> no persistent record outside your organization's own audit log."

**Daily threat feed queries** (`brave-threat-feed-sync`):

| Source tag | Query | Count | `freshness` |
|---|---|---|---|
| `DISA_STIG` | `DISA STIG update site:public.cyber.mil` | 10 | `pd` (past day) |
| `CMMC_ENFORCEMENT` | `CMMC enforcement 2025` | 10 | `pd` |
| `CVE_CRITICAL` | `CVE severity critical published today` | 15 | `pd` |

---

## 8. BizMatrix KPI Reference

The `biz_matrix_snapshots` Supabase table schema (create this if it doesn't exist):

```sql
create table biz_matrix_snapshots (
  id              bigserial primary key,
  snapshot_at     timestamptz not null default now(),
  mrr_usd         numeric(12,2) default 0,
  arr_usd         numeric(12,2) default 0,
  pipeline_acv_usd numeric(12,2) default 0,
  dod_contractors_secured integer default 0,
  pilot_lois_active integer default 0,
  paying_contracts  integer default 0,
  stig_rules_indexed integer default 0,
  compliance_scans_7d integer default 0,
  threat_feeds_ingested_today integer default 0,
  brave_grounding_hits_7d integer default 0,
  audit_events_24h integer default 0,
  system_uptime_pct numeric(5,2) default 99.9
);

-- Index for latest-row queries
create index on biz_matrix_snapshots (snapshot_at desc);
```

**Google Sheets `KPI_Log` tab header row (A1:M1):**
```
Snapshot At | MRR (USD) | ARR (USD) | Pipeline ACV | DoD Contractors |
Pilot LOIs | Paying Contracts | STIG Rules | Compliance Scans (7d) |
Brave Hits (7d) | Threat Feeds Today | Audit Events (24h) | Uptime %
```

---

## 9. Git Branch & Push Protocol

| Situation | What to do |
|---|---|
| New feature / fix | Branch from `main`, name `claude/<kebab-description>-<5-char-id>` |
| HTTP 413 on `git push` | Use `mcp__github__push_files` to push files directly — repo is ~928 MB |
| Push succeeds via MCP but local branch is behind | `git fetch origin <branch> && git reset --hard origin/<branch>` |
| Stop hook says "unpushed commits" | Verify with `git log --oneline origin/<branch>..HEAD` then sync as above |
| Secrets accidentally staged | `git reset HEAD <file>` immediately, then check `git log -p` and rotate the secret |

**Never use:**
- `git push --force` to `main`
- `git commit --no-verify`
- `git push` with credentials embedded in the remote URL

---

## 10. Manus Integration Map

Given Manus's native tool integrations, route each BizMatrix destination
through the most appropriate native connector rather than building custom HTTP
calls where Manus already has a first-class integration:

| Data flow | Use |
|---|---|
| KPI snapshot → Notion database | Manus Notion integration (no custom HTTP needed) |
| KPI snapshot → Monday.com boards | Manus monday.com integration via n8n webhook payload |
| KPI snapshot → HubSpot CRM pipeline | Manus HubSpot integration — map `pilot_lois_active` to deal stage |
| KPI snapshot → Google Drive (Sheets) | Manus Google Drive integration |
| Alert → Slack | Manus Slack integration + `SLACK_BIZ_MATRIX_WEBHOOK` secret |
| Pitch deck → Google Drive | Manus Google Drive integration — upload `_latest.pptx` after CI patches it |
| DG-06 SMS alert | Manus → n8n → Twilio (or Manus directly if Twilio connector added) |
| STIG briefing content | Manus Perplexity/Brave integration for real-time DISA lookups |
| Pilot outreach sequences | Manus Apollo + Klaviyo + HubSpot |
| Demo video generation | Manus HeyGen integration — use cited STIG answers from ASAF as script |

The canonical data source for all of the above is the **`biz_matrix_snapshots`
Supabase table**. Pull from there; do not derive KPIs independently in each tool.
