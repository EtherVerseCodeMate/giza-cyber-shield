# SPRINT: ERT Evolution — Live Threat Intel Integration

**Sprint Start:** 2026-05-18
**Sprint End:** 2026-06-15 (4 weeks)
**Goal:** Wire live threat intelligence into ERT Packages A-D, replacing demo-grade string matching with production-grade SCA + enrichment + EA-routed synthesis, delivered as an MCP server.

---

## Team

| Role | Agent | Capabilities |
|------|-------|-------------|
| **Product Owner** | Souhimbou D. Kone | Decision-maker, context shuttle, approvals |
| **Architect** | Grok (xAI) | Design, review, audit, alternative approaches |
| **Executor** | Antigravity (Local IDE AI) | Implementation, testing, debugging, deployment |

---

## Tech Stack

- **Language:** Go 1.22+
- **SBOM Format:** CycloneDX JSON
- **SCA Tools:** Syft (SBOM generation), Grype (vuln matching), OSV-Scanner (multi-ecosystem)
- **Database:** SQLite (via `pkg/intel/registry/`)
- **Feed Sources:** NVD, CISA KEV, InTheWild, ZDI, ExploitDB, OSV, CVEFeed, EPSS
- **Delivery:** MCP Server (stdio transport), Docker sandbox, CLI
- **Existing Infra:** `pkg/vuln/feeds.go`, `pkg/intel/mitre.go`, `pkg/ea/kernel_router.go`, `pkg/ert/cve_database.go`

---

## Architecture Decisions

| ID | Decision | Rationale | Decided By |
|----|----------|-----------|------------|
| AD-001 | CycloneDX JSON as internal SBOM format | Designed for security; includes VEX support for exploitability annotations | Audit |
| AD-002 | ~~Shell out to Syft/Grype~~ → Import as Go libraries (in-process) | Full sovereignty: zero external binary dependency, zero-copy SBOM handoff, single-binary distribution | Souhimbou |
| AD-003 | EPSS as 8th feed source | Replaces "zero-day prediction" claims with defensible exploit probability scoring | Audit |
| AD-004 | MCP-first delivery (not browser web app) | Zero attack surface expansion, local execution, the demo IS the product | Souhimbou |
| AD-005 | Start compliance module with 30 high-impact NIST 800-171 controls | Minimum viable control catalog; expand iteratively with auditor feedback | Audit |
| AD-006 | Replace "zero-day prediction" language everywhere | Legal/reputational risk; use "EPSS-based early-warning" instead | Audit |

---

## Unified Finding Schema

All tasks reference this schema. Grok designs around it, Antigravity implements it.

```go
// pkg/sca/finding.go

type EnrichedFinding struct {
    // Component identity
    Component       string   `json:"component"`
    Version         string   `json:"version"`
    Ecosystem       string   `json:"ecosystem"`
    PackageURL      string   `json:"purl"`
    CPE             string   `json:"cpe,omitempty"`

    // Vulnerability
    CVEID           string   `json:"cve_id"`
    CVSSv3Score     float64  `json:"cvss_v3_score"`
    CVSSv3Vector    string   `json:"cvss_v3_vector"`
    Severity        string   `json:"severity"` // CRITICAL/HIGH/MEDIUM/LOW

    // Sources
    Sources         []string `json:"sources"` // ["grype", "nvd", "cisa-kev"]

    // Enrichment (our moat)
    InCISAKEV       bool     `json:"in_cisa_kev"`
    KEVDateAdded    string   `json:"kev_date_added,omitempty"`
    InTheWild       bool     `json:"in_the_wild"`
    ExploitDBID     string   `json:"exploitdb_id,omitempty"`
    PoCAvailable    bool     `json:"poc_available"`
    EPSSScore       float64  `json:"epss_score"`       // 0.0-1.0
    EPSSPercentile  float64  `json:"epss_percentile"`

    // MITRE ATT&CK
    MITRETactics    []string `json:"mitre_tactics"`
    MITRETechniques []string `json:"mitre_techniques"`

    // VEX
    VEXStatus       string   `json:"vex_status"` // not_affected/affected/fixed/under_investigation

    // Confidence & feedback
    Confidence      string   `json:"confidence"` // high/medium/low
    UserVerdict     string   `json:"user_verdict,omitempty"`
}
```

---

## P0 Tasks (Weeks 1-2) — Foundation

### Task 1: EnrichedFinding Schema & SCA Package Structure
**Status:** `complete` ✅
**Assign Design:** Grok
**Assign Implement:** Antigravity
**Priority:** P0 — everything depends on this

**Files to create:**
- `pkg/sca/finding.go` — EnrichedFinding struct + helpers
- `pkg/sca/finding_test.go` — schema validation tests

**Acceptance Criteria:**
- [ ] EnrichedFinding struct matches schema above
- [ ] JSON marshal/unmarshal round-trip tests pass
- [ ] Severity classification helper (CVSS score → CRITICAL/HIGH/MEDIUM/LOW)
- [ ] EPSS percentile ranking helper

