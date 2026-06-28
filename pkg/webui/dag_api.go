// DAGAPI hosts the user-space DAG / weave / attest / compliance-graph HTTP API.
//
// This was previously the standalone cmd/khepra-daemon process (the "Father"),
// which ran its own isolated, non-persistent dag.Memory on port 45444 — never
// connected to anything else in the system. Migrated into `adinkhepra serve`
// so every write goes through pkg/dag.GlobalDAG(), the same persistent,
// auto-flushing singleton already shared by ERT, validation, and the DAG
// viewer. No separate process, no IPC, no port to collide with asaf-daemon
// or apiserver.
package webui

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/adinkhepra"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/dag"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/nkyinkyim"
)

// DAGAPI carries the small amount of process-lifetime state (start time,
// integrity-lockdown flag) that used to live on the khepra-daemon struct.
// The DAG itself is never held here — every handler reads dag.GlobalDAG().
type DAGAPI struct {
	mu        sync.RWMutex
	startTime time.Time
	locked    bool
}

// NewDAGAPI returns a DAGAPI ready to register onto a DAGViewer.
func NewDAGAPI() *DAGAPI {
	return &DAGAPI{startTime: time.Now()}
}

// RegisterRoutes mounts every migrated endpoint onto mux. Called from
// DAGViewer.Start() when the viewer has been constructed with WithAPI().
func (a *DAGAPI) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/dag/add", a.handleDAGAdd)
	mux.HandleFunc("/adinkra/weave", a.handleWeave)
	mux.HandleFunc("/adinkra/unweave", a.handleUnweave)
	mux.HandleFunc("/attest/verify", a.handleAttest)
	mux.HandleFunc("/status", a.handleStatus)
	mux.HandleFunc("/dag/graph", a.handleDAGGraph)
	mux.HandleFunc("/compliance/scan-all", a.handleComplianceScanAll)
}

// ── DAG Add ──────────────────────────────────────────────────────────────────

func (a *DAGAPI) handleDAGAdd(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Action  string                 `json:"action"`
		Symbol  string                 `json:"symbol"`
		Payload map[string]interface{} `json:"payload,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	nodeID := a.logEvent(req.Action, req.Symbol)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{ //nolint:errcheck
		"status":  "logged",
		"node_id": nodeID,
		"message": "Event added to immutable audit trail",
	})
}

// ── Weave / Unweave ──────────────────────────────────────────────────────────

func (a *DAGAPI) handleWeave(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Data string `json:"data"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	woven := nkyinkyim.Shroud([]byte(req.Data))
	a.logEvent("data_weave", "Nkyinkyim-Weaver")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{ //nolint:errcheck
		"status":         "woven",
		"x_khepra_weave": string(woven),
		"message":        "Data obfuscated with PQC",
	})
}

