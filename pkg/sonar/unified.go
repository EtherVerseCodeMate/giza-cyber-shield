// Unified Scanner Integration for SONAR
// Consolidates all scanner capabilities into a single orchestration layer
//
// TRL 10: Enterprise-grade, production-ready scanning infrastructure
// Connects to Khepra DAG for immutable audit trail

package sonar

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/audit"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/config"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/dag"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/scanner"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/scanner/network"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/scanner/osint"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/scanners"
)

// ScanType defines the type of scan to perform
type ScanType string

const (
	ScanTypePort       ScanType = "port_scan"
	ScanTypeOSINT      ScanType = "osint"
	ScanTypeCrawler    ScanType = "crawler"
	ScanTypeFull       ScanType = "full"
	ScanTypeVuln       ScanType = "vulnerability" // Horus - vulnerability scan
	ScanTypeSecrets    ScanType = "secrets"       // Horus - secret detection
	ScanTypeCompliance ScanType = "compliance"    // Horus - compliance check
	ScanTypeContainer  ScanType = "container"     // Horus - container scan
)

// UnifiedScanRequest defines a comprehensive scan request
type UnifiedScanRequest struct {
	Target      string            `json:"target"`
	ScanTypes   []ScanType        `json:"scan_types"`
	Ports       []int             `json:"ports,omitempty"`        // Custom ports for port scan
	FullScan    bool              `json:"full_scan,omitempty"`    // Scan all 65535 ports
	ProxyAddr   string            `json:"proxy_addr,omitempty"`   // SOCKS5 proxy for Tor
	Concurrency int               `json:"concurrency,omitempty"`  // Scanner concurrency
	Timeout     time.Duration     `json:"timeout,omitempty"`      // Scan timeout
	Options     map[string]string `json:"options,omitempty"`      // Additional options
}

// UnifiedScanResult contains all scan results
type UnifiedScanResult struct {
	RequestID   string              `json:"request_id"`
	Target      string              `json:"target"`
	StartTime   time.Time           `json:"start_time"`
	EndTime     time.Time           `json:"end_time"`
	Duration    time.Duration       `json:"duration"`
	// Network scanning results
	PortResults []scanner.Result    `json:"port_results,omitempty"`
	NetworkData []network.PortResult `json:"network_data,omitempty"`
	// OSINT results
	ShodanData  *osint.HostData     `json:"shodan_data,omitempty"`
	CensysData  *osint.CensysHostData `json:"censys_data,omitempty"`
	CrawlerData []scanner.CrawlerFinding `json:"crawler_data,omitempty"`
	// Horus (Eye of Horus) built-in scanner results
	Vulnerabilities  []audit.Vulnerability       `json:"vulnerabilities,omitempty"`
	Secrets          []audit.SecretFinding       `json:"secrets,omitempty"`
	ComplianceReport *audit.ComplianceReport     `json:"compliance_report,omitempty"`
	ContainerFindings *audit.ContainerFindings   `json:"container_findings,omitempty"`
	// Metadata
	Errors      []string            `json:"errors,omitempty"`
	DAGNodeID   string              `json:"dag_node_id,omitempty"`
}

// UnifiedOrchestrator coordinates all scanner types
type UnifiedOrchestrator struct {
	secrets    *config.SecretBundle
	store      dag.Store
	privateKey []byte
	mu         sync.RWMutex
	running    map[string]bool
}

// NewUnifiedOrchestrator creates a new unified scanner orchestrator
func NewUnifiedOrchestrator(secrets *config.SecretBundle, store dag.Store, privateKey []byte) *UnifiedOrchestrator {
	return &UnifiedOrchestrator{
		secrets:    secrets,
		store:      store,
		privateKey: privateKey,
		running:    make(map[string]bool),
	}
}

