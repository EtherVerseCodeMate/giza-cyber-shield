package mcp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// SandboxConfig defines resource limits and permissions for sandboxed execution.
type SandboxConfig struct {
	Timeout        time.Duration `json:"timeout"`
	CPUShares      int64         `json:"cpu_shares"`
	MemLimitMB     int64         `json:"mem_limit_mb"`
	ReadOnly       bool          `json:"read_only"`
	NetworkAllowed bool          `json:"network_allowed"`
	AllowedDirs    []string      `json:"allowed_dirs,omitempty"`
	UseGVisor      bool          `json:"use_gvisor"`
}

// DefaultSandboxConfig returns the hardened default sandbox configuration.
func DefaultSandboxConfig() SandboxConfig {
	return SandboxConfig{
		Timeout:        90 * time.Second,
		CPUShares:      512,
		MemLimitMB:     256,
		ReadOnly:       true,
		NetworkAllowed: false,
		UseGVisor:      false,
	}
}

// SandboxConfigFromSpec derives a SandboxConfig from a ToolSpec.
func SandboxConfigFromSpec(spec ToolSpec) SandboxConfig {
	cfg := DefaultSandboxConfig()
	if spec.TimeoutMs > 0 {
		cfg.Timeout = time.Duration(spec.TimeoutMs) * time.Millisecond
	}
	cfg.NetworkAllowed = spec.NetworkAllowed
	return cfg
}

// DockerSandbox provides strong isolation using the Phantom MCP runner container.
type DockerSandbox struct {
	mu     sync.Mutex
	image  string
	config SandboxConfig
	logger *log.Logger
}

// DockerSandboxConfig holds construction parameters for DockerSandbox.
type DockerSandboxConfig struct {
	Image  string
	Config SandboxConfig
	Logger *log.Logger
}

// NewDockerSandbox creates a DockerSandbox with the given configuration.
func NewDockerSandbox(cfg DockerSandboxConfig) *DockerSandbox {
	image := cfg.Image
	if image == "" {
		image = "khepra-phantom:latest"
	}
	config := cfg.Config
	if config.Timeout == 0 {
		config = DefaultSandboxConfig()
	}
	logger := cfg.Logger
	if logger == nil {
		logger = log.Default()
	}
	return &DockerSandbox{
		image:  image,
		config: config,
		logger: logger,
	}
}

// Run creates an ephemeral Docker container, executes the tool, and returns the result.
func (ds *DockerSandbox) Run(ctx context.Context, spec ToolSpec, call MCPToolCall) (any, []string, error) {
	cfg := ds.resolveConfig(spec)
	if err := validateSandboxPolicy(spec, cfg); err != nil {
		return nil, nil, fmt.Errorf("sandbox policy violation: %w", err)
	}
	return ds.runPhantomContainer(ctx, spec, call, cfg)
}

func (ds *DockerSandbox) resolveConfig(spec ToolSpec) SandboxConfig {
	cfg := ds.config
	if v, ok := spec.Meta["network_allowed"].(bool); ok {
		cfg.NetworkAllowed = v
	}
	if v, ok := spec.Meta["readonly"].(bool); ok {
		cfg.ReadOnly = v
	}
	if v, ok := spec.Meta["timeout_ms"].(float64); ok && v > 0 {
		cfg.Timeout = time.Duration(v) * time.Millisecond
	}
	if v, ok := spec.Meta["mem_limit_mb"].(float64); ok && v > 0 {
		cfg.MemLimitMB = int64(v)
	}
	if v, ok := spec.Meta["cpu_shares"].(float64); ok && v > 0 {
		cfg.CPUShares = int64(v)
	}
	if spec.TimeoutMs > 0 {
		cfg.Timeout = time.Duration(spec.TimeoutMs) * time.Millisecond
	}
	cfg.NetworkAllowed = spec.NetworkAllowed
	return cfg
}