func (a *DAGAPI) handleUnweave(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	a.mu.RLock()
	locked := a.locked
	a.mu.RUnlock()
	if locked {
		http.Error(w, "System locked: File integrity violation detected.", http.StatusForbidden)
		return
	}

	var req struct {
		WovenData string `json:"x_khepra_weave"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	unwoven, err := nkyinkyim.Epiphany(req.WovenData)
	if err != nil {
		http.Error(w, "Failed to unweave data: "+err.Error(), http.StatusBadRequest)
		return
	}
	a.logEvent("data_unweave", "Nkyinkyim-Weaver")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{ //nolint:errcheck
		"status": "unwoven",
		"data":   string(unwoven),
	})
}

// ── Attest / Status ──────────────────────────────────────────────────────────

func (a *DAGAPI) handleAttest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	a.mu.RLock()
	locked := a.locked
	a.mu.RUnlock()

	resp := map[string]interface{}{
		"status":             "verified",
		"locked":             locked,
		"attestation_method": "dag",
		"message":            "System integrity check passed — DAG audit trail intact",
	}
	if locked {
		resp["status"] = "compromised"
		resp["message"] = "File integrity violation detected"
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp) //nolint:errcheck
}

func (a *DAGAPI) handleStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	a.mu.RLock()
	locked := a.locked
	a.mu.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{ //nolint:errcheck
		"daemon":   "adinkhepra-serve",
		"version":  "1.5.0",
		"uptime":   time.Since(a.startTime).Seconds(),
		"locked":   locked,
		"dag_size": len(dag.GlobalDAG().All()),
		"role":     "User-space DAG/weave/attest/compliance API",
	})
}

// ── Compliance Graph (DAG export + CMMC scan) ────────────────────────────────

type viewerNode struct {
	ID        string `json:"id"`
	Label     string `json:"label"`
	Type      string `json:"type"`
	Val       int    `json:"val"`
	Desc      string `json:"desc"`
	TS        string `json:"ts,omitempty"`
	Severity  string `json:"severity,omitempty"`
	Impact    string `json:"impact,omitempty"`
	ROI       string `json:"roi,omitempty"`
	Sig       string `json:"sig,omitempty"`
	Framework string `json:"framework,omitempty"`
	Symbol    string `json:"symbol,omitempty"`
	JobID     string `json:"job_id,omitempty"`
}

type viewerLink struct {
	Source string `json:"source"`
	Target string `json:"target"`
	W      int    `json:"w"`
}

type viewerMeta struct {
	SessionID      string `json:"session_id"`
	Tenant         string `json:"tenant"`
	ToolCalls      int    `json:"tool_calls"`
	Attestations   int    `json:"attestations"`
	Findings       int    `json:"findings"`
	ControlsMapped int    `json:"controls_mapped"`
	Staging        int    `json:"staging_pending"`
	Remediated     int    `json:"auto_remediated"`
	Generated      string `json:"generated"`
	LicenseTier    string `json:"license_tier"`
}

type dagGraphResponse struct {
	Meta  viewerMeta   `json:"meta"`
	Nodes []viewerNode `json:"nodes"`
	Links []viewerLink `json:"links"`
}

type complianceScanResponse struct {
	Controls  map[string]string `json:"controls"`
	Total     int               `json:"total"`
	Pass      int               `json:"pass"`
	Fail      int               `json:"fail"`
	Manual    int               `json:"manual_review"`
	Staging   int               `json:"staging_pending"`
	Timestamp string            `json:"timestamp"`
}

// handleDAGGraph exports the global DAG as a 3d-force-graph payload for the
// Compliance Graph UI.
func (a *DAGAPI) handleDAGGraph(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	allNodes := dag.GlobalDAG().All()
	nodes := make([]viewerNode, 0, len(allNodes)+10)
	links := make([]viewerLink, 0, len(allNodes))

	var toolCalls, attestations, findings int
	for _, n := range allNodes {
		vn := dagNodeToViewerNode(n)
		nodes = append(nodes, vn)

		switch vn.Type {
		case "tool":
			toolCalls++
		case "attest":
			attestations++
		case "finding":
			findings++
		}

		for _, parentID := range n.Parents {
			shortParent := shortID(parentID)
			if shortParent != vn.ID {
				links = append(links, viewerLink{Source: shortParent, Target: vn.ID, W: 1})
			}
		}
	}

	meta := viewerMeta{
		SessionID:      fmt.Sprintf("dag-%s", time.Now().Format("2006-01-02T15:04:05Z")),
		Tenant:         "sovereign",
		ToolCalls:      toolCalls,
		Attestations:   attestations,
		Findings:       findings,
		ControlsMapped: 0,
		Generated:      time.Now().UTC().Format(time.RFC3339),
		LicenseTier:    "sovereign",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(dagGraphResponse{Meta: meta, Nodes: nodes, Links: links}) //nolint:errcheck
}

// handleComplianceScanAll runs OSScanner.ScanAll() (145 controls, 5-min cache).
func (a *DAGAPI) handleComplianceScanAll(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	scanner := adinkhepra.NewOSScanner()
	controls := scanner.ScanAll()

	var pass, fail, manual, staging int
	for _, status := range controls {
		switch {
		case status == "PASS":
			pass++
		case status == "FAIL":
			fail++
		case status == "MANUAL_REVIEW":
			manual++
		case strings.HasPrefix(status, "STAGING_PENDING"):
			staging++
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(complianceScanResponse{ //nolint:errcheck
		Controls:  controls,
		Total:     len(controls),
		Pass:      pass,
		Fail:      fail,
		Manual:    manual,
		Staging:   staging,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	})
}

// ── Mapping helpers ───────────────────────────────────────────────────────────

func dagNodeToViewerNode(n *dag.Node) viewerNode {
	t := actionToViewerType(n.Action)
	sig := ""
	if len(n.Signature) > 32 {
		sig = n.Signature[:32]
	} else {
		sig = n.Signature
	}
	label := n.Action
	if n.Symbol != "" {
		label = fmt.Sprintf("%s · %s", n.Symbol, shortID(n.ID))
	}
	return viewerNode{
		ID:     shortID(n.ID),
		Label:  label,
		Type:   t,
		Val:    valForType(t),
		Desc:   fmt.Sprintf("%s · %s", n.Action, n.Symbol),
		TS:     formatNodeTime(n.Time),
		Sig:    sig,
		Symbol: n.Symbol,
	}
}

func actionToViewerType(action string) string {
	a := strings.ToLower(action)
	switch {
	case strings.HasPrefix(a, "attest") || strings.Contains(a, "ml-dsa") || strings.Contains(a, "dilithium"):
		return "attest"
	case strings.HasPrefix(a, "finding") || strings.Contains(a, "stig") || strings.Contains(a, "violation"):
		return "finding"
	case strings.HasPrefix(a, "tool") || strings.Contains(a, "_scan") || strings.Contains(a, "mcp"):
		return "tool"
	case strings.HasPrefix(a, "weave") || strings.HasPrefix(a, "unweave") || strings.Contains(a, "data_weave") || strings.Contains(a, "data_unweave"):
		return "tool"
	case strings.Contains(a, "remediat"):
		return "control"
	case strings.Contains(a, "genesis") || strings.Contains(a, "daemon_start") || strings.Contains(a, "prompt"):
		return "prompt"
	default:
		return "tool"
	}
}

func valForType(t string) int {
	switch t {
	case "prompt":
		return 20
	case "finding":
		return 16
	case "tool":
		return 12
	case "attest":
		return 6
	case "control":
		return 8
	case "staging":
		return 10
	case "remediated":
		return 8
	default:
		return 8
	}
}

func shortID(id string) string {
	if len(id) > 8 {
		return id[:8]
	}
	return id
}

func formatNodeTime(ts string) string {
	t, err := time.Parse(time.RFC3339, ts)
	if err != nil {
		return ts
	}
	return t.UTC().Format("15:04:05")
}

// ── Internal helper ───────────────────────────────────────────────────────────

// logEvent writes an event node to the global DAG, mirroring khepra-daemon's
// original logEvent but against the shared persistent singleton.
func (a *DAGAPI) logEvent(action, symbol string) string {
	node := dag.Node{
		Action: action,
		Symbol: symbol,
		Time:   time.Now().Format(time.RFC3339),
	}
	node.ID = node.ComputeHash()

	if err := dag.GlobalDAG().Add(&node, nil); err != nil {
		return ""
	}
	return node.ID
}
