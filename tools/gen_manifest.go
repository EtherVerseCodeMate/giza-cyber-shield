package main

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
)

// Iron Bank Hardening Manifest Template
const manifestTemplate = `apiVersion: v1
name: adinkhepra
tags:
- %s
- latest
args:
  BASE_IMAGE: "registry1.dso.mil/ironbank/google/golang/1.23"
  BASE_TAG: "1.23"
labels:
  org.opencontainers.image.title: "AdinKhepra - PQC Cybersecurity Agent"
  org.opencontainers.image.description: "Quantum-safe audit and compliance agent for critical infrastructure."
  org.opencontainers.image.vendor: "EtherVerse CodeMate"
  org.opencontainers.image.version: "%s"
  mil.dso.ironbank.image.keywords: "security,audit,compliance,pqc,zero-trust"
  mil.dso.ironbank.image.type: "commercial"
  mil.dso.ironbank.product.name: "AdinKhepra"
resources:
- filename: adinkhepra-fips
  url: "https://github.com/EtherVerseCodeMate/giza-cyber-shield/releases/download/%s/adinkhepra-fips"
  validation:
    type: sha256
    value: %s
maintainers:
- email: "security@souhimbou.ai"
  name: "Khepra Security Team"
  username: "khepra-bot"
`

func main() {
	if len(os.Args) < 3 {
		fmt.Println("Usage: go run tools/gen_manifest.go <version> <binary_path>")
		os.Exit(1)
	}

	version := os.Args[1]
	binaryPath := os.Args[2]

	// Calculate SHA256 of the binary (simulating the FIPS binary)
	hash, err := calculateSHA256(binaryPath)
	if err != nil {
		// If binary doesn't exist yet (e.g. initial run), use a placeholder
		fmt.Printf("[WARN] Binary not found at %s. Using placeholder hash for template generation.\n", binaryPath)
		hash = "0000000000000000000000000000000000000000000000000000000000000000"
	}

	// Generate Manifest Content
	manifestContent := fmt.Sprintf(manifestTemplate, version, version, version, hash)

	// Write to hardening_manifest.yaml
	err = os.WriteFile("hardening_manifest.yaml", []byte(manifestContent), 0644)
	if err != nil {
		fmt.Printf("Error writing manifest: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("[SUCCESS] Generated hardening_manifest.yaml for version %s\n", version)
	fmt.Printf("   - Binary Hash: %s\n", hash)
}

func calculateSHA256(path string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()

	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return "", err
	}

	return hex.EncodeToString(hash.Sum(nil)), nil
}
