package main

// Tool: generate_mapping
// Joins STIG_CCI_Map + CCI_to_NIST53 + NIST53_to_171 + NIST53_to_172 → complete cross-reference CSV
// Output: docs/CCI_STIG_NIST_CMMC_Complete.csv
//
// Chain: STIG_ID → CCI_ID → NIST_53_Ref → NIST_171_Ref → NIST_172_Ref → CMMC_Practice → CMMC_Level
//
// Usage:
//   go run tools/generate_mapping/main.go
//   go run tools/generate_mapping/main.go --stig-cci   pkg/stig/data/STIG_CCI_Map.csv \
//                                          --cci-53    pkg/stig/data/CCI_to_NIST53.csv \
//                                          --53-171    pkg/stig/data/NIST53_to_171.csv \
//                                          --53-172    pkg/stig/data/NIST53_to_172.csv \
//                                          --output    docs/CCI_STIG_NIST_CMMC_Complete.csv

import (
	"encoding/csv"
	"flag"
	"fmt"
	"os"
	"sort"
	"strings"
)

// Row is the complete cross-reference record spanning the full compliance chain:
// STIG → CCI → NIST 800-53 → NIST 800-171/172 → CMMC L1/L2/L3 + SPRS weight
type Row struct {
	STIGID       string
	STIGTitle    string
	STIGSeverity string
	STIGFile     string
	CCIID        string
	CCIDef       string
	NIST53Refs   string // semicolon-separated if multiple
	NIST171Refs  string // semicolon-separated if multiple
	NIST172Refs  string
	Family       string
	CMMCLevel1   string // e.g. "AC.L1-3.1.1"
	CMMCLevel2   string // e.g. "AC.L2-3.1.1"
	CMMCLevel3   string // e.g. "AC.L3-3.1.1e"
	SPRSWeight   string // 1, 3, or 5
}

