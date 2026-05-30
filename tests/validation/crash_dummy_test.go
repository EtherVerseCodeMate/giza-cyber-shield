// tests/validation/crash_dummy_test.go — Task 11: Crash Dummy Validation
//
// This file validates the ERT pipeline against synthetic "crash dummy" project
// fixtures that model known vulnerability patterns. Each sub-test:
//
//   1. Creates a minimal project fixture on disk
//   2. Runs the relevant ERT MCP tool handler against it
//   3. Asserts that expected findings / scores are present
//
// Fixture design follows the "known-bad, known-good" pattern:
//   - fixtures/fail/   → synthetic projects expected to generate findings
//   - fixtures/pass/   → synthetic projects expected to be clean
//
// Run with: go test ./tests/validation/... -v -timeout 5m
//
// Note: ert_architect requires syft+grype in PATH for full SBOM coverage.
// When tools are absent, the test validates the fallback mode is non-fatal.

package validation_test

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/mcp"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/mcp/tools"
)

// ─────────────────────────────────────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────────────────────────────────────

// makeCall creates a minimal MCPToolCall for handler invocation.
func makeCall(toolName, projectPath string) mcp.MCPToolCall {
	return mcp.MCPToolCall{
		ToolName: toolName,
		Args:     map[string]any{"project_path": projectPath},
		Identity: mcp.Identity{
			AgentID:   "crash-dummy-test",
			SessionID: "test-session-" + time.Now().Format("150405"),
		},
	}
}

// writeFixture writes content to a file inside a temp dir, returning the dir path.
func writeFixture(t *testing.T, files map[string]string) string {
	t.Helper()
	dir := t.TempDir()
	for name, content := range files {
		path := filepath.Join(dir, name)
		if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
			t.Fatalf("MkdirAll %s: %v", path, err)
		}
		if err := os.WriteFile(path, []byte(content), 0644); err != nil {
			t.Fatalf("WriteFile %s: %v", path, err)
		}
	}
	return dir
}

// asJSON marshals v to pretty JSON, panics on error (test helper only).
func asJSON(v any) string {
	b, _ := json.MarshalIndent(v, "", "  ")
	return string(b)
}

// ─────────────────────────────────────────────────────────────────────────────
// Package A — ert_readiness (NIST 800-171 + compliance scoring)
// ─────────────────────────────────────────────────────────────────────────────

// TestERTReadiness_CleanProject verifies a minimal clean project produces a
// non-zero alignment score and a non-fatal response.
func TestERTReadiness_CleanProject(t *testing.T) {
	dir := writeFixture(t, map[string]string{
		"main.go": `package main

import (
	"crypto/tls"
	"fmt"
)

func main() {
	_ = tls.Config{}
	fmt.Println("clean")
}
`,
		"go.mod": "module example.com/clean\n\ngo 1.22\n",
	})

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	result, warnings, err := tools.HandleERTReadiness(ctx, makeCall("ert_readiness", dir))
	if err != nil {
		t.Fatalf("HandleERTReadiness returned error: %v", err)
	}

	resp, ok := result.(*tools.ReadinessResponse)
	if !ok {
		t.Fatalf("expected *ReadinessResponse, got %T\n%s", result, asJSON(result))
	}

	t.Logf("Alignment score: %d | Risk: %s | Controls: %d passed, %d failed",
		resp.AlignmentScore, resp.RiskLevel,
		resp.ComplianceSummary.Passed, resp.ComplianceSummary.Failed)
	t.Logf("Warnings: %v", warnings)
	t.Logf("Roadmap items: %d", len(resp.Roadmap))

	if resp.AlignmentScore < 0 || resp.AlignmentScore > 100 {
		t.Errorf("alignment score %d out of range [0,100]", resp.AlignmentScore)
	}
	if resp.ComplianceSummary.TotalControls == 0 {
		t.Error("expected at least 1 control assessed")
	}
	if len(resp.Roadmap) == 0 {
		t.Error("expected at least one roadmap item")
	}
}

// TestERTReadiness_WeakCryptoProject verifies a project with weak crypto usage
// doesn't crash the scanner (finding detection via ert_crypto, not readiness).
func TestERTReadiness_WeakCryptoProject(t *testing.T) {
	dir := writeFixture(t, map[string]string{
		"crypto.go": `package main

import (
	"crypto/md5"
	"crypto/sha1"
	"crypto/rc4"
	"fmt"
)

func weakHash(data []byte) []byte {
	h := md5.New()         // CRITICAL: MD5 collision-broken
	h.Write(data)
	h2 := sha1.New()       // HIGH: SHA-1 collision-broken
	h2.Write(data)
	_, _ = rc4.NewCipher(data) // CRITICAL: RC4 broken
	fmt.Println(h, h2)
	return h.Sum(nil)
}
`,
		"go.mod": "module example.com/weak-crypto\n\ngo 1.22\n",
	})

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	result, _, err := tools.HandleERTReadiness(ctx, makeCall("ert_readiness", dir))
	if err != nil {
		t.Fatalf("HandleERTReadiness error on weak crypto project: %v", err)
	}
	resp, ok := result.(*tools.ReadinessResponse)
	if !ok {
		t.Fatalf("expected *ReadinessResponse, got %T", result)
	}
	t.Logf("Weak crypto project — Alignment: %d | Risk: %s", resp.AlignmentScore, resp.RiskLevel)
}

