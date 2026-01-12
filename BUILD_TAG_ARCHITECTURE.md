# Build Tag Architecture - Multi-Edition Strategy
**AdinKhepra Iron Bank - Community, Premium, and Premium+HSM**

## 🎯 Strategic Design

### Core Principle
**Maximum value in Community Edition to drive adoption → Upsell to Premium for proprietary crypto**

### What's in ALL Editions (Community Value Proposition)

✅ **Full STIG Validation Suite** (not just PQC)
- RHEL-09-STIG-V1R3 validation
- CIS Benchmarks
- NIST 800-53 Rev 5 controls
- NIST 800-171 Rev 2 controls
- CMMC 3.0 Level 3 requirements
- PQC Migration readiness assessment

✅ **Compliance Translation Engine** (36,195+ row database)
- STIG ↔ CCI mapping
- CCI ↔ NIST 800-53 mapping
- NIST 800-53 ↔ NIST 800-171 mapping
- NIST 800-171 ↔ CMMC 3.0 mapping
- Automated cross-framework evidence generation

✅ **Executive Intel Briefs**
- CSV export (bulk data analysis)
- PDF export (executive summaries)
- POA&M Builder (Plan of Action & Milestones)
- Blast Radius Analysis (PQC migration impact)
- Risk scoring and prioritization

✅ **Local AGI Access** (Air-Gapped)
- SouHimBou LLM chat interface
- http://localhost:45444 web UI
- `/agi/chat` API
- `/agi/state` API
- Compliance query assistant

✅ **CLI Validation Tool**
- `adinkhepra validate` command
- PQC keygen testing
- Agent connectivity checks
- Full STIG validation
- Report generation

### What's ONLY in Premium/Premium+HSM (Upsell Value)

❌ **Proprietary Cryptography**
- Custom lattice reduction algorithms ($45M R&D)
- White-box cryptography (Merkaba engine)
- Performance optimizations
- Advanced key derivation

❌ **License Enforcement**
- Online validation (telemetry.souhimbou.org)
- Remote revocation capability
- Hourly heartbeat monitoring
- Multi-device license management

❌ **Legal Protection**
- 18 U.S.C. § 1831 (Economic Espionage Act)
- DFARS restricted rights
- Trade secret protections
- Federal penalties for reverse engineering

❌ **Premium Features** (Premium+HSM only)
- Hardware Security Module integration
- YubiHSM 2 / AWS CloudHSM support
- FIPS 140-2 Level 3 certification
- Tamper-proof algorithm execution

---

## 📦 Build Tag Structure

### Build Tags

```go
// +build community  → Iron Bank Community Edition (open-source crypto)
// +build premium    → DoD Premium Edition (proprietary crypto + license)
// +build hsm        → Premium+HSM Edition (adds HSM support)
```

### Build Commands

**Community Edition** (Iron Bank):
```bash
go build -tags community \
  -ldflags="-s -w -X main.version=1.0.0 -X main.edition=community" \
  -o bin/sonar-community \
  ./cmd/sonar
```

**Premium Edition** (Licensed):
```bash
garble -tags premium -tiny -literals build \
  -ldflags="-s -w -X main.version=1.0.0 -X main.edition=premium -X main.dilithiumPrivateKey=$KEY" \
  -o bin/sonar-premium \
  ./cmd/sonar
```

**Premium+HSM Edition**:
```bash
garble -tags "premium,hsm" -tiny -literals build \
  -ldflags="-s -w -X main.version=1.0.0 -X main.edition=premium_hsm" \
  -o bin/sonar-hsm \
  ./cmd/sonar
```

---

## 🗂️ File Organization

### Crypto Implementation (Build-Tag Separated)

```
pkg/crypto/
├── interface.go                    # Common interface (ALL editions)
├── dilithium_community.go          # +build community (Cloudflare CIRCL)
├── dilithium_premium.go            # +build premium (pkg/adinkra)
└── dilithium_hsm.go                # +build hsm (YubiHSM/CloudHSM)
```

