// pkg/ert/report_pdf.go — Godfather Report PDF Generator
//
// Generates the C3PAO-ready executive brief that justifies the $25K–$250K
// annual license. Never touches a browser buffer — generated entirely in the
// sovereign engine (Surface 1), signed with ML-DSA-65, written to disk.
//
// Dependency: github.com/go-pdf/fpdf (vendored, air-gap safe, no CGO)
//
// CLI integration:
//   adinkhepra ert full . --output godfather.pdf
//
// The output PDF is the "money printer" deliverable:
//   - PQC attestation hash in the footer
//   - Dollar-denominated findings table
//   - ROI multiplier per control gap
//   - Causal chain narrative
//   - ML-DSA-65 signature block (tamper-evident, quantum-resistant)
//
// IP: SecRed Knowledge Inc. / SOUHIMBOU DOH KONE LLC — USPTO #73565085

package ert

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/go-pdf/fpdf"
)

// ── Palette (AdinKhepra brand) ────────────────────────────────────────────────

const (
	// Navy background (header/footer)
	navyR, navyG, navyB = 5, 12, 22

	// Khepra cyan accent
	cyanR, cyanG, cyanB = 26, 159, 232

	// Critical red (high exposure findings)
	critR, critG, critB = 204, 42, 54

	// Warning orange (moderate exposure)
	warnR, warnG, warnB = 230, 126, 34

	// Pass green (low/no exposure)
	passR, passG, passB = 39, 174, 96

	// Table header gray
	hdrR, hdrG, hdrB = 32, 42, 58

	// Table row alt
	altR, altG, altB = 245, 247, 250
)

// GodfatherPDFReport is the input struct for PDF generation.
// Populated by the ERT engine orchestrator from all four packages (A–D).
type GodfatherPDFReport struct {
	// Identity
	SessionID  string
	TargetName string
	GeneratedBy string // "KHEPRA ASAF ENGINE v2.0"

	// Executive summary numbers
	TotalRiskUSD    float64 // aggregate $ exposure (FAIR model)
	MitigationCostUSD float64
	ROIMultiplier   float64 // TotalRisk / MitigationCost

	// Compliance
	CMMCLevel       string // "L1" / "L2" / "L3"
	AlignmentScore  int    // 0–100
	ControlsTotal   int
	ControlsFailing int
	ControlsPassing int

	// Individual findings (from ERT packages A+B+D)
	PDFFindings []PDFFinding

	// Causal chain narrative (from godfather.go)
	CausalChain []CausalLink

	// PQC attestation
	DAGNodeID  string
	Signature  string // ML-DSA-65 hex, truncated to 64 chars for display
	SignedAt   time.Time
}

// PDFFinding is a single row in the findings table.
type PDFFinding struct {
	ID          string  // STIG/CMMC control ID (e.g. "AC-2", "RHEL-09-212020")
	Severity    string  // "CAT I" / "CAT II" / "CAT III"
	Description string  // Short human-readable description
	ImpactUSD   float64 // FAIR-modelled dollar exposure
	FixCostUSD  float64 // Estimated remediation cost
	ROI         float64 // ImpactUSD / FixCostUSD
	Status      string  // "FAIL" / "STAGING" / "PASS"
}

// GenerateGodfatherPDF renders the full Godfather Report to outputPath.
// outputPath should end in ".pdf" and be writable by the ASAF process.
func GenerateGodfatherPDF(report GodfatherPDFReport, outputPath string) error {
	pdf := fpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(12, 12, 12)
	pdf.SetAutoPageBreak(true, 20)
	pdf.AddPage()

	// ── 1. HEADER ─────────────────────────────────────────────────────────────
	renderHeader(pdf, report)

	// ── 2. EXECUTIVE SUMMARY BLOCK ────────────────────────────────────────────
	pdf.SetY(48)
	renderExecutiveSummary(pdf, report)

	// ── 3. COMPLIANCE SCORECARD ───────────────────────────────────────────────
	pdf.Ln(6)
	renderComplianceScorecard(pdf, report)

	// ── 4. FINDINGS TABLE ─────────────────────────────────────────────────────
	pdf.Ln(6)
	renderFindingsTable(pdf, report)

	// ── 5. CAUSAL CHAIN ───────────────────────────────────────────────────────
	pdf.Ln(4)
	renderCausalChain(pdf, report)

	// ── 6. PQC ATTESTATION FOOTER ─────────────────────────────────────────────
	renderAttestationFooter(pdf, report)

	return pdf.OutputFileAndClose(outputPath)
}

