// pkg/asaf/daemon/staging.go — Mirror Environment Staging Manager
//
// Manages ephemeral Docker containers used to validate ChangeRequests before
// they touch the production host. The "staging gate" is non-bypassable:
// every production execution must have a corresponding successful staging run.
//
// Mirror image: ghcr.io/nouchix/asaf-mirror-rhel9:latest
// A minimal RHEL 9 UBI image with the same authselect/PAM/sysctl baseline
// as a customer host. Built once, shipped as part of ASAF installer.
//
// Job lifecycle:
//
//	Submit() → StagingJob{status: "running"} → goroutine runs container
//	         → job updated: status "success"|"failed", Diff populated
//	Poll(id) → returns current job state (caller polls until terminal)

package daemon

import (
	"bytes"
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

const (
	// defaultMirrorImage is the ephemeral RHEL 9 container used for staging
	// when ASAF_MIRROR_IMAGE is unset. Use mirrorImage() to read the
	// effective value — the env var was previously documented but never
	// actually read (fixed 2026-06-30, see project_product_a_architecture
	// memory: this constant was also wrongly set on the asaf-api Docker
	// service in docker-compose.asaf.yml, even though asaf-daemon — the
	// only process that uses it — runs on bare metal, not in that compose
	// file at all).
	defaultMirrorImage = "ghcr.io/nouchix/asaf-mirror-rhel9:latest"

	stagingTimeout = 120 * time.Second
)

// mirrorImage returns ASAF_MIRROR_IMAGE if set, else defaultMirrorImage.
// Read fresh on every call (not cached) so a systemd unit's Environment=
// override or a manual env change takes effect without a daemon restart
// being strictly required for the *next* staging job.
func mirrorImage() string {
	if img := os.Getenv("ASAF_MIRROR_IMAGE"); img != "" {
		return img
	}
	return defaultMirrorImage
}

// StagingJob tracks the state of a single mirror-environment test run.
type StagingJob struct {
	ID        string    `json:"id"`
	Status    string    `json:"status"`    // "running" | "success" | "failed"
	Request   *ChangeRequest `json:"-"`   // original request
	Diff      string    `json:"diff"`      // before/after state capture
	Stdout    string    `json:"stdout"`    // container combined output
	ExitCode  int       `json:"exit_code"`
	StartedAt time.Time `json:"started_at"`
	EndedAt   time.Time `json:"ended_at,omitempty"`
	Error     string    `json:"error,omitempty"`
}

// StagingManager owns all in-flight staging jobs.
type StagingManager struct {
	mu     sync.RWMutex
	jobs   map[string]*StagingJob
	logger *log.Logger
}

// NewStagingManager returns an initialized StagingManager.
func NewStagingManager(logger *log.Logger) *StagingManager {
	return &StagingManager{
		jobs:   make(map[string]*StagingJob),
		logger: logger,
	}
}

// Submit creates a new StagingJob and starts the mirror container asynchronously.
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

	go sm.runMirrorContainer(job)
	return job, nil
}

// Poll returns the current state of a staging job.
func (sm *StagingManager) Poll(jobID string) (*StagingJob, bool) {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	job, ok := sm.jobs[jobID]
	return job, ok
}

