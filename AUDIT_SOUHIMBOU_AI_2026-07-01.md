# 🔱 Blindspot Audit — SouHimBou AI (Agentic SOC / Flight Recorder) (Product C)

**Date**: 2026-07-01
**Framework**: 4-Layer SouHimBou Audit Framework (see MEMORY.md)
**Boundary**: Product C only — `giza-cyber-shield`: `souhimbou_ai/SouHimBou.AI` (Vite/React + Supabase), `pkg/flight`, `pkg/souhimbou`
**Prior baseline**: Feb-2026 audit found 137 mock instances across 22 Supabase functions
**Auditor**: Claude (automated analysis, live code citations)

---

## Executive Summary

| Dimension | Findings | RESOLVED | CRITICAL | HIGH | MEDIUM | LOW |
|-----------|----------|----------|----------|------|--------|-----|
| **Top-Down** (Strategy → Code) | 3 | 2 | 1 | 0 | 0 | 0 |
| **Bottom-Up** (Code → Claims) | 3 | 1 | 1 | 1 | 0 | 0 |
| **Horizontal** (Cross-Cutting) | 2 | 0 | 0 | 1 | 1 | 0 |
| **Diagonal** (Trust Boundary) | 2 | 1 | 1 | 0 | 0 | 0 |
| **TOTAL** | **10** | **4** | **3** | **2** | **1** | **0** |

**Bottom line**: Substantial real progress since February — mock count dropped from **137 → ~30**, and the three worst Feb findings are **RESOLVED**: alert delivery is now real (`fetch()` to Autosend/OpenPhone/Discord), `performance-analyzer` has **zero** `Math.random()`, and the `fabricateScanData()` DAG-fraud path is gone. The Flight Recorder is real (ML-DSA-65 + SHA3-256, `pkg/flight/recorder.go:235-244`).

**But the silent-failure pattern didn't die — it migrated into the remediation and containment layer, which is worse.** `ansible-remediation-executor` and `automated-remediation-engine` compute a *fabricated* `success: true` from a formula instead of running Ansible, and `emergency-rollback` returns `success: true` for iptables rollback it never executes. During a live incident, an operator will believe a host was contained/restored when nothing happened. These are CRITICAL because they are fabricated success in the action-of-last-resort path.

---

## TOP-DOWN (Strategy → Code)

### C-TD-01 — RESOLVED — "Automated alert notifications" now real
Feb: email/SMS/webhook were `console.log` + `setTimeout` mocks. Now `supabase/functions/alert-engine/index.ts:481` posts to `https://api.autosend.com/v1/mails/send`, `:537` to OpenPhone (SMS), `:581` to a Discord webhook — real `fetch()` with response handling. ✅

### C-TD-02 — RESOLVED — "Real-time metrics" no longer `Math.random()`
Feb HZ-01: `performance-analyzer` used random metrics. Now `grep -c "Math.random()"` on that function returns **0**. ✅

### C-TD-03 — CRITICAL — "Automated remediation" claim is backed by simulated execution
**Claim**: SouHimBou AI autonomously remediates findings.
**Reality**: `supabase/functions/ansible-remediation-executor/index.ts:181` — comment "Simulate Ansible execution with deterministic outcome" — computes `executionSuccess` from `playbook.success_rate - asset.risk_score` (`:194-195`), never invokes Ansible/AWX, then writes `success: true` and an execution record. `automated-remediation-engine/index.ts:278` similarly "Simulate validation process." A customer watching the SOC dashboard sees remediations "succeed" that never ran.
**Fix**: route through `automated-remediation`'s already-correct fail-loud integration (see C-BU-03), or fail-closed when AWX creds are absent. Never write `success: true` for a simulated action.

---

## BOTTOM-UP (Code → Claims)

### C-BU-01 — CRITICAL — `emergency-rollback` fabricates containment-rollback success
`supabase/functions/emergency-rollback/index.ts:210-249`: `rollbackNetworkIsolation` / `rollbackEndpointIsolation` build iptables command strings, then — comment "For simulation, we'll just log the commands that would be executed" — return `success: true` with synthesized `output` strings. **No command is executed.** This is the exact Feb Diagonal pattern (DB says "done", nothing transmitted) relocated into incident response. If an analyst triggers rollback to restore a wrongly-isolated production host, the UI confirms success while the host stays isolated (or, inversely, a "contain" twin would report contained while the attacker keeps the foothold).
**Fix**: execute via the same privileged execution channel the ASAF daemon uses, or fail-closed. This is life-of-the-product for a SOC tool.

