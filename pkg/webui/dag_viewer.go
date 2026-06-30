// Package webui provides the DAG visualization web interface.
//
// This package serves the "Living Trust Constellation" HTML interface for
// visualizing the immutable DAG (Directed Acyclic Graph) audit trail.
//
// The web UI displays:
// - Real-time DAG node visualization
// - Cryptographic verification status
// - Network topology and trust relationships
// - Live metrics (nodes, edges, hash power)
//
// Access:
//   http://localhost:8080/dag
//
// Security:
//   - Read-only view (no mutations via web UI)
//   - Optional mTLS authentication for production
//   - CORS restricted to localhost in development

package webui

import (
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/sekhem"
)

//go:embed static/*
var staticFiles embed.FS

// DAGNode represents a node in the trust constellation
type DAGNode struct {
	ID        string              `json:"id"`
	Timestamp time.Time           `json:"timestamp"`
	EventType string              `json:"event_type"` // e.g., "stig_scan", "license_check", "genesis_backup"
	Hash      string              `json:"hash"`
	Parents   []string            `json:"parents"` // Parent node IDs (for DAG edges)
	Signature string              `json:"signature"`
	Verified  bool                `json:"verified"`
	Action    string              `json:"action,omitempty"`              // Original DAG action
	Symbol    string              `json:"symbol,omitempty"`              // Adinkra symbol
	PQC       map[string]string   `json:"pqc_metadata,omitempty"`       // PQC metadata from DAG
}

// DAGStats provides real-time statistics for the HUD overlay
type DAGStats struct {
	Status       string `json:"status"`
	NodeCount    int    `json:"node_count"`
	EdgeCount    int    `json:"edge_count"`
	HashPower    string `json:"hash_power"`
	LastSync     string `json:"last_sync"`
	FIPSEnabled  bool   `json:"fips_enabled"`
	PQCActive    bool   `json:"pqc_active"`
}

// DAGViewer serves the web UI for DAG visualization
type DAGViewer struct {
	port        int
	dagProvider DAGProvider // Interface to actual DAG storage
	server      *http.Server
	api         *DAGAPI           // optional — registers /dag/add, /adinkra/weave, /compliance/scan-all, etc.
	authAPI     *AuthAPI          // optional — registers /api/v1/auth/login, /validate, /bootstrap
	remediateAPI *RemediateAPI    // optional — registers /api/v1/asaf/remediate, /staging
	wafShield   *sekhem.WAFShield // optional — bilateral ingress/egress WAF, see WithWAF
}

// WithAPI attaches the migrated khepra-daemon endpoints (DAG add, weave/unweave,
// attest, status, compliance graph export, CMMC scan-all) to this viewer's mux.
// Returns dv for chaining.
func (dv *DAGViewer) WithAPI(api *DAGAPI) *DAGViewer {
	dv.api = api
	return dv
}

// WithAuth attaches the sovereign SQLite-backed auth endpoints to this
// viewer's mux. Returns dv for chaining.
func (dv *DAGViewer) WithAuth(authAPI *AuthAPI) *DAGViewer {
	dv.authAPI = authAPI
	return dv
}

// WithRemediate attaches the asaf-daemon ChangeRequest relay endpoints
// (/api/v1/asaf/remediate, /staging) to this viewer's mux. Returns dv for
// chaining.
func (dv *DAGViewer) WithRemediate(remediateAPI *RemediateAPI) *DAGViewer {
	dv.remediateAPI = remediateAPI
	return dv
}

// WithWAF attaches the SEKHEM bilateral WAF (ingress request inspection +
// egress secret scrubbing) in front of every route on this viewer — the
// DAG/auth/compliance-graph API surface this process exposes. Returns dv
// for chaining. The WAFShield itself (and the KASA engine + DuatRealm it's
// constructed from) lives in cmd/adinkhepra/serve.go, not here — this is
// just where it gets attached to the HTTP handler chain.
func (dv *DAGViewer) WithWAF(waf *sekhem.WAFShield) *DAGViewer {
	dv.wafShield = waf
	return dv
}

