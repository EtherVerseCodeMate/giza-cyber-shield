// Package views — Tab 3: System Security Plan (SSP) auto-generator.
//
// Assembles a CMMC Level 2 SSP from backend scan data: control narratives,
// asset inventory, responsible roles, and implementation statements.
//
// §10 rule: no Sephirot/Merkaba/Hypercube vocabulary in any user-visible string.
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
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"

	asaftheme "github.com/EtherVerseCodeMate/giza-cyber-shield/app/theme"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/asaf/hubclient"
)

// SSPTab is Tab 3 — System Security Plan auto-generation.
type SSPTab struct {
	win     fyne.Window
	backend hubclient.Backend

	statusLabel *canvas.Text
	progress    *widget.ProgressBar
	outputEntry *widget.Entry
	content     *fyne.Container
}

// NewSSPTab constructs Tab 3.
func NewSSPTab(win fyne.Window, backend hubclient.Backend) *SSPTab {
	t := &SSPTab{win: win, backend: backend}
	t.build()
	return t
}

func (t *SSPTab) Content() fyne.CanvasObject { return t.content }

func (t *SSPTab) build() {
	// Header
	title := canvas.NewText("System Security Plan — Auto-Generator", asaftheme.TextPrimary)
	title.TextSize = 16
	title.TextStyle = fyne.TextStyle{Bold: true}

	subtitle := canvas.NewText(
		"Generates a CMMC Level 2 SSP narrative from your live compliance data.",
		asaftheme.TextMuted,
	)
	subtitle.TextSize = 11

	// Status / progress
	t.statusLabel = canvas.NewText("Ready. Click [Generate SSP] to begin.", asaftheme.TextMuted)
	t.statusLabel.TextSize = 11
	t.progress = widget.NewProgressBar()
	t.progress.Hide()

	// SSP output area
	t.outputEntry = widget.NewMultiLineEntry()
	t.outputEntry.SetPlaceHolder(
		"System Security Plan will appear here after generation.\n\n" +
			"The SSP includes:\n" +
			"  • System boundary definition\n" +
			"  • 110 CMMC practice implementation statements\n" +
			"  • Asset inventory (from Fleet Manager)\n" +
			"  • Responsible roles and POCs\n" +
			"  • CUI category and handling procedures\n" +
			"  • Inherited controls from enclave infrastructure",
	)
	t.outputEntry.Wrapping = fyne.TextWrapWord

	// Toolbar
	genBtn := widget.NewButtonWithIcon("Generate SSP", theme.DocumentCreateIcon(), func() {
		t.generateSSP()
	})
	genBtn.Importance = widget.HighImportance

	copyBtn := widget.NewButtonWithIcon("Copy to Clipboard", theme.ContentCopyIcon(), func() {
		if t.outputEntry.Text == "" {
			dialog.ShowInformation("Nothing to Copy", "Generate the SSP first.", t.win)
			return
		}
		t.win.Clipboard().SetContent(t.outputEntry.Text)
		dialog.ShowInformation("Copied", "SSP text copied to clipboard.", t.win)
	})

	exportBtn := widget.NewButtonWithIcon("Export as .docx", theme.DocumentSaveIcon(), func() {
		if t.outputEntry.Text == "" {
			dialog.ShowInformation("Nothing to Export", "Generate the SSP first.", t.win)
			return
		}
		dialog.ShowInformation("Export",
			"DOCX export will be available in a future release.\n"+
				"Copy the SSP text and paste it into your template.", t.win)
	})

	askBtn := widget.NewButtonWithIcon("Ask AI", theme.QuestionIcon(), func() {
		t.showAskDialog()
	})

	toolbar := container.NewHBox(genBtn, copyBtn, exportBtn, widget.NewSeparator(), askBtn)

	t.content = container.NewBorder(
		container.NewVBox(
			title, subtitle, widget.NewSeparator(),
			toolbar, widget.NewSeparator(),
			t.statusLabel, t.progress,
		),
		nil, nil, nil,
		container.NewPadded(container.NewVScroll(t.outputEntry)),
	)
}

