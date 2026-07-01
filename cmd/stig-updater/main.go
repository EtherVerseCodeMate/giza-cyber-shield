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
	flag.Parse()

	if *list {
		runList(*verbose)
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
