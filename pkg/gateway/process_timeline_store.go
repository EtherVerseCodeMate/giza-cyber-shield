package gateway

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/supabase"
)

// ProcessTimelineFilter specifies query filters for process behavior events.
type ProcessTimelineFilter struct {
	// Limit caps the number of events returned (default: 100).
	Limit int
	// ComplianceStatus filters by status values, e.g. ["VIOLATION", "PENDING"].
	ComplianceStatus []string
	// TimeSince restricts results to events after this time (zero = no lower bound).
	TimeSince time.Time
}

// ProcessTimelineStore is the interface for querying the process_behavior_events table.
type ProcessTimelineStore interface {
	// QueryBySTIGControl returns process events mapped to the given STIG control ID.
	QueryBySTIGControl(ctx context.Context, stigControl string, filter ProcessTimelineFilter) ([]ProcessBehaviorEvent, error)
}

// ─── Supabase implementation ───────────────────────────────────────────────────

// SupabaseProcessTimelineStore queries the process_behavior_events table via
// the Supabase PostgREST API.
type SupabaseProcessTimelineStore struct {
	client *supabase.Client
}

// NewSupabaseProcessTimelineStore creates a timeline store backed by Supabase.
func NewSupabaseProcessTimelineStore(cfg supabase.Config) *SupabaseProcessTimelineStore {
	return &SupabaseProcessTimelineStore{
		client: supabase.NewClient(cfg),
	}
}

// QueryBySTIGControl fetches process_behavior_events rows whose stig_control
// column equals stigControl and that match the supplied filter.
func (s *SupabaseProcessTimelineStore) QueryBySTIGControl(ctx context.Context, stigControl string, filter ProcessTimelineFilter) ([]ProcessBehaviorEvent, error) {
	limit := filter.Limit
	if limit <= 0 {
		limit = 100
	}

	// Build a PostgREST filter string.
	// Base: exact match on stig_control
	query := fmt.Sprintf("stig_control=eq.%s&limit=%d&order=timestamp.desc", stigControl, limit)

	// Optional: lower-bound timestamp
	if !filter.TimeSince.IsZero() {
		query += fmt.Sprintf("&timestamp=gte.%s", filter.TimeSince.UTC().Format(time.RFC3339))
	}

	// Optional: compliance_status IN (...)
	if len(filter.ComplianceStatus) == 1 {
		query += fmt.Sprintf("&compliance_status=eq.%s", filter.ComplianceStatus[0])
	} else if len(filter.ComplianceStatus) > 1 {
		// PostgREST syntax: compliance_status=in.(VIOLATION,PENDING)
		joined := ""
		for i, s := range filter.ComplianceStatus {
			if i > 0 {
				joined += ","
			}
			joined += s
		}
		query += fmt.Sprintf("&compliance_status=in.(%s)", joined)
	}

	body, err := s.client.Select(ctx, "process_behavior_events", query, "*")
	if err != nil {
		return nil, fmt.Errorf("process_behavior_events query: %w", err)
	}

	var events []ProcessBehaviorEvent
	if err := json.Unmarshal(body, &events); err != nil {
		return nil, fmt.Errorf("unmarshal process_behavior_events: %w", err)
	}

	return events, nil
}
