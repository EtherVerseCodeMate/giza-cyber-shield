// Package stig provides comprehensive STIG validation for DoD compliance
// Supports multiple frameworks with cross-reference mapping
package stig

import "time"

// Severity levels for STIG findings
type Severity string

const (
	SeverityCAT1     Severity = "CAT I"    // High (STIG)
	SeverityCAT2     Severity = "CAT II"   // Medium (STIG)
	SeverityCAT3     Severity = "CAT III"  // Low (STIG)
	SeverityCritical Severity = "Critical" // Critical (CIS)
	SeverityHigh     Severity = "High"     // High (NIST/CMMC)
	SeverityMedium   Severity = "Medium"   // Medium (NIST/CMMC)
	SeverityLow      Severity = "Low"      // Low (NIST/CMMC)
)

// Finding represents a single compliance finding
type Finding struct {
	ID          string    // Control ID (e.g., "RHEL-09-291015", "CIS-1.1.1")
	Title       string    // Control title
	Description string    // What was checked
	Severity    Severity  // Finding severity
	Status      string    // "Pass", "Fail", "Not Applicable", "Manual Review Required"
	Expected    string    // Expected configuration
	Actual      string    // Actual configuration found
	Remediation string    // How to fix if failed
	References  []string  // Cross-references (CCI, NIST, CMMC)
	CheckedAt   time.Time // When this check was performed
}

// ValidationResult represents results for a single framework
type ValidationResult struct {
	Framework     string        // "RHEL-09-STIG-V1R3", "CIS-RHEL-9-L1", etc.
	Version       string        // Framework version
	TotalControls int           // Total number of controls checked
	Passed        int           // Number of controls passed
	Failed        int           // Number of controls failed
	NotApplicable int           // Number of controls not applicable
	ManualReview  int           // Number of controls requiring manual review
	Findings      []Finding     // Detailed findings
	StartTime     time.Time     // Validation start time
	EndTime       time.Time     // Validation end time
	Duration      time.Duration // Total validation duration
}

// ComplianceScore calculates compliance percentage
func (v *ValidationResult) ComplianceScore() float64 {
	if v.TotalControls == 0 {
		return 0.0
	}
	return (float64(v.Passed) / float64(v.TotalControls)) * 100.0
}

// ComprehensiveReport represents a full compliance validation report
type ComprehensiveReport struct {
	// System Information
	Hostname      string        // Target system hostname
	OSVersion     string        // Operating system version
	KernelVersion string        // Kernel version
	ScanDate      time.Time     // Report generation date
	ScanDuration  time.Duration // Total scan duration

	// Framework Results
	Results map[string]*ValidationResult // Key: framework name

	// Cross-Reference Mappings
	// Maps STIG IDs to their corresponding CCI, NIST 800-53, NIST 800-171, CMMC controls
	CrossReferences map[string][]string // Key: control ID, Value: related controls

	// PQC Migration Analysis
	PQCBlastRadius *BlastRadiusAnalysis // Post-quantum migration impact

	// Plan of Action & Milestones
	POAMItems []POAMItem // Remediation plan

	// Executive Summary
	ExecutiveSummary ExecutiveSummary // High-level summary for leadership
}

// BlastRadiusAnalysis represents PQC migration impact assessment
type BlastRadiusAnalysis struct {
	// Cryptographic Inventory
	TotalCryptoOperations  int      // Total crypto operations found
	LegacyCryptoOperations int      // Non-PQC operations
	PQCReadyOperations     int      // PQC-capable operations
	VulnerableProtocols    []string // Protocols requiring upgrade (TLS 1.2, SSH, etc.)

	// Impact Assessment
	HighRiskSystems   []string // Systems requiring immediate PQC upgrade
	MediumRiskSystems []string // Systems requiring PQC upgrade within 6 months
	LowRiskSystems    []string // Systems requiring PQC upgrade within 12 months

	// Readiness Score
	PQCReadinessScore      float64 // 0-100%
	EstimatedMigrationDays int     // Estimated time to full PQC migration

	// Recommendations
	ImmediateActions []string // Actions required now
	ShortTermActions []string // Actions within 3 months
	LongTermActions  []string // Actions within 12 months
}

// POAMItem represents a single Plan of Action & Milestones item
type POAMItem struct {
	ID                  string    // Unique POAM ID
	ControlID           string    // Related control ID
	Weakness            string    // Description of weakness
	Severity            Severity  // Weakness severity
	Status              string    // "Open", "In Progress", "Completed", "Risk Accepted"
	PointOfContact      string    // Responsible party
	EstimatedCost       float64   // Estimated remediation cost (USD)
	ScheduledCompletion time.Time // Target completion date
	MilestoneActions    []string  // Specific actions to remediate
	Resources           []string  // Required resources
}

// RemediationResult represents the outcome of an automated fix
type RemediationResult struct {
	FindingID    string    // Control ID remediated
	Status       string    // "Success", "Failed", "Requires Manual Intervention"
	Output       string    // Execution output or error message
	RemediatedAt time.Time // When remediation occurred
	Command      string    // Command executed (if applicable)
}

// ExecutiveSummary provides high-level overview for leadership
type ExecutiveSummary struct {
	// Overall Compliance
	OverallCompliance float64 // Overall compliance percentage (0-100)
	ComplianceGrade   string  // "Excellent", "Good", "Fair", "Poor", "Critical"

	// Framework Breakdown
	STIGCompliance       float64 // RHEL-09-STIG compliance %
	CISCompliance        float64 // CIS Benchmark compliance %
	NIST80053Compliance  float64 // NIST 800-53 compliance %
	NIST800171Compliance float64 // NIST 800-171 compliance %
	CMMCCompliance       float64 // CMMC 3.0 compliance %

	// Critical Findings
	CAT1Findings int // Critical/CAT I findings
	CAT2Findings int // High/CAT II findings
	CAT3Findings int // Medium/CAT III findings

	// PQC Readiness
	PQCReadinessGrade    string // "Excellent", "Good", "Fair", "Poor", "Critical"
	PQCMigrationRequired bool   // Whether PQC migration is needed

	// Risk Assessment
	OverallRisk string   // "Low", "Medium", "High", "Critical"
	TopRisks    []string // Top 5 risks requiring attention

	// Recommendations
	ExecutiveRecommendations []string // Top-level recommendations
}

// ComplianceGrade returns a letter grade based on compliance percentage
func ComplianceGrade(percentage float64) string {
	switch {
	case percentage >= 95.0:
		return "Excellent (A)"
	case percentage >= 85.0:
		return "Good (B)"
	case percentage >= 75.0:
		return "Fair (C)"
	case percentage >= 60.0:
		return "Poor (D)"
	default:
		return "Critical (F)"
	}
}

// RiskLevel returns risk level based on findings
func RiskLevel(cat1, cat2, cat3 int) string {
	if cat1 > 10 {
		return "Critical"
	}
	if cat1 > 0 || cat2 > 20 {
		return "High"
	}
	if cat2 > 0 || cat3 > 50 {
		return "Medium"
	}
	return "Low"
}
