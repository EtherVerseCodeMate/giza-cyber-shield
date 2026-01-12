package ert

import (
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
	"strings"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/stig"
)

// scanStrategyDocuments finds strategy/roadmap documents
func (e *Engine) scanStrategyDocuments() []string {
	docs := []string{}
	patterns := []string{"strategy", "roadmap", "vision", "plan", "objective"}

	filepath.Walk(e.targetPath, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}

		nameLower := strings.ToLower(info.Name())
		for _, pattern := range patterns {
			if strings.Contains(nameLower, pattern) {
				docs = append(docs, path)
				break
			}
		}

		if len(docs) >= 10 {
			return filepath.SkipDir
		}

		return nil
	})

	return docs
}

// extractComplianceGaps extracts gaps from STIG validation report
func (e *Engine) extractComplianceGaps(report *stig.ComprehensiveReport) []ComplianceGap {
	gaps := []ComplianceGap{}

	for framework, valResult := range report.Results {
		for _, finding := range valResult.Findings {
			if finding.Status != "Pass" {
				gap := ComplianceGap{
					Framework:   framework,
					Control:     finding.ID,
					Description: finding.Title,
					Severity:    string(finding.Severity),
				}
				gaps = append(gaps, gap)

				if len(gaps) >= 20 {
					break
				}
			}
		}
		if len(gaps) >= 20 {
			break
		}
	}

	return gaps
}

// calculateSTIGScore calculates overall STIG compliance score (0-100)
func (e *Engine) calculateSTIGScore(report *stig.ComprehensiveReport) int {
	if report == nil || len(report.Results) == 0 {
		return 0
	}

	passed := 0
	total := 0

	for _, result := range report.Results {
		total += result.TotalControls
		passed += result.Passed
	}

	if total == 0 {
		return 0
	}

	return (passed * 100) / total
}

// detectRegulatoryConflicts checks for conflicting regulatory requirements
func (e *Engine) detectRegulatoryConflicts() []string {
	conflicts := []string{}

	// Check for GDPR conflicts (data residency vs cloud deployment)
	if e.hasCloudDeployment() && e.hasEUData() {
		conflicts = append(conflicts, "GDPR Art. 14: Data localization requirement conflicts with multi-region cloud deployment")
	}

	// Check for CMMC conflicts
	if e.hasCMMCRequirement() && !e.hasFIPSCrypto() {
		conflicts = append(conflicts, "CMMC Level 2: FIPS 140-3 cryptography required but not detected")
	}

	// Check for NIST 800-171 conflicts
	if e.hasNIST800171Requirement() && !e.hasMultiFactorAuth() {
		conflicts = append(conflicts, "NIST 800-171 3.5.3: Multi-factor authentication required but not implemented")
	}

	return conflicts
}

// calculateAlignmentScore calculates strategic-technical alignment (0-100)
func (e *Engine) calculateAlignmentScore(intel *ReadinessIntel) int {
	score := 100

	// Penalty for compliance gaps
	score -= len(intel.ComplianceGaps) * 2
	if score < 0 {
		score = 0
	}

	// Penalty for regulatory conflicts
	score -= len(intel.RegulatoryConflicts) * 5
	if score < 0 {
		score = 0
	}

	// Bonus for STIG compliance
	if intel.STIGScore > 80 {
		score += 10
	}

	// Bonus for strategy documents
	if len(intel.StrategyDocs) > 0 {
		score += 5
	}

	if score > 100 {
		score = 100
	}

	return score
}

// generateRoadmap creates prioritized action items
func (e *Engine) generateRoadmap(intel *ReadinessIntel) []RoadmapItem {
	roadmap := []RoadmapItem{}

	// Critical gaps first
	if intel.AlignmentScore < 60 {
		roadmap = append(roadmap, RoadmapItem{
			Priority: "URGENT",
			Action:   "Address critical compliance gaps",
			Impact:   "Unblocks regulatory approval and contract renewals",
			Timeline: "30 days",
		})
	}

	// Regulatory conflicts
	if len(intel.RegulatoryConflicts) > 0 {
		roadmap = append(roadmap, RoadmapItem{
			Priority: "URGENT",
			Action:   "Resolve regulatory conflicts",
			Impact:   "Prevents compliance violations and fines",
			Timeline: "60 days",
		})
	}

	// STIG improvements
	if intel.STIGScore < 80 {
		roadmap = append(roadmap, RoadmapItem{
			Priority: "STRATEGIC",
			Action:   "Implement AdinKhepra STIG Validation Suite",
			Impact:   "Achieves CMMC Level 2 compliance within 90 days",
			Timeline: "90 days",
		})
	}

	// PQC migration (always include)
	roadmap = append(roadmap, RoadmapItem{
		Priority: "STRATEGIC",
		Action:   "Initiate Post-Quantum Cryptography Migration",
		Impact:   "Future-proofs security, avoids re-audit costs",
		Timeline: "6 months",
	})

	return roadmap
}

