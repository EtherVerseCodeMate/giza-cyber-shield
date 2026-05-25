package ert

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/config"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/dag"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/sonar"
)

// ──────────────────────────────────────────────────────────────────────────────
// Sonar Lane — wraps pkg/sonar.UnifiedOrchestrator as a LaneRunner
//
// This is the bridge that connects the Khepra proprietary Sonar scanner
// (network port scan, OSINT via Shodan/Censys, web crawler) into the ERT
// ScanOrchestrator lane system, so its findings flow into:
//   - ert_scan MCP tool output (ert.UnifiedFinding)
//   - EA KernelRouter synthesis (pkg/ea/kernel_router.go)
//   - Godfather causal chain + DAG attestation
//
// Scope separation (per original design intent):
//   - SCALane:         Filesystem path targets (SBOM → CVEs)
//   - HorusVulnLane:   Filesystem path targets (manifest pattern matching)
//   - HorusSecretLane: Filesystem path targets (entropy/regex)
//   - HorusComplianceLane: Framework checks (CIS/STIG/NIST)
//   - HorusContainerLane:  Container image / Dockerfile targets
//   - SonarLane:       Network/IP/URL targets (port scan, OSINT, crawler)
//
// SonarLane is only activated when ScanRequest.ImageRef contains a host/IP
// (not a filesystem path) or when "sonar" is explicitly in req.Lanes.
// This prevents accidental network probing during path-only scans.
// ──────────────────────────────────────────────────────────────────────────────

const LaneSonar ScanLane = "sonar"

// SonarLane wraps pkg/sonar.UnifiedOrchestrator as a LaneRunner.
// It is stateless after construction; the orchestrator handles concurrency internally.
type SonarLane struct {
	orchestrator *sonar.UnifiedOrchestrator
}

// NewSonarLane creates a Sonar lane backed by the given UnifiedOrchestrator.
// secrets is optional — when nil, OSINT (Shodan/Censys) is silently skipped.
// store is optional — when nil, DAG attestation inside sonar is skipped
// (the ERT orchestrator performs its own DAG write at the top level).
func NewSonarLane(secrets *config.SecretBundle, store dag.Store, privateKey []byte) *SonarLane {
	return &SonarLane{
		orchestrator: sonar.NewUnifiedOrchestrator(secrets, store, privateKey),
	}
}

// Name returns the lane identifier.
func (l *SonarLane) Name() ScanLane {
	return LaneSonar
}

// Run executes the Sonar scan pipeline against a network target.
//
// Target resolution order:
//  1. req.ImageRef — used when the caller provides a host/IP/URL directly
//  2. req.TargetPath — used as fallback (e.g., CLI callers passing IPs as path)
//
// Scan types selected:
//   - Always: port scan, Horus vulnerability pattern matching
//   - When OSINT keys configured: Shodan + Censys enrichment
//   - When crawler flag set: web crawler
func (l *SonarLane) Run(ctx context.Context, req ScanRequest) ([]UnifiedFinding, error) {
	target := req.ImageRef
	if target == "" {
		target = req.TargetPath
	}
	if target == "" {
		return nil, fmt.Errorf("sonar lane: target required (set image_ref for network targets or target_path as fallback)")
	}

	log.Printf("[SONAR-LANE] Starting Sonar pipeline for: %s", target)

	scanTypes := []sonar.ScanType{
		sonar.ScanTypePort,
		sonar.ScanTypeVuln,
		sonar.ScanTypeSecrets,
	}

	// OSINT enrichment is opportunistic — requires Shodan/Censys keys at runtime.
	// The UnifiedOrchestrator silently skips OSINT when secrets are nil.
	scanTypes = append(scanTypes, sonar.ScanTypeOSINT)

	sonarReq := sonar.UnifiedScanRequest{
		Target:    target,
		ScanTypes: scanTypes,
		Timeout:   req.Timeout,
	}
	if sonarReq.Timeout == 0 {
		sonarReq.Timeout = 5 * time.Minute
	}

	result, err := l.orchestrator.ExecuteScan(ctx, sonarReq)
	if err != nil {
		return nil, fmt.Errorf("sonar lane: orchestrator failed: %w", err)
	}

	log.Printf("[SONAR-LANE] Sonar scan complete in %v: %d open ports, %d vulns, %d secrets",
		result.Duration, len(result.PortResults), len(result.Vulnerabilities), len(result.Secrets))

	return sonarToUnified(result), nil
}

