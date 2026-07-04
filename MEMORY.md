# MEMORY.md — KHEPRA / NouchiX Strategic Operating Memory

> **PERMANENT REFERENCE** — Last updated: 2026-07-02
> This file is the strategic compass. CLAUDE.md holds technical norms. Together they are the full context.

---

## 🛰️ Sovereignty Boundary Policy (TRL10 control)

> **INVIOLABLE.** This is the rule that makes "sovereign, network-native, zero vendor cloud"
> true rather than a slogan. It is the difference between passing and failing the CMMC/DFARS
> audit the product sells. Enforced by `scripts/sovereignty_boundary_guard.sh` +
> `.github/workflows/sovereignty-boundary.yml` — run it in BOTH giza-cyber-shield and
> PQC-Khepra-MCP. Reviewed exceptions live in `scripts/sovereignty_allowlist.txt`.

### The one rule

**A customer's CUI data plane never lands on a NouchiX-operated host.** The customer Hub
(`:8443`), Fleet API, customer DAG/audit trail, scan findings, and the credential vault run
on the CUSTOMER's infrastructure (their metal or their managed GovCloud) — per tenant, always.
`asaf.company.com:8443` in the architecture docs is a **placeholder for the customer's own
Hub**, NOT a URL we host. It must never be `mcp.souhimbou.ai`, `gateway.souhimbou.ai`, or any
vendor subdomain. (Answered definitively 2026-07-02; see `TRL10_SOVEREIGNTY_BOUNDARY_2026-07-02.md`.)

### Control plane vs data plane

| Plane | May run on a vendor host? | Examples |
|---|---|---|
| **Control plane** | ✅ yes (allowlisted) | license validation/heartbeat (`telemetry.souhimbou.ai`), installer + checksums + docs (`get.nouchix.com`), Stripe webhook, release mirror |
| **Demo / discovery** | ✅ yes, SYNTHETIC only (allowlisted, must be marked "no CUI") | public MCP tool endpoint (`mcp.souhimbou.ai`), public eval scan (`gateway.souhimbou.ai`) |
| **Customer data plane** | ❌ **NEVER** | Hub `:8443`, Fleet API, customer DAG, scan findings, credential vault |

### Why (the three reasons, in severity order)

1. **DFARS/CMMC self-own** — CUI on a commercial VPS (not FedRAMP/GovCloud) is itself a
   252.204-7012 violation. The tool would fail the audit it sells. Multi-tenanting several
   DIB contractors' failure data on one box compounds it.
2. **Kills the sovereignty value prop** that justifies $25K–250K/yr — a shared vendor Hub is
   the Vanta/Drata SaaS model PART 0 of the Stargate architecture explicitly says NO to.
3. **Conflates product boundaries** — the unified binary has TWO ports (`:8443` Hub / customer
   data, `:8444` MCP / agent channel). Even MCP, when acting on a customer's assets, runs on
   the customer's infra. Do not merge the SOC-SaaS (SouHimBou AI), the agent channel (PQC-MCP),
   and the sovereign Hub under one vendor URL.

### Verified state (2026-07-02)

- ✅ **Client boundary intact**: `cmd/asaf-desktop` and `cmd/khepra-reporter` do NOT default
  their Hub/upstream to any vendor host (only `telemetry.souhimbou.ai` for licensing — control
  plane). Guard Check 1 passes.
- ⚠️ **Demo scan surfaces need hardening**: `gateway.souhimbou.ai` exposes
  `POST /api/v1/scan/agent` with `ASAF_ALLOW_EVAL_WITHOUT_LICENSE=true`, accepts an arbitrary
  `Target` + `APIKey`, and shares a Supabase service-role key + a persistent DAG volume with
  the demo MCP. Acceptable ONLY as SYNTHETIC demo with: input guard (no real CUI targets/creds),
  a visible "DEMO — do not submit CUI" banner, and demo-DAG isolation. Tracked as TRL10 blockers.

### When you touch anything that binds a URL

Ask: is this the control plane, a demo surface, or the customer data plane? If data plane and
the host is ours → STOP, it's a boundary violation. Run the guard before you push.

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
| MCP registry — modelcontextprotocol.io ✅ LIVE / mcpservers.org ✅ submitted / cline.bot ✅ LIVE / smithery.ai ✅ LIVE / crossaitools.com 🔲 pending | ❌ No | **✅ Largely Done** |
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

