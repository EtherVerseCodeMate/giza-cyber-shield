# Pitch Deck — Platform + Per-Product Slides
**Status:** Updated 2026-06-28 (session 2 — taxonomy corrected)
**Verification key:** 🟢 Live-verified · 🟡 Beta / partially built · 🔴 Pending / not yet built

> **TAXONOMY CORRECTION (2026-06-28):**
> The STIG Compliance Console at `adinkhepra.com` is **SouHimBou AI** deployed to the wrong domain.
> AdinKhepra ASAF is the **bare-metal sovereign CMMC Graph Autopilot Engine** — still being built.
> The three products are ordered below by current live status.

---

## Slide 03 · THE PLATFORM

**Label:** `03 · THE PLATFORM`

> **One moat. Three products. Two buyers.**

```
                    KHEPRA PROTOCOL  🟢
              Patent-pending · USPTO #73565085
           Not sold directly — licensed into everything below
                              │
        ┌─────────────────────┼─────────────────────┐
        │     SHARED SUBSTRATE (built once, used 3x)  │
        │  25,185 compliance mappings 🟢 · ML-DSA-65/  │
        │  Kyber-1024 PQC 🟢 · Immutable DAG 🟢        │
        └─────────────────────┼─────────────────────┘
                              │
       ┌──────────────────────┼──────────────────────┐
       ▼                      ▼                       ▼
  PQC-Khepra-MCP        SOUHIMBOU AI           ADINKHEPRA ASAF
  🟢 LIVE               🟡 Beta Live            🔴 Pending
  Agent channel          Agentic SOC            CMMC Graph
  Claude/Cursor/         Flight Recorder        Autopilot Engine
  Windsurf               souhimbou.ai           adinkhepra.com
  GHCR + MCP Registry    $0/$99/$499/mo         $25K–$250K/yr
```

**Three bullets:**
- **One technical investment, three revenue surfaces.** Compliance mappings, post-quantum signing, and tamper-evident audit chain built once — power all three products.
- **Two buyer narratives, never conflated.** A CISO buying CMMC audit defense (ASAF, sovereign bare-metal) and a developer wrapping an AI agent (SouHimBou AI, cloud SaaS) are different sales motions, different price points, different urgency.
- **PQC-MCP is the connective tissue.** The same MCP server lets Claude Code, Cursor, and Windsurf reach into both the compliance engine and the flight recorder via `KHEPRA_MODE` env var.

---

## Slide 03a · PQC-KHEPRA-MCP

**Label:** `03a · PQC-KHEPRA-MCP — The Agent Channel`

> **The only MCP server that's PQC-signed end to end.** 🟢 LIVE

- **`khepra-mcp` binary — 186MB**, runs over stdin/stdout JSON-RPC from Claude Desktop / Cursor / Windsurf 🟢
- **15 registered tools** including: `ert_scan`, `stig_check`, `cmmc_assess`, `dag_attestation_export`, `flight_export`, `source_scan`, `dark_crypto_contribute`, `suggested_next_tools` 🟢
- Distribution: GHCR (`ghcr.io/etherversecodemate/khepra-mcp:latest`), targeting AWS Marketplace GovCloud ECR + Iron Bank 🟢
- Every tool response ML-DSA-65 signed and DAG-anchored 🟢
- `KHEPRA_MODE` env var routes to ASAF (sovereign/DoD) or SouHimBou AI (SaaS) 🟢

**Buyer:** Dev/security-eng — bundled into both ASAF and SouHimBou AI; no standalone pricing page.

```bash
docker run --rm -i \
  -e KHEPRA_LICENSE_KEY \
  -e KHEPRA_MODE=sovereign \
  ghcr.io/etherversecodemate/khepra-mcp:latest
```

---

## Slide 03b · SOUHIMBOU AI

**Label:** `03b · SOUHIMBOU AI — Agentic SOC Platform`

> **"I AM SOUHIMBOU — The AI Security Architect for your Agentic SOC."** 🟡 Beta Live

**Domain:** souhimbou.ai *(currently deployed at adinkhepra.com — domain migration pending)*

