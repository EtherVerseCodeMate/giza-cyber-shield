// Package mcp implements the Hardened MCP Wrapper for the Khepra Protocol.
//
// Architecture: AD-006 — MCP extends the Mitochondrial/Polymorphic/DEMARC stack.
// This is NOT a separate service. It operates inside the existing security boundary.
//
// Trust chain:  DEMARCGateway → PolymorphicEngine → MCPGateway → Executor → Attestation
// Trust roots:  pkg/adinkra (PQC/Crypto), pkg/dag (Audit), pkg/acp (Credentials)
//
// All tool responses are PQC-signed and DAG-anchored. All tool schemas are
// pinned via signed manifest with fail-closed startup verification.
package mcp

import (
	"encoding/json"
	"time"
)

// ─── Transport ─────────────────────────────────────────────────────────────────

// TransportMode selects the communication channel between client and server.
type TransportMode string

const (
	// TransportStdio is the default and recommended transport (AD-008).
	// stdout = JSON-RPC frames only. stderr = human-readable logs.
	TransportStdio TransportMode = "stdio"
	// TransportHTTP enables remote access via HTTP/SSE (requires additional hardening).
	TransportHTTP TransportMode = "http"
)

// ─── Risk Classification (AD-009) ──────────────────────────────────────────────

// ToolRiskClass controls execution isolation per-tool.
type ToolRiskClass string

const (
	// RiskReadOnly tools run in-process with no side effects.
	RiskReadOnly ToolRiskClass = "read_only"
	// RiskSandboxed tools run in isolated environments (Docker/gVisor/subprocess).
	RiskSandboxed ToolRiskClass = "sandboxed"
	// RiskDestructive tools require explicit human confirmation and DAG attestation.
	RiskDestructive ToolRiskClass = "destructive"
)

// ─── Identity ──────────────────────────────────────────────────────────────────

// Identity is the authenticated caller context, resolved by DEMARCGateway.
type Identity struct {
	Subject   string   `json:"subject"`
	Issuer    string   `json:"issuer"`
	Audience  string   `json:"audience"`
	Scopes    []string `json:"scopes"`
	AgentID   string   `json:"agent_id"`
	SessionID string   `json:"session_id"`
	Roles     []string `json:"roles,omitempty"`
	LicenseID string   `json:"license_id,omitempty"`
}

// HasScope returns true if the identity has been granted the given scope.
func (id Identity) HasScope(scope string) bool {
	for _, s := range id.Scopes {
		if s == scope || s == "*" {
			return true
		}
	}
	return false
}

// ─── Tool Specification ────────────────────────────────────────────────────────

// ToolSpec defines a single MCP tool from the signed manifest.
type ToolSpec struct {
	Name             string         `json:"name"`
	Description      string         `json:"description"`
	RiskClass        ToolRiskClass  `json:"risk_class"`
	Scope            string         `json:"scope"`
	SchemaVersion    string         `json:"schema_version"`
	SchemaHash       string         `json:"schema_hash"`
	AllowedBackend   string         `json:"allowed_backend"`
	TimeoutMs        int            `json:"timeout_ms"`
	NetworkAllowed   bool           `json:"network_allowed"`
	Destructive      bool           `json:"destructive"`
	ArgsSchema       map[string]any `json:"args_schema,omitempty"`
	Meta             map[string]any `json:"meta,omitempty"`
	CapabilityMounts []string       `json:"capability_mounts,omitempty"`
	MaxPrivilege     string         `json:"max_privilege,omitempty"`
}

// ─── Signed Tool Manifest (AD-007) ─────────────────────────────────────────────

// SignedToolManifest is the cryptographically sealed tool registry.
type SignedToolManifest struct {
	Version       string     `json:"version"`
	Revision      string     `json:"revision"`
	GeneratedAt   time.Time  `json:"generated_at"`
	HashAlgorithm string     `json:"hash_algorithm"`
	PublicKeyID   string     `json:"public_key_id"`
	Signature     string     `json:"signature"`
	Tools         []ToolSpec `json:"tools"`
}

// ─── MCP Tool Call ─────────────────────────────────────────────────────────────

