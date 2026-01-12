package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/adinkra"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/audit"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/enumerate"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/fingerprint"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/scanners"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/telemetry"
)

const VERSION = "1.5.0-NUCLEAR"

var (
	scanDir        = flag.String("dir", ".", "Directory to scan")
	quickScan      = flag.Bool("quick", false, "Perform quick scan (skip deep enumeration)")
	noExternal     = flag.Bool("no-external", false, "Disable external calls (offline mode)")
	containerScan  = flag.String("container", "", "Scan container image")
	complianceFlag = flag.String("compliance", "", "Run compliance check (cis/stig/nist)")
	signOutput     = flag.Bool("sign", false, "Sign output with PQC")
	outputFile     = flag.String("out", "snapshot.json", "Output file path")
	verboseOutput  = flag.Bool("verbose", false, "Enable verbose logging")

	// Telemetry signing key (embedded at build time via -ldflags)
	telemetryPrivateKey string = ""
)

func main() {
	flag.Parse()

	// Track scan start time for telemetry
	scanStartTime := time.Now()

	if *verboseOutput {
		printBanner()
	}

	// Initialize license and heartbeat
	if err := initLicense(); err != nil {
		logWarn("License initialization failed: %v", err)
	}

	// Initialize the audit snapshot
	snapshot := initializeSnapshot()

	log("Collecting Device Fingerprint (Anti-Spoofing)...")
	deviceFP, err := fingerprint.CollectDeviceFingerprint()
	if err != nil {
		logWarn("Device fingerprinting failed: %v", err)
	} else {
		snapshot.DeviceFingerprint = deviceFP
		logSuccess("Device Fingerprint: %s", deviceFP.CompositeHash[:16]+"...")

		if len(deviceFP.SpoofingIndicators) > 0 {
			logWarn("SPOOFING INDICATORS DETECTED: %v", deviceFP.SpoofingIndicators)
		}
	}

	log("Collecting Host Information...")
	hostInfo, err := enumerate.CollectHostInfo()
	if err != nil {
		logWarn("Host info collection failed: %v", err)
	} else {
		snapshot.Host = hostInfo
		logSuccess("Host: %s (%s %s)", hostInfo.Hostname, hostInfo.OS, hostInfo.OSVersion)
	}

	log("Collecting Network Intelligence...")
	networkInfo, err := enumerate.CollectNetworkIntelligence()
	if err != nil {
		logWarn("Network collection failed: %v", err)
	} else {
		snapshot.Network = networkInfo
		logSuccess("Network: %d ports, %d interfaces", len(networkInfo.Ports), len(networkInfo.Interfaces))

		if networkInfo.OSFingerprint.DetectedOS != "" {
			logInfo("OS Fingerprint: %s (confidence: %d%%)",
				networkInfo.OSFingerprint.DetectedOS,
				networkInfo.OSFingerprint.Confidence)
		}
	}

	// Deep enumeration (skip if quick scan)
	if !*quickScan {
		log("Collecting System Intelligence...")
		systemInfo, err := enumerate.CollectSystemIntelligence()
		if err != nil {
			logWarn("System collection failed: %v", err)
		} else {
			snapshot.System = systemInfo
			logSuccess("System: %d processes, %d services, %d users",
				len(systemInfo.Processes),
				len(systemInfo.Services),
				len(systemInfo.Users))

			// Rootkit detection via hidden kernel modules
			if runtime.GOOS == "linux" {
				hiddenModules := 0
				for _, mod := range systemInfo.KernelModules {
					if mod.Hidden {
						hiddenModules++
						snapshot.ThreatDetection.RootkitIndicators = append(
							snapshot.ThreatDetection.RootkitIndicators,
							audit.RootkitIndicator{
								Type:        "hidden_kernel_module",
								Severity:    "HIGH",
								Description: fmt.Sprintf("Hidden kernel module detected: %s", mod.Name),
								Evidence:    "Module present in /sys/module but not in /proc/modules",
							},
						)
					}
				}
				if hiddenModules > 0 {
					logWarn("ROOTKIT ALERT: %d hidden kernel modules detected!", hiddenModules)
				}
			}
		}
	}

	// Manifest Scan (Always run unless dir is explicitly empty?)
	// Implicit label replacement by fallthrough
	log("Scanning for Dependency Manifests...")
	snapshot.Manifests = scanManifests(*scanDir)
	logSuccess("Manifests: %d files found", len(snapshot.Manifests))

	// BUILT-IN VULNERABILITY SCANNER (Zero External Dependencies)
	if !*noExternal && *scanDir != "" {
		log("Running Built-In Vulnerability Scanner (CVE database + heuristics)...")
		vulns, err := scanners.RunBuiltInVulnerabilityScan(*scanDir)
		if err != nil {
			logWarn("Vulnerability scan failed: %v", err)
		} else {
			snapshot.Vulnerabilities = append(snapshot.Vulnerabilities, vulns...)
			logSuccess("Vulnerability Scanner: %d issues found", len(vulns))

			criticalCount := 0
			for _, v := range vulns {
				if v.Severity == "CRITICAL" {
					criticalCount++
				}
			}
			if criticalCount > 0 {
				logWarn("CRITICAL VULNERABILITIES: %d", criticalCount)
			}
		}
	}

	// BUILT-IN SECRET SCANNER (Zero External Dependencies)
	if !*noExternal && *scanDir != "" {
		log("Running Built-In Secret Scanner (entropy + pattern matching)...")
		secrets, err := scanners.RunBuiltInSecretScan(*scanDir)
		if err != nil {
			logWarn("Secret scan failed: %v", err)
		} else {
			snapshot.Secrets = secrets
			if len(secrets) > 0 {
				logWarn("SECRETS DETECTED: %d leaked credentials/keys found!", len(secrets))
			} else {
				logSuccess("Secret Scanner: No secrets detected")
			}
		}
	}

	// BUILT-IN CONTAINER SCANNER (Zero External Dependencies)
	if *containerScan != "" {
		log("Running Built-In Container Scanner: %s...", *containerScan)
		containerFindings, err := scanners.RunBuiltInContainerScan(*containerScan)
		if err != nil {
			logWarn("Container scan failed: %v", err)
		} else {
			snapshot.Containers = append(snapshot.Containers, *containerFindings)
			logSuccess("Container Scanner: %d misconfigurations found", len(containerFindings.Misconfigurations))
		}
	}

	// BUILT-IN COMPLIANCE SCANNER (Zero External Dependencies)
	if *complianceFlag != "" {
		log("Running Built-In %s Compliance Scanner...", strings.ToUpper(*complianceFlag))
		complianceReport, err := scanners.RunBuiltInComplianceScan(*complianceFlag)
		if err != nil {
			logWarn("Compliance scan failed: %v", err)
		} else {
			snapshot.Compliance = complianceReport
			logSuccess("Compliance: %d/%d checks passed (%.1f%%)",
				complianceReport.PassedChecks,
				complianceReport.TotalChecks,
				complianceReport.ComplianceRate)
		}
	}

	// Calculate threat score
	snapshot.ThreatDetection.ThreatScore = calculateThreatScore(snapshot)
	if snapshot.ThreatDetection.ThreatScore > 70 {
		logWarn("HIGH THREAT SCORE: %d/100", snapshot.ThreatDetection.ThreatScore)
	} else {
		logSuccess("Threat Score: %d/100", snapshot.ThreatDetection.ThreatScore)
	}

	// Add comprehensive tags
	snapshot.Tags = generateTags(snapshot)

	// Sign with PQC (Dilithium3) for non-repudiation
	if *signOutput {
		log("Signing snapshot with Dilithium3 (Post-Quantum Cryptography)...")
		pk, sk, err := adinkra.GenerateDilithiumKey()
		if err != nil {
			logWarn("PQC key generation failed: %v", err)
		} else {
			if err := snapshot.SealWithPQC(sk, pk); err != nil {
				logWarn("PQC signing failed: %v", err)
			} else {
				logSuccess("Snapshot sealed with PQC signature")
			}
		}
	}

	// Output snapshot
	log("Writing snapshot to %s...", *outputFile)
	data, err := json.MarshalIndent(snapshot, "", "  ")
	if err != nil {
		fatal("Failed to serialize snapshot: %v", err)
	}

	if err := os.WriteFile(*outputFile, data, 0600); err != nil {
		fatal("Failed to write output: %v", err)
	}

	// Generate Telemetry Proof (Dark Crypto Moat)
	// This creates a sanitized, signed proof of scan that can be uploaded for verification
	// without exposing sensitive data.
	log("Generating Telemetry Proof (Dark Crypto)...")
	pk, sk, err := adinkra.GenerateDilithiumKey() // Ideally use persistent identity key
	if err == nil {
		proof, err := snapshot.GenerateTelemetryProof(sk, pk, VERSION, fmt.Sprintf("%s/%s", runtime.GOOS, runtime.GOARCH))
		if err != nil {
			logWarn("Telemetry proof generation failed: %v", err)
		} else {
			proofData, _ := json.MarshalIndent(proof, "", "  ")
			proofFile := "khepra_proof.sig"
			if err := os.WriteFile(proofFile, proofData, 0644); err == nil {
				logSuccess("Telemetry Proof saved to: %s", proofFile)
				fmt.Println("  [!] Upload this proof to https://khepra.io/verify for your Certificate of Compliance")
			}
		}
	}

	printSummary(snapshot)
	logSuccess("Scan complete. Snapshot saved to: %s", *outputFile)

	// Send anonymous telemetry (Option C: Opt-in for community, opt-out for enterprise)
	sendTelemetryBeacon(&snapshot, scanStartTime)

	fmt.Println("\n🔒 AdinKhepra Sonar - NUCLEAR-GRADE Security Audit Complete")
}