### STIG Validation (ALL Editions)

```
pkg/stig/
├── validator.go                    # Core validation engine (ALL)
├── rhel09_stig.go                  # RHEL-09-STIG-V1R3 (ALL)
├── cis_benchmark.go                # CIS Benchmarks (ALL)
├── nist80053.go                    # NIST 800-53 Rev 5 (ALL)
├── nist800171.go                   # NIST 800-171 Rev 2 (ALL)
├── cmmc.go                         # CMMC 3.0 (ALL)
├── pqc_migration.go                # PQC readiness (ALL)
├── ckl_generator.go                # STIG Viewer .CKL (ALL)
├── csv_export.go                   # CSV reports (ALL)
└── pdf_export.go                   # PDF Intel Briefs (ALL)
```

### Compliance Mapping Database (ALL Editions)

```
data/compliance/
├── CCI_to_NIST53.csv              # 7,433 rows (ALL)
├── STIG_CCI_Map.csv               # 28,639 rows (ALL)
├── NIST53_to_171.csv              # 123 rows (ALL)
├── NIST171_to_CMMC.csv            # 110 rows (ALL)
└── PQC_Migration_Matrix.csv       # Custom (ALL)
```

### AGI Interface (ALL Editions)

```
pkg/agi/
├── local_llm.go                   # Air-gapped LLM (ALL)
├── chat_handler.go                # HTTP handlers (ALL)
├── compliance_assistant.go        # STIG query helper (ALL)
└── state_manager.go               # Session state (ALL)

pkg/ui/
├── embed.go                       # Embed static files (ALL)
└── static/
    ├── index.html                 # Chat UI (ALL)
    ├── style.css                  # Cyberpunk theme (ALL)
    └── app.js                     # JavaScript (ALL)
```

### License Validation (Premium Only)

```
cmd/sonar/
├── license.go                     # +build premium (license validation)
└── license_stub.go                # +build community (no-op stubs)
```

---

## 🔧 Implementation: Crypto Interface

### interface.go (ALL Editions)

```go
// pkg/crypto/interface.go
package crypto

// CryptoBackend defines the interface for PQC operations
type CryptoBackend interface {
	// Dilithium3 operations
	GenerateDilithiumKey() (publicKey, privateKey []byte, err error)
	SignDilithium(privateKey, message []byte) (signature []byte, err error)
	VerifyDilithium(publicKey, message, signature []byte) bool

	// Kyber1024 operations
	GenerateKyberKey() (publicKey, privateKey []byte, err error)
	EncapsulateKyber(publicKey []byte) (ciphertext, sharedSecret []byte, err error)
	DecapsulateKyber(privateKey, ciphertext []byte) (sharedSecret []byte, err error)

	// Metadata
	BackendName() string
	BackendVersion() string
	IsPremium() bool
}

// Global backend (set at initialization)
var Backend CryptoBackend
```

### dilithium_community.go (Community Edition)