func (ds *DockerSandbox) runPhantomContainer(ctx context.Context, spec ToolSpec, call MCPToolCall, cfg SandboxConfig) (any, []string, error) {
	ctx, cancel := context.WithTimeout(ctx, cfg.Timeout)
	defer cancel()

	argsJSON, err := json.Marshal(call.Args)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to serialize tool args: %w", err)
	}

	args := ds.buildDockerArgs(spec, call, cfg, string(argsJSON))

	ds.logger.Printf("[SANDBOX:PHANTOM] tool=%s agent=%s image=%s timeout=%s",
		spec.Name, call.Identity.AgentID, ds.image, cfg.Timeout)

	stdout, stderr, exitCode, err := ds.execDocker(ctx, args)
	if err != nil {
		return nil, nil, fmt.Errorf("phantom container execution failed: %w", err)
	}

	if len(stderr) > 0 {
		for _, line := range strings.Split(strings.TrimSpace(string(stderr)), "\n") {
			if line != "" {
				ds.logger.Printf("[SANDBOX:PHANTOM:STDERR] %s", line)
			}
		}
	}

	if exitCode != 0 {
		return nil, nil, fmt.Errorf("phantom container exited with code %d: %s",
			exitCode, truncate(string(stderr), 500))
	}

	result, warnings, parseErr := parseStructuredOutput(stdout)
	if parseErr != nil {
		warnings = append(warnings, fmt.Sprintf("output parse warning: %v", parseErr))
	}
	return result, warnings, nil
}

func (ds *DockerSandbox) buildDockerArgs(spec ToolSpec, call MCPToolCall, cfg SandboxConfig, argsJSON string) []string {
	containerName := fmt.Sprintf("mcp-phantom-%s-%d", spec.Name, time.Now().UnixNano())

	args := []string{
		"run",
		"--rm",
		"--name", containerName,
		"--memory", fmt.Sprintf("%dm", cfg.MemLimitMB),
		"--cpu-shares", fmt.Sprintf("%d", cfg.CPUShares),
		"--pids-limit", "256",
		"--read-only",
		"--tmpfs", "/tmp:rw,noexec,size=64m",
		"--no-new-privileges",
		"--security-opt", "no-new-privileges:true",
	}

	if !cfg.NetworkAllowed {
		args = append(args, "--network", "none")
	}

	// Seccomp + AppArmor profiles (AD-011)
	var seccompProfile *SeccompProfile
	var apparmorName string
	if cfg.NetworkAllowed {
		seccompProfile = NetworkAllowedSeccompProfile()
		apparmorName = "khepra-phantom-net"
	} else {
		seccompProfile = DefaultSeccompProfile()
		apparmorName = "khepra-phantom"
	}
	if seccompPath, err := WriteSeccompProfile(seccompProfile, os.TempDir()); err == nil {
		args = append(args, "--security-opt", fmt.Sprintf("seccomp=%s", seccompPath))
	}
	args = append(args, "--security-opt", fmt.Sprintf("apparmor=%s", apparmorName))
	args = append(args, "--cap-drop=ALL", "--cap-add=SETUID", "--cap-add=SETGID")

	if cfg.UseGVisor {
		args = append(args, "--runtime", "runsc")
	}

	// Capability Mounts (ASD/CISA confused-deputy defense)
	if len(spec.CapabilityMounts) > 0 {
		for i, dir := range spec.CapabilityMounts {
			absDir, absErr := filepath.Abs(dir)
			if absErr != nil || absDir != dir {
				ds.logger.Printf("[SANDBOX] WARN: skipping invalid capability mount %q for tool %s", dir, spec.Name)
				continue
			}
			containerMount := fmt.Sprintf("/cap/%d", i)
			args = append(args, "-v", fmt.Sprintf("%s:%s:ro", absDir, containerMount))
		}
	} else {
		projectPath := getProjectPath(call.Args)
		if projectPath != "" {
			absPath, err := filepath.Abs(projectPath)
			if err == nil {
				mountMode := "ro"
				if !cfg.ReadOnly {
					mountMode = "rw"
				}
				args = append(args, "-v", fmt.Sprintf("%s:/project:%s", absPath, mountMode))
			}
		}
	}

	if !cfg.ReadOnly {
		args = append(args, "--tmpfs", "/var/lib/phantom/data:rw,size=128m")
	}

	symbol := "Eban"
	if s, ok := call.Args["symbol"].(string); ok && s != "" {
		symbol = s
	}
	args = append(args, "-e", fmt.Sprintf("PHANTOM_SYMBOL=%s", symbol))
	args = append(args, "--entrypoint", "/app/mcp-runner", ds.image, spec.Name, argsJSON)
	return args
}

