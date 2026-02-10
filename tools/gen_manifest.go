package main

import (
	"bufio"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
)

// HardeningManifest Template (DoD Iron Bank)
const manifestTemplate = `apiVersion: v1
name: adinkhepra
tags:
- %s
args:
- BASE_IMAGE=registry1.dso.mil/ironbank/google/golang/1.23
- BASE_TAG=1.23
labels:
  org.opencontainers.image.title: "AdinKhepra - PQC Cybersecurity Agent"
  org.opencontainers.image.description: "Quantum-safe audit and compliance agent for critical infrastructure."
  org.opencontainers.image.licenses: "Proprietary"
  org.opencontainers.image.url: "https://souhimbou.ai"
  org.opencontainers.image.vendor: "EtherVerse CodeMate"
  org.opencontainers.image.version: "%s"
  mil.dso.ironbank.image.keywords: "security,audit,compliance,pqc,zero-trust"
  mil.dso.ironbank.image.type: "commercial"
  mil.dso.ironbank.product.name: "AdinKhepra"
resources:
- filename: adinkhepra-fips
  url: "s3://adinkhepra-releases/v%s/adinkhepra-fips"
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
		fmt.Println("Usage: gen_manifest <version> <binary_path>")
		os.Exit(1)
	}

	version := os.Args[1]
	binaryPath := os.Args[2]

	// Calculate SHA256 of the binary (simulating the FIPS binary)
	hash, err := calculateSHA256(binaryPath)
	if err != nil {
		// If binary doesn't exist yet, use a placeholder for dev
		fmt.Printf("[WARN] Binary not found at %s. Using placeholder hash.\n", binaryPath)
		hash = "0000000000000000000000000000000000000000000000000000000000000000"
	}

	// Generate Manifest Content
	// Tags: version, latest
	tags := fmt.Sprintf("%s\n- latest", version)

	manifestContent := fmt.Sprintf(manifestTemplate, tags, version, version, hash)

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
	reader := bufio.NewReader(file)
	_, err = reader.WriteTo(hash)
	if err != nil {
		return "", err
	}

	return hex.EncodeToString(hash.Sum(nil)), nil
}