**Notes:**
- This is the contract between Stage 2 (SCA) and Stage 3 (ERT analysis)
- All downstream tasks depend on this schema being stable

---

### Task 2: Syft SBOM Adapter
**Status:** `complete` ✅
**Assign Design:** Grok
**Assign Implement:** Antigravity
**Priority:** P0

**Files to create:**
- `pkg/sca/syft_adapter.go` — shell out to `syft`, parse CycloneDX JSON output
- `pkg/sca/syft_adapter_test.go` — test with sample CycloneDX JSON

**Acceptance Criteria:**
- [ ] `GenerateSBOM(projectPath string) (*CycloneDXBOM, error)` function
- [ ] Handles: Go, Node.js, Python, Rust, Java ecosystems
- [ ] Error handling for: syft not installed, invalid path, timeout
- [ ] Caching: skip re-generation if lockfiles unchanged (checksum-based)
- [ ] Records syft version in output metadata

**Dependencies:** Task 1 (schema)

---

### Task 3: Grype Vulnerability Matcher Adapter
**Status:** `complete` ✅
**Assign Design:** Grok
**Assign Implement:** Antigravity
**Priority:** P0

**Files to create:**
- `pkg/sca/grype_adapter.go` — shell out to `grype`, consume SBOM, parse JSON output
- `pkg/sca/grype_adapter_test.go`

**Acceptance Criteria:**
- [ ] `MatchVulnerabilities(sbomPath string) ([]EnrichedFinding, error)` function
- [ ] Parses Grype JSON output → EnrichedFinding (partial — pre-enrichment)
- [ ] Handles: grype not installed, malformed SBOM, timeout
- [ ] Records grype version + DB version in output metadata

**Dependencies:** Task 1, Task 2

---

### Task 4: EPSS Feed Integration
**Status:** `planned`
**Assign Design:** Grok
**Assign Implement:** Antigravity
**Priority:** P0

**Files to modify:**
- `pkg/vuln/feeds.go` — add `fetchEPSS()` method + EPSS feed source

**API:** `https://api.first.org/data/v1/epss?cve=CVE-XXXX-XXXXX`

**Acceptance Criteria:**
- [ ] `fetchEPSS(ctx context.Context) error` method on IntelFeedManager
- [ ] Batch query support (EPSS API accepts multiple CVEs)
- [ ] Stores EPSS score + percentile per CVE in cache
- [ ] Rate limiting (respect FIRST.org API limits)
- [ ] Fallback: if EPSS unavailable, findings still work (EPSS fields zero-valued)
- [ ] Test with known CVEs (e.g., CVE-2021-44228 should have high EPSS)

**Dependencies:** None (can run in parallel with Tasks 2-3)

---

### Task 5: Enrichment Pipeline — Wire IntelFeedManager to SCA Findings
**Status:** `planned`
**Assign Design:** Grok
**Assign Implement:** Antigravity
**Priority:** P0

**Files to create:**
- `pkg/sca/enricher.go` — takes raw Grype findings, enriches with all 8 feed sources

**Acceptance Criteria:**
- [ ] `Enrich(findings []EnrichedFinding) ([]EnrichedFinding, error)` function
- [ ] For each finding:
  - Query CISA KEV → set `InCISAKEV`, `KEVDateAdded`
  - Query InTheWild → set `InTheWild`
  - Query ExploitDB → set `ExploitDBID`, `PoCAvailable`
  - Query EPSS → set `EPSSScore`, `EPSSPercentile`
  - Query MITRE → set `MITRETactics`, `MITRETechniques`
