// Package views — Tab 6: Readiness Gate.
//
// SPRS tile summary, KASA status feed, and per-domain heatmap.
// Gives the CISO an at-a-glance readiness posture across all enclaves.
//
// §10 rule: no Sephirot/Merkaba/Hypercube vocabulary in any user-visible string.
package views

import (
	"context"
	"fmt"
	"image/color"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/canvas"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"

	asaftheme "github.com/EtherVerseCodeMate/giza-cyber-shield/app/theme"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/asaf/hubclient"
)

// ReadinessTab is Tab 6 — SPRS tiles + KASA status + domain heatmap.
type ReadinessTab struct {
	win     fyne.Window
	backend hubclient.Backend

	// SPRS tile labels
	sprsScoreLabel   *canvas.Text
	sprsStatusLabel  *canvas.Text
	enclaveCountText *canvas.Text
	assetCountText   *canvas.Text

	// KASA feed
	kasaFeed     []string
	kasaList     *widget.List
	kasaCancel   context.CancelFunc

	// Domain heatmap cells: domain code → score label
	heatmapCells map[string]*canvas.Text

	statusLabel *canvas.Text
	content     *fyne.Container
}

// NewReadinessTab constructs Tab 6.
func NewReadinessTab(win fyne.Window, backend hubclient.Backend) *ReadinessTab {
	t := &ReadinessTab{
		win:          win,
		backend:      backend,
		heatmapCells: make(map[string]*canvas.Text),
	}
	t.build()
	go t.refresh()
	go t.startKASAFeed()
	return t
}

func (t *ReadinessTab) Content() fyne.CanvasObject { return t.content }

func (t *ReadinessTab) build() {
	pageTitle := canvas.NewText("Readiness Gate", asaftheme.TextPrimary)
	pageTitle.TextSize = 16
	pageTitle.TextStyle = fyne.TextStyle{Bold: true}

	t.statusLabel = canvas.NewText("Loading…", asaftheme.TextMuted)
	t.statusLabel.TextSize = 11

	refreshBtn := widget.NewButtonWithIcon("", theme.ViewRefreshIcon(), func() { go t.refresh() })

	// ── SPRS Tile ─────────────────────────────────────────────────────────────
	t.sprsScoreLabel = canvas.NewText("—", asaftheme.AKGold)
	t.sprsScoreLabel.TextSize = 48
	t.sprsScoreLabel.TextStyle = fyne.TextStyle{Bold: true}
	t.sprsScoreLabel.Alignment = fyne.TextAlignCenter

	sprsMaxLabel := canvas.NewText("/ 110", asaftheme.TextMuted)
	sprsMaxLabel.TextSize = 20
	sprsMaxLabel.Alignment = fyne.TextAlignCenter

	t.sprsStatusLabel = canvas.NewText("Awaiting scan", asaftheme.TextMuted)
	t.sprsStatusLabel.TextSize = 13
	t.sprsStatusLabel.Alignment = fyne.TextAlignCenter

	spsrsCard := container.NewVBox(
		canvas.NewText("SPRS Score", asaftheme.NXBlue),
		widget.NewSeparator(),
		container.NewCenter(container.NewHBox(t.sprsScoreLabel, sprsMaxLabel)),
		container.NewCenter(t.sprsStatusLabel),
	)

	// ── Fleet Tile ────────────────────────────────────────────────────────────
	t.enclaveCountText = canvas.NewText("—", asaftheme.NXBlue)
	t.enclaveCountText.TextSize = 32
	t.enclaveCountText.TextStyle = fyne.TextStyle{Bold: true}
	t.enclaveCountText.Alignment = fyne.TextAlignCenter

	t.assetCountText = canvas.NewText("—", asaftheme.NXBlue)
	t.assetCountText.TextSize = 32
	t.assetCountText.TextStyle = fyne.TextStyle{Bold: true}
	t.assetCountText.Alignment = fyne.TextAlignCenter

	fleetCard := container.NewVBox(
		canvas.NewText("Fleet", asaftheme.NXBlue),
		widget.NewSeparator(),
		container.NewGridWithColumns(2,
			container.NewVBox(
				canvas.NewText("Enclaves", asaftheme.TextMuted),
				container.NewCenter(t.enclaveCountText),
			),
			container.NewVBox(
				canvas.NewText("Assets", asaftheme.TextMuted),
				container.NewCenter(t.assetCountText),
			),
		),
	)

	topRow := container.NewGridWithColumns(2,
		container.NewPadded(spsrsCard),
		container.NewPadded(fleetCard),
	)

	// ── Domain Heatmap ────────────────────────────────────────────────────────
	heatTitle := canvas.NewText("Domain Heatmap", asaftheme.NXBlue)
	heatTitle.TextSize = 13
	heatTitle.TextStyle = fyne.TextStyle{Bold: true}

	domains := []struct{ code, name string }{
		{"AC", "Access Control"},
		{"AT", "Awareness & Training"},
		{"AU", "Audit & Accountability"},
		{"CM", "Configuration Mgmt"},
		{"IA", "Identification & Auth"},
		{"IR", "Incident Response"},
		{"MA", "Maintenance"},
		{"MP", "Media Protection"},
		{"PE", "Physical Protection"},
		{"PS", "Personnel Security"},
		{"RA", "Risk Assessment"},
		{"CA", "Security Assessment"},
		{"SC", "System & Comms"},
		{"SI", "System & Info Integrity"},
	}

	heatGrid := container.NewGridWithColumns(4)
	for _, d := range domains {
		d := d
		scoreCell := canvas.NewText("—", asaftheme.TextMuted)
		scoreCell.TextSize = 14
		scoreCell.TextStyle = fyne.TextStyle{Bold: true}
		scoreCell.Alignment = fyne.TextAlignCenter
		t.heatmapCells[d.code] = scoreCell

		nameLabel := canvas.NewText(d.name, asaftheme.TextMuted)
		nameLabel.TextSize = 10
		nameLabel.Alignment = fyne.TextAlignCenter

		cell := container.NewPadded(container.NewVBox(
			container.NewCenter(canvas.NewText(d.code, asaftheme.NXBlue)),
			container.NewCenter(scoreCell),
			container.NewCenter(nameLabel),
		))
		heatGrid.Add(cell)
	}

	heatmapSection := container.NewVBox(heatTitle, widget.NewSeparator(), heatGrid)

	// ── KASA Live Feed ────────────────────────────────────────────────────────
	kasaTitle := canvas.NewText("Live Security Event Feed (KASA)", asaftheme.NXBlue)
	kasaTitle.TextSize = 13
	kasaTitle.TextStyle = fyne.TextStyle{Bold: true}

	t.kasaList = widget.NewList(
		func() int { return len(t.kasaFeed) },
		func() fyne.CanvasObject { return widget.NewLabel("") },
		func(i widget.ListItemID, obj fyne.CanvasObject) {
			if i < len(t.kasaFeed) {
				obj.(*widget.Label).SetText(t.kasaFeed[i])
			}
		},
	)

	kasaSection := container.NewBorder(
		container.NewVBox(kasaTitle, widget.NewSeparator()),
		nil, nil, nil,
		container.NewVScroll(t.kasaList),
	)

	// ── Layout ────────────────────────────────────────────────────────────────
	middleRow := container.NewHSplit(
		container.NewPadded(heatmapSection),
		container.NewPadded(kasaSection),
	)
	middleRow.SetOffset(0.55)

	t.content = container.NewBorder(
		container.NewVBox(
			container.NewHBox(pageTitle, widget.NewSeparator(), t.statusLabel, widget.NewSeparator(), refreshBtn),
			widget.NewSeparator(),
			topRow,
			widget.NewSeparator(),
		),
		nil, nil, nil,
		middleRow,
	)
}

