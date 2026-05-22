// soc2-audit is a CLI that performs a SOC 2 Trust Service Criteria readiness
// gap analysis and generates evidence-collection checklists.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"text/tabwriter"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/compliance/soc2"
)

func main() {
	var (
		systemName  = flag.String("system", "Giza Cyber Shield", "System name for the report")
		scopeNote   = flag.String("scope", "Security (CC) — Required; Availability (A)", "TSC scope note")
		implFile    = flag.String("implementations", "", "Path to implementations JSON file (optional)")
		outFile     = flag.String("out", "", "Path to write JSON report (optional)")
		nistFile    = flag.String("nist-status", "", "Path to NIST 800-53 status JSON (map[string]string) for auto-seeding")
		showEvidence = flag.Bool("evidence", false, "Print required evidence checklist")
		showSummary  = flag.Bool("summary", false, "Print criterion status table")
	)
	flag.Parse()

	engine := soc2.NewEngine(*systemName, *scopeNote)

	// Auto-seed from NIST 800-53 status if provided.
	if *nistFile != "" {
		data, err := os.ReadFile(*nistFile)
		if err != nil {
			fatalf("reading NIST status file: %v", err)
		}
		var nistStatus map[string]string
		if err := json.Unmarshal(data, &nistStatus); err != nil {
			fatalf("parsing NIST status file: %v", err)
		}
		engine.SeedFromNISTMapping(nistStatus)
		fmt.Fprintf(os.Stderr, "[soc2-audit] Seeded implementations from %s\n", *nistFile)
	}

	// Load explicit implementations if provided (overrides seeded values).
	if *implFile != "" {
		if err := engine.LoadImplementations(*implFile); err != nil {
			fatalf("loading implementations: %v", err)
		}
		fmt.Fprintf(os.Stderr, "[soc2-audit] Loaded implementations from %s\n", *implFile)
	}

	// Print evidence checklist.
	if *showEvidence {
		printEvidenceChecklist()
		return
	}

	// Print criterion status table.
	if *showSummary {
		printSummaryTable(engine)
		return
	}

	// Default: print readiness report to stdout.
	engine.PrintReport()

	// Write JSON report to disk if requested.
	if *outFile != "" {
		if err := engine.SaveReport(*outFile); err != nil {
			fatalf("writing report: %v", err)
		}
		fmt.Fprintf(os.Stderr, "[soc2-audit] Report written to %s\n", *outFile)
	}
}

func printEvidenceChecklist() {
	reqs := soc2.RequiredEvidence()
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "CRITERION\tTYPE\tFREQUENCY\tREQUIRED\tDESCRIPTION")
	fmt.Fprintln(w, "─────────\t────\t─────────\t────────\t───────────")
	for _, r := range reqs {
		req := "no"
		if r.Required {
			req = "YES"
		}
		fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\n",
			r.CriterionID, r.Type, r.Frequency, req, r.Description)
	}
	w.Flush()
}

func printSummaryTable(engine *soc2.Engine) {
	summary := engine.CriterionSummary()
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "ID\tFAMILY\tSTATUS\tTITLE")
	fmt.Fprintln(w, "──\t──────\t──────\t─────")
	for _, s := range summary {
		fmt.Fprintf(w, "%s\t%s\t%s\t%s\n", s.ID, s.Family, s.Status, truncate(s.Title, 55))
	}
	w.Flush()
	fmt.Printf("\nGenerated: %s\n", time.Now().UTC().Format(time.RFC1123))
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n-1] + "…"
}

func fatalf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "[soc2-audit] ERROR: "+format+"\n", args...)
	os.Exit(1)
}