**Priority 2: MCP Registry Submissions**
- ✅ registry.modelcontextprotocol.io — **PRIMARY / LIVE** (2026-06-28)
- ✅ mcpservers.org — **Just Submitted** (2026-06-28)
- ✅ cline.bot — **LIVE** (2026-06-28)
- ✅ smithery.ai — **LIVE** (2026-06-28)
- 🔲 crossaitools.com/marketplaces — Tertiary / To Do

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

---

## 🔧 Product C Connective-Tissue Build Spec

> **Status snapshot**: 2026-06-29. **Target**: Presight meeting 2026-07-15.
> **Full spec lives at**: `c:\Users\intel\blackbox\PQC-Khepra-MCP\docs\CONNECTIVE_TISSUE_BUILD_SPEC.md`

### Architecture frame

- **Product A** — AdinKhepra ASAF / Compliance Graph UI. CMMC/STIG installer bundle.
- **Product B** — SouHimBou AI Flight Recorder (`souhimbou.ai`). Working beta dashboard with live WebSocket DAG viewer (`KhepraDAGVisualization.tsx`). Consumer of Product C.
- **Product C** — PQC-Khepra-MCP. Must stay the most modular of the three — the connective tissue any downstream UI (A's or B's) can consume.

### Verified live in Product C (as of 2026-06-29)

- DEMARC gateway (`pkg/api/demarc_api.go`) — stdio pre-auth identity
- Polymorphic envelope wrapping (`pkg/mcp/chain.go` `AdinkraPolymorphicEngine`)
- DAG attestation (`pkg/mcp/chain.go` `DAGAttestor`) — ML-DSA-65 signed on every tool call
- Loopback SSE live viewer (`pkg/mcp/live_viewer.go`) — `KHEPRA_VIEWER_PORT` env var
- KASA orchestrator: `kasa_start`, `kasa_status`
- EA Kernel: `ea_evolve`, `ea_threat_score`, `ea_risk_summary`
- Ising optimizer: `quantum_optimize`
- Ouroboros eyes: `ouroboros_waf_eye`, `ouroboros_stig_eye`, `ouroboros_vuln_eye`, `ouroboros_fim_eye`

### Dead code (built, NOT registered as MCP tools — fix in Phase 1)

`tools.HandleKASATask`, `tools.HandleKASAScan`, `tools.HandleKASAForensics`, `tools.HandleKASACryptoAgent` — all in `pkg/mcp/tools/kasa_tools.go`.

### Critical structural risk — package fork drift

`pkg/ea`, `pkg/sekhem`, `pkg/ouroboros`, `pkg/agi`, `pkg/ising`, `pkg/api` exist in BOTH `khepra protocol` AND `PQC-Khepra-MCP`. **Every single file differs** (confirmed via `diff -rq`). Both build clean independently. No shared module — two forks of a common ancestor that have already diverged.

**Decision (2026-06-29)**: `PQC-Khepra-MCP` is the canonical source for shared security-kernel packages. Product A (`khepra protocol`) should consume Product C as a dependency rather than maintain an independently-edited fork.

### Secondary structural issue

KASA's autonomous loop writes to its OWN separate in-memory DAG store (`kasaStore` via `dag.NewMemory()` in `kasa_tools.go`'s `getKASA()`), which is NOT the same store the router/live-viewer's `EventEmitter` observes. KASA background actions do not surface in the SSE live viewer. Phase 1 task: unify these stores.

### Build phases (July 15 target)

**Phase 1 — Low risk, do first**
1. Register 4 unregistered KASA handlers in `cmd/khepra-mcp/main.go` (`kasa_task`, `kasa_scan`, `kasa_forensics`, `kasa_crypto_agent`). Rebuild manifest hash.
2. Unify KASA's DAG store with the router's observable event stream so autonomous KASA actions surface in the SSE feed.
3. Smoke-test `kasa_start` → `kasa_task` → `kasa_status` → `kasa_crypto_agent` via real stdio JSON-RPC with `KHEPRA_VIEWER_PORT` set.

**Phase 2 — Reconcile drift (before adding anything new)**
1. Diff each of `pkg/ea`, `pkg/sekhem`, `pkg/ouroboros`, `pkg/agi`, `pkg/ising` file-by-file between both repos.
2. Port any features Product C lacks into Product C (canonical).
3. Document the canonical decision in both repos' AGENTS.md.

**Phase 3 — Demo readiness**
1. Verify SSE live viewer renders KASA/EA/Ising events with readable labels.
2. Rehearse demo sequence: `kasa_start` → autonomous perimeter sweep visible in SSE feed → `ea_evolve`/`quantum_optimize` → `agent_record` for PQC attestation.
3. Full stdio+SSE smoke test end-to-end before calling demo-ready.

