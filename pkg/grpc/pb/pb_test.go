package pb

import (
	"context"
	"io"
	"testing"

	"google.golang.org/grpc"
)

func TestScanRequest(t *testing.T) {
	req := &ScanRequest{
		ImageDigest:   "sha256:abc123",
		ImageTag:      "latest",
		Registry:      "docker.io",
		ScanType:      "vulnerability",
		FIPSMode:      true,
		PolicyProfile: "strict",
		TargetUri:     "docker.io/library/nginx:latest",
		Frameworks:    []string{"STIG", "CMMC"},
	}

	if req.ImageDigest == "" {
		t.Error("expected non-empty image digest")
	}

	if !req.FIPSMode {
		t.Error("expected FIPS mode to be true")
	}

	if len(req.Frameworks) != 2 {
		t.Errorf("expected 2 frameworks, got %d", len(req.Frameworks))
	}
}

func TestScanResponse(t *testing.T) {
	resp := &ScanResponse{
		ScanId:          "scan-123",
		Status:          "completed",
		Vulnerabilities: []*Vulnerability{},
		ComplianceScore: 95.5,
		Timestamp:       1234567890,
	}

	if resp.ScanId == "" {
		t.Error("expected non-empty scan ID")
	}

	if resp.ComplianceScore != 95.5 {
		t.Errorf("expected compliance score 95.5, got %f", resp.ComplianceScore)
	}
}

func TestScanStatusRequest(t *testing.T) {
	req := &ScanStatusRequest{
		ScanId: "scan-456",
	}

	if req.ScanId != "scan-456" {
		t.Error("expected scan ID to match")
	}
}

func TestScanStatusResponse(t *testing.T) {
	resp := &ScanStatusResponse{
		ScanId:   "scan-456",
		Status:   "in_progress",
		Progress: 75,
		Message:  "Scanning container layers...",
	}

	if resp.Progress != 75 {
		t.Errorf("expected progress 75, got %d", resp.Progress)
	}
}

func TestVulnerability(t *testing.T) {
	vuln := &Vulnerability{
		ID:          "CVE-2024-1234",
		Package:     "openssl",
		Version:     "1.1.1",
		Severity:    "HIGH",
		CVSS:        8.5,
		Description: "A vulnerability in OpenSSL",
		FixVersion:  "1.1.1t",
		References:  []string{"https://nvd.nist.gov/vuln/detail/CVE-2024-1234"},
	}

	if vuln.ID == "" {
		t.Error("expected non-empty vulnerability ID")
	}

	if vuln.CVSS != 8.5 {
		t.Error("expected CVSS to be 8.5")
	}

	if len(vuln.References) != 1 {
		t.Error("expected 1 reference")
	}
}

func TestVulnerabilityList(t *testing.T) {
	list := &VulnerabilityList{
		Vulnerabilities: []*Vulnerability{
			{ID: "CVE-1"},
			{ID: "CVE-2"},
			{ID: "CVE-3"},
		},
		TotalCount: 3,
	}

	if list.TotalCount != 3 {
		t.Errorf("expected 3 total, got %d", list.TotalCount)
	}

	if len(list.Vulnerabilities) != 3 {
		t.Error("expected 3 vulnerabilities in list")
	}
}

func TestComplianceRequest(t *testing.T) {
	req := &ComplianceRequest{
		TargetUri:  "registry.example.com/app:v1.0",
		Frameworks: []string{"STIG", "CMMC", "FedRAMP"},
	}

	if len(req.Frameworks) != 3 {
		t.Error("expected 3 frameworks")
	}
}

func TestComplianceResult(t *testing.T) {
	result := &ComplianceResult{
		TargetUri: "test-target",
		Passed:    true,
		Score:     98.5,
		Frameworks: []*FrameworkResult{
			{Name: "STIG", Passed: true, Score: 99.0},
			{Name: "CMMC", Passed: true, Score: 98.0},
		},
		Timestamp: 1234567890,
	}

	if !result.Passed {
		t.Error("expected compliance to pass")
	}

	if len(result.Frameworks) != 2 {
		t.Error("expected 2 framework results")
	}
}

func TestFrameworkResult(t *testing.T) {
	fw := &FrameworkResult{
		Name:    "STIG",
		Version: "V2R3",
		Passed:  true,
		Score:   95.0,
		Controls: []*ControlResult{
			{ID: "SV-12345", Title: "Test Control", Passed: true, Severity: "medium"},
		},
	}

	if fw.Name != "STIG" {
		t.Error("expected framework name STIG")
	}

	if len(fw.Controls) != 1 {
		t.Error("expected 1 control result")
	}
}

func TestControlResult(t *testing.T) {
	ctrl := &ControlResult{
		ID:       "SV-12345",
		Title:    "Disable Unnecessary Services",
		Passed:   false,
		Severity: "high",
		Message:  "Service xyz is running but should be disabled",
	}

	if ctrl.Passed {
		t.Error("expected control to fail")
	}

	if ctrl.Severity != "high" {
		t.Error("expected high severity")
	}
}

