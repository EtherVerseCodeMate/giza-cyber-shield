# 🔱 Blindspot Audit — AdinKhepra ASAF Desktop (Product A)

**Date**: 2026-07-01
**Framework**: 4-Layer SouHimBou Audit Framework (see MEMORY.md)
**Boundary**: Product A only — `cmd/asaf-desktop`, `app/`, `pkg/stig`, `pkg/asaf/daemon`
**Reference spec**: `docs/intel-cuops/CMMC_Quran_v2.md` (ASAF v2.0)
**Auditor**: Claude (automated analysis, live code citations)

---

## Executive Summary

| Dimension | Findings | RESOLVED | CRITICAL | HIGH | MEDIUM | LOW |
|-----------|----------|----------|----------|------|--------|-----|
| **Top-Down** (Strategy → Code) | 4 | 0 | 1 | 1 | 1 | 1 |
| **Bottom-Up** (Code → Claims) | 3 | 0 | 0 | 1 | 1 | 1 |
| **Horizontal** (Cross-Cutting) | 2 | 0 | 0 | 1 | 1 | 0 |
| **Diagonal** (Trust Boundary) | 2 | 0 | 1 | 0 | 1 | 0 |
| **TOTAL** | **11** | **0** | **2** | **3** | **4** | **2** |

**Bottom line**: The daemon-side architecture is genuinely strong — `pkg/asaf/daemon` implements a real deny-by-default ops catalog, ML-DSA-65 signature gate, symbol gate, and non-bypassable staging gate exactly as the spec claims. The GUI-side, however, ships two skeleton paths (license check, headless mode) that *return plausible values instead of doing the work*, and the embedded compliance database is a **Git LFS pointer** in a fresh clone, which silently guts the "25,185 mappings" claim. The single most dangerous item is **A-DG-01**: the desktop's `Validate()` scan path and the daemon's staged-remediation path are two different execution authorities, and the GUI path bypasses every daemon gate.

---

## TOP-DOWN (Strategy → Code)

### A-TD-01 — CRITICAL — "25,185 control mappings loaded" is impossible in a fresh clone
**Claim** (spec §0.5, status bar): the embedded DB carries 25,185 dedup'd mappings.
**Reality**: `pkg/stig/database.go:14` does `//go:embed data/*.csv`, but `.gitattributes` routes `*.csv` through Git LFS. In a fresh clone without `git lfs pull`, `pkg/stig/data/STIG_CCI_Map.csv` is a 3-line pointer (`version https://git-lfs.github.com/spec/v1 …`). The loader (`database.go:144`) skips rows with `< 5` fields as "malformed," so it loads **0 mappings and prints `Loaded 0 STIG→CCI mappings`** — no error. Verified: this container has no `git-lfs` and the file is a pointer.
**Failure scenario**: CI builds the desktop binary without LFS materialization → every scan resolves zero cross-references → SPRS scoring, blast-radius, and the entire Tier-4 baseline are built on an empty DB, while the UI still says "25,185 loaded."
**Fix**: exclude `pkg/stig/data/*.csv` from LFS (embedded assets must be real files at compile time), OR add a loader guard that hard-errors when the file begins with the LFS pointer signature, plus a CI row-count assertion (~28,639 STIG→CCI rows).

### A-TD-02 — HIGH — Live STIG coverage is 9 of 291, presented behind an honest but *hardcoded* disclaimer
**Claim** (spec): "9 of 291+ RHEL-09 controls live; pattern established for remainder."
**Reality**: accurate today — `pkg/stig/rhel09_stig.go:23-33` dispatches exactly 9 checks. The disclaimer string is correct but **hardcoded** in three places (`app/views/tab_compliance_graph.go:47`, `app/models/compliance_model.go:252`, `app/widgets/status_bar.go:39`). When coverage expands, three strings must be hand-edited or they will *understate* (then later *overstate*) reality.
**Fix**: compute the disclaimer from `len(implemented)/len(rulesForFamily)` so it tracks reality automatically (ties into the table-driven engine plan).

### A-TD-03 — MEDIUM — Stale "36,195-row" comments contradict the spec's headline correction
`pkg/stig/database.go:12`, `pkg/stig/validator.go:113,224` still say "36,195." Spec change-log item #1 mandates 25,185 everywhere with the dedup footnote. Cosmetic, but it is literally the first correction the v2.0 spec exists to make.

### A-TD-04 — LOW — Sample-coverage frameworks correctly disclaimed
CIS/NIST-53/NIST-171/CMMC direct checkers ship 4–5 checks and are honestly labeled "sample coverage" in `compliance_model.go:253-258`. No overstatement. Recorded for completeness.

---

## BOTTOM-UP (Code → Claims)