### Out of scope for July 15

- Building a real ML model for `KASACryptoAgent` (currently rule-based thresholds — do not claim otherwise)
- Porting `mitochondrial-proxy` Supabase Edge Function into Product C
- Wiring SEKHEM WAF into live request filtering (no live HTTP ingress in stdio-first MCP)
- Merging Product A's Compliance Graph UI with Product C's live feed (Product B's dashboard is the Presight demo consumer)

---

## 🔱 The 4-Layer SouHimBou Audit Framework (RUN FREQUENTLY)

> **STANDING ORDER** — This is our recurring blindspot audit. Run it per-product-boundary
> (never one blurred sweep across all three). The whole point is to catch the gap between
> what we *claim* and what the code *does* before a C3PAO, an Iron Bank reviewer, or a
> pilot customer catches it for us. A finding is only real with a `file:line` citation.

### The three audit boundaries (always audit separately)

| Boundary | What it is | Where the code lives |
|---|---|---|
| **Product A — AdinKhepra ASAF Desktop** | CISO-facing CMMC autopilot GUI + privileged daemon | `giza-cyber-shield`: `cmd/asaf-desktop`, `app/`, `pkg/stig`, `pkg/asaf/daemon` |
| **Product B — PQC-Khepra-MCP** | Sovereign MCP server / scanner (agent channel) | `PQC-Khepra-MCP`: `cmd/khepra-mcp`, `pkg/mcp`, `pkg/gateway`, `pkg/stig` |
| **Product C — SouHimBou AI** | Agentic SOC + Flight Recorder SaaS | `giza-cyber-shield`: `souhimbou_ai/`, `pkg/flight`, `pkg/souhimbou`, Supabase functions |

### The four dimensions (every audit covers all four)

1. **Top-Down (Strategy → Code)** — Take each marketing/spec claim and hunt for the code that
   backs it. A claim with no implementation, or backed by a mock, is a Top-Down finding.
   *Question: "We say we do X. Where is X in the code?"*
2. **Bottom-Up (Code → Claims)** — Read the code and find behavior the docs don't admit:
   hardcoded keys, dev backdoors, stubs, silent mock fallbacks, `TODO`/`STUB`/"in production".
   *Question: "The code does Y. Do we admit Y anywhere?"*
3. **Horizontal (Cross-Cutting)** — One concern across all languages/modules: is the same
   pattern handled consistently? The classic trap is two sibling functions where one was
   fixed and its near-twin was not. *Question: "Is this pattern uniform everywhere it appears?"*
4. **Diagonal (Trust Boundary)** — Trace one feature/datum through every seam
   (detect → store → act → display → operator). Find the seam where a component *claims*
   success but the next hop never received the truth. *Question: "Where does 'done' become a lie?"*

### Severity ladder

- **CRITICAL** — Fabricated evidence in an audit trail, mocked security-critical action reporting
  success (alerts, remediation, containment/rollback), auth backdoor, forgeable license/signature.
  Disqualifying for TRL10 / C3PAO.
- **HIGH** — Silent mock fallback in a production data path, unencrypted sensitive data,
  claim-vs-reality gap in a customer-facing capability.
- **MEDIUM** — Coverage overstatement, inconsistent cross-cutting handling, weak-but-not-broken auth.
- **LOW** — Stale numbers/comments, cosmetic stubs behind an honest disclaimer, doc drift.

### Required executive-summary table (top of every report)

| Dimension | Findings | RESOLVED | CRITICAL | HIGH | MEDIUM | LOW |
|-----------|----------|----------|----------|------|--------|-----|
| **Top-Down** (Strategy → Code) | | | | | | |
| **Bottom-Up** (Code → Claims) | | | | | | |
| **Horizontal** (Cross-Cutting) | | | | | | |
| **Diagonal** (Trust Boundary) | | | | | | |

### The recurring anti-patterns to always grep for

- **Silent mock fallback**: `if (!apiKey) return generateMock…()` / `catch { return mockData() }` —
  must be replaced with fail-loud + telemetry. This is the #1 killer; it looks operational in a demo
  and never delivers in production.
- **Fabricated success**: a function that computes/returns `success: true` (or writes to the DAG)
  without the real side effect actually happening. Worst when in the alert, remediation, or
  containment/rollback path.
- **Orphaned build artifacts**: a fixed file in `pkg/` with a stale, still-vulnerable twin under a
  build/mirror directory. Grep the whole tree for the filename and diff.
- **Coverage overstatement**: "full X coverage" strings where the code implements a sample subset.
  Must carry a non-dismissible, *computed* disclaimer.

### Cadence

Run at the close of every sprint and before any pilot demo or Iron Bank resubmission. Reports live at
repo root as `AUDIT_<PRODUCT>_<YYYY-MM-DD>.md`. Compare each run against the prior report's open items —
a finding that regressed (came back after being marked RESOLVED) is automatically escalated one severity.

---

## 🛡️ STANDING RULE — Egress-Capable Components Require a Direction-Correct Perimeter Guard

> Origin: Diagonal-dimension CRITICAL finding, 2026-07-03/04 audit of the Polymorphic API Connector
> (fleet SSH/WinRM/nmap/CSV/cloud connectors) and the Blackhole VPN (Hub↔reporter dispatch channel).

**The mistake this rule prevents:** assuming "we have SEKHEM WAF, so we're covered" for any new
network-facing component, without checking which *direction* that component moves traffic.

**The finding:** `pkg/sekhem/waf.go` + `pkg/gateway/gateway.go` (`Handler(upstream http.Handler)
http.Handler`) is a real, substantial L7 guard — but it wraps **inbound** HTTP servers only. It
inspects requests *arriving at* the Hub/MCP. It provides **zero** protection to a component that
*originates* outbound connections — `net.Dial`, SSH, WinRM, raw TCP probes, cloud API pulls — because
there is no inbound `http.Handler` for it to wrap. Verified: neither the Polymorphic Connector's dial
paths (`pkg/asaf/fleet`, `pkg/asaf/hub`) nor the Blackhole VPN's enrollment/dispatch (`blackhole.go`)
had any CIDR confinement, egress allowlisting, pre-dial Guardian/pentest vetting, or DAG-attested
dial-attempt logging at time of finding. A `maat.Guardian.WeighAndDecide` policy layer exists but
evaluates already-aggregated `Isfet` events after the fact — nothing feeds it a proposed dial target
*before* the dial happens.

**Why this matters at CMMC-product stakes:** the connector holds decrypted credentials (AES-256-GCM
vault) and dials operator- or CSV-or-CIDR-supplied targets. An attacker who can influence an import
file, a discovery CIDR, or an enrollment request can direct authenticated, credentialed outbound
connections to a target of their choosing, with **no independent control point** that blocks it,
flags it, or even logs the attempt as its own auditable fact (only the resulting side-effect, if any,
gets logged today). This is an SSRF-shaped risk with privileged credentials attached — worse than a
silent-failure mock, because it can be a silent-*success* of a malicious action.

**THE RULE:** Every external-facing or egress-capable component — anything that either (a) accepts
inbound network traffic, or (b) *originates* outbound connections to operator-, config-, or
discovery-supplied targets (SSH/WinRM/API/cloud connectors, Blackhole VPN dispatch, any future
integration) — MUST be paired with the perimeter control matching its actual traffic direction before
it ships to an operator UI or a customer deployment:

- **Inbound traffic** → SEKHEM WAF / `pkg/gateway` Handler wrapping. (Already correct for the Hub/MCP
  HTTP surfaces — keep doing this.)
- **Outbound/egress traffic** → an **Egress Boundary Guard**, which does NOT yet exist as a component
  and must be built, not assumed:
  1. **Enclave-CIDR confinement, enforced not advisory** — every dial target must resolve inside a
     Phase-1-declared enclave boundary. Reject + log any out-of-scope target; never silently proceed
     (mirrors the spec's own Phase-1 rule that a scope discrepancy is flagged, never auto-overridden).
  2. **DAG-attested dial attempts**, independent of outcome — every outbound connection attempt is its
     own signed DAG node (who, what target, what credential, when), not just the eventual result.
  3. **Pre-dial Guardian/pentest vetting** — the proposed target is checked *before* the dial fires,
     not fed to a policy engine only after telemetry accumulates.
  4. **Anomaly → IR handoff** — rate-of-dial spikes, out-of-enclave attempts, repeated auth failures
     auto-open a `pkg/ir` incident; they do not just increment a log counter.

**Enforcement:** before any new egress-capable component (a connector, an agent dispatcher, a cloud
integration) is wired into a UI or shipped to a customer, the 4-Layer audit's Diagonal pass must
explicitly answer: *"What perimeter control matches this component's traffic direction, and where is
it in the code?"* "We have a WAF" is not an acceptable answer for anything that dials out.