// sendTelemetryBeacon transmits anonymous usage data for traction metrics + dark crypto database
func sendTelemetryBeacon(snapshot *audit.AuditSnapshot, startTime time.Time) {
	mode := os.Getenv("KHEPRA_MODE")
	if mode == "" {
		mode = "community" // Default from container ENV
	}

	telemetryEnabled := os.Getenv("KHEPRA_TELEMETRY")

	// Option C: Community = opt-in, Enterprise = opt-out
	if mode == "community" && telemetryEnabled != "true" {
		log("Anonymous telemetry disabled (set KHEPRA_TELEMETRY=true to help improve KHEPRA)")
		log("Learn more: https://khepra.io/privacy")
		return
	}

	if telemetryEnabled == "false" {
		log("Telemetry disabled by user")
		return
	}

	// Build telemetry beacon
	beacon := &telemetry.Beacon{
		TelemetryVersion: "1.0",
		Timestamp:        time.Now().UTC().Format(time.RFC3339),
		AnonymousID:      telemetry.GenerateAnonymousID(),
		ScanMetadata: telemetry.ScanMetadata{
			ScanDuration:         int(time.Since(startTime).Seconds()),
			TargetsScanned:       countTargetsScanned(snapshot),
			FindingsCount:        len(snapshot.Compliance.Findings),
			ComplianceFrameworks: detectComplianceFrameworks(),
			ScannerVersion:       VERSION,
			ContainerRuntime:     telemetry.DetectContainerRuntime(),
			DeploymentEnv:        mode,
		},
		CryptoInventory: telemetry.ExtractCryptoInventory(snapshot),
		GeographicHint:  telemetry.DetectGeographicHint(),
	}

	// Send beacon (with embedded Dilithium3 private key for anti-spoofing)
	err := telemetry.SendBeacon(beacon, telemetryPrivateKey)
	if err != nil {
		if *verboseOutput {
			logWarn("Telemetry transmission failed: %v", err)
		}
	} else {
		logSuccess("Anonymous usage data sent (thank you for helping build the Dark Crypto Database!)")
	}
}

