package stig

import (
	"fmt"
	"os"
	"strings"
	"time"
)

// ExportToPDF exports comprehensive validation results to PDF format
// Executive Intelligence Brief format for DoD leadership
func (r *ComprehensiveReport) ExportToPDF(outputPath string) error {
	// For production PDF generation, use a library like:
	// - github.com/jung-kurt/gofpdf
	// - github.com/signintech/gopdf
	// - github.com/go-pdf/fpdf
	//
	// For now, create a structured text report that can be converted to PDF

	file, err := os.Create(outputPath + ".txt")
	if err != nil {
		return fmt.Errorf("failed to create PDF text file: %w", err)
	}
	defer file.Close()

	// Write Executive Intelligence Brief
	r.writeExecutiveBrief(file)

	return nil
}

// writeExecutiveBrief writes executive intelligence brief in DoD format
func (r *ComprehensiveReport) writeExecutiveBrief(file *os.File) {
	write := func(format string, args ...interface{}) {
		fmt.Fprintf(file, format, args...)
	}

	// Header
	write("═══════════════════════════════════════════════════════════════════\n")
	write("           EXECUTIVE INTELLIGENCE BRIEF\n")
	write("        Cybersecurity Compliance Assessment Report\n")
	write("═══════════════════════════════════════════════════════════════════\n\n")

	// Classification
	write("CLASSIFICATION: UNCLASSIFIED\n")
	write("DATE: %s\n", r.ScanDate.Format("2006-01-02 15:04:05 MST"))
	write("SCAN DURATION: %s\n\n", r.ScanDuration.String())

	// System Information
	write("───────────────────────────────────────────────────────────────────\n")
	write("SYSTEM INFORMATION\n")
	write("───────────────────────────────────────────────────────────────────\n")
	write("Hostname:        %s\n", r.Hostname)
	write("OS Version:      %s\n", r.OSVersion)
	write("Kernel Version:  %s\n\n", r.KernelVersion)

	// Executive Summary
	write("───────────────────────────────────────────────────────────────────\n")
	write("EXECUTIVE SUMMARY\n")
	write("───────────────────────────────────────────────────────────────────\n")
	write("Overall Compliance:    %.2f%%  [%s]\n",
		r.ExecutiveSummary.OverallCompliance,
		r.ExecutiveSummary.ComplianceGrade)
	write("Overall Risk:          %s\n\n", r.ExecutiveSummary.OverallRisk)

	write("Framework Compliance Scores:\n")
	write("  • RHEL-09-STIG:      %.2f%%\n", r.ExecutiveSummary.STIGCompliance)
	write("  • CIS Benchmark:     %.2f%%\n", r.ExecutiveSummary.CISCompliance)
	write("  • NIST 800-53:       %.2f%%\n", r.ExecutiveSummary.NIST80053Compliance)
	write("  • NIST 800-171:      %.2f%%\n", r.ExecutiveSummary.NIST800171Compliance)
	write("  • CMMC 3.0 L3:       %.2f%%\n\n", r.ExecutiveSummary.CMMCCompliance)

	// Critical Findings
	write("Critical Findings:\n")
	write("  • CAT I/Critical:    %d findings (IMMEDIATE ACTION REQUIRED)\n", r.ExecutiveSummary.CAT1Findings)
	write("  • CAT II/High:       %d findings\n", r.ExecutiveSummary.CAT2Findings)
	write("  • CAT III/Medium:    %d findings\n\n", r.ExecutiveSummary.CAT3Findings)

	// PQC Readiness
	if r.PQCBlastRadius != nil {
		write("Post-Quantum Cryptography Readiness:\n")
		write("  • Readiness Score:   %.2f%%  [%s]\n",
			r.PQCBlastRadius.PQCReadinessScore,
			r.ExecutiveSummary.PQCReadinessGrade)
		write("  • Migration Required: %v\n", r.ExecutiveSummary.PQCMigrationRequired)
		if r.ExecutiveSummary.PQCMigrationRequired {
			write("  • Estimated Days:    %d\n", r.PQCBlastRadius.EstimatedMigrationDays)
		}
		write("\n")
	}

	// Top Risks
	write("───────────────────────────────────────────────────────────────────\n")
	write("TOP RISKS REQUIRING ATTENTION\n")
	write("───────────────────────────────────────────────────────────────────\n")
	for i, risk := range r.ExecutiveSummary.TopRisks {
		write("%d. %s\n", i+1, risk)
	}
	write("\n")

	// Executive Recommendations
	write("───────────────────────────────────────────────────────────────────\n")
	write("EXECUTIVE RECOMMENDATIONS\n")
	write("───────────────────────────────────────────────────────────────────\n")
	for i, rec := range r.ExecutiveSummary.ExecutiveRecommendations {
		write("%d. %s\n", i+1, rec)
	}
	write("\n")

	// Framework Details
	write("───────────────────────────────────────────────────────────────────\n")
	write("FRAMEWORK VALIDATION DETAILS\n")
	write("───────────────────────────────────────────────────────────────────\n\n")

	for frameworkName, result := range r.Results {
		write("Framework: %s (Version %s)\n", frameworkName, result.Version)
		write("  Total Controls:     %d\n", result.TotalControls)
		write("  Passed:             %d (%.2f%%)\n", result.Passed, result.ComplianceScore())
		write("  Failed:             %d\n", result.Failed)
		write("  Not Applicable:     %d\n", result.NotApplicable)
		write("  Manual Review:      %d\n", result.ManualReview)
		write("  Scan Duration:      %s\n\n", result.Duration.String())
	}

	// Critical Findings Detail
	if r.ExecutiveSummary.CAT1Findings > 0 {
		write("───────────────────────────────────────────────────────────────────\n")
		write("CRITICAL FINDINGS (CAT I) - IMMEDIATE ACTION REQUIRED\n")
		write("───────────────────────────────────────────────────────────────────\n\n")

		count := 0
		for _, result := range r.Results {
			for _, finding := range result.Findings {
				if finding.Status == "Fail" && (finding.Severity == SeverityCAT1 || finding.Severity == SeverityCritical) {
					count++
					write("%d. [%s] %s\n", count, finding.ID, finding.Title)
					write("   Severity:      %s\n", finding.Severity)
					write("   Expected:      %s\n", finding.Expected)
					write("   Actual:        %s\n", finding.Actual)
					write("   Remediation:   %s\n", finding.Remediation)
					if len(finding.References) > 0 {
						write("   References:    %s\n", strings.Join(finding.References[:min(3, len(finding.References))], ", "))
					}
					write("\n")
				}
			}
		}
	}

	// POA&M Summary
	if len(r.POAMItems) > 0 {
		write("───────────────────────────────────────────────────────────────────\n")
		write("PLAN OF ACTION & MILESTONES (POA&M) SUMMARY\n")
		write("───────────────────────────────────────────────────────────────────\n")
		write("Total POA&M Items: %d\n\n", len(r.POAMItems))

		totalCost := 0.0
		for _, poam := range r.POAMItems {
			totalCost += poam.EstimatedCost
		}
		write("Estimated Total Remediation Cost: $%.2f\n\n", totalCost)

		// Group by severity
		cat1Count, cat2Count, cat3Count := 0, 0, 0
		for _, poam := range r.POAMItems {
			switch poam.Severity {
			case SeverityCAT1, SeverityCritical:
				cat1Count++
			case SeverityCAT2, SeverityHigh:
				cat2Count++
			default:
				cat3Count++
			}
		}
		write("Breakdown by Severity:\n")
		write("  • CAT I/Critical:  %d items\n", cat1Count)
		write("  • CAT II/High:     %d items\n", cat2Count)
		write("  • CAT III/Low:     %d items\n\n", cat3Count)
	}

	// PQC Blast Radius Detail
	if r.PQCBlastRadius != nil {
		write("───────────────────────────────────────────────────────────────────\n")
		write("POST-QUANTUM CRYPTOGRAPHY MIGRATION ANALYSIS\n")
		write("───────────────────────────────────────────────────────────────────\n\n")

		write("Cryptographic Operations Inventory:\n")
		write("  • Total Operations:      %d\n", r.PQCBlastRadius.TotalCryptoOperations)
		write("  • Legacy (vulnerable):   %d\n", r.PQCBlastRadius.LegacyCryptoOperations)
		write("  • PQC Ready:             %d\n\n", r.PQCBlastRadius.PQCReadyOperations)

		if len(r.PQCBlastRadius.VulnerableProtocols) > 0 {
			write("Vulnerable Protocols Requiring Upgrade:\n")
			for _, protocol := range r.PQCBlastRadius.VulnerableProtocols {
				write("  • %s\n", protocol)
			}
			write("\n")
		}

		if len(r.PQCBlastRadius.HighRiskSystems) > 0 {
			write("High Risk Systems (Immediate PQC Migration):\n")
			for _, sys := range r.PQCBlastRadius.HighRiskSystems {
				write("  • %s\n", sys)
			}
			write("\n")
		}

		write("Migration Timeline:\n")
		if len(r.PQCBlastRadius.ImmediateActions) > 0 {
			write("\nImmediate Actions (0-30 days):\n")
			for _, action := range r.PQCBlastRadius.ImmediateActions {
				write("  • %s\n", action)
			}
		}
		if len(r.PQCBlastRadius.ShortTermActions) > 0 {
			write("\nShort-term Actions (1-3 months):\n")
			for _, action := range r.PQCBlastRadius.ShortTermActions {
				write("  • %s\n", action)
			}
		}
		if len(r.PQCBlastRadius.LongTermActions) > 0 {
			write("\nLong-term Actions (3-12 months):\n")
			for _, action := range r.PQCBlastRadius.LongTermActions {
				write("  • %s\n", action)
			}
		}
		write("\n")
	}

	// Footer
	write("═══════════════════════════════════════════════════════════════════\n")
	write("END OF EXECUTIVE INTELLIGENCE BRIEF\n")
	write("═══════════════════════════════════════════════════════════════════\n\n")
	write("CLASSIFICATION: UNCLASSIFIED\n")
	write("Generated by: AdinKhepra Iron Bank Security Scanner\n")
	write("Report Date: %s\n", time.Now().Format("2006-01-02 15:04:05 MST"))
	write("\nFor questions or concerns, contact: security@souhimbou.ai\n")
}

// min returns the minimum of two integers
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
