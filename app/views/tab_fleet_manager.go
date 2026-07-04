// Package views — Tab 2: Fleet Manager
//
// SecureCRT-inspired hierarchical session tree: Organization → Enclaves → Assets.
// Left panel (30%): expandable tree with SPRS badges per asset.
// Right panel (70%): asset detail with failing controls list and action buttons.
//
// §10 rule: no Sephirot/Merkaba/Hypercube vocabulary in any user-visible string.
package views

import (
	"context"
	"fmt"
	"image/color"
	"sort"
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

// FleetManagerTab is Tab 2 — the fleet asset inventory and remote administration panel.
type FleetManagerTab struct {
	win     fyne.Window
	backend hub.Backend

	// Left tree
	tree      *widget.Tree
	enclaves  []hub.Enclave
	assets    []hub.Asset          // flat list; filtered by enclave in tree
	assetByID map[string]hub.Asset // fast lookup for tree update callbacks

	// Right detail panel
	detailArea *fyne.Container

	content *fyne.Container
}

// NewFleetManagerTab constructs Tab 2.
func NewFleetManagerTab(win fyne.Window, backend hub.Backend) *FleetManagerTab {
	t := &FleetManagerTab{
		win:       win,
		backend:   backend,
		assetByID: make(map[string]hub.Asset),
	}
	t.build()
	go t.refresh()
	return t
}

// Content returns the assembled Fyne container for AppTabs.
func (t *FleetManagerTab) Content() fyne.CanvasObject { return t.content }

// ── Build ─────────────────────────────────────────────────────────────────────

func (t *FleetManagerTab) build() {
	toolbar := widget.NewToolbar(
		widget.NewToolbarAction(theme.ContentAddIcon(), func() {
			ShowConnectWizard(t.win, t.backend, func() { go t.refresh() })
		}),
		widget.NewToolbarSeparator(),
		widget.NewToolbarAction(theme.ViewRefreshIcon(), func() { go t.refresh() }),
		widget.NewToolbarSeparator(),
		widget.NewToolbarAction(theme.DocumentSaveIcon(), func() { t.showExportDialog() }),
	)

	t.tree = widget.NewTree(
		t.treeChildUIDs,
		t.treeIsBranch,
		t.treeCreate,
		t.treeUpdate,
	)
	t.tree.OnSelected = func(uid string) {
		if a, ok := t.assetByID[uid]; ok {
			t.showAssetDetail(a)
		}
	}

	treeHeader := canvas.NewText("Fleet", asaftheme.TextPrimary)
	treeHeader.TextSize = 13
	treeHeader.TextStyle = fyne.TextStyle{Bold: true}

	treeCard := container.NewBorder(
		container.NewVBox(treeHeader, widget.NewSeparator()),
		nil, nil, nil,
		container.NewVScroll(t.tree),
	)

	t.detailArea = container.NewMax(t.idleDetail())

	split := container.NewHSplit(treeCard, t.detailArea)
	split.SetOffset(0.30)

	t.content = container.NewBorder(
		container.NewVBox(toolbar, widget.NewSeparator()),
		nil, nil, nil,
		split,
	)
}

// ── Tree data source ──────────────────────────────────────────────────────────

const fleetTreeRootUID = "__fleet_root__"

func fleetEnclaveUID(e hub.Enclave) string { return "enc:" + e.ID }
func fleetAssetUID(a hub.Asset) string     { return "asset:" + a.ID }

func (t *FleetManagerTab) treeChildUIDs(uid string) []string {
	if uid == "" {
		return []string{fleetTreeRootUID}
	}
	if uid == fleetTreeRootUID {
		uids := make([]string, 0, len(t.enclaves))
		for _, e := range t.enclaves {
			uids = append(uids, fleetEnclaveUID(e))
		}
		return uids
	}
	// Enclave branch → return its assets
	for _, e := range t.enclaves {
		if fleetEnclaveUID(e) == uid {
			var uids []string
			for _, a := range t.assets {
				if a.EnclaveID == e.ID {
					uids = append(uids, fleetAssetUID(a))
				}
			}
			return uids
		}
	}
	return nil
}

func (t *FleetManagerTab) treeIsBranch(uid string) bool {
	if uid == fleetTreeRootUID {
		return true
	}
	for _, e := range t.enclaves {
		if fleetEnclaveUID(e) == uid {
			return true
		}
	}
	return false
}

func (t *FleetManagerTab) treeCreate(_ bool) fyne.CanvasObject {
	icon := canvas.NewText("●", asaftheme.NXBlue)
	icon.TextSize = 11
	lbl := canvas.NewText("Loading…", asaftheme.TextMuted)
	lbl.TextSize = 12
	badge := canvas.NewText("", asaftheme.AKGold)
	badge.TextSize = 10
	return container.NewHBox(icon, lbl, badge)
}

func (t *FleetManagerTab) treeUpdate(uid string, _ bool, obj fyne.CanvasObject) {
	row := obj.(*fyne.Container)
	icon := row.Objects[0].(*canvas.Text)
	lbl := row.Objects[1].(*canvas.Text)
	badge := row.Objects[2].(*canvas.Text)

	switch {
	case uid == fleetTreeRootUID:
		icon.Text = "▼"
		icon.Color = asaftheme.NXBlue
		lbl.Text = "Fleet"
		lbl.Color = asaftheme.TextPrimary
		badge.Text = fmt.Sprintf("(%d enclaves)", len(t.enclaves))
		badge.Color = asaftheme.TextMuted

	case t.treeIsBranch(uid):
		for _, e := range t.enclaves {
			if fleetEnclaveUID(e) == uid {
				icon.Text = "▼"
				icon.Color = asaftheme.NXBlue
				lbl.Text = "[ENCLAVE] " + e.Name
				lbl.Color = asaftheme.NXBlue
				badge.Text = fmt.Sprintf("[%d/110]", e.SPRSScore)
				badge.Color = sprsColorFor(e.SPRSScore)
			}
		}

	default:
		if a, ok := t.assetByID[uid]; ok {
			icon.Text = "●"
			icon.Color = onlineColorFor(a.Online)
			lbl.Text = a.Hostname
			lbl.Color = asaftheme.TextPrimary
			badge.Text = fmt.Sprintf("[%d/110]", a.SPRSScore)
			badge.Color = sprsColorFor(a.SPRSScore)
		}
	}

	row.Objects[0].Refresh()
	row.Objects[1].Refresh()
	row.Objects[2].Refresh()
}

// ── Asset detail panel ────────────────────────────────────────────────────────

func (t *FleetManagerTab) idleDetail() fyne.CanvasObject {
	hint := canvas.NewText("Select an asset to inspect", asaftheme.TextMuted)
	hint.TextSize = 13
	hint.Alignment = fyne.TextAlignCenter
	return container.NewCenter(hint)
}

func (t *FleetManagerTab) showAssetDetail(a hub.Asset) {
	hostnameLabel := canvas.NewText(a.Hostname, asaftheme.TextPrimary)
	hostnameLabel.TextSize = 18
	hostnameLabel.TextStyle = fyne.TextStyle{Bold: true}

	sprsLabel := canvas.NewText(fmt.Sprintf("SPRS Score: %d / 110", a.SPRSScore), sprsColorFor(a.SPRSScore))
	sprsLabel.TextSize = 14
	sprsLabel.TextStyle = fyne.TextStyle{Bold: true}

	form := widget.NewForm(
		widget.NewFormItem("IP Address", widget.NewLabel(a.IPAddress)),
		widget.NewFormItem("OS", widget.NewLabel(a.OS)),
		widget.NewFormItem("STIG Profile", widget.NewLabel(a.STIGProfile)),
		widget.NewFormItem("Last Scan", widget.NewLabel(asafFormatTime(a.LastScan))),
		widget.NewFormItem("Status", widget.NewLabel(asafOnlineStr(a.Online))),
	)

	scanBtn := widget.NewButton("Scan Now", func() {
		dialog.ShowInformation("Scan Started",
			fmt.Sprintf("STIG scan initiated on %s", a.Hostname), t.win)
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
			defer cancel()
			_, err := t.backend.Scan(ctx, a.ID)
			fyne.Do(func() {
				if err != nil {
					dialog.ShowError(err, t.win)
					return
				}
				dialog.ShowInformation("Scan Complete",
					fmt.Sprintf("Scan completed on %s", a.Hostname), t.win)
				go t.refresh()
			})
		}()
	})

	remediateBtn := widget.NewButton("Remediate", func() {
		dialog.ShowInformation("Remediation",
			"Select a failing control in the Compliance Graph tab and click [Stage Fix].", t.win)
	})

	streamBtn := widget.NewButton("View Live Stream", func() {
		if t.backend.Mode() == hub.ModeStandalone {
			dialog.ShowInformation("Not Available",
				"Live event streams require a Hub connection (--hub <url>).", t.win)
			return
		}
		t.showKASAStream(a)
	})

	detail := container.NewVBox(
		hostnameLabel,
		sprsLabel,
		widget.NewSeparator(),
		form,
		widget.NewSeparator(),
		container.NewHBox(scanBtn, remediateBtn, streamBtn),
	)

	fyne.Do(func() {
		t.detailArea.Objects = []fyne.CanvasObject{container.NewPadded(detail)}
		t.detailArea.Refresh()
	})
}

