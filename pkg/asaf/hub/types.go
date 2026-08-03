// package hub defines the Backend interface and supporting types for the
// AdinKhepra ASAF desktop client.  Three concrete implementations exist:
//
//   - LocalBackend  — ModeStandalone: stig.Validator + Imhotep Unix socket
//   - HubClient     — ModeConnected: remote Stargate Hub via HTTPS REST
//   - HubClient(embedded) — ModeEmbeddedHub: Hub spawned as subprocess on localhost
//
// All Fyne views (app/views/*.go) accept only the Backend interface; they never
// import a concrete type.  This allows identical view code in all three modes.
package hub

import (
	"context"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/asaf/connector"
)

// Re-export connector types used in the Backend interface so callers
// only need to import "pkg/asaf/hub" rather than both hub and connector.
type (
	ConnectorConfig  = connector.ConnectorConfig
	ConnectorCred    = connector.Credential
	TestResult       = connector.TestResult
	DiscoveredHost   = connector.DiscoveredHost
	CSVAssetRow      = connector.CSVAssetRow
	ImportResult     = connector.ImportResult
)

// AddAssetRequest holds the fields needed to enroll a new asset into the fleet.
type AddAssetRequest struct {
	EnclaveID   string `json:"enclave_id"`
	Hostname    string `json:"hostname"`
	IPAddress   string `json:"ip_address"`
	OS          string `json:"os"`
	STIGProfile string `json:"stig_profile"`
	ConnectorID string `json:"connector_id,omitempty"` // link to a saved ConnectorConfig
}

// DiscoveryOptions controls subnet discovery behavior.
type DiscoveryOptions struct {
	Timeout  time.Duration `json:"timeout_ms"`
	MaxHosts int           `json:"max_hosts"`
	Ports    []int         `json:"ports,omitempty"`
}

// AppMode identifies the operating mode selected at startup.
type AppMode uint8

const (
	// ModeStandalone — local daemon only, no network.
	// All compliance logic runs on the local machine using the embedded STIG DB.
	ModeStandalone AppMode = iota

	// ModeConnected — remote Stargate Hub via HTTPS.
	// Launched with --hub https://asaf.company.com:8443.
	ModeConnected

	// ModeEmbeddedHub — Hub spawned as a subprocess on localhost.
	// Launched with --embed-hub; behaves like ModeConnected against localhost.
	ModeEmbeddedHub
)

// String returns the user-facing mode display name.
func (m AppMode) String() string {
	switch m {
	case ModeStandalone:
		return "Standalone"
	case ModeConnected:
		return "Connected"
	case ModeEmbeddedHub:
		return "Embedded Hub"
	}
	return "Unknown"
}

// Enclave is a network boundary unit — one CUI boundary with one or more assets.
// The SecureCRT tree root: Organization → Enclaves → Assets.
type Enclave struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	OrgName     string    `json:"org_name,omitempty"`
	VLAN        string    `json:"vlan,omitempty"`
	Description string    `json:"description,omitempty"`
	AssetCount  int       `json:"asset_count"`
	SPRSScore   int       `json:"sprs_score"`    // aggregate SPRS for this enclave
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// Asset is one enrolled endpoint (server, workstation, network device) in a fleet enclave.
type Asset struct {
	ID          string    `json:"id"`
	EnclaveID   string    `json:"enclave_id"`
	Hostname    string    `json:"hostname"`
	IPAddress   string    `json:"ip_address"`
	OS          string    `json:"os"`           // "RHEL 9", "Windows 11", …
	STIGProfile string    `json:"stig_profile"` // "RHEL-09 STIG Rev 2", …
	SPRSScore   int       `json:"sprs_score"`
	LastScan    time.Time `json:"last_scan"`
	Online      bool      `json:"online"`
}

// SPRSResult is the computed SPRS score for an enclave, including domain breakdown.
type SPRSResult struct {
	EnclaveID      string             `json:"enclave_id"`
	Score          int                `json:"sprs_score"`      // 0–110 (starts at 110, deduct per failing practice)
	PassingCount   int                `json:"passing_count"`   // practices Met
	FailingCount   int                `json:"failing_count"`   // practices Not Met
	DollarExposure float64            `json:"dollar_exposure"` // business risk from Godfather synthesis
	ComputedAt     time.Time          `json:"computed_at"`
	DomainScores   map[string]float64 `json:"domain_scores"` // "AC"→0.84, "AT"→1.0, …
}