func TestSBOMRequest(t *testing.T) {
	req := &SBOMRequest{
		TargetUri: "registry.example.com/app:latest",
		Format:    "cyclonedx-json",
	}

	if req.Format != "cyclonedx-json" {
		t.Error("expected cyclonedx-json format")
	}
}

func TestSBOM(t *testing.T) {
	sbom := &SBOM{
		TargetUri: "test-target",
		Format:    "spdx-json",
		Content:   []byte(`{"spdxVersion": "SPDX-2.3"}`),
		Components: []*SBOMComponent{
			{
				Name:     "openssl",
				Version:  "1.1.1",
				Type:     "library",
				Purl:     "pkg:deb/debian/openssl@1.1.1",
				Licenses: []string{"Apache-2.0"},
				Hashes: map[string]string{
					"SHA256": "abc123",
				},
			},
		},
		Timestamp: 1234567890,
	}

	if sbom.Format != "spdx-json" {
		t.Error("expected spdx-json format")
	}

	if len(sbom.Components) != 1 {
		t.Error("expected 1 component")
	}

	comp := sbom.Components[0]
	if comp.Name != "openssl" {
		t.Error("expected component name openssl")
	}
}

func TestBatchScanRequest(t *testing.T) {
	req := &BatchScanRequest{
		Requests: []*ScanRequest{
			{TargetUri: "target1"},
			{TargetUri: "target2"},
			{TargetUri: "target3"},
		},
	}

	if len(req.Requests) != 3 {
		t.Errorf("expected 3 requests, got %d", len(req.Requests))
	}
}

func TestBatchScanResponse(t *testing.T) {
	resp := &BatchScanResponse{
		Result: &ScanResponse{ScanId: "batch-1"},
		Error:  "",
	}

	if resp.Result == nil {
		t.Error("expected non-nil result")
	}

	if resp.Error != "" {
		t.Error("expected no error")
	}
}

func TestNewIronBankScannerClient(t *testing.T) {
	// Create a mock connection interface
	var mockConn grpc.ClientConnInterface = nil

	// This will create a client with nil connection (stub behavior)
	client := NewIronBankScannerClient(mockConn)

	if client == nil {
		t.Error("expected non-nil client")
	}
}

func TestIronBankScannerClient_StubMethods(t *testing.T) {
	client := NewIronBankScannerClient(nil)
	ctx := context.Background()

	// Test ScanImage
	resp, err := client.ScanImage(ctx, &ScanRequest{})
	if err != nil {
		t.Errorf("ScanImage returned unexpected error: %v", err)
	}
	if resp.Status != "not_implemented" {
		t.Error("expected not_implemented status")
	}

	// Test Scan
	resp, err = client.Scan(ctx, &ScanRequest{})
	if err != nil {
		t.Errorf("Scan returned unexpected error: %v", err)
	}
	if resp.Status != "not_implemented" {
		t.Error("expected not_implemented status")
	}

	// Test GetScanStatus
	statusResp, err := client.GetScanStatus(ctx, &ScanStatusRequest{})
	if err != nil {
		t.Errorf("GetScanStatus returned unexpected error: %v", err)
	}
	if statusResp.Status != "not_implemented" {
		t.Error("expected not_implemented status")
	}

	// Test GetScanResult
	resultResp, err := client.GetScanResult(ctx, &ScanResultRequest{})
	if err != nil {
		t.Errorf("GetScanResult returned unexpected error: %v", err)
	}
	if resultResp.Status != "not_implemented" {
		t.Error("expected not_implemented status")
	}

	// Test ListVulnerabilities
	listResp, err := client.ListVulnerabilities(ctx, &ListRequest{})
	if err != nil {
		t.Errorf("ListVulnerabilities returned unexpected error: %v", err)
	}
	if listResp == nil {
		t.Error("expected non-nil response")
	}

	// Test ValidateCompliance
	compResp, err := client.ValidateCompliance(ctx, &ComplianceRequest{})
	if err != nil {
		t.Errorf("ValidateCompliance returned unexpected error: %v", err)
	}
	if compResp.Passed {
		t.Error("expected Passed to be false for stub")
	}

	// Test GetSBOM
	sbomResp, err := client.GetSBOM(ctx, &SBOMRequest{})
	if err != nil {
		t.Errorf("GetSBOM returned unexpected error: %v", err)
	}
	if sbomResp == nil {
		t.Error("expected non-nil SBOM response")
	}

	// Test BatchScan
	batchClient, err := client.BatchScan(ctx, &BatchScanRequest{})
	if err != nil {
		t.Errorf("BatchScan returned unexpected error: %v", err)
	}
	if batchClient == nil {
		t.Error("expected non-nil batch client")
	}

	// BatchScan client should return EOF
	_, recvErr := batchClient.Recv()
	if recvErr != io.EOF {
		t.Errorf("expected io.EOF from batch client Recv, got %v", recvErr)
	}
}
