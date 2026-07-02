// cmd/stig-updater — AdinKhepra STIG Database Updater
//
// Downloads STIG packages from https://www.cyber.mil/stigs/downloads/ and
// updates the embedded compliance mapping database in pkg/stig/data/.
// Run this on a build machine (internet or USB-import), then rebuild asaf-desktop
// to re-embed the updated CSV files.
//
// Usage:
//
//	stig-updater --mode online  [--filter RHEL_9,Windows_11] [--out pkg/stig/data/] [--cache /tmp/stig-cache/]
//	stig-updater --mode offline --zip-dir /media/usb/stigs/  [--out pkg/stig/data/]
//	stig-updater --list
package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/stig"
)

func main() {
	mode    := flag.String("mode", "online", "Update mode: 'online' (cyber.mil) or 'offline' (local ZIPs)")
	zipDir  := flag.String("zip-dir", "", "Local directory of STIG ZIPs (offline mode)")
	outDir  := flag.String("out", defaultDataDir(), "Output directory for updated CSV files")
	cache   := flag.String("cache", filepath.Join(os.TempDir(), "stig-updater-cache"), "Download cache directory (online mode)")
	filter  := flag.String("filter", "", "Comma-separated STIG filename substrings to include (e.g. RHEL_9,Windows_11). Empty = all.")
	list    := flag.Bool("list", false, "List available STIGs from cyber.mil and exit")
	verbose := flag.Bool("v", false, "Verbose output")
	// Code-gen flags: classify parsed rules and emit a Go CheckSpec table.
	genGo    := flag.Bool("gen-go", false, "Generate a Go CheckSpec table from parsed STIG rules")
	genAll   := flag.Bool("gen-all", false, "Generate check tables for ALL OS families (ignores --filter, writes pkg/stig/generated/)")
	genOut   := flag.String("gen-out", "", "Output path for generated Go file (required with --gen-go)")
	genVar   := flag.String("gen-var", "", "Go variable name for generated CheckSpec slice (derived from --filter if empty)")
	genDir   := flag.String("gen-dir", "pkg/stig", "Output directory for --gen-all")
	flag.Parse()

	if *list {
		runList(*verbose)
		return
	}

	if *genAll {
		runGenAll(*genDir, *cache, *verbose)
		return
	}

	if *genGo {
		if *genOut == "" {
			fatalf("--gen-out is required with --gen-go")
		}
		if *filter == "" {
			fatalf("--filter is required with --gen-go (e.g. --filter RHEL_9)")
		}
		varName := *genVar
		if varName == "" {
			varName = deriveVarName(*filter)
		}
		switch *mode {
		case "online":
			runGenGo(*outDir, *cache, *filter, *genOut, varName, *verbose)
		case "offline":
			if *zipDir == "" {
				fatalf("--zip-dir is required for offline mode")
			}
			runGenGoOffline(*zipDir, *outDir, *genOut, varName, *verbose)
		default:
			fatalf("unknown mode %q — use 'online' or 'offline'", *mode)
		}
		return
	}

	switch *mode {
	case "online":
		runOnline(*outDir, *cache, *filter, *verbose)
	case "offline":
		if *zipDir == "" {
			fatalf("--zip-dir is required for offline mode")
		}
		runOffline(*zipDir, *outDir, *verbose)
	default:
		fatalf("unknown mode %q — use 'online' or 'offline'", *mode)
	}
}

func runList(verbose bool) {
	fmt.Println("Fetching STIG list from https://www.cyber.mil/stigs/downloads/ …")
	pkgs, err := stig.ListAvailableSTIGs()
	if err != nil {
		fatalf("list error: %v", err)
	}
	fmt.Printf("\n%-60s  %-8s  %s\n", "STIG Package", "Version", "Filename")
	fmt.Println(strings.Repeat("-", 100))
	for _, p := range pkgs {
		fmt.Printf("%-60s  %-8s  %s\n", truncate(p.Title, 60), p.Version, p.FileName)
		if verbose {
			fmt.Printf("  URL: %s\n", p.DownloadURL)
		}
	}
	fmt.Printf("\n%d STIG packages found.\n", len(pkgs))
}

