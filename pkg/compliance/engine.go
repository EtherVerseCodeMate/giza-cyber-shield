package compliance

import (
	"fmt"
	"runtime"
	"time"
)

// CheckStatus represents the verdict of a compliance check.
type CheckStatus string

const (
	StatusPass  CheckStatus = "PASS"
	StatusFail  CheckStatus = "FAIL"
	StatusError CheckStatus = "ERROR"
	StatusSkip  CheckStatus = "SKIP"
)

// NativeCheck defines a single pure-Go compliance auditor.
type NativeCheck struct {
	ID          string // Internal ID
	STIGID      string // Mapped STIG ID (e.g. "WN10-00-000005")
	Title       string
	Description string
	OS          string // "windows", "linux", "all"
	Run         func() (CheckStatus, string, error)
}

// ComplianceResult captures the output of a native scan.
type ComplianceResult struct {
	Check  NativeCheck
	Status CheckStatus
	Output string
	Time   time.Time
}

// Engine manages the library of native checks.
type Engine struct {
	Checks []NativeCheck
}

// NewEngine initializes the compliance subsystem with OS-specific checks.
func NewEngine() *Engine {
	e := &Engine{
		Checks: make([]NativeCheck, 0),
	}
	e.loadChecks()
	return e
}

// Run performs all applicable checks for the current OS.
func (e *Engine) Run() []ComplianceResult {
	var results []ComplianceResult
	os := runtime.GOOS

	fmt.Printf("[KHEPRA] Starting Native Compliance Scan (OS: %s)...\n", os)

	for _, check := range e.Checks {
		if check.OS != "all" && check.OS != os {
			continue
		}

		fmt.Printf(" -> Checking %s [%s]... ", check.ID, check.STIGID)
		status, output, err := check.Run()
		if err != nil {
			status = StatusError
			output = err.Error()
		}

		color := "\033[32mPASS\033[0m"
		switch status {
		case StatusFail:
			color = "\033[31mFAIL\033[0m"
		case StatusError:
			color = "\033[33mERR \033[0m"
		}
		fmt.Printf("%s\n", color)

		results = append(results, ComplianceResult{
			Check:  check,
			Status: status,
			Output: output,
			Time:   time.Now(),
		})
	}
	return results
}

func (e *Engine) loadChecks() {
	// Common Checks
	e.Checks = append(e.Checks, NativeCheck{
		ID:          "check_os_arch",
		STIGID:      "GEN-000010",
		Title:       "System Architecture Verification",
		Description: "Ensure basic system identity parameters are readable.",
		OS:          "all",
		Run: func() (CheckStatus, string, error) {
			return StatusPass, fmt.Sprintf("%s/%s", runtime.GOOS, runtime.GOARCH), nil
		},
	})

	// Load Platform Specifics
	e.loadPlatformChecks()
}
