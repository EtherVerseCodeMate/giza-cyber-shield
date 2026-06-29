// pkg/asaf/daemon/privileged.go — Privileged Command Execution
//
// Wraps os/exec for each authorized CommandType.
// Every execution uses exec.Command (no shell) — arguments are passed directly
// to the kernel, preventing any shell injection even if argument validation
// somehow missed a metacharacter.
//
// Timeout: 60s for most operations, 300s for GRUB/dracut (slow by nature).
// Output capture: stdout + stderr combined, truncated at 64KB.

package daemon

import (
	"bytes"
	"context"
	"fmt"
	"log"
	"os/exec"
	"time"
)

const (
	defaultTimeout = 60 * time.Second
	slowTimeout    = 300 * time.Second // grub2-mkconfig, dracut
	maxOutputBytes = 64 * 1024         // 64KB output cap
)

// executePrivileged runs the command directly via os/exec (no shell).
// The caller is responsible for having already validated the command via
// validateCommand() and verified the ML-DSA-65 signature.
func executePrivileged(command []string, logger *log.Logger) *ChangeResult {
	if len(command) == 0 {
		return &ChangeResult{Error: "empty command"}
	}

	timeout := timeoutForCommand(command[0])
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	// NO SHELL — exec.CommandContext calls the binary directly.
	// Args are passed as a slice, never interpolated into a shell string.
	var args []string
	if len(command) > 1 {
		args = command[1:]
	}

	//nolint:gosec — command validated by validateCommand() before reaching here
	cmd := exec.CommandContext(ctx, command[0], args...)

	var buf bytes.Buffer
	cmd.Stdout = &buf
	cmd.Stderr = &buf

	logger.Printf("[EXEC] %v", command)
	start := time.Now()
	runErr := cmd.Run()
	elapsed := time.Since(start)

	output := buf.String()
	if len(output) > maxOutputBytes {
		output = output[:maxOutputBytes] + fmt.Sprintf("\n[TRUNCATED — %d bytes total]", buf.Len())
	}

	exitCode := 0
	if runErr != nil {
		if exitErr, ok := runErr.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else {
			exitCode = -1
		}
	}

	success := exitCode == 0
	logger.Printf("[EXEC] done exit=%d elapsed=%s command=%v", exitCode, elapsed.Round(time.Millisecond), command)

	return &ChangeResult{
		Success:  success,
		ExitCode: exitCode,
		Stdout:   output,
	}
}

// timeoutForCommand returns an appropriate execution timeout.
// Slow operations (GRUB, dracut) get extended timeouts.
func timeoutForCommand(binary string) time.Duration {
	slow := map[string]bool{
		"grub2-mkconfig": true,
		"dracut":         true,
		"dnf":            true,
		"rpm":            true,
	}
	name := commandBinary(binary)
	if slow[name] {
		return slowTimeout
	}
	return defaultTimeout
}
