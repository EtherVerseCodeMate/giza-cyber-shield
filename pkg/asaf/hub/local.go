package hub

import (
	"context"
	"fmt"
	"os"
	"runtime"
	"net"
	"sync"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/asaf/client"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/asaf/connector"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/asaf/daemon"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/asaf/policy"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/dag"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/stig"
)


// compile-time interface check
var _ Backend = (*LocalBackend)(nil)

const (
	localEnclaveID = "local"
	localAssetID   = "local-host"
	appVersion     = "1.1.1"
)

// LocalBackend implements Backend for ModeStandalone.
//
// All operations run in-process or via the local Imhotep daemon Unix socket.
// No network egress occurs.  Sovereign air-gap compliant.
type LocalBackend struct {
	daemonClient *client.Client             // nil if daemon not configured
	dagStore     dag.Store                  // local DAG (pkg/dag.Memory unless caller provides persistent)
	aiProvider   AIProviderBridge           // nil if offline / not configured
	registry     *connector.ConnectorRegistry // nil if agent key not loaded yet
	ebg          *policy.EgressBoundaryGuard // enforces target confinement before dial

	mu              sync.RWMutex
	lastSPRS        int
	lastReport      *stig.ComprehensiveReport
	lastScanHost    string
	lastScanTime    time.Time
	enrolledAssets  []Asset // in-memory fleet enrolled via wizard
}

// NewLocalBackend constructs a LocalBackend.
//
//   - daemonClient may be nil — Approve will return a clear "no daemon" error.
//   - dagStore may be nil — a new in-memory store is allocated automatically.
//   - aiProvider may be nil — Ask returns actionable Ollama setup instructions.
func NewLocalBackend(daemonClient *client.Client, dagStore dag.Store, aiProvider AIProviderBridge) *LocalBackend {
	if dagStore == nil {
		dagStore = dag.NewMemory()
	}
	return &LocalBackend{
		daemonClient: daemonClient,
		dagStore:     dagStore,
		aiProvider:   aiProvider,
		ebg:          policy.NewEgressBoundaryGuard([]string{"10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"}, dagStore, nil, nil, nil, "local-desktop", nil),
		lastSPRS:     110,
	}
}

// SetRegistry wires the ConnectorRegistry (called from main after agent key is loaded).
func (b *LocalBackend) SetRegistry(reg *connector.ConnectorRegistry) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.registry = reg
}

// SetLastScan lets the Compliance Graph tab push updated state after a scan.
func (b *LocalBackend) SetLastScan(report *stig.ComprehensiveReport, sprs int, host string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.lastReport = report
	b.lastSPRS = sprs
	b.lastScanHost = host
	b.lastScanTime = time.Now()
}

// NotifyScanDone implements Backend — stores the completed scan result so that
// Readiness Gate, SSP, POA&M, and the KASA feed all see consistent post-scan data.
func (b *LocalBackend) NotifyScanDone(report *stig.ComprehensiveReport, sprsScore int, hostname string) {
	b.SetLastScan(report, sprsScore, hostname)
}

// Mode implements Backend.
func (b *LocalBackend) Mode() AppMode { return ModeStandalone }

// HubURL implements Backend — always "" in standalone mode.
func (b *LocalBackend) HubURL() string { return "" }

// Ping implements Backend — returns local version info with no network call.
func (b *LocalBackend) Ping(_ context.Context) (*HealthResponse, error) {
	dagNodes := b.dagStore.All()
	return &HealthResponse{
		Status:       "ok",
		Version:      appVersion,
		EnclaveCount: 1,
		AssetCount:   1,
		DAGNodeCount: len(dagNodes),
	}, nil
}

// GetEnclaves implements Backend — returns the single local enclave.
func (b *LocalBackend) GetEnclaves(_ context.Context) ([]Enclave, error) {
	b.mu.RLock()
	sprs := b.lastSPRS
	b.mu.RUnlock()
	return []Enclave{
		{
			ID:         localEnclaveID,
			Name:       "Local Enclave",
			AssetCount: 1,
			SPRSScore:  sprs,
			CreatedAt:  time.Now(),
			UpdatedAt:  time.Now(),
		},
	}, nil
}

// GetAssets implements Backend — returns localhost asset plus any assets enrolled
// during this session via AddAsset or ImportCSV.
func (b *LocalBackend) GetAssets(_ context.Context, _ string) ([]Asset, error) {
	b.mu.RLock()
	sprs := b.lastSPRS
	host := b.lastScanHost
	t := b.lastScanTime
	b.mu.RUnlock()
	if host == "" {
		host = b.hostname()
	}
	local := Asset{
		ID:          localAssetID,
		EnclaveID:   localEnclaveID,
		Hostname:    host,
		IPAddress:   "127.0.0.1",
		OS:          localOS(),
		STIGProfile: localSTIGProfile(),
		SPRSScore:   sprs,
		LastScan:    t,
		Online:      true,
	}
	b.mu.RLock()
	enrolled := make([]Asset, len(b.enrolledAssets))
	copy(enrolled, b.enrolledAssets)
	b.mu.RUnlock()

	assets := make([]Asset, 0, 1+len(enrolled))
	assets = append(assets, local)
	assets = append(assets, enrolled...)
	return assets, nil
}

