// pkg/asaf/daemon/staging.go — Mirror Environment Staging Manager
//
// Manages the staging gate that every ChangeRequest must pass before it
// touches the production host. Selects the best available isolation backend
// (Docker single-container → DryRun), runs the command, and returns a
// ML-DSA-65-signed StagingResult that can be dropped verbatim into a
// C3PAO evidence package.
//
// Architecture note — single container (Bug 1 + Bug 2 fix):
//
// The previous implementation ran THREE separate containers:
//   Container A: snapshot "before" files → exits → state discarded
//   Container B: runs command → exits → state discarded
//   Container C: snapshot "after" files → exits → always identical to A
//
// The diff was always empty. Fixed by running ONE container that executes
// /asaf/stage.sh (written to a temp file and mounted read-only). stage.sh
// captures before state, runs the command, captures after state, and emits
// structured ASAF_* markers that parseStageOutput() consumes.
//
// The old `--read-only` flag is intentionally REMOVED. With --read-only and
// only --tmpfs /tmp, commands writing to /etc (authselect, faillock --conf,
// sysctl -w) fail with EROFS — the staging test proves only that the binary
// exists, not that it executes. Docker's native overlay layer (without
// --read-only) already provides copy-on-write isolation: every container gets
// its own writable layer on top of the image, discarded on --rm. Security
// invariants (--cap-drop ALL, --network none, --security-opt no-new-privileges)
// are preserved.

package daemon

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/adinkra"
	"github.com/google/uuid"
)

const stagingTimeout = 120 * time.Second

// FileDiff is a before/after snapshot of one affected file.
type FileDiff struct {
	Path    string `json:"path"`
	Before  string `json:"before"` // "" means file did not exist before the command
	After   string `json:"after"`  // "" means file was deleted by the command
	Changed bool   `json:"changed"`
}

// StagingResult replaces the plain Diff string. The Attestation field is a
// ML-DSA-65 signature over canonicalStagingBytes(jobID, result), signed by
// the daemon key. It is safe to include verbatim in a C3PAO evidence package.
type StagingResult struct {
	Diffs       []FileDiff `json:"diffs"`
	Stdout      string     `json:"stdout"`
	ExitCode    int        `json:"exit_code"`
	BackendType string     `json:"backend_type"` // "docker" | "dry-run"
	Attestation []byte     `json:"attestation,omitempty"`
}

// TextDiff returns a human-readable summary of all changed files.
// Used when populating the legacy StagingDiff string field in ChangeResult.
func (r *StagingResult) TextDiff() string {
	if r == nil {
		return ""
	}
	var sb strings.Builder
	changed := 0
	for _, d := range r.Diffs {
		if d.Changed {
			changed++
			fmt.Fprintf(&sb, "=== %s ===\n--- BEFORE ---\n%s\n--- AFTER ---\n%s\n\n", d.Path, d.Before, d.After)
		}
	}
	if changed == 0 {
		return fmt.Sprintf("No file changes detected (backend: %s, exit: %d)", r.BackendType, r.ExitCode)
	}
	return sb.String()
}

// StagingJob tracks the state of a single staging run.
type StagingJob struct {
	ID        string         `json:"id"`
	Status    string         `json:"status"` // "running" | "success" | "failed"
	Request   *ChangeRequest `json:"-"`
	Result    *StagingResult `json:"result,omitempty"`
	StartedAt time.Time      `json:"started_at"`
	EndedAt   time.Time      `json:"ended_at,omitempty"`
	Error     string         `json:"error,omitempty"`
}

// StagingManager owns all in-flight staging jobs.
type StagingManager struct {
	mu            sync.RWMutex
	jobs          map[string]*StagingJob
	logger        *log.Logger
	daemonPrivKey []byte // ML-DSA-65 private key for signing StagingResult attestations
}

// NewStagingManager returns an initialized StagingManager.
// daemonPrivKey is used to ML-DSA-65-sign each StagingResult; pass nil to skip
// attestation (e.g. in tests where no key material exists).
func NewStagingManager(logger *log.Logger, daemonPrivKey []byte) *StagingManager {
	return &StagingManager{
		jobs:          make(map[string]*StagingJob),
		logger:        logger,
		daemonPrivKey: daemonPrivKey,
	}
}

// Submit creates a new StagingJob and starts the staging run asynchronously.
func (sm *StagingManager) Submit(req *ChangeRequest) (*StagingJob, error) {
	job := &StagingJob{
		ID:        uuid.New().String(),
		Status:    "running",
		Request:   req,
		StartedAt: time.Now().UTC(),
	}
	sm.mu.Lock()
	sm.jobs[job.ID] = job
	sm.mu.Unlock()
	go sm.runJob(job)
	return job, nil
}