// MCPToolCall represents an incoming tool invocation request.
type MCPToolCall struct {
	RequestID       string          `json:"request_id"`
	ToolName        string          `json:"tool_name"`
	Args            map[string]any  `json:"args"`
	RawPayload      json.RawMessage `json:"raw_payload"`
	Identity        Identity        `json:"identity"`
	Transport       TransportMode   `json:"transport"`
	SubmittedAt     time.Time       `json:"submitted_at"`
	InvocationToken *InvocationToken `json:"invocation_token,omitempty"`
}

// ─── Secure Envelope ───────────────────────────────────────────────────────────

// SecureEnvelope wraps every tool response with PQC attestation.
type SecureEnvelope struct {
	RequestID     string    `json:"request_id"`
	ToolName      string    `json:"tool_name"`
	Result        any       `json:"result"`
	AttestationID string    `json:"attestation_id"`
	Signature     string    `json:"signature"`
	CreatedAt     time.Time `json:"created_at"`
	SchemaVersion string    `json:"schema_version"`
	Provenance    string    `json:"provenance,omitempty"`
}

// ─── MCP Tool Response ─────────────────────────────────────────────────────────

// MCPToolResponse is the final response returned to the MCP client.
// KhepraSign (_khepra_sig) provides wire-level ML-DSA-65 message integrity per
// NSA MCP Security Design Considerations: unsigned JSON-RPC responses are the
// primary attack surface.
type MCPToolResponse struct {
	Envelope     SecureEnvelope `json:"envelope"`
	Warnings     []string       `json:"warnings,omitempty"`
	IsError      bool           `json:"is_error,omitempty"`
	ErrorMessage string         `json:"error_message,omitempty"`
	KhepraSign   string         `json:"_khepra_sig,omitempty"`
}

// ─── Structured Tool Result ────────────────────────────────────────────────────

// HardenedToolResult is the structured output of every hardened tool execution.
type HardenedToolResult struct {
	Success     bool     `json:"success"`
	Data        any      `json:"data,omitempty"`
	Error       string   `json:"error,omitempty"`
	IsError     bool     `json:"is_error"`
	Recoverable bool     `json:"recoverable"`
	Code        string   `json:"code,omitempty"`
	Warnings    []string `json:"warnings,omitempty"`
}

func NewSuccessResult(data any, warnings ...string) *HardenedToolResult {
	return &HardenedToolResult{Success: true, Data: data, Warnings: warnings}
}

func NewErrorResult(code, msg string) *HardenedToolResult {
	return &HardenedToolResult{IsError: true, Recoverable: true, Error: msg, Code: code}
}

func NewFatalResult(code, msg string) *HardenedToolResult {
	return &HardenedToolResult{IsError: false, Recoverable: false, Error: msg, Code: code}
}

// ─── JSON-RPC 2.0 Wire Types ──────────────────────────────────────────────────

type JSONRPCRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      any             `json:"id"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

type JSONRPCResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      any             `json:"id"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *JSONRPCError   `json:"error,omitempty"`
}

type JSONRPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    any    `json:"data,omitempty"`
}

const (
	ErrCodeParseError        = -32700
	ErrCodeInvalidRequest    = -32600
	ErrCodeMethodNotFound    = -32601
	ErrCodeInvalidParams     = -32602
	ErrCodeInternal          = -32603
	ErrCodeAuthFailed        = -32000
	ErrCodePolicyDenied      = -32001
	ErrCodeManifestFailed    = -32002
	ErrCodeSandboxFailed     = -32003
	ErrCodeAttestFailed      = -32004
	ErrCodeToolTimeout       = -32005
	ErrCodeRateLimitExceeded = -32006
)

// ─── Server Capabilities ───────────────────────────────────────────────────────

type ServerInfo struct {
	Name            string       `json:"name"`
	Version         string       `json:"version"`
	ProtocolVersion string       `json:"protocolVersion"`
	Capabilities    Capabilities `json:"capabilities"`
}

type Capabilities struct {
	Tools     *ToolsCapability     `json:"tools,omitempty"`
	Resources *ResourcesCapability `json:"resources,omitempty"`
}

type ToolsCapability struct {
	ListChanged bool `json:"listChanged,omitempty"`
}

type ResourcesCapability struct {
	Subscribe   bool `json:"subscribe,omitempty"`
	ListChanged bool `json:"listChanged,omitempty"`
}