func main() {

	stigCCIPath := flag.String("stig-cci", "pkg/stig/data/STIG_CCI_Map.csv", "STIG → CCI map")
	cci53Path := flag.String("cci-53", "pkg/stig/data/CCI_to_NIST53.csv", "CCI → NIST 800-53 map")
	n53_171Path := flag.String("53-171", "pkg/stig/data/NIST53_to_171.csv", "NIST 800-53 → 800-171 map")
	n53_172Path := flag.String("53-172", "pkg/stig/data/NIST53_to_172.csv", "NIST 800-53 → 800-172 map")
	outputPath := flag.String("output", "docs/CCI_STIG_NIST_CMMC_Complete.csv", "Output complete mapping CSV")
	flag.Parse()

	fmt.Println("╔══════════════════════════════════════════════════════════════╗")
	fmt.Println("║   KHEPRA MAPPING GENERATOR — CCI-STIG-NIST-CMMC Complete    ║")
	fmt.Println("╚══════════════════════════════════════════════════════════════╝")

	// ── Load STIG → CCI ────────────────────────────────────────────────────
	fmt.Printf("[1/5] Loading STIG_CCI_Map... ")
	stigToCCI, stigTitles, stigSeverities, stigFiles := loadSTIGCCI(*stigCCIPath)
	fmt.Printf("%d rules\n", len(stigToCCI))

	// ── Load CCI → NIST 800-53 ─────────────────────────────────────────────
	fmt.Printf("[2/5] Loading CCI_to_NIST53... ")
	cciToNIST53, cciDefs := loadCCItoNIST53(*cci53Path)
	totalCCI := 0
	for _, refs := range cciToNIST53 {
		totalCCI += len(refs)
	}
	fmt.Printf("%d CCI entries (%d CCI→53 mappings)\n", len(cciToNIST53), totalCCI)

	// ── Load NIST 800-53 → 800-171 ─────────────────────────────────────────
	fmt.Printf("[3/5] Loading NIST53_to_171... ")
	nist53to171, families171 := loadNIST53to171(*n53_171Path)
	fmt.Printf("%d 53→171 mappings\n", len(nist53to171))

	// ── Load NIST 800-53 → 800-172 ─────────────────────────────────────────
	fmt.Printf("[4/5] Loading NIST53_to_172... ")
	nist53to172, families172 := loadNIST53to172(*n53_172Path)
	fmt.Printf("%d 53→172 mappings\n", len(nist53to172))

	// ── Build complete cross-reference ──────────────────────────────────────
	fmt.Printf("[5/5] Building complete CCI-STIG-NIST-CMMC mapping...\n")

	// CMMC Level 1 practices (17 of 110)
	cmmc_l1 := map[string]bool{
		"3.1.1": true, "3.1.2": true, "3.1.20": true, "3.1.22": true,
		"3.4.1": true, "3.4.2": true,
		"3.5.1": true, "3.5.2": true,
		"3.11.1": true, "3.11.2": true,
		"3.12.1": true, "3.12.2": true,
		"3.13.1": true, "3.13.2": true, "3.13.5": true,
		"3.14.1": true, "3.14.2": true, "3.14.6": true, "3.14.7": true,
	}

	// CMMC domain codes
	domainCode := map[string]string{
		"Access Control":                       "AC",
		"Awareness and Training":               "AT",
		"Audit and Accountability":             "AU",
		"Configuration Management":             "CM",
		"Identification and Authentication":    "IA",
		"Incident Response":                    "IR",
		"Maintenance":                          "MA",
		"Media Protection":                     "MP",
		"Personnel Security":                   "PS",
		"Physical Protection":                  "PE",
		"Risk Assessment":                      "RA",
		"Security Assessment":                  "CA",
		"System and Communications Protection": "SC",
		"System and Information Integrity":     "SI",
	}

	// SPRS weights by domain
	sprsWeight := map[string]string{
		"AC": "5", "IA": "5", "SC": "5",
		"AU": "3", "CM": "3", "IR": "3", "RA": "3", "CA": "3", "SI": "3",
		"AT": "1", "MA": "1", "MP": "1", "PE": "1", "PS": "1",
	}

	var rows []Row
	unmapped := 0

	// Sort STIG IDs for deterministic output
	stigIDs := make([]string, 0, len(stigToCCI))
	for id := range stigToCCI {
		stigIDs = append(stigIDs, id)
	}
	sort.Strings(stigIDs)

	for _, stigID := range stigIDs {
		cciID := stigToCCI[stigID]
		cciDef := cciDefs[cciID]

		// CCI → NIST 800-53 (may be 1:many)
		nist53refs := cciToNIST53[cciID]
		if len(nist53refs) == 0 {
			unmapped++
		}

		// Deduplicate refs
		nist53refs = dedup(nist53refs)

		// NIST 800-53 refs → NIST 800-171 refs (collect unique)
		nist171set := map[string]bool{}
		nist172set := map[string]bool{}
		familySet := map[string]bool{}

		for _, n53 := range nist53refs {
			// Normalize: strip trailing notes (e.g. "AC-3 a" → "AC-3")
			base := normalizeNIST53Ref(n53)
			if n171, ok := nist53to171[base]; ok {
				nist171set[n171] = true
				if f, ok := families171[n171]; ok {
					familySet[f] = true
				}
			}
			if n172, ok := nist53to172[base]; ok {
				nist172set[n172] = true
				if f, ok := families172[n172]; ok {
					familySet[f] = true
				}
			}
		}

		nist171list := sortedKeys(nist171set)
		nist172list := sortedKeys(nist172set)
		families := sortedKeys(familySet)
		family := strings.Join(families, "; ")

		// CMMC practice derivation
		cmmcL1 := ""
		cmmcL2 := ""
		cmmcL3 := ""
		sprs := ""

		for _, n171 := range nist171list {
			domain := domainCode[families171[n171]]
			if domain == "" {
				domain = "GEN"
			}
			if cmmc_l1[n171] {
				if cmmcL1 != "" {
					cmmcL1 += "; "
				}
				cmmcL1 += fmt.Sprintf("%s.L1-%s", domain, n171)
			}
			if cmmcL2 != "" {
				cmmcL2 += "; "
			}
			cmmcL2 += fmt.Sprintf("%s.L2-%s", domain, n171)
			if sprs == "" {
				sprs = sprsWeight[domain]
			}
		}
		for _, n172 := range nist172list {
			domain := domainCode[families172[n172]]
			if domain == "" {
				domain = "GEN"
			}
			if cmmcL3 != "" {
				cmmcL3 += "; "
			}
			cmmcL3 += fmt.Sprintf("%s.L3-%s", domain, n172)
		}

		rows = append(rows, Row{
			STIGID:       stigID,
			STIGTitle:    stigTitles[stigID],
			STIGSeverity: stigSeverities[stigID],
			STIGFile:     stigFiles[stigID],
			CCIID:        cciID,
			CCIDef:       cciDef,
			NIST53Refs:   strings.Join(nist53refs, "; "),
			NIST171Refs:  strings.Join(nist171list, "; "),
			NIST172Refs:  strings.Join(nist172list, "; "),
			Family:       family,
			CMMCLevel1:   cmmcL1,
			CMMCLevel2:   cmmcL2,
			CMMCLevel3:   cmmcL3,
			SPRSWeight:   sprs,
		})
	}

	// ── Write output CSV ─────────────────────────────────────────────────────
	outFile, err := os.Create(*outputPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error creating output: %v\n", err)
		os.Exit(1)
	}
	defer outFile.Close()

	writer := csv.NewWriter(outFile)
	writer.Write([]string{
		"STIG_ID", "STIG_Title", "STIG_Severity", "STIG_File",
		"CCI_ID", "CCI_Definition",
		"NIST_800-53_Refs", "NIST_800-171_Refs", "NIST_800-172_Refs",
		"Control_Family",
		"CMMC_Level1_Practice", "CMMC_Level2_Practice", "CMMC_Level3_Practice",
		"SPRS_Weight",
	})

	for _, r := range rows {
		writer.Write([]string{
			r.STIGID, r.STIGTitle, r.STIGSeverity, r.STIGFile,
			r.CCIID, r.CCIDef,
			r.NIST53Refs, r.NIST171Refs, r.NIST172Refs,
			r.Family,
			r.CMMCLevel1, r.CMMCLevel2, r.CMMCLevel3,
			r.SPRSWeight,
		})
	}
	writer.Flush()

	fmt.Printf("\n✓ Complete mapping: %s\n", *outputPath)
	fmt.Printf("  Total STIG rules:        %d\n", len(rows))
	fmt.Printf("  Rules with CMMC L2:      %d\n", countNonEmpty(rows, func(r Row) string { return r.CMMCLevel2 }))
	fmt.Printf("  Rules with CMMC L1:      %d\n", countNonEmpty(rows, func(r Row) string { return r.CMMCLevel1 }))
	fmt.Printf("  Rules with CMMC L3:      %d\n", countNonEmpty(rows, func(r Row) string { return r.CMMCLevel3 }))
	fmt.Printf("  Rules with no NIST53:    %d (CCI unmapped)\n", unmapped)
	fmt.Printf("\n  Chain: STIG → CCI → NIST 800-53 → NIST 800-171/172 → CMMC L1/L2/L3\n")
}

