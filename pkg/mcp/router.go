package mcp

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"time"

	"golang.org/x/crypto/sha3"
)

// DemarcGateway authenticates callers using PQC credentials.
type DemarcGateway interface {
	Authenticate(ctx context.Context, cred any) (Identity, error)
	CheckCIDR(ctx context.Context, id Identity, remoteAddr string) error
}

// PolymorphicEngine wraps and verifies requests/responses with provenance envelopes.
type PolymorphicEngine interface {
	WrapRequest(payload []byte, agentID string) ([]byte, error)
	VerifyRequest(wrapped []byte) error
	WrapResponse(result any, requestID string) (SecureEnvelope, error)
	VerifyResponse(envelope SecureEnvelope) error
}

// MCPGateway enforces RBAC scope checks and scans for prompt injection.
type MCPGateway interface {
	CheckPermission(id Identity, scope string) error
	ScanForInjection(text string) error
}

// Attestor records tool executions in the DAG audit chain with PQC signatures.
type Attestor interface {
	Append(ctx context.Context, toolName string, input []byte, output []byte) (string, error)
	SignEnvelope(ctx context.Context, env SecureEnvelope) (SecureEnvelope, error)
}

// ToolDispatcher dispatches tool calls according to their risk classification.
type ToolDispatcher interface {
	Execute(ctx context.Context, spec ToolSpec, call MCPToolCall) (any, []string, error)
}

// Router orchestrates the full security chain for every tool call.
//
// Chain order (MUST NOT be reordered):
//   1. DEMARC boundary (authenticate + CIDR check)
//   2. Rate limiting
//   3. Input validation + scope taxonomy
//   4. Loop detection
//   5. Per-invocation ephemeral credential
//   6. Manifest lookup + schema pin
//   7. Polymorphic wrap + verify
//   8. MCPGateway policy (RBAC + injection scan)
//   9. Risk-classified execution + attestation + PQC seal
type Router struct {
	demarc            DemarcGateway
	poly              PolymorphicEngine
	gateway           MCPGateway
	registry          *ManifestRegistry
	exec              ToolDispatcher
	attest            Attestor
	logger            *log.Logger
	events            *EventEmitter
	mistakes          *MistakeTracker
	limiter           *RateLimiter
	concurrency       *ConcurrencyLimiter
	invocationRootKey []byte
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

	Events            *EventEmitter
	MistakeConfig     MistakeTrackerConfig
	RateWindow        int64
	RateMax           int
	MaxConcurrent     int
	SignedAuditLog    *SignedAuditLog
	InvocationRootKey []byte
}

// NewRouter creates a Router with all security chain components.
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

	events := cfg.Events
	if events == nil {
		events = NewEventEmitter(EventEmitterConfig{
			Logger:    logger,
			SignedLog: cfg.SignedAuditLog,
		})
	} else if cfg.SignedAuditLog != nil && events.SignedLog == nil {
		events.SignedLog = cfg.SignedAuditLog
	}

	mistakes := NewMistakeTracker(cfg.MistakeConfig)

	rateWindow := cfg.RateWindow
	if rateWindow <= 0 {
		rateWindow = 60000
	}
	rateMax := cfg.RateMax
	if rateMax <= 0 {
		rateMax = 100
	}
	limiter := NewRateLimiter(rateWindow, rateMax)

	events.Emit(MCPEvent{Type: EventStartup, Success: true, Metadata: map[string]any{
		"tools":      cfg.Registry.ToolCount(),
		"version":    cfg.Registry.Version(),
		"rate_limit": fmt.Sprintf("%d/%dms", rateMax, rateWindow),
	}})

	return &Router{
		demarc:            cfg.Demarc,
		poly:              cfg.Poly,
		gateway:           cfg.Gateway,
		registry:          cfg.Registry,
		exec:              cfg.Executor,
		attest:            cfg.Attestor,
		logger:            logger,
		events:            events,
		mistakes:          mistakes,
		limiter:           limiter,
		concurrency:       NewConcurrencyLimiter(cfg.MaxConcurrent),
		invocationRootKey: cfg.InvocationRootKey,
	}, nil
}

