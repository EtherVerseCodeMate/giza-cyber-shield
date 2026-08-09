// pkg/asaf/scanner/phase_runner.go
// Priority-phased STIG scan runner — CAT I → CAT II → Supplemental.
//
// Scan phases:
//
//   Phase 1 (CAT I — non-POA&M eligible):
//     Controls where failure = automatic CMMC assessment failure.
//     These are the FIRST controls a C3PAO assessor checks.
//     Time budget: 60 seconds per endpoint. Early exit on critical failure.
//     Examples: FIPS mode, SELinux enforcing, no root SSH, vendor support.
//
//   Phase 2 (CAT II — POA&M eligible):
//     Controls that can be documented in a Plan of Action & Milestones.
//     Run after CAT I is complete or documented.
//     Time budget: 180 seconds per endpoint.
//     Examples: password length, faillock, auditd, USBGuard, firewalld.
//
//   Phase 3 (Supplemental — async):
//     SBOM (syft), CVE (grype), PQC readiness (ERT), custom checks.
//     Run in background; results enriched into SPRS when complete.
//     No time budget — runs until done or context cancelled.
//
// The PhaseRunner integrates with the ControlStateStore for incremental scanning.
// If a control's state hash is unchanged since the last scan, it is skipped
// and the existing DAGNodeID is reused as evidence.
//
// Results are streamed via the resultCh channel — the fleet scanner writes
// these to SSE and to the DAG in real-time.
//
// IP: SOUHIMBOU DOH KONE LLC — exclusively licensed to SecRed Knowledge Inc.
// USPTO #73565085 (KHEPRA Protocol)

package scanner

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/asaf/fleet"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/remote"
)

// ScanPhase identifies the priority tier of a STIG control.
type ScanPhase int

const (
	// PhaseCAT1 — critical/high severity controls. Non-POA&M eligible.
	// Failure = CMMC assessment automatic fail.
	PhaseCAT1 ScanPhase = 1

	// PhaseCAT2 — medium severity controls. POA&M eligible.
	PhaseCAT2 ScanPhase = 2

	// PhaseSupplemental — low severity + extended checks (SBOM, CVE, PQC).
	PhaseSupplemental ScanPhase = 3
)

// PhaseResult is one scan check result from the PhaseRunner.
type PhaseResult struct {
	AssetID     string
	ControlID   string
	Title       string
	Phase       ScanPhase
	Status      string    // "pass" | "fail" | "skip_unchanged" | "error"
	Severity    string    // "critical" | "high" | "medium" | "low"
	Evidence    string    // command output (truncated)
	Message     string    // pass/fail message from EvaluateFunc
	Remediation string
	Elapsed     time.Duration
	DAGNodeID   string    // set after attestation
	Incremental bool      // true = state unchanged, existing DAG ref reused
}

// PhaseRunConfig configures a PhaseRunner.
type PhaseRunConfig struct {
	AssetID     string
	STIGProfile string  // "rhel9" | "rhel10" | "windows" | ...
	STIGVersion string  // e.g. "RHEL-10-STIG-V1R2"
	Phase1Limit time.Duration // CAT I budget per endpoint (default 60s)
	Phase2Limit time.Duration // CAT II budget per endpoint (default 180s)
	StateStore  *fleet.ControlStateStore // nil = no incremental scanning
	Workers     int    // parallel check workers within a phase (default 4)
}

// PhaseRunner executes STIG checks in priority order for a single endpoint.
type PhaseRunner struct {
	cfg    PhaseRunConfig
	exec   func(ctx context.Context, cmd string) (string, int, error)
}

// NewPhaseRunner creates a PhaseRunner for a single endpoint.
// exec is the ExecFunc from the ActiveConnection (SSH, WinRM, or KASA REST).
func NewPhaseRunner(cfg PhaseRunConfig, exec func(ctx context.Context, cmd string) (string, int, error)) *PhaseRunner {
	if cfg.Phase1Limit <= 0 {
		cfg.Phase1Limit = 60 * time.Second
	}
	if cfg.Phase2Limit <= 0 {
		cfg.Phase2Limit = 180 * time.Second
	}
	if cfg.Workers <= 0 {
		cfg.Workers = 4
	}
	return &PhaseRunner{cfg: cfg, exec: exec}
}

// Run executes all three phases in order, streaming results to resultCh.
// The caller is responsible for closing resultCh when Run returns.
// Returns the number of CAT I failures (non-zero = CMMC auto-fail risk).
func (r *PhaseRunner) Run(ctx context.Context, resultCh chan<- PhaseResult) (cat1Failures int, err error) {
	allChecks := selectSTIGChecks(r.cfg.STIGProfile)
	phase1, phase2, phase3 := partitionByPhase(allChecks)

	// ── Phase 1: CAT I ───────────────────────────────────────────────────────
	phase1Ctx, phase1Cancel := context.WithTimeout(ctx, r.cfg.Phase1Limit)
	defer phase1Cancel()

	cat1Failures = r.runPhase(phase1Ctx, phase1, PhaseCAT1, resultCh)
	if ctx.Err() != nil {
		return cat1Failures, ctx.Err()
	}

	// ── Phase 2: CAT II ──────────────────────────────────────────────────────
	phase2Ctx, phase2Cancel := context.WithTimeout(ctx, r.cfg.Phase2Limit)
	defer phase2Cancel()

	r.runPhase(phase2Ctx, phase2, PhaseCAT2, resultCh)
	if ctx.Err() != nil {
		return cat1Failures, ctx.Err()
	}

	// ── Phase 3: Supplemental (async, no deadline, inherits parent ctx) ──────
	r.runPhase(ctx, phase3, PhaseSupplemental, resultCh)

	return cat1Failures, nil
}