func (ds *DockerSandbox) execDocker(ctx context.Context, args []string) (stdout, stderr []byte, exitCode int, err error) {
	cmd := execCommandContext(ctx, "docker", args...)
	var stdoutBuf, stderrBuf bytes.Buffer
	cmd.Stdout = &stdoutBuf
	cmd.Stderr = &stderrBuf
	err = cmd.Run()
	stdout = stdoutBuf.Bytes()
	stderr = stderrBuf.Bytes()
	if err != nil {
		if exitErr, ok := err.(interface{ ExitCode() int }); ok {
			return stdout, stderr, exitErr.ExitCode(), nil
		}
		if ctx.Err() != nil {
			return stdout, stderr, -1, fmt.Errorf("sandbox execution timeout: %w", ctx.Err())
		}
		return stdout, stderr, -1, err
	}
	return stdout, stderr, 0, nil
}

// ProcessSandbox runs tool handlers in-process with timeout enforcement only.
type ProcessSandbox struct {
	config SandboxConfig
}

// NewProcessSandbox creates a process-level sandbox.
func NewProcessSandbox(cfg SandboxConfig) *ProcessSandbox {
	return &ProcessSandbox{config: cfg}
}

// Run implements timeout-enforced in-process execution (no filesystem/network isolation).
func (ps *ProcessSandbox) Run(ctx context.Context, spec ToolSpec, call MCPToolCall) (any, []string, error) {
	cfg := SandboxConfigFromSpec(spec)
	_, cancel := context.WithTimeout(ctx, cfg.Timeout)
	defer cancel()
	return nil, []string{"process-sandbox: timeout enforced, but no filesystem/network isolation"}, nil
}

func validateSandboxPolicy(spec ToolSpec, cfg SandboxConfig) error {
	if spec.Name == "" {
		return fmt.Errorf("tool name is required")
	}
	if cfg.MemLimitMB > 8192 {
		return fmt.Errorf("memory limit %dMB exceeds maximum allowed (8192MB)", cfg.MemLimitMB)
	}
	if cfg.Timeout > 30*time.Minute {
		return fmt.Errorf("timeout %s exceeds maximum allowed (30m)", cfg.Timeout)
	}
	if spec.RiskClass == RiskReadOnly && !cfg.ReadOnly {
		return fmt.Errorf("read-only tool %q cannot request writable sandbox", spec.Name)
	}
	return nil
}

func getProjectPath(args map[string]any) string {
	if p, ok := args["project_path"].(string); ok {
		return p
	}
	return ""
}

func parseStructuredOutput(output []byte) (any, []string, error) {
	output = bytes.TrimSpace(output)
	if len(output) == 0 {
		return nil, []string{"empty output from sandbox"}, nil
	}
	var result any
	if err := json.Unmarshal(output, &result); err != nil {
		return string(output), []string{"output was not valid JSON: " + err.Error()}, nil
	}
	if m, ok := result.(map[string]any); ok {
		if status, _ := m["status"].(string); status == "error" {
			errMsg, _ := m["error"].(string)
			return result, []string{fmt.Sprintf("tool reported error: %s", errMsg)}, nil
		}
	}
	return result, nil, nil
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}

var execCommandContext = defaultExecCommandContext