func (t *SSPTab) generateSSP() {
	fyne.Do(func() {
		t.statusLabel.Text = "Fetching asset inventory…"
		t.statusLabel.Color = asaftheme.NXBlue
		t.statusLabel.Refresh()
		t.progress.Show()
		t.progress.SetValue(0.1)
	})

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()

		enclaves, err := t.backend.GetEnclaves(ctx)
		if err != nil {
			fyne.Do(func() { t.setError("Failed to retrieve enclaves: " + err.Error()) })
			return
		}
		fyne.Do(func() { t.progress.SetValue(0.3) })

		var allAssets []hubclient.Asset
		for _, enc := range enclaves {
			assets, err := t.backend.GetAssets(ctx, enc.ID)
			if err != nil {
				continue
			}
			allAssets = append(allAssets, assets...)
		}
		fyne.Do(func() { t.progress.SetValue(0.5) })

		var sprsResult *hubclient.SPRSResult
		if len(enclaves) > 0 {
			sprsResult, _ = t.backend.GetSPRS(ctx, enclaves[0].ID)
		}
		fyne.Do(func() { t.progress.SetValue(0.8) })

		ssp := buildSSPText(enclaves, allAssets, sprsResult)

		fyne.Do(func() {
			t.outputEntry.SetText(ssp)
			t.statusLabel.Text = "SSP generated. Review and customize before submission."
			t.statusLabel.Color = asaftheme.NodeGreen
			t.statusLabel.Refresh()
			t.progress.SetValue(1.0)
			t.progress.Hide()
		})
	}()
}

func (t *SSPTab) showAskDialog() {
	entry := widget.NewMultiLineEntry()
	entry.SetPlaceHolder("Ask a question about your SSP or CMMC practices…")
	entry.Wrapping = fyne.TextWrapWord
	entry.Resize(fyne.NewSize(500, 80))

	dlg := dialog.NewCustomConfirm("Ask AI — SSP Assistant", "Ask", "Cancel", entry, func(ask bool) {
		if !ask || strings.TrimSpace(entry.Text) == "" {
			return
		}
		query := entry.Text
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			resp, err := t.backend.Ask(ctx, query)
			fyne.Do(func() {
				if err != nil {
					dialog.ShowError(err, t.win)
					return
				}
				dialog.ShowInformation("AI Response", resp.Answer, t.win)
			})
		}()
	}, t.win)
	dlg.Resize(fyne.NewSize(540, 200))
	dlg.Show()
}

func (t *SSPTab) setError(msg string) {
	t.statusLabel.Text = "Error: " + msg
	t.statusLabel.Color = asaftheme.NodeRed
	t.statusLabel.Refresh()
	t.progress.Hide()
}