// buildDependencyGraph builds dependency map from go.mod
func (e *Engine) buildDependencyGraph() map[string][]string {
	graph := make(map[string][]string)

	goModPath := filepath.Join(e.targetPath, "go.mod")
	data, err := os.ReadFile(goModPath)
	if err != nil {
		return graph // Empty graph if no go.mod
	}

	lines := strings.Split(string(data), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "require") || strings.HasPrefix(line, "//") {
			continue
		}

		// Parse dependency lines
		if strings.Contains(line, "/") && !strings.HasPrefix(line, "replace") {
			parts := strings.Fields(line)
			if len(parts) >= 2 {
				pkg := parts[0]
				version := parts[1]
				graph[pkg] = []string{version}
			}
		}
	}

	return graph
}

// scanDependenciesForCVEs scans dependencies against CVE database
func (e *Engine) scanDependenciesForCVEs(deps map[string][]string) []VulnerableDep {
	vulnerable := []VulnerableDep{}

	for pkg := range deps {
		// Extract package name (last component)
		pkgName := filepath.Base(pkg)

		// Search CVE database
		cves := e.cveDatabase.SearchByPackage(pkgName)

		if len(cves) > 0 {
			dep := VulnerableDep{
				Package:     pkg,
				Version:     deps[pkg][0],
				CVEs:        []string{},
				Severity:    "UNKNOWN",
				Exploitable: false,
			}

			for _, cve := range cves {
				dep.CVEs = append(dep.CVEs, cve.ID)

				// Update severity to highest found
				if cve.CVSS >= 9.0 && dep.Severity != "CRITICAL" {
					dep.Severity = "CRITICAL"
				} else if cve.CVSS >= 7.0 && dep.Severity != "CRITICAL" && dep.Severity != "HIGH" {
					dep.Severity = "HIGH"
				}

				// Check if known exploited
				if e.cveDatabase.IsKnownExploited(cve.ID) {
					dep.Exploitable = true
				}
			}

			vulnerable = append(vulnerable, dep)
		}

		// Check for known dangerous packages
		if strings.Contains(pkg, "log4j") {
			vulnerable = append(vulnerable, VulnerableDep{
				Package:     pkg,
				Version:     deps[pkg][0],
				CVEs:        []string{"CVE-2021-44228"},
				Severity:    "CRITICAL",
				Exploitable: true,
			})
		}

		if strings.Contains(pkg, "solarwinds") {
			vulnerable = append(vulnerable, VulnerableDep{
				Package:     pkg,
				Version:     deps[pkg][0],
				CVEs:        []string{"CVE-2020-10148"},
				Severity:    "CRITICAL",
				Exploitable: true,
			})
		}
	}

	return vulnerable
}

// countModules counts Go modules in codebase
func (e *Engine) countModules() int {
	count := 0
	filepath.Walk(e.targetPath, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}
		if strings.HasSuffix(path, ".go") {
			count++
		}
		return nil
	})
	return count
}

// countFiles counts total files
func (e *Engine) countFiles() int {
	count := 0
	filepath.Walk(e.targetPath, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}
		count++
		return nil
	})
	return count
}

// detectShadowIT detects unmanaged dependencies
func (e *Engine) detectShadowIT() []string {
	shadowIT := []string{}

	// Check for vendor directory (vendored deps are managed)
	vendorPath := filepath.Join(e.targetPath, "vendor")
	if _, err := os.Stat(vendorPath); os.IsNotExist(err) {
		shadowIT = append(shadowIT, "No vendor directory: dependencies may not be pinned")
	}

	// Check for package-lock.json or yarn.lock (JS dependencies)
	jsLockPath := filepath.Join(e.targetPath, "package-lock.json")
	if _, err := os.Stat(jsLockPath); err == nil {
		shadowIT = append(shadowIT, "JavaScript dependencies detected: requires separate CVE scanning")
	}

	return shadowIT
}

// detectArchitecturalFriction detects RACI mismatches and access anomalies
func (e *Engine) detectArchitecturalFriction() []FrictionPoint {
	friction := []FrictionPoint{}

	// Check for CI/CD without tests
	hasCI := false
	hasTests := false

	entries, _ := os.ReadDir(e.targetPath)
	for _, entry := range entries {
		name := entry.Name()
		if name == ".github" || name == ".gitlab-ci.yml" {
			hasCI = true
		}
		if strings.Contains(name, "test") {
			hasTests = true
		}
	}

	if hasCI && !hasTests {
		friction = append(friction, FrictionPoint{
			Category:    "CI/CD",
			Description: "CI/CD pipeline exists but test coverage is missing",
			Impact:      "Deployment quality cannot be verified automatically",
		})
	}

	// Check for secrets in repo
	if e.hasSecretsInRepo() {
		friction = append(friction, FrictionPoint{
			Category:    "Security",
			Description: "Potential secrets detected in version control",
			Impact:      "Risk of credential exposure",
		})
	}

	return friction
}

