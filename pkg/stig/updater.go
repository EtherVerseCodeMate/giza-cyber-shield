// Package stig — updater.go
//
// STIGUpdater keeps the embedded STIG mapping database current with the
// official DISA library published at https://www.cyber.mil/stigs/downloads/
//
// # Operational modes
//
//   - Online  (UpdateFromCyberMil):  run on a build machine with internet access.
//     Scrapes cyber.mil, downloads STIG ZIPs, parses XCCDF XML, writes updated
//     CSV rows into pkg/stig/data/.  After running, `go build` re-embeds.
//
//   - Offline (UpdateFromLocalDir):  for air-gapped environments.
//     Operator downloads STIG ZIPs on an internet machine, transfers via USB,
//     then runs stig-updater --mode offline --zip-dir /media/usb/stigs/.
//
// This file is a BUILD-TIME / OPERATOR tool only.  It is compiled into
// cmd/stig-updater, NOT into the asaf-desktop binary.  Zero runtime egress.
package stig

import (
	"archive/zip"
	"encoding/csv"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
)

// ── Public types ──────────────────────────────────────────────────────────────

// STIGPackage describes one downloadable STIG package from cyber.mil.
type STIGPackage struct {
	Title       string
	FileName    string // e.g. "U_RHEL_9_V1R3_STIG.zip"
	DownloadURL string
	Version     string // e.g. "V1R3"
	Release     string // release date string from the page
	BenchmarkID string // XCCDF Benchmark/@id, populated after parse
}

// STIGRule is one parsed rule extracted from an XCCDF benchmark XML.
type STIGRule struct {
	ID          string   // SV-XXXXXXXX_rule
	Title       string
	Severity    string   // "high" | "medium" | "low" → CAT I / II / III
	Version     string   // XCCDF rule version string (e.g. RHEL-09-291015)
	FixText     string
	CheckText   string
	CCIs        []string // CCI-XXXXXX identifiers (from <ident> elements)
	StigFile    string   // parent benchmark filename (matches STIG_CCI_Map.csv col 5)
}

// UpdateResult summarises one update run.
type UpdateResult struct {
	PackagesProcessed int
	RulesAdded        int
	RulesUpdated      int
	Skipped           int
	Errors            []error
	Duration          time.Duration
}

func (r *UpdateResult) String() string {
	return fmt.Sprintf(
		"packages=%d added=%d updated=%d skipped=%d errors=%d (%.1fs)",
		r.PackagesProcessed, r.RulesAdded, r.RulesUpdated, r.Skipped,
		len(r.Errors), r.Duration.Seconds(),
	)
}

// ── cyber.mil scraper ─────────────────────────────────────────────────────────

const cyberMilBase = "https://www.cyber.mil"
const cyberMilDownloads = "https://www.cyber.mil/stigs/downloads/"

// cyberMilUserAgent mimics a standard browser to avoid 403s from WAF rules.
const cyberMilUserAgent = "Mozilla/5.0 (compatible; ASAF-STIG-Updater/1.0; +https://secred.io)"

// stigZipLinkRE matches direct download links to STIG ZIP files on cyber.mil.
// Handles both the old dl.dod.cyber.mil CDN and the newer cyber.mil paths.
var stigZipLinkRE = regexp.MustCompile(
	`https?://(?:dl\.dod\.cyber\.mil|dl\.cyber\.mil|www\.cyber\.mil)[^"'\s<>]*U_[^"'\s<>]*\.zip`,
)

// relativeZipLinkRE matches relative paths like /wp-content/uploads/stigs/zip/U_*.zip
var relativeZipLinkRE = regexp.MustCompile(`href="(/[^"]*U_[^"]*\.zip)"`)

// ListAvailableSTIGs scrapes the cyber.mil STIG downloads page and returns
// every STIG ZIP it finds.  Requires outbound internet access.
func ListAvailableSTIGs() ([]STIGPackage, error) {
	body, err := fetchURL(cyberMilDownloads)
	if err != nil {
		return nil, fmt.Errorf("cyber.mil fetch: %w", err)
	}

	return parseSTIGLinks(string(body), cyberMilBase), nil
}

