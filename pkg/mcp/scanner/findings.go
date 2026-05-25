package scanner

import (
	"fmt"
	"time"
)

// Severity levels for MCPFinding.
type Severity string

const (
	SeverityCritical Severity = "CRITICAL"
	SeverityHigh     Severity = "HIGH"
	SeverityMedium   Severity = "MEDIUM"
	SeverityLow      Severity = "LOW"
	SeverityInfo     Severity = "INFO"
)

// MCPFinding is a single detected threat from an MCP scan run.
type MCPFinding struct {
	ID          string      `json:"id"`
	ThreatClass ThreatClass `json:"threat_class"`
	Severity    Severity    `json:"severity"`
	Title       string      `json:"title"`
	Detail      string      `json:"detail"`
	Control     string      `json:"control"`   // NIST/CMMC control reference
	Framework   string      `json:"framework"` // e.g. "NIST SP 800-53"
	DetectedAt  time.Time   `json:"detected_at"`
	Remediated  bool        `json:"remediated"`
}

// ComplianceGapFields returns the fields needed to build an ert.ComplianceGap.
// The ert package does the final conversion to avoid an import cycle.
func (f *MCPFinding) ComplianceGapFields() (framework, control, description, severity string) {
	return f.Framework,
		f.Control,
		fmt.Sprintf("[MCP-%s] %s: %s", f.ThreatClass, f.Title, f.Detail),
		string(f.Severity)
}