// HandleToolCall processes a single tool invocation through the full security chain.
func (r *Router) HandleToolCall(ctx context.Context, call MCPToolCall, cred any, remoteAddr string) (*MCPToolResponse, error) {
	start := time.Now()

	// Step 1: DEMARC
	id, err := r.demarc.Authenticate(ctx, cred)
	if err != nil {
		r.events.EmitError(EventAuth, call.ToolName, "", "AUTH_FAILED", err.Error())
		return nil, fmt.Errorf("authentication failed: %w", err)
	}
	if err := r.demarc.CheckCIDR(ctx, id, remoteAddr); err != nil {
		r.events.EmitError(EventAuth, call.ToolName, id.AgentID, "CIDR_DENIED", err.Error())
		return nil, fmt.Errorf("CIDR check failed: %w", err)
	}
	call.Identity = id

	// Step 2: Rate limiting
	if rlErr := r.limiter.Allow(id.AgentID); rlErr != nil {
		r.events.EmitError(EventRateLimit, call.ToolName, id.AgentID, rlErr.Code, rlErr.Message)
		return &MCPToolResponse{IsError: true, ErrorMessage: rlErr.Message}, nil
	}

	// Step 3: Input validation + scope taxonomy
	if valErr := ValidateToolArgs(call.Args); valErr != nil {
		r.events.EmitError(EventPolicy, call.ToolName, id.AgentID, valErr.Code, valErr.Message)
		return &MCPToolResponse{IsError: true, ErrorMessage: valErr.Error()}, nil
	}
	if scopeErr := ValidateScopedToolArgs(call.Args, call.ToolName); scopeErr != nil {
		r.events.EmitError(EventPolicy, call.ToolName, id.AgentID, scopeErr.Code, scopeErr.Message)
		return &MCPToolResponse{IsError: true, ErrorMessage: scopeErr.Error()}, nil
	}

	// Step 4: Loop detection
	argsFingerprint := fmt.Sprintf("%v", call.Args)
	if loopErr := r.mistakes.CheckLoop(id.AgentID, call.ToolName, argsFingerprint); loopErr != nil {
		r.events.EmitError(EventLoopDetected, call.ToolName, id.AgentID, loopErr.Code, loopErr.Message)
		return &MCPToolResponse{IsError: true, ErrorMessage: loopErr.Message}, nil
	}

	// Step 5: Per-invocation ephemeral credential (ASD/CISA requirement)
	if len(r.invocationRootKey) > 0 {
		profile, _ := call.Args["profile"].(string)
		if profile == "" {
			profile, _ = call.Args["framework"].(string)
		}
		target, _ := call.Args["target"].(string)
		tok, tokErr := IssueInvocationToken(r.invocationRootKey, id.AgentID, call.ToolName, profile, target)
		if tokErr != nil {
			r.events.EmitError(EventAuth, call.ToolName, id.AgentID, "INVOCATION_TOKEN_FAILED", tokErr.Error())
			return nil, fmt.Errorf("invocation token issuance failed: %w", tokErr)
		}
		call.InvocationToken = tok
	}

	// Step 6: Manifest lookup + schema pin
	spec, ok := r.registry.GetTool(call.ToolName)
	if !ok {
		r.events.EmitError(EventManifest, call.ToolName, id.AgentID, "UNKNOWN_TOOL", "not in manifest")
		return nil, fmt.Errorf("unknown tool: %s", call.ToolName)
	}
	if err := r.registry.ValidatePinnedSchema(spec.Name, spec.SchemaVersion, spec.SchemaHash); err != nil {
		r.events.EmitError(EventManifest, call.ToolName, id.AgentID, "SCHEMA_PIN", err.Error())
		return nil, fmt.Errorf("schema pin violation: %w", err)
	}

	// Step 7: Polymorphic wrap + verify
	rawPayload := call.RawPayload
	if rawPayload == nil {
		rawPayload, _ = json.Marshal(call.Args)
	}
	wrapped, err := r.poly.WrapRequest(rawPayload, id.AgentID)
	if err != nil {
		r.events.EmitError(EventPoly, call.ToolName, id.AgentID, "WRAP_FAILED", err.Error())
		return nil, fmt.Errorf("polymorphic wrap failed: %w", err)
	}
	if err := r.poly.VerifyRequest(wrapped); err != nil {
		r.events.EmitError(EventPoly, call.ToolName, id.AgentID, "VERIFY_FAILED", err.Error())
		return nil, fmt.Errorf("polymorphic verify failed: %w", err)
	}

	// Step 8: MCPGateway policy (RBAC + injection scan)
	if err := r.gateway.CheckPermission(id, spec.Scope); err != nil {
		r.events.EmitError(EventPolicy, call.ToolName, id.AgentID, "PERMISSION_DENIED", err.Error())
		return nil, fmt.Errorf("permission denied: %w", err)
	}
	if err := r.gateway.ScanForInjection(string(rawPayload)); err != nil {
		r.events.EmitError(EventPolicy, call.ToolName, id.AgentID, "INJECTION", err.Error())
		return nil, fmt.Errorf("injection detected: %w", err)
	}

	// Step 9: Execution + attestation
	if concErr := r.concurrency.Acquire(id.AgentID); concErr != nil {
		r.events.EmitError(EventRateLimit, call.ToolName, id.AgentID, concErr.Code, concErr.Message)
		return &MCPToolResponse{IsError: true, ErrorMessage: concErr.Message}, nil
	}
	defer r.concurrency.Release(id.AgentID)

	r.events.EmitToolStart(call.ToolName, id.AgentID, call.RequestID, string(spec.RiskClass))

	result, warnings, execErr := r.exec.Execute(ctx, spec, call)
	durationMs := time.Since(start).Milliseconds()

	if execErr != nil {
		if mistakeErr := r.mistakes.RecordError(id.AgentID); mistakeErr != nil {
			r.events.EmitError(EventError, call.ToolName, id.AgentID, mistakeErr.Code, mistakeErr.Message)
			return &MCPToolResponse{IsError: true, ErrorMessage: mistakeErr.Message}, nil
		}
		r.events.EmitToolEnd(call.ToolName, id.AgentID, call.RequestID, durationMs, false, "EXEC_ERROR", execErr.Error())
		return &MCPToolResponse{IsError: true, ErrorMessage: execErr.Error(), Warnings: warnings}, nil
	}

	r.mistakes.RecordSuccess(id.AgentID)

	env, err := r.poly.WrapResponse(result, call.RequestID)
	if err != nil {
		r.events.EmitError(EventAttest, call.ToolName, id.AgentID, "WRAP_RESP_FAILED", err.Error())
		return nil, fmt.Errorf("response wrapping failed: %w", err)
	}

	outputBytes, _ := json.Marshal(result)
	attestationID, err := r.attest.Append(ctx, spec.Name, rawPayload, outputBytes)
	if err != nil {
		r.events.EmitError(EventAttest, call.ToolName, id.AgentID, "DAG_APPEND_FAILED", err.Error())
		return nil, fmt.Errorf("attestation failed: %w", err)
	}
	env.AttestationID = attestationID

	signedEnv, err := r.attest.SignEnvelope(ctx, env)
	if err != nil {
		r.events.EmitError(EventAttest, call.ToolName, id.AgentID, "SIGN_FAILED", err.Error())
		return nil, fmt.Errorf("envelope signing failed: %w", err)
	}

	r.events.EmitToolEnd(call.ToolName, id.AgentID, call.RequestID, durationMs, true, "", "")

	resp := &MCPToolResponse{
		Envelope: signedEnv,
		Warnings: warnings,
	}

	// Wire-level _khepra_sig (NSA message integrity)
	if len(r.invocationRootKey) > 0 {
		respBody, marshalErr := json.Marshal(resp)
		if marshalErr == nil {
			digest := sha3digestRouter(respBody)
			sig := hmacSHA256(r.invocationRootKey, digest)
			resp.KhepraSign = hex.EncodeToString(sig)
		}
	}

	return resp, nil
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

// Events returns the event emitter for external access.
func (r *Router) Events() *EventEmitter {
	return r.events
}

func sha3digestRouter(data []byte) []byte {
	h := sha3.New256()
	h.Write(data)
	return h.Sum(nil)
}

func hmacSHA256(key, data []byte) []byte {
	mac := hmac.New(sha256.New, key)
	mac.Write(data)
	return mac.Sum(nil)
}

var _ = hex.EncodeToString // suppress unused import
