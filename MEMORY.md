# MEMORY.md — KHEPRA / NouchiX Strategic Operating Memory

> **PERMANENT REFERENCE** — Last updated: 2026-05-24
> This file is the strategic compass. CLAUDE.md holds technical norms. Together they are the full context.

---

## 🗺️ Repository Topology — Authoritative Map

Dev and production are intentionally separated: minimize attack surface, prevent sensitive file exposure, gate all changes through audit/testing/red-team before they reach customers.

| Role | GitHub Remote | Local Path | Purpose |
|---|---|---|---|
| **Main Dev** | https://github.com/EtherVerseCodeMate/giza-cyber-shield | `C:\Users\intel\blackbox\khepra protocol` | All dev, audits, testing, red-teaming, sandboxing — **never deploy directly from here** |
| **Prod: ASAF** | https://github.com/nouchix/Adinkhepra-ASAF | `C:\Users\intel\blackbox\Adinkhepra-ASAF` | Production-ready ASAF binary — clean, no dev artifacts |
| **Prod: MCP** | https://github.com/nouchix/PQC-Khepra-MCP | `C:\Users\intel\blackbox\PQC-Khepra-MCP` | Production-ready MCP server — clean, no dev artifacts |
| **Side: AI Brain** | https://github.com/EtherVerseCodeMate/G0DM0D | *(lives in main dev as `pkg/g0dm0d3/`)* | G0DM0D AI engine — pluggable LLM abstraction, DAG context injection, KHEPRA tool panel |
| **Iron Bank** | https://github.com/nouchix/adinkhepra-asaf-ironbank | *(no local copy — deleted to save disk space)* | IB submission only — thin copy, never the full dev tree |

### Promotion Flow

```
Dev / red-team / experiments
        │
        ▼
giza-cyber-shield  (main dev — EtherVerseCodeMate)
        │  audit / test / sandbox gate
        ├──► nouchix/Adinkhepra-ASAF       (ASAF prod)
        └──► nouchix/PQC-Khepra-MCP       (MCP prod)
                                              │
                                     thin cherry-pick
                                              ▼
                           nouchix/adinkhepra-asaf-ironbank  (IB only)

G0DM0D  (side repo — AI brain, EtherVerseCodeMate)
    └──► consumed as pkg/g0dm0d3/ inside giza-cyber-shield
         ├─► /api/g0dm0d3/chat    (streaming, DAG-grounded)
         └─► /api/g0dm0d3/status  (provider + DAG node count)
```

### Iron Bank Repo Rules
- No local clone — clone temporarily if needed: `git clone https://github.com/nouchix/adinkhepra-asaf-ironbank`
- Feed it only files the Iron Bank checklist requires — never the full dev tree
- `vendor/` and `trufflehog-config.yaml` must be in `.gitignore` there

### G0DM0D — AI Brain + Evolutionary Algorithm + Quantum Defense Layer

G0DM0D is the AI engine AND full EA kernel that makes KHEPRA *agentic* and *self-hardening*. It is a wealth of value as a standalone repo. Two packages:

**`pkg/g0dm0d3/`** — AI Brain

| Attribute | Detail |
|---|---|
| GitHub | https://github.com/EtherVerseCodeMate/G0DM0D |
| Role | Pluggable LLM abstraction + KHEPRA tool panel + live DAG context injection |
| Provider chain | Anthropic Claude → OpenRouter → Offline rule-based (zero deps, always works) |
| Tool panel | `dag-summary`, `stig-summary`, `pqc-inventory`, `forensics-summary`, `license-status`, **`ea-status`** |
| Air-gap/SCIF | Full offline mode — no API key, zero external calls |

**`pkg/ea/`** — Evolutionary Algorithm Kernel (NVIDIA NeMo mythos-router-inspired)

| File | Role |
|---|---|
| `engine.go` | Core EA loop: selection, crossover, mutation, elitism, DAG-signed generation recording |
| `adinkra_evolution.go` | Adinkra Spectral Lattice genome: evolves ML-DSA-65/Kyber-1024 parameter mappings |
| `ert_bridge.go` | Bridges EA with ERT findings; threat-aware multi-objective fitness function |
| `kernel_router.go` | EA-evolved capability dispatcher: routes SecurityContext to KernelAgents in fitness order |

**EA parameters:** pop=50, mutation=0.02, crossover=0.75, elites=2, genome=96 bytes (AdinkraGenomeSize)

**Quantum attack simulators (fitness inputs):**

