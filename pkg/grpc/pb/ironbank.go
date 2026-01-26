// Package pb contains protobuf stubs for IronBank scanner service.
// This is a placeholder until the actual .proto files are compiled.
package pb

import (
	"context"

	"google.golang.org/grpc"
)

// IronBankScannerClient is the client interface for IronBank scanner service.
type IronBankScannerClient interface {
	ScanImage(ctx context.Context, in *ScanRequest, opts ...grpc.CallOption) (*ScanResponse, error)
	GetScanStatus(ctx context.Context, in *StatusRequest, opts ...grpc.CallOption) (*StatusResponse, error)
	ListVulnerabilities(ctx context.Context, in *ListRequest, opts ...grpc.CallOption) (*VulnerabilityList, error)
}

// ScanRequest contains image scan parameters.
type ScanRequest struct {
	ImageDigest   string
	ImageTag      string
	Registry      string
	ScanType      string
	FIPSMode      bool
	PolicyProfile string
}

// ScanResponse contains scan results.
type ScanResponse struct {
	ScanID          string
	Status          string
	Vulnerabilities []*Vulnerability
	ComplianceScore float64
	Timestamp       int64
}

// StatusRequest queries scan status.
type StatusRequest struct {
	ScanID string
}

// StatusResponse returns current scan status.
type StatusResponse struct {
	ScanID   string
	Status   string
	Progress int32
	Message  string
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

func (c *ironBankScannerClient) GetScanStatus(ctx context.Context, in *StatusRequest, opts ...grpc.CallOption) (*StatusResponse, error) {
	return &StatusResponse{Status: "not_implemented"}, nil
}

func (c *ironBankScannerClient) ListVulnerabilities(ctx context.Context, in *ListRequest, opts ...grpc.CallOption) (*VulnerabilityList, error) {
	return &VulnerabilityList{}, nil
}
