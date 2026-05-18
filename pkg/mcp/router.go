package mcp

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"time"
)

// ─── Security Boundary Interfaces ──────────────────────────────────────────────
//
// These interfaces are implemented by the existing Mitochondrial/Polymorphic/DEMARC
// stack. The MCP wrapper does NOT create new auth logic — it wires into these.

// DemarcGateway authenticates callers using PQC credentials and enforces
// network-level access control (CIDR allowlisting).
// Production impl: pkg/acp.AgentControlPlane (credential validation)
type DemarcGateway interface {
	// Authenticate resolves a credential (ZeroTrustToken, API key, etc.) into an Identity.
	Authenticate(ctx context.Context, cred any) (Identity, error)
	// CheckCIDR validates that the caller's remote address is within the allowed range.
	// For stdio transport, remoteAddr is "local" and always passes.
	CheckCIDR(ctx context.Context, id Identity, remoteAddr string) error
}

// PolymorphicEngine wraps and verifies requests/responses with provenance envelopes.
// Production impl: pkg/gateway or pkg/polymorphic (SecureEnvelope lifecycle)
type PolymorphicEngine interface {
	// WrapRequest seals the raw request payload with agent provenance metadata.
	WrapRequest(payload []byte, agentID string) ([]byte, error)
	// VerifyRequest validates a wrapped request's integrity and provenance.
	VerifyRequest(wrapped []byte) error
	// WrapResponse seals a tool result in a SecureEnvelope with PQC signature.
	WrapResponse(result any, requestID string) (SecureEnvelope, error)
	// VerifyResponse validates a SecureEnvelope's integrity.
	VerifyResponse(envelope SecureEnvelope) error
}

// MCPGateway enforces RBAC scope checks and scans for prompt injection in tool arguments.
type MCPGateway interface {
	// CheckPermission validates that the identity has the required scope for the tool.
	CheckPermission(id Identity, scope string) error
	// ScanForInjection checks raw input text for prompt injection patterns.
	ScanForInjection(text string) error
}

// Attestor records tool executions in the DAG audit chain with PQC signatures.
// Production impl: wrapper over pkg/dag.Store + pkg/adinkra.Sign
type Attestor interface {
	// Append records a tool execution in the DAG and returns the attestation node ID.
	Append(ctx context.Context, toolName string, input []byte, output []byte) (string, error)
	// SignEnvelope adds a PQC signature to the SecureEnvelope using the attestation key.
	SignEnvelope(ctx context.Context, env SecureEnvelope) (SecureEnvelope, error)
}

// ToolDispatcher dispatches tool calls according to their risk classification.
type ToolDispatcher interface {
	Execute(ctx context.Context, spec ToolSpec, call MCPToolCall) (any, []string, error)
}

// ─── Router (AD-010: The Orchestrator) ─────────────────────────────────────────
//
// The Router is the single admission control chain. The protocol NEVER reaches
// execution before identity and policy are fully resolved.
//
// Chain order (MUST NOT be reordered):
//   1. DEMARC boundary (authenticate + CIDR check)
//   2. Manifest lookup + schema pin validation
//   3. Polymorphic wrap + verify (provenance)
//   4. MCPGateway policy (RBAC + injection scan)
//   5. Risk-classified execution
//   6. Attestation + PQC seal

// Router orchestrates the full security chain for every tool call.
type Router struct {
	demarc   DemarcGateway
	poly     PolymorphicEngine
	gateway  MCPGateway
	registry *ManifestRegistry
	exec     ToolDispatcher
	attest   Attestor
	logger   *log.Logger
}

// RouterConfig holds all dependencies for constructing a Router.
type RouterConfig struct {
	Demarc   DemarcGateway
	Poly     PolymorphicEngine
	Gateway  MCPGateway
	Registry *ManifestRegistry
	Executor ToolDispatcher
	Attestor Attestor
	Logger   *log.Logger
}

// NewRouter creates a Router with all security chain components.
// All components are required — missing dependencies cause a fail-closed error.
func NewRouter(cfg RouterConfig) (*Router, error) {
	if cfg.Demarc == nil {
		return nil, errors.New("mcp/router: DemarcGateway is required")
	}
	if cfg.Poly == nil {
		return nil, errors.New("mcp/router: PolymorphicEngine is required")
	}
	if cfg.Gateway == nil {
		return nil, errors.New("mcp/router: MCPGateway is required")
	}
	if cfg.Registry == nil {
		return nil, errors.New("mcp/router: ManifestRegistry is required")
	}
	if cfg.Executor == nil {
		return nil, errors.New("mcp/router: ToolDispatcher is required")
	}
	if cfg.Attestor == nil {
		return nil, errors.New("mcp/router: Attestor is required")
	}
	logger := cfg.Logger
	if logger == nil {
		logger = log.Default()
	}
	return &Router{
		demarc:   cfg.Demarc,
		poly:     cfg.Poly,
		gateway:  cfg.Gateway,
		registry: cfg.Registry,
		exec:     cfg.Executor,
		attest:   cfg.Attestor,
		logger:   logger,
	}, nil
}