| Attack | 5yr Probability | Resistance |
|---|---|---|
| Shor's algorithm (RSA/ECDSA break) | 15% | 0.98 — ML-DSA-65 is Shor-resistant |
| Grover's search (key halving) | 35% | 1.0 if SecurityBits ≥ 256 |
| BKZ/LLL lattice reduction | 25% | Exponential in N, Q, Sigma |
| Timing/power side-channel | 45% | 0.88 when module rank K ≥ 3 |
| Adinkra symbol collision (patent-novel) | 5% | Scales with Q-diversity |

**Threat-aware fitness formula:**
```
Fitness = 0.35×BaseAttackResistance + 0.25×KEV_Coverage
        + 0.20×NISTCompliance + 0.20×ERTFindingPenalty
× 1.5 bonus if all LatticeParams pass NIST validation
```

**KernelRouter capabilities (EA-weighted, self-tuning):**
STIG → PQC → Forensics → IR → FIM → BCDR → Network → SBOM

**Why this is a moat:**
1. **Self-hardening crypto** — EA evolves optimal Adinkra→lattice param mappings against live threat model. Patent-pending.
2. **Tamper-evident evolution trail** — every generation ML-DSA-65-signed to DAG. FedRAMP/CMMC auditors see cryptographic proof the system got smarter.
3. **Quantum-native** — only compliance platform with a quantum attack simulator driving continuous crypto hardening.
4. **`ea-status` tool** — AI brain can report live evolution status (`generation`, `best_fitness`, `best_symbol`) via `[TOOL:ea-status]`.

### Sensitive Asset Locations

| Asset | Lives In | Never In |
|---|---|---|
| PQC private keys | VPS `~/.asaf/keys/` + sealed local | Any GitHub repo |
| `vendor/` directory | `.gitignore` (Iron Bank repo) | Iron Bank git index |
| `.env.local` / secrets | Local only | Any repo |
| Production binaries | VPS `/opt/adinkhepra/` | Source repos |

---

## 🎯 North Star: $100M ARR by Year 7 (or strategic acquisition at $500M–$800M)

The DCF (accelerated case) puts Year 5 revenue at $22M. Closing the gap to $100M requires three compounding levers — not more features.

### Revenue Gap Table

| Milestone | Current Trajectory | $100M ARR Path |
|---|---|---|
| Year 1 | $85K–$200K | $500K–$1M |
| Year 3 | $1.2M–$3.5M | $10M–$15M |
| Year 5 | $8.5M–$22M | $50M–$75M |
| Year 7 | ~$40M | $100M+ |

---

## 🏗️ Three Paths to $100M ARR

### Path 1: GovCon Locomotive (Fastest to $10M, Slowest to $100M)

- **Lever**: SDVOSB sole-source authority — single most underutilized asset
- **Math**: 20 enterprise GovCon clients × $5M = $100M (~150 DIB prime contractors, NOT 10,000 SMBs)
- **Gate conditions**: Iron Bank approval, CRITICAL findings = 0, in front of a program office (not QCL email), GovCon BD hire by Month 6
- **First move**: One $5M sole-source IDIQ proves the model

### Path 2: MCP Marketplace Multiplier (Highest Ceiling, Most Leverage)

- **Lever**: AWS Marketplace GovCloud distribution
- **Math**: 500 defense contractor orgs × $75K–$150K annual = $37M–$75M ARR
- **Gate conditions (do in 90 days)**:
  1. AWS listing live with hardened Docker image (before competitor copies positioning)
  2. Open-core GitHub repo at 500+ stars (inbound flywheel)
  3. 2-minute demo video: `ert scan` → DAG → Godfather Report in real time
- **Current sprint focus**: MCP registry submissions this week

### Path 3: MSP Licensing Multiplier (Best Unit Economics)

- **Lever**: White-label engine for MSPs serving DIB clients
- **Math**: 1 MSP × 100 clients × $15K–$25K/yr = $1.5M–$2.5M ARR per MSP; 40 MSPs = $60M–$100M
- **Product needed**: Multi-tenant flat license at $150K–$250K/yr + reseller agreement
- **Why it works**: Air-gap architecture = what MSPs need; eliminates their per-seat SaaS costs

---

## 💡 Unicorn Path ($1B)

$100M ARR × 10x = $1B organic. But acquisition at $500M–$800M can happen at $30M–$50M ARR.

