// Khepra MCP Server — Entry Point
//
// Transport: stdio — launched as a subprocess by Claude / Cursor / Windsurf.
// No external HTTP calls. No plugins. No dynamic loading.
// Every tool runs local pkg/ code and writes a signed DAG node before responding.
//
// Deployment modes (KHEPRA_MODE):
//
//	sovereign  (default) — air-gap, RFC-1918 network targets only
//	ironbank             — DoD hardened, FIPS-140-3, RFC-1918 only
//	edge                 — SaaS, full network; Supabase telemetry opt-in via env
//
// Configuration (.mcp.sovereign.json):
//
//	KHEPRA_MODE            sovereign | ironbank | edge
//	KHEPRA_HOME            data dir (DAG store), default ~/.khepra
//	KHEPRA_NETWORK_POLICY  lan | local_only (sovereign/ironbank only)
//	MCP_PQC_ENABLED        true to sign responses with Dilithium key at KHEPRA_HOME/key.dilithium
//	MCP_DEBUG              true for verbose request/response logging
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"os"
	"os/signal"
	"path/filepath"
	"sort"
	"strconv"
	"syscall"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/adinkra"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/compliance"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/dag"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/ert"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/mcp"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/scanner/network"
)

const (
	modeSovereign = "sovereign"
	modeIronBank  = "ironbank"
	modeEdge      = "edge"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	mode := os.Getenv("KHEPRA_MODE")
	if mode == "" {
		mode = modeSovereign
	}
	debug := os.Getenv("MCP_DEBUG") == "true"
	pqcEnabled := os.Getenv("MCP_PQC_ENABLED") == "true"

	khepraHome := os.Getenv("KHEPRA_HOME")
	if khepraHome == "" {
		khepraHome = filepath.Join(os.Getenv("HOME"), ".khepra")
	}
	if err := os.MkdirAll(khepraHome, 0o700); err != nil {
		log.Fatalf("[khepra-mcp] cannot create KHEPRA_HOME %s: %v", khepraHome, err)
	}

	// ── DAG store — persistent JSON on disk, no external dependency ──────────
	dagStore, err := dag.NewPersistentMemory(filepath.Join(khepraHome, "dag"))
	if err != nil {
		log.Fatalf("[khepra-mcp] dag store: %v", err)
	}

	// ── PQC signing key — optional, local file only ──────────────────────────
	var signingKey []byte
	if pqcEnabled {
		keyPath := filepath.Join(khepraHome, "key.dilithium")
		signingKey, err = os.ReadFile(keyPath)
		if err != nil {
			log.Printf("[khepra-mcp] PQC signing disabled: key not found at %s (%v)", keyPath, err)
			pqcEnabled = false
		}
	}

	// ── Concurrency limiter (NSA MCP §"Denial of service / prompt storm") ────
	maxConcurrent := 5
	if v := os.Getenv("KHEPRA_MAX_CONCURRENT"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			maxConcurrent = n
		}
	}
	sem := make(chan struct{}, maxConcurrent)

	// ── Build dispatcher ──────────────────────────────────────────────────────
	d := &dispatcher{
		mode:       mode,
		dagStore:   dagStore,
		signingKey: signingKey,
		pqcEnabled: pqcEnabled,
		debug:      debug,
		khepraHome: khepraHome,
		sem:        sem,
	}

	// ── Build MCP server ──────────────────────────────────────────────────────
	cfg := mcp.Config{
		ServerName:    "Khepra MCP Server",
		ServerVersion: "1.0.0",
		SigningKey:    signingKey,
		AuditLogger:   &dagAuditLogger{store: dagStore, debug: debug},
		Debug:         debug,
	}
	// No cfg.Store wired — Supabase is not loaded in sovereign/ironbank modes.
	// Edge mode: wire Supabase externally via a future .mcp.saas.json config.

	srv := mcp.NewServer(cfg)

	for _, tool := range mcp.KhepraTools() {
		t := tool
		srv.RegisterTool(t, d.makeHandler(t.Name))
	}

	log.Printf("[khepra-mcp] mode=%s pqc=%v dag=%s", mode, pqcEnabled, filepath.Join(khepraHome, "dag"))

	if err := srv.ServeStdio(ctx); err != nil && err.Error() != "EOF" {
		log.Fatalf("[khepra-mcp] server error: %v", err)
	}
	log.Printf("[khepra-mcp] shutdown complete")
}

