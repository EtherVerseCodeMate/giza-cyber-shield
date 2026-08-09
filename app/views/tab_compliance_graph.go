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
	"context"
	"fmt"
	"strings"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/canvas"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/dialog"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/app/models"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/app/widgets"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/asaf/hub"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/stig"
)

// ComplianceGraphTab holds all state for Tab 1. Create with NewComplianceGraphTab,
// then call Content() to get the Fyne container to embed in AppTabs.
type ComplianceGraphTab struct {
	win         fyne.Window
	backend     hub.Backend
	model       *models.ComplianceGraphModel
	graphCanvas *widgets.GraphCanvas
	sidebar     *widgets.NodeSidebar
	phasePanel  *widgets.PhasePanel
	statusBar   *widgets.StatusBar
	content     *fyne.Container

	// OnSwitchTab is set by showMainWindow to switch the active AppTabs item.
	// tabIndex follows the tab order in showMainWindow (0=Compliance, 2=SSP, 3=POA&M, …).
	OnSwitchTab func(tabIndex int)

	// OnScanDone is called after every scan completes (success or partial).
	// showMainWindow wires this to ReadinessTab.Refresh() so the Readiness Gate,
	// KASA feed, and domain heatmap all update automatically without manual refresh.
	OnScanDone func()
}

// NewComplianceGraphTab constructs Tab 1 and wires all inter-widget callbacks.
// win is the parent window used for file dialogs and error sheets.
// backend provides the compliance data source (local or Hub).
func NewComplianceGraphTab(win fyne.Window, backend hub.Backend) *ComplianceGraphTab {
	t := &ComplianceGraphTab{win: win, backend: backend}

	// Model — seeds governance root + 14 domain nodes.
	t.model = models.NewComplianceGraphModel()

	// Widgets — must be created before the baseline goroutine so TriggerLayout is safe.
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

	// Load Tier 4 STIG family aggregate nodes in the background (DB parse + ~400 nodes).
	// TriggerLayout fires once complete so physics lays out the new nodes immediately.
	go func() {
		t.model.LoadNotAssessedBaseline()
		t.graphCanvas.TriggerLayout()
	}()

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

	// [Stage Fix] — look up the finding by nodeID, show a confirmation dialog,
	// then submit signed ChangeRequests to the Imhotep daemon for staging.
	// §13: human-in-the-loop gate; production execution requires separate Approve call.
	t.sidebar.OnStageFixPressed = func(nodeID string) {
		// Acquire read lock to safely read node fields.
		t.model.RLock()
		node := t.model.NodeByID(nodeID)
		if node == nil {
			t.model.RUnlock()
			return
		}
		findingID := node.FindingID
		fixArgv := node.FixArgv
		label := node.Label
		t.model.RUnlock()

		if len(fixArgv) == 0 {
			dialog.ShowInformation("Manual Remediation Required",
				fmt.Sprintf("Finding %s (%s) has no automated fix.\n\n"+
					"See the Remediation guidance in the sidebar or the DISA STIG benchmark.", findingID, label),
				t.win)
			return
		}

		// Build a human-readable command summary for the confirmation dialog.
		cmdLines := make([]string, len(fixArgv))
		for i, argv := range fixArgv {
			cmdLines[i] = "  " + strings.Join(argv, " ")
		}
		confirmMsg := fmt.Sprintf(
			"Stage fix for finding:\n  %s\n  %s\n\nCommands to stage (container sandbox — no production effect):\n%s\n\n"+
				"CISO approval will be required before production execution.\n\nProceed?",
			findingID, label, strings.Join(cmdLines, "\n"))

		dialog.ShowConfirm("Stage Fix — Confirmation Required", confirmMsg, func(ok bool) {
			if !ok {
				return
			}
			go func() {
				ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
				defer cancel()
				stagingIDs, err := t.backend.StageChange(ctx, findingID, fixArgv)
				fyne.Do(func() {
					if err != nil {
						dialog.ShowError(fmt.Errorf("Stage fix failed for %s:\n%w", findingID, err), t.win)
						return
					}
					var idList string
					if len(stagingIDs) > 0 {
						idList = "\n\nStaging ID(s):\n  " + strings.Join(stagingIDs, "\n  ")
					}
					dialog.ShowInformation("Fix Staged Successfully",
						fmt.Sprintf("Fix for %s is queued in the staging container.%s\n\n"+
							"Open the Remediation tab to review results and approve for production.", findingID, idList),
						t.win)
				})
			}()
		}, t.win)
	}
	t.sidebar.OnOpenPOAMPressed = func(nodeID string) {
		if t.OnSwitchTab != nil {
			t.OnSwitchTab(3) // POA&M is index 3 in showMainWindow tab order
		}
	}
	t.sidebar.OnViewInSSPPressed = func(nodeID string) {
		if t.OnSwitchTab != nil {
			t.OnSwitchTab(2) // SSP is index 2 in showMainWindow tab order
		}
	}

	// Import Checklist — file picker for .ckl/.cklb/.json; additive (no pre-reset)
	t.phasePanel.OnImportChecklist = func() {
		db, _ := stig.GetDatabase()
		widgets.ShowImportChecklistDialog(t.win, t.model, db, func(_ string) {
			// onImported fires from a goroutine inside the dialog — marshal to UI thread.
			fyne.Do(func() {
				t.statusBar.Update(t.model.SPRS(), t.model.ScanTime(), false)
				t.graphCanvas.TriggerLayout()
				canvas.Refresh(t.graphCanvas)
			})
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
		// executeScan is slow (network I/O, up to 5 min) — stays off UI thread.
		report := t.executeScan()

		// All model mutations and renderer refreshes run on the Fyne UI thread so
		// the graph canvas renderer (also UI thread) never races with writes.
		// ingestReport + FinalizeScan + TriggerLayout are all microsecond-scale;
		// blocking the UI thread briefly here is correct and safe.
		fyne.Do(func() {
			t.ingestReport(report)

			var scanTime time.Time
			var hostname string
			if report != nil {
				scanTime = report.ScanDate
				hostname = report.Hostname
			}
			t.model.FinalizeScan(scanTime, hostname)

			// Push result back to the backend so Readiness Gate, SSP, POA&M,
			// and the KASA feed all read the same post-scan state.
			t.backend.NotifyScanDone(report, t.model.SPRS(), hostname)

			t.phasePanel.SetPhase(t.model.Phase(), false)
			t.statusBar.Update(t.model.SPRS(), t.model.ScanTime(), false)
			t.graphCanvas.TriggerLayout()
			canvas.Refresh(t.graphCanvas)

			// Notify other tabs that scan data is now available in the backend.
			if t.OnScanDone != nil {
				go t.OnScanDone()
			}
		})
	}()
}

// executeScan runs a STIG scan via the Backend (local or Hub depending on mode).
// Returns nil on fatal error (partial results are valid for SPRS scoring).
func (t *ComplianceGraphTab) executeScan() *stig.ComprehensiveReport {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	report, err := t.backend.Scan(ctx, "")
	if err != nil && report == nil {
		return nil
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
				ID:                 f.ID,
				Title:              f.Title,
				Description:        f.Description,
				SeverityRaw:        string(f.Severity),
				Status:             status,
				DomainCode:         domainCode,
				PracticeID:         practiceID,
				SPRSPracticeWeight: models.PracticeWeightFromID(practiceID),
				Remediation:        f.Remediation,
				References:         refs,
				CheckedAt:          f.CheckedAt,
				FixArgv:            stig.GetFixArgv(f.ID),
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
