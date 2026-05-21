# SouHimBou AI by NouchiX — Pre-Seed Pitch Deck v4
**Defense-Grade AI Compliance Autopilot for the US Defense Industrial Base**
**Updated:** May 20, 2026 | Codebase-Anchored Revision

---

## Slide 1 — Title

**SouHimBou AI** by NouchiX / SecRed Knowledge Inc.

*The only STIG-first compliance autopilot built for the US Defense Industrial Base —
air-gapped, post-quantum secured, flat-fee, zero token costs.*

**Credentials:**
- Veteran-Owned (SDVOSB-Eligible, not yet certified) — US Army Signal Corps (25S), SATCOM deployment
- USPTO Patent Pending #73565085 — filed Dec 6, 2025
- NSF I-Corps Validated — market hypothesis confirmed
- HPE Tier-2 Partner
- Active Secret Security Clearance
- Self-Certified CMMC Level 1
- M.S. Digital Forensics, UAlbany NSA CAE-CDE — May 2026

---

## Slide 2 — THE MANDATE: Three Forces Converging

### CMMC 2.0 Enforcement
- Phase 1: Nov 2025 — **Active now**
- Phase 2: Nov 2026 — **12 months away**
- 220,000 DIB contractors must comply. Only 80 C3PAOs exist.
- Automation is not optional — it is the only path to scale.

### Federal PQC Mandate (NSM-10)
- $7.1B earmarked for federal migration
- Asset inventories mandated by 2026
- NIST FIPS 203/204/205 finalized Aug 2024
- 98%+ of DIB networks still quantum-vulnerable
- "Harvest now, decrypt later" attacks are active today

### AI Pricing Crisis (May 2026)
- Anthropic split subscriptions: Jun 15, 2026
- GitHub Copilot moved to token billing: Jun 1, 2026
- Uber burned its full 2026 AI budget by April
- Enterprises paying $500–$2K/engineer/month
- Flat-fee sovereign tools are now a CFO mandate

**Window:** 18–24 months before market consolidates around incumbents.

---

## Slide 3 — THE PROBLEM: Four Breakages Costing Contractors Millions

| Problem | Cost | Root Cause |
|---------|------|-----------|
| Manual STIG Translation | $8K–$10K/audit; 40+ hrs × 5 frameworks | No automated cross-framework engine |
| 94% Audit Failure Risk | $75K–$150K C3PAO fees/cycle | No automated evidence package generation |
| OT/ICS Blind Spots | $75K–$150K re-assessment | Legacy Modbus/SCADA invisible to GRC tools |
| Quantum Blind Spot | $232M federal migration cost | Zero DIB-native PQC scanners on market |

**Total compliance burden** for a mid-size DIB contractor: **$80K–$200K/year** in
manual mapping, consultant fees, and failed audits.

---

## Slide 4 — THE SOLUTION: SouHimBou AI

**Core value:** The only STIG-first compliance autopilot built for the US Defense
Industrial Base — air-gapped, post-quantum secured, flat-fee, zero token costs.

### Five-Step Compliance Process

1. **Auto-Discover** — Assets, OT devices, SaaS inventory
2. **Match to STIG** — 36,195 proprietary cross-framework mappings
3. **Validate & Remediate** — AI-generated audit scripts + remediation playbooks
4. **Generate Evidence** — Immutable DAG with Dilithium-signed nodes
5. **Monitor Continuously** — 24/7 compliance state, DoD AU-2/AU-3 logging

### Why This Is Different
- Zero token costs — compiled Go binary, all logic runs on customer metal
- Air-gapped, zero-dependency deployment
- Flat annual license — no API surprise bills
- 36,195 proprietary cross-framework mappings embedded at build time

---

## Slide 5 — CAPABILITIES: Live Today vs. In Build

### Live Today (Codebase-Verified, May 2026)

**KHEPRA CLI Binary (`adinkhepra`)**
- **85,500+ lines of Go** across 371 files / 65 packages
- 15 compiled binaries: `adinkhepra`, `khepra-mcp`, `apiserver`, `khepra-daemon`,
  `sonar`, `gateway`, `phantom-node`, and 8 others