```go
// pkg/crypto/dilithium_community.go
// +build community

package crypto

import (
	"github.com/cloudflare/circl/sign/dilithium/mode3"
	"github.com/cloudflare/circl/kem/kyber/kyber1024"
)

type CommunityBackend struct{}

func init() {
	Backend = &CommunityBackend{}
}

func (c *CommunityBackend) GenerateDilithiumKey() ([]byte, []byte, error) {
	pk, sk, err := mode3.GenerateKey(nil)
	if err != nil {
		return nil, nil, err
	}
	pkBytes, _ := pk.MarshalBinary()
	skBytes, _ := sk.MarshalBinary()
	return pkBytes, skBytes, nil
}

func (c *CommunityBackend) SignDilithium(privateKey, message []byte) ([]byte, error) {
	sk := new(mode3.PrivateKey)
	if err := sk.UnmarshalBinary(privateKey); err != nil {
		return nil, err
	}
	return mode3.Sign(sk, message), nil
}

func (c *CommunityBackend) VerifyDilithium(publicKey, message, signature []byte) bool {
	pk := new(mode3.PublicKey)
	if err := pk.UnmarshalBinary(publicKey); err != nil {
		return false
	}
	return mode3.Verify(pk, message, signature)
}

func (c *CommunityBackend) GenerateKyberKey() ([]byte, []byte, error) {
	pk, sk, err := kyber1024.GenerateKeyPair(nil)
	if err != nil {
		return nil, nil, err
	}
	pkBytes, _ := pk.MarshalBinary()
	skBytes, _ := sk.MarshalBinary()
	return pkBytes, skBytes, nil
}

func (c *CommunityBackend) EncapsulateKyber(publicKey []byte) ([]byte, []byte, error) {
	pk := new(kyber1024.PublicKey)
	if err := pk.UnmarshalBinary(publicKey); err != nil {
		return nil, nil, err
	}
	ct, ss, err := kyber1024.Encapsulate(pk)
	return ct, ss, err
}

func (c *CommunityBackend) DecapsulateKyber(privateKey, ciphertext []byte) ([]byte, error) {
	sk := new(kyber1024.PrivateKey)
	if err := sk.UnmarshalBinary(privateKey); err != nil {
		return nil, err
	}
	return kyber1024.Decapsulate(sk, ciphertext), nil
}

func (c *CommunityBackend) BackendName() string    { return "Cloudflare CIRCL" }
func (c *CommunityBackend) BackendVersion() string { return "1.6.1" }
func (c *CommunityBackend) IsPremium() bool        { return false }
```

### dilithium_premium.go (Premium Edition)

```go
// pkg/crypto/dilithium_premium.go
// +build premium

package crypto

import (
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/adinkra"
)

type PremiumBackend struct{}

func init() {
	Backend = &PremiumBackend{}
}

func (p *PremiumBackend) GenerateDilithiumKey() ([]byte, []byte, error) {
	// Uses your proprietary $45M lattice algorithms
	return adinkra.GenerateDilithiumKey()
}

func (p *PremiumBackend) SignDilithium(privateKey, message []byte) ([]byte, error) {
	return adinkra.SignDilithium(privateKey, message)
}

func (p *PremiumBackend) VerifyDilithium(publicKey, message, signature []byte) bool {
	return adinkra.VerifyDilithium(publicKey, message, signature)
}

func (p *PremiumBackend) GenerateKyberKey() ([]byte, []byte, error) {
	return adinkra.GenerateKyberKey()
}

func (p *PremiumBackend) EncapsulateKyber(publicKey []byte) ([]byte, []byte, error) {
	return adinkra.EncapsulateKyber(publicKey)
}

func (p *PremiumBackend) DecapsulateKyber(privateKey, ciphertext []byte) ([]byte, error) {
	return adinkra.DecapsulateKyber(privateKey, ciphertext)
}

func (p *PremiumBackend) BackendName() string    { return "Adinkra Proprietary PQC" }
func (p *PremiumBackend) BackendVersion() string { return "1.0.0" }
func (p *PremiumBackend) IsPremium() bool        { return true }
```

---

## 📊 Comprehensive STIG Validation (ALL Editions)

### validator.go - Core Engine