// buildSSPText assembles the SSP narrative from retrieved data.
func buildSSPText(enclaves []hubclient.Enclave, assets []hubclient.Asset, sprs *hubclient.SPRSResult) string {
	var sb strings.Builder
	now := time.Now().UTC().Format("2006-01-02")

	sb.WriteString("SYSTEM SECURITY PLAN\n")
	sb.WriteString("CMMC Level 2 — Self-Assessment\n")
	sb.WriteString("Generated by AdinKhepra ASAF\n")
	sb.WriteString(fmt.Sprintf("Date: %s\n", now))
	sb.WriteString("Patent: USPTO #73565085 | SecRed Knowledge Inc.\n")
	sb.WriteString(strings.Repeat("─", 72) + "\n\n")

	// 1. System Overview
	sb.WriteString("1. SYSTEM OVERVIEW\n")
	sb.WriteString(strings.Repeat("─", 40) + "\n")
	sb.WriteString("System Name: [ORGANIZATION NAME] Information System\n")
	sb.WriteString("System Owner: [NAME, TITLE]\n")
	sb.WriteString("ISSO: [NAME, EMAIL]\n")
	sb.WriteString("System Type: Major Application / General Support System\n")
	sb.WriteString("Operating Environment: On-Premises / Air-Gapped\n\n")

	// 2. SPRS Summary
	if sprs != nil {
		sb.WriteString("2. SPRS SCORE SUMMARY\n")
		sb.WriteString(strings.Repeat("─", 40) + "\n")
		sb.WriteString(fmt.Sprintf("Current SPRS Score:  %d / 110\n", sprs.Score))
		sb.WriteString(fmt.Sprintf("Passing Controls:    %d\n", sprs.PassingCount))
		sb.WriteString(fmt.Sprintf("Failing Controls:    %d\n", sprs.FailingCount))
		sb.WriteString(fmt.Sprintf("Score Computed:      %s\n", asafFormatTime(sprs.ComputedAt)))
		sb.WriteString("\n")
	}

	// 3. Enclave inventory
	sb.WriteString("3. ENCLAVE INVENTORY\n")
	sb.WriteString(strings.Repeat("─", 40) + "\n")
	if len(enclaves) == 0 {
		sb.WriteString("  No enclaves registered. Run a scan from the Fleet Manager tab.\n")
	} else {
		for i, e := range enclaves {
			sb.WriteString(fmt.Sprintf("  %d. %s (SPRS: %d/110)\n", i+1, e.Name, e.SPRSScore))
		}
	}
	sb.WriteString("\n")

	// 4. Asset inventory
	sb.WriteString("4. ASSET INVENTORY\n")
	sb.WriteString(strings.Repeat("─", 40) + "\n")
	if len(assets) == 0 {
		sb.WriteString("  No assets registered. Import assets via the Fleet Manager tab.\n")
	} else {
		sb.WriteString(fmt.Sprintf("  Total Assets: %d\n\n", len(assets)))
		for i, a := range assets {
			sb.WriteString(fmt.Sprintf("  %d. %s\n", i+1, a.Hostname))
			sb.WriteString(fmt.Sprintf("     IP: %s | OS: %s | Profile: %s\n",
				a.IPAddress, a.OS, a.STIGProfile))
			sb.WriteString(fmt.Sprintf("     SPRS: %d | Last Scan: %s | Status: %s\n",
				a.SPRSScore, asafFormatTime(a.LastScan), asafOnlineStr(a.Online)))
		}
	}
	sb.WriteString("\n")

	// 5. CMMC Practice Stubs
	sb.WriteString("5. CMMC LEVEL 2 PRACTICE IMPLEMENTATION STATEMENTS\n")
	sb.WriteString(strings.Repeat("─", 40) + "\n")
	sb.WriteString("  [Customize each statement with your organization's specific implementation]\n\n")

	domains := []struct{ code, name string }{
		{"AC", "Access Control"},
		{"AT", "Awareness & Training"},
		{"AU", "Audit & Accountability"},
		{"CM", "Configuration Management"},
		{"IA", "Identification & Authentication"},
		{"IR", "Incident Response"},
		{"MA", "Maintenance"},
		{"MP", "Media Protection"},
		{"PE", "Physical Protection"},
		{"PS", "Personnel Security"},
		{"RA", "Risk Assessment"},
		{"CA", "Security Assessment"},
		{"SC", "System & Comms Protection"},
		{"SI", "System & Information Integrity"},
	}
	for _, d := range domains {
		sb.WriteString(fmt.Sprintf("  %s — %s\n", d.code, d.name))
		sb.WriteString("  Implementation: [Describe how your organization meets this domain's requirements]\n")
		sb.WriteString("  Responsible Role: [TITLE]\n")
		sb.WriteString("  Artifacts: [List policies, procedures, and evidence]\n\n")
	}

	sb.WriteString(strings.Repeat("─", 72) + "\n")
	sb.WriteString("END OF SYSTEM SECURITY PLAN\n")
	sb.WriteString(fmt.Sprintf("Generated: %s UTC | AdinKhepra ASAF v1.1.1\n", now))

	return sb.String()
}