// ─────────────────────────────────────────────────────────────────────────────
// sonarToUnified converts a sonar.UnifiedScanResult into []UnifiedFinding
// so the results flow into the ERT orchestrator's unified finding model.
// ─────────────────────────────────────────────────────────────────────────────

func sonarToUnified(r *sonar.UnifiedScanResult) []UnifiedFinding {
	if r == nil {
		return nil
	}

	var findings []UnifiedFinding
	now := time.Now().UTC()

	// ── Open ports → informational findings ──────────────────────────────────
	// Only flag non-standard ports; standard HTTP/HTTPS are low-value noise.
	ignoredPorts := map[int]bool{80: true, 443: true}
	for _, port := range r.PortResults {
		if ignoredPorts[port.Port] {
			continue
		}
		severity := "LOW"
		if isHighRiskPort(port.Port) {
			severity = "HIGH"
		} else if isMediumRiskPort(port.Port) {
			severity = "MEDIUM"
		}
		findings = append(findings, UnifiedFinding{
			ID:       fmt.Sprintf("sonar:port:%s:%d", r.Target, port.Port),
			Source:   "sonar",
			Category: CategoryMisconfigure,
			Severity: severity,
			Title:    fmt.Sprintf("Open port %d (%s) on %s", port.Port, port.Service, r.Target),
			Description: fmt.Sprintf("Service: %s | Banner: %s | Protocol: %s",
				port.Service, port.Banner, port.Protocol),
			Asset:    r.Target,
			Location: fmt.Sprintf("port:%d", port.Port),
			Remediation: fmt.Sprintf(
				"Verify port %d is intentionally exposed. Apply firewall rules per NIST 800-171 3.13.1.",
				port.Port),
			Evidence: map[string]interface{}{
				"port":     port.Port,
				"service":  port.Service,
				"banner":   port.Banner,
				"protocol": port.Protocol,
			},
			Timestamp: now,
			Raw:       port,
		})
	}

	// ── Horus vulnerabilities (from Sonar's built-in Horus call) ─────────────
	// Avoid duplicating findings if HorusVulnLane also ran for the same target.
	// Sonar results are tagged source="sonar" vs Horus lane source="horus".
	for _, v := range r.Vulnerabilities {
		findings = append(findings, UnifiedFinding{
			ID:          fmt.Sprintf("sonar:vuln:%s:%s", v.Package, v.ID),
			Source:      "sonar",
			Category:    CategoryVulnerability,
			Severity:    v.Severity,
			Title:       fmt.Sprintf("%s in %s@%s (network context)", v.ID, v.Package, v.Version),
			Description: v.Description,
			Asset:       v.Package,
			Location:    v.Artifact,
			CVEID:       v.ID,
			CVSSv3:      v.CVSS,
			Evidence: map[string]interface{}{
				"version":  v.Version,
				"fixed_in": v.FixedIn,
				"target":   r.Target,
			},
			Timestamp: now,
			Raw:       v,
		})
	}

	// ── Secrets ───────────────────────────────────────────────────────────────
	for _, s := range r.Secrets {
		severity := "HIGH"
		if s.Type == "Private Key" || s.Type == "AWS Key" {
			severity = "CRITICAL"
		}
		findings = append(findings, UnifiedFinding{
			ID:          fmt.Sprintf("sonar:secret:%s:%d", s.File, s.Line),
			Source:      "sonar",
			Category:    CategorySecret,
			Severity:    severity,
			Title:       fmt.Sprintf("%s detected (network scan context)", s.Type),
			Description: s.Description,
			Asset:       s.File,
			Location:    fmt.Sprintf("line:%d", s.Line),
			SecretType:  s.Type,
			Entropy:     s.Entropy,
			Redacted:    s.Redacted,
			Remediation: "Rotate immediately. Remove from version control. Use a secrets manager.",
			Evidence: map[string]interface{}{
				"file":    s.File,
				"line":    s.Line,
				"type":    s.Type,
				"target":  r.Target,
			},
			Timestamp: now,
			Raw:       s,
		})
	}

	// ── OSINT enrichment signals ──────────────────────────────────────────────
	// Shodan: surface any CVEs Shodan has attributed to this host
	if r.ShodanData != nil {
		for _, cve := range r.ShodanData.Vulns {
			findings = append(findings, UnifiedFinding{
				ID:       fmt.Sprintf("sonar:osint:shodan:%s:%s", r.Target, cve),
				Source:   "sonar",
				Category: CategoryVulnerability,
				Severity: "HIGH", // Conservative — CVSS unknown without NVD lookup
				Title:    fmt.Sprintf("Shodan: %s attributed to %s", cve, r.Target),
				Description: fmt.Sprintf(
					"Shodan intelligence reports %s on host %s (ISP: %s).",
					cve, r.Target, r.ShodanData.Org),
				Asset:    r.Target,
				Location: fmt.Sprintf("host:%s", r.Target),
				CVEID:    cve,
				Remediation: "Validate CVE applicability and patch affected service. Verify with Grype SBOM scan.",
				Evidence: map[string]interface{}{
					"source": "shodan",
					"org":    r.ShodanData.Org,
					"isp":    r.ShodanData.ISP,
					"cpe":    r.ShodanData.CPE,
				},
				Timestamp: now,
				Raw:       r.ShodanData,
			})
		}
	}

	// Censys: surface exposed services that represent attack surface
	if r.CensysData != nil && len(r.CensysData.Services) > 0 {
		findings = append(findings, UnifiedFinding{
			ID:       fmt.Sprintf("sonar:osint:censys:%s:surface", r.Target),
			Source:   "sonar",
			Category: CategoryMisconfigure,
			Severity: "MEDIUM",
			Title:    fmt.Sprintf("Censys: %d exposed services on %s", len(r.CensysData.Services), r.Target),
			Description: fmt.Sprintf(
				"Censys identifies %d externally observable services on %s. Review for unintended exposure.",
				len(r.CensysData.Services), r.Target),
			Asset:    r.Target,
			Location: fmt.Sprintf("host:%s", r.Target),
			Remediation: "Audit all externally observable services against approved baseline. Apply network segmentation per NIST 800-171 3.13.1.",
			Evidence: map[string]interface{}{
				"source":   "censys",
				"services": r.CensysData.Services,
			},
			Timestamp: now,
			Raw:       r.CensysData,
		})
	}

	log.Printf("[SONAR-LANE] Converted %d Sonar results to %d UnifiedFindings", countSonarResults(r), len(findings))
	return findings
}