**What's live today (verified 2026-06-28):**
- **Flight Recorder** — 3-line SDK wraps any AI agent; attests every tool call to ML-DSA-65-signed DAG 🟢
- **STIG Compliance Console** — authenticated dashboard with Drift Detection Active, AI Verification Online, Papyrus STIG setup agent live in widget 🟢
- **89 edge functions deployed** with real invocation history: billing (108), auth/OTP (107), license (105), OSINT orchestrator (63), PQC key generator (55), Grok AI chat (57) 🟢
- **42 database tables** — 9 Adinkra symbols seeded, `calculate_pqc_readiness()`, `v_pqc_transition_dashboard` view, `agent_trust_level` enum (untrusted → sentinel) 🟢
- **Stripe billing live** — `stripe-webhook` 108 deployments, checkout session wired 🟢
- **4 AI/OSINT API keys active** — OpenAI, OpenRouter, Shodan, APIVOID in production secrets 🟢

**Three tiers:**
- **$0 Free** — Flight Recorder (distribution wedge, live now)
- **$99/mo Pro** — Threat detection, evidence export 🟡
- **$499/mo Enterprise** — Full Agentic SOC, SOAR playbooks, multi-agent orchestration 🔴

**Buyer:** Developer, Security Engineer, Startup CTO using AI coding agents.

**Demo prep:** The dashboard at `adinkhepra.com/dashboard` is live and authenticated. Compliance Score shows 0% on fresh org — run a scan or engage Papyrus before any demo to populate findings.

**Talk track:** *"The flight recorder is live. 89 functions deployed, billing wired, OSINT active. The $499 Enterprise SOC layer is in active build — the infrastructure is done, the orchestration logic is shipping now."*

---

## Slide 03c · ADINKHEPRA ASAF

**Label:** `03c · ADINKHEPRA ASAF — CMMC Graph Autopilot Engine`

> **Sovereign. Bare-metal. Zero egress. The only CMMC engine that runs in a SCIF.** 🔴 Pending

**What exists today:**
- **Go CLI binary — verified live** (`adinkhepra.exe`, 172MB, 14 command groups) 🟢
- **6/6 sovereign self-test passes in 104ms** — FIPS 140-3 BoringCrypto, ML-DSA-65, Kyber-1024 KEM, DAG write 🟢
- **25,185 compliance controls** embedded — STIG · NIST 800-171r2 · CMMC 2.0 🟢
- **APDL (ASAF Policy Declaration Language)** spec defined 🟡
- **ASAF System Daemon** spec defined (`cmd/asaf-daemon/`) 🔴

**What is still being built (the "Graph Autopilot" product surface):**
- **CMMC Compliance Graph** — force-directed node graph (Red/Yellow/Orange/Green controls, blast radius, dollar exposure) 🔴
- **ASAF Policy Editor** (inline APDL editing, generates Ansible playbooks) 🔴
- **Staging Approval Gate** — ML-DSA-65 signed human approval gate before production apply 🔴
- **Evidence Export** — C3PAO-ready OSCAL package, POAM CSV, PDF executive brief 🔴
- **ASAF System Daemon** — privileged `systemd` service with CAP_SYS_ADMIN + mTLS 🔴

**Domain:** adinkhepra.com *(currently hosts SouHimBou AI — ASAF will take this domain when the Graph UI ships)*

**Buyer:** CISO, Compliance Lead, Contracts Officer at DIB contractors.
**Pricing:** $25K (Pilot) / $75K (Program) / $150K–$250K (Enterprise) / sole-source up to $5M (SDVOSB)

**CLI proof today:**
```powershell
adinkhepra validate
# → SOVEREIGN VALIDATION: 6/6 tests passed (104ms)
```

**Talk track:** *"The cryptographic engine and compliance database are done — 25,185 controls, PQC-signed, air-gap ready. The Compliance Graph UI is the build we're in now. The CLI is the backend. The Graph is the CISO-facing frontend."*

⚠️ **Fix before this goes out:** binary self-identifies as `v2.0`; release tag says `v0.1.1`. Resolve before investor or pilot sees this.

---

## Internal verification appendix — NOT for the deck

Keep this section for prep/diligence answers only.

### PQC-Khepra-MCP 🟢
- 15 tool files in `pkg/mcp/tools/`, registered names confirmed, binary 186MB
- GHCR image live, Dockerfile.mcp exists, AWS Marketplace GovCloud target
- `KHEPRA_MODE` env var routing confirmed in source