// GetSPRS implements Backend — returns computed SPRS from last scan.
func (b *LocalBackend) GetSPRS(_ context.Context, _ string) (*SPRSResult, error) {
	b.mu.RLock()
	sprs := b.lastSPRS
	t := b.lastScanTime
	report := b.lastReport
	b.mu.RUnlock()

	result := &SPRSResult{
		EnclaveID:    localEnclaveID,
		Score:        sprs,
		ComputedAt:   t,
		DomainScores: make(map[string]float64),
	}
	if report != nil {
		for _, r := range report.Results {
			for _, f := range r.Findings {
				if f.Status == "Fail" {
					result.FailingCount++
				} else if f.Status == "Pass" {
					result.PassingCount++
				}
			}
		}
	}
	return result, nil
}

// Scan implements Backend — runs a STIG baseline scan in-process.
// v.Validate() is run in a goroutine so the caller's context deadline
// (set to 5 minutes in executeScan) is honoured and can cancel the scan
// if any subprocess hangs (e.g. auditpol, manage-bde, PowerShell on AV-intercepted hosts).
func (b *LocalBackend) Scan(ctx context.Context, assetID string) (*stig.ComprehensiveReport, error) {
	_ = assetID
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	type scanResult struct {
		report *stig.ComprehensiveReport
		err    error
	}
	ch := make(chan scanResult, 1)
	go func() {
		v := stig.NewValidator("")
		report, err := v.Validate()
		ch <- scanResult{report, err}
	}()

	select {
	case <-ctx.Done():
		return nil, fmt.Errorf("local scan: %w", ctx.Err())
	case r := <-ch:
		if r.err != nil && r.report == nil {
			return nil, fmt.Errorf("local scan: %w", r.err)
		}
		return r.report, r.err
	}
}

// GetPendingApprovals implements Backend — queries local Imhotep daemon staging queue.
// Returns an empty list (not an error) if no daemon is configured.
func (b *LocalBackend) GetPendingApprovals(_ context.Context) ([]PendingChange, error) {
	if b.daemonClient == nil {
		return nil, nil
	}
	// The daemon's staging queue is not directly enumerable via the client API;
	// pending jobs are surfaced through the Stage Fix workflow.  Return empty.
	return nil, nil
}

// StageChange implements Backend — submits one signed ChangeRequest per command
// to the local Imhotep daemon with Staging=true. Each command runs in an isolated
// container so no production state is affected until a CISO calls Approve.
// Returns the StagingID slice (one ID per command), or an error on first failure.
func (b *LocalBackend) StageChange(ctx context.Context, controlID string, commands [][]string) ([]string, error) {
	if b.daemonClient == nil {
		return nil, fmt.Errorf("hub: Imhotep daemon not configured — is asaf-daemon running?")
	}
	stagingIDs := make([]string, 0, len(commands))
	for _, argv := range commands {
		if len(argv) == 0 {
			continue
		}
		symbol := daemon.RequiredSymbol(argv)
		if symbol == "" {
			return stagingIDs, fmt.Errorf("hub: command %q is not in the authorized daemon catalog", argv[0])
		}
		result, err := b.daemonClient.Submit(ctx, controlID, symbol, argv, "", true, false)
		if err != nil {
			return stagingIDs, fmt.Errorf("hub: stage command %v for %s: %w", argv, controlID, err)
		}
		if result.Error != "" {
			return stagingIDs, fmt.Errorf("hub: daemon rejected command %v: %s", argv, result.Error)
		}
		if result.StagingID != "" {
			stagingIDs = append(stagingIDs, result.StagingID)
		}
	}
	return stagingIDs, nil
}

// Approve implements Backend — approves a staged job on the local daemon.
func (b *LocalBackend) Approve(ctx context.Context, id string) error {
	if b.daemonClient == nil {
		return fmt.Errorf("hub: Imhotep daemon not configured — is asaf-daemon running?")
	}
	result, err := b.daemonClient.Poll(ctx, id)
	if err != nil {
		return fmt.Errorf("hub: approve job %s: %w", id, err)
	}
	if result.Error != "" {
		return fmt.Errorf("hub: approve job %s: %s", id, result.Error)
	}
	return nil
}

