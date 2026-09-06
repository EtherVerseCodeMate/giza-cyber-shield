package main

import (
	"context"
	"log"
	"os"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/vuln"
)

func main() {
	targetDir := "."
	if len(os.Args) > 1 {
		targetDir = os.Args[1]
	}

	ctx := context.Background()
	log.Printf("Starting SouHimBou Vulnerability Hunter on %s...", targetDir)

	h := vuln.NewHunter(targetDir)
	h.SetDryRun(false) 
	h.SetAutoFix(true)

	log.Println("Scanning for vulnerabilities...")
	result, err := h.Scan(ctx)
	if err != nil {
		log.Fatalf("Scan failed: %v", err)
	}

	log.Printf("Scan completed. Found %d vulnerabilities.", result.TotalVulns)
	log.Println(h.Report())

	if result.TotalVulns > 0 {
		log.Println("Remediating vulnerabilities...")
		if err := h.RemediateAll(ctx); err != nil {
			log.Fatalf("Remediation failed: %v", err)
		}
		log.Println("Remediation complete.")
	}
}