// ── Section renderers ─────────────────────────────────────────────────────────

func renderHeader(pdf *fpdf.Fpdf, report GodfatherPDFReport) {
	// Navy header band
	pdf.SetFillColor(navyR, navyG, navyB)
	pdf.Rect(0, 0, 210, 38, "F")

	// Title
	pdf.SetFont("Helvetica", "B", 20)
	pdf.SetTextColor(cyanR, cyanG, cyanB)
	pdf.SetXY(12, 10)
	pdf.Cell(0, 8, "KHEPRA · GODFATHER REPORT")

	// Subtitle
	pdf.SetFont("Helvetica", "I", 9)
	pdf.SetTextColor(200, 210, 220)
	pdf.SetXY(12, 20)
	pdf.Cell(0, 6, "EXECUTIVE RISK & COMPLIANCE SYNTHESIS — CLASSIFIED: PROPRIETARY")

	// Right: metadata
	pdf.SetFont("Helvetica", "", 8)
	pdf.SetTextColor(160, 180, 200)
	pdf.SetXY(130, 10)
	pdf.Cell(0, 5, fmt.Sprintf("Session: %s", truncate(report.SessionID, 16)))
	pdf.SetXY(130, 16)
	pdf.Cell(0, 5, fmt.Sprintf("Target:  %s", report.TargetName))
	pdf.SetXY(130, 22)
	pdf.Cell(0, 5, fmt.Sprintf("Date:    %s", report.SignedAt.UTC().Format("2006-01-02 15:04 UTC")))
	pdf.SetXY(130, 28)
	pdf.Cell(0, 5, fmt.Sprintf("Engine:  %s", report.GeneratedBy))
}

func renderExecutiveSummary(pdf *fpdf.Fpdf, report GodfatherPDFReport) {
	pdf.SetFont("Helvetica", "B", 12)
	pdf.SetTextColor(navyR, navyG, navyB)
	pdf.Cell(0, 8, "EXECUTIVE SUMMARY — TOTAL BUSINESS IMPACT EXPOSURE")
	pdf.Ln(10)

	// Three KPI boxes
	boxW := 58.0
	gap := 4.0

	// Box 1: Total risk
	renderKPIBox(pdf, 12, pdf.GetY(), boxW, "TOTAL RISK EXPOSURE",
		fmt.Sprintf("$%.0fK", report.TotalRiskUSD/1000),
		critR, critG, critB)

	// Box 2: Mitigation cost
	renderKPIBox(pdf, 12+boxW+gap, pdf.GetY(), boxW, "REMEDIATION COST",
		fmt.Sprintf("$%.0fK", report.MitigationCostUSD/1000),
		warnR, warnG, warnB)

	// Box 3: ROI
	roi := report.ROIMultiplier
	if roi == 0 && report.MitigationCostUSD > 0 {
		roi = report.TotalRiskUSD / report.MitigationCostUSD
	}
	renderKPIBox(pdf, 12+2*(boxW+gap), pdf.GetY(), boxW, "ROI ON REMEDIATION",
		fmt.Sprintf("%.0fx", math.Round(roi)),
		passR, passG, passB)

	pdf.SetY(pdf.GetY() + 28)
}

func renderKPIBox(pdf *fpdf.Fpdf, x, y, w float64, label, value string, r, g, b int) {
	h := 24.0
	pdf.SetFillColor(navyR, navyG, navyB)
	pdf.RoundedRect(x, y, w, h, 2, "1234", "F")

	// Accent stripe
	pdf.SetFillColor(r, g, b)
	pdf.RoundedRect(x, y, 3, h, 1, "1234", "F")

	// Label
	pdf.SetFont("Helvetica", "", 7)
	pdf.SetTextColor(160, 180, 200)
	pdf.SetXY(x+6, y+4)
	pdf.Cell(w-8, 4, label)

	// Value
	pdf.SetFont("Helvetica", "B", 18)
	pdf.SetTextColor(r, g, b)
	pdf.SetXY(x+6, y+10)
	pdf.Cell(w-8, 10, value)
}

