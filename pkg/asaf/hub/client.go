package hub

import (
	"bufio"
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/adinkra"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/stig"
)

// Config holds the parameters for connecting to a Stargate Hub.
type Config struct {
	// HubURL is the base URL of the Hub server, e.g. "https://asaf.company.com:8443".
	HubURL string

	// AgentID is the identity presented to the Hub's auth layer.
	// Defaults to hostname if empty.
	AgentID string

	// PrivKey is the ML-DSA-65 private key used to sign every outbound request.
	// Required for Hub authentication.
	PrivKey []byte

	// Insecure skips TLS certificate verification.
	// NEVER use in production — development/self-signed cert only.
	Insecure bool

	// Embedded marks this client as talking to a locally spawned Hub subprocess.
	// Sets AppMode = ModeEmbeddedHub instead of ModeConnected.
	Embedded bool
}

// HubClient implements Backend for ModeConnected and ModeEmbeddedHub.
//
// All requests are ML-DSA-65 signed:
//
//	Signed payload = "METHOD /path\n" + body_bytes
//	Header X-ASAF-Signature: hex(adinkra.Sign(privKey, payload))
//	Header X-ASAF-Agent: agentID
//
// This matches the Hub's 4-layer Gateway L2 auth (transport_http.go).
// All compliance data lives on the customer's Stargate Hub server — zero vendor
// cloud involvement per the No-SaaS Manifesto (unification_architecture.md §2).
type HubClient struct {
	baseURL    string
	mode       AppMode
	agentID    string
	privKey    []byte
	httpClient *http.Client
}

// New constructs a HubClient.
func New(cfg Config) (*HubClient, error) {
	if cfg.HubURL == "" {
		return nil, fmt.Errorf("hub: HubURL is required")
	}
	if len(cfg.PrivKey) == 0 {
		return nil, fmt.Errorf("hub: PrivKey is required for ML-DSA-65 request signing")
	}
	agentID := cfg.AgentID
	if agentID == "" {
		agentID = "asaf-desktop"
	}
	mode := ModeConnected
	if cfg.Embedded {
		mode = ModeEmbeddedHub
	}
	transport := http.DefaultTransport.(*http.Transport).Clone()
	if cfg.Insecure {
		transport.TLSClientConfig = &tls.Config{InsecureSkipVerify: true} //nolint:gosec // dev-only, guarded by cfg.Insecure flag
	}
	return &HubClient{
		baseURL: strings.TrimRight(cfg.HubURL, "/"),
		mode:    mode,
		agentID: agentID,
		privKey: cfg.PrivKey,
		httpClient: &http.Client{
			Transport: transport,
			Timeout:   120 * time.Second,
		},
	}, nil
}

// Mode implements Backend.
func (c *HubClient) Mode() AppMode { return c.mode }

// HubURL implements Backend.
func (c *HubClient) HubURL() string { return c.baseURL }

// Ping implements Backend — GET /health.
func (c *HubClient) Ping(ctx context.Context) (*HealthResponse, error) {
	var resp HealthResponse
	if err := c.get(ctx, "/health", &resp); err != nil {
		return nil, fmt.Errorf("hub ping: %w", err)
	}
	return &resp, nil
}

// GetEnclaves implements Backend — GET /api/v1/fleet/enclaves.
func (c *HubClient) GetEnclaves(ctx context.Context) ([]Enclave, error) {
	var resp struct {
		Enclaves []Enclave `json:"enclaves"`
	}
	if err := c.get(ctx, "/api/v1/fleet/enclaves", &resp); err != nil {
		return nil, fmt.Errorf("hub get enclaves: %w", err)
	}
	return resp.Enclaves, nil
}

// GetAssets implements Backend — GET /api/v1/fleet/assets.
func (c *HubClient) GetAssets(ctx context.Context, enclaveID string) ([]Asset, error) {
	path := "/api/v1/fleet/assets"
	if enclaveID != "" {
		path += "?enclave_id=" + enclaveID
	}
	var resp struct {
		Assets []Asset `json:"assets"`
	}
	if err := c.get(ctx, path, &resp); err != nil {
		return nil, fmt.Errorf("hub get assets: %w", err)
	}
	return resp.Assets, nil
}

// GetSPRS implements Backend — GET /api/v1/fleet/sprs/{enclaveID}.
func (c *HubClient) GetSPRS(ctx context.Context, enclaveID string) (*SPRSResult, error) {
	path := "/api/v1/fleet/sprs/" + enclaveID
	var result SPRSResult
	if err := c.get(ctx, path, &result); err != nil {
		return nil, fmt.Errorf("hub get sprs: %w", err)
	}
	return &result, nil
}

// Scan implements Backend — POST /api/v1/scan.
func (c *HubClient) Scan(ctx context.Context, assetID string) (*stig.ComprehensiveReport, error) {
	body := map[string]string{"asset_id": assetID}
	var report stig.ComprehensiveReport
	if err := c.post(ctx, "/api/v1/scan", body, &report); err != nil {
		return nil, fmt.Errorf("hub scan: %w", err)
	}
	return &report, nil
}

