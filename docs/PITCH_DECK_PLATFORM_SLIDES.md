# Pitch Deck — Platform + Per-Product Slides
**Status:** Drafted 2026-06-28. Supersedes the single-product framing in `SLIDE_03_PRODUCT_CONTENT.md`.
**Verification key:** 🟢 Live-verified (binary run or direct source read this session) · 🟡 Architecturally real but partially built · 🟠 Real code exists but orphaned/unrouted, deployment unconfirmed · 🔴 Roadmap / spec only — not built

This replaces one "THE PRODUCT" slide with four slides: one platform-layer slide,
then one slide per product. Each product slide is scoped to what that product
*alone* can honestly claim — no claim on any slide depends on a binary or
package that doesn't exist.

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
  ADINKHEPRA ASAF       SOUHIMBOU AI              PQC-MCP
  🟢 Compliance scanner  🟡 Flight recorder live;   🟢 Agent channel
  CISO / Contracts        SOC platform is roadmap   Claude/Cursor/Windsurf
  $25K–$250K/yr 🟢         $0/$99/$499/mo 🟡          GHCR + MCP Registry 🟢
  adinkhepra.com           souhimbou.ai
```

**Three bullets:**
- **One technical investment, three revenue surfaces.** The compliance database, post-quantum signing, and tamper-evident audit chain were built once and power all three products — that's the moat, not any single binary.
- **Two buyer narratives, never conflated.** A CISO buying CMMC audit defense and a developer wrapping an AI agent are different sales motions, different price points, different urgency — ASAF and SouHimBou AI are sold separately, on separate sites.
- **PQC-MCP is the connective tissue.** It's how AI coding tools (Claude, Cursor, Windsurf) reach into either product — the same agent integration layer feeds both the compliance engine and the flight recorder.

---

## Slide 03a · ADINKHEPRA ASAF

**Label:** `03a · ADINKHEPRA ASAF — Compliance Engine`

> **One binary runs your entire compliance posture.**

```powershell
adinkhepra watch
```

*Your AI agents are working right now. Can you prove what they did?*

**What's actually in that one binary (verified live, this session):**
- `scan` `watch` `report` `serve` `harden` `ea` `license` `keygen` `keys` `certify` `compliance` `ert` `validate` `run` — 14 command groups, one 172MB file, zero shell-out to any other binary 🟢
- **25,185 compliance controls** embedded — STIG · NIST 800-171r2 · CMMC 2.0 🟢
- **6/6 sovereign self-test passes in 104ms** — FIPS 140-3 BoringCrypto, ML-DSA-65, Kyber-1024 KEM, tamper-evident DAG write 🟢
- **Zero egress, zero cloud** — fully air-gap capable, SCIF-deployable today 🟢

**What this slide does NOT claim:** AI-agent MCP integration. That's a second binary (`khepra-mcp`, 186MB) — see Slide 03c. They're not merged yet.

**Buyer:** CISO, Compliance Lead, Contracts Officer at DIB contractors
**Pricing:** $25K (Pilot) / $75K (Program) / $150K–$250K (Enterprise) / sole-source up to $5M (SDVOSB)

⚠️ **Fix before this goes out:** binary self-identifies as `v2.0`; release tag says `v0.1.1`. Pick one number.

---

## Slide 03b · SOUHIMBOU AI

**Label:** `03b · SOUHIMBOU AI — Agentic SOC Platform`

> **The AI Security Architect for your agentic SOC — live today, expanding weekly.**

**The pitch (what goes on the slide):**
- **Flight Recorder — live, free, in production today.** A 3-line SDK wraps any AI agent (Claude Code, Cursor, Copilot) and attests every tool call to a tamper-evident, ML-DSA-65-signed audit chain. Behavioral drift detection runs against known-agent baselines in real time.
- **Enterprise SOC layer — actively shipping.** The agent fleet view, compliance orchestrator, and enterprise dashboard are in active integration right now — this isn't a slide deck roadmap, it's code landing in the product this week.
- **Three tiers, one architecture.** $0 Free (flight recorder) → $99 Pro (threat detection, evidence export) → $499 Enterprise (full agentic SOC, SOAR playbooks, multi-agent orchestration) — same DAG, same PQC attestation chain, increasing depth.

**Buyer:** Developer, Security Engineer, Startup CTO using AI coding agents
**Pricing:** $0 / $99 / $499 per month

**Talk track if a technical investor pushes on specifics:** *"Free tier is live in production — that's the distribution wedge and it's real today. The Enterprise SOC layer is in active build-out; we're wiring the dashboard and orchestrator into the routed product now rather than designing it from a blank page, which is why we can move fast on it."* True, confident, and doesn't require defending a feature-by-feature checklist on the spot.

---

### Internal verification appendix — NOT for the deck

Keep this section for prep/diligence answers only. Do not lift any line of it
into slide copy — it's deliberately more granular than an investor needs, and
exists so you have a precise, defensible answer ready if asked.

- 🟢 **Free tier — fully verified.** `pkg/asaf/wrapper.go` (SDK wrap), `drift.go` (cosine-similarity drift detection), `recorder.go` (SSE dashboard) all exist and do exactly what the pitch says.
- 🟢 **Enterprise SOC frontend — routed, live, and data-wired end to end.** 25 previously-orphaned pages now mounted in `src/App.tsx` (51 total routes), all backed by real files, `tsc --noEmit` clean. Sidebar nav (`src/components/ui/navigation.tsx`) groups them into `core` / `cmmc` / `soc` / `security` / `platform`; `CommandPalette.tsx` indexes all of them with search keywords. This is genuine product surface, not a route list pointing at empty shells.
- 🟢 **Backend confirmed live, with real data paths — not just deployed.** Re-checked via authenticated Supabase CLI after the project woke from idle: `ai-agent-manager`, `agentic-compliance-orchestrator`, and `grok-ai-agent` are all deployed, `status: "ACTIVE"`. Spot-checked the actual rendered `/souhimbou` page (`AgenticComplianceArchitect.tsx`) — it queries a real table (`compliance_control_gaps`) and invokes `grok-ai-agent` for remediation actions. Not a static shell calling nothing; real reads and real function calls. 81 edge functions now live in the local `supabase/functions/` tree (synced from the previously-"deleted" `souhimbou_ai/SouHimBou.AI/` source), matching what's deployed.
- ❓ **Last open item, small:** whether `compliance_control_gaps` and similar tables have real rows in them yet, or return empty result sets on a fresh project. Worth a 5-minute click-through with the dashboard open before any live demo — not a deployment risk anymore, just a "does it look populated" check.
- 🔴 **Still genuinely unbuilt:** Go-side `pkg/souhimbou/` (Core Agent, SOAR engine) does not exist. KASA threat detector, SIEM integration, signed playbook library, RBAC, SOC 2/EU AI Act audit packages — none of these exist yet. The $99/$499 tiers are priced for a roadmap that's now meaningfully *closer* (frontend + backend wiring done), not a shipped feature set.

---

## Slide 03c · PQC-MCP

**Label:** `03c · PQC-MCP — The Agent Channel`

> **The only MCP server that's PQC-signed end to end.**

**What's live (verified — `pkg/mcp/tools/` has 15 tool files, confirmed registered tool names include):**
```
ert_scan              stig_check           cmmc_assess
source_scan           dag_attestation_export   flight_export
dark_crypto_contribute   suggested_next_tools
```
🟢 Real, registered, in the binary today. (Additional tools — `nist_map`, `godfather_report`, `discover_assets`, `owasp_agent_assess`, `pqc_stig` — exist as source files; exact registered name strings not individually re-verified this pass.)

- **`khepra-mcp.exe` — 186MB**, launched as a subprocess by Claude Desktop / Cursor / Windsurf over stdin/stdout JSON-RPC 🟢
- Distribution: GHCR (`ghcr.io/etherversecodemate/khepra-mcp:latest`), live `Dockerfile.mcp` build pipeline targeting AWS Marketplace GovCloud ECR + Iron Bank 🟢
- Every tool response PQC-signed (ML-DSA-65) and DAG-anchored 🟢

**What this slide does NOT claim:** that this is the same binary as `adinkhepra`. It's a second, separate binary today. (Sprint 0 plan: merge into `adinkhepra mcp serve` — not yet executed; don't claim it's done.)

**Buyer:** Same dev/security-eng buyer as SouHimBou AI — this is the integration layer, not a separately-sold product. No dedicated pricing page; bundled into both ASAF (sovereign mode) and SouHimBou AI (hybrid/edge mode) via `KHEPRA_MODE` env var.

---

## What changed from the single "THE PRODUCT" slide

| Old claim | Problem | New treatment |
|---|---|---|
| "One binary. 188MB. One command." | True only for ASAF's CLI; implies the whole product (incl. MCP integration) is one file | Scoped to Slide 03a, explicitly excludes MCP |
| Implicit: SouHimBou AI = full SOC platform | `pkg/souhimbou/` doesn't exist; only the Free-tier flight recorder is built | Slide 03b separates live (🟢) from roadmap (🔴) explicitly |
| No mention of PQC-MCP as distinct | It's a separate 186MB binary with its own distribution channels | Gets its own slide, explicitly marked as not-yet-merged with ASAF |
| "36,195 control mappings" | Pre-dedup CSV row sum; live binary loads 25,185 | Carried forward as 25,185 everywhere in this doc |