// ── Helpers ──────────────────────────────────────────────────────────────────

func loadSTIGCCI(path string) (stigToCCI, stigTitles, stigSeverities, stigFiles map[string]string) {
	stigToCCI = map[string]string{}
	stigTitles = map[string]string{}
	stigSeverities = map[string]string{}
	stigFiles = map[string]string{}

	f, err := os.Open(path)
	if err != nil {
		fmt.Fprintf(os.Stderr, "[WARN] Cannot open %s: %v\n", path, err)
		return
	}
	defer f.Close()

	r := csv.NewReader(f)
	rows, _ := r.ReadAll()
	for i, row := range rows {
		if i == 0 || len(row) < 5 {
			continue
		}
		stigToCCI[row[0]] = row[3]
		stigTitles[row[0]] = row[1]
		stigSeverities[row[0]] = row[2]
		stigFiles[row[0]] = row[4]
	}
	return
}

func loadCCItoNIST53(path string) (cciToNIST53 map[string][]string, cciDefs map[string]string) {
	cciToNIST53 = map[string][]string{}
	cciDefs = map[string]string{}

	f, err := os.Open(path)
	if err != nil {
		fmt.Fprintf(os.Stderr, "[WARN] Cannot open %s: %v\n", path, err)
		return
	}
	defer f.Close()

	r := csv.NewReader(f)
	rows, _ := r.ReadAll()
	for i, row := range rows {
		if i == 0 || len(row) < 2 {
			continue
		}
		cciID := row[0]
		n53ref := row[1]
		cciToNIST53[cciID] = append(cciToNIST53[cciID], n53ref)
		if len(row) >= 3 && cciDefs[cciID] == "" {
			cciDefs[cciID] = row[2]
		}
	}
	return
}

