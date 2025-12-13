package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/audit"
)

// Khepra Sonar: Passive Audit Collector
// This tool runs on client infrastructure to generate a secure snapshot.
// It does NOT contain proprietary analysis logic.

var (
	outputFile = flag.String("out", "khepra_snapshot.json", "Output file path")
	scanDir    = flag.String("dir", ".", "Directory to scan for manifests")
)

func main() {
	flag.Parse()

	fmt.Printf("Starting Khepra Sonar (Audit Probe)...\n")
	fmt.Printf("Scan Target: %s\n", *scanDir)

	snapshot := audit.AuditSnapshot{
		SchemaVersion: "1.0",
		ScanID:        generateScanID(),
		Timestamp:     time.Now().UTC(),
		Host: audit.InfoHost{
			Hostname: getHostname(),
			OS:       runtime.GOOS,
			Arch:     runtime.GOARCH,
		},
		Network:   []audit.NetworkPort{}, // Populate real data in v2
		Processes: []audit.ProcessInfo{}, // Populate real data in v2
		Tags:      []string{"external_audit", "manual_scan"},
	}

	// File System Scan (Manifests)
	snapshot.Manifests = scanManifests(*scanDir)

	// Output
	data, err := json.MarshalIndent(snapshot, "", "  ")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error serializing snapshot: %v\n", err)
		os.Exit(1)
	}

	if err := os.WriteFile(*outputFile, data, 0644); err != nil {
		fmt.Fprintf(os.Stderr, "Error writing output: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Snapshot saved to: %s\n", *outputFile)
	fmt.Println("Transmission ready. Please send this file securely to your Advisor.")
}

func generateScanID() string {
	sum := sha256.Sum256([]byte(time.Now().String()))
	return hex.EncodeToString(sum[:])[:12]
}

func getHostname() string {
	if h, err := os.Hostname(); err == nil {
		return h
	}
	return "unknown"
}

func scanManifests(root string) []audit.FileManifest {
	var manifests []audit.FileManifest

	targetFiles := map[string]string{
		"package.json":     "npm",
		"go.mod":           "go",
		"requirements.txt": "pip",
		"Dockerfile":       "docker",
		"Cargo.toml":       "cargo",
		"pom.xml":          "maven",
	}

	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // Skip errors
		}

		// Skip hidden dirs to be polite
		if info.IsDir() && strings.HasPrefix(info.Name(), ".") && info.Name() != "." {
			return filepath.SkipDir
		}

		if !info.IsDir() {
			if fileType, ok := targetFiles[info.Name()]; ok {
				fmt.Printf("Found manifest: %s (%s)\n", path, fileType)

				content, _ := os.ReadFile(path) // Ignore error, best effort

				// Hash it
				h := sha256.Sum256(content)

				manifests = append(manifests, audit.FileManifest{
					Path:     path,
					Type:     fileType,
					Content:  string(content), // In real prod, this might be truncated
					Checksum: hex.EncodeToString(h[:]),
				})
			}
		}
		return nil
	})

	if err != nil {
		fmt.Fprintf(os.Stderr, "Walk error: %v\n", err)
	}

	return manifests
}