// countTargetsScanned counts total assets scanned
func countTargetsScanned(snapshot *audit.AuditSnapshot) int {
	total := 0
	total += len(snapshot.Network.Ports)
	total += len(snapshot.System.Processes)
	total += len(snapshot.System.Services)
	return total
}

// detectComplianceFrameworks identifies which frameworks were used in scan
func detectComplianceFrameworks() []string {
	frameworks := []string{}

	// Check if public CSVs are accessible (indicates compliance mapping is active)
	if _, err := os.Stat("/app/docs/CCI_to_NIST53.csv"); err == nil {
		frameworks = append(frameworks, "nist800-53")
	}
	if _, err := os.Stat("/app/docs/NIST53_to_171.csv"); err == nil {
		frameworks = append(frameworks, "nist800-171")
	}

	// Always include STIG (core capability)
	frameworks = append(frameworks, "stig")

	return frameworks
}

func initializeSnapshot() audit.AuditSnapshot {
	return audit.AuditSnapshot{
		SchemaVersion: "2.0-NUCLEAR",
		ScanID:        generateScanID(),
		Timestamp:     time.Now().UTC(),
		Tags:          []string{},
		ThreatDetection: audit.ThreatIntelligence{
			RootkitIndicators: []audit.RootkitIndicator{},
			MalwareSignatures: []audit.MalwareSignature{},
			Anomalies:         []audit.SecurityAnomaly{},
		},
		Compliance: audit.ComplianceReport{
			Findings: []audit.ComplianceFinding{},
		},
	}
}

func generateScanID() string {
	timestamp := fmt.Sprintf("%d", time.Now().UnixNano())
	hash := adinkra.Hash([]byte(timestamp))
	return hash[:12]
}