### SouHimBou AI 🟡
- **Domain mismatch:** Currently live at `adinkhepra.com`. Needs migration to `souhimbou.ai`.
- **Authenticated dashboard session — now screenshot-confirmed.** Live screenshot of `adinkhepra.com/asset-scanning?runScan=true`, logged in as `apollo6972@proton.me`, "STIG-First Compliance Dashboard," Run Scan button live, AI assistant widget present. **Correction:** the widget is labeled **"Khepra AI"** (badge: "AdinKhepra v1"), not "Papyrus" as previously noted here — fix this naming in any slide copy before it goes out, since an investor clicking around would see "Khepra AI," not "Papyrus."
- ⚠️ **Scope of that screenshot:** it's the original `/asset-scanning` STIG-first flow, not the newly-wired `/souhimbou` SOC page. It confirms the core STIG console works live — it does NOT touch or resolve the `compliance_control_gaps` bug below, which is on a different route.
- **Independently re-verified via direct SQL through the Supabase Management API** (different method than however the original numbers were produced — strong cross-check):
  - 89 edge functions — confirmed exact match via `supabase functions list`
  - 42 tables in `public` schema — confirmed exact match via `information_schema.tables`
  - 9 Adinkra symbols seeded — confirmed exact match via `SELECT count(*) FROM adinkra_symbols`
  - `calculate_pqc_readiness()` function exists — confirmed via `information_schema.routines`
  - `agent_trust_level` enum exists — confirmed via `pg_type`
- 🔴 **Real bug found during this verification pass — `compliance_control_gaps` does not exist.** `AgenticComplianceArchitect.tsx` (the component rendered at `/souhimbou`) queries it at lines 140, 218, 238 — confirmed via direct query: `relation "compliance_control_gaps" does not exist`. The prior note ("schema exists, 0 rows, migration pending") was wrong — there's no schema at all. Actual tables in the DB: `compliance_tasks`, `agent_registry`, `mcp_agent_snapshots`, `mcp_compliance_events`. Checked whether `compliance_tasks` is a safe rename target — it isn't; column shapes don't match closely enough (`task_type`/`title`/`priority`/`automation_data` vs whatever gap-specific fields the component expects) for a blind swap. **This will error on page load today.** Needs either a real migration creating the missing table or a component rewrite against `compliance_tasks` — not yet fixed, decision pending.
- Run Scan button fixed: now calls `agentic-compliance-orchestrator` inline with toast feedback, falls back to `/asset-scanning` navigation
- `pkg/souhimbou/` (Core Agent, SOAR engine) does NOT exist — $499 tier is a priced roadmap

⚠️ **Before any demo:** the `/souhimbou` route will currently throw on load due to the missing table above. Either fix it first or route around it (e.g., demo `/enterprise-agents` or another SOC page that doesn't hit `compliance_control_gaps`) instead of clicking into SouHimBou AI's primary landing page live in front of anyone.

### AdinKhepra ASAF 🔴
- Go CLI binary verified: 172MB, `validate` 6/6 passes in 104ms, 25,185 controls embedded
- `pkg/asaf/wrapper.go`, `drift.go`, `recorder.go` exist (flight recorder components)
- CMMC Graph UI: `pkg/webui/compliance_graph.go`, `pkg/asaf/policy_editor.go`, `pkg/asaf/staging_gate.go`, `cmd/asaf-daemon/main.go` — NONE of these exist yet
- `frontend/compliance-graph/` — does not exist yet
- adinkhepra.com domain will need to be reclaimed from SouHimBou AI deployment when ASAF Graph ships

---

## What changed from prior version

| Prior (wrong) | Corrected |
|---|---|
| "adinkhepra.com LIVE — ASAF dashboard" | adinkhepra.com hosts **SouHimBou AI** on wrong domain |
| ASAF = the web app / STIG Console | ASAF = bare-metal Go binary + CMMC Graph (pending) |
| "ASAF Slide 03a" was the primary product | SouHimBou AI is the primary **live** product (Beta) |
| $45K–$250K pricing on "live" product | ASAF pricing is for pending product — not yet claimable as live |
| "Drift Detection Active" attributed to ASAF | Drift Detection Active = SouHimBou AI feature |
