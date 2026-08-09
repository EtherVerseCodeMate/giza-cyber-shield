# 🔱 Blindspot Audit — PQC-Khepra-MCP Server/Scanner (Product B)

**Date**: 2026-07-01
**Framework**: 4-Layer SouHimBou Audit Framework (see MEMORY.md)
**Boundary**: Product B only — `PQC-Khepra-MCP` repo: `cmd/khepra-mcp`, `pkg/mcp`, `pkg/gateway`, `pkg/stig`, `cmd/agent`, `pkg/apiserver`
**Auditor**: Claude (automated analysis, live code citations)

---

## Executive Summary

| Dimension | Findings | RESOLVED | CRITICAL | HIGH | MEDIUM | LOW |
|-----------|----------|----------|----------|------|--------|-----|
| **Top-Down** (Strategy → Code) | 3 | 1 | 0 | 1 | 1 | 0 |
| **Bottom-Up** (Code → Claims) | 3 | 0 | 0 | 0 | 2 | 1 |
| **Horizontal** (Cross-Cutting) | 2 | 0 | 0 | 0 | 2 | 0 |
| **Diagonal** (Trust Boundary) | 2 | 0 | 0 | 1 | 1 | 0 |
| **TOTAL** | **10** | **1** | **0** | **3** | **6** | **1** |

**Bottom line**: This is the healthiest of the three boundaries. The Feb-2026 audit's flagship Top-Down miss — *"MCP Gateway with prompt injection scanning → zero implementation"* — is now **RESOLVED**: real regex-based injection detection with audit logging exists (`pkg/gateway/mcp_gateway.go:26-155`) plus a full OWASP-MCP-Top-10 scanner (`pkg/mcp/scanner/checks.go`). The embedded compliance CSV here is a **real 28,639-row file**, not an LFS pointer (contrast Product A / A-TD-01). No dev-key backdoor, no mock license in the production build. Remaining findings are the weak machine-ID-as-bearer-token auth model and stale "36,195" strings.

---

## TOP-DOWN (Strategy → Code)

### B-TD-01 — RESOLVED — MCP prompt-injection scanning now exists
Feb-2026 finding was "zero implementation." Now: `pkg/gateway/mcp_gateway.go:28` defines `injectionPatterns []*regexp.Regexp`, `:146` iterates them, `:154` logs `prompt_injection_blocked` to the audit log. Independent second layer in `pkg/mcp/scanner/checks.go:31` (`injectionPatterns` incl. "ignore previous", "jailbreak") mapped to OWASP-MCP-01 findings (`pkg/mcp/scanner/findings.go:51`). Claim now matches code. ✅

### B-TD-02 — HIGH — 47+ MCP tools registered; verify each handler is real, not a shell
`cmd/khepra-mcp/main.go:445-520+` registers a large, genuine tool surface (`acp_*`, `nhi_*`, `ert_*`, `stig_check`, `pqc_stig`, `cmmc_assess`, `khepra_export_attestation`, etc.). This is real breadth — but breadth is also surface area for the *silent-mock* anti-pattern. Several tools (`khepra_query_threat_intel`, `discover_assets`) claim live intel/discovery. **Action for next pass**: trace each of the 47 handlers for a `generateMock`/hardcoded-fallback path (this audit confirmed registration and the compliance/attestation tools are real; the threat-intel + discovery handlers need the same line-level trace Product C got).

### B-TD-03 — MEDIUM — "36,195-row database" claim persists in tool descriptions
`cmd/khepra-mcp/main.go:~517` comment and `pkg/mcp/tools/sovereign_tools.go`, `pkg/mcp/onboarding.go` cite "36,195-row." Same correction as spec change-log #1 — should read 25,185 (queryable, dedup'd) with the raw-sum footnote. Customer-facing via MCP tool descriptions, so higher visibility than an internal comment.

---

## BOTTOM-UP (Code → Claims)