func runOnline(outDir, cache, filterStr string, verbose bool) {
	var filters []string
	if filterStr != "" {
		for _, f := range strings.Split(filterStr, ",") {
			if t := strings.TrimSpace(f); t != "" {
				filters = append(filters, t)
			}
		}
	}

	ensureDir(outDir)
	ensureDir(cache)

	fmt.Printf("Updating STIG database from cyber.mil …\n")
	fmt.Printf("  Output dir : %s\n", outDir)
	fmt.Printf("  Cache dir  : %s\n", cache)
	if len(filters) > 0 {
		fmt.Printf("  Filter     : %s\n", strings.Join(filters, ", "))
	} else {
		fmt.Println("  Filter     : ALL families")
	}
	fmt.Println()

	result, err := stig.UpdateFromCyberMil(outDir, filters, cache)
	if err != nil {
		fatalf("online update error: %v", err)
	}

	printResult(result, verbose)
}

func runOffline(zipDir, outDir string, verbose bool) {
	ensureDir(outDir)

	fmt.Printf("Importing STIG ZIPs from local directory …\n")
	fmt.Printf("  ZIP dir    : %s\n", zipDir)
	fmt.Printf("  Output dir : %s\n", outDir)
	fmt.Println()

	result, err := stig.UpdateFromLocalDir(zipDir, outDir)
	if err != nil {
		fatalf("offline import error: %v", err)
	}

	printResult(result, verbose)
}

// osFamilyEntry describes one OS STIG family to generate a check table for.
type osFamilyEntry struct {
	Filter  string // substring passed to --filter (matches CDN filename)
	VarName string // Go variable name in the generated file
	OutFile string // filename under genDir
}

// osFamilies is the authoritative list of OS STIG families that ship
// pre-generated in the product binary.  Non-OS families (network, DB, apps)
// are intentionally excluded — their check text does not map to live OS
// primitives and would produce only CheckManual rows.
var osFamilies = []osFamilyEntry{
	// ── Linux ─────────────────────────────────────────────────────────────────
	{"U_RHEL_9", "rhel09STIG", "rhel09_checks_table.go"},
	{"U_RHEL_8", "rhel08STIG", "rhel08_checks_table.go"},
	{"U_RHEL_7", "rhel07STIG", "rhel07_checks_table.go"},
	{"U_Oracle_Linux_7", "oracleLinux7STIG", "oracle_linux7_checks_table.go"},
	{"U_Oracle_Linux_8", "oracleLinux8STIG", "oracle_linux8_checks_table.go"},
	// Ubuntu — all three active LTS releases
	{"U_CAN_Ubuntu_18-04_LTS", "ubuntu1804STIG", "ubuntu1804_checks_table.go"},
	{"U_Canonical_Ubuntu_20-04_LTS", "ubuntu2004STIG", "ubuntu2004_checks_table.go"},
	{"U_Canonical_Ubuntu_22-04_LTS", "ubuntu2204STIG", "ubuntu2204_checks_table.go"},
	{"U_Canonical_Ubuntu_24-04_LTS", "ubuntu2404STIG", "ubuntu2404_checks_table.go"},
	// ── Windows Workstation ───────────────────────────────────────────────────
	{"U_MS_Windows_10", "win10STIG", "win10_checks_table.go"},
	{"U_MS_Windows_11", "win11STIG", "win11_checks_table.go"},
	// ── Windows Server ────────────────────────────────────────────────────────
	{"U_MS_Windows_Server_2016", "winSrv2016STIG", "winsrv2016_checks_table.go"},
	{"U_MS_Windows_Server_2019", "winSrv2019STIG", "winsrv2019_checks_table.go"},
	{"U_MS_Windows_Server_2022", "winSrv2022STIG", "winsrv2022_checks_table.go"},
	// ── macOS ─────────────────────────────────────────────────────────────────
	{"U_Apple_macOS_13", "macos13STIG", "macos13_checks_table.go"},
	{"U_Apple_macOS_14", "macos14STIG", "macos14_checks_table.go"},
	{"U_Apple_macOS_15", "macos15STIG", "macos15_checks_table.go"},
	// ── Kubernetes ────────────────────────────────────────────────────────────
	{"U_Kubernetes", "k8sStig", "kubernetes_checks_table.go"},
	{"U_OpenShift_Container_Platform_4", "openshiftStig", "openshift_checks_table.go"},
}

