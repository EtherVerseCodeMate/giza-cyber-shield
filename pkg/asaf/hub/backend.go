package hub

import (
	"context"
	"fmt"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/stig"
)

// Backend is the single interface all Fyne views use to access compliance data.
//
// The local *models.ComplianceGraphModel is always a Fyne-side struct and is
// NOT part of this interface — the Backend handles IO only.  Views check
// Mode() and call the appropriate methods; the same view code runs in all modes.
type Backend interface {
	// Mode returns the current operating mode (Standalone/Connected/EmbeddedHub).
	Mode() AppMode

	// HubURL returns the configured Hub base URL, or "" in standalone mode.
	// Used for the connection status badge in the main window header.
	HubURL() string

	// Ping verifies backend connectivity and returns version information.
	// In standalone: returns local binary version with no network call.
	Ping(ctx context.Context) (*HealthResponse, error)

	// GetEnclaves returns all compliance boundary enclaves.
	// In standalone: returns a single "Local Enclave" containing localhost.
	// In connected: GET /api/v1/fleet/enclaves
	GetEnclaves(ctx context.Context) ([]Enclave, error)

	// GetAssets returns enrolled endpoints for an enclave.
	// Pass enclaveID "" to return all assets across all enclaves.
	// In standalone: returns a single Asset record for localhost.
	// In connected: GET /api/v1/fleet/assets?enclave_id={enclaveID}
	GetAssets(ctx context.Context, enclaveID string) ([]Asset, error)

	// GetSPRS returns the SPRS computation for an enclave.
	// In standalone: computed from the most recent local stig scan.
	// In connected: GET /api/v1/fleet/sprs/{enclaveID}
	GetSPRS(ctx context.Context, enclaveID string) (*SPRSResult, error)

	// Scan runs a STIG baseline scan.
	// In standalone: in-process via stig.NewValidator (embedded 25,185-row DB).
	// In connected: POST /api/v1/scan on the Hub (Hub runs it on the asset).
	Scan(ctx context.Context, assetID string) (*stig.ComprehensiveReport, error)

	// GetPendingApprovals returns ChangeRequests awaiting CISO approval.
	// In standalone: queries the local Imhotep daemon staging queue.
	// In connected: GET /api/v1/imhotep/pending
	GetPendingApprovals(ctx context.Context) ([]PendingChange, error)

	// StageChange submits one ChangeRequest per command to the Imhotep daemon for
	// staging (runs each command in an isolated container; no production effect).
	// Returns a StagingID for each submitted command, in the same order as commands.
	// CALLERS MUST SHOW A CONFIRMATION DIALOG before invoking this method.
	// In standalone: signs and sends each ChangeRequest over the local Unix socket.
	// In connected: POST /api/v1/imhotep/stage
	StageChange(ctx context.Context, controlID string, commands [][]string) ([]string, error)

	// Approve approves a staged ChangeRequest for production execution.
	// CALLERS MUST SHOW A CONFIRMATION DIALOG before invoking this method.
	// This is the human-in-the-loop gate per §13 of the desktop agent spec.
	// In standalone: calls daemon client with Approved=true via Unix socket.
	// In connected: POST /api/v1/imhotep/approve/{id}
	Approve(ctx context.Context, id string) error

	// GetDAGHistory returns the compliance attestation chain.
	// In standalone: reads the local pkg/dag Store.
	// In connected: GET /api/v1/dag/history
	GetDAGHistory(ctx context.Context) ([]DAGNode, error)

	// Ask sends a natural language compliance query.
	// In standalone: routes to local intelligence AI brain (Ollama → offline fallback).
	// In connected: POST /api/v1/mcp/ask
	Ask(ctx context.Context, query string) (*AskResponse, error)

	// NotifyScanDone pushes the completed scan result back into the backend so that
	// all other tabs (Readiness Gate, SSP, POA&M, KASA feed) see up-to-date data.
	// Called by the Compliance Graph tab after ingestReport + FinalizeScan complete.
	// LocalBackend: stores lastReport, lastSPRS, lastScanHost, lastScanTime.
	// HubClient: no-op — Hub manages its own state server-side.
	NotifyScanDone(report *stig.ComprehensiveReport, sprsScore int, hostname string)

	// StreamKASA opens a real-time KASA event stream.
	// In standalone: bridges the local pkg/agi Engine log.
	// In connected: SSE GET /api/v1/kasa/stream
	// The caller owns the context and must cancel it to close the stream.
	StreamKASA(ctx context.Context) (<-chan KASAEvent, error)

	// ── Fleet Connector methods ───────────────────────────────────────────────

	// AddAsset enrolls a new endpoint into the fleet.
	// In standalone: creates an in-memory asset record via ConnectorRegistry.
	// In connected: POST /api/v1/fleet/assets
	AddAsset(ctx context.Context, req AddAssetRequest) (*Asset, error)

	// TestConnection verifies connectivity to a candidate endpoint.
	// In standalone: dispatches to the appropriate pkg/asaf/connector.Connector.
	// In connected: POST /api/v1/fleet/assets/test
	TestConnection(ctx context.Context, cfg ConnectorConfig, cred *ConnectorCred) (*TestResult, error)

	// ImportCSV bulk-enrolls assets from parsed CSV rows.
	// In standalone: calls AddAsset for each valid row.
	// In connected: POST /api/v1/fleet/assets/import
	ImportCSV(ctx context.Context, rows []CSVAssetRow, enclaveID string) (*ImportResult, error)

	// DiscoverSubnet scans a CIDR range and streams discovered hosts.
	// In standalone: uses SubnetConnector (nmap or TCP fallback).
	// In connected: SSE GET /api/v1/fleet/discover?cidr=...
	DiscoverSubnet(ctx context.Context, cidr string, opts DiscoveryOptions) (<-chan DiscoveredHost, error)

	// GetConnectors returns all saved connector configurations.
	// In standalone: reads from ConnectorRegistry (~/.khepra/connectors.json).
	// In connected: GET /api/v1/fleet/connectors
	GetConnectors(ctx context.Context) ([]ConnectorConfig, error)

	// SaveConnector persists a connector configuration (and optionally its credential).
	// In standalone: writes to ConnectorRegistry.
	// In connected: POST /api/v1/fleet/connectors
	SaveConnector(ctx context.Context, cfg ConnectorConfig, cred *ConnectorCred) error

	// SetBoundary updates the allowed egress CIDRs for the local guard.
	SetBoundary(ctx context.Context, cidrs []string) error
}

// ErrNotConnected is returned by Hub-only operations when in ModeStandalone.
// The UI surfaces this as a contextual message rather than a raw error.
var ErrNotConnected = fmt.Errorf("hub: not connected to a Stargate Hub — start with --hub <url> or --embed-hub")