**M&A trigger combination** (target: end of 2026):
- Iron Bank approval ✅ (in progress)
- First DoD IDIQ contract
- khepra-mcp on AWS Marketplace
- 2–3 signed MSP deals

Strategic buyers: Palo Alto, CrowdStrike, Leidos, Booz Allen.
Their motivation: 36,195 mappings moat + PQC attestation + SDVOSB status + Iron Bank credential.

---

## 📦 AWS Marketplace SKUs

| SKU ID | Name | Annual Price | Target |
|---|---|---|---|
| KHEPRA-PRO-ANN | KHEPRA Professional | $35,000 | SMB DIB contractors |
| KHEPRA-ENT-ANN | KHEPRA Enterprise | $95,000 | Mid-market primes |
| KHEPRA-STRAT-ANN | KHEPRA Strategic | $195,000 | Large contractors + agencies |

---

## ⚠️ Iron Bank — Current Blocker, Resolution & De-Risking

> **Strategic note**: Iron Bank is subject to Platform One administrative theater — external admin control, months of delay, Jeff Goluba non-responsive. Iron Bank is **one of four active distribution channels**. It does NOT gate revenue on the other three. Pursue it in parallel; never let it block Sprint 0–2 closes.

| Channel | Iron Bank Required? | Priority |
|---|---|---|
| Direct pilot agreements (QCL warm prospects) | ❌ No | **Close NOW** |
| AWS Marketplace GovCloud | ❌ No | **List NOW** |
| MCP registry (modelcontextprotocol.io / mcpservers.org / cline.bot) | ❌ No | **Submit NOW** |
| MSP flat licensing | ❌ No | First call this week |
| Platform One / P1 hardened catalog | ✅ Yes | Parallel track — Wednesday session |

### Pipeline Status: BLOCKED at setup stage

**Root Cause (diagnosed)**:
```
ERROR: trufflehog-config file found but TRUFFLEHOG_CONFIG CI variable does not exist
EXIT CODE 1
```

Pipeline logic: if `trufflehog-config.yaml` exists in repo AND `TRUFFLEHOG_CONFIG` CI variable is not set at project level → hard fail. Jeff Goluba (Iron Bank onboarding, OmniFederal) enabled the repo but never set the variable. He has been non-responsive.

### Key References

| Item | Detail |
|---|---|
| Iron Bank repo | https://repo1.dso.mil/dsop/nouchix/adinkhepra |
| Onboarding issue | https://repo1.dso.mil/dsop/nouchix/adinkhepra/-/issues/7 |
| Project ID | 18821 |
| Jeff Goluba (gov) | jeffrey.goluba.1.ctr@us.af.mil |
| Jeff Goluba (contractor) | jeffrey.goluba@omnifederal.com |
| Weekly session | Wed 16:00 ET — https://www.zoomgov.com/meeting/register/vJIscuitrzgqGL_zbboa1qyuJYG3jmV2KBs |
| IB team chat | #iron-bank on chat.il2.dso.mil |

### Human Track (Track 1)

- [x] Registered for Wednesday session
- [x] Sent technical email to both Jeff addresses
- [ ] Post detailed comment on Issue #7 (tag @jeff.goluba, label: help wanted)
- [ ] Attend Wednesday session — screen share, Issue #7 open, paste ask in chat

**Wednesday session chat paste:**
```
Project dsop/nouchix/adinkhepra (ID: 18821) — pipeline blocked at setup.
Need TRUFFLEHOG_CONFIG CI variable enabled. trufflehog-config.yaml is in
repo root excluding vendor/. False positives are Go stdlib SHA commit hashes,
not credentials. One admin action unblocks the full pipeline.
```

### Technical Track (Track 2) — ACTIVE FOCUS

**Fix**: Remove both `vendor/` and `trufflehog-config.yaml` from git. Use `go mod download` at Docker build time.

```bash
# Remove from git (keep local)
git rm -r --cached vendor/
git rm --cached trufflehog-config.yaml

# Update .gitignore
echo "vendor/" >> .gitignore
echo "trufflehog-config.yaml" >> .gitignore
```

**Dockerfile.ironbank builder stage (replace COPY vendor/ block):**
```dockerfile
COPY go.mod go.sum ./
RUN GONOSUMCHECK="*" GOFLAGS="-mod=mod" go mod download && go mod verify
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-s -w -extldflags '-static'" \
    -o bin/adinkhepra ./cmd/adinkhepra
```

**Verify locally before pushing:**
```bash
go mod tidy && go mod download
```

---

## 📅 Operational Sprint Plan