// ─────────────────────────────────────────────────────────────────────────────
// Package C — ert_crypto (SBOM-informed PQC attestation)
// ─────────────────────────────────────────────────────────────────────────────

// TestERTCrypto_DetectsWeakPrimitives verifies the scanner flags MD5, SHA1, RC4,
// and RSA references with the correct severity.
func TestERTCrypto_DetectsWeakPrimitives(t *testing.T) {
	dir := writeFixture(t, map[string]string{
		"crypto.go": `package main

import (
	"crypto/md5"
	"crypto/sha1"
	"crypto/rsa"
	"crypto/rc4"
	"crypto/rand"
	"math/big"
	"fmt"
)

func weakHash(data []byte) {
	h := md5.New()
	h.Write(data)
	h2 := sha1.New()
	h2.Write(data)
	_, _ = rc4.NewCipher(data)
	key, _ := rsa.GenerateKey(rand.Reader, 2048)
	_ = key.N.BitLen()
	n := new(big.Int)
	fmt.Println(h, h2, n)
}
`,
		"go.mod": "module example.com/crashdummy-crypto\n\ngo 1.22\n",
	})

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	result, warnings, err := tools.HandleERTCrypto(ctx, makeCall("ert_crypto", dir))
	if err != nil {
		t.Fatalf("HandleERTCrypto error: %v", err)
	}

	resp, ok := result.(*tools.CryptoResponse)
	if !ok {
		t.Fatalf("expected *CryptoResponse, got %T", result)
	}

	t.Logf("Source scan: RSA=%d ECDSA=%d AES=%d Kyber=%d Dilithium=%d legacy=%v pqc=%v",
		resp.SourceScan.RSARefs, resp.SourceScan.ECDSARefs,
		resp.SourceScan.AESRefs, resp.SourceScan.KyberRefs,
		resp.SourceScan.DilithiumRefs,
		resp.SourceScan.HasLegacy, resp.SourceScan.HasPQC)
	t.Logf("Weak primitives detected: %d", len(resp.WeakPrimitives))
	t.Logf("Quantum risk: %s", resp.QuantumRisk)
	t.Logf("Warnings: %v", warnings)

	// RSA reference must be detected
	if resp.SourceScan.RSARefs == 0 {
		t.Error("expected RSA references to be detected in source scan")
	}
	if !resp.SourceScan.HasLegacy {
		t.Error("expected HasLegacy=true for project with RSA")
	}

	// At least MD5 and SHA1 should be in weak primitives
	wantPatterns := []string{"md5.New()", "sha1.New()", "rc4.NewCipher("}
	for _, want := range wantPatterns {
		found := false
		for _, wp := range resp.WeakPrimitives {
			if wp.Pattern == want {
				found = true
				t.Logf("  ✓ Found weak primitive: %s [%s] at %s:%d",
					wp.Pattern, wp.Severity, wp.File, wp.Line)
				break
			}
		}
		if !found {
			t.Errorf("expected weak primitive %q to be detected, got %d primitives: %v",
				want, len(resp.WeakPrimitives), extractPatterns(resp.WeakPrimitives))
		}
	}

	// MD5 must be CRITICAL severity
	for _, wp := range resp.WeakPrimitives {
		if wp.Pattern == "md5.New()" && wp.Severity != "CRITICAL" {
			t.Errorf("md5.New() expected severity CRITICAL, got %s", wp.Severity)
		}
	}

	// Migration path must be populated
	if len(resp.PQCMigrationPath) == 0 {
		t.Error("expected PQC migration path to be populated")
	}

	// Quantum risk must mention vulnerability
	if !strings.Contains(strings.ToUpper(resp.QuantumRisk), "QUANTUM") &&
		!strings.Contains(strings.ToUpper(resp.QuantumRisk), "VULNERABLE") &&
		!strings.Contains(strings.ToUpper(resp.QuantumRisk), "CNSA") {
		t.Errorf("quantum risk summary seems generic: %s", resp.QuantumRisk)
	}
}

