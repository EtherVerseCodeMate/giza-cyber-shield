package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/adinkhepra"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/dag"
)

// ── Viewer Wire Types ─────────────────────────────────────────────────────────
// These match the JSON contract consumed by DAGAuditViewer.tsx and 3d-force-graph.

type viewerNode struct {
	ID        string `json:"id"`
	Label     string `json:"label"`
	Type      string `json:"type"`      // prompt|tool|finding|control|attest|staging|remediated
	Val       int    `json:"val"`       // node sphere size
	Desc      string `json:"desc"`
	TS        string `json:"ts,omitempty"`
	Severity  string `json:"severity,omitempty"`  // CAT_I|CAT_II|CAT_III
	Impact    string `json:"impact,omitempty"`
	ROI       string `json:"roi,omitempty"`
	Sig       string `json:"sig,omitempty"`
	Framework string `json:"framework,omitempty"`
	Symbol    string `json:"symbol,omitempty"`
	JobID     string `json:"job_id,omitempty"` // STAGING_PENDING job uuid
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

// ── /dag/graph ────────────────────────────────────────────────────────────────
// GET /dag/graph — exports the in-memory DAG as a 3d-force-graph payload.
// Includes CMMC control nodes synthesized from OSScanner.ScanAll() so the
// frontend can render tool executions, attestations, findings, and compliance
// control states in a single unified graph.
func (d *KhepraDaemon) handleDAGGraph(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	corsHeaders(w)

	allNodes := d.dag.All()

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

		// Add parent links.
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

	resp := dagGraphResponse{Meta: meta, Nodes: nodes, Links: links}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp) //nolint:errcheck
}

// ── /compliance/scan-all ─────────────────────────────────────────────────────
// GET /compliance/scan-all — runs OSScanner.ScanAll() (145 controls, 5-min cache)
// and returns controlID → status map with aggregate counts.
// First call warms both 800-171 and 800-172 caches (~2–5s on Linux, faster on cache hit).
func (d *KhepraDaemon) handleComplianceScanAll(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	corsHeaders(w)

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

	resp := complianceScanResponse{
		Controls:  controls,
		Total:     len(controls),
		Pass:      pass,
		Fail:      fail,
		Manual:    manual,
		Staging:   staging,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp) //nolint:errcheck
}

// ── Mapping Helpers ──────────────────────────────────────────────────────────

func dagNodeToViewerNode(n *dag.Node) viewerNode {
	t := actionToViewerType(n.Action)
	label := labelForNode(n)
	sig := ""
	if n.Signature != "" && len(n.Signature) > 16 {
		sig = n.Signature[:32]
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

// actionToViewerType maps a DAG node Action string to a viewer node type.
func actionToViewerType(action string) string {
	a := strings.ToLower(action)
	switch {
	case strings.HasPrefix(a, "attest") || strings.Contains(a, "ml-dsa") || strings.Contains(a, "dilithium"):
		return "attest"
	case strings.HasPrefix(a, "finding") || strings.Contains(a, "stig") || strings.Contains(a, "violation"):
		return "finding"
	case strings.HasPrefix(a, "tool") || strings.Contains(a, "_scan") || strings.Contains(a, "mcp"):
		return "tool"
	case strings.HasPrefix(a, "weave") || strings.HasPrefix(a, "unweave"):
		return "tool"
	case strings.Contains(a, "remediat"):
		return "control"
	case strings.Contains(a, "daemon_start") || strings.Contains(a, "prompt"):
		return "prompt"
	default:
		return "tool"
	}
}

func labelForNode(n *dag.Node) string {
	if n.Symbol != "" {
		return fmt.Sprintf("%s · %s", n.Symbol, shortID(n.ID))
	}
	if len(n.Action) > 24 {
		return n.Action[:24]
	}
	return n.Action
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

// shortID returns the first 8 hex characters of a hash ID for display.
func shortID(id string) string {
	if len(id) > 8 {
		return id[:8]
	}
	return id
}

// formatNodeTime converts an RFC3339 time string to HH:MM:SS for the viewer.
func formatNodeTime(ts string) string {
	t, err := time.Parse(time.RFC3339, ts)
	if err != nil {
		return ts
	}
	return t.UTC().Format("15:04:05")
}

// corsHeaders sets permissive CORS headers for local dev dashboard calls.
func corsHeaders(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
}
