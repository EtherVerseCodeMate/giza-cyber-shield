# CLAUDE.md
## 🚫 Absolute Prohibitions: Mock Code & Simulation Policy

> **MANDATORY DEVELOPMENT STANDARD**

- **Mock code**, **simulation code**, **fake data**, **stubs**, and any "**TO DO**" placeholders are categorically **prohibited** in this project—whether for prototyping or testing.
- **All code must achieve or target Enterprise-Grade quality,**
  - Align to standards found at Google, OpenAI, Meta, Microsoft, Amazon, and X (Twitter).
  - Code contributions must clear **Technology Readiness Level 10 (TRL10)**—full operational deployment, reliability, and maintainability.
- **Security must be in-design:**
  - Mitigate the complete OWASP Top 100 spectrum.
  - Adhere to Secure Software Development Lifecycle (SSDLC) best practices from design through deployment.
  - Employ static, dynamic, and semantic analysis on all code.
  - Mandatory code reviews for security, privacy, and ethical risk—no exceptions.
- **Agent contributions will be rejected** if any placeholder, stub, or simulation is detected—regardless of value add, testability, or time pressure.
- Tests, mocks, or scaffolds must use **production-accurate handlers, data, and flows**—never substitutes.
- The same enterprise/security standards apply to configuration, documentation, and workflow scripts.

---
**Remember:** In the era of AI Agent Revolution, all code is potentially production code. **Build everything for resilience, security, and enterprise scale.**

## Claude Code Project Setup

Welcome to your Claude Code starter template! This guide helps you set up a secure, extensible Claude project, drawing from trusted resources and best practices.

---

### 🚦 Getting Started