// GetDAGHistory implements Backend — reads the local DAG store.
func (b *LocalBackend) GetDAGHistory(_ context.Context) ([]DAGNode, error) {
	nodes := b.dagStore.All()
	out := make([]DAGNode, 0, len(nodes))
	for _, n := range nodes {
		out = append(out, DAGNode{
			ID:        n.ID,
			Parents:   n.Parents,
			Action:    n.Action,
			Symbol:    n.Symbol,
			Time:      n.Time,
			PQC:       n.PQC,
			Hash:      n.Hash,
			Signature: n.Signature,
		})
	}
	return out, nil
}

// Ask implements Backend — routes to local AI provider (Ollama → offline fallback).
// ctx is honoured: the caller's deadline (e.g. 30s from tab_ssp.go) propagates
// to the Ollama HTTP request so the UI isn't blocked past the context deadline.
func (b *LocalBackend) Ask(ctx context.Context, query string) (*AskResponse, error) {
	if b.aiProvider == nil {
		return &AskResponse{
			Answer: "[Standalone Mode — AI Not Configured]\n\n" +
				"To enable Ask AI in Standalone mode, start Ollama locally:\n" +
				"  ollama serve\n" +
				"  ollama pull gemma3:4b\n\n" +
				"Then go to Settings → AI Provider and click [Apply & Save].\n\n" +
				"Or connect to a Stargate Hub (Settings → Hub URL) for cloud-routed AI.\n\n" +
				"Your query was: " + query,
		}, nil
	}
	msgs := []AIMessage{{Role: "user", Content: query}}
	answer, err := b.aiProvider.ChatCtx(ctx, msgs, false)
	if err != nil {
		return nil, fmt.Errorf("local ask: %w", err)
	}
	return &AskResponse{Answer: answer}, nil
}


// StreamKASA implements Backend — publishes KASA-style events from the local
// Standalone scan state. Sends initial status then heartbeats every 60s.
//
// In Standalone mode, KASA runs as a lightweight local monitor rather than
// the full agentic loop (which requires Hub + Ollama). The heartbeat message
// reflects the actual local scan state so the UI shows meaningful information.
func (b *LocalBackend) StreamKASA(ctx context.Context) (<-chan KASAEvent, error) {
	ch := make(chan KASAEvent, 16)
	go func() {
		defer close(ch)
		host := b.hostname()

		// Initial status event — describe standalone posture honestly.
		b.mu.RLock()
		lastScan := b.lastScanTime
		b.mu.RUnlock()

		initMsg := fmt.Sprintf("KASA Standalone — local monitor active on %s", host)
		if !lastScan.IsZero() {
			initMsg = fmt.Sprintf("KASA Standalone — %s | Last scan: %s",
				host, lastScan.Format("15:04:05 UTC"))
		}
		select {
		case ch <- KASAEvent{
			Type:      "status",
			Message:   initMsg,
			Hostname:  host,
			Timestamp: time.Now(),
		}:
		case <-ctx.Done():
			return
		}

		// Heartbeat every 60s — reflects real scan state.
		ticker := time.NewTicker(60 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				b.mu.RLock()
				t := b.lastScanTime
				sprs := b.lastSPRS
				b.mu.RUnlock()

				var msg string
				if t.IsZero() {
					// No scan yet — guide user to take action.
					msg = fmt.Sprintf(
						"Standalone — no scan yet. Click [Compliance Graph → Scan] to assess %s.", host)
				} else {
					msg = fmt.Sprintf(
						"Standalone | %s | SPRS %d/110 | Last: %s",
						host, sprs, t.Format("15:04:05 UTC"))
				}
				select {
				case ch <- KASAEvent{
					Type:      "heartbeat",
					Message:   msg,
					Hostname:  host,
					Timestamp: time.Now(),
				}:
				case <-ctx.Done():
					return
				}
			case <-ctx.Done():
				return
			}
		}
	}()
	return ch, nil
}

// ── helpers ───────────────────────────────────────────────────────────────────

func (b *LocalBackend) hostname() string {
	b.mu.RLock()
	h := b.lastScanHost
	b.mu.RUnlock()
	if h != "" {
		return h
	}
	h, err := os.Hostname()
	if err != nil {
		return "localhost"
	}
	return h
}

// localOS returns a human-readable OS name for the localhost asset record.
func localOS() string {
	// Use runtime.GOOS (compile-time constant) — not the GOOS env var.
	switch runtime.GOOS {
	case "windows":
		return "Windows"
	case "linux":
		return "Linux"
	case "darwin":
		return "macOS"
	}
	return runtime.GOOS
}

// localSTIGProfile returns a best-guess STIG profile string for the localhost.
func localSTIGProfile() string {
	return "Auto-detected"
}

// ── Fleet connector methods ───────────────────────────────────────────────────