func scanManifests(root string) []audit.FileManifest {
	var manifests []audit.FileManifest

	targetFiles := map[string]string{
		"package.json":       "npm",
		"package-lock.json":  "npm-lock",
		"go.mod":             "go",
		"go.sum":             "go-sum",
		"requirements.txt":   "pip",
		"Pipfile":            "pipfile",
		"Pipfile.lock":       "pipfile-lock",
		"Gemfile":            "ruby",
		"Gemfile.lock":       "ruby-lock",
		"Cargo.toml":         "cargo",
		"Cargo.lock":         "cargo-lock",
		"pom.xml":            "maven",
		"build.gradle":       "gradle",
		"Dockerfile":         "docker",
		"docker-compose.yml": "docker-compose",
		"kubernetes.yaml":    "kubernetes",
		"kubernetes.yml":     "kubernetes",
		"chart.yaml":         "helm",
		"values.yaml":        "helm-values",
	}

	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}

		// Skip hidden dirs
		if info.IsDir() && strings.HasPrefix(info.Name(), ".") && info.Name() != "." {
			return filepath.SkipDir
		}

		// Skip node_modules, vendor, etc.
		if info.IsDir() && (info.Name() == "node_modules" || info.Name() == "vendor" || info.Name() == "target") {
			return filepath.SkipDir
		}

		if !info.IsDir() {
			fileName := strings.ToLower(info.Name())

			// Check exact matches
			if fileType, ok := targetFiles[fileName]; ok {
				addManifest(&manifests, path, fileType, info)
			}

			// Check pattern matches
			if strings.HasSuffix(fileName, ".yaml") || strings.HasSuffix(fileName, ".yml") {
				if strings.Contains(fileName, "kubernetes") || strings.Contains(fileName, "k8s") {
					addManifest(&manifests, path, "kubernetes", info)
				}
			}
		}
		return nil
	})

	if err != nil {
		logWarn("Manifest scan error: %v", err)
	}

	return manifests
}

func addManifest(manifests *[]audit.FileManifest, path, fileType string, info os.FileInfo) {
	if *verboseOutput {
		fmt.Printf("  → Found: %s (%s)\n", path, fileType)
	}

	content, _ := os.ReadFile(path)

	// Use Adinkra PQC-ready hash
	checksum := adinkra.Hash(content)

	// Truncate large content
	contentStr := string(content)
	if len(contentStr) > 10000 {
		contentStr = contentStr[:10000] + "\n... (truncated)"
	}

	*manifests = append(*manifests, audit.FileManifest{
		Path:     path,
		Type:     fileType,
		Content:  contentStr,
		Checksum: checksum,
		Size:     info.Size(),
		ModTime:  info.ModTime(),
	})
}

func calculateThreatScore(snapshot audit.AuditSnapshot) int {
	score := 0

	// Spoofing indicators
	score += len(snapshot.DeviceFingerprint.SpoofingIndicators) * 10

	// Critical vulnerabilities
	for _, v := range snapshot.Vulnerabilities {
		switch v.Severity {
		case "CRITICAL":
			score += 5
		case "HIGH":
			score += 2
		}
	}

	// Rootkit indicators
	score += len(snapshot.ThreatDetection.RootkitIndicators) * 15

	// Malware signatures
	score += len(snapshot.ThreatDetection.MalwareSignatures) * 20

	// Secrets detected
	score += len(snapshot.Secrets) * 8

	// Open ports on 0.0.0.0 (exposure risk)
	for _, port := range snapshot.Network.Ports {
		if port.BindAddr == "0.0.0.0" && port.Port < 1024 {
			score += 1
		}
	}

	// Compliance failures
	if snapshot.Compliance.TotalChecks > 0 {
		failureRate := float64(snapshot.Compliance.FailedChecks) / float64(snapshot.Compliance.TotalChecks)
		score += int(failureRate * 20)
	}

	// Cap at 100
	if score > 100 {
		score = 100
	}

	return score
}

func generateTags(snapshot audit.AuditSnapshot) []string {
	tags := []string{
		"adinkhepra_sonar",
		"version:" + VERSION,
		"os:" + runtime.GOOS,
		"arch:" + runtime.GOARCH,
	}

	if snapshot.PQCSignature != nil {
		tags = append(tags, "pqc_signed:dilithium3")
	}

	if len(snapshot.Vulnerabilities) > 0 {
		tags = append(tags, "vulnerabilities_detected")
	}

	if len(snapshot.Secrets) > 0 {
		tags = append(tags, "secrets_detected")
	}

	if len(snapshot.DeviceFingerprint.SpoofingIndicators) > 0 {
		tags = append(tags, "spoofing_indicators")
	}

	if snapshot.DeviceFingerprint.TPMPresent {
		tags = append(tags, "tpm_enabled")
	}

	if snapshot.Compliance.TotalChecks > 0 {
		tags = append(tags, fmt.Sprintf("compliance:%s", strings.ToLower(snapshot.Compliance.Framework)))
	}

	return tags
}

