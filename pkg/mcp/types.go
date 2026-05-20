package mcp

// ToolRiskClass classifies a tool's potential for side effects.
// The risk class is declared in manifest.json and enforced by the Executor.
type ToolRiskClass string

const (
	// RiskReadOnly tools have no side effects. Executed in-process.
	RiskReadOnly ToolRiskClass = "read-only"

	// RiskSandboxed tools have bounded side effects and run in an isolated
	// environment (Docker / gVisor). Fall back to in-process if sandbox is
	// unavailable, unless KHEPRA_MCP_STRICT_SANDBOX=true.
	RiskSandboxed ToolRiskClass = "sandboxed"

	// RiskDestructive tools have irreversible side effects and require
	// explicit ConfirmationGate approval before execution.
	RiskDestructive ToolRiskClass = "destructive"
)

// ToolSpec is the runtime representation of a tool loaded from manifest.json.
// It extends the JSON-RPC Tool definition with execution metadata.
type ToolSpec struct {
	Name           string        `json:"name"`
	Description    string        `json:"description"`
	RiskClass      ToolRiskClass `json:"risk_class"`
	TimeoutMs      int64         `json:"timeout_ms,omitempty"`
	AllowedBackend string        `json:"allowed_backend,omitempty"` // "" | "in-process" | "docker"
}

// CallIdentity carries the authenticated caller context for an MCP tool call.
type CallIdentity struct {
	AgentID    string `json:"agent_id"`    // e.g. "claude", "cursor", "windsurf"
	SessionID  string `json:"session_id"`
	UserID     string `json:"user_id,omitempty"`
	SMARTRole  string `json:"smart_role,omitempty"` // Adinkra role (Dwennimmen, Eban, ...)
	DataClass  string `json:"data_class,omitempty"` // PUBLIC | CUI | CLASSIFIED
}

// MCPToolCall is the runtime envelope for a single tool invocation.
// Passed through the Executor chain; logged to mcp_tool_calls after execution.
type MCPToolCall struct {
	// ID is a per-call UUID, distinct from any DAG node ID.
	ID       string                 `json:"id"`
	Name     string                 `json:"name"`
	Params   map[string]interface{} `json:"params"`
	Identity CallIdentity           `json:"identity"`
}