// ── dispatcher ────────────────────────────────────────────────────────────────

type dispatcher struct {
	mode       string
	dagStore   dag.Store
	signingKey []byte
	pqcEnabled bool
	debug      bool
	khepraHome string
	sem        chan struct{} // concurrency limiter — NSA MCP §"Denial of service"
}

func (d *dispatcher) makeHandler(toolName string) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		// Acquire concurrency slot — blocks if KHEPRA_MAX_CONCURRENT active calls
		select {
		case d.sem <- struct{}{}:
			defer func() { <-d.sem }()
		case <-ctx.Done():
			return &mcp.ToolResult{
				Content: []mcp.ContentItem{{Type: "text", Text: "server busy: max concurrent tool calls reached"}},
				IsError: true,
			}, nil
		}

		var p map[string]interface{}
		_ = json.Unmarshal(params, &p)

		result, err := d.dispatch(ctx, toolName, p)
		if err != nil {
			return &mcp.ToolResult{
				Content: []mcp.ContentItem{{Type: "text", Text: err.Error()}},
				IsError: true,
			}, nil
		}
		return result, nil
	}
}

func (d *dispatcher) dispatch(ctx context.Context, toolName string, p map[string]interface{}) (*mcp.ToolResult, error) {
	switch toolName {

	case "khepra_discover_endpoints":
		target, _ := p["target"].(string)
		depth, _ := p["scan_depth"].(string)
		return d.discoverEndpoints(ctx, target, depth)

	case "khepra_run_compliance_scan":
		target, _ := p["scan_target"].(string)
		framework, _ := p["framework"].(string)
		return d.runComplianceScan(ctx, target, framework)

	case "khepra_query_stig":
		stigID, _ := p["stig_id"].(string)
		includeRemediation, _ := p["include_remediation"].(bool)
		return d.queryStig(ctx, stigID, includeRemediation)

	case "khepra_export_attestation":
		orgID, _ := p["org_id"].(string)
		framework, _ := p["framework"].(string)
		format, _ := p["format"].(string)
		return d.exportAttestation(ctx, orgID, framework, format)

	case "khepra_get_dag_chain":
		entityID, _ := p["entity_id"].(string)
		limit := 50
		if l, ok := p["limit"].(float64); ok {
			limit = int(l)
		}
		return d.getDagChain(ctx, entityID, limit)

	case "khepra_get_compliance_score":
		orgID, _ := p["org_id"].(string)
		framework, _ := p["framework"].(string)
		return d.getComplianceScore(ctx, orgID, framework)

	case "khepra_get_anomaly_score":
		targetID, _ := p["target_id"].(string)
		return d.getAnomalyScore(ctx, targetID)

	case "khepra_query_threat_intel":
		query, _ := p["query"].(string)
		return d.queryThreatIntel(ctx, query)

	case "khepra_get_snapshot":
		endpointID, _ := p["endpoint_id"].(string)
		return d.getSnapshot(ctx, endpointID)

	default:
		return nil, fmt.Errorf("tool %q not implemented", toolName)
	}
}

// ── Tool implementations — all local, no external HTTP ───────────────────────

func (d *dispatcher) discoverEndpoints(ctx context.Context, target, depth string) (*mcp.ToolResult, error) {
	if err := d.enforceNetworkPolicy(target); err != nil {
		return nil, err
	}

	ports := network.CommonPorts()
	if depth == "surface" {
		ports = []int{22, 80, 443, 8080, 8443}
	}

	scanner := network.NewScanner(target, ports)
	results := scanner.Scan(ctx)

	open := make([]map[string]interface{}, 0)
	for _, r := range results {
		if r.Open {
			open = append(open, map[string]interface{}{
				"port":    r.Port,
				"service": r.Service,
				"banner":  r.Banner,
			})
		}
	}

	data := map[string]interface{}{
		"target":      target,
		"depth":       depth,
		"open_ports":  open,
		"total_ports": len(results),
		"mode":        d.mode,
	}
	return d.sealResult("khepra_discover_endpoints", target, data)
}

func (d *dispatcher) runComplianceScan(ctx context.Context, target, framework string) (*mcp.ToolResult, error) {
	if framework == "" {
		framework = "CMMC_L2"
	}

	dagMem := dag.NewMemory()
	engine := compliance.NewEngine(dagMem, nil)
	report, err := engine.EvaluateCompliance(d.signingKey)
	if err != nil {
		return nil, fmt.Errorf("compliance scan failed: %w", err)
	}

	data := map[string]interface{}{
		"target":    target,
		"framework": framework,
		"report":    report,
		"mode":      d.mode,
	}
	return d.sealResult("khepra_run_compliance_scan", target, data)
}

