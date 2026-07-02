// Package widgets — ShowImportChecklistDialog: file-picker for STIG checklist import.
//
// Accepts .ckl (STIG Viewer XML), .cklb (STIG Viewer 2.x JSON), and .json (OSCAL AR).
// Format is auto-detected by extension first, then by first-byte sniffing for unrecognised
// extensions.  Import is additive: does NOT reset existing findings so multiple checklists
// can be stacked before re-scanning.
package widgets

import (
	"bytes"
	"fmt"
	"io"
	"path/filepath"
	"strings"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/dialog"
	"fyne.io/fyne/v2/storage"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/app/models"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/stig"
)

// ShowImportChecklistDialog opens a native file picker for STIG checklist import.
// The dialog accepts .ckl, .cklb, and .json (OSCAL AR) files.  Parsing runs in a
// background goroutine; on success the model is mutated and onImported is called with
// a human-readable per-family summary string.  onImported is called from the goroutine
// (not the UI thread) — callers must marshal any Fyne widget updates via canvas.Refresh
// or equivalent.
func ShowImportChecklistDialog(parent fyne.Window, model *models.ComplianceGraphModel, db *stig.ComplianceDatabase, onImported func(summary string)) {
	fd := dialog.NewFileOpen(func(reader fyne.URIReadCloser, err error) {
		if err != nil || reader == nil {
			return
		}
		defer reader.Close()

		name := reader.URI().Name()
		ext := strings.ToLower(filepath.Ext(name))

		data, ioErr := io.ReadAll(reader)
		if ioErr != nil {
			dialog.ShowError(fmt.Errorf("read %s: %w", name, ioErr), parent)
			return
		}

		go func() {
			summary, parseErr := ingestChecklistBytes(name, ext, data, model, db)
			if parseErr != nil {
				dialog.ShowError(parseErr, parent)
				return
			}
			dialog.ShowInformation("Import Complete", summary, parent)
			if onImported != nil {
				onImported(summary)
			}
		}()
	}, parent)

	fd.SetFilter(storage.NewExtensionFileFilter([]string{".ckl", ".cklb", ".json"}))
	fd.Resize(fyne.NewSize(680, 480))
	fd.Show()
}

// ingestChecklistBytes dispatches to the correct parser based on file extension,
// falls back to first-byte sniffing for unrecognised extensions, then ingests
// all parsed findings into the model.  Returns a human-readable import summary.
func ingestChecklistBytes(filename, ext string, data []byte, m *models.ComplianceGraphModel, db *stig.ComplianceDatabase) (string, error) {
	switch ext {
	case ".ckl":
		results, err := stig.ParseCKLBytes(data)
		if err != nil {
			return "", fmt.Errorf("parse .ckl %q: %w", filename, err)
		}
		return ingestCKLResults(results, m, db), nil

	case ".cklb":
		results, err := stig.ParseCKLBBytes(data)
		if err != nil {
			return "", fmt.Errorf("parse .cklb %q: %w", filename, err)
		}
		return ingestCKLBResults(results, m, db), nil

	case ".json":
		// OSCAL AR JSON; if parsing fails try .cklb (also JSON)
		oscal, oscalErr := stig.ParseOSCALBytes(data)
		if oscalErr == nil && len(oscal) > 0 {
			return ingestOSCALResults(oscal, m, db), nil
		}
		results, err := stig.ParseCKLBBytes(data)
		if err != nil {
			if oscalErr != nil {
				return "", fmt.Errorf("parse JSON %q: not valid OSCAL (%v) or .cklb (%w)", filename, oscalErr, err)
			}
			return "", fmt.Errorf("parse .cklb JSON %q: %w", filename, err)
		}
		return ingestCKLBResults(results, m, db), nil

	default:
		// Sniff first bytes: '<' → XML/CKL, '{' → JSON
		trimmed := bytes.TrimSpace(data)
		if len(trimmed) == 0 {
			return "", fmt.Errorf("file %q is empty", filename)
		}
		if trimmed[0] == '<' {
			results, err := stig.ParseCKLBytes(data)
			if err != nil {
				return "", fmt.Errorf("auto-detect as .ckl %q: %w", filename, err)
			}
			return ingestCKLResults(results, m, db), nil
		}
		if trimmed[0] == '{' {
			if results, err := stig.ParseOSCALBytes(data); err == nil && len(results) > 0 {
				return ingestOSCALResults(results, m, db), nil
			}
			results, err := stig.ParseCKLBBytes(data)
			if err != nil {
				return "", fmt.Errorf("auto-detect as .cklb %q: %w", filename, err)
			}
			return ingestCKLBResults(results, m, db), nil
		}
		return "", fmt.Errorf("unsupported file format: %q (expected .ckl, .cklb, or OSCAL .json)", filename)
	}
}