// runGenAll fetches and generates check tables for all OS families, writing
// each to genDir.  This is the build-time step that populates the embedded
// check tables shipped in the product binary.
func runGenAll(genDir, cache string, verbose bool) {
	ensureDir(genDir)
	ensureDir(cache)

	fmt.Printf("Generating embedded check tables for %d OS families → %s\n\n",
		len(osFamilies), genDir)

	// Probe CDN for the latest version of every family first (one pass).
	fmt.Println("Probing DISA CDN for latest versions …")
	available, err := stig.ListAvailableSTIGs()
	if err != nil {
		fatalf("list STIGs: %v", err)
	}
	// Build index: filter-stem → STIGPackage.
	// Stem is the filename up to the first "_V" version marker, e.g.
	// "U_RHEL_9_V1R3_STIG.zip" → "U_RHEL_9".
	byFilter := make(map[string]stig.STIGPackage, len(available))
	for _, p := range available {
		idx := strings.Index(p.FileName, "_V")
		if idx <= 0 {
			// Unexpected filename format — skip to avoid panic.
			continue
		}
		byFilter[p.FileName[:idx]] = p
	}

	ok, skipped, failed := 0, 0, 0
	for _, fam := range osFamilies {
		outPath := filepath.Join(genDir, fam.OutFile)

		// Find the matching package from the CDN probe.
		pkg, found := byFilter[fam.Filter]
		if !found {
			// Try a prefix match
			for stem, p := range byFilter {
				if strings.HasPrefix(stem, fam.Filter) || strings.HasPrefix(fam.Filter, stem) {
					pkg = p
					found = true
					break
				}
			}
		}
		if !found {
			fmt.Printf("  SKIP  %-45s (not found on CDN)\n", fam.Filter)
			skipped++
			continue
		}

		fmt.Printf("  GEN   %-45s [%s] → %s\n", pkg.FileName, pkg.Version, fam.OutFile)

		zipPath, err := stig.DownloadSTIG(pkg, cache)
		if err != nil {
			fmt.Fprintf(os.Stderr, "  ERROR download %s: %v\n", pkg.FileName, err)
			failed++
			continue
		}
		rules, err := stig.ParseXCCDFZip(zipPath)
		if err != nil {
			fmt.Fprintf(os.Stderr, "  ERROR parse %s: %v\n", pkg.FileName, err)
			failed++
			continue
		}
		if verbose {
			fmt.Printf("        parsed %d rules\n", len(rules))
		}
		if err := stig.GenerateCheckTableGo(rules, fam.Filter, "stig", fam.VarName, outPath); err != nil {
			fmt.Fprintf(os.Stderr, "  ERROR generate %s: %v\n", fam.OutFile, err)
			failed++
			continue
		}
		ok++
	}

	fmt.Printf("\nDone: %d generated, %d skipped (not on CDN), %d failed\n", ok, skipped, failed)
	if ok > 0 {
		fmt.Println("\nNext: go build ./cmd/asaf-desktop/... to embed updated tables.")
	}
}