func (t *FleetManagerTab) showKASAStream(a hub.Asset) {
	var feedData []string
	list := widget.NewList(
		func() int { return len(feedData) },
		func() fyne.CanvasObject { return widget.NewLabel("") },
		func(i widget.ListItemID, obj fyne.CanvasObject) {
			obj.(*widget.Label).SetText(feedData[i])
		},
	)

	ctx, cancel := context.WithCancel(context.Background())
	ch, err := t.backend.StreamKASA(ctx)
	if err != nil {
		cancel()
		dialog.ShowError(err, t.win)
		return
	}

	go func() {
		for ev := range ch {
			ev := ev
			fyne.Do(func() {
				feedData = append(feedData, fmt.Sprintf("[%s] %s: %s",
					ev.Timestamp.Format("15:04:05"), ev.Type, ev.Message))
				list.Refresh()
			})
		}
	}()

	closeBtn := widget.NewButton("Close Stream", cancel)
	title := canvas.NewText(fmt.Sprintf("Live Stream — %s", a.Hostname), asaftheme.NXBlue)
	title.TextSize = 14

	w := fyne.CurrentApp().NewWindow("KASA Live Feed")
	w.Resize(fyne.NewSize(700, 400))
	w.SetContent(container.NewBorder(
		container.NewVBox(title, widget.NewSeparator()),
		container.NewPadded(closeBtn),
		nil, nil,
		container.NewVScroll(list),
	))
	w.SetOnClosed(cancel)
	w.Show()
}