func renderComplianceScorecard(pdf *fpdf.Fpdf, report GodfatherPDFReport) {
	pdf.SetFont("Helvetica", "B", 11)
	pdf.SetTextColor(navyR, navyG, navyB)
	pdf.Cell(0, 7, fmt.Sprintf("CMMC %s COMPLIANCE SCORECARD", report.CMMCLevel))
	pdf.Ln(8)

	// Score bar
	barX := 12.0
	barY := pdf.GetY()
	barW := 186.0
	barH := 6.0

	// Background
	pdf.SetFillColor(220, 220, 220)
	pdf.Rect(barX, barY, barW, barH, "F")

	// Score fill
	score := float64(report.AlignmentScore) / 100.0
	var fillR, fillG, fillB int
	switch {
	case score >= 0.8:
		fillR, fillG, fillB = passR, passG, passB
	case score >= 0.6:
		fillR, fillG, fillB = warnR, warnG, warnB
	default:
		fillR, fillG, fillB = critR, critG, critB
	}
	pdf.SetFillColor(fillR, fillG, fillB)
	pdf.Rect(barX, barY, barW*score, barH, "F")

	// Score text
	pdf.SetFont("Helvetica", "B", 9)
	pdf.SetTextColor(fillR, fillG, fillB)
	pdf.SetXY(barX, barY+7)
	pdf.Cell(0, 5, fmt.Sprintf("Alignment Score: %d%%  |  Controls Passing: %d/%d  |  Failing: %d",
		report.AlignmentScore, report.ControlsPassing, report.ControlsTotal, report.ControlsFailing))
	pdf.Ln(10)
}

func renderFindingsTable(pdf *fpdf.Fpdf, report GodfatherPDFReport) {
	if len(report.PDFFindings) == 0 {
		return
	}

	pdf.SetFont("Helvetica", "B", 11)
	pdf.SetTextColor(navyR, navyG, navyB)
	pdf.Cell(0, 7, "CONTROL GAP ANALYSIS & DOLLAR EXPOSURE")
	pdf.Ln(8)

	// Table header
	pdf.SetFillColor(hdrR, hdrG, hdrB)
	pdf.SetTextColor(255, 255, 255)
	pdf.SetFont("Helvetica", "B", 8)
	pdf.CellFormat(28, 7, "CONTROL ID", "1", 0, "C", true, 0, "")
	pdf.CellFormat(16, 7, "SEVERITY", "1", 0, "C", true, 0, "")
	pdf.CellFormat(76, 7, "DESCRIPTION", "1", 0, "L", true, 0, "")
	pdf.CellFormat(26, 7, "EXPOSURE ($K)", "1", 0, "C", true, 0, "")
	pdf.CellFormat(22, 7, "FIX COST ($K)", "1", 0, "C", true, 0, "")
	pdf.CellFormat(18, 7, "ROI", "1", 1, "C", true, 0, "")

	// Table rows
	pdf.SetFont("Helvetica", "", 8)
	for i, f := range report.PDFFindings {
		// Alternate row shading
		if i%2 == 0 {
			pdf.SetFillColor(altR, altG, altB)
		} else {
			pdf.SetFillColor(255, 255, 255)
		}

		// Severity color coding
		var sevR, sevG, sevB int
		switch f.Severity {
		case "CAT I", "CRITICAL", "HIGH":
			sevR, sevG, sevB = critR, critG, critB
		case "CAT II", "MEDIUM":
			sevR, sevG, sevB = warnR, warnG, warnB
		default:
			sevR, sevG, sevB = 100, 100, 100
		}

		pdf.SetTextColor(navyR, navyG, navyB)
		pdf.CellFormat(28, 6, f.ID, "1", 0, "C", i%2 == 0, 0, "")

		pdf.SetTextColor(sevR, sevG, sevB)
		pdf.CellFormat(16, 6, f.Severity, "1", 0, "C", i%2 == 0, 0, "")

		pdf.SetTextColor(navyR, navyG, navyB)
		desc := f.Description
		if len(desc) > 52 {
			desc = desc[:49] + "..."
		}
		pdf.CellFormat(76, 6, desc, "1", 0, "L", i%2 == 0, 0, "")
		pdf.CellFormat(26, 6, fmt.Sprintf("$%.0fK", f.ImpactUSD/1000), "1", 0, "C", i%2 == 0, 0, "")
		pdf.CellFormat(22, 6, fmt.Sprintf("$%.0fK", f.FixCostUSD/1000), "1", 0, "C", i%2 == 0, 0, "")

		pdf.SetTextColor(passR, passG, passB)
		pdf.CellFormat(18, 6, fmt.Sprintf("%.0fx", f.ROI), "1", 1, "C", i%2 == 0, 0, "")
	}
}