// DAGProvider interface allows plugging in different DAG storage backends
type DAGProvider interface {
	GetAllNodes() ([]DAGNode, error)
	GetStats() (DAGStats, error)
	GetNodesByTimeRange(start, end time.Time) ([]DAGNode, error)
}

// NewDAGViewer creates a new DAG visualization server
func NewDAGViewer(port int, provider DAGProvider) *DAGViewer {
	return &DAGViewer{
		port:        port,
		dagProvider: provider,
	}
}

// Start launches the web server
func (dv *DAGViewer) Start() error {
	mux := http.NewServeMux()

	// Serve static files (HTML, CSS, JS)
	staticFS, err := fs.Sub(staticFiles, "static")
	if err != nil {
		return fmt.Errorf("failed to load static files: %w", err)
	}
	mux.Handle("/", http.FileServer(http.FS(staticFS)))

	// API endpoints for real-time data
	mux.HandleFunc("/api/dag/nodes", dv.handleGetNodes)
	mux.HandleFunc("/api/dag/stats", dv.handleGetStats)
	mux.HandleFunc("/api/dag/stream", dv.handleStreamUpdates)

	// Migrated khepra-daemon endpoints (DAG add, weave/unweave, attest, status,
	// compliance graph export, CMMC scan-all) — only if attached via WithAPI().
	if dv.api != nil {
		dv.api.RegisterRoutes(mux)
	}

	// Sovereign auth endpoints — only if attached via WithAuth().
	if dv.authAPI != nil {
		dv.authAPI.RegisterRoutes(mux)
	}

	// asaf-daemon ChangeRequest relay — only if attached via WithRemediate().
	if dv.remediateAPI != nil {
		dv.remediateAPI.RegisterRoutes(mux)
	}

	// Health check
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	// Handler chain (outer to inner): CORS → WAF (if attached) → logging → mux.
	// Matches sekhem.HTTPMiddleware's documented ordering — WAF inspects/scrubs
	// every route this process exposes (DAG, auth, compliance-graph).
	var handler http.Handler = dv.withLogging(mux)
	if dv.wafShield != nil {
		handler = sekhem.HTTPMiddleware(dv.wafShield)(handler)
	}
	handler = dv.withCORS(handler)

	dv.server = &http.Server{
		Addr:         fmt.Sprintf(":%d", dv.port),
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	log.Printf("DAG Viewer starting on http://localhost:%d/", dv.port)
	log.Printf("Access the Trust Constellation at: http://localhost:%d/", dv.port)

	return dv.server.ListenAndServe()
}

// Stop gracefully shuts down the server
func (dv *DAGViewer) Stop() error {
	if dv.server != nil {
		return dv.server.Close()
	}
	return nil
}

// handleGetNodes returns all DAG nodes as JSON
func (dv *DAGViewer) handleGetNodes(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	nodes, err := dv.dagProvider.GetAllNodes()
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to fetch nodes: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(nodes)
}

// handleGetStats returns real-time DAG statistics
func (dv *DAGViewer) handleGetStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	stats, err := dv.dagProvider.GetStats()
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to fetch stats: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// handleStreamUpdates provides Server-Sent Events (SSE) for real-time updates
func (dv *DAGViewer) handleStreamUpdates(w http.ResponseWriter, r *http.Request) {
	// Set headers for SSE
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	// Send updates every 2 seconds
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			stats, err := dv.dagProvider.GetStats()
			if err != nil {
				continue
			}

			data, _ := json.Marshal(stats)
			fmt.Fprintf(w, "data: %s\n\n", data)
			flusher.Flush()

		case <-r.Context().Done():
			return
		}
	}
}

// withCORS adds CORS headers for local development
func (dv *DAGViewer) withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// In production, restrict to specific origins
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// withLogging adds request logging
func (dv *DAGViewer) withLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("DAG Viewer: %s %s %s", r.Method, r.URL.Path, time.Since(start))
	})
}
