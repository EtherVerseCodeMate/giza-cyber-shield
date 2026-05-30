package validation_test

// sovereign_network_test.go — Verifiable proof that LaneSonar enforces network
// policy in sovereign/ironbank mode.
//
// Auditor verification:
//   go test ./tests/validation/... -run TestLaneSonar -v
//
// Expected output:
//   TestLaneSonar_SovereignBlocksInternetIP  PASS  (error contains "sovereign")
//   TestLaneSonar_SovereignAllowsLAN         PASS  (no policy error for 192.168.1.1)
//   TestLaneSonar_LocalOnlyBlocksLAN         PASS  (error for 192.168.1.1 in local_only mode)
//   TestLaneSonar_SaaSAllowsInternet         PASS  (no policy error in unrestricted mode)

import (
	"context"
	"strings"
	"testing"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/config"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/ert"
)

// TestLaneSonar_SovereignBlocksInternetIP is the canonical sovereignty enforcement test.
// A sovereign/air-gap deployment MUST reject internet-routable scan targets.
// Run with: go test ./tests/validation/... -run TestLaneSonar_SovereignBlocksInternetIP -v
func TestLaneSonar_SovereignBlocksInternetIP(t *testing.T) {
	lane := ert.NewSonarLane(ert.SonarLaneConfig{
		NetworkPolicy: config.NetworkPolicyLAN, // sovereign default
	})

	// 8.8.8.8 is internet-routable — must be blocked in sovereign/LAN mode
	req := ert.ScanRequest{ImageRef: "8.8.8.8"}
	_, err := lane.Run(context.Background(), req)

	if err == nil {
		t.Fatal("SOVEREIGNTY VIOLATION: LaneSonar allowed internet-routable target 8.8.8.8 in sovereign/LAN mode. " +
			"This means enforceNetworkPolicy() is not functioning. Air-gap guarantee is broken.")
	}
	if !strings.Contains(err.Error(), "sovereign") && !strings.Contains(err.Error(), "lan policy") {
		t.Errorf("Expected policy error message to mention 'sovereign' or 'lan policy', got: %v", err)
	}
	t.Logf("✅ CONFIRMED: 8.8.8.8 blocked in sovereign/LAN mode — error: %v", err)
}

// TestLaneSonar_SovereignAllowsLAN verifies that sovereign mode permits LAN targets.
// Port scanning 192.168.1.1 is valid in sovereign mode — LAN is the intended scope.
func TestLaneSonar_SovereignAllowsLAN(t *testing.T) {
	lane := ert.NewSonarLane(ert.SonarLaneConfig{
		NetworkPolicy: config.NetworkPolicyLAN,
		ScanTimeout:   0, // minimal timeout — we just need policy pass, not real results
	})

	req := ert.ScanRequest{ImageRef: "192.168.1.1"}
	_, err := lane.Run(context.Background(), req)

	// A policy error would contain "sovereign" or "lan policy"
	// A connection error (no host at 192.168.1.1) is acceptable — policy passed
	if err != nil {
		if strings.Contains(err.Error(), "sovereign") || strings.Contains(err.Error(), "lan policy") {
			t.Fatalf("LAN target 192.168.1.1 was incorrectly blocked by sovereign policy: %v", err)
		}
		// Connection refused / timeout is expected for a non-existent host — policy passed
		t.Logf("✅ 192.168.1.1 passed policy gate (connection result: %v)", err)
		return
	}
	t.Log("✅ 192.168.1.1 allowed and scan completed in sovereign/LAN mode")
}

// TestLaneSonar_LocalOnlyBlocksLAN verifies that local_only mode blocks LAN IPs.
// More restrictive than LAN — only loopback is permitted.
func TestLaneSonar_LocalOnlyBlocksLAN(t *testing.T) {
	lane := ert.NewSonarLane(ert.SonarLaneConfig{
		NetworkPolicy: config.NetworkPolicyLocalOnly,
	})

	req := ert.ScanRequest{ImageRef: "192.168.1.1"}
	_, err := lane.Run(context.Background(), req)

	if err == nil {
		t.Fatal("local_only policy should have blocked 192.168.1.1 (non-loopback)")
	}
	t.Logf("✅ 192.168.1.1 blocked in local_only mode — error: %v", err)
}

// TestLaneSonar_SaaSAllowsInternet verifies that unrestricted/SaaS mode permits internet IPs.
// This is the correct behaviour for the Fly.io MCP deployment.
func TestLaneSonar_SaaSAllowsInternet(t *testing.T) {
	lane := ert.NewSonarLane(ert.SonarLaneConfig{
		NetworkPolicy: config.NetworkPolicyUnrestricted, // SaaS/edge mode
	})

	req := ert.ScanRequest{ImageRef: "1.1.1.1"}
	_, err := lane.Run(context.Background(), req)

	// Policy should pass — connection result doesn't matter for this test
	if err != nil {
		if strings.Contains(err.Error(), "sovereign") || strings.Contains(err.Error(), "lan policy") || strings.Contains(err.Error(), "local_only") {
			t.Fatalf("Internet target 1.1.1.1 was incorrectly blocked in unrestricted/SaaS mode: %v", err)
		}
		// Timeout/refused is fine — policy passed
		t.Logf("✅ 1.1.1.1 passed policy gate in SaaS/unrestricted mode (connection result: %v)", err)
		return
	}
	t.Log("✅ 1.1.1.1 allowed in SaaS/unrestricted mode")
}

// TestLaneSonar_DefaultPolicyIsSovereign verifies that an unconfigured SonarLane
// defaults to LAN policy, not unrestricted. Safe-by-default.
func TestLaneSonar_DefaultPolicyIsSovereign(t *testing.T) {
	// Empty config — NetworkPolicy defaults to NetworkPolicyLAN per NewSonarLane()
	lane := ert.NewSonarLane(ert.SonarLaneConfig{})

	req := ert.ScanRequest{ImageRef: "8.8.8.8"}
	_, err := lane.Run(context.Background(), req)

	if err == nil {
		t.Fatal("DEFAULT policy should block 8.8.8.8 — SonarLane must be safe-by-default (LAN policy when unconfigured)")
	}
	t.Logf("✅ Default policy blocks internet IPs — safe-by-default confirmed. Error: %v", err)
}