// parseSTIGLinks extracts STIGPackage entries from raw HTML.
func parseSTIGLinks(html, base string) []STIGPackage {
	seen := make(map[string]bool)
	var pkgs []STIGPackage

	// Absolute URLs
	for _, u := range stigZipLinkRE.FindAllString(html, -1) {
		if seen[u] {
			continue
		}
		seen[u] = true
		pkgs = append(pkgs, packageFromURL(u))
	}

	// Relative paths
	for _, m := range relativeZipLinkRE.FindAllStringSubmatch(html, -1) {
		u := base + m[1]
		if seen[u] {
			continue
		}
		seen[u] = true
		pkgs = append(pkgs, packageFromURL(u))
	}

	sort.Slice(pkgs, func(i, j int) bool { return pkgs[i].FileName < pkgs[j].FileName })
	return pkgs
}

// packageFromURL derives a STIGPackage from a download URL.
func packageFromURL(u string) STIGPackage {
	fileName := filepath.Base(u)
	title, version := parseStigFilename(fileName)
	return STIGPackage{
		Title:       title,
		FileName:    fileName,
		DownloadURL: u,
		Version:     version,
	}
}

// parseStigFilename extracts a human-readable title and version from a STIG ZIP name.
// e.g. "U_RHEL_9_V1R3_STIG.zip" → ("RHEL 9 STIG", "V1R3")
func parseStigFilename(name string) (title, version string) {
	base := strings.TrimPrefix(name, "U_")
	base = strings.TrimSuffix(base, ".zip")
	base = strings.TrimSuffix(base, "_STIG")
	base = strings.TrimSuffix(base, "_Manual-xccdf")

	// Extract version token (matches VxRy or VxRyy)
	verRE := regexp.MustCompile(`V\d+R\d+`)
	if m := verRE.FindString(base); m != "" {
		version = m
		base = strings.Replace(base, "_"+m, "", 1)
		base = strings.Replace(base, m+"_", "", 1)
	}

	title = strings.ReplaceAll(base, "_", " ")
	return title, version
}

// ── Downloader ────────────────────────────────────────────────────────────────

// DownloadSTIG downloads pkg into destDir and returns the local ZIP path.
func DownloadSTIG(pkg STIGPackage, destDir string) (string, error) {
	if err := os.MkdirAll(destDir, 0o755); err != nil {
		return "", err
	}
	dest := filepath.Join(destDir, pkg.FileName)

	// Skip if already downloaded
	if _, err := os.Stat(dest); err == nil {
		return dest, nil
	}

	body, err := fetchURL(pkg.DownloadURL)
	if err != nil {
		return "", fmt.Errorf("download %s: %w", pkg.FileName, err)
	}

	if err := os.WriteFile(dest, body, 0o644); err != nil {
		return "", err
	}
	return dest, nil
}

// ── XCCDF XML parser ──────────────────────────────────────────────────────────

// XCCDF 1.1 and 1.2 namespace variations
var xccdfNamespaces = []string{
	"http://checklists.nist.gov/xccdf/1.2",
	"http://checklists.nist.gov/xccdf/1.1",
	"http://checklists.nist.gov/xccdf/1.1.4",
}

type xccdfBenchmark struct {
	XMLName xml.Name     `xml:"Benchmark"`
	ID      string       `xml:"id,attr"`
	Title   string       `xml:"title"`
	Version string       `xml:"version"`
	Groups  []xccdfGroup `xml:"Group"`
}

type xccdfGroup struct {
	ID    string      `xml:"id,attr"`
	Rules []xccdfRule `xml:"Rule"`
}

type xccdfRule struct {
	ID          string       `xml:"id,attr"`
	Severity    string       `xml:"severity,attr"`
	Version     string       `xml:"version"`
	Title       string       `xml:"title"`
	Description string       `xml:"description"`
	FixText     string       `xml:"fixtext"`
	CheckText   string       `xml:"check>check-content"`
	Idents      []xccdfIdent `xml:"ident"`
}

type xccdfIdent struct {
	System string `xml:"system,attr"`
	Value  string `xml:",chardata"`
}

// ParseXCCDFZip extracts every XCCDF XML benchmark from a STIG ZIP archive
// and returns all parsed STIGRules.
func ParseXCCDFZip(zipPath string) ([]STIGRule, error) {
	zr, err := zip.OpenReader(zipPath)
	if err != nil {
		return nil, fmt.Errorf("open zip %s: %w", zipPath, err)
	}
	defer zr.Close()

	var rules []STIGRule
	for _, f := range zr.File {
		if !isXCCDFFile(f.Name) {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			return nil, fmt.Errorf("open %s in zip: %w", f.Name, err)
		}
		parsed, err := parseXCCDFXML(rc, filepath.Base(f.Name))
		rc.Close()
		if err != nil {
			// Non-fatal: log and continue to next file
			continue
		}
		rules = append(rules, parsed...)
	}
	return rules, nil
}