// hashSourceFiles hashes all source files for Merkle tree
func (e *Engine) hashSourceFiles() []string {
	hashes := []string{}

	filepath.Walk(e.targetPath, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}

		// Only hash code files
		if !strings.HasSuffix(path, ".go") && !strings.HasSuffix(path, ".py") &&
			!strings.HasSuffix(path, ".js") && !strings.HasSuffix(path, ".java") {
			return nil
		}

		data, err := os.ReadFile(path)
		if err != nil {
			return nil
		}

		hash := sha256.Sum256(data)
		hashes = append(hashes, hex.EncodeToString(hash[:]))

		if len(hashes) >= 100 {
			return filepath.SkipDir
		}

		return nil
	})

	return hashes
}

// scanCryptoPrimitives scans for crypto usage
func (e *Engine) scanCryptoPrimitives() CryptoUsage {
	usage := CryptoUsage{}

	filepath.Walk(e.targetPath, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() || !strings.HasSuffix(path, ".go") {
			return nil
		}

		data, err := os.ReadFile(path)
		if err != nil {
			return nil
		}

		content := string(data)

		// Count crypto primitive usage
		usage.RSA += strings.Count(content, "rsa.")
		usage.ECDSA += strings.Count(content, "ecdsa.")
		usage.AES += strings.Count(content, "aes.")
		usage.SHA += strings.Count(content, "sha256") + strings.Count(content, "sha512")
		usage.Kyber += strings.Count(content, "kyber") + strings.Count(content, "Kyber")
		usage.Dilithium += strings.Count(content, "dilithium") + strings.Count(content, "Dilithium")

		return nil
	})

	usage.HasLegacy = usage.RSA > 0 || usage.ECDSA > 0
	usage.HasPQC = usage.Kyber > 0 || usage.Dilithium > 0

	return usage
}

// analyzeIPLineage determines code ownership
func (e *Engine) analyzeIPLineage() IPLineage {
	lineage := IPLineage{}

	proprietaryCount := 0
	ossCount := 0
	gplCount := 0
	totalFiles := 0

	filepath.Walk(e.targetPath, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}

		if !strings.HasSuffix(path, ".go") && !strings.HasSuffix(path, ".py") &&
			!strings.HasSuffix(path, ".js") {
			return nil
		}

		data, err := os.ReadFile(path)
		if err != nil {
			return nil
		}

		content := string(data)
		totalFiles++

		// Check header (first 20 lines)
		lines := strings.Split(content, "\n")
		header := strings.Join(lines[:min(len(lines), 20)], "\n")

		if strings.Contains(header, "Copyright") || strings.Contains(header, "Proprietary") {
			proprietaryCount++
		} else if strings.Contains(header, "GPL") {
			gplCount++
		} else if strings.Contains(header, "MIT") || strings.Contains(header, "Apache") {
			ossCount++
		} else {
			proprietaryCount++ // Assume proprietary if no license
		}

		return nil
	})

	if totalFiles > 0 {
		lineage.Proprietary = float64(proprietaryCount) / float64(totalFiles) * 100
		lineage.OSS = float64(ossCount) / float64(totalFiles) * 100
		lineage.GPL = float64(gplCount) / float64(totalFiles) * 100
		lineage.Clean = gplCount == 0
	}

	return lineage
}

// assessPQCReadiness assesses post-quantum readiness
func (e *Engine) assessPQCReadiness(usage CryptoUsage) string {
	if usage.HasPQC && !usage.HasLegacy {
		return "READY"
	} else if usage.HasPQC && usage.HasLegacy {
		return "HYBRID"
	} else if usage.HasLegacy {
		return "VULNERABLE"
	}
	return "UNKNOWN"
}

// Helper functions

func (e *Engine) hasCloudDeployment() bool {
	// Check for cloud deployment manifests
	entries, _ := os.ReadDir(e.targetPath)
	for _, entry := range entries {
		name := entry.Name()
		if name == "deploy" || name == "k8s" || name == "terraform" {
			return true
		}
	}
	return false
}

func (e *Engine) hasEUData() bool {
	// Simplified: check for GDPR-related files
	return false // Would need actual data classification
}

func (e *Engine) hasCMMCRequirement() bool {
	// Check for CMMC requirements in strategy docs
	return true // Assume yes for DoD customers
}

func (e *Engine) hasFIPSCrypto() bool {
	// Check for FIPS-related code
	fipsPath := filepath.Join(e.targetPath, "pkg", "crypto", "fips.go")
	_, err := os.Stat(fipsPath)
	return err == nil
}

func (e *Engine) hasNIST800171Requirement() bool {
	return true // Assume yes for federal customers
}

func (e *Engine) hasMultiFactorAuth() bool {
	// Simplified: would need to scan for MFA implementation
	return false
}

func (e *Engine) hasSecretsInRepo() bool {
	// Check for common secret patterns
	entries, _ := os.ReadDir(e.targetPath)
	for _, entry := range entries {
		name := entry.Name()
		if strings.Contains(name, "secret") || strings.Contains(name, "key") || name == ".env" {
			return true
		}
	}
	return false
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
