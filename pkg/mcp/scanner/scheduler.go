package scanner

import (
	"context"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/acp"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/mcp"
)

// ScanEvent triggers an out-of-band scan cycle.
type ScanEvent struct {
	Reason string    // human-readable trigger description
	At     time.Time // when the event was generated
}

// Scheduler runs periodic and event-driven MCP threat scans.
//
// Usage:
//
//	events := make(chan scanner.ScanEvent, 8)
//	results := make(chan []scanner.MCPFinding, 4)
//	sch := scanner.NewScheduler(srv, acPlane, 5*time.Minute, events, results)
//	go sch.Run(ctx)
type Scheduler struct {
	scanner  *Scanner
	interval time.Duration
	events   <-chan ScanEvent
	results  chan<- []MCPFinding
}

// NewScheduler creates a Scheduler.
// interval is the fallback polling cadence.
// events may be nil for poll-only mode.
// results may be nil to discard findings (useful when lane_mcp.go pulls directly).
func NewScheduler(
	srv *mcp.Server,
	acPlane *acp.AgentControlPlane,
	interval time.Duration,
	events <-chan ScanEvent,
	results chan<- []MCPFinding,
) *Scheduler {
	return &Scheduler{
		scanner:  New(srv, acPlane),
		interval: interval,
		events:   events,
		results:  results,
	}
}

// Run starts the scheduler loop, blocking until ctx is cancelled.
// It captures a manifest baseline on startup before the first poll.
func (s *Scheduler) Run(ctx context.Context) {
	s.scanner.CaptureBaseline()

	ticker := time.NewTicker(s.interval)
	defer ticker.Stop()

	s.runScan(ctx, "startup")

	for {
		select {
		case <-ctx.Done():
			return
		case _, ok := <-s.events:
			if !ok {
				return
			}
			s.runScan(ctx, "event")
		case <-ticker.C:
			s.runScan(ctx, "periodic")
		}
	}
}

func (s *Scheduler) runScan(ctx context.Context, _ string) {
	findings, err := s.scanner.Scan(ctx)
	if err != nil || s.results == nil || len(findings) == 0 {
		return
	}
	select {
	case s.results <- findings:
	default: // non-blocking; drop if consumer is slow
	}
}