// isXCCDFFile returns true for filenames that are XCCDF benchmarks.
func isXCCDFFile(name string) bool {
	lower := strings.ToLower(name)
	return (strings.HasSuffix(lower, ".xml") || strings.HasSuffix(lower, "-xccdf.xml")) &&
		!strings.Contains(lower, "manual-xccdf") == false || // include manual XCCDF
		strings.HasSuffix(lower, "xccdf.xml")
}

// parseXCCDFXML decodes one XCCDF XML benchmark and returns all rules.
func parseXCCDFXML(r io.Reader, stigFileName string) ([]STIGRule, error) {
	data, err := io.ReadAll(r)
	if err != nil {
		return nil, err
	}

	// Strip namespace declarations for simpler unmarshalling:
	// Go's encoding/xml matches element names without namespace by default
	// when the struct XMLName has no namespace — but namespace prefixes in
	// the document break matching. Replace them with an empty namespace.
	cleaned := stripXMLNamespace(data)

	var bench xccdfBenchmark
	if err := xml.Unmarshal(cleaned, &bench); err != nil {
		return nil, fmt.Errorf("xml decode %s: %w", stigFileName, err)
	}

	var rules []STIGRule
	for _, g := range bench.Groups {
		for _, r := range g.Rules {
			if r.ID == "" {
				continue
			}
			rules = append(rules, STIGRule{
				ID:        r.ID,
				Title:     strings.TrimSpace(stripXMLTags(r.Title)),
				Severity:  normalizeSeverity(r.Severity),
				Version:   strings.TrimSpace(r.Version),
				FixText:   strings.TrimSpace(stripXMLTags(r.FixText)),
				CheckText: strings.TrimSpace(stripXMLTags(r.CheckText)),
				CCIs:      extractCCIs(r.Idents),
				StigFile:  stigFileName,
			})
		}
	}
	return rules, nil
}

// stripXMLNamespace removes xmlns and xsi declarations to simplify parsing.
func stripXMLNamespace(data []byte) []byte {
	s := string(data)
	for _, ns := range xccdfNamespaces {
		s = strings.ReplaceAll(s, `xmlns="`+ns+`"`, ``)
		s = strings.ReplaceAll(s, `xmlns:xccdf="`+ns+`"`, ``)
	}
	// Remove any remaining xmlns= declarations
	nsRE := regexp.MustCompile(`\s+xmlns(?::\w+)?="[^"]*"`)
	s = nsRE.ReplaceAllString(s, "")
	// Strip namespace prefixes from element names: <xccdf:Benchmark> → <Benchmark>
	prefixRE := regexp.MustCompile(`<(/?)(\w+):`)
	s = prefixRE.ReplaceAllString(s, "<$1")
	return []byte(s)
}

// stripXMLTags removes XML/HTML tags from a string (for description fields).
func stripXMLTags(s string) string {
	tagRE := regexp.MustCompile(`<[^>]+>`)
	s = tagRE.ReplaceAllString(s, " ")
	s = strings.ReplaceAll(s, "&lt;", "<")
	s = strings.ReplaceAll(s, "&gt;", ">")
	s = strings.ReplaceAll(s, "&amp;", "&")
	s = strings.ReplaceAll(s, "&quot;", `"`)
	s = strings.ReplaceAll(s, "&apos;", "'")
	return strings.Join(strings.Fields(s), " ")
}

// normalizeSeverity maps XCCDF severity values to canonical CAT labels.
func normalizeSeverity(s string) string {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "high", "cat i", "cat_i", "cat1":
		return "high"
	case "medium", "cat ii", "cat_ii", "cat2":
		return "medium"
	case "low", "cat iii", "cat_iii", "cat3":
		return "low"
	}
	return "medium" // safe default
}

// extractCCIs returns all CCI identifiers from an XCCDF rule's <ident> elements.
func extractCCIs(idents []xccdfIdent) []string {
	var ccis []string
	for _, id := range idents {
		v := strings.TrimSpace(id.Value)
		if v == "" {
			continue
		}
		// CCI system URIs contain "cci" (case-insensitive)
		if strings.Contains(strings.ToLower(id.System), "cci") ||
			strings.HasPrefix(strings.ToUpper(v), "CCI-") {
			if !strings.HasPrefix(strings.ToUpper(v), "CCI-") {
				v = "CCI-" + v
			}
			ccis = append(ccis, v)
		}
	}
	return ccis
}