// Poll returns the current state of a staging job.
func (sm *StagingManager) Poll(jobID string) (*StagingJob, bool) {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	job, ok := sm.jobs[jobID]
	return job, ok
}

// runJob selects the best available backend, runs the staging job, signs the
// result, and updates the job's terminal state.
func (sm *StagingManager) runJob(job *StagingJob) {
	ctx, cancel := context.WithTimeout(context.Background(), stagingTimeout)
	defer cancel()

	backend := SelectBackend(job.Request.STIGProfile)
	sm.logger.Printf("[STAGING] job=%s profile=%q backend=%T control=%s command=%v",
		job.ID, job.Request.STIGProfile, backend, job.Request.ControlID, job.Request.Command)

	result, err := backend.Run(ctx, job.Request)
	if err != nil || result == nil {
		errMsg := "backend returned nil result"
		if err != nil {
			errMsg = err.Error()
		}
		result = &StagingResult{ExitCode: -1, BackendType: "error", Stdout: errMsg}
	}

	// Sign the result so it can be included as Node 3 (STAGING_RESULT) in the
	// 6-node C3PAO evidence chain. Skip if no key is configured.
	if len(sm.daemonPrivKey) > 0 {
		canonical := canonicalStagingBytes(job.ID, result)
		sig, signErr := adinkra.Sign(sm.daemonPrivKey, canonical)
		if signErr == nil {
			result.Attestation = sig
		} else {
			sm.logger.Printf("[STAGING] WARN: attestation signing failed for job=%s: %v", job.ID, signErr)
		}
	}

	sm.mu.Lock()
	job.Result = result
	job.EndedAt = time.Now().UTC()
	if result.ExitCode == 0 {
		job.Status = "success"
		sm.logger.Printf("[STAGING] job=%s SUCCESS backend=%s attested=%v — safe to approve for production",
			job.ID, result.BackendType, len(result.Attestation) > 0)
	} else {
		job.Status = "failed"
		job.Error = fmt.Sprintf("exit %d (backend: %s)", result.ExitCode, result.BackendType)
		sm.logger.Printf("[STAGING] job=%s FAILED exit=%d backend=%s — production protected",
			job.ID, result.ExitCode, result.BackendType)
	}
	sm.mu.Unlock()
}

// canonicalStagingBytes produces the byte sequence that is ML-DSA-65 signed.
// The Attestation field is excluded to avoid circularity.
func canonicalStagingBytes(jobID string, r *StagingResult) []byte {
	type canonical struct {
		JobID    string     `json:"job_id"`
		ExitCode int        `json:"exit_code"`
		Diffs    []FileDiff `json:"diffs"`
		Backend  string     `json:"backend"`
	}
	b, _ := json.Marshal(canonical{
		JobID:    jobID,
		ExitCode: r.ExitCode,
		Diffs:    r.Diffs,
		Backend:  r.BackendType,
	})
	return b
}

// parseStageOutput parses the structured output from stage.sh (see
// staging_backends.go: stageScript) into per-file FileDiffs and the
// command exit code.
//
// Marker protocol (exact line prefix match):
//   ASAF_BEFORE_BEGIN <path>  — start of before-state for <path>
//   ASAF_BEFORE_END <path>    — end of before-state
//   ASAF_AFTER_BEGIN <path>   — start of after-state for <path>
//   ASAF_AFTER_END <path>     — end of after-state
//   ASAF_EXIT_CODE <n>        — exit code of the staged command
//
// Any other line is command stdout and is NOT included in the diffs.
func parseStageOutput(output string) (diffs []FileDiff, exitCode int) {
	type state int
	const (
		stateNone   state = iota
		stateBefore state = iota
		stateAfter  state = iota
	)

	before    := make(map[string][]string)
	after     := make(map[string][]string)
	fileOrder := []string{}
	seen      := map[string]bool{}
	cur       := stateNone
	curFile   := ""

	for _, line := range strings.Split(output, "\n") {
		switch {
		case strings.HasPrefix(line, "ASAF_BEFORE_BEGIN "):
			curFile = strings.TrimPrefix(line, "ASAF_BEFORE_BEGIN ")
			cur = stateBefore
			if !seen[curFile] {
				seen[curFile] = true
				fileOrder = append(fileOrder, curFile)
			}
		case strings.HasPrefix(line, "ASAF_BEFORE_END "):
			curFile = ""
			cur = stateNone
		case strings.HasPrefix(line, "ASAF_AFTER_BEGIN "):
			curFile = strings.TrimPrefix(line, "ASAF_AFTER_BEGIN ")
			cur = stateAfter
		case strings.HasPrefix(line, "ASAF_AFTER_END "):
			curFile = ""
			cur = stateNone
		case strings.HasPrefix(line, "ASAF_EXIT_CODE "):
			fmt.Sscanf(strings.TrimPrefix(line, "ASAF_EXIT_CODE "), "%d", &exitCode)
		default:
			if curFile == "" {
				continue
			}
			switch cur {
			case stateBefore:
				before[curFile] = append(before[curFile], line)
			case stateAfter:
				after[curFile] = append(after[curFile], line)
			}
		}
	}

	diffs = make([]FileDiff, 0, len(fileOrder))
	for _, f := range fileOrder {
		b := strings.TrimRight(strings.Join(before[f], "\n"), "\n")
		a := strings.TrimRight(strings.Join(after[f], "\n"), "\n")
		diffs = append(diffs, FileDiff{
			Path:    f,
			Before:  b,
			After:   a,
			Changed: b != a,
		})
	}
	return diffs, exitCode
}