// TestERTCrypto_PQCProject verifies a project using Kyber/Dilithium is
// recognized as PQC-capable.
func TestERTCrypto_PQCProject(t *testing.T) {
	dir := writeFixture(t, map[string]string{
		"pqc.go": `package main

// PQC-native implementation using ML-KEM and ML-DSA
// kyber mlkem dilithium mldsa references

import "fmt"

const (
	kyberSecurityParam = 768   // ML-KEM-768 (NIST FIPS 203)
	dilithiumLevel     = 65    // ML-DSA-65 (NIST FIPS 204)
)

func main() {
	fmt.Printf("Kyber %d / Dilithium %d\n", kyberSecurityParam, dilithiumLevel)
}
`,
		"go.mod": "module example.com/crashdummy-pqc\n\ngo 1.22\n",
	})

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	result, _, err := tools.HandleERTCrypto(ctx, makeCall("ert_crypto", dir))
	if err != nil {
		t.Fatalf("HandleERTCrypto error on PQC project: %v", err)
	}

	resp, ok := result.(*tools.CryptoResponse)
	if !ok {
		t.Fatalf("expected *CryptoResponse, got %T", result)
	}

	t.Logf("PQC project — Kyber=%d Dilithium=%d HasPQC=%v",
		resp.SourceScan.KyberRefs, resp.SourceScan.DilithiumRefs, resp.SourceScan.HasPQC)

	if resp.SourceScan.KyberRefs == 0 {
		t.Error("expected Kyber references to be detected")
	}
	if resp.SourceScan.DilithiumRefs == 0 {
		t.Error("expected Dilithium references to be detected")
	}
	if !resp.SourceScan.HasPQC {
		t.Error("expected HasPQC=true for project with Kyber+Dilithium")
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Package D — ert_godfather (KernelRouter causal attestation)
// ─────────────────────────────────────────────────────────────────────────────

// TestERTGodfather_ProducesAttestation verifies the Godfather tool completes
// and produces a DAG node ID, causal chain, and interventions.
func TestERTGodfather_ProducesAttestation(t *testing.T) {
	dir := writeFixture(t, map[string]string{
		"main.go": `package main

import (
	"crypto/rsa"
	"crypto/rand"
	"fmt"
)

func main() {
	// Legacy RSA — should trigger PQC agent finding
	key, _ := rsa.GenerateKey(rand.Reader, 2048)
	fmt.Println(key.N.BitLen())
}
`,
		"go.mod":     "module example.com/crashdummy-godfather\n\ngo 1.22\n",
		"Dockerfile": "FROM ubi9-minimal:latest\nCOPY . /app\n",
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	result, warnings, err := tools.HandleERTGodfather(ctx, makeCall("ert_godfather", dir))
	if err != nil {
		t.Fatalf("HandleERTGodfather error: %v", err)
	}

	resp, ok := result.(*tools.GodfatherResponse)
	if !ok {
		t.Fatalf("expected *GodfatherResponse, got %T\n%s", result, asJSON(result))
	}

	t.Logf("Godfather result — Score=%.1f Risk=%s Findings=%d Critical=%d High=%d KEV=%d DAGNode=%s",
		resp.OverallScore, resp.RiskLevel, resp.TotalFindings,
		resp.CriticalCount, resp.HighCount, resp.CISAKEVCount, resp.DAGNodeID)
	t.Logf("Dollar impact: $%.0f", resp.DollarImpact)
	t.Logf("Causal chain steps: %d", len(resp.CausalChain))
	t.Logf("Interventions: %d", len(resp.Interventions))
	t.Logf("Capabilities executed: %v", resp.Capabilities)
	t.Logf("Warnings: %v", warnings)

	// Core response integrity checks
	if resp.TotalFindings == 0 {
		t.Error("expected at least 1 finding (PQC agent should fire on RSA source)")
	}
	if len(resp.CausalChain) == 0 {
		t.Error("expected at least 1 causal chain step")
	}
	if len(resp.Interventions) == 0 {
		t.Error("expected at least 1 recommended intervention")
	}
	if resp.DAGNodeID == "" {
		t.Error("expected a DAG node ID to be returned (attestation must be written)")
	}
	if len(resp.Capabilities) == 0 {
		t.Error("expected at least 1 agent capability to be reported")
	}
	if resp.DollarImpact < 0 {
		t.Errorf("dollar impact %f should not be negative", resp.DollarImpact)
	}
	if resp.OverallScore < 0 || resp.OverallScore > 100 {
		t.Errorf("overall score %f out of valid range [0,100]", resp.OverallScore)
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// DAG Attestation — dag_attestation
// ─────────────────────────────────────────────────────────────────────────────

// TestDAGAttestation_ReturnsStructuredExport verifies the dag_attestation
// tool produces a well-formed response with session metadata.
func TestDAGAttestation_ReturnsStructuredExport(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	call := mcp.MCPToolCall{
		ToolName: "dag_attestation",
		Args:     map[string]any{"session_id": "test-crash-dummy-001"},
		Identity: mcp.Identity{
			AgentID:   "crash-dummy-test",
			SessionID: "test-crash-dummy-001",
		},
	}

	result, warnings, err := tools.HandleDAGAttestation(ctx, call)
	if err != nil {
		t.Fatalf("HandleDAGAttestation error: %v", err)
	}

	resp, ok := result.(*tools.DAGAttestationResponse)
	if !ok {
		t.Fatalf("expected *DAGAttestationResponse, got %T", result)
	}

	t.Logf("DAG attestation — SessionID=%s NodeCount=%d ExportedAt=%s",
		resp.SessionID, resp.NodeCount, resp.ExportedAt)
	t.Logf("Warnings: %v", warnings)

	if resp.SessionID == "" {
		t.Error("expected session_id in response")
	}
	if resp.NodeCount <= 0 {
		t.Error("expected at least 1 DAG node in export")
	}
	if len(resp.Nodes) == 0 {
		t.Error("expected Nodes array to be non-empty")
	}
	if resp.ExportedAt == "" {
		t.Error("expected exported_at timestamp")
	}

	// Verify Adinkra symbol is present on all nodes
	for i, n := range resp.Nodes {
		if n.Symbol == "" {
			t.Errorf("node[%d] missing Adinkra symbol", i)
		}
		if n.Action == "" {
			t.Errorf("node[%d] missing action", i)
		}
		if n.Time == "" {
			t.Errorf("node[%d] missing timestamp", i)
		}
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// End-to-end pipeline: readiness → crypto → godfather
// ─────────────────────────────────────────────────────────────────────────────

// TestERT_FullPipeline_WeakProject runs the complete A→C→D pipeline against
// a synthetic project with legacy crypto and verifies coherent risk escalation.
func TestERT_FullPipeline_WeakProject(t *testing.T) {
	dir := writeFixture(t, map[string]string{
		"crypto.go": `package main

import (
	"crypto/md5"
	"crypto/rsa"
	"crypto/rand"
	"fmt"
)

func badCrypto() {
	h := md5.New()
	h.Write([]byte("secret"))
	key, _ := rsa.GenerateKey(rand.Reader, 2048)
	fmt.Println(h.Sum(nil), key.N.BitLen())
}
`,
		"go.mod": "module example.com/crashdummy-full\n\ngo 1.22\n",
		"CLAUDE.md": "# Project README\nThis is a test fixture for crash dummy validation.\n",
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	// Stage 1: Readiness assessment
	t.Run("readiness", func(t *testing.T) {
		result, _, err := tools.HandleERTReadiness(ctx, makeCall("ert_readiness", dir))
		if err != nil {
			t.Fatalf("ert_readiness: %v", err)
		}
		resp := result.(*tools.ReadinessResponse)
		t.Logf("  Alignment: %d/100 [%s]", resp.AlignmentScore, resp.RiskLevel)
		if resp.AlignmentScore > 100 {
			t.Errorf("alignment %d exceeds 100", resp.AlignmentScore)
		}
	})

	// Stage 2: Crypto attestation — must detect weak primitives
	t.Run("crypto", func(t *testing.T) {
		result, _, err := tools.HandleERTCrypto(ctx, makeCall("ert_crypto", dir))
		if err != nil {
			t.Fatalf("ert_crypto: %v", err)
		}
		resp := result.(*tools.CryptoResponse)
		t.Logf("  RSA refs: %d | Legacy: %v | Weak primitives: %d",
			resp.SourceScan.RSARefs, resp.SourceScan.HasLegacy, len(resp.WeakPrimitives))
		if !resp.SourceScan.HasLegacy {
			t.Error("crypto: expected HasLegacy=true")
		}
		if len(resp.WeakPrimitives) == 0 {
			t.Error("crypto: expected at least 1 weak primitive (md5.New() present in source)")
		}
	})

	// Stage 3: Godfather synthesis — must produce attestation
	t.Run("godfather", func(t *testing.T) {
		result, _, err := tools.HandleERTGodfather(ctx, makeCall("ert_godfather", dir))
		if err != nil {
			t.Fatalf("ert_godfather: %v", err)
		}
		resp := result.(*tools.GodfatherResponse)
		t.Logf("  Score: %.1f | Findings: %d | DAG: %s",
			resp.OverallScore, resp.TotalFindings, resp.DAGNodeID)
		if resp.DAGNodeID == "" {
			t.Error("godfather: expected DAG attestation node")
		}
		if resp.TotalFindings == 0 {
			t.Error("godfather: expected at least 1 finding on weak crypto project")
		}
	})
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

func extractPatterns(prims []tools.WeakPrimEntry) []string {
	out := make([]string, len(prims))
	for i, p := range prims {
		out[i] = p.Pattern
	}
	return out
}
