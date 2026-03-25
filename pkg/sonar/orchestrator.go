package sonar

import (
	"context"
	"fmt"
	"log"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/config"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/scanner/network"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/scanner/osint"
)

// SonarRuntime manages the lifecycle of the active audit
type SonarRuntime struct {
	secrets *config.SecretBundle
}

// NewOrchestrator initializes the runtime with secrets (if available)
func NewOrchestrator(secrets *config.SecretBundle) *SonarRuntime {
	return &SonarRuntime{secrets: secrets}
}

// ActiveScanResult holds the combined intelligence
type ActiveScanResult struct {
	Target      string
	PortResults []network.PortResult
	ShodanData  *osint.HostData
	CensysData  *osint.CensysHostData
	Error       string
}

// RunActiveScan executes the native Go toolchain
func (r *SonarRuntime) RunActiveScan(targetIP string) ActiveScanResult {
	result := ActiveScanResult{Target: targetIP}
	log.Printf("[SONAR] Mission Start: Active scan engaged for %s", targetIP)

	// 1. Native Port Scan (Zero-Dependency)
	scanner := network.NewScanner(targetIP, nil)
	result.PortResults = scanner.Scan(context.Background())
	if result.PortResults == nil {
		result.PortResults = []network.PortResult{}
	}
	log.Printf("[SONAR] Network Scan Complete. Open Ports: %d", len(result.PortResults))

	// 2. Native OSINT (Optional)
	if r.secrets != nil {
		osintRun := r.runOSINTIntellence(targetIP, &result)
		if osintRun {
			r.secrets.Wipe()
			log.Println("[SONAR] Memory Sanitized (OSINT Keys Wiped).")
		} else {
			log.Println("[SONAR] Stealth Mode: OSINT skipped (No keys loaded).")
		}
	} else {
		log.Println("[SONAR] Stealth Mode: OSINT skipped (No keys loaded).")
	}

	return result
}

func (r *SonarRuntime) runOSINTIntellence(targetIP string, result *ActiveScanResult) bool {
	osintRun := false
	if len(r.secrets.ShodanKey) > 0 {
		r.runShodanIntel(targetIP, result)
		osintRun = true
	}
	if len(r.secrets.CensysID) > 0 && len(r.secrets.CensysSecret) > 0 {
		r.runCensysIntel(targetIP, result)
		osintRun = true
	}
	return osintRun
}

func (r *SonarRuntime) runShodanIntel(targetIP string, result *ActiveScanResult) {
	log.Printf("[SONAR] Engaging Shodan Intelligence...")
	shodan := osint.NewShodanClient(r.secrets.ShodanKey)
	data, err := shodan.GetHostInfo(targetIP)
	if err != nil {
		log.Printf("[SONAR] WARN: Shodan lookup failed: %v", err)
		result.Error += fmt.Sprintf("Shodan Fail: %v; ", err)
	} else {
		result.ShodanData = data
		log.Printf("[SONAR] Shodan Intel Acquired. ISP: %s, Vulns: %d", data.Org, len(data.Vulns))
	}
}

func (r *SonarRuntime) runCensysIntel(targetIP string, result *ActiveScanResult) {
	log.Printf("[SONAR] Engaging Censys Intelligence...")
	censys := osint.NewCensysClient(r.secrets.CensysID, r.secrets.CensysSecret)
	data, err := censys.GetHostInfo(targetIP)
	if err != nil {
		log.Printf("[SONAR] WARN: Censys lookup failed: %v", err)
		result.Error += fmt.Sprintf("Censys Fail: %v; ", err)
	} else {
		result.CensysData = data
		log.Printf("[SONAR] Censys Intel Acquired. Services: %d", len(data.Services))
	}
}
