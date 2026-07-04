// Package widgets — PhasePanel: the left phase selector for the Compliance Graph tab.
//
// Renders the §0.6 eight-phase CMMC journey as a vertical list.
// Phases that have not met their gate condition are shown as disabled.
// The [Scan Now] button in Phase 4 (BASELINE) is the primary action for Tab 1.
package widgets

import (
	"fmt"
	"image/color"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/canvas"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/widget"

	asaftheme "github.com/EtherVerseCodeMate/giza-cyber-shield/app/theme"
)

// phaseDef describes one entry in the §0.6 CMMC journey state machine.
type phaseDef struct {
	number int
	code   string // short mnemonic (e.g. "SCOPE", "BASELINE")
	label  string // full CISO-facing label
}

// phases is the canonical §0.6 eight-phase ordered list.
// Order and labels are fixed by the CMMC Quran v2 spec.
var phases = []phaseDef{
	{1, "SCOPE", "Define Boundary"},
	{2, "DISCOVER", "Asset Inventory"},
	{3, "SSP", "Security Plan"},
	{4, "BASELINE", "Compliance Scan"},
	{5, "POAM", "Plan of Action"},
	{6, "REMEDIATE", "Fix Gaps"},
	{7, "READINESS", "Pre-Assessment Gate"},
	{8, "EVIDENCE", "C3PAO Package"},
}

// PhasePanel is the left-side phase navigation panel for the Compliance Graph.
//
// Callbacks:
//
//	OnPhaseSelect(phase int) — called when the user taps a phase row (1-based)
//	OnScanNow()             — called when [Scan Now] is tapped
type PhasePanel struct {
	widget.BaseWidget

	inner *fyne.Container
	scroll *container.Scroll

	currentPhase int // 1–8, or 0 for pre-scope
	scanRunning  bool

	OnPhaseSelect     func(phase int)
	OnScanNow         func()
	OnImportChecklist func()
}

// NewPhasePanel constructs the panel. currentPhase is the §0.6 phase the model
// is currently in (0 = pre-scope, 1–8 = active phase).
func NewPhasePanel(currentPhase int) *PhasePanel {
	p := &PhasePanel{currentPhase: currentPhase}
	p.inner = container.NewVBox()
	p.scroll = container.NewVScroll(p.inner)
	p.ExtendBaseWidget(p)
	p.rebuild()
	return p
}

func (p *PhasePanel) CreateRenderer() fyne.WidgetRenderer {
	// Semi-opaque card background so the panel contrasts against the graph canvas.
	bg := canvas.NewRectangle(asaftheme.PanelBG)
	bg.CornerRadius = 6
	return widget.NewSimpleRenderer(container.NewStack(bg, p.scroll))
}

func (p *PhasePanel) MinSize() fyne.Size {
	return fyne.NewSize(168, 120)
}

// SetPhase updates the highlighted phase and whether the scan button shows
// a running spinner. Rebuilds the inner content.
func (p *PhasePanel) SetPhase(phase int, scanRunning bool) {
	p.currentPhase = phase
	p.scanRunning = scanRunning
	p.rebuild()
}

// ── build ─────────────────────────────────────────────────────────────────────

func (p *PhasePanel) rebuild() {
	var objs []fyne.CanvasObject

	// Panel title
	title := canvas.NewText("CMMC Journey", asaftheme.AKGold)
	title.TextStyle = fyne.TextStyle{Bold: true}
	title.TextSize = 13
	objs = append(objs, title, widget.NewSeparator())

	// Phase rows
	for _, ph := range phases {
		objs = append(objs, p.buildPhaseRow(ph))
	}

	objs = append(objs, widget.NewSeparator())
	objs = append(objs, p.buildScanButton())
	objs = append(objs, p.buildImportButton())

	p.inner.Objects = objs
	p.inner.Refresh()
}

// buildPhaseRow renders one numbered phase entry.
// Active phase: NXBlue label + AKGold number.
// Locked phase (phase > currentPhase+1): TextMuted, no tap.
// Completed phase (phase < currentPhase): green check prefix.
func (p *PhasePanel) buildPhaseRow(ph phaseDef) fyne.CanvasObject {
	active := ph.number == p.currentPhase
	completed := ph.number < p.currentPhase
	// Gate rule: only the active phase and completed phases are navigable.
	// The next phase is shown but not tappable until gate is met.
	locked := ph.number > p.currentPhase

	numColor := phaseNumColor(active, completed, locked)
	labelColor := phaseLabelColor(active, completed, locked)

	prefix := fmt.Sprintf("%d", ph.number)
	if completed {
		prefix = "✓"
	}

	num := canvas.NewText(prefix, numColor)
	num.TextStyle = fyne.TextStyle{Bold: true}
	num.TextSize = 12

	code := canvas.NewText(ph.code, numColor)
	code.TextSize = 10

	lbl := canvas.NewText(ph.label, labelColor)
	lbl.TextSize = 12

	left := container.NewVBox(num, code)
	row := container.NewBorder(nil, nil, left, nil, lbl)

	if active {
		// Active phase: highlighted background strip
		bg := canvas.NewRectangle(asaftheme.NXNavyMid)
		bg.CornerRadius = 3
		highlighted := container.NewStack(bg, container.NewPadded(row))
		return highlighted
	}

	if !locked {
		// Completed phases are tappable
		phNum := ph.number
		tap := widget.NewButton("", func() {
			if p.OnPhaseSelect != nil {
				p.OnPhaseSelect(phNum)
			}
		})
		// transparent button background, overlay the custom row layout
		tap.Importance = widget.LowImportance
		return container.NewStack(container.NewPadded(row), tap)
	}

	return container.NewPadded(row)
}

// buildImportButton returns the [Import Checklist] button.
// Always enabled — import is available at any phase so assessors can load .ckl/.cklb/.json
// files without first running a live scan.
func (p *PhasePanel) buildImportButton() fyne.CanvasObject {
	btn := widget.NewButton("Import Checklist", func() {
		if p.OnImportChecklist != nil {
			p.OnImportChecklist()
		}
	})
	btn.Importance = widget.MediumImportance
	return container.NewPadded(btn)
}

// buildScanButton returns the [Scan Now] button for Phase 4 (BASELINE).
// Shows "Scanning…" with low importance when scanRunning is true.
func (p *PhasePanel) buildScanButton() fyne.CanvasObject {
	var btn *widget.Button
	if p.scanRunning {
		btn = widget.NewButton("Scanning…", nil)
		btn.Importance = widget.LowImportance
		btn.Disable()
	} else {
		btn = widget.NewButton("Scan Now", func() {
			if p.OnScanNow != nil {
				p.OnScanNow()
			}
		})
		btn.Importance = widget.HighImportance
	}
	return container.NewPadded(btn)
}

// ── color helpers ─────────────────────────────────────────────────────────────

func phaseNumColor(active, completed, locked bool) color.Color {
	switch {
	case active:
		return asaftheme.AKGold
	case completed:
		return asaftheme.NodeGreen
	default:
		return asaftheme.TextMuted
	}
}

func phaseLabelColor(active, completed, locked bool) color.Color {
	switch {
	case active:
		return asaftheme.TextPrimary
	case completed:
		return asaftheme.TextMuted
	default:
		// Locked phases: muted but readable against the card background.
		return color.NRGBA{R: 0x44, G: 0x5f, B: 0x7a, A: 0xff}
	}
}
