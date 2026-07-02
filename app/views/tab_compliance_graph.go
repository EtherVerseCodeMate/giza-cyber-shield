// Package views assembles the AdinKhepra ASAF desktop UI tabs.
//
// Tab 1 — Compliance Graph: force-directed CMMC compliance graph wired to live
// STIG scan data, with phase panel (left), node sidebar (right), and SPRS
// status bar (bottom).
//
// §10 rule: no Sephirot / Merkaba / Hypercube state names appear in this file
// outside of Go identifiers. All user-visible strings come from UILabel() or
// explicit CISO-facing text defined in this file.
package views

import (
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/canvas"
	"fyne.io/fyne/v2/container"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/app/models"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/app/widgets"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/stig"
)

// ComplianceGraphTab holds all state for Tab 1. Create with NewComplianceGraphTab,
// then call Content() to get the Fyne container to embed in AppTabs.
type ComplianceGraphTab struct {
	win         fyne.Window
	model       *models.ComplianceGraphModel
	graphCanvas *widgets.GraphCanvas
	sidebar     *widgets.NodeSidebar
	phasePanel  *widgets.PhasePanel
	statusBar   *widgets.StatusBar
	content     *fyne.Container
}

// NewComplianceGraphTab constructs Tab 1 and wires all inter-widget callbacks.
// win is the parent window used for file dialogs and error sheets.
func NewComplianceGraphTab(win fyne.Window) *ComplianceGraphTab {
	t := &ComplianceGraphTab{win: win}

	// Model — seeds governance root + 14 domain nodes + Tier 4 family baseline
	t.model = models.NewComplianceGraphModel()
	go t.model.LoadNotAssessedBaseline() // background: DB load + 397 node creation

	// Widgets
	t.graphCanvas = widgets.NewGraphCanvas(t.model)
	t.sidebar = widgets.NewNodeSidebar()
	t.phasePanel = widgets.NewPhasePanel(t.model.CurrentPhase)
	t.statusBar = widgets.NewStatusBar(
		t.model.SPRSScore,
		t.model.AssessmentTarget,
		"", // populated after first scan via SetCoverageNote
	)

	// Seed the live mapping count from the embedded DB (sync.Once, fast after first call).
	if db, err := stig.GetDatabase(); err == nil {
		t.statusBar.SetMappingCount(db.RowCount())
	}

	// Node tap → sidebar
	t.graphCanvas.OnNodeSelect = func(n *models.GraphNode) {
		t.sidebar.SetNode(n)
	}

	// Phase tap — no-op for Tab 1 (gate logic lives in a future Tab 2)
	t.phasePanel.OnPhaseSelect = func(phase int) {
		// Phase navigation is gated per §0.6; full implementation in Tab 2+.
		// For Tab 1 we only light up the active phase indicator.
	}

	// Scan Now
	t.phasePanel.OnScanNow = func() {
		t.runScan()
	}

	// Action button stubs — acknowledged, wired in Tab 3 (SSP) / Tab 5 (POA&M)
	t.sidebar.OnStageFixPressed = func(nodeID string) {
		// Stage Fix → Tab 6 (Remediation); surfaced here for discovery.
	}
	t.sidebar.OnOpenPOAMPressed = func(nodeID string) {
		// Open POA&M → Tab 5; surfaced here for discovery.
	}
	t.sidebar.OnViewInSSPPressed = func(nodeID string) {
		// View in SSP → Tab 3; surfaced here for discovery.
	}

	// Import Checklist — file picker for .ckl/.cklb/.json; additive (no pre-reset)
	t.phasePanel.OnImportChecklist = func() {
		db, _ := stig.GetDatabase()
		widgets.ShowImportChecklistDialog(t.win, t.model, db, func(_ string) {
			// Refresh graph and status bar after import (called from goroutine, safe in Fyne 2.x)
			t.statusBar.Update(t.model.SPRSScore, t.model.LastScanTime, false)
			t.graphCanvas.TriggerLayout()
			canvas.Refresh(t.graphCanvas)
		})
	}

	// Layout:  [PhasePanel | GraphCanvas | NodeSidebar]
	//          [         StatusBar                    ]
	t.content = container.NewBorder(
		nil,                             // top
		t.statusBar,                     // bottom
		t.phasePanel,                    // left
		t.sidebar,                       // right
		t.graphCanvas,                   // center (fills remaining space)
	)

	return t
}