```go
// pkg/stig/validator.go
package stig

import (
	"fmt"
	"time"
)

// ValidationResult represents the outcome of a STIG validation
type ValidationResult struct {
	Framework      string                 // "RHEL-09-STIG", "NIST-800-53", etc.
	TotalControls  int                    // Total controls checked
	Passed         int                    // Controls passed
	Failed         int                    // Controls failed
	NotApplicable  int                    // Controls not applicable
	Findings       []Finding              // Detailed findings
	ExecutedAt     time.Time              // When validation ran
	Duration       time.Duration          // How long it took
	Metadata       map[string]interface{} // Additional context
}

// Finding represents a single control check result
type Finding struct {
	ControlID      string   // e.g., "RHEL-09-001234", "AC-2"
	Title          string   // Human-readable title
	Severity       string   // "CAT I", "CAT II", "CAT III", "High", "Medium", "Low"
	Status         string   // "Pass", "Fail", "Not Applicable"
	Evidence       string   // What was checked
	Remediation    string   // How to fix if failed
	CrossReferences []string // Related controls in other frameworks
}

// ValidateAll runs comprehensive STIG validation across all frameworks
func ValidateAll(targetPath string) (*ComprehensiveReport, error) {
	report := &ComprehensiveReport{
		TargetPath: targetPath,
		StartTime:  time.Now(),
		Results:    make(map[string]*ValidationResult),
	}

	// Run all framework validations in parallel
	frameworks := []struct {
		name      string
		validator func(string) (*ValidationResult, error)
	}{
		{"RHEL-09-STIG-V1R3", ValidateRHEL09STIG},
		{"CIS-Benchmark", ValidateCISBenchmark},
		{"NIST-800-53-Rev5", ValidateNIST80053},
		{"NIST-800-171-Rev2", ValidateNIST800171},
		{"CMMC-3.0-Level3", ValidateCMMC30},
		{"PQC-Migration", ValidatePQCMigration},
	}

	for _, fw := range frameworks {
		result, err := fw.validator(targetPath)
		if err != nil {
			return nil, fmt.Errorf("validation failed for %s: %w", fw.name, err)
		}
		report.Results[fw.name] = result
	}

	report.EndTime = time.Now()
	report.Duration = report.EndTime.Sub(report.StartTime)

	// Build cross-framework mappings
	report.BuildCrossReferences()

	// Calculate blast radius for PQC migration
	report.CalculatePQCBlastRadius()

	return report, nil
}

// ComprehensiveReport aggregates results across all frameworks
type ComprehensiveReport struct {
	TargetPath        string
	StartTime         time.Time
	EndTime           time.Time
	Duration          time.Duration
	Results           map[string]*ValidationResult
	CrossReferences   map[string][]string // ControlID → related controls
	PQCBlastRadius    *BlastRadiusAnalysis
	POAMItems         []POAMItem
	ExecutiveSummary  ExecutiveSummary
}

// BlastRadiusAnalysis shows PQC migration impact
type BlastRadiusAnalysis struct {
	TotalCryptoAssets        int // Total cryptographic assets discovered
	QuantumVulnerable        int // Assets vulnerable to quantum attacks
	RequiresPQCMigration     int // Assets requiring PQC migration
	EstimatedEffortHours     int // Estimated migration effort
	CriticalPathDependencies []string
	RiskScore                float64 // 0.0 - 10.0
}

// POAMItem represents a Plan of Action & Milestones item
type POAMItem struct {
	ID               string
	ControlID        string
	Framework        string
	Weakness         string
	Resources        string
	ScheduledCompletion time.Time
	Milestones       []Milestone
	Status           string
	Risk             string
}

// Milestone represents a step in the POA&M
type Milestone struct {
	Description    string
	TargetDate     time.Time
	CompletionDate *time.Time
	Status         string
}

// ExecutiveSummary provides high-level overview for leadership
type ExecutiveSummary struct {
	OverallScore      float64  // 0.0 - 100.0
	TotalControls     int
	ComplianceRate    float64  // Percentage
	CriticalFindings  int      // CAT I / High
	MediumFindings    int      // CAT II / Medium
	LowFindings       int      // CAT III / Low
	TopRisks          []string
	RecommendedActions []string
}
```

---

## 📄 Export Formats (ALL Editions)

### CSV Export

