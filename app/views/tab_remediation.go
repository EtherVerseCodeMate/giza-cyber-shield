// Package views — Tab 5: Remediation (Imhotep Approval Queue).
//
// Lists pending staged fixes from the Imhotep daemon.  Each fix must pass a
// mandatory two-step confirmation dialog before backend.Approve() is called.
// The [APPROVE FOR PRODUCTION] button NEVER fires without explicit user consent.
//
// §10 rule: no Sephirot/Merkaba/Hypercube vocabulary in any user-visible string.
package views

import (
	"context"
	"fmt"
	"image/color"
	"strings"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/canvas"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/dialog"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"

	asaftheme "github.com/EtherVerseCodeMate/giza-cyber-shield/app/theme"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/asaf/hub"
)

// RemediationTab is Tab 5 — Imhotep staged-fix approval queue.
type RemediationTab struct {
	win     fyne.Window
	backend hub.Backend

	pending     []hub.PendingChange
	selected    int // index into pending, -1 = none
	list        *widget.List
	detailArea  *fyne.Container
	statusLabel *canvas.Text
	content     *fyne.Container
}

// NewRemediationTab constructs Tab 5.
func NewRemediationTab(win fyne.Window, backend hub.Backend) *RemediationTab {
	t := &RemediationTab{
		win:      win,
		backend:  backend,
		selected: -1,
	}
	t.build()
	go t.refresh()
	return t
}

func (t *RemediationTab) Content() fyne.CanvasObject { return t.content }

func (t *RemediationTab) build() {
	title := canvas.NewText("Remediation — Imhotep Approval Queue", asaftheme.TextPrimary)
	title.TextSize = 16
	title.TextStyle = fyne.TextStyle{Bold: true}

	t.statusLabel = canvas.NewText("Loading staged fixes…", asaftheme.TextMuted)
	t.statusLabel.TextSize = 11

	refreshBtn := widget.NewButtonWithIcon("", theme.ViewRefreshIcon(), func() { go t.refresh() })

	// Pending fixes list (left)
	t.list = widget.NewList(
		func() int { return len(t.pending) },
		func() fyne.CanvasObject {
			sev := canvas.NewText("", asaftheme.NodeRed)
			sev.TextSize = 10
			lbl := canvas.NewText("", asaftheme.TextPrimary)
			lbl.TextSize = 12
			ts := canvas.NewText("", asaftheme.TextMuted)
			ts.TextSize = 10
			return container.NewVBox(container.NewHBox(sev, lbl), ts)
		},
		func(id widget.ListItemID, obj fyne.CanvasObject) {
			if int(id) >= len(t.pending) {
				return
			}
			p := t.pending[id]
			row := obj.(*fyne.Container)
			top := row.Objects[0].(*fyne.Container)
			sev := top.Objects[0].(*canvas.Text)
			lbl := top.Objects[1].(*canvas.Text)
			ts := row.Objects[1].(*canvas.Text)
			// Derive severity label from StagedOK
			sevStr := "CAT II"
			if !p.StagedOK {
				sevStr = "CAT I"
			}
			sev.Text = "[" + sevStr + "]"
			sev.Color = priorityColor(sevStr)
			sev.Refresh()
			lbl.Text = p.ControlID + " — " + p.Hostname
			lbl.Color = asaftheme.TextPrimary
			lbl.Refresh()
			ts.Text = fmt.Sprintf("%s — staged %s", p.Hostname, asafFormatTime(p.StagedAt))
			ts.Color = asaftheme.TextMuted
			ts.Refresh()
		},
	)
	t.list.OnSelected = func(id widget.ListItemID) {
		if int(id) >= len(t.pending) {
			return
		}
		t.selected = int(id)
		t.showDetail(t.pending[id])
	}

	// Detail panel (right)
	t.detailArea = container.NewMax(t.idleRemediationDetail())

	split := container.NewHSplit(
		container.NewBorder(
			container.NewVBox(
				canvas.NewText("Staged Fixes", asaftheme.NXBlue),
				widget.NewSeparator(),
			),
			nil, nil, nil,
			container.NewVScroll(t.list),
		),
		t.detailArea,
	)
	split.SetOffset(0.35)

	t.content = container.NewBorder(
		container.NewVBox(
			title, widget.NewSeparator(),
			container.NewHBox(t.statusLabel, widget.NewSeparator(), refreshBtn),
			widget.NewSeparator(),
		),
		nil, nil, nil,
		split,
	)
}

