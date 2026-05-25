package ert

// lane_sonar.go — Sonar scan lane for the ERT ScanOrchestrator.
//
// Design rule: ZERO external package dependencies beyond the stdlib and the
// project's own zero-dependency packages. Specifically:
//
//   ✅  pkg/scanner/network  — pure stdlib (net, sync, time)
//   ✅  pkg/scanners (Horus) — pure stdlib (os, filepath, regexp)
//   ❌  pkg/sonar            — NOT imported (pulls pkg/scanner/osint → HTTP)
//   ❌  pkg/scanner/osint    — NOT imported (Shodan/Censys require network I/O)
//
// OSINT enrichment is supported via the optional OSINTProvider interface.
// The host application (cmd/khepra-mcp, cmd/sonar) can inject a real Shodan
// or Censys client at startup without this package needing to import them.
// When no provider is injected, LaneSonar operates in stealth/air-gapped mode.
//
// Wiring in production (cmd/khepra-mcp/main.go):
//
//   sonarLane := ert.NewSonarLane(ert.SonarLaneConfig{
//       OSINTProvider: myOSINTClient, // inject at startup; nil = skip OSINT
//   })
//   orch.RegisterLane(sonarLane)

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	// pkg/scanner/network — pure stdlib (net, sync, time). Zero external deps.
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/scanner/network"

	// pkg/scanners — pure stdlib (os, filepath, regexp) + pkg/audit.
	// pkg/audit is type aliases only → pkg/types (pure structs). Zero external deps.
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/audit"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/scanners"
)

// LaneSonar is the ERT lane constant for Sonar.
const LaneSonar ScanLane = "sonar"

// ─────────────────────────────────────────────────────────────────────────────
// OSINTProvider — optional, injected at startup. Zero-dependency by default.
// ─────────────────────────────────────────────────────────────────────────────

// OSINTResult contains OSINT attribution data for a target host.
// This is a neutral type so lane_sonar.go never imports pkg/scanner/osint.
type OSINTResult struct {
	// Shodan-style fields
	Org     string   `json:"org,omitempty"`
	ISP     string   `json:"isp,omitempty"`
	Country string   `json:"country,omitempty"`
	CVEs    []string `json:"cves,omitempty"` // CVEs Shodan attributes to the host
	CPE     []string `json:"cpe,omitempty"`
	// Censys-style fields
	ExposedServiceCount int      `json:"exposed_service_count,omitempty"`
	Services            []string `json:"services,omitempty"`
	// Source metadata
	Source string `json:"source"` // "shodan", "censys", "mock", etc.
}

// OSINTProvider is the interface the lane uses for OSINT enrichment.
// Implement this against pkg/scanner/osint at the injection site.
type OSINTProvider interface {
	// Lookup returns OSINT data for a given host/IP.
	// Must return (nil, nil) if the target is not found (not an error).
	// Must respect context cancellation.
	Lookup(ctx context.Context, target string) ([]*OSINTResult, error)
}

// ─────────────────────────────────────────────────────────────────────────────
// SonarLaneConfig — constructor options
// ─────────────────────────────────────────────────────────────────────────────

// SonarLaneConfig configures a SonarLane instance.
type SonarLaneConfig struct {
	// OSINTProvider is optional. When nil, OSINT enrichment is skipped entirely.
	// Inject a real Shodan/Censys client at startup for production enrichment.
	OSINTProvider OSINTProvider

	// Ports overrides the default CommonPorts() list for port scanning.
	// Leave nil to use the defaults from pkg/scanner/network.
	Ports []int

	// ScanTimeout overrides the per-scan dial timeout (default: 2s per port).
	// This applies to individual TCP connect attempts, not the total scan time.
	ScanTimeout time.Duration

	// MaxConcurrency limits the TCP connect goroutine fan-out (default: 50).
	MaxConcurrency int
}

// ─────────────────────────────────────────────────────────────────────────────
// SonarLane
// ─────────────────────────────────────────────────────────────────────────────

// SonarLane performs zero-external-dependency network/surface scanning:
//
//   1. TCP port scan    (pkg/scanner/network — pure stdlib)
//   2. Horus vuln scan  (pkg/scanners — pure stdlib manifest matching)
//   3. Horus secret scan (pkg/scanners — pure stdlib entropy/regex)
//   4. OSINT enrichment  (optional, via injected OSINTProvider)
//
// It satisfies the LaneRunner interface and is registered by name "sonar".
// The lane only makes outbound network connections when activated with a
// network target (req.ImageRef). When given a filesystem path, it skips
// port scanning and only runs the Horus static analysis passes.
type SonarLane struct {
	cfg SonarLaneConfig
}