// ExecuteScan performs a unified scan based on the request
func (u *UnifiedOrchestrator) ExecuteScan(ctx context.Context, req UnifiedScanRequest) (*UnifiedScanResult, error) {
	requestID := fmt.Sprintf("scan-%d", time.Now().UnixNano())

	u.mu.Lock()
	if u.running[req.Target] {
		u.mu.Unlock()
		return nil, fmt.Errorf("scan already in progress for target: %s", req.Target)
	}
	u.running[req.Target] = true
	u.mu.Unlock()

	defer func() {
		u.mu.Lock()
		delete(u.running, req.Target)
		u.mu.Unlock()
	}()

	result := &UnifiedScanResult{
		RequestID: requestID,
		Target:    req.Target,
		StartTime: time.Now().UTC(),
	}

	log.Printf("[SONAR-UNIFIED] Starting scan %s for target %s", requestID, req.Target)

	// Determine which scans to run
	scanTypes := req.ScanTypes
	if len(scanTypes) == 0 || contains(scanTypes, ScanTypeFull) {
		scanTypes = []ScanType{ScanTypePort, ScanTypeOSINT}
	}

	var wg sync.WaitGroup
	var mu sync.Mutex

	// Execute scans concurrently
	for _, scanType := range scanTypes {
		wg.Add(1)
		go func(st ScanType) {
			defer wg.Done()

			switch st {
			case ScanTypePort:
				u.executePortScan(ctx, req, result, &mu)
			case ScanTypeOSINT:
				u.executeOSINTScan(ctx, req, result, &mu)
			case ScanTypeCrawler:
				u.executeCrawlerScan(ctx, req, result, &mu)
			case ScanTypeVuln:
				u.executeVulnerabilityScan(ctx, req, result, &mu)
			case ScanTypeSecrets:
				u.executeSecretScan(ctx, req, result, &mu)
			case ScanTypeCompliance:
				u.executeComplianceScan(ctx, req, result, &mu)
			case ScanTypeContainer:
				u.executeContainerScan(ctx, req, result, &mu)
			}
		}(scanType)
	}

	// Wait with timeout
	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	timeout := req.Timeout
	if timeout == 0 {
		timeout = 10 * time.Minute
	}

	select {
	case <-done:
		// All scans completed
	case <-time.After(timeout):
		mu.Lock()
		result.Errors = append(result.Errors, "scan timeout reached")
		mu.Unlock()
	case <-ctx.Done():
		mu.Lock()
		result.Errors = append(result.Errors, "scan cancelled")
		mu.Unlock()
	}

	result.EndTime = time.Now().UTC()
	result.Duration = result.EndTime.Sub(result.StartTime)

	// Record to DAG
	if err := u.recordToDAG(result); err != nil {
		log.Printf("[SONAR-UNIFIED] WARN: Failed to record to DAG: %v", err)
	}

	log.Printf("[SONAR-UNIFIED] Scan %s completed in %v", requestID, result.Duration)
	return result, nil
}

func (u *UnifiedOrchestrator) executePortScan(ctx context.Context, req UnifiedScanRequest, result *UnifiedScanResult, mu *sync.Mutex) {
	log.Printf("[SONAR-UNIFIED] Executing port scan for %s", req.Target)

	// Use the advanced scanner from pkg/scanner
	s := scanner.New()

	if req.Concurrency > 0 {
		s.Concurrency = req.Concurrency
	}

	if len(req.Ports) > 0 {
		s.FocusPorts(req.Ports)
	}

	if req.FullScan {
		s.SetFullScan()
	}

	if req.ProxyAddr != "" {
		s.SetProxy(req.ProxyAddr)
		log.Printf("[SONAR-UNIFIED] Using proxy: %s", req.ProxyAddr)
	}

	results, err := s.Run(req.Target)
	if err != nil {
		mu.Lock()
		result.Errors = append(result.Errors, fmt.Sprintf("port scan failed: %v", err))
		mu.Unlock()
		return
	}

	mu.Lock()
	result.PortResults = results
	mu.Unlock()

	log.Printf("[SONAR-UNIFIED] Port scan complete. Found %d open ports", len(results))

	// Also run network scanner for additional data
	networkScanner := network.NewScanner(req.Target, nil)
	networkResults := networkScanner.Scan(ctx)

	mu.Lock()
	result.NetworkData = networkResults
	mu.Unlock()
}

