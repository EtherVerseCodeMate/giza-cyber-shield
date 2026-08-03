// Dynamic strings that are NOT SQL and NOT shell commands - should PASS validation.
// Proves the detector keys on query/command STRUCTURE, not stray keywords.
package report

import (
	"context"
	"fmt"
	"os/exec"
)

// BuildReportName composes a filename with fmt.Sprintf. No SQL, no exec — safe.
func BuildReportName(org string, year int) string {
	return fmt.Sprintf("CMMC_EVIDENCE_%s_%d.json", org, year)
}

// LogScan formats a log line that contains the word "select" in prose (not a query).
func LogScan(host string) string {
	return fmt.Sprintf("operator did select host %s for the scan", host)
}

// RunFixed runs a fixed command with separate, non-concatenated args.
func RunFixed(ctx context.Context, target string) error {
	cmd := exec.CommandContext(ctx, "/usr/bin/scanner", "--target", target)
	return cmd.Run()
}
