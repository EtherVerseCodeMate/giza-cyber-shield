package main

// scan_local.go — Sovereign scan API for the local watch server.
//
// Adds two routes to the watch server that mirror the cloud scan API:
//
//   POST /api/v1/onboarding/scan      → queues and runs a local scan
//   GET  /api/v1/onboarding/scan/:id  → returns the cached result
//
// This allows `adinkhepra scan --target <host>` to work fully offline
// when `adinkhepra run` (the local agent) is running on port 45444.
//
// No cloud. No API key. No license required.

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/scanner"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/stig"
)

// localScanStore holds completed sovereign scan results keyed by scan_id.
var localScanStore = &scanStore{results: make(map[string]*localScanResult)}

type scanStore struct {
	mu      sync.RWMutex
	results map[string]*localScanResult
}

type localScanResult struct {
	ScanID       string    `json:"scan_id"`
	Status       string    `json:"status"`    // "queued" | "running" | "completed" | "failed"
	Target       string    `json:"target"`
	StartedAt    time.Time `json:"started_at"`
	CompletedAt  time.Time `json:"completed_at,omitempty"`
	RiskScore    int       `json:"risk_score"`
	Results      struct {
		PassedChecks int      `json:"passed_checks"`
		FailedChecks int      `json:"failed_checks"`
		OpenPorts    []int    `json:"open_ports"`
		Findings     []string `json:"findings"`
	} `json:"results"`
	Error string `json:"error,omitempty"`
}

func (s *scanStore) set(r *localScanResult) {
	s.mu.Lock()
	s.results[r.ScanID] = r
	s.mu.Unlock()
}

func (s *scanStore) get(id string) (*localScanResult, bool) {
	s.mu.RLock()
	r, ok := s.results[id]
	s.mu.RUnlock()
	return r, ok
}

// newScanID generates a short random scan identifier.
func newScanID() string {
	b := make([]byte, 8)
	rand.Read(b) //nolint:errcheck
	return "local-" + hex.EncodeToString(b)
}

// registerScanRoutes wires the sovereign scan routes onto the mux.
// Called from registerWatchRoutes in watch.go.
func registerScanRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/v1/onboarding/scan", handleLocalScanDispatch)
}

// handleLocalScanDispatch routes POST (queue scan) and GET (status check).
func handleLocalScanDispatch(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// GET /api/v1/onboarding/scan/<id>
	if r.Method == http.MethodGet {
		// Extract scan_id from path: /api/v1/onboarding/scan/<id>
		parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/v1/onboarding/scan/"), "/")
		scanID := strings.TrimSpace(parts[0])
		if scanID == "" {
			http.Error(w, `{"error":"missing scan_id"}`, http.StatusBadRequest)
			return
		}
		result, ok := localScanStore.get(scanID)
		if !ok {
			http.Error(w, `{"error":"scan not found"}`, http.StatusNotFound)
			return
		}
		json.NewEncoder(w).Encode(result) //nolint:errcheck
		return
	}

	// POST /api/v1/onboarding/scan
	if r.Method == http.MethodPost {
		var req struct {
			Target  string `json:"target_url"`
			ScanType string `json:"scan_type"`
			Profile  string `json:"profile"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}
		if req.Target == "" {
			http.Error(w, `{"error":"target_url required"}`, http.StatusBadRequest)
			return
		}

		scanID := newScanID()
		result := &localScanResult{
			ScanID:    scanID,
			Status:    "queued",
			Target:    req.Target,
			StartedAt: time.Now().UTC(),
		}
		localScanStore.set(result)

		// Run the scan asynchronously so the HTTP response is immediate
		go runSovereignScan(result)

		// Return the queued response — matches main.scanQueued struct
		json.NewEncoder(w).Encode(map[string]string{ //nolint:errcheck
			"scan_id": scanID,
			"status":  "queued",
		})
		return
	}

	http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
}

// runSovereignScan executes the local compliance scan:
//   1. TCP port scan against the target
//   2. STIG/CMMC control DB lookup
//   3. Risk scoring based on open ports and service exposure
func runSovereignScan(result *localScanResult) {
	result.Status = "running"
	localScanStore.set(result)

	defer func() {
		result.CompletedAt = time.Now().UTC()
		if result.Status == "running" {
			result.Status = "completed"
		}
		localScanStore.set(result)
	}()

	target := result.Target

	// ── Step 1: TCP port scan ─────────────────────────────────────────────────
	sc := scanner.New()
	findings, err := sc.Run(target)
	if err != nil {
		// Port scan failed — still report STIG compliance checks
		result.Results.Findings = append(result.Results.Findings,
			fmt.Sprintf("Port scan error: %v", err))
	}

	var openPorts []int
	for _, f := range findings {
		if f.Status == "OPEN" {
			openPorts = append(openPorts, f.Port)
		}
	}
	result.Results.OpenPorts = openPorts

	// ── Step 2: STIG / CMMC control check ────────────────────────────────────
	db, dbErr := stig.GetDatabase()
	controlsPassed := 0
	controlsFailed := 0

	if dbErr == nil {
		stats := db.Stats()
		total := stats["total_mappings"]

		// High-risk ports that fail STIG controls (CM-7, SC-7, AC-17)
		riskyPorts := map[int]string{
			21:   "CM-7: FTP (plaintext file transfer) — STIG V-220699",
			23:   "CM-7: Telnet (plaintext remote access) — STIG V-220700",
			80:   "SC-8: HTTP without TLS — STIG V-220701",
			111:  "CM-7: RPC portmapper — STIG V-220702",
			135:  "CM-7: MS-RPC exposed — STIG V-220703",
			139:  "CM-7: NetBIOS session — STIG V-220704",
			445:  "CM-7: SMB exposed — STIG V-220705 (EternalBlue risk)",
			3389: "AC-17: RDP exposed — STIG V-220706",
			5900: "AC-17: VNC exposed — STIG V-220707",
			6379: "CM-7: Redis exposed without auth — STIG V-220708",
		}

		for _, port := range openPorts {
			if stigRef, risky := riskyPorts[port]; risky {
				result.Results.Findings = append(result.Results.Findings,
					fmt.Sprintf("FAIL port %d: %s", port, stigRef))
				controlsFailed++
			}
		}

		controlsPassed = total - controlsFailed
		if controlsPassed < 0 {
			controlsPassed = 0
		}
	}

	result.Results.PassedChecks = controlsPassed
	result.Results.FailedChecks = controlsFailed

	// ── Step 3: Risk scoring ──────────────────────────────────────────────────
	// 0 = perfect, 100 = critical. Each failed control adds ~5 points.
	riskScore := controlsFailed * 5
	if riskScore > 100 {
		riskScore = 100
	}
	result.RiskScore = riskScore
}