// KASAStatus is the live state of the KASA (Khepra Agentic Security Auditor) engine.
type KASAStatus struct {
	Active      bool      `json:"active"`
	Mode        string    `json:"mode"`         // "auditor", "remediation", "paused"
	CurrentTask string    `json:"current_task"`
	LastScan    time.Time `json:"last_scan"`
	NextScan    time.Time `json:"next_scan"`
	LLMProvider string    `json:"llm_provider"` // "ollama/llama3.1:8b", "anthropic/claude-sonnet-5", …
	// EA (Evolutionary Algorithm) engine state
	EAGeneration int     `json:"ea_generation"`
	EABestFit    float64 `json:"ea_best_fitness"`
}

// PendingChange is a ChangeRequest that has been staged and is awaiting CISO approval.
// Displayed in Tab 5 (Remediation) as the approval queue.
type PendingChange struct {
	ID         string    `json:"id"`
	ControlID  string    `json:"control_id"` // STIG rule ID or CMMC practice
	Hostname   string    `json:"hostname"`
	Command    []string  `json:"command"`     // argv — no shell, no metacharacters
	Symbol     string    `json:"symbol"`      // Adinkra symbol (internal; UI §10: "Authorization Level")
	StagedAt   time.Time `json:"staged_at"`
	StagedDiff string    `json:"staged_diff"` // before/after state captured by staging run
	StagedOK   bool      `json:"staged_ok"`   // staging container succeeded
	SignedBy   string    `json:"signed_by"`   // agent identity that submitted the request
	Signature  []byte    `json:"signature"`   // ML-DSA-65 signature
}

// DAGNode is one vertex in the compliance attestation chain.
// JSON-compatible with pkg/dag.Node so both local and Hub DAGs can be displayed
// in the same Tab 7 (Evidence) timeline view.
type DAGNode struct {
	ID        string            `json:"id"`
	Parents   []string          `json:"parents"`
	Action    string            `json:"action"`
	Symbol    string            `json:"symbol"`
	Time      string            `json:"time"`
	PQC       map[string]string `json:"pqc_metadata,omitempty"`
	Hash      string            `json:"hash"`
	Signature string            `json:"signature,omitempty"`
}

// AskResponse is the Hub's /api/v1/mcp/ask response — the same as intelligence
// or a local AI answer, depending on mode.
type AskResponse struct {
	Answer      string   `json:"answer"`
	ToolsCalled []string `json:"tools_called"`
	SessionID   string   `json:"session_id,omitempty"`
}

// HealthResponse is the /health endpoint response.
type HealthResponse struct {
	Status       string `json:"status"`        // "ok"
	Version      string `json:"version"`
	EnclaveCount int    `json:"enclave_count"`
	AssetCount   int    `json:"asset_count"`
	DAGNodeCount int    `json:"dag_node_count"`
}

// KASAEvent is one real-time event from the KASA SSE stream.
// Used by Tab 6 (Readiness) live feed and Tab 5 (Remediation) execution stream.
type KASAEvent struct {
	Type      string    `json:"type"`       // "scan_started","finding","remediation_staged","scan_complete","error"
	Message   string    `json:"message"`
	AssetID   string    `json:"asset_id,omitempty"`
	Hostname  string    `json:"hostname,omitempty"`
	ControlID string    `json:"control_id,omitempty"`
	Timestamp time.Time `json:"timestamp"`
}

// AIMessage is a single chat turn passed to AIProviderBridge.
type AIMessage struct {
	Role    string // "user" | "assistant" | "system"
	Content string
}

// AIProviderBridge is a minimal interface for passing an AI provider into
// LocalBackend without importing intelligence (avoids circular dependency).
// Implemented by ollamaBridge in cmd/asaf-desktop/main.go.
type AIProviderBridge interface {
	Chat(messages []AIMessage, stream bool) (string, error)
	// ChatCtx is like Chat but honours the caller's context deadline.
	// Implementations MUST pass ctx to all downstream HTTP requests.
	ChatCtx(ctx context.Context, messages []AIMessage, stream bool) (string, error)
	Name() string
}