1. **Clone the starter template**
   Use [`centminmod/my-claude-code-setup`](https://github.com/centminmod/my-claude-code-setup) for a project structure that emphasizes security and clarity.

   ```sh
   git clone https://github.com/centminmod/my-claude-code-setup.git my-claude-project
   cd my-claude-project
   ```

2. **Review and update environment variables**
   Edit `.env.example` → `.env` and set secrets for Claude API keys and any third-party integrations.
   **Never commit secrets!** See project `.gitignore` for recommended exclusions.

---

### 🛡️ Security Best Practices

- **Prompt Injection Defense**
  Integrate [`parry`](https://github.com/kurokobo/parry) to scan prompts for injection risks.
  ```sh
  # Example: Scan prompt (replace 'your-prompt.txt')
  parry scan --file your-prompt.txt
  ```
- **Safe Automation with Dippy**
  Use [`Dippy`](https://github.com/chinchang/dippy) to guard command execution in Claude agent flows.
  - Only auto-approve whitelisted commands.
  - Log all executions and review.

- **API Key Management**
  Store all keys outside tracked code. Use OS keyring managers where supported.

- **Dependency Pinning**
  Always pin your dependencies (see `requirements.txt`/`package-lock.json`).
  Regularly check for updates and advisories.

---

### 🛠️ Recommended Skills & Tools

Curated via [`hesreallyhim/awesome-claude-code`](https://github.com/hesreallyhim/awesome-claude-code):

- **Security & Safety**
  - [parry](https://github.com/kurokobo/parry): Prompt injection scanner.
  - [Dippy](https://github.com/chinchang/dippy): Safe command auto-approval for bots.
- **Code Quality**
  - Linters/formatters for Python, JS, Markdown.
  - [Claude-Guard](https://github.com/acme/claude-guard) *(hypothetical: inject mitigation if available)*
- **Workflow Enhancers**
  - Hooks for commit message enforcement.
  - Project audit scripts.
  - Trusted Claude plugin registry: see [awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code#trusted-skills--plugins)

---

### 📚 Secure Workflows & Best Practices

Summarizing ["Everything You Need to Know"](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know):

1. **Principle of Least Privilege**
   Only provide Claude the minimal permissions needed per project.
2. **Prompt Clarity**
   Use clear, unambiguous prompts. Regularly review for security holes or ambiguous language.
3. **Human-In-The-Loop (HITL)**
   Always have a human approve major changes or command executions, unless Dippy whitelist applies.
4. **Testing**
   Write tests for agent-assisted code flows. Use CI to run on each push/PR.
5. **Audit & Logging**
   Enable detailed logging. Review logs for anomalous agent behavior.

---

### 📝 Example `.env` (never commit actual secrets!)

```
CLAUDE_API_KEY=your_api_key_here
SAFE_COMMAND_WHITELIST="ls,pwd,cat"
LOG_LEVEL=info
```

---

### 🙏 Credits / References

- [centminmod/my-claude-code-setup](https://github.com/centminmod/my-claude-code-setup)
- [hesreallyhim/awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code)
- [wesammustafa/Claude-Code-Everything-You-Need-to-Know](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know)

Stay secure, document everything, and keep collaborating!
Happy Coding with Claude!

---

## Repository Topology — Authoritative Map (PERMANENT MEMORY)

> Last reconciled: 2026-05-24. Verified against actual files in repo.
> This supersedes any earlier topology notes in this file.

This repo contains **six deployable units** plus one legacy unit awaiting a disposition decision.
There is **no Turborepo**. The package manager is `bun@1.3.9`.
Package.json scripts: `dev`, `build`, `start`, `lint` — nothing else.

---

### Unit 1 — Dashboard SaaS (`src/`)

- **Stack:** Next.js (standalone output), TypeScript, React 18, Tailwind, Radix UI
- **Deploy PRIMARY:** Vercel — `vercel.json`
- **Deploy FALLBACK:** Fly.io — `fly.dashboard.toml` → `souhimbou-dashboard.fly.dev`
  - `fly.dashboard.toml` is **active, not retired**. It is a valid containerized deploy path for non-Vercel environments (air-gap staging, GovCon-adjacent customers who need a self-hosted dashboard).
- **Target URL:** `adinkhepra.com` (Vercel primary)
- **This is the SMB/commercial Dashboard SaaS product.** Small and mid-size customers, MSP admin portals, and SMB compliance operators land here.
- **Production rewrites** (next.config.mjs): `/api/agent/:path*` → `souhimbou-ai.fly.dev` (Unit 2)
  - `/api/v1/*` proxy only exists in **dev mode** (points to `localhost:45444`)

### Unit 2 — AI Agent Backend (`Dockerfile`, `services/ml_anomaly/`)

- **Stack:** Python 3.11 (FastAPI/ML) + compiled Go binaries in one container
- **Deploy:** Fly.io — `fly.toml` → `souhimbou-ai.fly.dev`
- **VM:** `shared-cpu-2x`, 4 GB RAM, 2 CPUs; Prometheus metrics on `:9091`
- **Go binaries bundled at build time:** `nouchix-sonar`, `nouchix-gateway`, `nouchix-pentest`, `nouchix-motherboard`, `nouchix-phantom`, `nouchix-adinkhepra`, `nouchix-agent`, `nouchix-stig`, `nouchix-client`
- **Exposed:** Python API on port 8080; Dashboard (Unit 1) proxies to it via `/api/agent/*`
- **Note:** The Phantom Node binary (`cmd/phantom-node/`) is compiled and bundled here — it is not a standalone deploy unit.

### Unit 3 — Khepra Go Core (`pkg/` + `cmd/`)

- **Stack:** Go 1.24, CGO_ENABLED=0, static binaries
- **Deploy:** Bundled into Unit 2 container at build time + distributed as standalone CLI binary on VPS
- **Build:** `CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" ./cmd/adinkhepra`
- **Go module:** `github.com/EtherVerseCodeMate/giza-cyber-shield`
- **Key packages:** `pkg/mcp`, `pkg/compliance`, `pkg/stig`, `pkg/crypto`, `pkg/ert`, `pkg/telemetry`, `cmd/khepra-mcp`, `cmd/adinkhepra`

### Unit 4A — MCP Server: Commercial Tier (`workers/mcp-server/`)

> **THIS IS THE GOLDMINE REVENUE UNIT — commercial, SMB, MSP, AWS Marketplace.**

- **Stack:** JavaScript (Cloudflare Workers), Durable Objects for session state
- **Deploy:** Cloudflare Workers — `wrangler.mcp.toml` → `khepra-mcp-server`
- **Target domain:** `mcp.souhimbou.org` or `mcp.khepra.io` (DNS pending)
- **Backends to:** Unit 2 (`souhimbou-ai.fly.dev`) via `KHEPRA_API_URL`
- **Session state:** Cloudflare Durable Objects (MCPSession class), WebSocket hibernation ~$0/month idle
- **Cost:** Free tier = 100K req/day; paid = $5/month base + $0.15/million
- **Security:** Built-in DDoS, OWASP WAF, TLS 1.3, Bot Fight Mode (all free or near-free)
- **Target customers:** Non-DoD — SMBs, MSPs, AWS Marketplace subscribers, open-core GitHub users
- **⚠️ FedRAMP note:** Cloudflare Workers is **NOT FedRAMP authorized**. This unit is correct for commercial customers. It must NOT be used to serve DoD/GovCon/classified workloads — see Unit 4B.

### Unit 4B — MCP Server: DoD / Air-Gap Tier (`cmd/khepra-mcp/`)

> **THIS IS THE GOVCON REVENUE UNIT — DoD, GovCon, classified, air-gapped.**

- **Stack:** Go binary (compiled from `cmd/khepra-mcp/`), PQC enabled (`MCP_PQC_ENABLED=true`)
- **Deploy NOW:** Fly.io (US-East `iad`, FedRAMP candidate) or VPS (sovereign)
- **Deploy FUTURE:** Azure Government Container Apps (`Dockerfile.fips`) — IL2/IL4/IL5
  - Azure Government is preferable to AWS GovCloud for SDVOSB (easier contracting pathway)
- **Dev/local:** Runs directly via `.mcp.json` — `go run ./cmd/khepra-mcp/main.go`
- **Target customers:** DoD program offices, DIB prime contractors, Iron Bank catalog users, MSPs serving classified clients
- **⚠️ FedRAMP note:** This unit must live on FedRAMP-authorized infrastructure (Fly.io → Azure Gov). Cloudflare Workers cannot be used here.

**THE TWO-TIER MCP SPLIT IN ONE SENTENCE:**
> Cloudflare Workers (`workers/mcp-server/`) serves commercial customers fast and cheap. The Go binary (`cmd/khepra-mcp/`) serves DoD customers on sovereign, FedRAMP-bound infrastructure. They are the same product at two different compliance levels — not a contradiction.

### Unit 5 — Telemetry Server (`pkg/telemetry/`)

- **Stack:** Go beacon (`pkg/telemetry/beacon.go`, `enrollment.go`); PQC keys in `telemetry-keys/`
- **Deploy:** VPS (Hostinger, sovereign) — compiled binary, NOT Cloudflare Workers (same FedRAMP reason as above)
- **URL:** `telemetry.souhimbou.org` → A record → VPS
- **Function:** CLI beacon receiver, license enrollment, CRL (certificate revocation list) at `/crl`
- **Note:** The directory `adinkhepra-telemetry-server/` does NOT exist. The source lives in `pkg/telemetry/`. The VPS runs a compiled binary deployed out-of-band.

### Unit 6 — SouHimBou.AI (`souhimbou_ai/SouHimBou.AI/`) — DISPOSITION PENDING

- **Stack:** Vite + React (separate from root Next.js), has own `package.json`, `Dockerfile`, `vercel.json`, AWS CloudFormation
- **Status:** Exists in the repo, is **not deleted**, but has diverged from `src/` (the active Next.js Dashboard SaaS)
- **Decision required:** Either (a) retire fully and delete, or (b) repurpose as the future End-User App (HL7/SMART-inspired — see strategic roadmap below)
- **Until decision:** Do not deploy. Do not delete without explicit instruction.

---

## Traffic Topology

```
User browser / AI agent (Claude, Cursor, VS Code)
        │
        ├──[Commercial / SMB / MSP]──────────────────────────────────────────┐
        │                                                                     │
        │  adinkhepra.com (Vercel — primary)                                  │
        │  souhimbou-dashboard.fly.dev (Fly.io — fallback)                    │
        │      │                                                              │
        │      │  /api/agent/* rewrites (next.config.mjs, production)        │
        │      ▼                                                              │
        │  souhimbou-ai.fly.dev (Fly.io — Python ML + Go binaries)            │
        │                                                                     │
        │  mcp.souhimbou.org (Cloudflare Workers — Unit 4A)                   │
        │      └── tools → souhimbou-ai.fly.dev (KHEPRA_API_URL)              │
        │                                                                     │
        └──[DoD / GovCon / Air-Gap]──────────────────────────────────────────┘
                │
                │  cmd/khepra-mcp (Go binary — Unit 4B)
                │      └── runs on Fly.io iad / VPS / Azure Gov
                │
                │  adinkhepra CLI binary
                │      └── beacons → telemetry.souhimbou.org (VPS sovereign, Unit 5)
                │                  → /crl (license revocation list)
                │
                │  DoD/air-gap: adinkhepra binary → localhost only, zero external calls
```

---

## Environment Variables — Where Each Variable Lives

| Variable | Vercel | Fly.io (Unit 2) | Cloudflare Workers (Unit 4A) | VPS |
|---|---|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | ✅ | — | ✅ |
| `NEXT_PUBLIC_API_URL` | ✅ | ✅ (env in fly.dashboard.toml) | — | — |
| `SUPABASE_URL` | ✅ | ✅ | ✅ (wrangler var) | — |
| `KHEPRA_SERVICE_SECRET` | — | ✅ sealed | ✅ wrangler secret | — |
| `DILITHIUM_MASTER_KEY` | ❌ never | ✅ sealed | ❌ never | ✅ `~/.asaf/keys/` |
| `MCP_PQC_ENABLED` | — | ✅ | — (JS worker, no Go) | ✅ |

---

## Build & Deploy Commands (No Turborepo)

Package manager: `bun@1.3.9`. Standard scripts in `package.json`:

```bash
# Dashboard (Unit 1)
bun run dev                          # local dev (Next.js)
bun run build                        # production build
vercel deploy --prod                 # deploy to Vercel
fly deploy --config fly.dashboard.toml   # deploy to Fly.io fallback

# AI Agent Backend (Unit 2)
fly deploy --config fly.toml         # deploy to souhimbou-ai.fly.dev

# MCP Server: Commercial (Unit 4A)
wrangler deploy --config wrangler.mcp.toml             # deploy to Cloudflare
wrangler dev --config wrangler.mcp.toml                # local dev
wrangler secret put KHEPRA_SERVICE_SECRET --config wrangler.mcp.toml

# MCP Server: DoD (Unit 4B)
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
  -ldflags="-s -w" -o bin/khepra-mcp ./cmd/khepra-mcp
go run ./cmd/khepra-mcp/main.go      # local via .mcp.json

# Go Core / CLI (Unit 3)
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
  -ldflags="-s -w" -o bin/adinkhepra ./cmd/adinkhepra
go mod tidy && go mod download       # Iron Bank build (no vendor/)
```

---

## Future: End-User App (HL7 / SMART-inspired)

> **Not in codebase yet. Down the line.**

Planned as a separate consumer/clinical-adjacent application inspired by HL7 FHIR and SMART on FHIR patterns — standards-based, interoperable, identity-forward. Likely a separate repo. Candidate for repurposing `souhimbou_ai/SouHimBou.AI/` (Unit 6) as the scaffold if its Vite/React stack is retained.

Do not build features for this app inside the current codebase. When the time comes, it gets its own repo and its own deploy target.

---

## Three-Repo Architecture (Dev → Prod Promotion) — PERMANENT MEMORY

Dev and production are intentionally separated to minimize attack surface, prevent sensitive file exposure, and gate changes through audit/testing/red-team before they reach customers.

| Role | GitHub Remote | Local Path | Purpose |
|---|---|---|---|
| **Main Dev** | `EtherVerseCodeMate/giza-cyber-shield` | `C:\Users\intel\blackbox\khepra protocol` | All development, audits, testing, red-teaming, sandboxing |
| **Prod: ASAF** | `nouchix/Adinkhepra-ASAF` | `C:\Users\intel\blackbox\Adinkhepra-ASAF` | Production ASAF binary — clean, no dev artifacts |
| **Prod: MCP** | `nouchix/PQC-Khepra-MCP` | `C:\Users\intel\blackbox\PQC-Khepra-MCP` | Production MCP server — clean, no dev artifacts |
| **Iron Bank** | `nouchix/adinkhepra-asaf-ironbank` | *(no local copy — deleted to save space)* | Iron Bank submission only — thin copy, no sensitive files |

### Dev → Prod Promotion Flow

```
Dev work, experiments, red-team
    │
    ▼
giza-cyber-shield (main dev)
    │  audit / test / sandbox gate
    ├──► nouchix/Adinkhepra-ASAF     (ASAF binary — prod)
    └──► nouchix/PQC-Khepra-MCP     (MCP server — prod, both 4A and 4B)
                                     │
                            thin cherry-pick
                                     ▼
                    nouchix/adinkhepra-asaf-ironbank  (IB submission)
```

### What Lives Where (Sensitive Files)

| Asset | Correct Home | Never In |
|---|---|---|
| PQC private keys | VPS `~/.asaf/keys/` + sealed local | Any GitHub repo |
| `vendor/` directory | `.gitignore` on Iron Bank repo | Iron Bank git index |
| `trufflehog-config.yaml` | `.gitignore` on Iron Bank repo | Iron Bank git index |
| `.env.local` / secrets | Local only, never committed | Any repo |
| Production binaries | VPS `/opt/adinkhepra/` | Source repos |
| Supabase anon key | OK in `fly.dashboard.toml` env block (public key by design) | `.env` files committed |

---

## 💰 $100M ARR Strategy — Business Context (PERMANENT MEMORY)

> Last updated: 2026-05-24. Source: Strategic planning session with Cyber.

### The Honest Math

Current DCF (accelerated case) puts Year 5 revenue at $22M. $100M ARR requires closing a ~5x gap. This requires architectural change, not just tactical iteration.

| Milestone | Current Trajectory | $100M ARR Path |
|---|---|---|
| Year 1 | $85K–$200K | $500K–$1M |
| Year 3 | $1.2M–$3.5M | $10M–$15M |
| Year 5 | $8.5M–$22M | $50M–$75M |
| Year 7 | ~$40M | $100M+ |

### The Three Paths to $100M ARR

**Path 1: GovCon Locomotive (Fastest to $10M)**
- SDVOSB sole-source authority is the single most underutilized asset
- One $5M sole-source IDIQ contract proves model, funds the team
- 20 enterprise GovCon clients at $5M = $100M. ~150 DIB prime contractors, not 10,000 SMBs
- Requires: Iron Bank approval live, CRITICAL findings = 0, in front of a program office, GovCon BD hire by Month 6

**Path 2: MCP Marketplace Multiplier (Highest Ceiling)**
- AWS Marketplace GovCloud: 500 defense contractor orgs × $75K–$150K annual = $37M–$75M ARR
- The commercial Cloudflare Workers MCP (Unit 4A) drives inbound volume and developer adoption
- The DoD Go binary MCP (Unit 4B) is what closes GovCon contracts
- Requires: AWS listing live before competitor copies positioning; open-core GitHub repo 500+ stars; 2-minute demo video
- These three things done in 90 days > 90 more features

**Path 3: MSP Licensing Multiplier (Best Unit Economics)**
- 1 MSP with 100 DIB clients × $15K–$25K/client/yr = $1.5M–$2.5M ARR per relationship
- 40 MSPs = $60M–$100M
- Air-gap architecture (Unit 4B) is what MSPs need for white-labeling
- Commercial tier (Unit 4A on Cloudflare) gives them the low-friction onboarding path
- Requires: multi-tenant flat license at $150K–$250K/yr

### Unicorn Valuation Path ($1B)

$100M ARR at 10x = $1B. But acquisition at $500M–$800M can happen at $30M–$50M ARR if a strategic buyer (Palo Alto, CrowdStrike, Leidos, Booz Allen) wants the moat:
- 36,195 mappings (STIG/CCI/NIST/CMMC)
- PQC attestation (ML-DSA-65, ML-KEM-768)
- SDVOSB status
- Iron Bank approval

**M&A trigger combination** (target: end of 2026):
Iron Bank approval + first DoD IDIQ contract + khepra-mcp on AWS Marketplace + 2–3 signed MSP deals → acquisition target at 8–12x forward revenue.

### The $100M ARR Math (Operational)

| Channel | Customers | ACV | ARR Contribution |
|---|---|---|---|
| MSP flat licenses | 40 MSPs | $150K | $6M |
| AWS Marketplace direct | 300 contractors | $95K | $28.5M |
| DoD IDIQ / GovCon vehicles | 50 programs | $500K | $25M |
| SMB KHEPRI subscriptions | 5,000 | $600/yr | $3M |
| Strategic/enterprise | 30 | $200K+ | $6M+ |
| **Total** | | | **$68M–$100M** |

### AWS Marketplace SKUs (Use These Exactly)

| SKU ID | Name | Annual Price | Target |
|---|---|---|---|
| KHEPRA-PRO-ANN | KHEPRA Professional | $35,000 | SMB DIB contractors |
| KHEPRA-ENT-ANN | KHEPRA Enterprise | $95,000 | Mid-market primes |
| KHEPRA-STRAT-ANN | KHEPRA Strategic | $195,000 | Large contractors + agencies |

### The One Thing That Kills This Plan

Continuing to build features without closing revenue. Every sprint that produces code without a paying customer attached burns the window. The CMMC enforcement wave and AI pricing crisis create a bounded window — 18–24 months before incumbents (Vanta, Drata, Tenable) build what KHEPRA has already built.

**The first $25K closed deal changes everything.**

---

## 🔧 Iron Bank — Current Status & Bypass Plan (PERMANENT MEMORY)

> Context: Pipeline blocked at setup stage. Fix in progress.

### The Exact Blocker

The Iron Bank pipeline has this logic:

```
IF trufflehog-config.yaml EXISTS in repo
  AND TRUFFLEHOG_CONFIG CI variable NOT SET
  → exit 1 (hard fail, pipeline never reaches build/scan stages)
```

TruffleHog flags Go vendor SHA commit hashes (from `golang.org/x/sys` and `google.golang.org/grpc`) as GitHub token false positives. Submitter created `trufflehog-config.yaml` to suppress — but the CI variable is not set at the project level (`dsop/nouchix/adinkhepra`, Project ID: 18821). Jeff Goluba (Customer Success & Onboarding, Iron Bank / OmniFederal) has been non-responsive.

### Iron Bank Key References

- Repo: https://repo1.dso.mil/dsop/nouchix/adinkhepra
- Issue tracker: https://repo1.dso.mil/dsop/nouchix/adinkhepra/-/issues/7
- Project ID: 18821
- Jeff Goluba: jeffrey.goluba.1.ctr@us.af.mil / jeffrey.goluba@omnifederal.com
- Weekly session (Wednesday 16:00 ET): https://www.zoomgov.com/meeting/register/vJIscuitrzgqGL_zbboa1qyuJYG3jmV2KBs
- Iron Bank team chat: #iron-bank on chat.il2.dso.mil

### Track 1: Human Track (In Progress)

- [x] Registered for Wednesday 16:00 ET weekly session
- [x] Sent detailed technical email to both Jeff email addresses
- [ ] Post verbatim on Issue #7 with technical details and tag @jeff.goluba
- [ ] Attend Wednesday session — share screen, issue #7 open, paste exact ask in chat

**Exact ask for Wednesday session chat:**

```
Project dsop/nouchix/adinkhepra (ID: 18821) — pipeline blocked at setup.
Need TRUFFLEHOG_CONFIG CI variable enabled. trufflehog-config.yaml is in
repo root excluding vendor/. False positives are Go stdlib SHA commit hashes,
not credentials. One admin action unblocks the full pipeline.
```

### Track 2: Technical Track (ACTIVE FOCUS)

**Root cause**: TruffleHog scans `vendor/` in git, flags commit SHA hashes as GitHub tokens. Config file exists but CI variable isn't set → hard fail.

**Solution**: Remove both `trufflehog-config.yaml` AND `vendor/` from git tracking. Use `go mod download` at Docker build time instead. (Commit `24b31588` in giza-cyber-shield already applied this fix; mirror to ironbank repo.)

```bash
# Step 1: Remove from git index (keep local copies)
git rm -r --cached vendor/
git rm --cached trufflehog-config.yaml

# Add to .gitignore
echo "vendor/" >> .gitignore
echo "trufflehog-config.yaml" >> .gitignore
```

**Dockerfile.ironbank builder stage update:**

```dockerfile
COPY go.mod go.sum ./
RUN GONOSUMCHECK="*" GOFLAGS="-mod=mod" go mod download && go mod verify
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-s -w -extldflags '-static'" \
    -o bin/adinkhepra \
    ./cmd/adinkhepra
```

---

## 🚨 Iron Bank De-Risking — Strategic Note (PERMANENT MEMORY)

Iron Bank is subject to **Platform One administrative theater** — external admin control that has already caused months of delay. This is a known single point of failure for the GovCon path.

**Iron Bank is one of four distribution channels, not the only one.**

| Channel | Iron Bank Required? | Status |
|---|---|---|
| Direct pilot agreements (QCL warm prospects) | ❌ No | ACTIVE — close now |
| AWS Marketplace GovCloud | ❌ No | ACTIVE — list now |
| MCP registry (modelcontextprotocol.io, mcpservers.org, cline.bot) | ❌ No | ACTIVE — submit now |
| MSP flat licensing | ❌ No | ACTIVE — first call |
| Platform One / DoD DevSecOps (P1 hardened catalog) | ✅ Yes | In progress — parallel track |

---

## 📅 Operational Sprint Plan (PERMANENT MEMORY)

### Sprint 0 — This Week (Revenue Ignition)

**Track A: Close 2 Warm QCL Prospects**
- Draft one-page Pilot Agreement: Scope (ert full scan + Godfather Report + 90-day access), Price ($15K–$25K SMB / $50K mid-market), Duration (90 days), Deliverable (signed attestation report + DAG audit trail)
- Send with Stripe Payment Link — subject: "Pilot Agreement + Next Steps — [Company Name]"
- Follow up by phone within 24 hours

**Track B: MCP Registry Submissions (2 hours)**

```
registry.modelcontextprotocol.io   ← primary
mcpservers.org                     ← secondary
cline.bot                          ← secondary
```

**Listing copy for all three:**
> KHEPRA MCP Server — Sovereign compliance engine with 36,195 STIG/CCI/NIST/CMMC mappings. Air-gappable. Zero token costs. Flat annual licensing. Run `ert_scan` → get a Godfather Report with dollar-denominated business impact. The only MCP compliance server that runs on your metal.

**MCP Registry submission steps:**

```bash
# Build and push public container (uses cmd/khepra-mcp — Unit 4B Go binary)
docker build -f Dockerfile.mcp -t ghcr.io/nouchix/pqc-khepra-mcp:1.0.0 .
docker push ghcr.io/nouchix/pqc-khepra-mcp:1.0.0
docker push ghcr.io/nouchix/pqc-khepra-mcp:latest

# Deploy commercial Workers tier (Unit 4A)
wrangler deploy --config wrangler.mcp.toml

# Publish to MCP registry
npx @modelcontextprotocol/mcp-publisher login
npx @modelcontextprotocol/mcp-publisher publish
```

**cline.bot submission** → https://github.com/cline/mcp-marketplace/issues/new ([Server Submission] template)

### Sprint 1 — Days 1–30 (Distribution Infrastructure)

| Action | Done When |
|---|---|
| Open-core GitHub repo live with real README | 500+ char README, ert full demo in GIF/video |
| 2-min demo video: scan → DAG → Godfather Report | Posted to GitHub + LinkedIn |
| AWS Marketplace listing drafted (3 SKUs) | Draft submitted for review |
| Blog post: "Why KHEPRA is immune to AI pricing crisis" | Published, linked from GitHub |
| Iron Bank pipeline passing all stages | Green checkmarks across VAT dashboard |
| First pilot agreement signed | Stripe payment received |

### Sprint 2 — Days 31–60 (First Revenue Closes)

**Target: $50K–$100K ARR signed**

| Action | Done When |
|---|---|
| AWS Marketplace listing submitted (GovCloud badge) | Listing ID assigned |
| Manifest signing (ML-DSA-65) integrated end-to-end | `adinkhepra sign` works on any artifact |
| 5 QCL demos scheduled | Calendar invites sent |
| 1 MSP conversation initiated | First call completed |
| Iron Bank VAT findings at zero or all justified | VAT dashboard green |
| Second pilot agreement signed | Stripe payment received |

**MSP outreach message (LinkedIn):**
> "You're paying usage-based AI costs on behalf of your DIB clients. KHEPRA MCP Server eliminates that — one flat annual license covers your entire client base. 36,195 STIG/CMMC mappings, air-gappable, runs on your infrastructure. Would a 20-minute call make sense?"

### Sprint 3 — Days 61–90 (Scale Signals)

**Target: $85K–$200K ARR, pipeline of 20 opportunities**

| Action | Done When |
|---|---|
| AWS Marketplace listing live | First inbound inquiry |
| 1 MSP deal closed ($75K–$150K flat license) | Contract signed |
| 20 opportunities in CRM | QCL pipeline documented |
| SBIR Phase I application drafted | Ready to submit on reauthorization |
| Iron Bank approved | Image live on ironbank.dso.mil |

### 12 Months (Machine Building)

**Target: $500K–$1M ARR**
- AWS Marketplace live with first 3–5 paying subscribers
- SBIR Phase I submitted ($256K–$314K non-dilutive, funds first engineer)
- One MSP deal closed at $75K–$150K flat (covers their full client base)
- One GovCon vehicle secured (micro-purchase at $25K starts contracting history)
- Hire: 1 Go engineer, 1 GovCon BD person

### 36 Months (Category Ownership)

**Target: $10M–$15M ARR**
- 5–10 MSP relationships driving $5M–$8M ARR
- AWS Marketplace generating $3M–$5M ARR inbound
- One IDIQ or SBIR Phase II–III contract driving $2M–$5M
- Series Seed raised ($1M–$2M) or SBIR Phase II funded → team of 8–10
- This is the M&A trigger zone — or launchpad for $100M organic

### Priority Stack (Solo Founder Hours)

Available ~4–6 focused hours/day. Priority:
1. Close the 2 warm prospects (revenue)
2. MCP registry submissions (distribution)
3. AWS Marketplace listing draft (scale infrastructure)
4. Iron Bank completion (credibility signal)

Everything else (new features, architecture docs, blog posts) is third tier until the first check clears.

---

## Azure Government Note

When the GovCloud path is ready: `Dockerfile.fips` → Azure Container Apps.
Azure Government (IL2/IL4/IL5) is preferable to AWS GovCloud for SDVOSB given
easier contracting pathways. AWS GovCloud requires FedRAMP Moderate authorization
as a vendor before you can operate there. This applies specifically to **Unit 4B**
(DoD MCP Server) — not Unit 4A which stays on Cloudflare Workers regardless.

---

## Security Hardening Roadmap (NSA / ASD-CISA Alignment)

### Must-Build (NSA MCP Security Design Considerations)

**MCP Message Integrity**
Hash each JSON response body with SHA3-256, sign with the server's ML-DSA-65 key, append as `_khepra_sig`. Applies to Unit 4B (Go binary). Unit 4A (Workers JS) gets HMAC-SHA256 minimum.

**Parameter Validation and Injection Resistance**
`ert_scan`, `stig_check`, `cmmc_assess` must enforce strict allow-list validation on all input parameters before they reach the Go engine. No shell interpolation of user-supplied strings. Scope parameters validated against known taxonomy (RHEL-9, NIST-800-53, etc.).

**Sandboxed Tool Execution**
Each tool invocation forks into a capability-scoped subprocess with only the read permissions needed for that scan. `ert_scan` on RHEL-9 accesses only `/etc`, `/var/log`, and STIG database — not the full filesystem.

**Per-Invocation Ephemeral Credentials**
HMAC-signed tokens with 5-minute TTL encoding: scan profile permitted, target, calling agent identity. ML-DSA-65 license key is the root of trust; invocation tokens are derived from it.

**Structured Cryptographic Audit Logs**
NDJSON output with per-entry ML-DSA-65 signatures. The log file becomes a tamper-evident chain. Satisfies DFARS 252.204-7012 incident reporting requirements in air-gapped DoD environments.

**Rate Limiting and DoS Defense**
Per-session rate limiting: max N concurrent tool calls, backpressure via MCP standard error codes (`rate_limit_exceeded`), circuit breaking on khepra-daemon if scan queue depth exceeds threshold.

**Human-in-Loop Gates**
`godfather_report` supports `--approval-required` mode: report staged, not delivered, until `godfather_approve` tool call received. Maps to ASD/CISA Human-in-the-Loop mandate for high-impact autonomous actions.

### Build Next (Performance)

**Trigger-Based Continuous Monitoring**
`khepra_watch` tool: registers a trigger condition (e.g., re-scan RHEL-9 STIG V1R3 when `/etc/sshd_config` changes), fires scan autonomously via khepra-daemon, streams results via MCP SSE transport.

**Streaming Godfather Report**
Stream findings incrementally as the engine processes each control family (AC, AU, CM, IA, SC, SI for NIST; CAT I/II/III for STIG). Partial findings surface while scan continues.

**Policy-Enforced Read-Only Default**
`ert_scan`, `stig_check`, `nist_map`, `cmmc_assess`, `godfather_report` declared read-only in MCP tool manifest. Only a future `remediate` tool carries write permission, requiring explicit operator opt-in.

**Offline Vector Search for Control Mapping**
Quantized FAISS index of control descriptions for semantic search ("find all controls related to key management") without LLM API calls. Zero-token-cost semantic retrieval. Air-gap native.

### Publish Now (GTM, No Code Required)

**KHEPRA MCP Security Posture Document**
One page mapping each NSA MCP Security Design Considerations requirement to the specific KHEPRA implementation. This is the sales artifact for every DoD acquisition officer who has read the NSA guidance.

**Supply Chain Artifacts for Iron Bank**
(1) CycloneDX SBOM of all Go dependencies, (2) SLSA Level 3 build provenance from GitHub Actions, (3) cosign-signed OCI image. Three artifacts that position KHEPRA as the only MCP server meeting the emerging DoD agentic AI supply chain security standard.

**Antigravity SDK Reference Integration**
Publish an agent definition file wiring `ert_scan` → `godfather_report` → `ask_user` (human-in-loop approval of high-severity findings). Demonstrates KHEPRA within the exact agentic pattern ASD/CISA endorses.

**Pricing Reframe**
Lead with the NSA document in sales conversations: "NSA says your MCP server must have these controls. KHEPRA has them. Here is the documented proof." The Godfather Report's dollar-denominated output is the ROI calculation that justifies spend to a program manager.
