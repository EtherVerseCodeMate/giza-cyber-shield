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

### G0DM0D — AI Brain Layer

G0DM0D is the AI engine that makes KHEPRA *agentic*, not just a scanner. It is a wealth of value as a standalone repo.

| Attribute | Detail |
|---|---|
| GitHub | https://github.com/EtherVerseCodeMate/G0DM0D |
| Local path | `pkg/g0dm0d3/` inside `khepra protocol` (main dev) |
| Role | Pluggable LLM abstraction + KHEPRA tool panel + live DAG context injection |
| Provider chain | Anthropic Claude → OpenRouter → Offline rule-based (zero deps, always works) |
| Tool panel | `dagSummary`, `stigSummary`, `pqcInventory`, `forensicsSummary` — AI invokes via `[TOOL:xxx]` |
| Security invariant | All external LLM calls isolated to this package. Core engine (DAG/STIG/ASAF/PQC) operates independently. |
| Air-gap/SCIF | Full offline mode — no API key required, zero external calls, STIG/DAG/PQC queries answered by rule-based engine |

**Why it matters**: DAG-grounded context injection is what produces the Godfather Report's dollar-denominated risk framing. Offline mode is what makes KHEPRA deployable in SCIFs without any external dependency.

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