func (t *RemediationTab) idleRemediationDetail() fyne.CanvasObject {
	hint := canvas.NewText("Select a staged fix to review", asaftheme.TextMuted)
	hint.TextSize = 13
	hint.Alignment = fyne.TextAlignCenter
	return container.NewCenter(hint)
}

func (t *RemediationTab) showDetail(p hub.PendingChange) {
	// Derive display fields from actual PendingChange fields
	displayTitle := p.ControlID + " — " + p.Hostname
	sevStr := "CAT II"
	if !p.StagedOK {
		sevStr = "CAT I"
	}

	// Header
	titleLabel := canvas.NewText(displayTitle, asaftheme.TextPrimary)
	titleLabel.TextSize = 16
	titleLabel.TextStyle = fyne.TextStyle{Bold: true}

	priorityLabel := canvas.NewText("Severity: "+sevStr, priorityColor(sevStr))
	priorityLabel.TextSize = 12

	form := widget.NewForm(
		widget.NewFormItem("Control ID", widget.NewLabel(p.ControlID)),
		widget.NewFormItem("Asset", widget.NewLabel(p.Hostname)),
		widget.NewFormItem("Staged At", widget.NewLabel(asafFormatTime(p.StagedAt))),
		widget.NewFormItem("Staged OK", widget.NewLabel(func() string {
			if p.StagedOK {
				return "Yes — staging run succeeded"
			}
			return "No — staging run FAILED"
		}())),
		widget.NewFormItem("Submitted By", widget.NewLabel(p.SignedBy)),
		widget.NewFormItem("Authorization Level", widget.NewLabel(p.Symbol)),
	)

	descTitle := canvas.NewText("Staged Diff / State Change", asaftheme.NXBlue)
	descTitle.TextSize = 12
	descTitle.TextStyle = fyne.TextStyle{Bold: true}
	diffText := p.StagedDiff
	if diffText == "" {
		diffText = "(no diff recorded)"
	}
	descText := widget.NewLabel(diffText)
	descText.Wrapping = fyne.TextWrapWord

	cmdTitle := canvas.NewText("Command to Execute", asaftheme.NXBlue)
	cmdTitle.TextSize = 12
	cmdTitle.TextStyle = fyne.TextStyle{Bold: true}
	cmdText := widget.NewLabel(strings.Join(p.Command, " "))
	cmdText.TextStyle = fyne.TextStyle{Monospace: true}
	cmdText.Wrapping = fyne.TextWrapWord

	// Signature status
	sigStatus := "ML-DSA-65 signature present"
	sigColor := asaftheme.NodeGreen
	if len(p.Signature) == 0 {
		sigStatus = "⚠ No signature — DO NOT APPROVE"
		sigColor = asaftheme.NodeRed
	}
	sigLabel := canvas.NewText(sigStatus, sigColor)
	sigLabel.TextSize = 11

	// Action buttons
	approveBtn := widget.NewButton("APPROVE FOR PRODUCTION", func() {
		t.confirmAndApprove(p)
	})
	approveBtn.Importance = widget.DangerImportance

	rejectBtn := widget.NewButton("Reject / Discard", func() {
		dialog.ShowConfirm("Confirm Reject",
			fmt.Sprintf("Discard staged fix for %s?\nThis cannot be undone.", p.ControlID),
			func(yes bool) {
				if yes {
					// Rejection is modeled as: don't approve, remove from local list
					fyne.Do(func() {
						t.removeFromPending(p.ID)
					})
				}
			}, t.win)
	})

	if len(p.Signature) == 0 {
		approveBtn.Disable()
	}

	buttons := container.NewHBox(approveBtn, rejectBtn)

	detail := container.NewVBox(
		titleLabel, priorityLabel,
		widget.NewSeparator(),
		form,
		widget.NewSeparator(),
		descTitle, descText,
		widget.NewSeparator(),
		cmdTitle, cmdText,
		widget.NewSeparator(),
		sigLabel,
		widget.NewSeparator(),
		buttons,
	)

	fyne.Do(func() {
		t.detailArea.Objects = []fyne.CanvasObject{container.NewPadded(container.NewVScroll(detail))}
		t.detailArea.Refresh()
	})
}