// runGenGo fetches STIGs online, updates the CSV, then also emits a Go
// CheckSpec table at genOut.
func runGenGo(outDir, cache, filterStr, genOut, varName string, verbose bool) {
	filters := splitFilter(filterStr)
	ensureDir(outDir)
	ensureDir(cache)

	fmt.Printf("Fetching STIG rules from cyber.mil and generating Go check table …\n")
	fmt.Printf("  Filter  : %s\n", filterStr)
	fmt.Printf("  Var     : %s\n", varName)
	fmt.Printf("  Gen out : %s\n\n", genOut)

	pkgs, err := stig.ListAvailableSTIGs()
	if err != nil {
		fatalf("list STIGs: %v", err)
	}
	if len(filters) > 0 {
		pkgs = stig.FilterPackages(pkgs, filters)
	}

	var allRules []stig.STIGRule
	for _, pkg := range pkgs {
		fmt.Printf("  Downloading %s …\n", pkg.FileName)
		zipPath, err := stig.DownloadSTIG(pkg, cache)
		if err != nil {
			fmt.Fprintf(os.Stderr, "  WARN: download %s: %v\n", pkg.FileName, err)
			continue
		}
		rules, err := stig.ParseXCCDFZip(zipPath)
		if err != nil {
			fmt.Fprintf(os.Stderr, "  WARN: parse %s: %v\n", pkg.FileName, err)
			continue
		}
		if verbose {
			fmt.Printf("  Parsed %d rules from %s\n", len(rules), pkg.FileName)
		}
		allRules = append(allRules, rules...)
	}

	fmt.Printf("\nClassifying %d rules → %s …\n", len(allRules), genOut)
	family := filterStr
	if err := stig.GenerateCheckTableGo(allRules, family, "stig", varName, genOut); err != nil {
		fatalf("generate check table: %v", err)
	}
	fmt.Printf("Generated %s (%d rules).\n\n", genOut, len(allRules))
	fmt.Println("Next steps:")
	fmt.Printf("  1. Review %s — adjust any CheckManual entries.\n", genOut)
	fmt.Println("  2. go build ./cmd/asaf-desktop/... — re-embed CSV + new table.")
}

// runGenGoOffline is the same but reads ZIPs from a local directory.
func runGenGoOffline(zipDir, outDir, genOut, varName string, verbose bool) {
	ensureDir(outDir)

	fmt.Printf("Importing STIG ZIPs from %s and generating Go check table …\n\n", zipDir)

	entries, err := os.ReadDir(zipDir)
	if err != nil {
		fatalf("read dir %s: %v", zipDir, err)
	}

	var allRules []stig.STIGRule
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(strings.ToLower(e.Name()), ".zip") {
			continue
		}
		zipPath := filepath.Join(zipDir, e.Name())
		rules, err := stig.ParseXCCDFZip(zipPath)
		if err != nil {
			fmt.Fprintf(os.Stderr, "  WARN: parse %s: %v\n", e.Name(), err)
			continue
		}
		if verbose {
			fmt.Printf("  Parsed %d rules from %s\n", len(rules), e.Name())
		}
		allRules = append(allRules, rules...)
	}

	fmt.Printf("\nClassifying %d rules → %s …\n", len(allRules), genOut)
	if err := stig.GenerateCheckTableGo(allRules, zipDir, "stig", varName, genOut); err != nil {
		fatalf("generate check table: %v", err)
	}
	fmt.Printf("Generated %s (%d rules).\n", genOut, len(allRules))
}

// deriveVarName converts a filter string (e.g. "RHEL_9") to a Go var name
// (e.g. "rhel09STIG").
func deriveVarName(filter string) string {
	s := strings.ToLower(filter)
	s = strings.NewReplacer(
		"rhel_9", "rhel09",
		"rhel_8", "rhel08",
		"windows_11", "win11",
		"windows_10", "win10",
		"ubuntu", "ubuntu",
		" ", "_",
		"-", "",
	).Replace(s)
	return s + "STIG"
}

func splitFilter(filterStr string) []string {
	var out []string
	for _, f := range strings.Split(filterStr, ",") {
		if t := strings.TrimSpace(f); t != "" {
			out = append(out, t)
		}
	}
	return out
}

func printResult(r *stig.UpdateResult, verbose bool) {
	fmt.Printf("Update complete: %s\n", r)
	if len(r.Errors) > 0 {
		fmt.Printf("\nErrors (%d):\n", len(r.Errors))
		for i, e := range r.Errors {
			fmt.Printf("  [%d] %v\n", i+1, e)
		}
	}
	fmt.Println()
	fmt.Println("Next step: rebuild asaf-desktop to embed updated CSV files.")
	fmt.Println("  go build ./cmd/asaf-desktop/...")
}

func defaultDataDir() string {
	// If running from the repo root, default to pkg/stig/data/
	if _, err := os.Stat("pkg/stig/data"); err == nil {
		return "pkg/stig/data"
	}
	return "."
}

func ensureDir(path string) {
	if err := os.MkdirAll(path, 0o755); err != nil {
		fatalf("cannot create dir %s: %v", path, err)
	}
}

func fatalf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "stig-updater: "+format+"\n", args...)
	os.Exit(1)
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n-1] + "…"
}