### B-BU-01 — MEDIUM — `apiKey == machineID` bearer auth is weak-by-design
`pkg/apiserver/integration.go:96`: `ValidateAPIKey` accepts the request if the presented key equals the machine ID. The machine ID is derived from hardware (`pkg/license/machine_id*.go`) and is *not a secret* — it can appear in logs, telemetry, support bundles. Anyone who learns it authenticates. Not a backdoor (no hardcoded constant), but it conflates *identity* with *secret*.
**Fix**: require a signed challenge (machine ID identifies; a per-install ML-DSA key proves). The signing primitives already exist (`pkg/license/pqc_signing.go`).

### B-BU-02 — MEDIUM — `licensemock` / `cmd/licensemock` exists in-tree
A mock license issuer lives at `cmd/licensemock`. Confirmed it is **not** imported by `cmd/khepra-mcp` or `cmd/agent` (grep clean), so it does not ship in the production MCP binary. Keep it that way with a build-tag or CI guard so it can never be linked into a release.

### B-BU-03 — LOW — `InsecureSkipVerify: true` in three scanner paths — all intentional & documented
`pkg/pki/probe.go:92`, `pkg/enumerate/network.go:819`, `pkg/souhimbou/agent_scanner.go:575,1354`. Each is a scanner that must *inspect* bad certs, each carries a `//nolint:gosec` with rationale, and `probe.go:80-89` explains the `VerifyConnection` override captures-but-never-trusts. Correct pattern; recorded so a future grep doesn't re-flag it.

---

## HORIZONTAL (Cross-Cutting)

### B-HZ-01 — MEDIUM — Duplicated `pkg/stig` between Product A and Product B may diverge
`PQC-Khepra-MCP/pkg/stig` and `giza-cyber-shield/pkg/stig` are sibling copies. The MCP copy's CSV is a real file; Product A's is an LFS pointer (A-TD-01). That is already a divergence in *data materialization*. Risk: a fix to a checker or the loader lands in one and not the other. This is the orphaned-artifact anti-pattern at the repo level.
**Fix**: single source of truth (shared module or generated sync in CI with a hash-diff gate).

### B-HZ-02 — MEDIUM — Three `injectionPatterns` definitions across the codebase
`pkg/gateway/mcp_gateway.go:28`, `pkg/mcp/scanner/checks.go:31`, and the agent_scanner probes each maintain their own injection pattern list. Good that detection is layered; risk is the lists drift (one gets a new jailbreak pattern, others don't).
**Fix**: hoist to one shared `pkg/security/injection` pattern set consumed by all three.

---

## DIAGONAL (Trust Boundary)

### B-DG-01 — HIGH — MCP tool output → DAG signing: confirm sign-failure is fail-closed
`pkg/mcp/dag_bridge.go:115,124` logs `WARN: sign failed` / `Add failed` for a tool event and **continues**. If a high-impact tool result (e.g. `godfather_report`, `khepra_export_attestation`) is emitted but its DAG attestation node fails to sign, the caller may still receive the result while the audit trail silently lacks the node. That is the "database says done, evidence chain doesn't have it" seam.
**Fix**: for attestation-class tools, treat sign failure as a hard error returned to the caller (fail-closed), not a warn-and-proceed.

### B-DG-02 — MEDIUM — `godfather_approve` human-gate: verify approval is bound to the exact artifact
`cmd/khepra-mcp/main.go:475-476` registers `godfather_report` + `godfather_approve` as an HITL gate ("high-impact outputs require analyst approval"). Confirm the approval token is cryptographically bound to the specific report hash it approves — otherwise an approval for report A could be replayed to release report B. (Handler internals not fully traced this pass; flagged for line-level follow-up.)

---

## Priority Actions
1. **B-DG-01** — make attestation-tool DAG sign failures fail-closed.
2. **B-BU-01** — replace machine-ID-as-bearer with a signed challenge.
3. **B-TD-02** — line-level mock trace of the threat-intel + discovery handlers.
4. **B-HZ-01** — de-duplicate `pkg/stig` across Product A/B before they diverge further.

## What's genuinely solid (do not regress)
- Real prompt-injection detection + OWASP-MCP scanner (Feb finding closed).
- Embedded compliance CSV is a real file, not an LFS pointer.
- No dev-key backdoor; `licensemock` not linked into the production binary.
- Documented, correct `InsecureSkipVerify` usage in scanner paths.