### A-BU-01 — HIGH — `checkLicense()` is a file-existence stub, not ML-DSA-65 verification
`cmd/asaf-desktop/main.go:188-204`: the comment says "Full ML-DSA-65 verification is handled by pkg/license," but the function only does `os.Stat(p)` and, if any license file *exists*, returns `"Pilot"`. It never calls `pkg/license`. **`pkg/license/client.go:242-253` contains real mldsa65 verification that the desktop simply does not invoke.** So a zero-byte file at the license path unlocks Pilot tier.
**Fix**: call `pkg/license.Manager.Initialize()` and gate the returned tier on signature validity; treat present-but-invalid as Community + visible error.

### A-BU-02 — MEDIUM — `runHeadless()` (Windows Service mode) is an exit-immediately stub
`cmd/asaf-desktop/main.go:40-49`: `--headless` (the documented Windows Service entry, `adinkhepra-desktop.exe --headless --port 8443`) logs "headless stub — exiting (v1.1.1)" and `os.Exit(0)`. A registered Windows Service would flap (start → instant exit). Honestly commented, but shipping-surfaced.

### A-BU-03 — LOW — Icon `go:embed` TODO behind Fyne default
`main.go:58` uses nil resource with a `TODO`. Cosmetic.

---

## HORIZONTAL (Cross-Cutting)

### A-HZ-01 — HIGH — Two remediation execution authorities coexist; the legacy one bypasses the daemon
The daemon path (`pkg/asaf/daemon/*`) enforces signature → catalog → symbol → staging → approval. But **`pkg/stig/remediator.go:172-186` shells out directly** via `LocalLink.Execute("sudo", {"bash", "-c", "grep … && sed -i … || echo …"})`. That exact command would be *rejected* by the daemon's own `validateCommand` — `bash` is not in `ops_catalog.go`, and the script is full of banned metacharacters (`ops_catalog.go:158`). So there are two ways to change a production host, and one honors none of the five security invariants the daemon's header advertises.
**Fix**: retire `LocalLink` production writes; have `Remediator` compile fixes into signed `ChangeRequest`s to the daemon socket. Express the sshd_config edit as a catalog-safe helper binary instead of inline bash.

### A-HZ-02 — MEDIUM — SPRS deduction weight source differs from spec's canonical model
`app/models/compliance_model.go:341` derives SPRS weight via `sprsWeightFor(f.SeverityRaw)` (STIG CAT severity), while the spec's `Finding.SPRSWeight` (§0.5) is the CMMC-practice weight (1/3/5 from Appendix A). CAT severity and CMMC SPRS weight are not the same axis, so a CAT II finding on a 5-point practice can deduct the wrong amount. The per-practice dedup logic (`compliance_model.go:387-397`) is correct; the *weight* feeding it is the wrong dimension.

---

## DIAGONAL (Trust Boundary)

### A-DG-01 — CRITICAL — Scan authority ≠ remediation authority (seam between GUI scan and daemon)
Trace a fix: GUI [Scan Now] → `tab_compliance_graph.go:126` `stig.NewValidator("").Validate()` runs **in-process, unsigned, no DAG node**. But the spec's Phase 6 chain requires staging → human approval → production → attestation, all ML-DSA-65 linked. The GUI never routes a fix through the daemon; `remediator.go` would run it locally (A-HZ-01). So the "cryptographically linked, C3PAO-verifiable" chain the spec sells (§Phase 6, §Phase 8) is not the path the desktop actually exercises today. The daemon is correct; **nothing in the desktop calls it.**
**Fix**: wire the sidebar [Stage Fix] action (currently a stub at `tab_compliance_graph.go:67`) to submit a signed `ChangeRequest`, and make the post-staging re-scan the same check that graded the finding.

### A-DG-02 — MEDIUM — Scan runs on a background goroutine but touches model state without a guarded write
`tab_compliance_graph.go:104-119`: the scan goroutine calls `ingestReport` (mutates `model`) then `canvas.Refresh`. The model has a `sync.RWMutex` (`compliance_model.go:219`) but the Fyne UI-thread refresh reads node state concurrently; on Fyne, canvas mutation should be marshalled to the UI thread. Low probability, but a race on `SPRSScore`/nodes during a large scan is possible.

---

## Priority Actions

1. **A-TD-01** (LFS/embed) — one day; without it every other Product-A claim is hollow in a clean build.
2. **A-DG-01 + A-HZ-01** — unify on the daemon as sole production-change authority; this is the credibility of the whole evidence package.
3. **A-BU-01** — make `checkLicense()` actually verify (the crypto already exists, unused).
4. **A-TD-02 / A-HZ-02** — computed coverage disclaimer; correct SPRS weight dimension.

## What's genuinely solid (do not regress)
- `pkg/asaf/daemon/ops_catalog.go` deny-by-default catalog + symbol map — real, non-configurable, C3PAO-showable.
- `pkg/asaf/daemon/staging.go` non-bypassable mirror-container staging gate — real Docker execution, not a stub.
- §10 Presentation Layer discipline — `UILabel()` enforced; no Sephirot terms leak to UI.