- Zero external runtime dependencies; air-gap ready
- 91 test files / 10,849 lines of test code
- *Source: `cmd/` + `pkg/` — verified `wc -l` May 20, 2026*

**36,195 Cross-Framework Mappings**
- `pkg/stig/data/STIG_CCI_Map.csv` — 28,639 rows (STIG → CCI)
- `pkg/stig/data/CCI_to_NIST53.csv` — 7,433 rows (CCI → NIST 800-53)
- `pkg/stig/data/NIST53_to_171.csv` — 123 rows (NIST 800-53 → 800-171)
- Embedded in binary at build time; loaded in-memory at startup
- *Row counts verified with `wc -l` — exact 36,195 total*

**PQC Engine (ML-KEM-1024 / ML-DSA-65)**
- ML-KEM-1024 (Kyber1024): `github.com/cloudflare/circl/kem/kyber/kyber1024`
- ML-DSA-65 (Dilithium3/mode3): `github.com/cloudflare/circl/sign/dilithium/mode3`
- NIST FIPS 203 (ML-KEM) + FIPS 204 (ML-DSA) compliant
- Swappable backend: free tier (CIRCL) → premium (Adinkra proprietary) → HSM
- FIPS 140-2/3 mode via `pkg/crypto/fips.go`
- *Source: `pkg/crypto/backend_community.go:8-9`, CIRCL v1.6.3*

**Immutable DAG Audit Trail**
- 1,679 lines across 8 files in `pkg/dag/`
- AES-256-GCM encrypted nodes + Dilithium-signed provenance
- DoD AU-2/AU-3 logging via `pkg/dag/dod_logger.go`
- 18 live DAG nodes pre-loaded in `data/dag/`
- Content-addressed: any modification breaks the hash chain
- *Source: `pkg/dag/` — architecture and encryption confirmed*

**ERT / Godfather Report**
- 1,517 lines in `pkg/ert/` (engine, analysis, godfather narrative, CVE database)
- Four report types: ReadinessIntel, ArchitectureIntel, CryptoIntel, ExecutiveSummary
- Executive risk-to-dollar translation in board-level language
- Integrated with CVE feeds, STIG control failures, and DAG audit nodes
- *Source: `pkg/ert/`, `cmd/adinkhepra/ert_*.go`*

**RHEL-09 STIG Validation**
- 8 live controls validated against real system state (no mocks, no hardcoded responses)
- SV-IDs: 257778, 257779, 258001, 258090, 257823, 257824, 257860, 257872
- Real OS calls: sysctl reads, file permission checks, SSH config parsing, SELinux status
- Full 36,195-row DB cross-reference on every check result
- Validator framework supports 291+ RHEL-09 controls with no architectural changes
- *Source: `pkg/stig/rhel09_stig_checks.go`, `pkg/stig/syschecks.go`*

**KHEPRA MCP Server (`khepra-mcp`)**
- stdio JSON-RPC 2.0 — works with Claude Code, Cursor, Kiro, Windsurf
- ML-DSA-65 (Dilithium-3) signature on every tool response
- 100% tool call audit logging to DAG
- Prompt injection scanning (6 detection patterns)
- RBAC via Supabase JWT verification
- *Source: `cmd/khepra-mcp/main.go` (280 LoC), `pkg/mcp/` (23K+ LoC)*

**SCORPION AES-256-GCM Ceremony (`pkg/scorpion`)**
- AES-256-GCM encryption with Argon2id KDF (salt + 64MB memory + 4 threads)
- Progressive cryptographic destruction on 3 failed decryption attempts
- Demonstrated live at SUNY Showcase on STM32U585 + QRB2210 (Arduino Uno Q)
- First known PQC key ceremony completed on an STM32-class device at NSA-affiliated
  institution
- *Source: `pkg/scorpion/scorpion.go` (165 LoC)*