// AddAsset implements Backend — enrolls a new asset into the in-memory fleet.
func (b *LocalBackend) AddAsset(_ context.Context, req AddAssetRequest) (*Asset, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	// Deduplicate by IP
	for _, a := range b.enrolledAssets {
		if a.IPAddress == req.IPAddress {
			return &a, nil
		}
	}
	a := Asset{
		ID:          req.EnclaveID + "-" + req.IPAddress,
		EnclaveID:   req.EnclaveID,
		Hostname:    req.Hostname,
		IPAddress:   req.IPAddress,
		OS:          req.OS,
		STIGProfile: req.STIGProfile,
		SPRSScore:   110,
		Online:      true,
	}
	if a.EnclaveID == "" {
		a.EnclaveID = localEnclaveID
	}
	b.enrolledAssets = append(b.enrolledAssets, a)
	return &a, nil
}

// TestConnection implements Backend — dispatches to the correct connector.
func (b *LocalBackend) TestConnection(ctx context.Context, cfg ConnectorConfig, cred *ConnectorCred) (*TestResult, error) {
	if b.ebg != nil {
		hostToCheck := cfg.Host
		if cfg.Protocol == connector.ProtoNmap {
			hostToCheck = cfg.CIDRRange // rudimentary check for Nmap Mode A
			if ip, _, err := net.ParseCIDR(hostToCheck); err == nil {
				hostToCheck = ip.String()
			}
		}
		if err := b.ebg.CheckTarget(ctx, hostToCheck); err != nil {
			return &TestResult{Success: false, Message: "Egress Blocked: " + err.Error()}, nil
		}
	}

	var c connector.Connector
	switch cfg.Protocol {
	case connector.ProtoSSH:
		c = connector.NewSSHConnector(cfg, cred)
	case connector.ProtoWinRM:
		c = connector.NewWinRMConnector(cfg, cred)
	case connector.ProtoNmap:
		c = connector.NewSubnetConnector(cfg, connector.DiscoveryOptions{})
	default:
		return &TestResult{
			Success: false,
			Message: "unsupported protocol: " + string(cfg.Protocol),
		}, nil
	}
	return c.Test(ctx)
}

// ImportCSV implements Backend — bulk-enrolls assets from parsed CSV rows.
func (b *LocalBackend) ImportCSV(ctx context.Context, rows []CSVAssetRow, enclaveID string) (*ImportResult, error) {
	result := &ImportResult{Total: len(rows)}
	for _, row := range rows {
		if row.IPAddress == "" && row.Hostname == "" {
			result.Errors = append(result.Errors, "row missing hostname and IP — skipped")
			result.Skipped++
			continue
		}
		enclave := enclaveID
		if enclave == "" {
			enclave = localEnclaveID
		}
		_, err := b.AddAsset(ctx, AddAssetRequest{
			EnclaveID:   enclave,
			Hostname:    row.Hostname,
			IPAddress:   row.IPAddress,
			OS:          row.OS,
			STIGProfile: row.STIGProfile,
		})
		if err != nil {
			result.Errors = append(result.Errors, row.Hostname+": "+err.Error())
			result.Skipped++
		} else {
			result.Enrolled++
		}
	}
	return result, nil
}

// DiscoverSubnet implements Backend — runs subnet discovery via SubnetConnector.
func (b *LocalBackend) DiscoverSubnet(ctx context.Context, cidr string, opts DiscoveryOptions) (<-chan DiscoveredHost, error) {
	if b.ebg != nil {
		ip, _, err := net.ParseCIDR(cidr)
		if err == nil {
			if err := b.ebg.CheckTarget(ctx, ip.String()); err != nil {
				return nil, fmt.Errorf("egress blocked: %w", err)
			}
		}
	}

	cfg := connector.ConnectorConfig{
		CIDRRange: cidr,
		EnclaveID: localEnclaveID,
		Protocol:  connector.ProtoNmap,
	}
	dopts := connector.DiscoveryOptions{
		Ports:           opts.Ports,
		ConcurrentHosts: opts.MaxHosts,
		DialTimeout:     opts.Timeout,
	}
	sc := connector.NewSubnetConnector(cfg, dopts)
	return sc.Discover(ctx)
}

// GetConnectors implements Backend — returns saved connector configs from registry.
func (b *LocalBackend) GetConnectors(_ context.Context) ([]ConnectorConfig, error) {
	b.mu.RLock()
	reg := b.registry
	b.mu.RUnlock()
	if reg == nil {
		return nil, nil
	}
	return reg.ListConfigs(), nil
}

// SaveConnector implements Backend — persists a connector config (with optional credential).
func (b *LocalBackend) SaveConnector(_ context.Context, cfg ConnectorConfig, cred *ConnectorCred) error {
	b.mu.RLock()
	reg := b.registry
	b.mu.RUnlock()
	if reg == nil {
		return fmt.Errorf("connector registry not initialised — agent key not loaded yet")
	}
	return reg.Save(cfg, cred)
}