// filterASAFMarkers strips ASAF_* protocol lines from raw container output so
// the remainder is the command's own stdout, suitable for human display.
func filterASAFMarkers(output string) string {
	lines := strings.Split(output, "\n")
	filtered := lines[:0]
	for _, line := range lines {
		if !strings.HasPrefix(line, "ASAF_") {
			filtered = append(filtered, line)
		}
	}
	return strings.Join(filtered, "\n")
}

// affectedFilesByCommand maps catalog commands to the config files they modify.
// Used by stage.sh to know which files to snapshot before and after execution.
func affectedFilesByCommand(command []string) []string {
	if len(command) == 0 {
		return nil
	}
	binary := commandBinary(command[0])
	switch binary {
	case "asaf-confedit":
		// asaf-confedit <file> <key> <value> — first arg IS the file
		if len(command) >= 2 {
			return []string{command[1]}
		}
		return nil
	}
	fileMap := map[string][]string{
		"authselect":     {"/etc/pam.d/system-auth", "/etc/pam.d/password-auth"},
		"faillock":       {"/etc/security/faillock.conf"},
		"pwquality":      {"/etc/security/pwquality.conf"},
		"sysctl":         {"/etc/sysctl.d/99-asaf.conf"},
		"auditctl":       {"/etc/audit/rules.d/asaf.rules"},
		"fips-mode-setup": {"/etc/sysctl.conf"},
		"setenforce":     {"/etc/selinux/config"},
		"grubby":         {"/etc/default/grub"},
		"modprobe":       {"/etc/modprobe.d/asaf.conf"},
		"rmmod":          {"/etc/modprobe.d/asaf.conf"},
	}
	return fileMap[binary]
}

// mirrorImage returns ASAF_MIRROR_IMAGE if set, else the default rhel9 image.
// mirrorImageForProfile (in staging_backends.go) is preferred for new code;
// this function exists for callers that don't yet carry a STIGProfile.
func mirrorImage() string {
	if img := os.Getenv("ASAF_MIRROR_IMAGE"); img != "" {
		return img
	}
	return mirrorImages["rhel9"]
}

// dockerAvailable returns true if a Docker daemon is reachable within 3s.
func dockerAvailable() bool {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	return exec.CommandContext(ctx, "docker", "info").Run() == nil //nolint:gosec
}

// truncateOutput trims output to maxBytes, appending a truncation notice.
func truncateOutput(s string, maxBytes int) string {
	if len(s) <= maxBytes {
		return s
	}
	return s[:maxBytes] + fmt.Sprintf("\n[TRUNCATED — %d bytes total]", len(s))
}

// captureFileContents reads each path from the HOST filesystem (for DryRun).
func captureFileContents(paths []string) map[string]string {
	result := make(map[string]string, len(paths))
	for _, p := range paths {
		data, err := os.ReadFile(p)
		if err == nil {
			result[p] = string(data)
		} else {
			result[p] = ""
		}
	}
	return result
}

// buildDryRunDiffs constructs FileDiffs from a captured before-state,
// marking every file as unchanged (command was not executed in dry-run).
func buildDryRunDiffs(files []string, state map[string]string) []FileDiff {
	diffs := make([]FileDiff, 0, len(files))
	for _, f := range files {
		diffs = append(diffs, FileDiff{
			Path:    f,
			Before:  state[f],
			After:   state[f], // unchanged — not executed
			Changed: false,
		})
	}
	return diffs
}

// bytes is already imported via encoding/json above; keep exec import live.
var _ = bytes.NewBuffer // suppress unused import if exec is the only user
