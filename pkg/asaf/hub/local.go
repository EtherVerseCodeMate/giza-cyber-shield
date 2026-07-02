package hub

import (
	"context"
	"fmt"
	"os"
	"runtime"
	"sync"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/asaf/client"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/asaf/connector"
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

// GetAssets implements Backend — returns localhost + any enrolled assets.
func (b *LocalBackend) GetAssets(_ context.Context, enclaveID string) ([]Asset, error) {
	b.mu.RLock()
	sprs := b.lastSPRS
	host := b.lastScanHost
	t := b.lastScanTime
	enrolled := make([]Asset, len(b.enrolledAssets))
	copy(enrolled, b.enrolledAssets)
	b.mu.RUnlock()
	if host == "" {
		host = b.hostname()
	}

	localhost := Asset{
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

	result := []Asset{localhost}
	for _, a := range enrolled {
		if enclaveID == "" || a.EnclaveID == enclaveID {
			result = append(result, a)
		}
	}
	return result, nil
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
func (b *LocalBackend) Scan(ctx context.Context, assetID string) (*stig.ComprehensiveReport, error) {
	// assetID in standalone mode is ignored — we always scan localhost.
	_ = assetID
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}
	v := stig.NewValidator("")
	report, err := v.Validate()
	if err != nil && report == nil {
		return nil, fmt.Errorf("local scan: %w", err)
	}
	return report, err
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
func (b *LocalBackend) Ask(_ context.Context, query string) (*AskResponse, error) {
	if b.aiProvider == nil {
		// In Standalone mode with no Ollama: return actionable instructions.
		return &AskResponse{
			Answer: "[Standalone Mode — AI Not Configured]\n\n" +
				"To enable Ask AI in Standalone mode, start Ollama locally:\n" +
				"  ollama pull llama3.1:8b\n" +
				"  ollama run llama3.1:8b\n\n" +
				"Then go to Settings → AI Provider and click [Apply & Save].\n\n" +
				"Or connect to a Stargate Hub (Settings → Hub URL) for cloud-routed AI.\n\n" +
				"Your query was: " + query,
		}, nil
	}
	msgs := []AIMessage{{Role: "user", Content: query}}
	answer, err := b.aiProvider.Chat(msgs, false)
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
	// Will be refined after the first scan.
	return "Auto-detected"
}