func loadNIST53to171(path string) (nist53to171 map[string]string, families map[string]string) {
	nist53to171 = map[string]string{}
	families = map[string]string{}

	f, err := os.Open(path)
	if err != nil {
		fmt.Fprintf(os.Stderr, "[WARN] Cannot open %s: %v\n", path, err)
		return
	}
	defer f.Close()

	r := csv.NewReader(f)
	rows, _ := r.ReadAll()
	for i, row := range rows {
		if i == 0 || len(row) < 3 {
			continue
		}
		n171 := row[0]
		n53 := row[1]
		family := row[2]
		nist53to171[n53] = n171
		families[n171] = family
	}
	return
}

func loadNIST53to172(path string) (nist53to172 map[string]string, families map[string]string) {
	nist53to172 = map[string]string{}
	families = map[string]string{}

	f, err := os.Open(path)
	if err != nil {
		fmt.Fprintf(os.Stderr, "[WARN] Cannot open %s: %v\n", path, err)
		return
	}
	defer f.Close()

	r := csv.NewReader(f)
	rows, _ := r.ReadAll()
	for i, row := range rows {
		if i == 0 || len(row) < 3 {
			continue
		}
		n172 := row[0]
		n53 := row[1]
		family := row[2]
		nist53to172[n53] = n172
		families[n172] = family
	}
	return
}

// normalizeNIST53Ref strips paragraph sub-identifiers from 800-53 refs.
// e.g. "AC-1 a" → "AC-1", "SC-8(1)" stays as-is (enhancement preserved)
func normalizeNIST53Ref(ref string) string {
	ref = strings.TrimSpace(ref)
	// Strip trailing " a", " b 1", etc. (paragraph designators)
	if idx := strings.Index(ref, " "); idx > 0 {
		// Only strip if what follows the space looks like a sub-paragraph (single letter or digit)
		rest := ref[idx+1:]
		if len(rest) <= 3 && !strings.Contains(rest, ".") {
			return ref[:idx]
		}
	}
	return ref
}

func dedup(s []string) []string {
	seen := map[string]bool{}
	out := []string{}
	for _, v := range s {
		v = strings.TrimSpace(v)
		if v != "" && !seen[v] {
			seen[v] = true
			out = append(out, v)
		}
	}
	sort.Strings(out)
	return out
}

func sortedKeys(m map[string]bool) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

func countNonEmpty(rows []Row, fn func(Row) string) int {
	n := 0
	for _, r := range rows {
		if fn(r) != "" {
			n++
		}
	}
	return n
}
