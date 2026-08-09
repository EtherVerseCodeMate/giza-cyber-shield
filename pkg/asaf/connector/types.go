// Package connector — Omnipotent Polymorphic API Connector engine.
//
// Implements the 4 fleet enrollment modes from the ASAF Stargate architecture spec:
//
//	Mode A: SubnetConnector  — CIDR discovery via port scan (nmap or fallback)
//	Mode B: CSVImporter      — bulk CSV enroll with column mapper
//	Mode C: AWSConnector     — AWS GovCloud EC2 asset pull (read-only IAM role)
//	      : AzureConnector   — Azure Gov VM list (service principal, read-only)
//	Mode D: SSHConnector     — direct dial + OS fingerprint + TOFU host key
//	      : WinRMConnector   — WinRM 5985/5986 dial + OS fingerprint
//
// All connectors implement the Connector interface. Credentials are stored by
// reference (CredRef → ID in ConnectorRegistry vault, AES-256-GCM encrypted).
//
// Copyright: SOUHIMBOU DOH KONE LLC — exclusively licensed to SecRed Knowledge Inc.
// Patent Pending: USPTO #73565085
package connector

import (
	"context"
	"time"
)

// ConnectorProtocol is the transport used to reach an asset.
type ConnectorProtocol string

const (
	ProtoSSH   ConnectorProtocol = "ssh"
	ProtoWinRM ConnectorProtocol = "winrm"
	ProtoREST  ConnectorProtocol = "rest"
	ProtoAWS   ConnectorProtocol = "aws"
	ProtoAzure ConnectorProtocol = "azure"
	ProtoNmap  ConnectorProtocol = "nmap" // discovery-only, not management
	ProtoCSV   ConnectorProtocol = "csv"  // import-only
)

// Connector is the interface all connection backends implement.
type Connector interface {
	Protocol() ConnectorProtocol

	// Test validates connectivity and authentication, returning OS fingerprint.
	// Used by Mode D "Test Connection" button before enrolling.
	Test(ctx context.Context) (*TestResult, error)

	// Discover enumerates reachable hosts. Used by Mode A and Mode C.
	// Returns a channel — caller reads until channel is closed or ctx cancelled.
	Discover(ctx context.Context) (<-chan DiscoveredHost, error)
}

// TestResult is the result of a Test() call.
type TestResult struct {
	Success     bool          `json:"success"`
	Latency     time.Duration `json:"latency_ms"`
	RemoteOS    string        `json:"remote_os,omitempty"`
	STIGProfile string        `json:"stig_profile,omitempty"`
	HostKey     string        `json:"host_key_fp,omitempty"` // SSH TOFU fingerprint
	Message     string        `json:"message"`
}

// DiscoveredHost is one host found during subnet or cloud discovery.
type DiscoveredHost struct {
	IP          string   `json:"ip"`
	Hostname    string   `json:"hostname,omitempty"`
	OpenPorts   []int    `json:"open_ports,omitempty"`
	OS          string   `json:"os,omitempty"`
	STIGProfile string   `json:"stig_profile,omitempty"` // auto-detected
	Services    []string `json:"services,omitempty"`
	RiskScore   int      `json:"risk_score"`
	Reachable   bool     `json:"reachable"`
}

// ConnectorConfig is a saved connection template.
// Persisted in ~/.khepra/connectors.json; credentials stored encrypted via CredRef.
type ConnectorConfig struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Protocol    ConnectorProtocol `json:"protocol"`
	Host        string            `json:"host,omitempty"`       // Mode D: single host or Mode A: base IP
	CIDRRange   string            `json:"cidr,omitempty"`       // Mode A: subnet CIDR
	Port        int               `json:"port,omitempty"`       // 0 = use protocol default
	AuthMethod  string            `json:"auth_method"`          // "password" | "ssh_key" | "api_token" | "iam_role"
	Username    string            `json:"username,omitempty"`
	CredRef     string            `json:"cred_ref,omitempty"`     // → AES-256-GCM vault entry
	APIEndpoint string            `json:"api_endpoint,omitempty"` // Mode C REST
	Region      string            `json:"region,omitempty"`       // AWS/Azure
	EnclaveID   string            `json:"enclave_id"`
	Schedule    string            `json:"schedule,omitempty"` // "manual" | "hourly" | "daily"
	CreatedAt   time.Time         `json:"created_at"`
	LastUsed    time.Time         `json:"last_used,omitempty"`
}

// Credential holds decrypted credentials for a connector session.
// Never serialized — exists only in memory during a connection attempt.
type Credential struct {
	AuthMethod  string // "password" | "ssh_key" | "api_token" | "iam_role"
	Username    string
	Secret      string // password text, SSH private key PEM, or API token
	SSHKeyPath  string // path to SSH private key file (alternative to embedded PEM)
}

// CSVAssetRow is one parsed row from a CSV import (Mode B).
type CSVAssetRow struct {
	Hostname    string
	IPAddress   string
	OS          string
	Enclave     string
	STIGProfile string
	Extra       map[string]string // additional unmapped columns
}

// ImportResult summarizes a bulk CSV import operation.
type ImportResult struct {
	Total    int      `json:"total"`
	Enrolled int      `json:"enrolled"`
	Skipped  int      `json:"skipped"`
	Errors   []string `json:"errors,omitempty"`
}

// DefaultPort returns the conventional port for a protocol.
func DefaultPort(p ConnectorProtocol) int {
	switch p {
	case ProtoSSH:
		return 22
	case ProtoWinRM:
		return 5985
	case ProtoREST:
		return 443
	default:
		return 0
	}
}

// AutoDetectSTIGProfile maps a banner/OS string to an ASAF STIG profile key.
func AutoDetectSTIGProfile(osStr string) string {
	lower := toLower(osStr)
	switch {
	case (contains(lower, "rhel") || contains(lower, "red hat")) && contains(lower, " 10"):
		return "rhel10" // RHEL 10 V1R2 — must check before generic rhel match
	case contains(lower, "rhel") || contains(lower, "red hat"):
		return "rhel9"
	case contains(lower, "centos") || contains(lower, "almalinux") || contains(lower, "rocky"):
		return "rhel9" // RHEL-compatible
	case contains(lower, "ubuntu"):
		return "ubuntu"
	case contains(lower, "debian"):
		return "ubuntu" // closest profile
	case contains(lower, "windows server 2022"):
		return "windows-server-2022"
	case contains(lower, "windows server 2019"):
		return "windows-server-2019"
	case contains(lower, "windows 11"):
		return "windows-11"
	case contains(lower, "windows 10"):
		return "windows-10"
	default:
		return "generic"
	}
}

func toLower(s string) string {
	b := make([]byte, len(s))
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c >= 'A' && c <= 'Z' {
			c += 32
		}
		b[i] = c
	}
	return string(b)
}

func contains(s, sub string) bool {
	if len(sub) == 0 {
		return true
	}
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