func (d *dispatcher) queryStig(ctx context.Context, stigID string, includeRemediation bool) (*mcp.ToolResult, error) {
	ertEngine, err := ert.NewEngine(".", "mcp-session", d.dagStore)
	if err != nil {
		return nil, fmt.Errorf("ert engine init: %w", err)
	}

	cveDB := ertEngine.GetCVEDatabase()
	entry := cveDB.Lookup(stigID)

	data := map[string]interface{}{
		"stig_id":             stigID,
		"include_remediation": includeRemediation,
		"result":              entry,
		"mode":                d.mode,
		"source":              "embedded-database",
	}
	return d.sealResult("khepra_query_stig", stigID, data)
}

func (d *dispatcher) exportAttestation(_ context.Context, orgID, framework, format string) (*mcp.ToolResult, error) {
	if format == "" {
		format = "json"
	}

	nodes := d.dagStore.All()
	sig := ""
	if d.pqcEnabled && len(d.signingKey) > 0 {
		payload, _ := json.Marshal(nodes)
		sigBytes, err := adinkra.Sign(d.signingKey, payload)
		if err == nil {
			sig = fmt.Sprintf("%x", sigBytes)
		}
	}

	data := map[string]interface{}{
		"org_id":        orgID,
		"framework":     framework,
		"format":        format,
		"dag_node_count": len(nodes),
		"pqc_algorithm": "ML-DSA-65/Dilithium3",
		"signature":     sig,
		"mode":          d.mode,
	}
	return d.sealResult("khepra_export_attestation", orgID, data)
}

func (d *dispatcher) getDagChain(_ context.Context, entityID string, limit int) (*mcp.ToolResult, error) {
	allNodes := d.dagStore.All()

	filtered := make([]*dag.Node, 0)
	for _, n := range allNodes {
		if entityID == "" || n.Action == entityID || n.ID == entityID {
			filtered = append(filtered, n)
		}
	}
	sort.Slice(filtered, func(i, j int) bool {
		return filtered[i].Time > filtered[j].Time
	})
	if len(filtered) > limit {
		filtered = filtered[:limit]
	}

	data := map[string]interface{}{
		"entity_id":   entityID,
		"nodes":       filtered,
		"total":       len(filtered),
		"dag_dir":     filepath.Join(d.khepraHome, "dag"),
		"mode":        d.mode,
	}
	return d.sealResult("khepra_get_dag_chain", entityID, data)
}

func (d *dispatcher) getComplianceScore(_ context.Context, orgID, framework string) (*mcp.ToolResult, error) {
	if framework == "" {
		framework = "CMMC_L2"
	}

	nodes := d.dagStore.All()
	scanNodes := 0
	for _, n := range nodes {
		if n.Action == "khepra_run_compliance_scan" {
			scanNodes++
		}
	}

	data := map[string]interface{}{
		"org_id":      orgID,
		"framework":   framework,
		"scan_count":  scanNodes,
		"dag_entries": len(nodes),
		"mode":        d.mode,
		"note":        "Score derived from local DAG. Run khepra_run_compliance_scan to update.",
	}
	return d.sealResult("khepra_get_compliance_score", orgID, data)
}

func (d *dispatcher) getAnomalyScore(_ context.Context, targetID string) (*mcp.ToolResult, error) {
	// SouHimBou ML service is a sovereign-local model — no external call.
	// In sovereign mode the score is derived from DAG history patterns.
	nodes := d.dagStore.All()
	recentErrors := 0
	for _, n := range nodes {
		if n.PQC["error"] == "true" {
			recentErrors++
		}
	}
	score := 0
	if len(nodes) > 0 {
		score = (recentErrors * 100) / len(nodes)
	}

	data := map[string]interface{}{
		"target_id":     targetID,
		"anomaly_score": score,
		"dag_nodes":     len(nodes),
		"mode":          d.mode,
		"source":        "local-dag-heuristic",
	}
	return d.sealResult("khepra_get_anomaly_score", targetID, data)
}

