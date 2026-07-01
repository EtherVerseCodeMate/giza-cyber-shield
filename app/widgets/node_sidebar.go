// Package widgets — NodeSidebar: the 288-px right panel for the Compliance Graph tab.
//
// §10 rule: all user-facing strings use §10 labels (n.Kind.UILabel(), "Finding",
// "Domain", etc.). No Sephirot / Merkaba / Hypercube vocabulary ever appears here.
package widgets

import (
	"fmt"
	"strings"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/canvas"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/widget"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/app/models"
	asaftheme "github.com/EtherVerseCodeMate/giza-cyber-shield/app/theme"
)

const nodeSidebarWidth float32 = 288

// NodeSidebar is the 288-px detail panel on the right of the Compliance Graph.
// Call SetNode to populate it; pass nil to show the idle placeholder.
//
// Callbacks (all optional — wire up in the tab view):
//
//	OnStageFixPressed   — called with the node ID when [Stage Fix] is tapped
//	OnOpenPOAMPressed   — called with the node ID when [Open POA&M] is tapped
//	OnViewInSSPPressed  — called with the node ID when [View in SSP] is tapped
type NodeSidebar struct {
	widget.BaseWidget

	inner   *fyne.Container
	scroll  *container.Scroll

	OnStageFixPressed  func(nodeID string)
	OnOpenPOAMPressed  func(nodeID string)
	OnViewInSSPPressed func(nodeID string)

	current *models.GraphNode
}

// NewNodeSidebar returns an idle NodeSidebar ready to be placed in a layout.
func NewNodeSidebar() *NodeSidebar {
	s := &NodeSidebar{}
	s.inner = container.NewVBox(sidebarIdle()...)
	s.scroll = container.NewVScroll(s.inner)
	s.ExtendBaseWidget(s)
	return s
}

func (s *NodeSidebar) CreateRenderer() fyne.WidgetRenderer {
	return widget.NewSimpleRenderer(s.scroll)
}

func (s *NodeSidebar) MinSize() fyne.Size {
	return fyne.NewSize(nodeSidebarWidth, 120)
}

// SetNode replaces all sidebar content with details for node n.
// Pass nil to restore the idle placeholder.
func (s *NodeSidebar) SetNode(n *models.GraphNode) {
	s.current = n
	var objs []fyne.CanvasObject
	if n == nil {
		objs = sidebarIdle()
	} else {
		objs = s.buildNodeObjects(n)
	}
	s.inner.Objects = objs
	s.inner.Refresh()
}

// ── idle placeholder ─────────────────────────────────────────────────────────

func sidebarIdle() []fyne.CanvasObject {
	hint := canvas.NewText("Select a node to inspect", asaftheme.TextMuted)
	hint.TextSize = 12
	hint.Alignment = fyne.TextAlignCenter
	return []fyne.CanvasObject{widget.NewSeparator(), hint}
}

// ── node dispatch ─────────────────────────────────────────────────────────────

func (s *NodeSidebar) buildNodeObjects(n *models.GraphNode) []fyne.CanvasObject {
	objs := []fyne.CanvasObject{
		s.buildHeader(n),
		widget.NewSeparator(),
	}
	switch n.Kind {
	case models.NodeTiphereth: // §10: "Finding"
		objs = append(objs, s.buildFindingDetail(n)...)
	case models.NodeChokmah: // §10: "Domain"
		objs = append(objs, buildDomainDetail(n)...)
	case models.NodeBinah: // §10: "Practice"
		objs = append(objs, buildPracticeDetail(n)...)
	case models.NodeChesed: // §10: "Asset"
		objs = append(objs, buildAssetDetail(n)...)
	case models.NodeKeter: // §10: "Governance Root"
		objs = append(objs, buildRootDetail()...)
	default:
		objs = append(objs, buildGenericDetail(n)...)
	}
	return objs
}

// ── header ───────────────────────────────────────────────────────────────────

func (s *NodeSidebar) buildHeader(n *models.GraphNode) fyne.CanvasObject {
	badge := canvas.NewText(n.Kind.UILabel(), glLabelColor(n))
	badge.TextStyle = fyne.TextStyle{Bold: true}
	badge.TextSize = 11

	label := canvas.NewText(n.Label, asaftheme.TextPrimary)
	label.TextStyle = fyne.TextStyle{Bold: true}
	label.TextSize = 14

	return container.NewVBox(badge, label)
}

// ── finding detail ────────────────────────────────────────────────────────────