### C-BU-02 — HIGH — ~30 residual mock instances across 16 functions
`grep` for `generateMock|Math.random()|// Simulate|replace with real|mock data` across `supabase/functions/` = ~30 hits in 16 functions, incl. `infrastructure-discovery`, `cloud-asset-discovery`, `stig-asset-discovery`, `vulnerability-scanner` (`:94` "Simulate common network vulnerabilities"), `siem-integration`, `automated-threat-hunting`. Down from 137, but discovery + vuln-scan mocks mean fabricated inventory/findings can still enter the DAG and compliance reports.
**Fix**: apply the fail-loud pattern uniformly; add CI grep-gate (`grep -r "// Simulate\|generateMock" supabase/functions/ && exit 1`).

### C-BU-03 — RESOLVED (partial, as a *pattern reference*) — `automated-remediation` fails loud correctly
`supabase/functions/automated-remediation/index.ts:16-18`: "When APIs are not configured, they FAIL LOUDLY instead of returning mock data," reading real `ANSIBLE_AWX_API_URL`, `CROWDSTRIKE_*`, `DEFENDER_*` creds (`:30-38`). This is the correct template its siblings (C-TD-03, C-BU-01) must adopt. ✅ for this function.

---

## HORIZONTAL (Cross-Cutting)

### C-HZ-01 — HIGH — Sibling remediation functions fixed inconsistently (the classic twin trap)
Four near-identically-named functions handle remediation, and they were remediated *unevenly*:
- `automated-remediation` — ✅ fail-loud, real integrations (C-BU-03)
- `automated-remediation-engine` — 🔴 simulated validation (C-TD-03)
- `ansible-remediation-executor` — 🔴 simulated execution (C-TD-03)
- `emergency-rollback` — 🔴 fabricated success (C-BU-01)

This is exactly the anti-pattern the framework warns about: one twin fixed, the others not, same directory. A reviewer who checks `automated-remediation` and stops would conclude the layer is done.
**Fix**: converge all four on the fail-loud template; consider collapsing the duplicates.

### C-HZ-02 — MEDIUM — Two mock-detection baselines (Go pkg vs Supabase) not under one CI gate
The Go side (`pkg/flight`, `pkg/souhimbou`) is clean; the Supabase side carries the residue. There is no single CI check spanning both. A "no mock in production" gate must cover `souhimbou_ai/**/supabase/functions` and the Go packages together, or Product C's cleanliness depends on manual vigilance.

---

## DIAGONAL (Trust Boundary)

### C-DG-01 — RESOLVED — Fabricated DAG scan evidence removed
Feb DG-03: `fabricateScanData(); dag.Write(...)`. Grep for `fabricateScanData|fabricate|generateFakeDAG` across `pkg/` and `cmd/` = **no matches**. The immutable audit trail is no longer being fed synthetic scan data from this path. ✅

### C-DG-02 — CRITICAL — The remediation seam re-breaks the trust boundary
Full trace of an auto-remediation: Detect (real) → Alert (real, C-TD-01) → **Remediate (simulated, C-TD-03/C-BU-01)** → DB record `success: true` → Dashboard "Remediated" → Operator believes host is fixed → **host is unchanged**. The boundary that Feb closed on the *alert* hop is now broken one hop later on the *action* hop. Because the fabricated result is persisted (and may be cited in a compliance report as evidence of continuous remediation), this also re-opens the audit-integrity risk DG-03 was meant to close — just via remediation records instead of scan records.
**Fix**: same as C-BU-01 — no persisted `success` without a real side effect; add provenance (`executed: true/false`, `execution_channel`, `is_simulated`) to every remediation record so a simulated run can never masquerade as real in the DAG or a report.

---

## Regression watch (per framework escalation rule)
- Feb closed the **alert** silent-failure; it **regressed one layer down** into remediation/containment. Per the framework's escalation rule (a pattern that returns after being addressed escalates one severity), the remediation simulations are treated as CRITICAL, not HIGH.

## Priority Actions
1. **C-BU-01 / C-DG-02** — `emergency-rollback` and the remediation executors must execute or fail-closed. Highest priority: this is a SOC tool lying about containment.
2. **C-TD-03** — converge remediation functions on the fail-loud template.
3. **C-BU-02** — clear the residual ~30 discovery/vuln mocks; add CI grep-gate.
4. **C-DG-02** — add `is_simulated`/provenance to remediation records so simulation can never enter the DAG as real.

## What's genuinely solid (do not regress)
- Real alert delivery (Autosend/OpenPhone/Discord).
- Flight Recorder: ML-DSA-65 signed, SHA3-256 content-addressed frames (`pkg/flight/recorder.go`).
- `fabricateScanData` DAG-fraud path removed.
- `automated-remediation` fail-loud template — the model for fixing its siblings.