// runPhase runs a set of checks concurrently (up to r.cfg.Workers parallel) and
// streams PhaseResult to resultCh. Returns count of "fail" results.
func (r *PhaseRunner) runPhase(ctx context.Context, checks []remote.STIGCheck, phase ScanPhase, resultCh chan<- PhaseResult) int {
	if len(checks) == 0 {
		return 0
	}

	sem := make(chan struct{}, r.cfg.Workers)
	var (
		mu       sync.Mutex
		failures int
		wg       sync.WaitGroup
	)

	for _, check := range checks {
		check := check // capture

		wg.Add(1)
		sem <- struct{}{}

		go func() {
			defer wg.Done()
			defer func() { <-sem }()

			if ctx.Err() != nil {
				return // phase timed out
			}

			result := r.runSingleCheck(ctx, check, phase)
			if result.Status == "fail" {
				mu.Lock()
				failures++
				mu.Unlock()
			}

			select {
			case resultCh <- result:
			case <-ctx.Done():
			}
		}()
	}

	wg.Wait()
	return failures
}

// runSingleCheck executes one STIG check and returns a PhaseResult.
// Implements incremental scanning: if state hash unchanged, returns skip_unchanged.
func (r *PhaseRunner) runSingleCheck(ctx context.Context, check remote.STIGCheck, phase ScanPhase) PhaseResult {
	start := time.Now()
	base := PhaseResult{
		AssetID:     r.cfg.AssetID,
		ControlID:   check.ControlID,
		Title:       check.Title,
		Phase:       phase,
		Severity:    check.Severity,
		Remediation: check.Remediation,
	}

	// Incremental: run a fast state probe first
	if r.cfg.StateStore != nil {
		probeOut, probeExit, probeErr := r.exec(ctx, check.CheckCommand)
		if probeErr == nil {
			unchanged, stored := r.cfg.StateStore.IsUnchanged(r.cfg.AssetID, check.ControlID, probeOut)
			if unchanged && stored != nil {
				base.Status = "skip_unchanged"
				base.Message = fmt.Sprintf("state unchanged since %s (DAG: %s)",
					stored.ScannedAt.Format("2006-01-02T15:04Z"), stored.DAGNodeID)
				base.DAGNodeID = stored.DAGNodeID
				base.Incremental = true
				base.Elapsed = time.Since(start)
				base.Evidence = truncate(probeOut, 256)
				return base
			}
			// State changed — evaluate with the output we already have
			pass, msg := check.EvaluateFunc(probeOut, probeExit)
			base.Evidence = truncate(probeOut, 512)
			base.Message = msg
			base.Status = statusStr(pass)
			base.Elapsed = time.Since(start)

			// Record new state
			r.cfg.StateStore.Record(&fleet.ControlState{
				AssetID:     r.cfg.AssetID,
				ControlID:   check.ControlID,
				StateHash:   fleet.HashProbeOutput(probeOut),
				Status:      base.Status,
				Severity:    check.Severity,
				ProbeOutput: probeOut,
				ScannedAt:   time.Now().UTC(),
				STIGVersion: r.cfg.STIGVersion,
			})
			return base
		}
	}

	// No state store (or probe error) — run full check
	out, exit, err := r.exec(ctx, check.CheckCommand)
	if err != nil {
		base.Status = "error"
		base.Message = fmt.Sprintf("exec error: %v", err)
		base.Elapsed = time.Since(start)
		return base
	}

	pass, msg := check.EvaluateFunc(out, exit)
	base.Evidence = truncate(out, 512)
	base.Message = msg
	base.Status = statusStr(pass)
	base.Elapsed = time.Since(start)

	if r.cfg.StateStore != nil {
		r.cfg.StateStore.Record(&fleet.ControlState{
			AssetID:     r.cfg.AssetID,
			ControlID:   check.ControlID,
			StateHash:   fleet.HashProbeOutput(out),
			Status:      base.Status,
			Severity:    check.Severity,
			ProbeOutput: out,
			ScannedAt:   time.Now().UTC(),
			STIGVersion: r.cfg.STIGVersion,
		})
	}

	return base
}

// ── Phase Partitioner ─────────────────────────────────────────────────────────

// partitionByPhase splits a check list into Phase 1 (CAT I), Phase 2 (CAT II),
// and Phase 3 (supplemental / low) buckets.
func partitionByPhase(checks []remote.STIGCheck) (phase1, phase2, phase3 []remote.STIGCheck) {
	for _, c := range checks {
		switch strings.ToLower(c.Severity) {
		case "critical", "high":
			phase1 = append(phase1, c)
		case "medium":
			phase2 = append(phase2, c)
		default: // "low" + anything else
			phase3 = append(phase3, c)
		}
	}
	return
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func statusStr(pass bool) string {
	if pass {
		return "pass"
	}
	return "fail"
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "…"
}
