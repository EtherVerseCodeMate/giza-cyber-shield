// tools/dev-license-gen/main.go
//
// Generates a fresh ML-DSA-65 key pair and writes a valid dev license.
// Run from the project root:
//
//   go run tools/dev-license-gen/main.go
//
// Writes:
//   adinkhepra_master.pub       (project root)
//   bin/adinkhepra_master.pub   (next to the binary)
//   license.adinkhepra          (project root)
//   bin/license.adinkhepra      (next to the binary)
//
// The private key is ephemeral — it is used only to sign the license and
// is never written to disk. Regenerating with this tool invalidates the
// previous license. For production licensing, use the telemetry server flow.

package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/cloudflare/circl/sign/mldsa/mldsa65"
)

type LicenseClaims struct {
	Tenant       string    `json:"tenant"`
	HostID       string    `json:"host_id"`
	Expiry       time.Time `json:"expiry"`
	Capabilities []string  `json:"capabilities"`
}

type OfflineLicense struct {
	Claims    LicenseClaims `json:"claims"`
	Signature string        `json:"signature"`
}

func main() {
	fmt.Println("═══════════════════════════════════════════════════════")
	fmt.Println("  AdinKhepra Dev License Generator")
	fmt.Println("  ML-DSA-65 (NIST FIPS 204) — ephemeral key pair")
	fmt.Println("═══════════════════════════════════════════════════════")
	fmt.Println()

	// 1. Generate fresh ML-DSA-65 key pair
	fmt.Print("[1/4] Generating ML-DSA-65 key pair... ")
	pub, priv, err := mldsa65.GenerateKey(rand.Reader)
	if err != nil {
		fmt.Printf("FAIL: %v\n", err)
		os.Exit(1)
	}
	pubBytes, _ := pub.MarshalBinary()
	privBytes, _ := priv.MarshalBinary()
	fmt.Printf("OK (%d-byte public, %d-byte private)\n", len(pubBytes), len(privBytes))

	// 2. Build license claims — 10-year dev expiry, all capabilities
	fmt.Print("[2/4] Building license claims... ")
	hostname, _ := os.Hostname()
	claims := LicenseClaims{
		Tenant: "SouHimBou AI — Dev",
		HostID: hostname,
		Expiry: time.Now().Add(10 * 365 * 24 * time.Hour),
		Capabilities: []string{
			"compliance-scan",
			"ert-godfather",
			"ert-architect",
			"ert-crypto",
			"cmmc-l2",
			"nist-800-171",
			"stig",
			"emass-export",
			"pqc-attestation",
			"blast-radius",
			"poam",
			"ssp",
			"air-gap",
		},
	}
	fmt.Printf("OK (expires %s)\n", claims.Expiry.Format("2006-01-02"))

	// 3. Sign claims with the ephemeral private key
	fmt.Print("[3/4] Signing with ML-DSA-65... ")
	claimsData, err := json.Marshal(claims)
	if err != nil {
		fmt.Printf("FAIL: marshal claims: %v\n", err)
		os.Exit(1)
	}

	// Unpack the private key into the circl format for signing
	var privKeyBuf [mldsa65.PrivateKeySize]byte
	copy(privKeyBuf[:], privBytes)
	var privateKey mldsa65.PrivateKey
	privateKey.Unpack(&privKeyBuf)

	sig := make([]byte, mldsa65.SignatureSize)
	mldsa65.SignTo(&privateKey, claimsData, nil, false, sig)
	fmt.Printf("OK (%d-byte signature)\n", len(sig))

	license := OfflineLicense{
		Claims:    claims,
		Signature: hex.EncodeToString(sig),
	}

	// 4. Write files to project root and bin/
	fmt.Println("[4/4] Writing files...")

	destinations := []string{".", "bin"}
	for _, dir := range destinations {
		if err := os.MkdirAll(dir, 0755); err != nil {
			fmt.Printf("  WARN: cannot create dir %s: %v\n", dir, err)
			continue
		}

		pubPath := filepath.Join(dir, "adinkhepra_master.pub")
		if err := os.WriteFile(pubPath, []byte(hex.EncodeToString(pubBytes)), 0644); err != nil {
			fmt.Printf("  WARN: cannot write %s: %v\n", pubPath, err)
		} else {
			fmt.Printf("  ✓ %s\n", pubPath)
		}

		licData, _ := json.MarshalIndent(license, "", "  ")
		licPath := filepath.Join(dir, "license.adinkhepra")
		if err := os.WriteFile(licPath, licData, 0644); err != nil {
			fmt.Printf("  WARN: cannot write %s: %v\n", licPath, err)
		} else {
			fmt.Printf("  ✓ %s\n", licPath)
		}
	}

	fmt.Println()
	fmt.Println("═══════════════════════════════════════════════════════")
	fmt.Printf("  Licensed to : %s\n", claims.Tenant)
	fmt.Printf("  Host        : %s\n", claims.HostID)
	fmt.Printf("  Expires     : %s\n", claims.Expiry.Format("2006-01-02"))
	fmt.Printf("  Capabilities: %d granted\n", len(claims.Capabilities))
	fmt.Println("  Private key : ephemeral — NOT stored")
	fmt.Println("═══════════════════════════════════════════════════════")
	fmt.Println()
	fmt.Println("  Run: adinkhepra compliance scan --framework CMMC_L2")
	fmt.Println()
}