func (t *ReadinessTab) refresh() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	enclaves, err := t.backend.GetEnclaves(ctx)
	if err != nil {
		return
	}

	var totalAssets int
	var aggregateSPRS int
	domainScores := make(map[string]float64)

	for _, enc := range enclaves {
		assets, _ := t.backend.GetAssets(ctx, enc.ID)
		totalAssets += len(assets)

		sprs, err := t.backend.GetSPRS(ctx, enc.ID)
		if err == nil && sprs != nil {
			aggregateSPRS += sprs.Score
			for domain, score := range sprs.DomainScores {
				domainScores[domain] += score
			}
		}
	}

	avgSPRS := 0
	if len(enclaves) > 0 {
		avgSPRS = aggregateSPRS / len(enclaves)
	}

	fyne.Do(func() {
		t.enclaveCountText.Text = fmt.Sprintf("%d", len(enclaves))
		t.enclaveCountText.Refresh()
		t.assetCountText.Text = fmt.Sprintf("%d", totalAssets)
		t.assetCountText.Refresh()

		t.sprsScoreLabel.Text = fmt.Sprintf("%d", avgSPRS)
		t.sprsScoreLabel.Color = sprsColorFor(avgSPRS)
		t.sprsScoreLabel.Refresh()

		statusText, statusColor := sprsStatusText(avgSPRS)
		t.sprsStatusLabel.Text = statusText
		t.sprsStatusLabel.Color = statusColor
		t.sprsStatusLabel.Refresh()

		for code, cell := range t.heatmapCells {
			if score, ok := domainScores[code]; ok {
				cell.Text = fmt.Sprintf("%.0f%%", score*100)
				cell.Color = scoreColor(score)
			} else {
				cell.Text = "—"
				cell.Color = asaftheme.TextMuted
			}
			cell.Refresh()
		}

		t.statusLabel.Text = fmt.Sprintf(
			"%d enclaves · %d assets · Updated %s",
			len(enclaves), totalAssets, time.Now().Format("15:04:05"),
		)
		t.statusLabel.Refresh()
	})
}

func (t *ReadinessTab) startKASAFeed() {
	if t.kasaCancel != nil {
		t.kasaCancel()
	}
	ctx, cancel := context.WithCancel(context.Background())
	t.kasaCancel = cancel

	ch, err := t.backend.StreamKASA(ctx)
	if err != nil {
		return
	}

	for ev := range ch {
		ev := ev
		fyne.Do(func() {
			line := fmt.Sprintf("[%s] %s: %s",
				ev.Timestamp.Format("15:04:05"), ev.Type, ev.Message)
			// Keep feed bounded to 200 entries
			if len(t.kasaFeed) >= 200 {
				t.kasaFeed = t.kasaFeed[1:]
			}
			t.kasaFeed = append(t.kasaFeed, line)
			t.kasaList.Refresh()
		})
	}
}

func sprsStatusText(score int) (string, color.Color) {
	switch {
	case score >= 105:
		return "Excellent — CMMC ready", asaftheme.NodeGreen
	case score >= 100:
		return "Good — Minor findings open", asaftheme.NodeGreen
	case score >= 90:
		return "Acceptable — Review open findings", asaftheme.NodeOrange
	case score >= 80:
		return "At Risk — Remediation required", asaftheme.NodeOrange
	default:
		return "Non-Compliant — Immediate action needed", asaftheme.NodeRed
	}
}

func scoreColor(score float64) color.Color {
	switch {
	case score >= 0.95:
		return asaftheme.NodeGreen
	case score >= 0.80:
		return asaftheme.NodeOrange
	default:
		return asaftheme.NodeRed
	}
}