- [ ] Batch processing (don't query per-finding if possible)
- [ ] Enrichment is idempotent (safe to re-run)

**Dependencies:** Tasks 1, 3, 4

---

## P1 Tasks (Weeks 3-4) — Integration

### Task 6: Package B Replacement — Live Supply Chain Risk
**Status:** `planned`
**Assign Design:** Grok
**Assign Implement:** Antigravity
**Priority:** P1

**Files to modify:**
- `cmd/adinkhepra/ert_architect.go` — replace `assessDependencyRisk()` with enriched SCA pipeline

**Acceptance Criteria:**
- [ ] `scanSupplyChain()` calls Syft → Grype → Enricher pipeline
- [ ] Output includes real CVE IDs, CVSS scores, CISA KEV status, EPSS scores
- [ ] MITRE ATT&CK techniques displayed per finding
- [ ] Fallback: if SCA tools not installed, warn and use existing logic
- [ ] Remove hardcoded demo data ("Legacy_Logger_v2.1", etc.)
- [ ] Retain terminal formatting (colors, animations)

**Dependencies:** Tasks 1-5

---

### Task 7: Package A Upgrade — Compliance Framework Module
**Status:** `planned`
**Assign Design:** Grok
**Assign Implement:** Antigravity
**Priority:** P1

**Files to create:**
- `pkg/compliance/frameworks.go` — NIST 800-171 control catalog
- `pkg/compliance/rules.go` — scan rules mapped to controls
- `pkg/compliance/frameworks_test.go`

**Files to modify:**
- `cmd/adinkhepra/ert_readiness.go` — replace "strategy file exists" with compliance scoring

**Acceptance Criteria:**
- [ ] 30 high-impact NIST 800-171 Rev 2 controls loaded from embedded JSON
- [ ] Each control has: ID, family, title, description, assessment rules
- [ ] Rules types: "no_kev_exploited_deps", "tls_12_enforced", "no_hardcoded_secrets", "audit_logging_present"
- [ ] Confidence levels per mapping (high/medium/low)
- [ ] Alignment score calculated from % controls satisfied
- [ ] Output shows specific control gaps, not generic messages

**Dependencies:** Tasks 1-5 (needs enriched findings for some rules)

---

### Task 8: Package C Upgrade — SBOM-Informed Crypto Analysis
**Status:** `planned`
**Assign Design:** Grok
**Assign Implement:** Antigravity
**Priority:** P1

**Files to modify:**
- `cmd/adinkhepra/ert_crypto.go` — upgrade from string counting to SBOM + AST-aware

**Acceptance Criteria:**
- [ ] Crypto library inventory from SBOM (identify: openssl, boringssl, ring, crypto-js, etc.)
- [ ] Parse actual key sizes where detectable (not just "rsa." string count)
- [ ] Detect weak primitives: MD5, SHA1, DES, 3DES, RC4
- [ ] Detect hardcoded keys/IVs (regex patterns)
- [ ] Quantum risk context output using CNSA 2.0 timeline (scenario-based ranges, NOT precise dates)
- [ ] Retain Merkle tree hashing and IP lineage analysis

**Dependencies:** Task 2 (SBOM)

---

### Task 9: Package D → KernelRouter Integration
**Status:** `planned`
**Assign Design:** Grok
**Assign Implement:** Antigravity
**Priority:** P1

**Files to modify:**
- `cmd/adinkhepra/ert_godfather.go` — wire to `pkg/ea/kernel_router.go`

**Acceptance Criteria:**
- [ ] Godfather synthesis uses `KernelRouter.Route()` instead of hardcoded `if score < 60` branching
- [ ] Causal chains generated from actual enriched findings (not static templates)
- [ ] Each finding in the causal chain includes: CVE ID, CVSS, EPSS, MITRE technique
- [ ] Dollar impact estimated from CVSS severity bands (not hardcoded "$12M")
- [ ] All execution recorded in Flight Recorder DAG
- [ ] DAG attestation signed and exportable

**Dependencies:** Tasks 5, 6, 7, 8

---

## Stretch Tasks (Post-Sprint / P2)

### Task 10: MCP Server Wrapper
**Status:** `backlog`
- Wrap ERT packages as MCP tools (stdio transport)
- 5 tools: `ert_readiness`, `ert_architect`, `ert_crypto`, `ert_godfather`, `dag_attestation`
- Flight Recorder captures every tool call

### Task 11: Crash Dummy Validation
**Status:** `backlog`
- Clone DVWA, WebGoat, Mutillidae II
- Run full ERT pipeline against each
- Document: found vs. known vulns, gap analysis

### Task 12: Docker Sandbox Distribution
**Status:** `backlog`
- `Dockerfile.ert` with `--network=none`, read-only mount
- Bundle Syft + Grype binaries
- Offline feed snapshot support

---

## Review Log

| Date | Reviewer | Task | Feedback | Status |
|------|----------|------|----------|--------|
| | | | | |

---

## Messaging Guidelines (From Audit)

> **NEVER USE:**
> - "Zero-day prediction"
> - Precise quantum break dates ("RSA broken by 2027")
> - "Board-level weapon"
>
> **ALWAYS USE:**
> - "EPSS-based early-warning for newly disclosed vulnerabilities"
> - "Scenario-based quantum risk context aligned with CNSA 2.0"
> - "Enterprise-grade risk assessment with causal-chain analysis"
> - "Cryptographically-signed evidence package"

---

## Context for Grok

When sending tasks to Grok, include:
1. This file's relevant task section
2. The current file being designed (paste contents)
3. The `EnrichedFinding` schema (above)
4. Stack: Go 1.22, CycloneDX JSON, SQLite, MCP stdio
5. Any architecture decisions (AD-xxx) that apply

**Template:**
```
[SPRINT: ERT Evolution P0]
[TASK: {task number and name}]
[STACK: Go 1.22, CycloneDX JSON, SQLite]
[DECISIONS: AD-001 (CycloneDX), AD-002 (shell out to Syft/Grype)]

{paste relevant code or describe current state}

What I need:
- [ ] {specific deliverables from Grok}
```

---

*Last updated: 2026-05-17T20:12:00-04:00*
*Sprint managed by: Souhimbou D. Kone*
*Executor: Antigravity | Architect: Grok*