**REST API Server (`apiserver`)**
- TLS (Let's Encrypt) + Gin + gRPC + WebSocket
- PQC auth middleware: ML-DSA-65 signature verification on every request
- Supabase PostgreSQL backend
- Natural language command execution via local Ollama (phi4, zero cloud calls)
- *Source: `cmd/apiserver/main.go`, `pkg/apiserver/` (18 files)*

---

### In Build (Active Development)

| Item | Current State | Target |
|------|--------------|--------|
| STIG Validator — full multi-framework | 8 live RHEL-09 controls | → 291 RHEL-09 + CIS + NIST 800-171 + CMMC |
| Iron Bank Container — DoD Registry | **BLOCKED** (see below) | Unblock → submission → approval |
| STIGViewer API Partnership | Co-branded CKL export in `pkg/stigs/ckl_generator.go` | Co-branded launch Q4 2026 |
| Autonomous remediation execution | Playbook generation live | → `--apply` flag with dry-run default |
| Web dashboard ↔ API wiring | React frontend exists, partially connected | Full integration Q3 2026 |

**Iron Bank Status — Honest Account:**
The hardening manifest (`ironbank-upload/hardening_manifest.yaml`) is complete.
The Dockerfile is hardened (UBI9 base, non-root, read-only FS). The pipeline is
blocked at the `setup` stage because TruffleHog flags read-only Go vendor commit
SHA strings (in `golang.org/x/sys` and `google.golang.org/grpc`) as false-positive
GitHub tokens. An Iron Bank admin must enable the `TRUFFLEHOG_CONFIG` CI variable
for project `dsop/nouchix/adinkhepra` (ID: 18821). Email sent to Jeffrey Goluba
(Iron Bank platform team) in January 2026 — no response received as of May 2026.
One admin action unblocks the full submission pipeline.

---

### Roadmap (Next 18 Months)

- AWS Marketplace: 3 SKUs — KHEPRA-PRO $35K, ENT $95K, STRAT $195K — Q3 2026 target
- FedRAMP Moderate filing — Q2 2027
- STIG-Connector API for MSPs/MSSPs — Q4 2027
- Series A: $5M at $20M post-money — Q3 2027

---

## Slide 6 — ARCHITECTURE: The Technical Moat

```
┌─────────────────────────────────────────────────────────┐
│  USER / AGENT INTERFACE                                  │
│  adinkhepra CLI  │  khepra-mcp (MCP)  │  apiserver REST │
├─────────────────────────────────────────────────────────┤
│  INTELLIGENCE ENGINE                                     │
│  ERT / Godfather Report  │  36,195 Mapping DB           │
│  STIG Validator (8→291)  │  CVE Intelligence            │
├─────────────────────────────────────────────────────────┤
│  CRYPTOGRAPHIC CORE                                      │
│  ML-KEM-1024 (Kyber)  │  ML-DSA-65 (Dilithium)         │
│  AES-256-GCM + Argon2id  │  Adinkra Proprietary Layer   │
│  FIPS 140-2/3 Mode  │  YubiHSM / CloudHSM backend       │
├─────────────────────────────────────────────────────────┤
│  IMMUTABLE AUDIT LAYER                                   │
│  DAG Provenance Ledger  │  PQC-Signed Nodes             │
│  DoD Logger (AU-2, AU-3)  │  AES-256-GCM at rest       │
├─────────────────────────────────────────────────────────┤
│  DATA LAYER                                              │
│  36,195 CSV rows (embedded)  │  Supabase PostgreSQL     │
│  Local DAG JSON store  │  Air-gap: no cloud required    │
└─────────────────────────────────────────────────────────┘
```

### Why Zero Token Costs
- Compiled Go binary — all logic runs on customer metal
- 36,195 mappings baked in at build time, loaded in-memory at startup
- STIG validation reads local system state via real OS calls
- DAG persistence to local disk — no cloud
- Air-gap mode: zero network dependencies during scan
- Flat annual license = zero overage risk

**Unit Economics:** COGS per additional scan ≈ $0 · Gross margin target 90%+ · LTV/CAC ~31:1

---

## Slide 7 — MARKET GAP: Why Current Solutions Fail DIB Contractors

| Solution | Core Failure |
|----------|-------------|
| GRC Platforms (Vanta / Drata / Strike Graph) | Built for SOC 2/ISO — no STIG DB, no OT coverage, no PQC scanning; API-billed AI costs exploding post-Jun 2026 |
| Vuln Scanners (Tenable / Rapid7 / Qualys) | Find CVEs — don't map to CMMC/STIG/800-171; 40+ hrs manual translation; no automated C3PAO evidence packages |
| Consultants (Big 4 + CMMC Boutiques) | $75K–$150K/cycle; 2–4 week turnarounds; no continuous monitoring; cannot deliver in air-gapped environments |

**NouchiX:** Flat-fee. Air-gapped. Sovereign. Immune to the June 2026 AI pricing repricing.

---

## Slide 8 — COMPETITIVE LANDSCAPE

| Feature | NouchiX | SteelCloud | Telos Xacta | Vanta/Drata | Tenable |
|---------|---------|-----------|------------|------------|--------|
| STIG-native DIB focus | ✓ | ✓ | ✓ | ✗ | ~ |
| 36K+ cross-framework mappings | **✓** | ✗ | ✗ | ✗ | ✗ |
| PQC (ML-KEM/ML-DSA) scanning | **✓** | ✗ | ✗ | ✗ | ✗ |
| Air-gapped binary deployment | **✓** | ~ | ✗ | ✗ | ✗ |
| Zero token cost / flat license | ✓ | ✓ | ✓ | ✗ | ✗ |
| Immutable DAG audit trail | **✓** | ✗ | ✗ | ✗ | ✗ |
| KHEPRA MCP server (AI agents) | **✓** | ✗ | ✗ | ✗ | ✗ |
| USPTO patent-pending IP | **✓** | ✗ | ✗ | ✗ | ✗ |
| OT/ICS + SCADA coverage | ~ | ~ | ✗ | ✗ | ~ |
| Veteran-owned (SDVOSB-Eligible) | **✓** | ✗ | ✗ | ✗ | ✗ |

✓ = Full  ~= Partial  ✗ = None
SteelCloud = closest direct competitor. Telos Xacta = federal GRC. Vanta/Drata = not DIB-native.

---

## Slide 9 — PROPRIETARY TECHNOLOGY: Patent + Data Moat + Partnership

### USPTO Patent Pending #73565085
- Filed Dec 6, 2025
- *KHEPRA: Adinkra Symbol-Based Cryptographic System for Quantum-Resilient Agentic AI Security*
- Key claims: Adinkra Algebraic Encoding (AAE), Quantum-Resilient Key Exchange (QKE),
  Agent Consensus Protocol (ACP)
- 12 continuation claims filed
- NIST FIPS 203/204/205 aligned
- Micro Entity status — IP owned by SecRed Knowledge Inc.

### The 36,195-Row Moat
- `STIG_CCI_Map.csv` — 28,639 rows (5.3 MB)
- `CCI_to_NIST53.csv` — 7,433 rows (1.1 MB)
- `NIST53_to_171.csv` — 123 rows
- **Verified:** `wc -l` on all three files = exact 36,195 total
- Barrier to entry: $500K–$1.5M labor + 24–36 months to replicate. No competitor has started.

### STIGViewer Partnership
- Full DISA STIG database access
- 100,000+ existing STIGViewer users
- Co-branded: 70% KHEPRA / 30% STIGViewer revenue
- CKL export + CBOM + executive PDF reports
- CKL generator: `pkg/stigs/ckl_generator.go` (live)

---

## Slide 10 — MARKET OPPORTUNITY

| Market | Size | Basis |
|--------|------|-------|
| TAM | $20B+ | PQC + compliance automation, global defense & regulated markets |
| SAM | $8B+ | US Federal & DIB cybersecurity automation market |
| SOM | $88M–$220M | 0.5% of 220K contractors at $80K–$200K ACV |

- 220,000 DIB contractors total
- 80,000 require CMMC Level 2
- ~47,000 actively seeking compliance tools by late 2026
- 80 active C3PAOs — massive assessment bottleneck
- $75K–$150K average C3PAO assessment fee per cycle
- $7.1B federal PQC migration budget earmarked

**ARR Potential:** 0.5% penetration at $80K ACV = **$88M ARR achievable in Years 3–5**

---

## Slide 11 — PILOT STRATEGY: Pipeline to First Revenue — Q3 2026

**Current State (May 2026):** No signed pilots. One early-stage pilot was initiated
and voluntarily paused while the software was revamped to production quality. LinkedIn
and QCL outreach campaigns were intentionally held pending that revamp. The binary is
now deployment-ready.
**Target:** 3 pilot LOIs by Q3 2026 via QCL outreach, LinkedIn, and university student testing.

### Pilot Eligibility Criteria
- Active DoD contract or subcontract
- CMMC Level 2 requirement within 18 months
- 10+ assets requiring STIG compliance
- Executive sponsor for co-development
- Mid-market DIB: $10M–$500M revenue

### Pilot Deliverables
- `adinkhepra` binary deployment (single executable, air-gap ready)
- 36,195-mapping compliance report (PDF + OSCAL)
- PQC readiness CBOM (CycloneDX) — `pkg/crypto/cbom/` (351 LoC, live)
- Godfather Report: risk in dollars
- Priority Iron Bank access post-pipeline-unblock

### Conversion Targets
QCL outreach: 150 targets → 15 qualified (10%) → **3 pilot LOIs [Q3 2026]** →
1–2 paid contracts [Q4 2026] → **Year 1 ARR: $85K+**

---

## Slide 12 — TRACTION: Two Live Deployments on Real Hardware

### Deployment 1 — SUNY Showcase PoC
**Status: DEMOED**
- University at Albany · NSA CAE-CDE (Team 3)
- Hardware: Arduino Uno Q (STM32U585 + QRB2210) via `pkg/scorpion/`
- PQC Standards: Kyber-1024 (ML-KEM) key exchange + ML-DSA-65 (Dilithium) signing
- Software: Zephyr RTOS, Modbus TCP, MQTT, SCORPION AES-256-GCM ceremony
- **Significance:** First known PQC key ceremony completed on STM32-class device,
  demonstrated live at an NSA-affiliated institution

### Deployment 2 — Persistent Home Node
**Status: LIVE NOW**
- Hardware: Raspberry Pi 2 (1GB RAM, 900MHz ARM) — lighter than most OT hardware
- Air-gap architecture: self-contained, zero cloud dependency, persists across reboots
- Runs continuously, not a demo environment
- **Significance:** Answers the #1 buyer question ("Does it run today?") with YES

### Codebase as Third Proof Point
- 85,500+ lines of production Go, 91 test files, 15 binaries
- Two independent hardware deployments before a single dollar of external funding

### NouchiX Compliance Posture (Honest)
- **CMMC Level 1:** Self-certified ✓
- **CMMC Level 2:** Not yet — third-party C3PAO assessment (~$80K) is a funded milestone
- **SOC 2:** Not certified. NouchiX uses SOC 2-compliant infrastructure tooling. Own
  certification is a post-funding target.
- **ISO 27001:** Named future target post-seed close
- **C3PAO evidence acceptance:** No NouchiX-generated evidence package has been
  submitted to or accepted by a C3PAO assessor in a live CMMC Level 2 assessment yet.
  The evidence package design follows DISA STIG and DoD CCI standards — C3PAO
  validation is a funded milestone (Q1 2027).

---

## Slide 13 — BUSINESS MODEL

### Year 1 Focus
End-User SaaS Platform — CMMC Level 2-target DIB contractors with 10+ STIG assets

| Stream | Customers | ACV | Timeline |
|--------|-----------|-----|---------|
| End-User SaaS (PRIMARY) | DIB contractors 10–1000 nodes | $5K–$50K/yr | Now |
| KHEPRI SMB Subscription | Small contractors <10 nodes | $50/mo | Active |
| API Licensing (STIG-Connector) | MSPs, MSSPs, GRC Platforms | $60K–$250K/yr | Year 2+ |
| Managed Security (NouchiX SOC) | Enterprise OT/ICS operators | $80K–$200K/yr | Year 2+ |
| Gov Contracts (SDVOSB-Eligible) | DoD sole-source up to $5M (upon certification) | $250K–$1M+ | Year 2+ |

**Unit Economics:** COGS ≈ $0/scan · Gross margin ~90%+ · CAC ~$15K · LTV ~$475K · LTV/CAC ~31:1

---

## Slide 14 — FINANCIALS: DCF Projections

### Base Case — Bootstrap
*Trigger: First $10K revenue + CRITICAL = 0*

| Year | Revenue | FCF |
|------|---------|-----|
| Year 1 | $85K | ($95K) |
| Year 2 | $340K | $30K |
| Year 3 | $1.2M | $480K |
| Year 4 | $3.4M | $1.7M |
| Year 5 | $8.5M | $5.1M |

**Implied EV:** $13.4M (8× Year 5 FCF)

### Accelerated — $500K Seed
*Trigger: Raise $500K, hire 2 engineers + BD*

| Year | Revenue | FCF |
|------|---------|-----|
| Year 1 | $200K | ($450K) |
| Year 2 | $900K | $50K |
| Year 3 | $3.5M | $1.4M |
| Year 4 | $10M | $5M |
| Year 5 | $22M | $12.5M |

**Implied EV:** $41M+ (8× Year 5 FCF)

*Assumptions: Discount rate 35% Yr1 → 25% Yr5. Terminal value at 8× Year 5 FCF. All figures USD.*

---

## Slide 15 — ROADMAP: Milestone-Gated

### Phase 0 · NOW → Jun 2026 — "Critical = 0" Gate
*Goal: Zero critical audit findings; Stripe tier live; Iron Bank unblocked*

| Milestone | Status | File |
|-----------|--------|------|
| MVP 1.1 deployment | Live | `cmd/adinkhepra/` |
| RHEL-09 checks: 8 → 9 live SV-IDs | 8 verified, +1 needed | `pkg/stig/rhel09_stig_checks.go` |
| CRITICAL audit findings = 0 | In progress | Internal ERT self-scan |
| KHEPRI $50/mo Stripe tier live | Framework ready | `pkg/billing/`, `pkg/license/` |
| Iron Bank pipeline unblock | **Blocked — awaiting Jeff Goluba / TRUFFLEHOG_CONFIG enable** | `ironbank-upload/hardening_manifest.yaml` |
| M.S. Digital Forensics graduation | Complete | May 2026 |

### Phase 1 · Q3 2026 — First Revenue Gate
*Goal: 3 pilot LOIs; compliance report demo-ready*

| Milestone | Notes |
|-----------|-------|
| RHEL-09: 9 → 50 live controls | Extend `pkg/stig/rhel09_stig_checks.go` scaffold |
| CKL export + STIGViewer co-brand | `pkg/stigs/ckl_generator.go` + partner integration |
| CBOM (CycloneDX) output via CLI | `pkg/crypto/cbom/` (351 LoC live) — add CLI flag |
| Godfather report PDF (production) | `pkg/stig/pdf_export.go` (492 LoC) — polish |
| Pilot binary: signed `.exe` + `.yaml` | Cross-compile + air-gap test |

**Gate unlock:** 3 LOIs signed

### Phase 2 · Q4 2026 – Q1 2027 — First Paid Customer
*Goal: $85K+ ARR; AWS Marketplace; STIGViewer launch*

| Milestone | Notes |
|-----------|-------|
| RHEL-09: 50 → 291 full control set | Parallel goroutines already in validator |
| CIS Benchmark integration | Map via existing 36K crosswalk |
| NIST 800-171 automated checks | 123-row crosswalk already loaded |
| Autonomous remediation `--apply` flag | `pkg/stig/remediator.go` — add execution layer |
| HPE GreenLake + AWS GovCloud | REST adapters in `pkg/apiserver/` |
| AWS Marketplace (3 SKUs) | AMI + container; KHEPRA-PRO $35K, ENT $95K, STRAT $195K |
| STIGViewer co-branded launch | Q4 2026 |
| $200K pre-seed close → 3 hires | Security Engineer + CTO + Customer Success |
| SBIR Phase I application | Upon reauthorization |

**Gate unlock:** First paid contract + $200K close

### Phase 3 · Q2 – Q4 2027 — Scale
*Goal: 50+ customers; $500K ARR; Series A*

| Milestone | Target |
|-----------|--------|
| FedRAMP Moderate filing | Q2 2027 |
| STIG-Connector API rollouts | Q4 2027 |
| $1M step-up seed | Q2 2027 |
| DISA PQC STIG co-authorship | Q3 2027 |
| Series A: $5M at $20M post-money | Q3 2027 |
| 50+ paying customers | $500K ARR |

### Phase 4 · 2028+ — Dominance

- CMMC Level 3 automation — Q1 2028
- Common Criteria evaluation — Q2 2028
- 200+ customers — $2M ARR target
- NSA CSfC program alignment
- DoD prime contractor partnerships
- M&A / Series B

*Phase 2 unlocks on first $10K revenue + CRITICAL = 0. Phase 3 unlocks on pilot conversion + $200K close.*

---

## Slide 16 — TEAM

### SDK (Souhimbou Doh Kone) — Founder & CEO
- US Army Signal Corps (25S) — SATCOM deployment · Active Secret Security Clearance
- M.S. Digital Forensics, UAlbany NSA CAE-CDE — completed May 2026
- MBA — completed May 2026 *(both programs now concluded; full bandwidth on NouchiX)*
- NSF I-Corps validated — market hypothesis confirmed
- USPTO Patent Pending #73565085 (notification received April 2026; 12 continuation claims)
- SDVOSB-Eligible (certification in progress) · HPE Tier-2 Partner
- ICS/SCADA capstone: Raspberry Pi + Modbus + PQC (live deployment)
- SecRed Knowledge Inc. incorporated Delaware C-Corp January 2, 2024; NY foreign entity

**Bandwidth note for investors:** Both graduate programs completed May 2026. SDK is
now full-time on NouchiX. First hire (Security Engineer) is the Day 1 use of pre-seed funds.

### Advisors & Ecosystem
- MBA Program Mentor: Startup commercialization strategy
- UAlbany Professor (NSA CAE-CDE): Cybersecurity & digital forensics
- STIGViewer Contact: DISA STIG database access + co-brand partnership
- CMMC Expert (TBD — hiring priority): C3PAO / Level 2 assessment guidance
- OT Security Expert (TBD): ICS/SCADA compliance
- Legal / IP Counsel (TBD): Patent prosecution (12 continuation claims pending)

### Hiring Plan
- Solo founder today (grad school complete — full-time from May 2026)
- $200K pre-seed: Security Engineer + CTO + Customer Success
- $1M step-up: Full Year 1 team (5 people)

---

## Slide 17 — THE ASK

### $200K Pre-Seed (NOW)
- 40% — Security Engineer hire
- 25% — CMMC certifications (Level 2)
- 20% — Cloud infra + AWS Marketplace
- 15% — BD outreach / QCL campaigns

### $1M Step-Up (Post-Pilot)
*Trigger: 1st signed contract + CRITICAL = 0*
- 50% — Engineering team (CTO + 2 engineers)
- 25% — Federal sales + BD lead
- 25% — Marketing + SBIR bridge

### This Raise Unlocks
- 3 pilot LOIs signed by Q3 2026
- First paying B2B customer by Q4 2026
- CMMC Level 2 third-party audit by Q1 2027
- Iron Bank DoD container registry approval (pending one admin action)
- $85K–$200K Year 1 ARR (base → accelerated)
- Series A: $5M at $20M post-money, Q3 2027

**Contact:** ai-nativevc@souhimbou.ai · nouchix.com · Patent #73565085 · SDVOSB-Eligible (not yet certified)

---

## Appendix — Verified Technical Numbers (May 20, 2026)

```
85,554   lines of Go code in pkg/ + cmd/ (verified wc -l)
36,195   cross-framework mapping rows (wc -l: 28,639 + 7,433 + 123)
 1,679   lines: DAG audit trail (AES-256-GCM + Dilithium-signed)
 1,517   lines: ERT / Godfather engine
   165   lines: SCORPION AES-256-GCM ceremony
    91   test files / 10,849 test LoC
    15   compiled Go binaries
     8   live RHEL-09 SV-IDs (framework supports 291+)
     3   NIST FIPS standards (203, 204, 205 via Cloudflare CIRCL v1.6.3)
     2   live hardware deployments (STM32 showcase + Pi2 persistent)
     0   external API calls during air-gap scan
     0   token costs per scan
```
