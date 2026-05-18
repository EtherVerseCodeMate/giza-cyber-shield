package mcp

import (
	"context"
	"time"
)

// ─── Sandbox Configuration (AD-011) ────────────────────────────────────────────
//
// Sandbox defaults are restrictive by design:
//   - ReadOnly:       true  (tool cannot write to filesystem)
//   - NetworkAllowed: false (tool cannot make network requests)
//
// The manifest is the SOLE source of truth for overriding these defaults.

// SandboxConfig defines resource limits and permissions for sandboxed execution.
type SandboxConfig struct {
	// Timeout is the maximum execution duration for the sandbox.
	Timeout time.Duration `json:"timeout"`

	// CPUShares limits CPU allocation (Docker --cpu-shares).
	CPUShares int `json:"cpu_shares"`

	// MemLimitMB limits memory allocation in megabytes.
	MemLimitMB int `json:"mem_limit_mb"`

	// ReadOnly prevents the sandbox from writing to any filesystem.
	// Default: true (AD-011).
	ReadOnly bool `json:"read_only"`

	// NetworkAllowed controls whether the sandbox can access the network.
	// Default: false (AD-011). Overridden by ToolSpec.NetworkAllowed.
	NetworkAllowed bool `json:"network_allowed"`

	// AllowedDirs is a whitelist of host directories mounted into the sandbox.
	AllowedDirs []string `json:"allowed_dirs,omitempty"`

	// UseGVisor enables gVisor (runsc) for additional kernel-level isolation.
	UseGVisor bool `json:"use_gvisor"`
}

// DefaultSandboxConfig returns the hardened default sandbox configuration.
func DefaultSandboxConfig() SandboxConfig {
	return SandboxConfig{
		Timeout:        90 * time.Second,
		CPUShares:      512,
		MemLimitMB:     256,
		ReadOnly:       true,          // AD-011: default deny writes
		NetworkAllowed: false,         // AD-011: default deny network
		UseGVisor:      false,         // Enable when gVisor is available
	}
}

// SandboxConfigFromSpec derives a SandboxConfig from a ToolSpec, applying the
// manifest-defined overrides onto the hardened defaults.
func SandboxConfigFromSpec(spec ToolSpec) SandboxConfig {
	cfg := DefaultSandboxConfig()
	if spec.TimeoutMs > 0 {
		cfg.Timeout = time.Duration(spec.TimeoutMs) * time.Millisecond
	}
	cfg.NetworkAllowed = spec.NetworkAllowed
	return cfg
}

// ─── Process Sandbox (Lightweight Alternative) ─────────────────────────────────

// ProcessSandbox runs tool handlers in-process but with timeout enforcement.
// This is the minimum viable sandbox for environments without Docker/gVisor.
// It provides timeout enforcement but NOT filesystem or network isolation.
type ProcessSandbox struct {
	config SandboxConfig
}

// NewProcessSandbox creates a process-level sandbox with the given configuration.
func NewProcessSandbox(cfg SandboxConfig) *ProcessSandbox {
	return &ProcessSandbox{config: cfg}
}

// Run implements SandboxRunner for in-process execution with timeout enforcement.
func (ps *ProcessSandbox) Run(ctx context.Context, spec ToolSpec, call MCPToolCall) (any, []string, error) {
	cfg := SandboxConfigFromSpec(spec)

	ctx, cancel := context.WithTimeout(ctx, cfg.Timeout)
	defer cancel()

	// In a full implementation, this would:
	//   1. Create a subprocess or Docker container
	//   2. Mount only AllowedDirs (read-only by default)
	//   3. Drop network if !cfg.NetworkAllowed
	//   4. Set rlimits for CPU/memory
	//   5. Execute the tool binary
	//
	// For the process sandbox, we execute in-process with timeout only.
	// The handler is expected to be registered in the Executor.
	//
	// This is intentionally a pass-through — the real isolation comes from
	// Docker or gVisor backends configured at the Executor level.

	warnings := []string{
		"process-sandbox: timeout enforced, but no filesystem/network isolation",
	}
	return nil, warnings, nil
}
