package mcp

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"sync"
	"time"
)

// boundaryScoped lists tool names that require a valid BoundaryApproval when
// the executor is in Phase 03+ mode. khepra_discover_endpoints is excluded
// because Phase 01 discovery happens before the boundary is signed.
var boundaryScoped = map[string]bool{
	"khepra_run_compliance_scan": true,
	"khepra_export_attestation":  true,
	"khepra_get_compliance_score": true,
}

// ─── Risk-Classified Executor (AD-009) ─────────────────────────────────────────
//
// The Executor dispatches tool calls based on their ToolRiskClass:
//   - ReadOnly:    in-process, no side effects (nhi_inventory, acp_status, etc.)
//   - Sandboxed:   isolated environment with resource limits (ert_scan, agi tasks)
//   - Destructive: requires explicit confirmation + DAG attestation (nhi_revoke, acp_revoke)
//
// The manifest is the sole source of truth for risk classification.

// ToolHandlerIface is the interface that individual tool implementations satisfy.
type ToolHandlerIface interface {
	// Handle executes the tool and returns a result, optional warnings, and any error.
	Handle(ctx context.Context, call MCPToolCall) (any, []string, error)
}

// ToolHandlerFuncAdapter adapts a function to the ToolHandlerIface interface.
type ToolHandlerFuncAdapter func(ctx context.Context, call MCPToolCall) (any, []string, error)

func (f ToolHandlerFuncAdapter) Handle(ctx context.Context, call MCPToolCall) (any, []string, error) {
	return f(ctx, call)
}

// SandboxRunner isolates tool execution in a restricted environment.
type SandboxRunner interface {
	// Run executes a tool in an isolated environment (Docker, gVisor, subprocess).
	Run(ctx context.Context, spec ToolSpec, call MCPToolCall) (any, []string, error)
}

// ConfirmationGate requires explicit human approval for destructive operations.
type ConfirmationGate interface {
	// Confirm requests human approval for a destructive tool call.
	// Returns nil if approved, error if denied or timed out.
	Confirm(ctx context.Context, spec ToolSpec, call MCPToolCall) error
}

// BoundaryGuardHook is the interface the cmmc.BoundaryGuard satisfies.
// Defined here as an interface to avoid an import cycle between pkg/mcp and pkg/cmmc.
type BoundaryGuardHook interface {
	// Check returns nil if the target is within the signed assessment boundary.
	// Returns cmmc.ErrOutOfScope (or a wrapping error) otherwise.
	Check(ctx context.Context, targetIP, targetHostname string) error
}

// Executor dispatches tool calls according to their risk classification.
type Executor struct {
	mu            sync.RWMutex
	handlers      map[string]ToolHandlerIface // In-process tool handlers (read-only + sandboxed wrappers)
	sandbox       SandboxRunner               // Sandbox backend for isolated execution
	confirm       ConfirmationGate            // Approval gate for destructive tools
	boundaryGuard BoundaryGuardHook           // Phase 03+ boundary enforcement (nil = unrestricted)
	logger        *log.Logger
}

// ExecutorConfig holds dependencies for constructing an Executor.
type ExecutorConfig struct {
	Sandbox SandboxRunner
	Confirm ConfirmationGate
	Logger  *log.Logger
}

// NewExecutor creates an Executor with the given sandbox and confirmation backends.
func NewExecutor(cfg ExecutorConfig) *Executor {
	logger := cfg.Logger
	if logger == nil {
		logger = log.Default()
	}
	return &Executor{
		handlers: make(map[string]ToolHandlerIface),
		sandbox:  cfg.Sandbox,
		confirm:  cfg.Confirm,
		logger:   logger,
	}
}

// RegisterHandler registers a tool handler for in-process execution.
func (e *Executor) RegisterHandler(toolName string, handler ToolHandlerIface) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.handlers[toolName] = handler
}

// RegisterFunc registers a function as a tool handler.
func (e *Executor) RegisterFunc(toolName string, fn func(ctx context.Context, call MCPToolCall) (any, []string, error)) {
	e.RegisterHandler(toolName, ToolHandlerFuncAdapter(fn))
}

// SetBoundaryGuard installs a BoundaryGuard. Once set, any tool call in
// boundaryScoped that targets an asset outside the signed boundary is rejected
// before the handler is invoked. Safe to call concurrently.
func (e *Executor) SetBoundaryGuard(guard BoundaryGuardHook) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.boundaryGuard = guard
}

// ClearBoundaryGuard removes the boundary enforcement (used when an engagement
// is completed or the approval is revoked).
func (e *Executor) ClearBoundaryGuard() {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.boundaryGuard = nil
}

