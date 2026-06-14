//go:build e2e
// +build e2e

// cmd/khepra-mcp/e2e_test.go — End-to-end test for khepra-mcp binary.
//
// Tests ONLY the fast-path MCP tools (sub-second handlers).
// Tools that walk the filesystem (stig_check, cmmc_assess, ert_*) live in
// slow_integration_test.go and run under a separate 5-minute timeout.
//
// Run:
//
//	go test -v -tags e2e -timeout 30s ./cmd/khepra-mcp/ -run TestE2E_Fast
package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"
)

// ---------- wire types -------------------------------------------------------

type rpcMsg struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      *int            `json:"id,omitempty"`
	Method  string          `json:"method,omitempty"`
	Params  any             `json:"params,omitempty"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

func iptr(n int) *int { return &n }

func call(msgID int, name string, args map[string]any) rpcMsg {
	return rpcMsg{
		JSONRPC: "2.0",
		ID:      iptr(msgID),
		Method:  "tools/call",
		Params:  map[string]any{"name": name, "arguments": args},
	}
}

func msh(v any) string { b, _ := json.Marshal(v); return string(b) }

// ---------- server runner ----------------------------------------------------

func startServer(t *testing.T, deadline time.Duration) (send func(rpcMsg), recv func() *rpcMsg, stop func()) {
	t.Helper()

	_, thisFile, _, _ := runtime.Caller(0)
	projectRoot, _ := filepath.Abs(filepath.Join(filepath.Dir(thisFile), "..", ".."))
	binary := filepath.Join(projectRoot, "khepra-mcp.exe")
	if _, err := os.Stat(binary); err != nil {
		t.Fatalf("binary not found: %s — run: go build -o khepra-mcp.exe ./cmd/khepra-mcp/", binary)
	}

	cmd := exec.Command(binary)
	cmd.Dir = projectRoot
	cmd.Env = append(os.Environ(),
		"KHEPRA_DATA_DIR="+t.TempDir(),
		"GOTOOLCHAIN=local",
		"GOROOT=C:\\Program Files\\Go",
	)

	stdinPipe, err := cmd.StdinPipe()
	if err != nil {
		t.Fatalf("stdin: %v", err)
	}
	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		t.Fatalf("stdout: %v", err)
	}
	if err := cmd.Start(); err != nil {
		t.Fatalf("start: %v", err)
	}

	lines := make(chan *rpcMsg, 64)
	go func() {
		sc := bufio.NewScanner(stdoutPipe)
		sc.Buffer(make([]byte, 4<<20), 4<<20)
		for sc.Scan() {
			line := strings.TrimSpace(sc.Text())
			if line == "" {
				continue
			}
			var msg rpcMsg
			if json.Unmarshal([]byte(line), &msg) == nil {
				cp := msg
				lines <- &cp
			}
		}
		close(lines)
	}()

	// send writes one JSON-RPC message
	send = func(msg rpcMsg) {
		io.WriteString(stdinPipe, msh(msg)+"\n")
	}

	// recv blocks until the next response arrives or deadline
	recv = func() *rpcMsg {
		select {
		case msg := <-lines:
			return msg
		case <-time.After(deadline):
			return nil
		}
	}

	stop = func() {
		stdinPipe.Close()
		cmd.Wait()
	}

	return send, recv, stop
}

// sendAndRecv sends one request and waits for the response with the matching ID.
func sendAndRecv(send func(rpcMsg), recv func() *rpcMsg, msg rpcMsg, timeout time.Duration) *rpcMsg {
	send(msg)
	deadline := time.After(timeout)
	for {
		select {
		case <-deadline:
			return nil
		default:
		}
		r := recv()
		if r == nil {
			return nil
		}
		if msg.ID != nil && r.ID != nil && *r.ID == *msg.ID {
			return r
		}
	}
}

// ---------- result parser ----------------------------------------------------

func toolResult(r *rpcMsg) (map[string]any, error) {
	if r == nil {
		return nil, fmt.Errorf("nil response")
	}
	if r.Error != nil {
		return nil, fmt.Errorf("RPC %d: %s", r.Error.Code, r.Error.Message)
	}
	// Try tools/call envelope
	var env struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
		IsError bool `json:"isError"`
	}
	if json.Unmarshal(r.Result, &env) == nil {
		if env.IsError {
			for _, c := range env.Content {
				if c.Type == "text" {
					return nil, fmt.Errorf("tool error: %s", c.Text)
				}
			}
			return nil, fmt.Errorf("tool returned isError=true")
		}
		for _, c := range env.Content {
			if c.Type == "text" && c.Text != "" {
				var inner map[string]any
				if json.Unmarshal([]byte(c.Text), &inner) == nil {
					return inner, nil
				}
			}
		}
	}
	// Bare result (initialize, tools/list)
	var bare map[string]any
	if err := json.Unmarshal(r.Result, &bare); err != nil {
		return nil, err
	}
	return bare, nil
}

// ---------- E2E fast-path test -----------------------------------------------

// TestE2E_Fast exercises all fast-path MCP tools (no filesystem scanners).
// Completes in < 20 seconds.
func TestE2E_Fast(t *testing.T) {
	const perCall = 8 * time.Second

	send, recv, stop := startServer(t, perCall)
	defer stop()

	// ── 1. initialize ────────────────────────────────────────────────────────
	t.Run("initialize", func(t *testing.T) {
		r := sendAndRecv(send, recv, rpcMsg{
			JSONRPC: "2.0", ID: iptr(1), Method: "initialize",
			Params: map[string]any{
				"protocolVersion": "2024-11-05",
				"capabilities":    map[string]any{},
				"clientInfo":      map[string]any{"name": "e2e", "version": "1.0"},
			},
		}, perCall)
		if r == nil {
			t.Fatal("no response to initialize")
		}
		res, err := toolResult(r)
		if err != nil {
			t.Fatalf("result: %v", err)
		}
		if got := res["protocolVersion"]; got != "2024-11-05" {
			t.Errorf("protocolVersion=%v want 2024-11-05", got)
		}
		t.Logf("protocolVersion=%v", res["protocolVersion"])
	})

	// initialized notification (no response expected)
	send(rpcMsg{JSONRPC: "2.0", Method: "notifications/initialized"})

	// ── 3. tools/list ────────────────────────────────────────────────────────
	t.Run("tools_list", func(t *testing.T) {
		r := sendAndRecv(send, recv, rpcMsg{
			JSONRPC: "2.0", ID: iptr(3), Method: "tools/list", Params: map[string]any{},
		}, perCall)
		if r == nil {
			t.Fatal("no response to tools/list")
		}
		var list struct {
			Tools []struct{ Name string `json:"name"` } `json:"tools"`
		}
		if err := json.Unmarshal(r.Result, &list); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		t.Logf("registered tools: %d", len(list.Tools))
		if len(list.Tools) < 29 {
			t.Errorf("got %d tools, want >= 29", len(list.Tools))
		}
		need := []string{
			"discover_assets", "agent_record", "flight_export",
			"khepra_export_attestation", "khepra_export_poam",
			"khepra_query_stig", "khepra_get_compliance_score",
			"khepra_get_dag_chain", "nist_map", "dag_attestation",
		}
		have := map[string]bool{}
		for _, tool := range list.Tools {
			have[tool.Name] = true
		}
		for _, name := range need {
			if !have[name] {
				t.Errorf("missing required tool: %s", name)
			}
		}
	})

	// ── 4. nist_map ──────────────────────────────────────────────────────────
	t.Run("nist_map", func(t *testing.T) {
		r := sendAndRecv(send, recv,
			call(4, "nist_map", map[string]any{"query": "post-quantum cryptography", "top_k": 3}),
			perCall)
		res, err := toolResult(r)
		if err != nil {
			t.Fatalf("nist_map: %v", err)
		}
		t.Logf("nist_map results=%v", res)
	})

	// ── 5. khepra_query_stig ─────────────────────────────────────────────────
	t.Run("khepra_query_stig", func(t *testing.T) {
		r := sendAndRecv(send, recv,
			call(5, "khepra_query_stig", map[string]any{"control_id": "CCI-000001"}),
			perCall)
		res, err := toolResult(r)
		if err != nil {
			t.Fatalf("khepra_query_stig: %v", err)
		}
		t.Logf("result=%v", res)
	})

	// ── 6. khepra_get_compliance_score ───────────────────────────────────────
	t.Run("khepra_get_compliance_score", func(t *testing.T) {
		r := sendAndRecv(send, recv,
			call(6, "khepra_get_compliance_score", map[string]any{"framework": "CMMC"}),
			perCall)
		res, err := toolResult(r)
		if err != nil {
			t.Fatalf("khepra_get_compliance_score: %v", err)
		}
		_, ok1 := res["composite_score"]
		_, ok2 := res["score"]
		if !ok1 && !ok2 {
			t.Errorf("missing score field: %v", res)
		}
		t.Logf("score=%v", res)
	})

	// ── 7. agent_record ──────────────────────────────────────────────────────
	t.Run("agent_record", func(t *testing.T) {
		r := sendAndRecv(send, recv,
			call(7, "agent_record", map[string]any{
				"action":    "e2e_test_run",
				"agent_id":  "khepra-e2e",
				"tool_name": "e2e_test.go",
			}),
			perCall)
		res, err := toolResult(r)
		if err != nil {
			t.Fatalf("agent_record: %v", err)
		}
		if recorded, _ := res["recorded"].(bool); !recorded {
			t.Errorf("recorded=false want true")
		}
		if id, _ := res["record_id"].(string); id == "" {
			t.Errorf("missing record_id")
		}
		t.Logf("record_id=%v mode=%v", res["record_id"], res["mode"])
	})

	// ── 8. flight_export ─────────────────────────────────────────────────────
	t.Run("flight_export", func(t *testing.T) {
		r := sendAndRecv(send, recv,
			call(8, "flight_export", map[string]any{}),
			perCall)
		res, err := toolResult(r)
		if err != nil {
			t.Fatalf("flight_export: %v", err)
		}
		_, hasPilot := res["pilot_kpis"]
		_, hasTotal := res["total_actions"]
		if !hasPilot && !hasTotal {
			t.Errorf("flight_export missing pilot_kpis/total_actions: %v", res)
		}
		t.Logf("chain_intact=%v total_actions=%v", res["chain_intact"], res["total_actions"])
	})

	// ── 9. khepra_export_attestation ─────────────────────────────────────────
	t.Run("khepra_export_attestation", func(t *testing.T) {
		r := sendAndRecv(send, recv,
			call(9, "khepra_export_attestation", map[string]any{
				"engagement_id": "E2E-001", "include_dag": true,
			}),
			perCall)
		res, err := toolResult(r)
		if err != nil {
			t.Fatalf("khepra_export_attestation: %v", err)
		}
		if id, _ := res["dag_node_id"].(string); id == "" {
			t.Errorf("missing dag_node_id")
		}
		if alg, _ := res["signature_algorithm"].(string); alg != "ML-DSA-65" {
			t.Errorf("signature_algorithm=%q want ML-DSA-65", alg)
		}
		t.Logf("dag_node_id=%v sig_alg=%v", res["dag_node_id"], res["signature_algorithm"])
	})

	// ── 10. khepra_export_poam ───────────────────────────────────────────────
	t.Run("khepra_export_poam", func(t *testing.T) {
		r := sendAndRecv(send, recv,
			call(10, "khepra_export_poam", map[string]any{"format": "json", "framework": "CMMC"}),
			perCall)
		_, err := toolResult(r)
		if err != nil {
			t.Fatalf("khepra_export_poam: %v", err)
		}
		t.Log("OK")
	})

	// ── 11. dag_attestation ──────────────────────────────────────────────────
	t.Run("dag_attestation", func(t *testing.T) {
		r := sendAndRecv(send, recv,
			call(11, "dag_attestation", map[string]any{}),
			perCall)
		_, err := toolResult(r)
		if err != nil {
			t.Fatalf("dag_attestation: %v", err)
		}
		t.Log("OK")
	})

	// ── 12. khepra_get_dag_chain ─────────────────────────────────────────────
	t.Run("khepra_get_dag_chain", func(t *testing.T) {
		r := sendAndRecv(send, recv,
			call(12, "khepra_get_dag_chain", map[string]any{}),
			perCall)
		res, err := toolResult(r)
		if err != nil {
			t.Fatalf("khepra_get_dag_chain: %v", err)
		}
		if _, ok := res["integrity"]; !ok {
			t.Errorf("missing integrity field: %v", res)
		}
		t.Logf("integrity=%v node_count=%v", res["integrity"], res["node_count"])
	})

	// ── 13. nhi_inventory ────────────────────────────────────────────────────
	t.Run("nhi_inventory", func(t *testing.T) {
		r := sendAndRecv(send, recv,
			call(13, "nhi_inventory", map[string]any{}),
			perCall)
		_, err := toolResult(r)
		if err != nil {
			t.Fatalf("nhi_inventory: %v", err)
		}
		t.Log("OK")
	})

	// ── 14. acp_status ───────────────────────────────────────────────────────
	t.Run("acp_status", func(t *testing.T) {
		r := sendAndRecv(send, recv,
			call(14, "acp_status", map[string]any{}),
			perCall)
		_, err := toolResult(r)
		if err != nil {
			t.Fatalf("acp_status: %v", err)
		}
		t.Log("OK")
	})

	// ── 15. khepra_query_threat_intel ────────────────────────────────────────
	t.Run("khepra_query_threat_intel", func(t *testing.T) {
		r := sendAndRecv(send, recv,
			call(15, "khepra_query_threat_intel", map[string]any{"query": "remote code execution"}),
			perCall)
		_, err := toolResult(r)
		if err != nil {
			t.Fatalf("khepra_query_threat_intel: %v", err)
		}
		t.Log("OK")
	})
}
