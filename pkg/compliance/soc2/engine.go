package soc2

import (
	"encoding/json"
	"fmt"
	"os"
	"time"
)

// Engine is the top-level SOC 2 audit-preparation orchestrator.
// It coordinates the assessment, evidence collection, and report generation.
type Engine struct {
	Assessment *AssessmentEngine
	Evidence   *EvidenceCollector
}

// NewEngine returns a ready-to-use SOC 2 engine.
func NewEngine(systemName, scopeNote string) *Engine {
	return &Engine{
		Assessment: NewAssessmentEngine(systemName, scopeNote),
		Evidence:   NewEvidenceCollector(),
	}
}

// LoadImplementations reads a JSON file of ControlImplementation records
// (map[criterionID]ControlImplementation) and loads them into the engine.
func (e *Engine) LoadImplementations(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("read implementations file: %w", err)
	}
	var impls map[string]ControlImplementation
	if err := json.Unmarshal(data, &impls); err != nil {
		return fmt.Errorf("parse implementations file: %w", err)
	}
	e.Assessment.BulkSet(impls)
	return nil
}

// SaveReport serialises the readiness report to disk as JSON.
func (e *Engine) SaveReport(path string) error {
	report := e.Assessment.Assess()
	data, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o600)
}

// PrintReport runs the assessment and writes a human-readable summary to stdout.
func (e *Engine) PrintReport() {
	report := e.Assessment.Assess()
	fmt.Print(report.PrintText())
}

// CriterionSummary returns a quick status table for all criteria.
func (e *Engine) CriterionSummary() []CriterionStatus {
	var out []CriterionStatus
	for _, c := range Catalog {
		status := StatusNotImplemented
		if impl, ok := e.Assessment.implementations[c.ID]; ok {
			status = impl.Status
		}
		out = append(out, CriterionStatus{
			ID:     c.ID,
			Family: c.Family,
			Title:  c.Title,
			Status: status,
		})
	}
	return out
}

// CriterionStatus is a lightweight summary of a single criterion's state.
type CriterionStatus struct {
	ID     string               `json:"id"`
	Family CriteriaFamily       `json:"family"`
	Title  string               `json:"title"`
	Status ImplementationStatus `json:"status"`
}

// SeedFromNISTMapping auto-populates implementations from an existing NIST
// 800-53 control status map. Any TSC criterion whose NIST controls are all
// marked "IMPLEMENTED" is marked IMPLEMENTED; if any are "PARTIAL" it becomes
// PARTIAL; otherwise it remains NOT_IMPLEMENTED.
func (e *Engine) SeedFromNISTMapping(nistStatus map[string]string) {
	for _, c := range Catalog {
		if len(c.NISTMapping) == 0 {
			continue
		}
		allImpl := true
		anyPartial := false
		for _, nid := range c.NISTMapping {
			s := nistStatus[nid]
			if s != "IMPLEMENTED" {
				allImpl = false
			}
			if s == "PARTIAL" {
				anyPartial = true
			}
		}
		var status ImplementationStatus
		switch {
		case allImpl:
			status = StatusImplemented
		case anyPartial:
			status = StatusPartial
		default:
			status = StatusNotImplemented
		}
		if _, exists := e.Assessment.implementations[c.ID]; !exists {
			e.Assessment.SetImplementation(ControlImplementation{
				CriterionID:  c.ID,
				Status:       status,
				Narrative:    fmt.Sprintf("Auto-seeded from NIST 800-53 mapping: %v", c.NISTMapping),
				LastReviewed: time.Now().UTC(),
			})
		}
	}
}