### Sprint 0 — This Week (Revenue Ignition)

**Priority 1: Close 2 Warm QCL Prospects**
- Draft one-page Pilot Agreement today:
  - Scope: `ert full` scan + Godfather Report + 90-day access
  - Price: $15K–$25K (SMB) / $50K (mid-market)
  - Deliverable: signed attestation report + DAG audit trail
- Send with Stripe Payment Link — subject: `"Pilot Agreement + Next Steps — [Company Name]"`
- Phone follow-up within 24 hours of sending

**Priority 2: MCP Registry Submissions (2 hours)**
- registry.modelcontextprotocol.io (primary)
- mcpservers.org (secondary)
- cline.bot (secondary — GitHub issue: https://github.com/cline/mcp-marketplace/issues/new)

**Listing copy:**
> KHEPRA MCP Server — Sovereign compliance engine with 36,195 STIG/CCI/NIST/CMMC mappings. Air-gappable. Zero token costs. Flat annual licensing. Run `ert_scan` → get a Godfather Report with dollar-denominated business impact. The only MCP compliance server that runs on your metal.

---

### Sprint 1 — Days 1–30 (Distribution Infrastructure)

| Action | Done When |
|---|---|
| Open-core GitHub repo live | Real README, ert demo GIF/video embedded |
| 2-min demo video | Posted GitHub + LinkedIn |
| AWS Marketplace listing draft | 3 SKUs submitted for review |
| Blog: "Why KHEPRA is immune to AI pricing crisis" | Published + linked from GitHub |
| Iron Bank: all stages passing | VAT dashboard green |
| First pilot agreement signed | Stripe payment received |

---

### Sprint 2 — Days 31–60 (First Revenue Closes)

**Target: $50K–$100K ARR**

| Action | Done When |
|---|---|
| AWS Marketplace listing submitted | Listing ID assigned |
| ML-DSA-65 manifest signing end-to-end | `adinkhepra sign` works on any artifact |
| 5 QCL demos scheduled | Calendar invites sent |
| 1 MSP first call | Completed |
| Iron Bank VAT at zero | All findings justified |
| Second pilot signed | Stripe payment received |

**MSP LinkedIn outreach:**
> "You're paying usage-based AI costs on behalf of your DIB clients. KHEPRA MCP Server eliminates that — one flat annual license covers your entire client base. 36,195 STIG/CMMC mappings, air-gappable, runs on your infrastructure. Would a 20-minute call make sense?"

---

### Sprint 3 — Days 61–90 (Scale Signals)

**Target: $85K–$200K ARR, pipeline of 20 opportunities**

| Action | Done When |
|---|---|
| AWS Marketplace listing live | First inbound inquiry |
| 1 MSP deal closed ($75K–$150K flat) | Contract signed |
| 20 opportunities in CRM | QCL pipeline documented |
| SBIR Phase I drafted | Ready to submit |
| Iron Bank approved | Image live on ironbank.dso.mil |

---

### 12-Month Target: $500K–$1M ARR

- AWS Marketplace: first 3–5 paying subscribers
- SBIR Phase I: submitted ($256K–$314K non-dilutive)
- 1 MSP deal closed ($75K–$150K flat)
- 1 GovCon vehicle (micro-purchase at $25K starts contracting history)
- Hires: 1 Go engineer + 1 GovCon BD

### 36-Month Target: $10M–$15M ARR (M&A Zone)

- 5–10 MSP relationships → $5M–$8M ARR
- AWS Marketplace inbound → $3M–$5M ARR
- IDIQ or SBIR Phase II–III → $2M–$5M
- Series Seed or SBIR Phase II → team of 8–10

---

## 🧮 Daily Priority Stack (Solo Founder)

~4–6 focused hours/day. Never reorder unless a paying customer demands it:

1. **Close warm prospects** (revenue — everything else is funded by this)
2. **MCP registry submissions** (distribution — async leverage)
3. **AWS Marketplace listing** (scale infrastructure)
4. **Iron Bank completion** (credibility signal for M&A)

> New features and architecture docs are **third tier** until the first check clears.

---

## 🚫 What Kills This Plan

- Building features without a paying customer attached to the sprint
- Treating Iron Bank as a prerequisite to selling (it's not — sign pilots now)
- Missing the 18–24 month window before Vanta/Drata/Tenable copies KHEPRA's feature set
- Letting Jeff Goluba's silence block the pipeline (attend the Wednesday session, own it)
- Confusing dev repo (giza-cyber-shield) with prod repos (Adinkhepra-ASAF, PQC-Khepra-MCP) — always gate through audit before promoting
- Committing `vendor/`, secrets, or dev artifacts to the Iron Bank repo

---

## 🔴 Threat Intelligence — Claude Code MCP OAuth Interception (Mitiga Labs, 2026-04-10)

> **Status**: No patch from Anthropic (ruled out-of-scope 2026-04-12). Full detection and response burden falls on us.
> **Severity**: CRITICAL — directly threatens PQC-Khepra-MCP's OAuth-connected integrations and any developer running Claude Code against our MCP server.

### Attack Summary

A five-step supply chain attack silently redirects Claude Code's MCP traffic through attacker-controlled infrastructure, intercepting OAuth bearer tokens that grant persistent, broadly scoped access to connected SaaS platforms (Jira, Confluence, GitHub, etc.).

**Entry point**: Malicious npm package with a hidden `postinstall` lifecycle hook that executes silently during `npm install`.

**Primary target**: `~/.claude.json` — the global config file governing how Claude Code routes ALL MCP traffic and where OAuth tokens are stored **in plaintext**.

### The Five-Step Chain

| Step | Action |
|---|---|
| **1. Delivery** | Malicious npm package installs a `postinstall` hook; seeds `alreadyTrusted: true` flags across common developer clone paths in `~/.claude.json` |
| **2. Path seeding** | Hook edits `~/.claude.json` to insert a `sessionStart` hook that fires every time Claude Code loads any trusted project |
| **3. Endpoint rewrite** | Session hook replaces legitimate MCP server URLs (e.g., our `khepra-mcp` endpoint or Atlassian) with a localhost proxy |
| **4. Token interception** | Claude Code reads the rewritten URL, connects to the attacker's proxy; OAuth bearer token transits attacker infrastructure; provider sees a valid flow from Anthropic's egress IP |
| **5. Persistent reseeding** | Hook reasserts malicious config on every Claude Code load — token rotation actively **feeds the attacker** by delivering a fresh token |

### Why Bearer Tokens Are High-Value Targets

- **Persistent** — stored with refresh token; one interception = durable foothold
- **Broadly scoped** — inherits all permissions granted at OAuth time, no per-call narrowing
- **Weakly stored** — plaintext in `~/.claude.json` alongside trust flags, same file permissions
- **Unattributable server-side** — presented from Anthropic egress IPs; indistinguishable from legitimate traffic in provider audit logs

### Why This Directly Threatens PQC-Khepra-MCP

Our MCP server (`nouchix/PQC-Khepra-MCP`) is registered in `.mcp.json` and consumed by Claude Code. If a developer's `~/.claude.json` is compromised:

1. Our `KHEPRA_SERVICE_SECRET` env var transits the proxy at session start
2. Any OAuth tokens we issue (Supabase, future GitHub/Atlassian integrations) are intercepted
3. `SecureCredentialVault.ts` encrypted-at-rest posture means nothing once the token is live in memory and transiting a compromised MCP channel
4. The attack survives `SecureCredentialVault.rotateEncryptionKeys()` — rotation feeds fresh tokens to the attacker as long as the hook lives in `~/.claude.json`

### Remediation Order (CRITICAL — do NOT just rotate tokens)

> **⚠️ Token rotation BEFORE hook removal makes the attack worse — it delivers a fresh token to the proxy.**

**Correct IR sequence:**
1. `cat ~/.claude.json` — inspect every `mcpServers` URL; verify no localhost proxy entries exist
2. Remove any unrecognized `sessionStart` hooks from `~/.claude.json`
3. Kill any unexpected local proxy processes (`netstat -an | grep LISTEN`)
4. **Then** rotate OAuth tokens and `KHEPRA_SERVICE_SECRET`
5. Audit npm packages in all developer environments: `npm ls --depth=0` + check `package.json` `scripts.postinstall`

---

## 🛡️ PQC-Khepra-MCP Hardening Action Items

Derived from the Mitiga Labs attack chain. These are concrete code/config changes needed in `nouchix/PQC-Khepra-MCP`.

### P0 — Immediate (Before Next Deploy)

- [ ] **Audit `.mcp.json` on every dev machine** — run `cat ~/.claude.json` and verify `khepra-mcp` URL is `go run ./cmd/khepra-mcp/main.go`, not a localhost proxy
- [ ] **Add `KHEPRA_MCP_URL_EXPECTED` env check** — at MCP server startup, validate that the transport URL Claude Code is connecting from matches an allowlist; log + alert on deviation
- [ ] **Never store OAuth tokens in `~/.claude.json`** — our `.mcp.json` uses env vars (`${KHEPRA_SERVICE_SECRET}`), not inline tokens; enforce this in PR reviews

### P1 — This Sprint

- [ ] **MCP Transport Integrity Check** — add a startup assertion in `cmd/khepra-mcp/main.go` that compares the reported MCP client connection origin against a configurable allowlist; emit a signed ASAF event on mismatch
- [ ] **npm postinstall audit step** in CI — `grep -r "postinstall" node_modules/.hooks` or equivalent; fail build if any postinstall hook is not in an approved list (`scripts/approved-hooks.txt`)
- [ ] **`SecureCredentialVault` token binding** — bind issued tokens to a PQC-signed device fingerprint (ML-DSA-65 attestation); tokens presented from a different device/origin are rejected server-side even if valid
- [ ] **ASAF event: `mcp_url_rewrite_detected`** — add detector in `pkg/asaf/recorder.go` that fires when the MCP server URL in `~/.claude.json` differs from the canonical value at session start
- [ ] **Developer runbook** — add `docs/MCP_SECURITY_RUNBOOK.md` with the 5-step IR sequence above; link from `SECURITY.md` and `llms-install.md`

### P2 — Sprint 2

- [ ] **Signed MCP config** — ship `server.json` with an ML-DSA-65 signature over the `mcpServers` block; Claude Code wrapper script verifies signature before loading config
- [ ] **npm package allowlist** — add `scripts/check-npm-integrity.sh` that validates all packages against a SHA-256 allowlist; run as pre-commit hook
- [ ] **SaaS audit log correlation** — in `ProductionSecurityService.ts`, add a detection rule: flag any OAuth refresh that originates from an IP in Anthropic's egress range (`35.0.0.0/8` and related) against a user's known dev machine IPs
- [ ] **Token scope narrowing** — when issuing OAuth tokens for MCP integrations, request minimum scope (read-only where possible); document scope inventory in `SECURITY.md`

### Detection Signatures for ASAF

Add these to `pkg/asaf/recorder.go` event taxonomy:

```
mcp_config_tamper          — ~/.claude.json mcpServers URL changed unexpectedly
mcp_localhost_proxy         — mcpServers URL resolves to 127.0.0.1 / ::1
oauth_refresh_unknown_origin — OAuth refresh from IP not in user's known origin set
postinstall_hook_detected   — npm postinstall hook found in a new package
claude_json_trust_flag_set  — alreadyTrusted flag added to a new path
```

### Key Reference

- **Mitiga Labs report**: Reported 2026-04-10, Anthropic acknowledged 2026-04-11, ruled out-of-scope 2026-04-12 — no patch planned
- **Affected config file**: `~/.claude.json` (user-level, flat permissions, plaintext tokens)
- **Defender first action**: `cat ~/.claude.json | grep -E "(mcpServers|localhost|sessionStart|alreadyTrusted)"`
- **Our `.mcp.json`**: `c:\Users\intel\blackbox\PQC-Khepra-MCP\.mcp.json` — verified clean as of 2026-06-07

### ✅ Audit Result — 2026-06-07 (intel@UrGentXy)

`~/.claude.json` confirmed **CLEAN**:
- No `mcpServers` configured in Claude Code (KHEPRA runs via project-local `.mcp.json` — safer posture)
- No `sessionStart`, `hookStart`, `preToolUse`, or `postToolUse` hook keys
- No localhost/127.0.0.1 in any entry
- One project (`G0DM0D-1`) with `hasTrustDialogAccepted: false` — correct

**High-value OAuth footprint discovered** (via `claudeAiMcpEverConnected` — server-side, not local attack vector):
Gmail, Google Drive, Google Calendar, HubSpot, Notion, monday.com, Cloudflare, Intuit TurboTax.
These are connected through `claude.ai` OAuth, not local MCP routing. They are outside the `~/.claude.json` injection path but represent the exact token surface the attack targets if a hook is ever injected in future.

**Anthropic partial mitigation observed**: `tengu_mcp_local_oauth_blocked_hosts` blocks local OAuth for `gmail.mcp.claude.com`, `gcal.mcp.claude.com`, `microsoft365.mcp.claude.com`. Does NOT cover HubSpot, Notion, Google Drive, or KHEPRA.