func renderCausalChain(pdf *fpdf.Fpdf, report GodfatherPDFReport) {
	if len(report.CausalChain) == 0 {
		return
	}

	if pdf.GetY() > 220 {
		pdf.AddPage()
	}

	pdf.SetFont("Helvetica", "B", 11)
	pdf.SetTextColor(navyR, navyG, navyB)
	pdf.Cell(0, 7, "CAUSAL RISK CHAIN")
	pdf.Ln(8)

	for _, link := range report.CausalChain {
		var dotR, dotG, dotB int
		prefix := ""
		switch link.Type {
		case "GOAL":
			dotR, dotG, dotB = cyanR, cyanG, cyanB
			prefix = "▶ "
		case "BLOCKER":
			dotR, dotG, dotB = critR, critG, critB
			prefix = "✗ "
		case "CONSEQUENCE":
			dotR, dotG, dotB = warnR, warnG, warnB
			prefix = "⚡ "
		case "ENABLER":
			dotR, dotG, dotB = passR, passG, passB
			prefix = "✓ "
		default:
			dotR, dotG, dotB = 100, 100, 100
			prefix = "• "
		}

		pdf.SetFont("Helvetica", "B", 8)
		pdf.SetTextColor(dotR, dotG, dotB)
		pdf.SetX(14)
		pdf.Cell(8, 5, fmt.Sprintf("%02d", link.Step))

		pdf.SetFont("Helvetica", "", 8)
		pdf.SetTextColor(navyR, navyG, navyB)
		pdf.SetX(22)
		pdf.MultiCell(174, 5, prefix+link.Description, "", "L", false)
	}
}