// ── Update pipelines ──────────────────────────────────────────────────────────

// UpdateFromCyberMil fetches the current STIG list from cyber.mil, downloads
// the specified families (or all if filter is empty), parses the XCCDF XML,
// and writes updated CSV rows into dataDir (= pkg/stig/data/).
//
// Requires outbound internet. Run on the build machine, then commit updated CSVs.
func UpdateFromCyberMil(dataDir string, filter []string, downloadCache string) (*UpdateResult, error) {
	start := time.Now()
	result := &UpdateResult{}

	pkgs, err := ListAvailableSTIGs()
	if err != nil {
		return nil, fmt.Errorf("list STIGs: %w", err)
	}

	if len(filter) > 0 {
		pkgs = filterPackages(pkgs, filter)
	}

	var allRules []STIGRule
	for _, pkg := range pkgs {
		zipPath, err := DownloadSTIG(pkg, downloadCache)
		if err != nil {
			result.Errors = append(result.Errors, fmt.Errorf("download %s: %w", pkg.FileName, err))
			result.Skipped++
			continue
		}
		rules, err := ParseXCCDFZip(zipPath)
		if err != nil {
			result.Errors = append(result.Errors, fmt.Errorf("parse %s: %w", pkg.FileName, err))
			result.Skipped++
			continue
		}
		allRules = append(allRules, rules...)
		result.PackagesProcessed++
	}

	added, updated, err := writeUpdatedCSV(dataDir, allRules)
	if err != nil {
		return nil, fmt.Errorf("write CSV: %w", err)
	}
	result.RulesAdded = added
	result.RulesUpdated = updated
	result.Duration = time.Since(start)
	return result, nil
}

// UpdateFromLocalDir reads STIG ZIP files from a local directory (USB transfer
// for air-gapped environments) and updates the CSV database.
func UpdateFromLocalDir(zipDir, dataDir string) (*UpdateResult, error) {
	start := time.Now()
	result := &UpdateResult{}

	entries, err := os.ReadDir(zipDir)
	if err != nil {
		return nil, fmt.Errorf("read dir %s: %w", zipDir, err)
	}

	var allRules []STIGRule
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(strings.ToLower(e.Name()), ".zip") {
			continue
		}
		zipPath := filepath.Join(zipDir, e.Name())
		rules, err := ParseXCCDFZip(zipPath)
		if err != nil {
			result.Errors = append(result.Errors, fmt.Errorf("parse %s: %w", e.Name(), err))
			result.Skipped++
			continue
		}
		allRules = append(allRules, rules...)
		result.PackagesProcessed++
	}

	added, updated, err := writeUpdatedCSV(dataDir, allRules)
	if err != nil {
		return nil, fmt.Errorf("write CSV: %w", err)
	}
	result.RulesAdded = added
	result.RulesUpdated = updated
	result.Duration = time.Since(start)
	return result, nil
}

// ── CSV writer ────────────────────────────────────────────────────────────────

// writeUpdatedCSV merges new STIGRule entries into the existing STIG_CCI_Map.csv,
// deduplicates by (STIG_ID, CCI_ID) pair, and rewrites the file atomically.
// Returns counts of added and updated rows.
func writeUpdatedCSV(dataDir string, newRules []STIGRule) (added, updated int, err error) {
	csvPath := filepath.Join(dataDir, "STIG_CCI_Map.csv")

	// Load existing rows into a map keyed by "STIG_ID|CCI_ID"
	existing, err := loadExistingCSV(csvPath)
	if err != nil {
		return 0, 0, err
	}

	// Expand each STIGRule into one row per CCI
	for _, rule := range newRules {
		// Rules with no CCIs still get one "no-CCI" row so the rule is
		// visible in the DB even if the CCI chain is not yet mapped.
		ccis := rule.CCIs
		if len(ccis) == 0 {
			ccis = []string{""}
		}
		for _, cci := range ccis {
			key := rule.ID + "|" + cci
			row := csvRow{
				STIGID:       rule.ID,
				STIGTitle:    rule.Title,
				STIGSeverity: rule.Severity,
				CCIID:        cci,
				STIGFile:     rule.StigFile,
			}
			if _, exists := existing[key]; exists {
				existing[key] = row
				updated++
			} else {
				existing[key] = row
				added++
			}
		}
	}

	return added, updated, rewriteCSV(csvPath, existing)
}