// ─────────────────────────────────────────────────────────────────────────────
// Port risk classification helpers
// ─────────────────────────────────────────────────────────────────────────────

// highRiskPorts are services that represent significant attack surface when exposed.
var highRiskPorts = map[int]bool{
	21: true, // FTP — cleartext, brute-force prone
	22: true, // SSH — brute-force target (not inherently high-risk but context-dependent)
	23: true, // Telnet — cleartext protocol
	25: true, // SMTP — relay abuse
	53: true, // DNS — amplification attacks
	135: true, // MSRPC — common Windows attack vector
	139: true, // NetBIOS — Windows SMB
	445: true, // SMB — EternalBlue, ransomware vector
	1433: true, // MSSQL
	1521: true, // Oracle DB
	3306: true, // MySQL
	3389: true, // RDP — BlueKeep, ransomware vector
	5432: true, // PostgreSQL
	5900: true, // VNC — weak auth
	6379: true, // Redis — often unauthenticated
	27017: true, // MongoDB — often unauthenticated
}

var mediumRiskPorts = map[int]bool{
	8080: true, 8443: true, 8888: true, // Dev/proxy ports
	2375: true, 2376: true, // Docker daemon
	9200: true, 9300: true, // Elasticsearch
	5601: true,             // Kibana
	6443: true,             // Kubernetes API
	2379: true, 2380: true, // etcd
}

func isHighRiskPort(port int) bool  { return highRiskPorts[port] }
func isMediumRiskPort(port int) bool { return mediumRiskPorts[port] }

func countSonarResults(r *sonar.UnifiedScanResult) int {
	if r == nil {
		return 0
	}
	count := len(r.PortResults) + len(r.Vulnerabilities) + len(r.Secrets)
	if r.ShodanData != nil {
		count += len(r.ShodanData.Vulns)
	}
	if r.CensysData != nil {
		count += len(r.CensysData.Services)
	}
	return count
}