func (s *NodeSidebar) buildFindingDetail(n *models.GraphNode) []fyne.CanvasObject {
	var objs []fyne.CanvasObject

	// Severity + SPRS deduction
	if n.SeverityRaw != "" {
		c := glLabelColor(n)
		sev := canvas.NewText(fmt.Sprintf("Severity: %s   SPRS: −%d", n.SeverityRaw, n.SPRSWeight), c)
		sev.TextStyle = fyne.TextStyle{Bold: true}
		sev.TextSize = 12
		objs = append(objs, sev)
	}

	// STIG Finding ID
	if n.FindingID != "" {
		fid := canvas.NewText("Finding: "+n.FindingID, asaftheme.TextMuted)
		fid.TextStyle = fyne.TextStyle{Monospace: true}
		fid.TextSize = 11
		objs = append(objs, fid)
	}

	// CMMC Practice
	if n.PracticeID != "" {
		pid := canvas.NewText("Practice: "+n.PracticeID, asaftheme.SBCyan)
		pid.TextStyle = fyne.TextStyle{Monospace: true}
		pid.TextSize = 12
		objs = append(objs, pid)
	}

	// Status
	statusColor := asaftheme.NodeGreen
	statusLabel := string(n.Status)
	if n.Status == models.StatusNotMet {
		statusColor = asaftheme.NodeRed
		statusLabel = "NOT MET"
	} else if n.Status == models.StatusMet {
		statusLabel = "MET"
	}
	st := canvas.NewText("Status: "+statusLabel, statusColor)
	st.TextSize = 12
	objs = append(objs, st)

	objs = append(objs, widget.NewSeparator())

	// Description
	if n.Description != "" {
		head := muted("Description")
		desc := widget.NewLabel(n.Description)
		desc.Wrapping = fyne.TextWrapWord
		objs = append(objs, head, desc)
	}

	// Remediation
	if n.Remediation != "" {
		head := muted("Remediation")
		rem := widget.NewLabel(n.Remediation)
		rem.Wrapping = fyne.TextWrapWord
		objs = append(objs, widget.NewSeparator(), head, rem)
	}

	// Cross-references
	if len(n.References) > 0 {
		objs = append(objs, widget.NewSeparator())
		objs = append(objs, muted("Cross-References"))
		for _, ref := range n.References {
			r := canvas.NewText("  "+ref, asaftheme.AKGold)
			r.TextStyle = fyne.TextStyle{Monospace: true}
			r.TextSize = 11
			objs = append(objs, r)
		}
	}

	// Scan timestamp
	if !n.CheckedAt.IsZero() {
		ts := canvas.NewText("Scanned: "+n.CheckedAt.UTC().Format("2006-01-02 15:04 UTC"), asaftheme.TextMuted)
		ts.TextSize = 10
		objs = append(objs, ts)
	}

	// APDL snippet
	objs = append(objs, widget.NewSeparator())
	objs = append(objs, muted("APDL Protocol Snippet  (§9)"))
	apdl := widget.NewLabel(buildAPDLSnippet(n))
	apdl.Wrapping = fyne.TextWrapOff
	apdl.TextStyle = fyne.TextStyle{Monospace: true}
	objs = append(objs, apdl)

	// Action buttons
	objs = append(objs, widget.NewSeparator())
	objs = append(objs, s.buildActionButtons(n))

	return objs
}

// ── domain detail ─────────────────────────────────────────────────────────────

func buildDomainDetail(n *models.GraphNode) []fyne.CanvasObject {
	var objs []fyne.CanvasObject

	dc := canvas.NewText("Domain Code: "+n.DomainCode, asaftheme.NXBlue)
	dc.TextStyle = fyne.TextStyle{Monospace: true, Bold: true}
	dc.TextSize = 13
	objs = append(objs, dc)

	if d := models.DomainByCode(n.DomainCode); d != nil {
		pc := canvas.NewText(fmt.Sprintf("%d CMMC practices", d.PracticeCount), asaftheme.TextMuted)
		pc.TextSize = 12
		objs = append(objs, pc)
	}

	note := widget.NewLabel("Tap individual Finding nodes to inspect SPRS deductions, STIG evidence, and remediation actions for this domain.")
	note.Wrapping = fyne.TextWrapWord
	note.TextStyle = fyne.TextStyle{Italic: true}
	objs = append(objs, note)

	return objs
}

// ── practice detail ───────────────────────────────────────────────────────────

func buildPracticeDetail(n *models.GraphNode) []fyne.CanvasObject {
	var objs []fyne.CanvasObject

	if n.PracticeID != "" {
		pid := canvas.NewText(n.PracticeID, asaftheme.SBCyan)
		pid.TextStyle = fyne.TextStyle{Bold: true, Monospace: true}
		pid.TextSize = 13
		objs = append(objs, pid)
	}

	if n.SPRSWeight > 0 {
		sp := canvas.NewText(fmt.Sprintf("Max SPRS Deduction: −%d", n.SPRSWeight), asaftheme.AKGold)
		sp.TextSize = 12
		objs = append(objs, sp)
	}

	if n.Description != "" {
		desc := widget.NewLabel(n.Description)
		desc.Wrapping = fyne.TextWrapWord
		objs = append(objs, widget.NewSeparator(), desc)
	}

	return objs
}

// ── asset detail ──────────────────────────────────────────────────────────────