// GetPendingApprovals implements Backend — GET /api/v1/imhotep/pending.
func (c *HubClient) GetPendingApprovals(ctx context.Context) ([]PendingChange, error) {
	var resp struct {
		Pending []PendingChange `json:"pending"`
	}
	if err := c.get(ctx, "/api/v1/imhotep/pending", &resp); err != nil {
		return nil, fmt.Errorf("hub pending approvals: %w", err)
	}
	return resp.Pending, nil
}

// StageChange implements Backend — POST /api/v1/imhotep/stage.
// Sends all commands in a single request; the Hub daemon signs and stages each one.
// Returns the StagingID slice (one ID per command).
// Callers MUST show a confirmation dialog before calling this.
func (c *HubClient) StageChange(ctx context.Context, controlID string, commands [][]string) ([]string, error) {
	body := map[string]any{
		"control_id": controlID,
		"commands":   commands,
	}
	var resp struct {
		StagingIDs []string `json:"staging_ids"`
	}
	if err := c.post(ctx, "/api/v1/imhotep/stage", body, &resp); err != nil {
		return nil, fmt.Errorf("hub stage change for %s: %w", controlID, err)
	}
	return resp.StagingIDs, nil
}

// Approve implements Backend — POST /api/v1/imhotep/approve/{id}.
// Callers MUST show a confirmation dialog before calling this.
func (c *HubClient) Approve(ctx context.Context, id string) error {
	if err := c.post(ctx, "/api/v1/imhotep/approve/"+id, nil, nil); err != nil {
		return fmt.Errorf("hub approve %s: %w", id, err)
	}
	return nil
}

// GetDAGHistory implements Backend — GET /api/v1/dag/history.
func (c *HubClient) GetDAGHistory(ctx context.Context) ([]DAGNode, error) {
	var resp struct {
		Nodes []DAGNode `json:"nodes"`
	}
	if err := c.get(ctx, "/api/v1/dag/history", &resp); err != nil {
		return nil, fmt.Errorf("hub dag history: %w", err)
	}
	return resp.Nodes, nil
}

// Ask implements Backend — POST /api/v1/mcp/ask.
func (c *HubClient) Ask(ctx context.Context, query string) (*AskResponse, error) {
	body := map[string]any{
		"query":     query,
		"max_tools": 10,
	}
	var resp AskResponse
	if err := c.post(ctx, "/api/v1/mcp/ask", body, &resp); err != nil {
		return nil, fmt.Errorf("hub ask: %w", err)
	}
	return &resp, nil
}

// NotifyScanDone implements Backend — no-op for HubClient; the Hub manages its own state.
func (c *HubClient) NotifyScanDone(_ *stig.ComprehensiveReport, _ int, _ string) {}

