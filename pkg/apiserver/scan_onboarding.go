package apiserver

import (
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/compliance"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/connectors"
)

const nemoClawNamePrefix = "NemoClaw @ "

// parseScanTarget returns host and ports to probe from a user-entered target (URL, host, or host:port).
func parseScanTarget(raw string) (host string, ports []int) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", []int{18789}
	}
	if strings.HasPrefix(raw, "http://") || strings.HasPrefix(raw, "https://") {
		u, err := url.Parse(raw)
		if err == nil && u.Host != "" {
			h, pStr, err := net.SplitHostPort(u.Host)
			if err != nil {
				host = u.Host
				if u.Scheme == "https" {
					return host, []int{443, 18789}
				}
				return host, []int{80, 18789}
			}
			pn, _ := strconv.Atoi(pStr)
			if pn > 0 {
				return h, []int{pn}
			}
			return h, []int{18789}
		}
	}
	if h, pStr, err := net.SplitHostPort(raw); err == nil {
		pn, _ := strconv.Atoi(pStr)
		if pn > 0 {
			return h, []int{pn}
		}
	}
	// Default: common agent gateway + HTTPS (readiness-style surface check)
	return raw, []int{18789, 443}
}

func tcpOpen(host string, port int, d time.Duration) bool {
	addr := net.JoinHostPort(host, strconv.Itoa(port))
	conn, err := net.DialTimeout("tcp", addr, d)
	if err != nil {
		return false
	}
	_ = conn.Close()
	return true
}

// runASAFOnboardingScan completes a scan record using real TCP probes and optional local NemoClaw policy audit.
func runASAFOnboardingScan(scanID string, req ScanRequest) {
	time.Sleep(1200 * time.Millisecond)

	host, ports := parseScanTarget(req.TargetURL)
	if host == "" {
		commandCenter.mu.Lock()
		if s := commandCenter.scans[scanID]; s != nil {
			now := time.Now()
			s.EndTime = &now
			s.Status = StatusFailed
			s.PresentationFindings = []ScanFindingItem{
				{Severity: "high", Text: "Invalid or empty target host."},
			}
			s.RiskScore = 0
		}
		commandCenter.mu.Unlock()
		return
	}

	var findings []ScanFindingItem
	gatewayExposed := false
	openCount := 0

	for _, p := range ports {
		if !tcpOpen(host, p, 2*time.Second) {
			continue
		}
		openCount++
		if p == 18789 {
			gatewayExposed = true
			findings = append(findings, ScanFindingItem{
				Severity: "critical",
				Text: fmt.Sprintf(
					"TCP %s:%d accepted a connection from this scanner — treat as potentially exposed agent-style surface. Verify authentication, binding, and firewall policy before handling CUI.",
					host, p,
				),
			})
		} else {
			findings = append(findings, ScanFindingItem{
				Severity: "high",
				Text:   fmt.Sprintf("Port %d on %s is reachable from the scan origin — confirm intended exposure.", p, host),
			})
		}
	}

	// ── Shodan enrichment (SHODAN_API_KEY) ──────────────────────────────────
	if shodanKey := os.Getenv("SHODAN_API_KEY"); shodanKey != "" {
		shodanFindings := enrichWithShodan(host, shodanKey)
		findings = append(findings, shodanFindings...)
	}

	// ── APIVoid domain reputation (APIVOID_API_KEY) ──────────────────────────
	if apiVoidKey := os.Getenv("APIVOID_API_KEY"); apiVoidKey != "" {
		reputationFindings := enrichWithAPIVoid(host, apiVoidKey)
		findings = append(findings, reputationFindings...)
	}

	platform := "generic"
	totalChecks := 0
	passCount := 0
	failCount := 0

	nc := connectors.NewNemoClawConnector()
	agents, _ := nc.DiscoverAgents()
	for _, a := range agents {
		if a.AgentType != "nemoclaw-openshell" {
			continue
		}
		platform = "nemoclaw"
		dir := strings.TrimPrefix(a.Name, nemoClawNamePrefix)
		dir = strings.TrimSpace(dir)
		if dir == "" {
			continue
		}
		rpt, err := compliance.AuditNemoClawDeployment(dir)
		if err != nil || rpt == nil {
			msg := "unknown error"
			if err != nil {
				msg = err.Error()
			}
			findings = append(findings, ScanFindingItem{
				Severity: "medium",
				Text:     fmt.Sprintf("NemoClaw config at %s could not be fully audited: %s", dir, msg),
			})
			continue
		}
		totalChecks = len(rpt.Results)
		passCount = rpt.PassCount
		failCount = rpt.FailCount
		for _, r := range rpt.Results {
			switch r.Status {
			case compliance.StatusPass:
				continue
			case compliance.StatusFail:
				findings = append(findings, ScanFindingItem{
					Severity: "high",
					Text:     fmt.Sprintf("%s (%s): %s — %s", r.CheckID, r.Domain, r.Title, r.Detail),
				})
			case compliance.StatusError:
				findings = append(findings, ScanFindingItem{
					Severity: "medium",
					Text:     fmt.Sprintf("%s (%s): %s — %s", r.CheckID, r.Domain, r.Title, r.Detail),
				})
			default:
				findings = append(findings, ScanFindingItem{
					Severity: "medium",
					Text:     fmt.Sprintf("%s: %s", r.CheckID, r.Title),
				})
			}
		}
	}

	if strings.EqualFold(strings.TrimSpace(req.Profile), "nemoclaw") && platform != "nemoclaw" {
		findings = append(findings, ScanFindingItem{
			Severity: "medium",
			Text:     "Profile NemoClaw requested but no local NemoClaw/OpenShell config was discovered on this host. Run assessment on the machine that holds ~/.nemoclaw (or use a deployed agent) for NMC-001–NMC-009 results.",
		})
	}

	findings = append(findings, ScanFindingItem{
		Severity: "medium",
		Text:     "CMMC / NIST 800-171 readiness: align logs, configuration exports, and change records into a single assessor-ready evidence package (traceability for C3PAO intake).",
	})

	if openCount == 0 && platform != "nemoclaw" {
		findings = append(findings, ScanFindingItem{
			Severity: "low",
			Text:     "Default probe ports (18789 / 443) did not accept TCP from this scanner — validate that scope matches your boundary (internal-only services will not appear as open from an external scanner).",
		})
	}

	risk := computeRiskScore(gatewayExposed, openCount, findings)

	commandCenter.mu.Lock()
	defer commandCenter.mu.Unlock()
	s := commandCenter.scans[scanID]
	if s == nil {
		return
	}
	now := time.Now()
	s.EndTime = &now
	s.Status = StatusCompleted
	s.Framework = req.ScanType
	s.TotalChecks = totalChecks
	s.PassedChecks = passCount
	s.FailedChecks = failCount
	s.GatewayExposed = gatewayExposed
	s.RiskScore = risk
	s.AuthWeaknessHeuristic = gatewayExposed
	s.OpenIntegrations = openCount
	s.PresentationFindings = findings
	s.Platform = platform
	s.Certified = false
}

func computeRiskScore(gatewayExposed bool, openCount int, findings []ScanFindingItem) int {
	score := 28
	if gatewayExposed {
		score += 42
	} else if openCount > 0 {
		score += 22
	}
	for _, f := range findings {
		switch f.Severity {
		case "critical":
			score += 12
		case "high":
			score += 8
		case "medium":
			score += 4
		case "low":
			score += 1
		}
	}
	if score > 100 {
		return 100
	}
	if score < 5 {
		return 5
	}
	return score
}