func (u *UnifiedOrchestrator) executeOSINTScan(ctx context.Context, req UnifiedScanRequest, result *UnifiedScanResult, mu *sync.Mutex) {
	if u.secrets == nil {
		log.Println("[SONAR-UNIFIED] OSINT skipped: no secrets configured")
		return
	}

	log.Printf("[SONAR-UNIFIED] Executing OSINT lookup for %s", req.Target)

	// Shodan
	if len(u.secrets.ShodanKey) > 0 {
		shodan := osint.NewShodanClient(u.secrets.ShodanKey)
		data, err := shodan.GetHostInfo(req.Target)
		if err != nil {
			mu.Lock()
			result.Errors = append(result.Errors, fmt.Sprintf("shodan lookup failed: %v", err))
			mu.Unlock()
		} else {
			mu.Lock()
			result.ShodanData = data
			mu.Unlock()
			log.Printf("[SONAR-UNIFIED] Shodan data acquired. ISP: %s, Vulns: %d", data.Org, len(data.Vulns))
		}
	}

	// Censys
	if len(u.secrets.CensysID) > 0 && len(u.secrets.CensysSecret) > 0 {
		censys := osint.NewCensysClient(u.secrets.CensysID, u.secrets.CensysSecret)
		data, err := censys.GetHostInfo(req.Target)
		if err != nil {
			mu.Lock()
			result.Errors = append(result.Errors, fmt.Sprintf("censys lookup failed: %v", err))
			mu.Unlock()
		} else {
			mu.Lock()
			result.CensysData = data
			mu.Unlock()
			log.Printf("[SONAR-UNIFIED] Censys data acquired. Services: %d", len(data.Services))
		}
	}

	// Memory sanitization
	if u.secrets != nil {
		u.secrets.Wipe()
		log.Println("[SONAR-UNIFIED] OSINT keys wiped from memory")
	}
}

func (u *UnifiedOrchestrator) executeCrawlerScan(ctx context.Context, req UnifiedScanRequest, result *UnifiedScanResult, mu *sync.Mutex) {
	log.Printf("[SONAR-UNIFIED] Executing crawler for %s", req.Target)

	outputPath := fmt.Sprintf("data/scans/%s_%d.json", req.Target, time.Now().Unix())

	if err := scanner.RunCrawler(req.Target, outputPath); err != nil {
		mu.Lock()
		result.Errors = append(result.Errors, fmt.Sprintf("crawler failed: %v", err))
		mu.Unlock()
		return
	}

	findings, err := scanner.ParseCrawler(outputPath)
	if err != nil {
		mu.Lock()
		result.Errors = append(result.Errors, fmt.Sprintf("crawler parse failed: %v", err))
		mu.Unlock()
		return
	}

	mu.Lock()
	result.CrawlerData = findings
	mu.Unlock()

	log.Printf("[SONAR-UNIFIED] Crawler complete. Found %d items", len(findings))
}

// Horus (Eye of Horus) Built-in Scanner Methods
// Zero-dependency vulnerability, secret, compliance, and container scanning

func (u *UnifiedOrchestrator) executeVulnerabilityScan(ctx context.Context, req UnifiedScanRequest, result *UnifiedScanResult, mu *sync.Mutex) {
	log.Printf("[SONAR-HORUS] Executing vulnerability scan for %s", req.Target)

	vulns, err := scanners.RunBuiltInVulnerabilityScan(req.Target)
	if err != nil {
		mu.Lock()
		result.Errors = append(result.Errors, fmt.Sprintf("vulnerability scan failed: %v", err))
		mu.Unlock()
		return
	}

	mu.Lock()
	result.Vulnerabilities = vulns
	mu.Unlock()

	log.Printf("[SONAR-HORUS] Vulnerability scan complete. Found %d vulnerabilities", len(vulns))
}

