package hub

import (
	"context"
	"fmt"
	"os"
	"sync"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/asaf/client"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/dag"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/g0dm0d3"
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
	daemonClient *client.Client     // nil if daemon not configured
	dagStore     dag.Store          // local DAG (pkg/dag.Memory unless caller provides persistent)
	aiProvider   g0dm0d3.AIProvider // nil if offline / not configured

	mu           sync.RWMutex
	lastSPRS     int
	lastReport   *stig.ComprehensiveReport
	lastScanHost string
	lastScanTime time.Time
}

// NewLocalBackend constructs a LocalBackend.
//
//   - daemonClient may be nil — Approve will return a clear "no daemon" error.
//   - dagStore may be nil — a new in-memory store is allocated automatically.
//   - aiProvider may be nil — Ask falls back to ErrNotConnected.
func NewLocalBackend(daemonClient *client.Client, dagStore dag.Store, aiProvider g0dm0d3.AIProvider) *LocalBackend {
	if dagStore == nil {
		dagStore = dag.NewMemory()
	}
	return &LocalBackend{
		daemonClient: daemonClient,
		dagStore:     dagStore,
		aiProvider:   aiProvider,
		lastSPRS:     110, // SPRS starts perfect; deducted as findings arrive
	}
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

// GetAssets implements Backend — returns the single localhost asset.
func (b *LocalBackend) GetAssets(_ context.Context, _ string) ([]Asset, error) {
	b.mu.RLock()
	sprs := b.lastSPRS
	host := b.lastScanHost
	t := b.lastScanTime
	b.mu.RUnlock()
	if host == "" {
		host = b.hostname()
	}
	return []Asset{
		{
			ID:          localAssetID,
			EnclaveID:   localEnclaveID,
			Hostname:    host,
			IPAddress:   "127.0.0.1",
			OS:          localOS(),
			STIGProfile: localSTIGProfile(),
			SPRSScore:   sprs,
			LastScan:    t,
			Online:      true,
		},
	}, nil
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

// Ask implements Backend — routes to local g0dm0d3 AI brain (Ollama → offline fallback).
func (b *LocalBackend) Ask(_ context.Context, query string) (*AskResponse, error) {
	if b.aiProvider == nil {
		return nil, ErrNotConnected
	}
	msgs := []g0dm0d3.Message{{Role: "user", Content: query}}
	answer, err := b.aiProvider.Chat(msgs, false)
	if err != nil {
		return nil, fmt.Errorf("local ask: %w", err)
	}
	return &AskResponse{Answer: answer}, nil
}

// StreamKASA implements Backend — publishes KASA-style events from the local
// Standalone scan state.  In Standalone mode the stream sends a single
// status event and then remains open until ctx is cancelled.
func (b *LocalBackend) StreamKASA(ctx context.Context) (<-chan KASAEvent, error) {
	ch := make(chan KASAEvent, 16)
	go func() {
		defer close(ch)
		host := b.hostname()
		select {
		case ch <- KASAEvent{
			Type:      "status",
			Message:   fmt.Sprintf("KASA Standalone — monitoring %s", host),
			Hostname:  host,
			Timestamp: time.Now(),
		}:
		case <-ctx.Done():
			return
		}
		// Pulse a heartbeat every 60 s so the UI feed stays live.
		ticker := time.NewTicker(60 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				b.mu.RLock()
				t := b.lastScanTime
				b.mu.RUnlock()
				msg := "Standalone mode — no KASA agent running"
				if !t.IsZero() {
					msg = fmt.Sprintf("Last scan: %s", t.Format("2006-01-02 15:04 UTC"))
				}
				select {
				case ch <- KASAEvent{Type: "heartbeat", Message: msg, Timestamp: time.Now()}:
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
	// runtime.GOOS is always available; enriched by the STIG scan later.
	switch os.Getenv("GOOS") {
	case "windows":
		return "Windows"
	case "linux":
		return "Linux"
	case "darwin":
		return "macOS"
	}
	return "Unknown"
}

// localSTIGProfile returns a best-guess STIG profile string for the localhost.
func localSTIGProfile() string {
	// Will be refined after the first scan.
	return "Auto-detected"
}
