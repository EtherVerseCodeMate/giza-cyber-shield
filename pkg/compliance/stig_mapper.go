package compliance

import (
	"encoding/csv"
	"fmt"
	"log"
	"os"
	"strings"
)

// STIGRule represents a DISA STIG security control
type STIGRule struct {
	STIGID       string
	Title        string
	Severity     string
	CCIID        string
	STIGFile     string
	NIST53Ref    string   // From CCI mapping
	NIST171Refs  []string // From NIST 800-171 mapping
	CMMCControls []string // Derived from NIST 800-171
}

// ComplianceMapper holds the complete STIG→CCI→NIST 800-53→NIST 800-171→CMMC mapping chain
type ComplianceMapper struct {
	STIGRules       map[string]*STIGRule      // STIG_ID → Rule
	CCItoNIST53     map[string][]string       // CCI_ID → NIST 800-53 refs
	NIST53to171     map[string]string         // NIST 800-53 → NIST 800-171
	NIST171toCMMC   map[string]string         // NIST 800-171 → CMMC control
	ControlFamilies map[string]string         // NIST 800-171 → Family name
}

// NewComplianceMapper loads the full STIG-CMMC-NIST mapping chain
func NewComplianceMapper() *ComplianceMapper {
	cm := &ComplianceMapper{
		STIGRules:       make(map[string]*STIGRule),
		CCItoNIST53:     make(map[string][]string),
		NIST53to171:     make(map[string]string),
		NIST171toCMMC:   make(map[string]string),
		ControlFamilies: make(map[string]string),
	}

	// Load mapping files in sequence
	if err := cm.LoadSTIGCCIMap("docs/STIG_CCI_Map.csv"); err != nil {
		log.Printf("[COMPLIANCE] Failed to load STIG-CCI map: %v", err)
	}

	if err := cm.LoadCCItoNIST53("docs/CCI_to_NIST53.csv"); err != nil {
		log.Printf("[COMPLIANCE] Failed to load CCI-to-NIST53 map: %v", err)
	}

	if err := cm.LoadNIST53to171("docs/NIST53_to_171.csv"); err != nil {
		log.Printf("[COMPLIANCE] Failed to load NIST53-to-171 map: %v", err)
	}

	// Build NIST 800-171 to CMMC mapping (direct correspondence for Level 1-3)
	cm.buildNIST171toCMMCMap()

	log.Printf("[COMPLIANCE] Loaded %d STIG rules with full CMMC traceability", len(cm.STIGRules))

	return cm
}

// LoadSTIGCCIMap loads the STIG_CCI_Map.csv (28K+ STIG rules)
func (cm *ComplianceMapper) LoadSTIGCCIMap(path string) error {
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()

	reader := csv.NewReader(file)
	records, err := reader.ReadAll()
	if err != nil {
		return err
	}

	// Skip header
	for i, record := range records {
		if i == 0 {
			continue
		}
		if len(record) < 5 {
			continue
		}

		stigID := record[0]
		title := record[1]
		severity := record[2]
		cciID := record[3]
		stigFile := record[4]

		cm.STIGRules[stigID] = &STIGRule{
			STIGID:   stigID,
			Title:    title,
			Severity: severity,
			CCIID:    cciID,
			STIGFile: stigFile,
		}
	}

	return nil
}

// LoadCCItoNIST53 loads CCI_to_NIST53.csv mapping
func (cm *ComplianceMapper) LoadCCItoNIST53(path string) error {
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()

	reader := csv.NewReader(file)
	records, err := reader.ReadAll()
	if err != nil {
		return err
	}

	for i, record := range records {
		if i == 0 {
			continue
		}
		if len(record) < 2 {
			continue
		}

		cciID := record[0]
		nist53Ref := record[1]

		cm.CCItoNIST53[cciID] = append(cm.CCItoNIST53[cciID], nist53Ref)
	}

	return nil
}

// LoadNIST53to171 loads NIST53_to_171.csv mapping
func (cm *ComplianceMapper) LoadNIST53to171(path string) error {
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()

	reader := csv.NewReader(file)
	records, err := reader.ReadAll()
	if err != nil {
		return err
	}

	for i, record := range records {
		if i == 0 {
			continue
		}
		if len(record) < 3 {
			continue
		}

		nist171Ref := record[0]
		nist53Ref := record[1]
		family := record[2]

		cm.NIST53to171[nist53Ref] = nist171Ref
		cm.ControlFamilies[nist171Ref] = family
	}

	return nil
}