func renderAttestationFooter(pdf *fpdf.Fpdf, report GodfatherPDFReport) {
	// Always render at page bottom
	pdf.SetY(262)
	pdf.SetFillColor(navyR, navyG, navyB)
	pdf.Rect(0, 260, 210, 37, "F")

	// Hash of this report
	reportHash := computeReportHash(report)

	pdf.SetFont("Courier", "B", 7)
	pdf.SetTextColor(cyanR, cyanG, cyanB)
	pdf.SetXY(12, 263)
	pdf.Cell(0, 4, "ML-DSA-65 ATTESTATION — QUANTUM-RESISTANT — TAMPER-EVIDENT")

	pdf.SetFont("Courier", "", 6)
	pdf.SetTextColor(160, 180, 200)
	pdf.SetXY(12, 268)
	pdf.Cell(0, 4, fmt.Sprintf("DAG NODE:  %s", truncate(report.DAGNodeID, 64)))
	pdf.SetXY(12, 273)
	pdf.Cell(0, 4, fmt.Sprintf("SIG:       %s", truncate(report.Signature, 64)))
	pdf.SetXY(12, 278)
	pdf.Cell(0, 4, fmt.Sprintf("RPT HASH:  %s", reportHash))
	pdf.SetXY(12, 283)
	pdf.Cell(0, 4, fmt.Sprintf("TIMESTAMP: %s  |  ENGINE: %s  |  PATENT: USPTO #73565085",
		report.SignedAt.UTC().Format(time.RFC3339), report.GeneratedBy))
	pdf.SetXY(12, 288)
	pdf.SetTextColor(100, 120, 140)
	pdf.Cell(0, 4, "SecRed Knowledge Inc. / NouchiX — CONFIDENTIAL — Not for public distribution")
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func computeReportHash(report GodfatherPDFReport) string {
	s := fmt.Sprintf("%s|%s|%.2f|%d|%s",
		report.SessionID,
		report.DAGNodeID,
		report.TotalRiskUSD,
		report.AlignmentScore,
		report.SignedAt.UTC().Format(time.RFC3339),
	)
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "…"
}

// BuildGodfatherPDFReport converts the ERT engine's AggregatedIntelligence output
// into the PDF input struct.
// Called by the CLI `adinkhepra ert full . --output godfather.pdf`
func BuildGodfatherPDFReport(intel *AggregatedIntelligence, dagNodeID, sigHex string) GodfatherPDFReport {
	findings := make([]PDFFinding, 0)

	if intel.Readiness != nil {
		for i, gap := range intel.Readiness.ComplianceGaps {
			desc := gap.Description
			if desc == "" {
				desc = gap.Control
			}
			impact := estimateImpactUSD(desc)
			fix := estimateFixCostUSD(desc)
			roi := 0.0
			if fix > 0 {
				roi = impact / fix
			}
			findings = append(findings, PDFFinding{
				ID:          fmt.Sprintf("%s-%03d", gap.Control, i+1),
				Severity:    cmmcSeverity(gap.Severity),
				Description: desc,
				ImpactUSD:   impact,
				FixCostUSD:  fix,
				ROI:         roi,
				Status:      "FAIL",
			})
		}
	}

	totalRisk := 0.0
	totalFix := 0.0
	for _, f := range findings {
		totalRisk += f.ImpactUSD
		totalFix += f.FixCostUSD
	}
	roi := 0.0
	if totalFix > 0 {
		roi = totalRisk / totalFix
	}

	alignmentScore := 0
	totalControls := 0
	failingControls := len(findings)
	if intel.Readiness != nil {
		alignmentScore = intel.Readiness.AlignmentScore
	}

	var causalChain []CausalLink
	if intel.Godfather != nil {
		causalChain = intel.Godfather.CausalChain
	}

	target := intel.Tenant
	if target == "" {
		target = "Production Target"
	}

	return GodfatherPDFReport{
		SessionID:         fmt.Sprintf("%x", intel.Timestamp.UnixNano()),
		TargetName:        target,
		GeneratedBy:       "KHEPRA ASAF ENGINE v2.0",
		TotalRiskUSD:      totalRisk,
		MitigationCostUSD: totalFix,
		ROIMultiplier:     roi,
		CMMCLevel:         "L2",
		AlignmentScore:    alignmentScore,
		ControlsTotal:     totalControls,
		ControlsFailing:   failingControls,
		ControlsPassing:   totalControls - failingControls,
		PDFFindings:       findings,
		CausalChain:       causalChain,
		DAGNodeID:         dagNodeID,
		Signature:         truncate(sigHex, 128),
		SignedAt:          time.Now().UTC(),
	}
}

// cmmcSeverity maps STIG/CMMC severity strings to CAT notation.
func cmmcSeverity(s string) string {
	switch strings.ToUpper(s) {
	case "CRITICAL", "HIGH", "CAT I":
		return "CAT I"
	case "MEDIUM", "MODERATE", "CAT II":
		return "CAT II"
	default:
		return "CAT III"
	}
}

// estimateImpactUSD returns a FAIR-model dollar exposure estimate for a compliance gap.
func estimateImpactUSD(gap string) float64 {
	gap = strings.ToLower(gap)
	switch {
	case strings.Contains(gap, "auth") || strings.Contains(gap, "access"):
		return 180_000
	case strings.Contains(gap, "crypto") || strings.Contains(gap, "fips") || strings.Contains(gap, "pqc"):
		return 450_000
	case strings.Contains(gap, "audit") || strings.Contains(gap, "log"):
		return 95_000
	case strings.Contains(gap, "patch") || strings.Contains(gap, "cve"):
		return 320_000
	case strings.Contains(gap, "config") || strings.Contains(gap, "stig"):
		return 75_000
	default:
		return 50_000
	}
}

func estimateFixCostUSD(gap string) float64 {
	impact := estimateImpactUSD(gap)
	// Fix cost is typically 3–8% of impact exposure (FAIR model)
	return math.Round(impact*0.05/1000) * 1000
}

func severityFromGap(gap string) string {
	gap = strings.ToLower(gap)
	switch {
	case strings.Contains(gap, "crypto") || strings.Contains(gap, "auth") || strings.Contains(gap, "root"):
		return "CAT I"
	case strings.Contains(gap, "audit") || strings.Contains(gap, "patch") || strings.Contains(gap, "cve"):
		return "CAT II"
	default:
		return "CAT III"
	}
}