// runMirrorContainer executes the ChangeRequest inside an ephemeral container.
// This is the "Mirror Environment" — if the command bricks the container,
// production is untouched. That's the ROI.
func (sm *StagingManager) runMirrorContainer(job *StagingJob) {
	sm.logger.Printf("[STAGING] job=%s starting mirror container image=%s", job.ID, mirrorImage())

	ctx, cancel := context.WithTimeout(context.Background(), stagingTimeout)
	defer cancel()

	// Capture "before" state snapshot inside container
	beforeSnap := sm.captureStateSnapshot(ctx, job.Request.Command)

	// job.Request.Command was already run through validateCommand() (deny-by-
	// default catalog + shell-metacharacter rejection) before it ever reached
	// runStaging — see daemon.go Execute(). Passed here as discrete argv
	// entries with no shell in between, matching the no-shell exec used for
	// production in privileged.go. Previously this joined the args into a
	// single string and ran it through `sh -c` inside the container, which
	// (a) reopened word-splitting/quoting semantics that validateCommand()'s
	// character blocklist doesn't fully account for (e.g. unquoted globs or
	// unbalanced quotes), and (b) silently mangled any argument containing a
	// space. The container boundary (--cap-drop ALL, --network none,
	// --read-only) is still the primary isolation layer, but there's no
	// reason to hand the mirror a shell it doesn't need. Fixed 2026-07-01.
	dockerArgs := append([]string{
		"run", "--rm",
		"--name", "asaf-mirror-" + job.ID[:8],
		"--read-only",       // container filesystem is read-only except mounted tmpfs
		"--tmpfs", "/tmp",   // allow writes to /tmp only
		"--security-opt", "no-new-privileges",
		"--cap-drop", "ALL",
		"--network", "none", // no network inside mirror container
		mirrorImage(),
	}, job.Request.Command...)

	cmd := exec.CommandContext(ctx, "docker", dockerArgs...)
	var buf bytes.Buffer
	cmd.Stdout = &buf
	cmd.Stderr = &buf

	runErr := cmd.Run()
	output := buf.String()
	if len(output) > 32*1024 {
		output = output[:32*1024] + "\n[TRUNCATED]"
	}

	exitCode := 0
	if runErr != nil {
		if exitErr, ok := runErr.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else {
			exitCode = -1
		}
	}

	// Capture "after" state (what would have changed)
	afterSnap := sm.captureStateSnapshot(ctx, job.Request.Command)
	diff := buildDiff(beforeSnap, afterSnap, strings.Join(job.Request.Command, " "))

	sm.mu.Lock()
	job.Stdout = output
	job.ExitCode = exitCode
	job.Diff = diff
	job.EndedAt = time.Now().UTC()
	if exitCode == 0 {
		job.Status = "success"
		sm.logger.Printf("[STAGING] job=%s SUCCESS — safe to approve for production", job.ID)
	} else {
		job.Status = "failed"
		job.Error = fmt.Sprintf("mirror container exited %d", exitCode)
		sm.logger.Printf("[STAGING] job=%s FAILED exit=%d — production protected", job.ID, exitCode)
	}
	sm.mu.Unlock()
}

// captureStateSnapshot captures relevant system state for diff generation.
// Runs inside the mirror container to show before/after changes.
func (sm *StagingManager) captureStateSnapshot(ctx context.Context, command []string) string {
	if len(command) == 0 {
		return ""
	}
	// Identify which files the command would affect
	affectedFiles := affectedFilesByCommand(command)
	if len(affectedFiles) == 0 {
		return "(no file state to capture for this command type)"
	}

	var snap strings.Builder
	for _, f := range affectedFiles {
		args := []string{"run", "--rm", "--network", "none", mirrorImage(), "cat", f}
		cmd := exec.CommandContext(ctx, "docker", args...) //nolint:gosec
		out, _ := cmd.Output()
		snap.WriteString(fmt.Sprintf("=== %s ===\n%s\n", f, string(out)))
	}
	return snap.String()
}

// buildDiff creates a human-readable diff for the Compliance Graph UI.
func buildDiff(before, after, command string) string {
	if before == after {
		return fmt.Sprintf("Command executed successfully.\nNo file state changes detected for: %s", command)
	}
	return fmt.Sprintf("BEFORE:\n%s\nAFTER:\n%s", before, after)
}

// affectedFilesByCommand maps known commands to the config files they modify.
func affectedFilesByCommand(command []string) []string {
	if len(command) == 0 {
		return nil
	}
	binary := commandBinary(command[0])
	fileMap := map[string][]string{
		"authselect": {"/etc/pam.d/system-auth", "/etc/pam.d/password-auth"},
		"faillock":   {"/etc/security/faillock.conf"},
		"pwquality":  {"/etc/security/pwquality.conf"},
		"sysctl":     {"/etc/sysctl.d/99-asaf.conf"},
		"auditctl":   {"/etc/audit/rules.d/asaf.rules"},
	}
	return fileMap[binary]
}
