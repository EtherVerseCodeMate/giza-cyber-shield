// pkg/asaf/fleet/types.go — ASAF Stargate Fleet Data Types
//
// Defines the canonical structs for assets, enclaves, scan results, and SPRS
// scoring shared across the Hub REST API, Blackhole VPN, and khepra-reporter.
//
// IP: SecRed Knowledge Inc. / SOUHIMBOU DOH KONE LLC — USPTO #73565085

package fleet

import "time"

// AppMode describes how the ASAF client is connected to the backend.
type AppMode string

const (
	ModeStandalone   AppMode = "standalone"    // local pkg/stig, no Hub
	ModeConnected    AppMode = "connected"     // remote Stargate Hub via HTTPS
	ModeEmbeddedHub  AppMode = "embedded_hub"  // local Hub subprocess
)

// OS platform identifiers.
const (
	PlatformRHEL    = "rhel"
	PlatformWindows = "windows"
	PlatformUbuntu  = "ubuntu"
	PlatformGeneric = "generic"
	PlatformNetwork = "network" // firewall, switch, router (REST API only)
)

// AgentMode describes how the Hub reaches an asset.
const (
	AgentModeSSH      = "ssh"       // agentless SSH (Linux servers)
	AgentModeWinRM    = "winrm"     // agentless WinRM (Windows servers)
	AgentModeReporter = "reporter"  // khepra-reporter agent (workstations)
	AgentModeAPI      = "api"       // REST API (cloud resources, firewalls)
)

// ControlStatus represents the compliance state of a single STIG/CMMC control.
type ControlStatus string

const (
	ControlPassing  ControlStatus = "passing"
	ControlFailing  ControlStatus = "failing"
	ControlStaging  ControlStatus = "staging"   // remediation staged, not yet approved
	ControlAtRisk   ControlStatus = "at_risk"   // was passing, showing drift signals
	ControlUnknown  ControlStatus = "unknown"   // not yet scanned
)

// Asset represents a single device in the CUI boundary scope.
type Asset struct {
	ID           string    `json:"id"`             // UUID
	EnclaveID    string    `json:"enclave_id"`
	Hostname     string    `json:"hostname"`
	IP           string    `json:"ip"`
	OS           string    `json:"os"`             // PlatformRHEL / PlatformWindows / etc.
	OSVersion    string    `json:"os_version"`     // e.g. "RHEL 9.3", "Windows 11 23H2"
	STIGProfile  string    `json:"stig_profile"`   // e.g. "RHEL-09-STIG", "Windows-11-STIG"
	AgentMode    string    `json:"agent_mode"`     // AgentModeSSH / AgentModeReporter / etc.
	Tags         []string  `json:"tags,omitempty"` // e.g. ["CUI", "domain-joined"]
	EnrolledAt   time.Time `json:"enrolled_at"`
	LastSeen     time.Time `json:"last_seen"`
	LastScanAt   time.Time `json:"last_scan_at"`

	// Live compliance state (populated after scan)
	SPRSScore       int                      `json:"sprs_score"`
	PassingControls int                      `json:"passing_controls"`
	FailingControls int                      `json:"failing_controls"`
	Controls        map[string]ControlStatus `json:"controls,omitempty"` // controlID → status

	// Reporter enrollment (AgentModeReporter only)
	ReporterPubKey  []byte `json:"reporter_pub_key,omitempty"`  // ML-DSA-65 public key
	SessionKeyEnc   []byte `json:"session_key_enc,omitempty"`   // AES-256-GCM encrypted session key
}