// HandleToolCall processes a single tool invocation through the full security chain.
//
// Chain:
//   DEMARC → Manifest → Polymorphic → MCPGateway → Executor → Attestation → Response
//
// Returns a fully sealed MCPToolResponse or a typed error.
func (r *Router) HandleToolCall(ctx context.Context, call MCPToolCall, cred any, remoteAddr string) (*MCPToolResponse, error) {
	start := time.Now()

	// ── Step 1: DEMARC Boundary ─────────────────────────────────────────────
	id, err := r.demarc.Authenticate(ctx, cred)
	if err != nil {
		r.logger.Printf("[MCP:DEMARC] auth failed for tool=%s: %v", call.ToolName, err)
		return nil, fmt.Errorf("authentication failed: %w", err)
	}
	if err := r.demarc.CheckCIDR(ctx, id, remoteAddr); err != nil {
		r.logger.Printf("[MCP:DEMARC] CIDR denied for agent=%s addr=%s: %v", id.AgentID, remoteAddr, err)
		return nil, fmt.Errorf("CIDR check failed: %w", err)
	}

	// Attach identity to the call for downstream use.
	call.Identity = id

	// ── Step 2: Manifest Lookup + Schema Pin Validation ────────────────────
	spec, ok := r.registry.GetTool(call.ToolName)
	if !ok {
		r.logger.Printf("[MCP:MANIFEST] unknown tool: %s (agent=%s)", call.ToolName, id.AgentID)
		return nil, fmt.Errorf("unknown tool: %s", call.ToolName)
	}
	if err := r.registry.ValidatePinnedSchema(spec.Name, spec.SchemaVersion, spec.SchemaHash); err != nil {
		r.logger.Printf("[MCP:MANIFEST] schema pin violation: %v", err)
		return nil, fmt.Errorf("schema pin violation: %w", err)
	}

	// ── Step 3: Polymorphic Wrap + Verify (Provenance) ─────────────────────
	rawPayload := call.RawPayload
	if rawPayload == nil {
		rawPayload, _ = json.Marshal(call.Args)
	}
	wrapped, err := r.poly.WrapRequest(rawPayload, id.AgentID)
	if err != nil {
		r.logger.Printf("[MCP:POLY] wrap request failed: %v", err)
		return nil, fmt.Errorf("polymorphic wrap failed: %w", err)
	}
	if err := r.poly.VerifyRequest(wrapped); err != nil {
		r.logger.Printf("[MCP:POLY] verify request failed: %v", err)
		return nil, fmt.Errorf("polymorphic verify failed: %w", err)
	}

	// ── Step 4: MCPGateway Policy (RBAC + Injection Scan) ──────────────────
	if err := r.gateway.CheckPermission(id, spec.Scope); err != nil {
		r.logger.Printf("[MCP:POLICY] permission denied: agent=%s scope=%s: %v", id.AgentID, spec.Scope, err)
		return nil, fmt.Errorf("permission denied: %w", err)
	}
	if err := r.gateway.ScanForInjection(string(rawPayload)); err != nil {
		r.logger.Printf("[MCP:POLICY] injection detected: agent=%s tool=%s: %v", id.AgentID, call.ToolName, err)
		return nil, fmt.Errorf("injection detected: %w", err)
	}

	// ── Step 5: Risk-Classified Execution ──────────────────────────────────
	result, warnings, err := r.exec.Execute(ctx, spec, call)
	if err != nil {
		r.logger.Printf("[MCP:EXEC] tool=%s failed: %v (duration=%v)", call.ToolName, err, time.Since(start))
		return &MCPToolResponse{
			IsError:      true,
			ErrorMessage: err.Error(),
			Warnings:     warnings,
		}, nil
	}

	// ── Step 6: Attestation + PQC Seal ─────────────────────────────────────
	// Wrap result in SecureEnvelope.
	env, err := r.poly.WrapResponse(result, call.RequestID)
	if err != nil {
		r.logger.Printf("[MCP:POLY] wrap response failed: %v", err)
		return nil, fmt.Errorf("response wrapping failed: %w", err)
	}

	// Record in DAG.
	outputBytes, _ := json.Marshal(result)
	attestationID, err := r.attest.Append(ctx, spec.Name, rawPayload, outputBytes)
	if err != nil {
		r.logger.Printf("[MCP:ATTEST] DAG append failed: %v", err)
		return nil, fmt.Errorf("attestation failed: %w", err)
	}
	env.AttestationID = attestationID

	// PQC-sign the envelope.
	signedEnv, err := r.attest.SignEnvelope(ctx, env)
	if err != nil {
		r.logger.Printf("[MCP:ATTEST] envelope signing failed: %v", err)
		return nil, fmt.Errorf("envelope signing failed: %w", err)
	}

	r.logger.Printf("[MCP:OK] tool=%s agent=%s attestation=%s duration=%v",
		call.ToolName, id.AgentID, attestationID, time.Since(start))

	return &MCPToolResponse{
		Envelope: signedEnv,
		Warnings: warnings,
	}, nil
}

// ListTools returns MCP-formatted tool definitions from the registry.
func (r *Router) ListTools() []map[string]any {
	specs := r.registry.ListTools()
	tools := make([]map[string]any, 0, len(specs))
	for _, s := range specs {
		tool := map[string]any{
			"name":        s.Name,
			"description": s.Description,
		}
		if s.ArgsSchema != nil {
			tool["inputSchema"] = s.ArgsSchema
		}
		tools = append(tools, tool)
	}
	return tools
}