func buildAssetDetail(n *models.GraphNode) []fyne.CanvasObject {
	var objs []fyne.CanvasObject
	for _, row := range []struct{ k, v string }{
		{"Hostname", n.Hostname},
		{"IP Address", n.IPAddress},
		{"OS", n.OS},
	} {
		if row.v == "" {
			continue
		}
		objs = append(objs, muted(row.k))
		v := canvas.NewText(row.v, asaftheme.TextPrimary)
		v.TextSize = 13
		objs = append(objs, v)
	}
	if !n.CheckedAt.IsZero() {
		ts := canvas.NewText("Last scanned: "+n.CheckedAt.UTC().Format("2006-01-02 15:04"), asaftheme.TextMuted)
		ts.TextSize = 10
		objs = append(objs, ts)
	}
	return objs
}

// ── governance root detail ────────────────────────────────────────────────────

func buildRootDetail() []fyne.CanvasObject {
	desc := widget.NewLabel(
		"CMMC Level 2 Governance Root.\n\n" +
			"Anchors 14 NIST 800-171r3 control domains and 110 practices. " +
			"SPRS score starts at 110; each unique non-compliant practice deducts its assigned weight.",
	)
	desc.Wrapping = fyne.TextWrapWord
	return []fyne.CanvasObject{desc}
}

// ── generic detail ────────────────────────────────────────────────────────────

func buildGenericDetail(n *models.GraphNode) []fyne.CanvasObject {
	var objs []fyne.CanvasObject
	if n.Description != "" {
		d := widget.NewLabel(n.Description)
		d.Wrapping = fyne.TextWrapWord
		objs = append(objs, d)
	}
	for _, ref := range n.References {
		r := canvas.NewText("  "+ref, asaftheme.AKGold)
		r.TextStyle = fyne.TextStyle{Monospace: true}
		r.TextSize = 11
		objs = append(objs, r)
	}
	return objs
}

// ── action buttons ────────────────────────────────────────────────────────────

func (s *NodeSidebar) buildActionButtons(n *models.GraphNode) fyne.CanvasObject {
	id := n.ID
	stageFix := widget.NewButton("Stage Fix", func() {
		if s.OnStageFixPressed != nil {
			s.OnStageFixPressed(id)
		}
	})
	openPOAM := widget.NewButton("Open POA&M", func() {
		if s.OnOpenPOAMPressed != nil {
			s.OnOpenPOAMPressed(id)
		}
	})
	viewSSP := widget.NewButton("View in SSP", func() {
		if s.OnViewInSSPPressed != nil {
			s.OnViewInSSPPressed(id)
		}
	})
	return container.NewGridWithColumns(3, stageFix, openPOAM, viewSSP)
}

// ── APDL generation (§9) ──────────────────────────────────────────────────────

// buildAPDLSnippet generates an §9 APDL protocol stub for a finding node.
// The user must review and stage the snippet before it is executed.
func buildAPDLSnippet(n *models.GraphNode) string {
	findingID := n.FindingID
	if findingID == "" {
		findingID = n.ID
	}
	practiceID := n.PracticeID
	if practiceID == "" {
		practiceID = "UNKNOWN"
	}
	severity := strings.ReplaceAll(strings.ToUpper(n.SeverityRaw), " ", "_")
	if severity == "" {
		severity = "UNKNOWN"
	}
	status := "NOT_MET"
	if n.Status == models.StatusMet {
		status = "MET"
	}

	var b strings.Builder
	b.WriteString("-- §9 APDL stub — review before staging\n")
	fmt.Fprintf(&b, "POLICY CMMC_L2_REMEDIATION {\n")
	fmt.Fprintf(&b, "  FINDING %q {\n", findingID)
	fmt.Fprintf(&b, "    PRACTICE  %q\n", practiceID)
	fmt.Fprintf(&b, "    SEVERITY  %s\n", severity)
	fmt.Fprintf(&b, "    DEDUCT    %d\n", n.SPRSWeight)
	fmt.Fprintf(&b, "    STATUS    %s\n", status)
	fmt.Fprintf(&b, "    REMEDIATE {\n")
	if n.Remediation != "" {
		for _, line := range strings.Split(strings.TrimSpace(n.Remediation), "\n") {
			fmt.Fprintf(&b, "      -- %s\n", strings.TrimSpace(line))
		}
	} else {
		fmt.Fprintf(&b, "      -- TODO: define remediation steps\n")
	}
	fmt.Fprintf(&b, "    }\n")
	fmt.Fprintf(&b, "    ATTEST {\n")
	fmt.Fprintf(&b, "      EVIDENCE_TYPE  STIG_FINDING\n")
	fmt.Fprintf(&b, "      FRAMEWORK      \"CMMC-L2\"\n")
	fmt.Fprintf(&b, "      CONTROL        %q\n", practiceID)
	fmt.Fprintf(&b, "    }\n")
	fmt.Fprintf(&b, "  }\n")
	fmt.Fprintf(&b, "}\n")
	return b.String()
}

// ── helpers ───────────────────────────────────────────────────────────────────

// muted returns a small muted-color section header text object.
func muted(label string) fyne.CanvasObject {
	t := canvas.NewText(label, asaftheme.TextMuted)
	t.TextSize = 11
	return t
}
