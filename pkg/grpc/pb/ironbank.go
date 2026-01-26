// Package pb contains protobuf stubs for IronBank scanner service.
// This is a placeholder until the actual .proto files are compiled.
package pb

import (
	"context"
	"io"

	"google.golang.org/grpc"
)

// IronBankScannerClient is the client interface for IronBank scanner service.
type IronBankScannerClient interface {
	// ScanImage is the legacy scan interface
	ScanImage(ctx context.Context, in *ScanRequest, opts ...grpc.CallOption) (*ScanResponse, error)
	// Scan initiates a new scan
	Scan(ctx context.Context, in *ScanRequest, opts ...grpc.CallOption) (*ScanResponse, error)
	// GetScanStatus checks scan progress
	GetScanStatus(ctx context.Context, in *ScanStatusRequest, opts ...grpc.CallOption) (*ScanStatusResponse, error)
	// GetScanResult retrieves completed scan results
	GetScanResult(ctx context.Context, in *ScanResultRequest, opts ...grpc.CallOption) (*ScanResponse, error)
	// ListVulnerabilities lists discovered vulnerabilities
	ListVulnerabilities(ctx context.Context, in *ListRequest, opts ...grpc.CallOption) (*VulnerabilityList, error)
	// ValidateCompliance checks against compliance frameworks
	ValidateCompliance(ctx context.Context, in *ComplianceRequest, opts ...grpc.CallOption) (*ComplianceResult, error)
	// GetSBOM retrieves software bill of materials
	GetSBOM(ctx context.Context, in *SBOMRequest, opts ...grpc.CallOption) (*SBOM, error)
	// BatchScan processes multiple artifacts in a stream
	BatchScan(ctx context.Context, in *BatchScanRequest, opts ...grpc.CallOption) (IronBankScanner_BatchScanClient, error)
}

// IronBankScanner_BatchScanClient is the streaming client for batch scans.
type IronBankScanner_BatchScanClient interface {
	Recv() (*BatchScanResponse, error)
	grpc.ClientStream
}

// ScanRequest contains image scan parameters.
type ScanRequest struct {
	ImageDigest   string
	ImageTag      string
	Registry      string
	ScanType      string
	FIPSMode      bool
	PolicyProfile string
	TargetUri     string   // Target URI for scanning
	Frameworks    []string // Compliance frameworks to check
}

// ScanResponse contains scan results.
type ScanResponse struct {
	ScanId          string
	Status          string
	Vulnerabilities []*Vulnerability
	ComplianceScore float64
	Timestamp       int64
}

// ScanStatusRequest queries scan status.
type ScanStatusRequest struct {
	ScanId string
}

// ScanStatusResponse returns current scan status.
type ScanStatusResponse struct {
	ScanId   string
	Status   string
	Progress int32
	Message  string
}

// ScanResultRequest retrieves completed scan results.
type ScanResultRequest struct {
	ScanId     string
	IncludeRaw bool
}

// ListRequest queries vulnerabilities.
type ListRequest struct {
	ScanID       string
	MinSeverity  string
	IncludeFixes bool
}

// VulnerabilityList contains discovered vulnerabilities.
type VulnerabilityList struct {
	Vulnerabilities []*Vulnerability
	TotalCount      int32
}

// Vulnerability represents a single security issue.
type Vulnerability struct {
	ID          string
	Package     string
	Version     string
	Severity    string
	CVSS        float64
	Description string
	FixVersion  string
	References  []string
}

// ComplianceRequest checks against compliance frameworks.
type ComplianceRequest struct {
	TargetUri  string
	Frameworks []string
}

// ComplianceResult contains compliance validation results.
type ComplianceResult struct {
	TargetUri   string
	Passed      bool
	Score       float64
	Frameworks  []*FrameworkResult
	Timestamp   int64
}

// FrameworkResult contains results for a single framework.
type FrameworkResult struct {
	Name        string
	Version     string
	Passed      bool
	Score       float64
	Controls    []*ControlResult
}

// ControlResult contains a single control check result.
type ControlResult struct {
	ID          string
	Title       string
	Passed      bool
	Severity    string
	Message     string
}

// SBOMRequest retrieves software bill of materials.
type SBOMRequest struct {
	TargetUri string
	Format    string // cyclonedx-json, spdx-json, etc.
}

// SBOM contains software bill of materials.
type SBOM struct {
	TargetUri  string
	Format     string
	Content    []byte
	Components []*SBOMComponent
	Timestamp  int64
}

// SBOMComponent represents a software component in the SBOM.
type SBOMComponent struct {
	Name     string
	Version  string
	Type     string
	Purl     string
	Licenses []string
	Hashes   map[string]string
}

// BatchScanRequest processes multiple artifacts.
type BatchScanRequest struct {
	Requests []*ScanRequest
}

// BatchScanResponse contains streaming batch results.
type BatchScanResponse struct {
	Result *ScanResponse
	Error  string
}

// NewIronBankScannerClient creates a new scanner client.
func NewIronBankScannerClient(cc grpc.ClientConnInterface) IronBankScannerClient {
	return &ironBankScannerClient{cc: cc}
}

type ironBankScannerClient struct {
	cc grpc.ClientConnInterface
}

func (c *ironBankScannerClient) ScanImage(ctx context.Context, in *ScanRequest, opts ...grpc.CallOption) (*ScanResponse, error) {
	// Stub implementation - will be replaced by actual gRPC call
	return &ScanResponse{Status: "not_implemented"}, nil
}

func (c *ironBankScannerClient) Scan(ctx context.Context, in *ScanRequest, opts ...grpc.CallOption) (*ScanResponse, error) {
	// Stub implementation - will be replaced by actual gRPC call
	return &ScanResponse{Status: "not_implemented"}, nil
}

func (c *ironBankScannerClient) GetScanStatus(ctx context.Context, in *ScanStatusRequest, opts ...grpc.CallOption) (*ScanStatusResponse, error) {
	return &ScanStatusResponse{Status: "not_implemented"}, nil
}

func (c *ironBankScannerClient) GetScanResult(ctx context.Context, in *ScanResultRequest, opts ...grpc.CallOption) (*ScanResponse, error) {
	return &ScanResponse{Status: "not_implemented"}, nil
}

func (c *ironBankScannerClient) ListVulnerabilities(ctx context.Context, in *ListRequest, opts ...grpc.CallOption) (*VulnerabilityList, error) {
	return &VulnerabilityList{}, nil
}

func (c *ironBankScannerClient) ValidateCompliance(ctx context.Context, in *ComplianceRequest, opts ...grpc.CallOption) (*ComplianceResult, error) {
	return &ComplianceResult{Passed: false}, nil
}

func (c *ironBankScannerClient) GetSBOM(ctx context.Context, in *SBOMRequest, opts ...grpc.CallOption) (*SBOM, error) {
	return &SBOM{}, nil
}

func (c *ironBankScannerClient) BatchScan(ctx context.Context, in *BatchScanRequest, opts ...grpc.CallOption) (IronBankScanner_BatchScanClient, error) {
	return &batchScanClient{}, nil
}

// batchScanClient implements the streaming client interface.
type batchScanClient struct {
	grpc.ClientStream
}

func (c *batchScanClient) Recv() (*BatchScanResponse, error) {
	return nil, io.EOF
}