// Content returns the assembled Fyne container for use in AppTabs.
func (t *ComplianceGraphTab) Content() fyne.CanvasObject {
	return t.content
}

// RunScan triggers a STIG baseline scan (Phase 4) in a background goroutine.
// The UI is updated progressively as findings arrive; the phase panel shows
// "Scanning…" during the run and reverts when the scan completes.
func (t *ComplianceGraphTab) runScan() {
	// Atomically set ScanRunning=true and CurrentPhase=4 under the write lock
	// to prevent the renderer from observing a torn intermediate state.
	t.model.SetScanStarted(4)
	t.phasePanel.SetPhase(4, true)
	t.statusBar.Update(t.model.SPRS(), t.model.ScanTime(), true)

	go func() {
		report := t.executeScan()
		t.ingestReport(report)

		// Finalize under the model's write lock (sets ScanRunning=false,
		// LastScanTime, LastScanHost atomically).
		var scanTime time.Time
		var hostname string
		if report != nil {
			scanTime = report.ScanDate
			hostname = report.Hostname
		}
		t.model.FinalizeScan(scanTime, hostname)

		// Read model fields through the lock-guarded getters before passing to
		// widgets.  canvas.Refresh and Fyne widget setters are goroutine-safe in
		// Fyne 2.x (they schedule redraws on the main goroutine internally).
		t.phasePanel.SetPhase(t.model.Phase(), false)
		t.statusBar.Update(t.model.SPRS(), t.model.ScanTime(), false)
		t.graphCanvas.TriggerLayout()
		canvas.Refresh(t.graphCanvas)
	}()
}

// executeScan runs the STIG validator against the local system.
// Returns nil on fatal error (error is already stored in the report's
// ExecutiveSummary so it surfaces in the evidence package).
func (t *ComplianceGraphTab) executeScan() *stig.ComprehensiveReport {
	v := stig.NewValidator("") // "" = local host
	report, err := v.Validate()
	if err != nil {
		// Non-fatal: partial results are still valid for SPRS scoring.
		// A nil report means the validator failed entirely (permission denied, etc.)
		return report
	}
	return report
}

// ingestReport walks every framework result and finding, resolves cross-references
// from the 25,185-mapping database, and calls model.AddFinding for each failed
// control. Asset nodes are seeded from the report hostname.
func (t *ComplianceGraphTab) ingestReport(report *stig.ComprehensiveReport) {
	if report == nil {
		return
	}

	// Reset existing findings so a re-scan starts clean
	t.model.ResetFindings()

	// Register the scanned host as an Asset node
	if report.Hostname != "" {
		t.model.AddAsset(report.Hostname, "", report.OSVersion)
	}

	// Load the cross-reference database (embedded CSV, loaded once via sync.Once)
	db, dbErr := stig.GetDatabase()

	for _, result := range report.Results {
		for _, f := range result.Findings {
			// Map stig.Finding.Status → models.FindingStatus
			status := mapFindingStatus(f.Status)

			// Resolve cross-references from the 25,185-mapping database.
			// Fall back to f.References (already populated by the validator) if DB load failed.
			refs := f.References
			if dbErr == nil && db != nil {
				if xrefs, err := db.GetCrossReferences(f.ID); err == nil && len(xrefs) > 0 {
					refs = xrefs
				}
			}

			domainCode := models.DomainCodeFromRefs(refs)
			practiceID := models.PracticeIDFromRefs(refs)

			t.model.AddFinding(models.FindingInput{
				ID:          f.ID,
				Title:       f.Title,
				Description: f.Description,
				SeverityRaw: string(f.Severity),
				Status:      status,
				DomainCode:  domainCode,
				PracticeID:  practiceID,
				Remediation: f.Remediation,
				References:  refs,
				CheckedAt:   f.CheckedAt,
			})
		}
	}
}

// mapFindingStatus converts stig.Finding.Status strings to models.FindingStatus.
func mapFindingStatus(s string) models.FindingStatus {
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