// NewSonarLane creates a SonarLane with the given configuration.
// All fields in cfg are optional — the zero value produces a safe, fully
// functional lane with no external dependencies.
func NewSonarLane(cfg SonarLaneConfig) *SonarLane {
	if cfg.MaxConcurrency <= 0 {
		cfg.MaxConcurrency = 50
	}
	if cfg.ScanTimeout <= 0 {
		cfg.ScanTimeout = 2 * time.Second
	}
	return &SonarLane{cfg: cfg}
}

// Name returns the lane identifier.
func (l *SonarLane) Name() ScanLane { return LaneSonar }

// Run executes the Sonar scan pipeline.
//
// Target resolution:
//   - req.ImageRef set → treated as a network target (host/IP/URL); port scan runs.
//   - req.TargetPath only → filesystem target; port scan is skipped (Horus only).
//
// This distinction prevents accidental network probing during path-mode SCA scans.
func (l *SonarLane) Run(ctx context.Context, req ScanRequest) ([]UnifiedFinding, error) {
	isNetworkTarget := req.ImageRef != ""
	target := req.ImageRef
	if target == "" {
		target = req.TargetPath
	}
	if target == "" {
		return nil, fmt.Errorf("sonar lane: target required")
	}

	log.Printf("[SONAR-LANE] Starting scan for: %s (network_mode=%v)", target, isNetworkTarget)

	var (
		mu       sync.Mutex
		findings []UnifiedFinding
		wg       sync.WaitGroup
	)

	// ── 1. Port scan (network targets only) ──────────────────────────────────
	if isNetworkTarget {
		wg.Add(1)
		go func() {
			defer wg.Done()
			ports := l.cfg.Ports
			if len(ports) == 0 {
				ports = network.CommonPorts()
			}
			scanner := network.NewScanner(target, ports)
			scanner.Timeout = l.cfg.ScanTimeout
			scanner.Threads = l.cfg.MaxConcurrency

			results := scanner.Scan(ctx)
			pf := portResultsToFindings(target, results)
			mu.Lock()
			findings = append(findings, pf...)
			mu.Unlock()
			log.Printf("[SONAR-LANE] Port scan: %d open ports", len(results))
		}()
	}

	// ── 2. Horus vulnerability scan (filesystem path) ────────────────────────
	scanPath := req.TargetPath
	if scanPath != "" {
		wg.Add(1)
		go func() {
			defer wg.Done()
			vulns, err := scanners.RunBuiltInVulnerabilityScan(scanPath)
			if err != nil {
				log.Printf("[SONAR-LANE] WARN: Horus vuln scan error: %v", err)
				return
			}
			vf := horusVulnsToFindings(vulns, target)
			mu.Lock()
			findings = append(findings, vf...)
			mu.Unlock()
			log.Printf("[SONAR-LANE] Horus vuln: %d findings", len(vulns))
		}()

		// ── 3. Horus secret scan ──────────────────────────────────────────────
		wg.Add(1)
		go func() {
			defer wg.Done()
			secrets, err := scanners.RunBuiltInSecretScan(scanPath)
			if err != nil {
				log.Printf("[SONAR-LANE] WARN: Horus secret scan error: %v", err)
				return
			}
			sf := horusSecretsToFindings(secrets, target)
			mu.Lock()
			findings = append(findings, sf...)
			mu.Unlock()
			log.Printf("[SONAR-LANE] Horus secrets: %d findings", len(secrets))
		}()
	}

	// ── 4. OSINT enrichment (optional, injected provider) ────────────────────
	if l.cfg.OSINTProvider != nil && isNetworkTarget {
		wg.Add(1)
		go func() {
			defer wg.Done()
			osintCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
			defer cancel()
			results, err := l.cfg.OSINTProvider.Lookup(osintCtx, target)
			if err != nil {
				log.Printf("[SONAR-LANE] WARN: OSINT lookup failed: %v", err)
				return
			}
			of := osintResultsToFindings(target, results)
			mu.Lock()
			findings = append(findings, of...)
			mu.Unlock()
			log.Printf("[SONAR-LANE] OSINT: %d findings from %d provider results", len(of), len(results))
		}()
	} else if isNetworkTarget {
		log.Printf("[SONAR-LANE] OSINT skipped (no provider configured — air-gapped/stealth mode)")
	}

	wg.Wait()
	log.Printf("[SONAR-LANE] Complete: %d total findings for %s", len(findings), target)
	return findings, nil
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversion helpers — all pure functions, no external imports
// ─────────────────────────────────────────────────────────────────────────────

func portResultsToFindings(host string, results []network.PortResult) []UnifiedFinding {
	now := time.Now().UTC()
	findings := make([]UnifiedFinding, 0, len(results))

	// Skip universally expected ports to reduce noise
	noisePorts := map[int]bool{80: true, 443: true}

	for _, r := range results {
		if noisePorts[r.Port] {
			continue
		}
		sev := portSeverity(r.Port)
		findings = append(findings, UnifiedFinding{
			ID:       fmt.Sprintf("sonar:port:%s:%d", host, r.Port),
			Source:   "sonar",
			Category: CategoryMisconfigure,
			Severity: sev,
			Title:    fmt.Sprintf("Open port %d/%s on %s", r.Port, r.Service, host),
			Description: fmt.Sprintf(
				"Service %q is reachable on %s:%d. Banner: %q",
				r.Service, host, r.Port, truncateBanner(r.Banner, 200)),
			Asset:    host,
			Location: fmt.Sprintf("tcp:%d", r.Port),
			Remediation: fmt.Sprintf(
				"Verify port %d is intentionally exposed. Apply firewall rules per NIST 800-171 3.13.1 / CIS Benchmark.",
				r.Port),
			Evidence: map[string]interface{}{
				"port":    r.Port,
				"service": r.Service,
				"banner":  truncateBanner(r.Banner, 200),
				"state":   r.State,
			},
			Timestamp: now,
			Raw:       r,
		})
	}
	return findings
}

// horusVulnsToFindings converts audit.Vulnerability (= types.Vulnerability alias)
// into UnifiedFindings. pkg/scanners returns []audit.Vulnerability.
func horusVulnsToFindings(vulns []audit.Vulnerability, networkCtx string) []UnifiedFinding {
	now := time.Now().UTC()
	out := make([]UnifiedFinding, 0, len(vulns))
	for _, v := range vulns {
		out = append(out, UnifiedFinding{
			ID:          fmt.Sprintf("sonar:vuln:%s:%s", v.Package, v.ID),
			Source:      "sonar",
			Category:    CategoryVulnerability,
			Severity:    v.Severity,
			Title:       fmt.Sprintf("%s in %s@%s", v.ID, v.Package, v.Version),
			Description: v.Description,
			Asset:       v.Package,
			Location:    v.Artifact,
			CVEID:       v.ID,
			CVSSv3:      v.CVSS,
			Evidence: map[string]interface{}{
				"version":     v.Version,
				"fixed_in":    v.FixedIn,
				"references":  v.References,
				"network_ctx": networkCtx,
			},
			Timestamp: now,
			Raw:       v,
		})
	}
	return out
}

// horusSecretsToFindings converts audit.SecretFinding (= types.SecretFinding alias)
// into UnifiedFindings. pkg/scanners returns []audit.SecretFinding.
func horusSecretsToFindings(secrets []audit.SecretFinding, networkCtx string) []UnifiedFinding {
	now := time.Now().UTC()
	out := make([]UnifiedFinding, 0, len(secrets))
	for _, s := range secrets {
		sev := "HIGH"
		if s.Type == "Private Key" || s.Type == "AWS Key" {
			sev = "CRITICAL"
		}
		out = append(out, UnifiedFinding{
			ID:          fmt.Sprintf("sonar:secret:%s:%d", s.File, s.Line),
			Source:      "sonar",
			Category:    CategorySecret,
			Severity:    sev,
			Title:       fmt.Sprintf("%s detected in %s", s.Type, s.File),
			Description: s.Description,
			Asset:       s.File,
			Location:    fmt.Sprintf("line:%d", s.Line),
			SecretType:  s.Type,
			Entropy:     s.Entropy,
			Redacted:    s.Redacted,
			Remediation: "Rotate immediately. Remove from version control. Use a secrets manager.",
			Evidence: map[string]interface{}{
				"file":        s.File,
				"line":        s.Line,
				"type":        s.Type,
				"entropy":     s.Entropy,
				"network_ctx": networkCtx,
			},
			Timestamp: now,
			Raw:       s,
		})
	}
	return out
}

func osintResultsToFindings(host string, results []*OSINTResult) []UnifiedFinding {
	if len(results) == 0 {
		return nil
	}
	now := time.Now().UTC()
	var out []UnifiedFinding

	for _, r := range results {
		if r == nil {
			continue
		}
		// CVE attributions from OSINT (e.g. Shodan)
		for _, cve := range r.CVEs {
			out = append(out, UnifiedFinding{
				ID:       fmt.Sprintf("sonar:osint:%s:%s:%s", r.Source, host, cve),
				Source:   "sonar",
				Category: CategoryVulnerability,
				Severity: "HIGH", // Conservative; CVSS requires NVD lookup
				Title:    fmt.Sprintf("%s: %s attributed to %s", r.Source, cve, host),
				Description: fmt.Sprintf(
					"OSINT source %q reports %s on host %s (Org: %s, ISP: %s)",
					r.Source, cve, host, r.Org, r.ISP),
				Asset:    host,
				Location: fmt.Sprintf("host:%s", host),
				CVEID:    cve,
				Remediation: "Validate CVE applicability. Patch affected service. Corroborate with Grype SBOM scan.",
				Evidence: map[string]interface{}{
					"source":  r.Source,
					"org":     r.Org,
					"isp":     r.ISP,
					"country": r.Country,
					"cpe":     r.CPE,
				},
				Timestamp: now,
				Raw:       r,
			})
		}
		// Exposed service surface (Censys-style)
		if r.ExposedServiceCount > 0 {
			out = append(out, UnifiedFinding{
				ID:       fmt.Sprintf("sonar:osint:%s:%s:surface", r.Source, host),
				Source:   "sonar",
				Category: CategoryMisconfigure,
				Severity: "MEDIUM",
				Title: fmt.Sprintf(
					"%s: %d exposed services on %s", r.Source, r.ExposedServiceCount, host),
				Description: fmt.Sprintf(
					"OSINT source %q identifies %d externally observable services on %s. Review for unintended exposure.",
					r.Source, r.ExposedServiceCount, host),
				Asset:    host,
				Location: fmt.Sprintf("host:%s", host),
				Remediation: "Audit all externally observable services against approved baseline. " +
					"Apply network segmentation per NIST 800-171 3.13.1.",
				Evidence: map[string]interface{}{
					"source":   r.Source,
					"services": r.Services,
				},
				Timestamp: now,
				Raw:       r,
			})
		}
	}
	return out
}

// ─────────────────────────────────────────────────────────────────────────────
// Port risk classification — pure function, no imports
// ─────────────────────────────────────────────────────────────────────────────

// highRiskPorts are services that represent significant attack surface.
var highRiskSonarPorts = map[int]bool{
	21: true,    // FTP — cleartext
	23: true,    // Telnet — cleartext
	135: true,   // MSRPC
	139: true,   // NetBIOS
	445: true,   // SMB — EternalBlue / ransomware
	1433: true,  // MSSQL
	1521: true,  // Oracle DB
	3306: true,  // MySQL
	3389: true,  // RDP — BlueKeep / ransomware
	5432: true,  // PostgreSQL
	5900: true,  // VNC
	6379: true,  // Redis (often unauthenticated)
	27017: true, // MongoDB (often unauthenticated)
}

var mediumRiskSonarPorts = map[int]bool{
	22: true,    // SSH (brute-force target — context dependent)
	25: true,    // SMTP relay
	53: true,    // DNS amplification
	8080: true, 8443: true, 8888: true, // Dev/proxy
	2375: true, 2376: true, // Docker daemon
	9200: true, 9300: true, // Elasticsearch
	5601: true,             // Kibana
	6443: true,             // Kubernetes API
	2379: true, 2380: true, // etcd
}

func portSeverity(port int) string {
	if highRiskSonarPorts[port] {
		return "HIGH"
	}
	if mediumRiskSonarPorts[port] {
		return "MEDIUM"
	}
	return "LOW"
}

func truncateBanner(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