// Enclave represents a CUI boundary — a logical group of in-scope assets.
type Enclave struct {
	ID          string    `json:"id"`          // UUID
	OrgID       string    `json:"org_id"`
	Name        string    `json:"name"`        // e.g. "CUI Production (VLAN 10)"
	CIDR        string    `json:"cidr"`        // e.g. "10.10.1.0/24"
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`

	// Aggregate compliance (computed from assets)
	AssetCount      int     `json:"asset_count"`
	SPRSScore       int     `json:"sprs_score"`        // fleet SPRS (not sum — unique practices)
	PassingPractices int    `json:"passing_practices"` // out of 110
	FailingPractices int    `json:"failing_practices"`
	DollarExposure  float64 `json:"dollar_exposure"`   // $ risk from Godfather synthesis
}

// ScanResult is the payload sent by khepra-reporter on each heartbeat,
// or returned by an agentless SSH/WinRM scan.
type ScanResult struct {
	AssetID    string    `json:"asset_id"`
	ScanID     string    `json:"scan_id"`    // UUID, unique per scan run
	ScannedAt  time.Time `json:"scanned_at"`
	STIGProfile string   `json:"stig_profile"`
	Duration   string    `json:"duration"`   // e.g. "4.2s"

	// Control-level results
	Controls []ControlResult `json:"controls"`

	// Summary
	Passing  int `json:"passing"`
	Failing  int `json:"failing"`
	Unknown  int `json:"unknown"`
	SPRS     int `json:"sprs"` // computed SPRS contribution from this asset

	// Reporter metadata (set by khepra-reporter, empty for agentless)
	ReporterVersion string `json:"reporter_version,omitempty"`
	Encrypted       bool   `json:"encrypted"` // true = payload was AES-256-GCM + ML-DSA-65

	// PQC attestation
	Signature []byte `json:"signature"` // ML-DSA-65 over canonical JSON (Signature=nil)
	Timestamp string `json:"timestamp"` // ISO-8601, included in signed bytes
}

// ControlResult is the result of checking one STIG/CMMC control.
type ControlResult struct {
	ControlID   string        `json:"control_id"`   // e.g. "AC-2", "V-230263"
	Title       string        `json:"title"`
	Status      ControlStatus `json:"status"`
	CCIS        []string      `json:"ccis,omitempty"`        // mapped CCI IDs
	NISTRefs    []string      `json:"nist_refs,omitempty"`   // NIST 800-53 refs
	CMMMCDomain string        `json:"cmmc_domain,omitempty"` // e.g. "AC"
	SPRSImpact  int           `json:"sprs_impact"`           // point impact on SPRS if failing
	Finding     string        `json:"finding,omitempty"`     // evidence text (what was checked)
	Remediation string        `json:"remediation,omitempty"` // suggested fix
}

// EnrollmentRequest is sent by khepra-reporter on first contact with the Hub.
type EnrollmentRequest struct {
	Hostname    string `json:"hostname"`
	IP          string `json:"ip"`
	OS          string `json:"os"`
	OSVersion   string `json:"os_version"`
	Platform    string `json:"platform"`

	// PQC keys generated by the reporter at first run
	ReporterPubKey []byte `json:"reporter_pub_key"` // ML-DSA-65 public key
	KyberPubKey    []byte `json:"kyber_pub_key"`    // ML-KEM-768 (Kyber-1024) public key

	// ML-DSA-65 signature over canonical enrollment payload
	Signature []byte `json:"signature"`
	Timestamp string `json:"timestamp"`
}

// EnrollmentResponse is returned by the Hub on successful enrollment.
type EnrollmentResponse struct {
	AssetID     string `json:"asset_id"`       // assigned UUID
	EnrolledAt  string `json:"enrolled_at"`    // ISO-8601
	STIGProfile string `json:"stig_profile"`   // assigned profile

	// Blackhole VPN session material
	KyberCiphertext []byte `json:"kyber_ciphertext"` // ML-KEM encapsulation (reporter decapsulates → shared secret)
	HubPubKey       []byte `json:"hub_pub_key"`      // Hub's ML-DSA-65 public key for verifying dispatches

	// ML-DSA-65 signature over canonical response (Hub signs with its private key)
	Signature []byte `json:"signature"`
	Timestamp string `json:"timestamp"`
}

// DispatchRequest is sent by the Hub to a khepra-reporter to execute a remediation.
// Encrypted with the asset's Blackhole VPN session key (AES-256-GCM).
// Contains an embedded daemon.ChangeRequest signed by KASA.
type DispatchRequest struct {
	AssetID         string `json:"asset_id"`
	EncryptedChange []byte `json:"encrypted_change"` // AES-256-GCM(sessionKey, ChangeRequest JSON)
	// ML-DSA-65 signature over (AssetID + EncryptedChange + Timestamp) by Hub key
	Signature []byte `json:"signature"`
	Timestamp string `json:"timestamp"`
}

// DispatchResult is returned by khepra-reporter after executing (or staging) a DispatchRequest.
type DispatchResult struct {
	AssetID   string `json:"asset_id"`
	RequestID string `json:"request_id"`
	Success   bool   `json:"success"`
	Stdout    string `json:"stdout,omitempty"`
	Stderr    string `json:"stderr,omitempty"`
	ExitCode  int    `json:"exit_code"`
	DAGNodeID string `json:"dag_node_id"` // attestation node written by Imhotep

	// Staging results (populated when staging=true)
	StagingID   string `json:"staging_id,omitempty"`
	StagingDiff string `json:"staging_diff,omitempty"`

	// ML-DSA-65 signature by the reporter's key
	Signature []byte `json:"signature"`
	Timestamp string `json:"timestamp"`
}

// PendingApproval represents a staged ChangeRequest awaiting CISO approval.
type PendingApproval struct {
	ID          string    `json:"id"`
	AssetID     string    `json:"asset_id"`
	Hostname    string    `json:"hostname"`
	ControlID   string    `json:"control_id"`
	Title       string    `json:"title"`
	Command     []string  `json:"command"`
	Symbol      string    `json:"symbol"`   // Adinkra symbol (e.g. "Eban")
	StagingID   string    `json:"staging_id"`
	StagingDiff string    `json:"staging_diff"`
	StagedAt    time.Time `json:"staged_at"`
	SignedBy    string    `json:"signed_by"` // KASA agent ID that created this
	SigVerified bool      `json:"sig_verified"` // Hub verified ML-DSA-65 ✅
}

// HealthResponse is returned by GET /health on both the Hub and khepra-reporter.
type HealthResponse struct {
	Status      string    `json:"status"`       // "healthy"
	Version     string    `json:"version"`
	Mode        string    `json:"mode"`         // KHEPRA_MODE value
	Time        time.Time `json:"time"`
	EnclaveCount int      `json:"enclave_count,omitempty"`
	AssetCount   int      `json:"asset_count,omitempty"`
}