// StreamKASA implements Backend — opens an SSE stream to /api/v1/kasa/stream.
// Returns a channel of KASAEvents; the caller must cancel ctx to close.
func (c *HubClient) StreamKASA(ctx context.Context) (<-chan KASAEvent, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/api/v1/kasa/stream", nil)
	if err != nil {
		return nil, fmt.Errorf("hub kasa stream: build request: %w", err)
	}
	req.Header.Set("Accept", "text/event-stream")
	if err := c.signRequest(req, nil); err != nil {
		return nil, fmt.Errorf("hub kasa stream: sign: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("hub kasa stream: connect: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		return nil, fmt.Errorf("hub kasa stream: HTTP %d", resp.StatusCode)
	}

	ch := make(chan KASAEvent, 64)
	go func() {
		defer resp.Body.Close()
		defer close(ch)
		scanner := bufio.NewScanner(resp.Body)
		for scanner.Scan() {
			line := scanner.Text()
			if !strings.HasPrefix(line, "data: ") {
				continue
			}
			data := strings.TrimPrefix(line, "data: ")
			if data == "[DONE]" {
				return
			}
			var ev KASAEvent
			if err := json.Unmarshal([]byte(data), &ev); err != nil {
				continue
			}
			select {
			case ch <- ev:
			case <-ctx.Done():
				return
			}
		}
	}()
	return ch, nil
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

func (c *HubClient) post(ctx context.Context, path string, body, result any) error {
	var bodyBytes []byte
	if body != nil {
		var err error
		bodyBytes, err = json.Marshal(body)
		if err != nil {
			return fmt.Errorf("marshal request body: %w", err)
		}
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+path, bytes.NewReader(bodyBytes))
	if err != nil {
		return fmt.Errorf("build POST request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if err := c.signRequest(req, bodyBytes); err != nil {
		return err
	}
	return c.do(req, result)
}

func (c *HubClient) get(ctx context.Context, path string, result any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return fmt.Errorf("build GET request: %w", err)
	}
	if err := c.signRequest(req, nil); err != nil {
		return err
	}
	return c.do(req, result)
}

// signRequest attaches ML-DSA-65 authentication headers to the request.
//
// Signing payload = "METHOD /path\n" + bodyBytes
// This matches the Hub's L2 auth layer (transport_http.go).
func (c *HubClient) signRequest(req *http.Request, bodyBytes []byte) error {
	payload := []byte(req.Method + " " + req.URL.Path + "\n")
	payload = append(payload, bodyBytes...)
	sig, err := adinkra.Sign(c.privKey, payload)
	if err != nil {
		return fmt.Errorf("sign request: %w", err)
	}
	req.Header.Set("X-ASAF-Signature", fmt.Sprintf("%x", sig))
	req.Header.Set("X-ASAF-Agent", c.agentID)
	return nil
}

// ── Fleet connector methods ───────────────────────────────────────────────────

// AddAsset implements Backend — POST /api/v1/fleet/assets.
func (c *HubClient) AddAsset(ctx context.Context, r AddAssetRequest) (*Asset, error) {
	var asset Asset
	if err := c.post(ctx, "/api/v1/fleet/assets", r, &asset); err != nil {
		return nil, fmt.Errorf("hub add asset: %w", err)
	}
	return &asset, nil
}

// TestConnection implements Backend — POST /api/v1/fleet/assets/test.
func (c *HubClient) TestConnection(ctx context.Context, cfg ConnectorConfig, cred *ConnectorCred) (*TestResult, error) {
	body := map[string]any{"config": cfg, "credential": cred}
	var result TestResult
	if err := c.post(ctx, "/api/v1/fleet/assets/test", body, &result); err != nil {
		return nil, fmt.Errorf("hub test connection: %w", err)
	}
	return &result, nil
}

// ImportCSV implements Backend — POST /api/v1/fleet/assets/import.
func (c *HubClient) ImportCSV(ctx context.Context, rows []CSVAssetRow, enclaveID string) (*ImportResult, error) {
	body := map[string]any{"rows": rows, "enclave_id": enclaveID}
	var result ImportResult
	if err := c.post(ctx, "/api/v1/fleet/assets/import", body, &result); err != nil {
		return nil, fmt.Errorf("hub import csv: %w", err)
	}
	return &result, nil
}

// DiscoverSubnet implements Backend — SSE GET /api/v1/fleet/discover?cidr=...
func (c *HubClient) DiscoverSubnet(ctx context.Context, cidr string, opts DiscoveryOptions) (<-chan DiscoveredHost, error) {
	url := c.baseURL + "/api/v1/fleet/discover?cidr=" + cidr
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("hub discover: %w", err)
	}
	req.Header.Set("Accept", "text/event-stream")
	if err := c.signRequest(req, nil); err != nil {
		return nil, err
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("hub discover: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		return nil, fmt.Errorf("hub discover: HTTP %d", resp.StatusCode)
	}
	ch := make(chan DiscoveredHost, 64)
	go func() {
		defer resp.Body.Close()
		defer close(ch)
		scanner := bufio.NewScanner(resp.Body)
		for scanner.Scan() {
			line := scanner.Text()
			if !strings.HasPrefix(line, "data: ") {
				continue
			}
			var host DiscoveredHost
			if err := json.Unmarshal([]byte(strings.TrimPrefix(line, "data: ")), &host); err != nil {
				continue
			}
			select {
			case ch <- host:
			case <-ctx.Done():
				return
			}
		}
	}()
	return ch, nil
}

// GetConnectors implements Backend — GET /api/v1/fleet/connectors.
func (c *HubClient) GetConnectors(ctx context.Context) ([]ConnectorConfig, error) {
	var resp struct {
		Connectors []ConnectorConfig `json:"connectors"`
	}
	if err := c.get(ctx, "/api/v1/fleet/connectors", &resp); err != nil {
		return nil, fmt.Errorf("hub get connectors: %w", err)
	}
	return resp.Connectors, nil
}

// SaveConnector implements Backend — POST /api/v1/fleet/connectors.
func (c *HubClient) SaveConnector(ctx context.Context, cfg ConnectorConfig, cred *ConnectorCred) error {
	body := map[string]any{"config": cfg, "credential": cred}
	if err := c.post(ctx, "/api/v1/fleet/connectors", body, nil); err != nil {
		return fmt.Errorf("hub save connector: %w", err)
	}
	return nil
}

func (c *HubClient) do(req *http.Request, result any) error {
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("http: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		var errBody struct {
			Error string `json:"error"`
		}
		_ = json.NewDecoder(resp.Body).Decode(&errBody)
		if errBody.Error != "" {
			return fmt.Errorf("hub HTTP %d: %s", resp.StatusCode, errBody.Error)
		}
		return fmt.Errorf("hub HTTP %d", resp.StatusCode)
	}
	if result != nil {
		return json.NewDecoder(resp.Body).Decode(result)
	}
	return nil
}

func (c *HubClient) SetBoundary(ctx context.Context, cidrs []string) error {
	// For connected mode, boundary scoping is managed server-side by the Hub.
	// This could be wired to a POST /api/v1/fleet/boundary if the Hub supported dynamic updates.
	return nil
}
