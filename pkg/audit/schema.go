package audit

import "time"

// AuditSnapshot represents the standardized output from a Khepra Sonar scan.
// This file is generated on the client's infrastructure and ingested by Khepra Core.
type AuditSnapshot struct {
	SchemaVersion string    `json:"schema_version"`
	ScanID        string    `json:"scan_id"`
	Timestamp     time.Time `json:"timestamp"`

	// Environment Metadata
	Host InfoHost `json:"host_info"`

	// Collected Signals
	Network   []NetworkPort  `json:"network_ports"`
	Processes []ProcessInfo  `json:"processes"`
	Manifests []FileManifest `json:"file_manifests"` // e.g. package.json, go.mod

	// Tags for categorization
	Tags []string `json:"tags"`
}

type InfoHost struct {
	Hostname string `json:"hostname"`
	OS       string `json:"os"`
	Arch     string `json:"arch"`
}

type NetworkPort struct {
	Port     int    `json:"port"`
	Protocol string `json:"protocol"` // tcp, udp
	State    string `json:"state"`    // LISTENING, ESTABLISHED
	BindAddr string `json:"bind_addr"`
}

type ProcessInfo struct {
	PID     int    `json:"pid"`
	Name    string `json:"name"`
	CmdLine string `json:"cmd_line"`
}

type FileManifest struct {
	Path     string `json:"path"`
	Type     string `json:"type"`              // "npm", "go", "docker", "pip"
	Content  string `json:"content,omitempty"` // Truncated or specific content
	Checksum string `json:"sha256"`
}