// confirmAndApprove presents a mandatory two-step confirmation before calling backend.Approve.
// The [APPROVE FOR PRODUCTION] button MUST ALWAYS show this dialog — it is an absolute requirement.
func (t *RemediationTab) confirmAndApprove(p hub.PendingChange) {
	// Step 1 — primary confirmation
	primaryMsg := fmt.Sprintf(
		"You are about to execute the following command on production:\n\n"+
			"  %s\n\n"+
			"Control: %s\n"+
			"Asset:   %s\n\n"+
			"This action will be recorded in the tamper-evident audit DAG.\n"+
			"Are you sure you want to proceed?",
		strings.Join(p.Command, " "), p.ControlID, p.Hostname,
	)
	dialog.ShowConfirm("Confirm Production Approval — Step 1 of 2",
		primaryMsg,
		func(step1 bool) {
			if !step1 {
				return
			}
			// Step 2 — final irreversible action warning
			dialog.ShowConfirm("FINAL CONFIRMATION — Step 2 of 2",
				"This is your last chance to cancel.\n\n"+
					"Clicking APPROVE will:\n"+
					"  • Execute the command immediately on the target asset\n"+
					"  • Record a signed DAG attestation node\n"+
					"  • Close this finding in the POA&M\n\n"+
					"This action CANNOT be undone.\n\nProceed?",
				func(step2 bool) {
					if !step2 {
						return
					}
					go t.executeApprove(p)
				},
				t.win,
			)
		},
		t.win,
	)
}

func (t *RemediationTab) executeApprove(p hub.PendingChange) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	err := t.backend.Approve(ctx, p.ID)
	fyne.Do(func() {
		if err != nil {
			dialog.ShowError(
				fmt.Errorf("approval failed for %s: %w", p.ControlID, err),
				t.win,
			)
			return
		}
		dialog.ShowInformation(
			"Approved",
			fmt.Sprintf("Fix for %s has been applied and attested in the audit DAG.", p.ControlID),
			t.win,
		)
		t.removeFromPending(p.ID)
		t.detailArea.Objects = []fyne.CanvasObject{t.idleRemediationDetail()}
		t.detailArea.Refresh()
	})
}

func (t *RemediationTab) removeFromPending(id string) {
	updated := t.pending[:0]
	for _, p := range t.pending {
		if p.ID != id {
			updated = append(updated, p)
		}
	}
	t.pending = updated
	t.list.Refresh()
	t.statusLabel.Text = fmt.Sprintf("%d staged fixes pending", len(t.pending))
	t.statusLabel.Refresh()
}

func (t *RemediationTab) refresh() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pending, err := t.backend.GetPendingApprovals(ctx)
	fyne.Do(func() {
		if err != nil {
			t.statusLabel.Text = "Error loading queue: " + err.Error()
			t.statusLabel.Color = asaftheme.NodeRed
			t.statusLabel.Refresh()
			return
		}
		t.pending = pending
		count := len(pending)
		t.statusLabel.Color = asaftheme.TextMuted
		if count == 0 {
			t.statusLabel.Text = "No staged fixes pending — all controls are current."
		} else {
			t.statusLabel.Text = fmt.Sprintf("%d staged fix(es) awaiting approval", count)
		}
		t.statusLabel.Refresh()
		t.list.Refresh()
	})
}

func priorityColor(priority string) color.Color {
	switch strings.ToLower(priority) {
	case "critical", "high":
		return asaftheme.NodeRed
	case "medium":
		return asaftheme.NodeOrange
	default:
		return asaftheme.NXBlue
	}
}