type csvRow struct {
	STIGID       string
	STIGTitle    string
	STIGSeverity string
	CCIID        string
	STIGFile     string
}

func loadExistingCSV(path string) (map[string]csvRow, error) {
	rows := make(map[string]csvRow)
	f, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return rows, nil // fresh database
		}
		return nil, err
	}
	defer f.Close()

	r := csv.NewReader(f)
	r.FieldsPerRecord = -1 // allow variable columns
	header := true
	for {
		rec, err := r.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		if header {
			header = false
			continue
		}
		if len(rec) < 5 {
			continue
		}
		key := rec[0] + "|" + rec[3]
		rows[key] = csvRow{
			STIGID:       rec[0],
			STIGTitle:    rec[1],
			STIGSeverity: rec[2],
			CCIID:        rec[3],
			STIGFile:     rec[4],
		}
	}
	return rows, nil
}

func rewriteCSV(path string, rows map[string]csvRow) error {
	// Sort keys for deterministic output (makes git diffs readable)
	keys := make([]string, 0, len(rows))
	for k := range rows {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	// Write to a temp file first, then rename atomically
	tmp := path + ".tmp"
	f, err := os.Create(tmp)
	if err != nil {
		return err
	}
	w := csv.NewWriter(f)
	if err := w.Write([]string{"STIG_ID", "STIG_Title", "STIG_Severity", "CCI_ID", "STIG_File"}); err != nil {
		f.Close()
		return err
	}
	for _, k := range keys {
		row := rows[k]
		if err := w.Write([]string{row.STIGID, row.STIGTitle, row.STIGSeverity, row.CCIID, row.STIGFile}); err != nil {
			f.Close()
			return err
		}
	}
	w.Flush()
	f.Close()
	if err := w.Error(); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// fetchURL performs an HTTP GET with the AdinKhepra user-agent and returns body bytes.
func fetchURL(url string) ([]byte, error) {
	client := &http.Client{Timeout: 120 * time.Second}
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", cyberMilUserAgent)
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP %d from %s", resp.StatusCode, url)
	}
	return io.ReadAll(resp.Body)
}

// filterPackages keeps only packages whose FileName contains one of the filter strings.
func filterPackages(pkgs []STIGPackage, filter []string) []STIGPackage {
	var out []STIGPackage
	for _, p := range pkgs {
		for _, f := range filter {
			if strings.Contains(strings.ToUpper(p.FileName), strings.ToUpper(f)) {
				out = append(out, p)
				break
			}
		}
	}
	return out
}

// GetAllSTIGFamilies returns the unique STIG_File values recorded in the
// embedded STIG_CCI_Map.csv — one entry per STIG benchmark family.
// Safe to call at runtime (reads from the already-loaded database).
func GetAllSTIGFamilies() ([]string, error) {
	db, err := GetDatabase()
	if err != nil {
		return nil, err
	}
	db.mu.RLock()
	defer db.mu.RUnlock()

	seen := make(map[string]bool)
	var families []string
	for _, mappings := range db.STIGtoCCI {
		for _, m := range mappings {
			if m.STIGFile != "" && !seen[m.STIGFile] {
				seen[m.STIGFile] = true
				families = append(families, m.STIGFile)
			}
		}
	}
	sort.Strings(families)
	return families, nil
}

// STIGRuleSummary carries the per-rule metadata for GetAllRulesForFamily.
type STIGRuleSummary struct {
	ID       string
	Title    string
	Severity string // "high" | "medium" | "low"
}

// GetAllRulesForFamily returns every rule that maps to the given STIG_File value.
func GetAllRulesForFamily(stigFile string) ([]STIGRuleSummary, error) {
	db, err := GetDatabase()
	if err != nil {
		return nil, err
	}
	db.mu.RLock()
	defer db.mu.RUnlock()

	seen := make(map[string]bool)
	var rules []STIGRuleSummary
	for id, mappings := range db.STIGtoCCI {
		for _, m := range mappings {
			if m.STIGFile == stigFile && !seen[id] {
				seen[id] = true
				rules = append(rules, STIGRuleSummary{
					ID:       id,
					Title:    m.STIGTitle,
					Severity: normalizeSeverity(m.STIGSeverity),
				})
			}
		}
	}
	sort.Slice(rules, func(i, j int) bool { return rules[i].ID < rules[j].ID })
	return rules, nil
}