```go
// pkg/stig/csv_export.go
package stig

import (
	"encoding/csv"
	"os"
)

// ExportToCSV generates bulk data export for analysis
func (r *ComprehensiveReport) ExportToCSV(outputPath string) error {
	file, err := os.Create(outputPath)
	if err != nil {
		return err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	// Header row
	header := []string{
		"Framework",
		"Control ID",
		"Title",
		"Severity",
		"Status",
		"Evidence",
		"Remediation",
		"STIG ID",
		"CCI",
		"NIST 800-53",
		"NIST 800-171",
		"CMMC 3.0",
	}
	writer.Write(header)

	// Data rows (with cross-framework mapping)
	for framework, result := range r.Results {
		for _, finding := range result.Findings {
			row := []string{
				framework,
				finding.ControlID,
				finding.Title,
				finding.Severity,
				finding.Status,
				finding.Evidence,
				finding.Remediation,
			}

			// Add cross-references
			refs := r.CrossReferences[finding.ControlID]
			row = append(row, refs...)

			writer.Write(row)
		}
	}

	return nil
}
```

### PDF Executive Brief

```go
// pkg/stig/pdf_export.go
package stig

import (
	"github.com/jung-kurt/gofpdf"
)

// ExportToPDF generates executive summary as PDF Intel Brief
func (r *ComprehensiveReport) ExportToPDF(outputPath string) error {
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.AddPage()

	// Title page
	pdf.SetFont("Arial", "B", 24)
	pdf.Cell(0, 20, "EXECUTIVE INTELLIGENCE BRIEF")
	pdf.Ln(10)

	pdf.SetFont("Arial", "", 12)
	pdf.Cell(0, 10, "Cybersecurity Compliance Assessment")
	pdf.Ln(5)
	pdf.Cell(0, 10, "Classification: UNCLASSIFIED")
	pdf.Ln(15)

	// Executive Summary
	pdf.SetFont("Arial", "B", 16)
	pdf.Cell(0, 10, "EXECUTIVE SUMMARY")
	pdf.Ln(8)

	pdf.SetFont("Arial", "", 11)
	summary := r.ExecutiveSummary
	pdf.MultiCell(0, 5, fmt.Sprintf(
		"Overall Compliance Score: %.1f%%\n"+
			"Total Controls Assessed: %d\n"+
			"Critical Findings (CAT I/High): %d\n"+
			"Medium Findings (CAT II): %d\n"+
			"Low Findings (CAT III/Low): %d",
		summary.ComplianceRate,
		summary.TotalControls,
		summary.CriticalFindings,
		summary.MediumFindings,
		summary.LowFindings,
	))
	pdf.Ln(10)

	// PQC Blast Radius
	if r.PQCBlastRadius != nil {
		pdf.SetFont("Arial", "B", 14)
		pdf.Cell(0, 10, "POST-QUANTUM MIGRATION IMPACT ANALYSIS")
		pdf.Ln(8)

		pdf.SetFont("Arial", "", 11)
		pdf.MultiCell(0, 5, fmt.Sprintf(
			"Total Cryptographic Assets: %d\n"+
				"Quantum-Vulnerable Assets: %d\n"+
				"Requiring PQC Migration: %d\n"+
				"Estimated Effort: %d hours\n"+
				"Risk Score: %.1f/10.0",
			r.PQCBlastRadius.TotalCryptoAssets,
			r.PQCBlastRadius.QuantumVulnerable,
			r.PQCBlastRadius.RequiresPQCMigration,
			r.PQCBlastRadius.EstimatedEffortHours,
			r.PQCBlastRadius.RiskScore,
		))
		pdf.Ln(10)
	}

	// Top Recommendations
	pdf.SetFont("Arial", "B", 14)
	pdf.Cell(0, 10, "RECOMMENDED ACTIONS")
	pdf.Ln(8)

	pdf.SetFont("Arial", "", 11)
	for i, action := range summary.RecommendedActions {
		pdf.MultiCell(0, 5, fmt.Sprintf("%d. %s", i+1, action))
	}

	// Framework-specific sections
	for framework, result := range r.Results {
		pdf.AddPage()
		pdf.SetFont("Arial", "B", 16)
		pdf.Cell(0, 10, framework)
		pdf.Ln(8)

		pdf.SetFont("Arial", "", 10)
		pdf.MultiCell(0, 5, fmt.Sprintf(
			"Total Controls: %d\nPassed: %d\nFailed: %d\nN/A: %d",
			result.TotalControls,
			result.Passed,
			result.Failed,
			result.NotApplicable,
		))
	}

	return pdf.OutputFileAndClose(outputPath)
}
```