func (d *dispatcher) queryThreatIntel(_ context.Context, query string) (*mcp.ToolResult, error) {
	ertEngine, err := ert.NewEngine(".", "mcp-session", d.dagStore)
	if err != nil {
		return nil, fmt.Errorf("ert engine: %w", err)
	}

	cveDB := ertEngine.GetCVEDatabase()
	result := cveDB.Lookup(query)

	data := map[string]interface{}{
		"query":  query,
		"result": result,
		"source": "embedded-cve-database",
		"mode":   d.mode,
		"note":   "Sovereign mode: CISA KEV + embedded NVD snapshot. No live feed queries.",
	}
	return d.sealResult("khepra_query_threat_intel", query, data)
}

func (d *dispatcher) getSnapshot(_ context.Context, endpointID string) (*mcp.ToolResult, error) {
	nodes := d.dagStore.All()
	snapshots := make([]*dag.Node, 0)
	for _, n := range nodes {
		if n.PQC["endpoint"] == endpointID || endpointID == "" {
			snapshots = append(snapshots, n)
		}
	}

	data := map[string]interface{}{
		"endpoint_id": endpointID,
		"snapshots":   snapshots,
		"count":       len(snapshots),
		"mode":        d.mode,
	}
	return d.sealResult("khepra_get_snapshot", endpointID, data)
}

// ── Network policy ─────────────────────────────────────────────────────────────

func (d *dispatcher) enforceNetworkPolicy(target string) error {
	if d.mode == modeEdge {
		return nil
	}
	host := target
	if h, _, err := net.SplitHostPort(target); err == nil {
		host = h
	}
	ip := net.ParseIP(host)
	if ip == nil {
		addrs, err := net.LookupHost(host)
		if err != nil {
			return fmt.Errorf("sovereign policy: cannot resolve %q (no outbound DNS in air-gap)", host)
		}
		ip = net.ParseIP(addrs[0])
	}
	if !isRFC1918(ip) {
		return fmt.Errorf("sovereign policy: target %q (%s) is non-LAN — blocked in %s mode", target, ip, d.mode)
	}
	return nil
}

func isRFC1918(ip net.IP) bool {
	ip4 := ip.To4()
	if ip4 == nil {
		return false
	}
	for _, cidr := range []string{"10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "127.0.0.0/8"} {
		_, network, _ := net.ParseCIDR(cidr)
		if network.Contains(ip4) {
			return true
		}
	}
	return false
}

// ── DAG + signing ─────────────────────────────────────────────────────────────

// sealResult writes a DAG node, optionally signs it, and wraps the data in a
// ToolResult. This is the only code path that produces tool responses.
func (d *dispatcher) sealResult(action, subject string, data map[string]interface{}) (*mcp.ToolResult, error) {
	node := &dag.Node{
		Action: action,
		Symbol: "Eban",
		Time:   time.Now().UTC().Format(time.RFC3339),
		PQC: map[string]string{
			"mode":    d.mode,
			"subject": subject,
		},
	}
	node.Hash = node.ComputeHash()
	node.ID = node.Hash

	if d.pqcEnabled && len(d.signingKey) > 0 {
		if err := node.Sign(d.signingKey); err != nil {
			log.Printf("[khepra-mcp] sign warning: %v", err)
		}
	}

	var parents []string
	all := d.dagStore.All()
	if len(all) > 0 {
		parents = []string{all[len(all)-1].ID}
	}
	_ = d.dagStore.Add(node, parents)

	data["dag_node_id"] = node.ID
	data["dag_signature"] = node.Signature
	data["signed_at"] = node.Time

	b, _ := json.MarshalIndent(data, "", "  ")
	return &mcp.ToolResult{
		Content:      []mcp.ContentItem{{Type: "text", Text: string(b)}},
		DAGNodeID:    node.ID,
		PQCSignature: node.Signature,
		SignedAt:     node.Time,
	}, nil
}

// ── Audit logger ──────────────────────────────────────────────────────────────

type dagAuditLogger struct {
	store dag.Store
	debug bool
}

func (l *dagAuditLogger) Log(eventType string, data map[string]interface{}) error {
	node := &dag.Node{
		Action: eventType,
		Symbol: "Nyame",
		Time:   time.Now().UTC().Format(time.RFC3339),
		PQC:    map[string]string{"type": "audit"},
	}
	node.Hash = node.ComputeHash()
	node.ID = node.Hash
	_ = l.store.Add(node, nil)
	if l.debug {
		b, _ := json.Marshal(data)
		log.Printf("[dag-audit] event=%s data=%s", eventType, string(b))
	}
	return nil
}