func (u *UnifiedOrchestrator) executeSecretScan(ctx context.Context, req UnifiedScanRequest, result *UnifiedScanResult, mu *sync.Mutex) {
	log.Printf("[SONAR-HORUS] Executing secret scan for %s", req.Target)

	secrets, err := scanners.RunBuiltInSecretScan(req.Target)
	if err != nil {
		mu.Lock()
		result.Errors = append(result.Errors, fmt.Sprintf("secret scan failed: %v", err))
		mu.Unlock()
		return
	}

	mu.Lock()
	result.Secrets = secrets
	mu.Unlock()

	log.Printf("[SONAR-HORUS] Secret scan complete. Found %d secrets", len(secrets))
}

func (u *UnifiedOrchestrator) executeComplianceScan(ctx context.Context, req UnifiedScanRequest, result *UnifiedScanResult, mu *sync.Mutex) {
	// Get framework from options, default to "cis"
	framework := "cis"
	if req.Options != nil {
		if f, ok := req.Options["compliance_framework"]; ok {
			framework = f
		}
	}

	log.Printf("[SONAR-HORUS] Executing %s compliance scan", framework)

	report, err := scanners.RunBuiltInComplianceScan(framework)
	if err != nil {
		mu.Lock()
		result.Errors = append(result.Errors, fmt.Sprintf("compliance scan failed: %v", err))
		mu.Unlock()
		return
	}

	mu.Lock()
	result.ComplianceReport = &report
	mu.Unlock()

	log.Printf("[SONAR-HORUS] Compliance scan complete. %d/%d checks passed (%.1f%%)",
		report.PassedChecks, report.TotalChecks, report.ComplianceRate)
}

func (u *UnifiedOrchestrator) executeContainerScan(ctx context.Context, req UnifiedScanRequest, result *UnifiedScanResult, mu *sync.Mutex) {
	log.Printf("[SONAR-HORUS] Executing container scan for %s", req.Target)

	findings, err := scanners.RunBuiltInContainerScan(req.Target)
	if err != nil {
		mu.Lock()
		result.Errors = append(result.Errors, fmt.Sprintf("container scan failed: %v", err))
		mu.Unlock()
		return
	}

	mu.Lock()
	result.ContainerFindings = findings
	mu.Unlock()

	log.Printf("[SONAR-HORUS] Container scan complete. Found %d misconfigurations",
		len(findings.Misconfigurations))
}

func (u *UnifiedOrchestrator) recordToDAG(result *UnifiedScanResult) error {
	if u.store == nil {
		return fmt.Errorf("no DAG store configured")
	}

	resultJSON, err := json.Marshal(result)
	if err != nil {
		return fmt.Errorf("failed to serialize result: %w", err)
	}

	node := &dag.Node{
		Action: "UNIFIED_SCAN",
		Symbol: "Nyansapo", // Wisdom knot - intelligence gathered
		Time:   time.Now().UTC().Format(time.RFC3339Nano),
		PQC: map[string]string{
			"request_id":   result.RequestID,
			"target":       result.Target,
			"duration_sec": fmt.Sprintf("%.2f", result.Duration.Seconds()),
			"port_count":   fmt.Sprintf("%d", len(result.PortResults)+len(result.NetworkData)),
		},
	}

	// Sign if private key available
	if len(u.privateKey) > 0 {
		if err := node.Sign(u.privateKey); err != nil {
			log.Printf("[SONAR-UNIFIED] WARN: Failed to sign node: %v", err)
		}
	}

	if err := u.store.Add(node, nil); err != nil {
		return fmt.Errorf("failed to add to DAG: %w", err)
	}

	result.DAGNodeID = node.ID
	log.Printf("[SONAR-UNIFIED] Scan recorded to DAG: %s (payload: %d bytes)", node.ID, len(resultJSON))
	return nil
}

// GetRunningScans returns a list of targets with scans in progress
func (u *UnifiedOrchestrator) GetRunningScans() []string {
	u.mu.RLock()
	defer u.mu.RUnlock()

	targets := make([]string, 0, len(u.running))
	for t := range u.running {
		targets = append(targets, t)
	}
	return targets
}

func contains(slice []ScanType, item ScanType) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}