func printBanner() {
	banner := `
╔════════════════════════════════════════════════════════════════════════════╗
║                                                                            ║
║   █████╗ ██████╗ ██╗███╗   ██╗██╗  ██╗██╗  ██╗███████╗██████╗ ██████╗ █████╗    ║
║  ██╔══██╗██╔══██╗██║████╗  ██║██║ ██╔╝██║  ██║██╔════╝██╔══██╗██╔══██╗██╔══██╗   ║
║  ███████║██║  ██║██║██╔██╗ ██║█████╔╝ ███████║█████╗  ██████╔╝██████╔╝███████║   ║
║  ██╔══██║██║  ██║██║██║╚██╗██║██╔═██╗ ██╔══██║██╔══╝  ██╔═══╝ ██╔══██╗██╔══██║   ║
║  ██║  ██║██████╔╝██║██║ ╚████║██║  ██╗██║  ██║███████╗██║     ██║  ██║██║  ██║   ║
║  ╚═╝  ╚═╝╚═════╝ ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝   ║
║                                                                            ║
║                    SONAR - NUCLEAR-GRADE SECURITY AUDIT                    ║
║                           Version ` + VERSION + `                           ║
║                                                                            ║
║  ✓ Device Fingerprinting       ✓ PQC Signatures (Dilithium3)              ║
║  ✓ Network Intelligence         ✓ Built-In Vulnerability Scanner          ║
║  ✓ System Enumeration           ✓ Built-In Secret Detection               ║
║  ✓ Rootkit Detection            ✓ Built-In Container Security             ║
║  ✓ Compliance Checks            ✓ Built-In CIS/STIG/NIST Rules            ║
║                                                                            ║
║  SOVEREIGN • Zero External Dependencies • 100% Self-Contained             ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
`
	fmt.Println(banner)
}

func printSummary(snapshot audit.AuditSnapshot) {
	fmt.Println("\n╔═══════════════════════════════════════════════════════════════════╗")
	fmt.Println("║                          SCAN SUMMARY                             ║")
	fmt.Println("╠═══════════════════════════════════════════════════════════════════╣")
	fmt.Printf("║ Scan ID:              %-44s║\n", snapshot.ScanID)
	fmt.Printf("║ Timestamp:            %-44s║\n", snapshot.Timestamp.Format("2006-01-02 15:04:05 UTC"))
	fmt.Printf("║ Device Hash:          %-44s║\n", snapshot.DeviceFingerprint.CompositeHash[:44])
	fmt.Println("╠═══════════════════════════════════════════════════════════════════╣")
	fmt.Printf("║ Network Ports:        %-44d║\n", len(snapshot.Network.Ports))
	fmt.Printf("║ Running Processes:    %-44d║\n", len(snapshot.System.Processes))
	fmt.Printf("║ System Services:      %-44d║\n", len(snapshot.System.Services))
	fmt.Printf("║ Manifests Found:      %-44d║\n", len(snapshot.Manifests))
	fmt.Printf("║ Vulnerabilities:      %-44d║\n", len(snapshot.Vulnerabilities))
	fmt.Printf("║ Secrets Detected:     %-44d║\n", len(snapshot.Secrets))
	fmt.Printf("║ Threat Score:         %-44d║\n", snapshot.ThreatDetection.ThreatScore)

	if snapshot.Compliance.TotalChecks > 0 {
		fmt.Printf("║ Compliance Rate:      %-44.1f%%║\n", snapshot.Compliance.ComplianceRate)
	}

	fmt.Println("╚═══════════════════════════════════════════════════════════════════╝")
}

func log(format string, args ...interface{}) {
	fmt.Printf("[SONAR] "+format+"\n", args...)
}

func logInfo(format string, args ...interface{}) {
	fmt.Printf("[INFO] "+format+"\n", args...)
}

func logSuccess(format string, args ...interface{}) {
	fmt.Printf("[✓] "+format+"\n", args...)
}

func logWarn(format string, args ...interface{}) {
	fmt.Printf("[⚠] "+format+"\n", args...)
}

func fatal(format string, args ...interface{}) {
	fmt.Fprintf(os.Stderr, "[FATAL] "+format+"\n", args...)
	os.Exit(1)
}