---

## 🎯 CLI Implementation

### `adinkhepra validate` (ALL Editions)

```go
// cmd/adinkhepra/cmd_validate.go
package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/crypto"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/stig"
)

func runValidate(targetPath string, exportCSV, exportPDF bool) error {
	fmt.Println("🔍 AdinKhepra Comprehensive Validation System")
	fmt.Println("=" * 60)
	fmt.Printf("Edition: %s\n", edition)
	fmt.Printf("Crypto Backend: %s\n\n", crypto.Backend.BackendName())

	// 1. Crypto validation
	fmt.Print("Testing PQC keygen... ")
	pk, sk, err := crypto.Backend.GenerateDilithiumKey()
	if err != nil {
		return fmt.Errorf("keygen failed: %w", err)
	}
	fmt.Printf("✅ OK (pk: %d bytes, sk: %d bytes)\n", len(pk), len(sk))

	// 2. Comprehensive STIG validation
	fmt.Println("\n📋 Running Comprehensive STIG Validation...")
	report, err := stig.ValidateAll(targetPath)
	if err != nil {
		return fmt.Errorf("validation failed: %w", err)
	}

	// 3. Display summary
	fmt.Println("\n" + "=" * 60)
	fmt.Println("VALIDATION RESULTS")
	fmt.Println("=" * 60)

	for framework, result := range report.Results {
		fmt.Printf("\n%s:\n", framework)
		fmt.Printf("  Total: %d | Pass: %d | Fail: %d | N/A: %d\n",
			result.TotalControls, result.Passed, result.Failed, result.NotApplicable)
	}

	// 4. PQC Blast Radius
	if report.PQCBlastRadius != nil {
		fmt.Println("\n" + "=" * 60)
		fmt.Println("POST-QUANTUM MIGRATION IMPACT")
		fmt.Println("=" * 60)
		fmt.Printf("Quantum-Vulnerable Assets: %d\n", report.PQCBlastRadius.QuantumVulnerable)
		fmt.Printf("Estimated Migration Effort: %d hours\n", report.PQCBlastRadius.EstimatedEffortHours)
		fmt.Printf("Risk Score: %.1f/10.0\n", report.PQCBlastRadius.RiskScore)
	}

	// 5. Export reports
	if exportCSV {
		csvPath := filepath.Join(targetPath, "compliance_report.csv")
		fmt.Printf("\n📊 Exporting CSV report to: %s\n", csvPath)
		if err := report.ExportToCSV(csvPath); err != nil {
			return fmt.Errorf("CSV export failed: %w", err)
		}
		fmt.Println("✅ CSV export complete")
	}

	if exportPDF {
		pdfPath := filepath.Join(targetPath, "executive_brief.pdf")
		fmt.Printf("\n📄 Generating Executive Intelligence Brief: %s\n", pdfPath)
		if err := report.ExportToPDF(pdfPath); err != nil {
			return fmt.Errorf("PDF export failed: %w", err)
		}
		fmt.Println("✅ PDF export complete")
	}

	// 6. POA&M Builder
	if len(report.POAMItems) > 0 {
		poamPath := filepath.Join(targetPath, "POAM.csv")
		fmt.Printf("\n📝 Generating POA&M (Plan of Action & Milestones): %s\n", poamPath)
		if err := report.ExportPOAM(poamPath); err != nil {
			return fmt.Errorf("POA&M export failed: %w", err)
		}
		fmt.Println("✅ POA&M export complete")
	}

	fmt.Println("\n🎉 Validation complete!")
	return nil
}
```

---

**This architecture gives Community Edition users incredible value (full STIG suite + AGI) while reserving proprietary crypto for Premium. Ready to implement?**