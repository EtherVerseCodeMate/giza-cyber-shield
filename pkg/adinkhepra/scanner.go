package adinkhepra

import (
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/compliance"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/compliance/nist80171"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/compliance/nist80172"
	"github.com/google/uuid"
)

// Compile-time interface assertion.
var _ compliance.ScannerInterface = (*OSScanner)(nil)

// cacheEntry holds one ScanControl result with a TTL.
type cacheEntry struct {
	pass    bool
	message string
	err     error
	expiry  time.Time
}

// OSScanner implements compliance.ScannerInterface by executing real OS-state
// checks against all 110 NIST SP 800-171 Rev 2 controls and all 35 NIST SP 800-172
// enhanced controls. Results are cached for cacheTTL to avoid repeated syscalls
// during bulk compliance audits triggered by compliance.Engine.AutoRemediate().
type OSScanner struct {
	mu    sync.RWMutex
	cache map[string]cacheEntry
	ttl   time.Duration
}

const cacheTTL = 5 * time.Minute

// NewOSScanner returns an initialized OSScanner ready to serve ScannerInterface calls.
func NewOSScanner() *OSScanner {
	return &OSScanner{
		cache: make(map[string]cacheEntry, 145),
		ttl:   cacheTTL,
	}
}

// ScanControl checks whether controlID is passing on this host.
// controlID must be in NIST SP 800-171 format ("3.1.1") or SP 800-172 format ("3.1.1e").
// Results are cached for 5 minutes; call InvalidateCache() to force a fresh scan.
//
// Returns: (passing bool, detail string, error).
// detail uses the format "STATUS: finding text".
func (s *OSScanner) ScanControl(controlID string) (bool, string, error) {
	s.mu.RLock()
	if e, ok := s.cache[controlID]; ok && time.Now().Before(e.expiry) {
		s.mu.RUnlock()
		return e.pass, e.message, e.err
	}
	s.mu.RUnlock()

	// Cache miss: warm the entire catalog for the relevant spec (171 vs 172) so
	// subsequent per-control calls hit the cache — avoids N×ValidateAllFamilies().
	if strings.HasSuffix(controlID, "e") {
		s.warmCache172()
	} else {
		s.warmCache171()
	}

	s.mu.RLock()
	defer s.mu.RUnlock()
	if e, ok := s.cache[controlID]; ok {
		return e.pass, e.message, e.err
	}
	return false, fmt.Sprintf("control %s not found in CMMC catalog", controlID), nil
}

// RemediateControl queues or describes the remediation for controlID.
//
// Behavior by control type:
//   - MANUAL_ATTESTATION controls: returns (false, "MANUAL_REVIEW_REQUIRED: <evidence>", nil).
//     The SSP control stays FAILED_SCAN until a human uploads attestation evidence.
//   - Automatable controls: generates a staging job ID and returns
//     (false, "STAGING_PENDING:<jobID>", nil). The daemon (cmd/adinkhepra-daemon)
//     picks up the job after ML-DSA-65-signed human approval and executes the
//     command sequence from the remediation map. The SSP status transitions to
//     AUTO_REMEDIATED on success.
//
// Returns: (success bool, message string, error).
func (s *OSScanner) RemediateControl(controlID string) (bool, string, error) {
	entry, ok := remediationMap[controlID]
	if !ok {
		return false, fmt.Sprintf("no remediation entry for control %s", controlID), nil
	}
	if entry.CommandType == commandTypeManual {
		return false, "MANUAL_REVIEW_REQUIRED: " + entry.Evidence, nil
	}
	// Automatable: queue in staging. The daemon executes after human approval.
	jobID := uuid.New().String()
	return false, "STAGING_PENDING:" + jobID, nil
}

// InvalidateCache clears all cached scan results, forcing fresh OS checks on next call.
func (s *OSScanner) InvalidateCache() {
	s.mu.Lock()
	s.cache = make(map[string]cacheEntry, 145)
	s.mu.Unlock()
}

// ScanAll runs all 145 controls and returns a map of controlID → status string.
// This is the full-catalog equivalent of ScanControl — use for SSP bulk refresh.
func (s *OSScanner) ScanAll() map[string]string {
	s.warmCache171()
	s.warmCache172()
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make(map[string]string, len(s.cache))
	for id, e := range s.cache {
		status := "FAIL"
		if e.pass {
			status = "PASS"
		} else if strings.HasPrefix(e.message, "MANUAL_REVIEW") || strings.Contains(e.message, "MANUAL REVIEW") {
			status = "MANUAL_REVIEW"
		}
		out[id] = status
	}
	return out
}

// warmCache171 runs all 110 NIST 800-171 controls and populates the cache.
// Acquires a write lock internally; callers must NOT hold any lock.
func (s *OSScanner) warmCache171() {
	v := nist80171.NewValidator()
	results := v.ValidateAllFamilies()
	expiry := time.Now().Add(s.ttl)

	s.mu.Lock()
	defer s.mu.Unlock()
	for _, r := range results {
		s.cache[r.ControlID] = cacheEntry{
			pass:    r.Status == "PASS",
			message: r.Status + ": " + r.Finding,
			expiry:  expiry,
		}
	}
}

// warmCache172 runs all 35 NIST 800-172 enhanced controls and populates the cache.
func (s *OSScanner) warmCache172() {
	v := nist80172.NewEnhancedValidator()
	results := v.ValidateAllFamilies()
	expiry := time.Now().Add(s.ttl)

	s.mu.Lock()
	defer s.mu.Unlock()
	for _, r := range results {
		s.cache[r.ControlID] = cacheEntry{
			pass:    r.Status == "PASS",
			message: r.Status + ": " + r.Finding,
			expiry:  expiry,
		}
	}
}
