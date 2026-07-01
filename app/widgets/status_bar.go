// Package widgets — StatusBar: the bottom strip for the Compliance Graph tab.
//
// Displays (left→right):
//   - SPRS score chip with readiness band label
//   - Days-to-assessment countdown
//   - Coverage disclaimer for active scan frameworks
//   - Mapping count ("25,185 control mappings loaded")
//   - Scan timestamp
//
// The 25,185 count is the canonical de-duplicated mapping count from the
// embedded CSV database (pkg/stig/data/*.csv). Never display 36,195 (raw sum).
package widgets

import (
	"fmt"
	"image/color"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/canvas"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/widget"

	asaftheme "github.com/EtherVerseCodeMate/giza-cyber-shield/app/theme"
)

const canonicalMappingCount = 25_185

// StatusBar is the single-row footer strip at the bottom of the Compliance Graph.
// Call Update to refresh all displayed values without rebuilding the widget tree.
type StatusBar struct {
	widget.BaseWidget

	// Displayed state
	sprsScore        int
	assessmentTarget time.Time
	lastScanTime     time.Time
	scanRunning      bool
	coverageNote     string // e.g. "9 of 291+ RHEL-09 STIG controls"

	// Canvas objects updated in place (no full rebuild on each tick)
	sprsChip      *canvas.Text
	sprsLabel     *canvas.Text
	sprsRect      *canvas.Rectangle
	daysText      *canvas.Text
	coverageText  *canvas.Text
	scanTimeText  *canvas.Text
	mappingText   *canvas.Text

	root *fyne.Container
}

// NewStatusBar creates the status bar with its initial values.
//
//   - sprsScore:        initial SPRS value (typically 110 before first scan)
//   - assessmentTarget: deadline date; zero disables the countdown
//   - coverageNote:     framework coverage disclaimer (e.g. "9 of 291+ RHEL-09 STIG controls")
func NewStatusBar(sprsScore int, assessmentTarget time.Time, coverageNote string) *StatusBar {
	s := &StatusBar{
		sprsScore:        sprsScore,
		assessmentTarget: assessmentTarget,
		coverageNote:     coverageNote,
	}
	s.allocObjects()
	s.sync()
	s.ExtendBaseWidget(s)
	return s
}

func (s *StatusBar) CreateRenderer() fyne.WidgetRenderer {
	return widget.NewSimpleRenderer(s.root)
}

func (s *StatusBar) MinSize() fyne.Size {
	return fyne.NewSize(400, 32)
}

// Update refreshes the status bar with new values. Safe to call from any goroutine
// (all mutations are canvas-object field assignments, which Fyne renders thread-safely).
func (s *StatusBar) Update(sprsScore int, lastScan time.Time, scanRunning bool) {
	s.sprsScore = sprsScore
	s.lastScanTime = lastScan
	s.scanRunning = scanRunning
	s.sync()
	s.root.Refresh()
}

// SetCoverageNote replaces the framework coverage disclaimer text.
func (s *StatusBar) SetCoverageNote(note string) {
	s.coverageNote = note
	s.sync()
	s.root.Refresh()
}

// SetAssessmentTarget updates the assessment deadline used for the countdown.
func (s *StatusBar) SetAssessmentTarget(t time.Time) {
	s.assessmentTarget = t
	s.sync()
	s.root.Refresh()
}

// ── internal ──────────────────────────────────────────────────────────────────

func (s *StatusBar) allocObjects() {
	// SPRS chip background
	s.sprsRect = canvas.NewRectangle(sprsChipColor(s.sprsScore))
	s.sprsRect.CornerRadius = 4

	// SPRS score number
	s.sprsChip = canvas.NewText("", color.White)
	s.sprsChip.TextStyle = fyne.TextStyle{Bold: true}
	s.sprsChip.TextSize = 13

	// Readiness band label (e.g. "Adequate", "At Risk")
	s.sprsLabel = canvas.NewText("", asaftheme.TextMuted)
	s.sprsLabel.TextSize = 11

	// Days-to-assessment countdown
	s.daysText = canvas.NewText("", asaftheme.TextMuted)
	s.daysText.TextSize = 11

	// Framework coverage disclaimer (required per spec §4 / Phase 4 error states)
	s.coverageText = canvas.NewText("", asaftheme.TextMuted)
	s.coverageText.TextSize = 11

	// Scan timestamp
	s.scanTimeText = canvas.NewText("", asaftheme.TextMuted)
	s.scanTimeText.TextSize = 11

	// Canonical mapping count (always shown)
	s.mappingText = canvas.NewText(
		fmt.Sprintf("%d control mappings loaded", canonicalMappingCount),
		asaftheme.NXBlue,
	)
	s.mappingText.TextSize = 11

	// SPRS chip = rect (background) stacked with score text
	chipStack := container.NewStack(
		container.NewPadded(s.sprsRect),
		container.NewCenter(s.sprsChip),
	)

	s.root = container.NewHBox(
		chipStack,
		s.sprsLabel,
		widget.NewSeparator(),
		s.daysText,
		widget.NewSeparator(),
		s.coverageText,
		widget.NewSeparator(),
		s.mappingText,
		widget.NewSeparator(),
		s.scanTimeText,
	)
}

func (s *StatusBar) sync() {
	// SPRS chip
	s.sprsChip.Text = fmt.Sprintf("SPRS %d", s.sprsScore)
	s.sprsRect.FillColor = sprsChipColor(s.sprsScore)
	s.sprsLabel.Text = sprsReadinessBand(s.sprsScore)

	// Days countdown
	s.daysText.Text = daysCountdown(s.assessmentTarget)

	// Coverage disclaimer
	if s.coverageNote != "" {
		s.coverageText.Text = "Coverage: " + s.coverageNote
	} else {
		s.coverageText.Text = ""
	}

	// Scan timestamp
	if s.scanRunning {
		s.scanTimeText.Text = "Scanning…"
	} else if !s.lastScanTime.IsZero() {
		s.scanTimeText.Text = "Last scan: " + s.lastScanTime.UTC().Format("2006-01-02 15:04 UTC")
	} else {
		s.scanTimeText.Text = "No scan yet"
	}
}

// ── helpers ───────────────────────────────────────────────────────────────────

// sprsChipColor returns the background color for the SPRS score chip.
// Thresholds align with DoD SPRS risk bands per CMMC Quran §0.5.
func sprsChipColor(score int) color.Color {
	switch {
	case score >= 88:
		return asaftheme.NodeGreen // Adequate
	case score >= 60:
		return asaftheme.NodeOrange // At Risk
	default:
		return asaftheme.NodeRed // Critical Risk
	}
}

// sprsReadinessBand returns the human-readable SPRS band label.
func sprsReadinessBand(score int) string {
	switch {
	case score == 110:
		return "Perfect"
	case score >= 88:
		return "Adequate"
	case score >= 60:
		return "At Risk"
	case score >= 0:
		return "Critical Risk"
	default:
		return "Non-Compliant"
	}
}

// daysCountdown returns a human-readable countdown to the assessment target.
func daysCountdown(target time.Time) string {
	if target.IsZero() {
		return "No assessment date set"
	}
	days := int(time.Until(target).Hours() / 24)
	switch {
	case days < 0:
		return fmt.Sprintf("Assessment overdue by %d days", -days)
	case days == 0:
		return "Assessment: TODAY"
	case days == 1:
		return "Assessment: 1 day"
	default:
		return fmt.Sprintf("Assessment: %d days", days)
	}
}