// ingestCKLResults converts CKL parser output to graph findings.
func ingestCKLResults(results []stig.CKLImportResult, m *models.ComplianceGraphModel, db *stig.ComplianceDatabase) string {
	total, failed := 0, 0
	families := make([]string, 0, len(results))

	for _, r := range results {
		families = append(families, r.STIGTitle)
		if r.Hostname != "" {
			m.AddAsset(r.Hostname, r.HostIP, "")
		}
		for _, f := range r.Findings {
			total++
			status := mapImportFindingStatus(f.Status)
			if status == models.StatusNotMet {
				failed++
			}
			refs := resolveRefs(f.ID, f.References, db)
			m.AddFinding(models.FindingInput{
				ID:          f.ID,
				Title:       f.Title,
				Description: f.Description,
				SeverityRaw: string(f.Severity),
				Status:      status,
				DomainCode:  models.DomainCodeFromRefs(refs),
				PracticeID:  models.PracticeIDFromRefs(refs),
				Remediation: f.Remediation,
				References:  refs,
				CheckedAt:   f.CheckedAt,
			})
		}
	}

	return buildSummary(".ckl", families, total, failed)
}

// ingestCKLBResults converts CKLB parser output to graph findings.
func ingestCKLBResults(results []stig.CKLBImportResult, m *models.ComplianceGraphModel, db *stig.ComplianceDatabase) string {
	total, failed := 0, 0
	families := make([]string, 0, len(results))

	for _, r := range results {
		families = append(families, r.STIGTitle)
		if r.Hostname != "" {
			m.AddAsset(r.Hostname, r.HostIP, "")
		}
		for _, f := range r.Findings {
			total++
			status := mapImportFindingStatus(f.Status)
			if status == models.StatusNotMet {
				failed++
			}
			refs := resolveRefs(f.ID, f.References, db)
			m.AddFinding(models.FindingInput{
				ID:          f.ID,
				Title:       f.Title,
				Description: f.Description,
				SeverityRaw: string(f.Severity),
				Status:      status,
				DomainCode:  models.DomainCodeFromRefs(refs),
				PracticeID:  models.PracticeIDFromRefs(refs),
				Remediation: f.Remediation,
				References:  refs,
				CheckedAt:   f.CheckedAt,
			})
		}
	}

	return buildSummary(".cklb", families, total, failed)
}

// ingestOSCALResults converts OSCAL AR parser output to graph findings.
func ingestOSCALResults(results []stig.OSCALImportResult, m *models.ComplianceGraphModel, db *stig.ComplianceDatabase) string {
	total, failed := 0, 0
	families := make([]string, 0, len(results))

	for _, r := range results {
		families = append(families, r.Title)
		for _, f := range r.Findings {
			total++
			status := mapImportFindingStatus(f.Status)
			if status == models.StatusNotMet {
				failed++
			}
			refs := resolveRefs(f.ID, f.References, db)
			m.AddFinding(models.FindingInput{
				ID:          f.ID,
				Title:       f.Title,
				Description: f.Description,
				SeverityRaw: string(f.Severity),
				Status:      status,
				DomainCode:  models.DomainCodeFromRefs(refs),
				PracticeID:  models.PracticeIDFromRefs(refs),
				Remediation: f.Remediation,
				References:  refs,
				CheckedAt:   f.CheckedAt,
			})
		}
	}

	return buildSummary("OSCAL", families, total, failed)
}

// resolveRefs enriches a finding's cross-references from the 25,185-mapping DB.
// Falls back to the parser-supplied refs if the DB is unavailable.
func resolveRefs(ruleID string, parserRefs []string, db *stig.ComplianceDatabase) []string {
	if db == nil {
		return parserRefs
	}
	xrefs, err := db.GetCrossReferences(ruleID)
	if err != nil || len(xrefs) == 0 {
		return parserRefs
	}
	return xrefs
}

// mapImportFindingStatus converts stig.Finding.Status strings to models.FindingStatus.
func mapImportFindingStatus(s string) models.FindingStatus {
	switch s {
	case "Pass":
		return models.StatusMet
	case "Fail":
		return models.StatusNotMet
	case "Not Applicable":
		return models.StatusNotApplicable
	default:
		return models.StatusNotReviewed
	}
}

// buildSummary returns a human-readable import result string.
func buildSummary(format string, families []string, total, failed int) string {
	passed := total - failed
	famList := strings.Join(uniqueStrings(families), ", ")
	if len(famList) > 120 {
		famList = famList[:117] + "…"
	}
	return fmt.Sprintf(
		"Format: %s\nBenchmarks: %s\n\n%d findings imported — %d failed, %d passed",
		format, famList, total, failed, passed,
	)
}

// uniqueStrings returns a deduplicated copy of ss preserving order.
func uniqueStrings(ss []string) []string {
	seen := make(map[string]bool, len(ss))
	out := make([]string, 0, len(ss))
	for _, s := range ss {
		if !seen[s] {
			seen[s] = true
			out = append(out, s)
		}
	}
	return out
}