// buildNIST171toCMMCMap creates NIST 800-171 to CMMC control mapping
// CMMC 2.0 Level 1-3 directly corresponds to NIST 800-171 controls
func (cm *ComplianceMapper) buildNIST171toCMMCMap() {
	// CMMC Level 1 (17 controls) - subset of 800-171
	level1Controls := []string{
		"3.1.1", "3.1.2", "3.1.20", "3.1.22", // Access Control
		"3.4.1", "3.4.2", // Configuration Management
		"3.5.1", "3.5.2", // Identification and Authentication
		"3.11.1", "3.11.2", // Risk Assessment
		"3.12.1", "3.12.2", // Security Assessment
		"3.13.1", "3.13.2", "3.13.5", // System and Communications Protection
		"3.14.1", "3.14.2", "3.14.6", "3.14.7", // System and Information Integrity
	}

	for _, ctrl := range level1Controls {
		cm.NIST171toCMMC[ctrl] = fmt.Sprintf("CMMC L1: %s", ctrl)
	}

	// All 110 NIST 800-171 controls map to CMMC Level 2
	// (Simplified - full mapping would include all 3.x.x controls)
	// For now, mark all controls as CMMC Level 2 compliant
	for nist171 := range cm.ControlFamilies {
		if cm.NIST171toCMMC[nist171] == "" {
			cm.NIST171toCMMC[nist171] = fmt.Sprintf("CMMC L2: %s", nist171)
		}
	}
}

// MapSTIGtoCMMC traces a STIG finding through the entire compliance chain
func (cm *ComplianceMapper) MapSTIGtoCMMC(stigID string) (*STIGRule, error) {
	rule, ok := cm.STIGRules[stigID]
	if !ok {
		return nil, fmt.Errorf("STIG rule not found: %s", stigID)
	}

	// Trace CCI → NIST 800-53
	if nist53Refs, ok := cm.CCItoNIST53[rule.CCIID]; ok {
		if len(nist53Refs) > 0 {
			rule.NIST53Ref = nist53Refs[0]
		}
	}

	// Trace NIST 800-53 → NIST 800-171
	if nist171, ok := cm.NIST53to171[rule.NIST53Ref]; ok {
		rule.NIST171Refs = append(rule.NIST171Refs, nist171)
	}

	// Trace NIST 800-171 → CMMC
	for _, nist171 := range rule.NIST171Refs {
		if cmmc, ok := cm.NIST171toCMMC[nist171]; ok {
			rule.CMMCControls = append(rule.CMMCControls, cmmc)
		}
	}

	return rule, nil
}

// FindSTIGsByPort returns STIG rules relevant to a specific network port
func (cm *ComplianceMapper) FindSTIGsByPort(port int) []*STIGRule {
	var matches []*STIGRule

	// Port-based STIG matching (heuristic)
	portKeywords := map[int][]string{
		22:   {"SSH", "Secure Shell"},
		23:   {"Telnet"},
		80:   {"HTTP", "Web Server"},
		443:  {"HTTPS", "TLS", "SSL"},
		3389: {"RDP", "Remote Desktop"},
		3306: {"MySQL", "Database"},
		5432: {"PostgreSQL", "Database"},
		1433: {"SQL Server", "Database"},
	}

	keywords, ok := portKeywords[port]
	if !ok {
		return matches
	}

	for _, rule := range cm.STIGRules {
		for _, keyword := range keywords {
			if strings.Contains(rule.Title, keyword) || strings.Contains(rule.STIGFile, keyword) {
				matches = append(matches, rule)
				break
			}
		}
	}

	return matches
}

// GenerateCMMCScorecard produces a compliance scorecard for a snapshot
func (cm *ComplianceMapper) GenerateCMMCScorecard() *CMMCScorecard {
	scorecard := &CMMCScorecard{
		Level:          2,
		TotalControls:  110,
		PassingCount:   0,
		FailingCount:   0,
		ControlStatus:  make(map[string]string),
		ControlGaps:    []string{},
	}

	// TODO: Map actual snapshot findings to control status
	// For now, return placeholder scorecard

	return scorecard
}

// CMMCScorecard represents compliance status
type CMMCScorecard struct {
	Level         int
	TotalControls int
	PassingCount  int
	FailingCount  int
	ControlStatus map[string]string // Control ID → "PASSING" | "FAILING"
	ControlGaps   []string
}

// FormatScorecard generates markdown table of compliance status
func (sc *CMMCScorecard) FormatScorecard() string {
	passingPct := float64(sc.PassingCount) / float64(sc.TotalControls) * 100
	failingPct := float64(sc.FailingCount) / float64(sc.TotalControls) * 100

	status := "NOT READY FOR CERTIFICATION"
	if passingPct >= 90 {
		status = "READY FOR CERTIFICATION"
	} else if passingPct >= 75 {
		status = "NEAR COMPLIANCE"
	}

	return fmt.Sprintf(`
### CMMC Level %d Assessment (%d Controls)

- **Passing:** %d controls (%.0f%%)
- **Failing:** %d controls (%.0f%%)
- **Status:** %s

**Compliance Score:** %.1f/100
`,
		sc.Level,
		sc.TotalControls,
		sc.PassingCount,
		passingPct,
		sc.FailingCount,
		failingPct,
		status,
		passingPct,
	)
}