// ── Dialogs ───────────────────────────────────────────────────────────────────


func (t *FleetManagerTab) showExportDialog() {
	dialog.ShowInformation("Export Evidence",
		"Select an enclave in the tree, then use the Evidence Package tab to generate a C3PAO export.", t.win)
}

// ── Data refresh ──────────────────────────────────────────────────────────────

func (t *FleetManagerTab) refresh() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	enclaves, err := t.backend.GetEnclaves(ctx)
	if err != nil {
		return
	}
	assets, err := t.backend.GetAssets(ctx, "")
	if err != nil {
		return
	}
	sort.Slice(enclaves, func(i, j int) bool { return enclaves[i].Name < enclaves[j].Name })
	sort.Slice(assets, func(i, j int) bool { return assets[i].Hostname < assets[j].Hostname })

	byID := make(map[string]hub.Asset, len(assets))
	for _, a := range assets {
		byID[fleetAssetUID(a)] = a
	}

	fyne.Do(func() {
		t.enclaves = enclaves
		t.assets = assets
		t.assetByID = byID
		t.tree.Refresh()
	})
}

// ── Package-level color helpers (shared by all tabs in this package) ──────────

// sprsColorFor returns a color appropriate for an SPRS score.
func sprsColorFor(score int) color.Color {
	switch {
	case score >= 100:
		return asaftheme.NodeGreen
	case score >= 80:
		return asaftheme.NodeOrange
	default:
		return asaftheme.NodeRed
	}
}

// onlineColorFor returns green when online, muted when offline.
func onlineColorFor(online bool) color.Color {
	if online {
		return asaftheme.NodeGreen
	}
	return asaftheme.TextMuted
}

// asafOnlineStr returns a display string for online/offline status.
func asafOnlineStr(online bool) string {
	if online {
		return "● Online"
	}
	return "○ Offline"
}

// asafFormatTime formats a UTC time for display; returns "Never" for zero value.
func asafFormatTime(t time.Time) string {
	if t.IsZero() {
		return "Never"
	}
	return t.UTC().Format("2006-01-02 15:04 UTC")
}