// Execute dispatches a tool call based on its risk classification.
// This implements the ToolExecutor interface used by the Router.
func (e *Executor) Execute(ctx context.Context, spec ToolSpec, call MCPToolCall) (any, []string, error) {
	if spec.TimeoutMs > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, time.Duration(spec.TimeoutMs)*time.Millisecond)
		defer cancel()
	}

	// BoundaryGuard pre-flight: reject calls targeting out-of-scope assets.
	if boundaryScoped[spec.Name] {
		e.mu.RLock()
		guard := e.boundaryGuard
		e.mu.RUnlock()
		if guard != nil {
			targetIP, _ := call.Params["target_ip"].(string)
			targetHost, _ := call.Params["scan_target"].(string)
			if targetHost == "" {
				targetHost, _ = call.Params["target"].(string)
			}
			if err := guard.Check(ctx, targetIP, targetHost); err != nil {
				e.logger.Printf("[EXEC:BOUNDARY_BLOCKED] tool=%s target=%s/%s: %v",
					spec.Name, targetHost, targetIP, err)
				return nil, nil, fmt.Errorf("boundary enforcement: %w", err)
			}
		}
	}

	switch spec.RiskClass {
	case RiskReadOnly:
		return e.executeReadOnly(ctx, spec, call)
	case RiskSandboxed:
		return e.executeSandboxed(ctx, spec, call)
	case RiskDestructive:
		return e.executeDestructive(ctx, spec, call)
	default:
		return nil, nil, fmt.Errorf("mcp/executor: unknown risk class: %s", spec.RiskClass)
	}
}

// executeReadOnly runs the tool in-process. No isolation needed — these tools
// have no side effects and only read existing state.
func (e *Executor) executeReadOnly(ctx context.Context, spec ToolSpec, call MCPToolCall) (any, []string, error) {
	e.mu.RLock()
	handler, ok := e.handlers[spec.Name]
	e.mu.RUnlock()

	if !ok {
		return nil, nil, fmt.Errorf("mcp/executor: no handler registered for read-only tool %q", spec.Name)
	}

	e.logger.Printf("[EXEC:READ_ONLY] tool=%s agent=%s", spec.Name, call.Identity.AgentID)
	return handler.Handle(ctx, call)
}

// executeSandboxed runs the tool in an isolated environment with resource limits.
// Falls back to in-process handler if no sandbox runner is configured.
func (e *Executor) executeSandboxed(ctx context.Context, spec ToolSpec, call MCPToolCall) (any, []string, error) {
	if e.sandbox != nil && spec.AllowedBackend != "in-process" {
		e.logger.Printf("[EXEC:SANDBOX] tool=%s agent=%s backend=%s", spec.Name, call.Identity.AgentID, spec.AllowedBackend)
		result, warnings, err := e.sandbox.Run(ctx, spec, call)
		if err == nil {
			return result, warnings, nil
		}
		if os.Getenv("KHEPRA_MCP_STRICT_SANDBOX") == "true" {
			return nil, warnings, err
		}
		e.logger.Printf("[EXEC:SANDBOX_FALLBACK] tool=%s sandbox failed, attempting in-process fallback: %v", spec.Name, err)
	}

	e.mu.RLock()
	handler, ok := e.handlers[spec.Name]
	e.mu.RUnlock()

	if !ok {
		return nil, nil, fmt.Errorf("mcp/executor: no handler for sandboxed tool %q and no sandbox runner configured", spec.Name)
	}

	e.logger.Printf("[EXEC:SANDBOX_FALLBACK] tool=%s agent=%s (in-process, no sandbox available)", spec.Name, call.Identity.AgentID)
	warnings := []string{"sandbox unavailable: running in-process (reduced isolation)"}
	result, w, err := handler.Handle(ctx, call)
	if w != nil {
		warnings = append(warnings, w...)
	}
	return result, warnings, err
}

// executeDestructive requires explicit human confirmation before execution.
// The confirmation gate must approve the action; execution is DAG-attested.
func (e *Executor) executeDestructive(ctx context.Context, spec ToolSpec, call MCPToolCall) (any, []string, error) {
	if e.confirm == nil {
		return nil, nil, errors.New("mcp/executor: destructive tools require a ConfirmationGate — none configured")
	}

	e.logger.Printf("[EXEC:DESTRUCTIVE] tool=%s agent=%s — requesting confirmation", spec.Name, call.Identity.AgentID)

	if err := e.confirm.Confirm(ctx, spec, call); err != nil {
		e.logger.Printf("[EXEC:DESTRUCTIVE] tool=%s DENIED: %v", spec.Name, err)
		return nil, nil, fmt.Errorf("destructive operation denied: %w", err)
	}

	e.mu.RLock()
	handler, ok := e.handlers[spec.Name]
	e.mu.RUnlock()

	if !ok {
		return nil, nil, fmt.Errorf("mcp/executor: no handler registered for destructive tool %q", spec.Name)
	}

	e.logger.Printf("[EXEC:DESTRUCTIVE] tool=%s agent=%s — APPROVED, executing", spec.Name, call.Identity.AgentID)
	return handler.Handle(ctx, call)
}
