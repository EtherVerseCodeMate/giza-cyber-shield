// Package views — Tab 4: Plan of Action & Milestones (POA&M).
//
// Displays open findings as a sortable table; each row links to the
// STIG control, CMMC practice, due date, and assigned remediation owner.
//
// §10 rule: no Sephirot/Merkaba/Hypercube vocabulary in any user-visible string.
package views

import (
	"context"
	"fmt"
	"sort"
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

// poamEntry is one open finding row in the POA&M table.
type poamEntry struct {
	ID          string
	ControlID   string
	Title       string
	Severity    string
	Status      string
	Asset       string
	DueDate     string
	Owner       string
	Description string
}

// POAMTab is Tab 4 — Plan of Action & Milestones.
type POAMTab struct {
	win     fyne.Window
	backend hub.Backend

	entries     []poamEntry
	filterSev   string
	filterOwner string

	table       *widget.Table
	statusLabel *canvas.Text
	content     *fyne.Container
}

// NewPOAMTab constructs Tab 4.
func NewPOAMTab(win fyne.Window, backend hub.Backend) *POAMTab {
	t := &POAMTab{
		win:       win,
		backend:   backend,
		filterSev: "All",
	}
	t.build()
	go t.refresh()
	return t
}

func (t *POAMTab) Content() fyne.CanvasObject { return t.content }

// headers for the POA&M table.
var poamHeaders = []string{"Control ID", "Severity", "Title", "Asset", "Owner", "Due Date", "Status"}

func (t *POAMTab) build() {
	title := canvas.NewText("Plan of Action & Milestones", asaftheme.TextPrimary)
	title.TextSize = 16
	title.TextStyle = fyne.TextStyle{Bold: true}

	t.statusLabel = canvas.NewText("Loading…", asaftheme.TextMuted)
	t.statusLabel.TextSize = 11

	// Filter controls
	sevSelect := widget.NewSelect([]string{"All", "CAT I", "CAT II", "CAT III"}, func(v string) {
		t.filterSev = v
		fyne.Do(func() { t.table.Refresh() })
	})
	sevSelect.SetSelected("All")

	ownerEntry := widget.NewEntry()
	ownerEntry.SetPlaceHolder("Filter by owner…")
	ownerEntry.OnChanged = func(v string) {
		t.filterOwner = strings.ToLower(v)
		fyne.Do(func() { t.table.Refresh() })
	}

	refreshBtn := widget.NewButtonWithIcon("", theme.ViewRefreshIcon(), func() { go t.refresh() })
	exportBtn := widget.NewButtonWithIcon("Export CSV", theme.DocumentSaveIcon(), func() { t.exportCSV() })

	filters := container.NewHBox(
		widget.NewLabel("Severity:"), sevSelect,
		widget.NewLabel("Owner:"), ownerEntry,
		widget.NewSeparator(),
		refreshBtn, exportBtn,
	)

	// Table
	t.table = widget.NewTable(
		func() (int, int) {
			return len(t.visibleRows()) + 1, len(poamHeaders)
		},
		func() fyne.CanvasObject {
			return widget.NewLabel("")
		},
		func(cell widget.TableCellID, obj fyne.CanvasObject) {
			lbl := obj.(*widget.Label)
			rows := t.visibleRows()
			if cell.Row == 0 {
				lbl.TextStyle = fyne.TextStyle{Bold: true}
				lbl.SetText(poamHeaders[cell.Col])
				return
			}
			lbl.TextStyle = fyne.TextStyle{}
			if cell.Row-1 >= len(rows) {
				lbl.SetText("")
				return
			}
			row := rows[cell.Row-1]
			lbl.SetText(t.cellText(row, cell.Col))
		},
	)
	t.table.SetColumnWidth(0, 140)
	t.table.SetColumnWidth(1, 75)
	t.table.SetColumnWidth(2, 300)
	t.table.SetColumnWidth(3, 160)
	t.table.SetColumnWidth(4, 120)
	t.table.SetColumnWidth(5, 110)
	t.table.SetColumnWidth(6, 100)

	t.table.OnSelected = func(cell widget.TableCellID) {
		if cell.Row == 0 {
			return
		}
		rows := t.visibleRows()
		if cell.Row-1 >= len(rows) {
			return
		}
		t.showEntryDetail(rows[cell.Row-1])
	}

	t.content = container.NewBorder(
		container.NewVBox(
			title, widget.NewSeparator(),
			filters, widget.NewSeparator(),
			t.statusLabel,
		),
		nil, nil, nil,
		t.table,
	)
}

func (t *POAMTab) cellText(e poamEntry, col int) string {
	switch col {
	case 0:
		return e.ControlID
	case 1:
		return e.Severity
	case 2:
		return e.Title
	case 3:
		return e.Asset
	case 4:
		return e.Owner
	case 5:
		return e.DueDate
	case 6:
		return e.Status
	}
	return ""
}

func (t *POAMTab) visibleRows() []poamEntry {
	var out []poamEntry
	for _, e := range t.entries {
		if t.filterSev != "All" && e.Severity != t.filterSev {
			continue
		}
		if t.filterOwner != "" && !strings.Contains(strings.ToLower(e.Owner), t.filterOwner) {
			continue
		}
		out = append(out, e)
	}
	return out
}

func (t *POAMTab) showEntryDetail(e poamEntry) {
	body := fmt.Sprintf(
		"Control ID: %s\nSeverity: %s\nStatus: %s\nAsset: %s\nOwner: %s\nDue: %s\n\n%s",
		e.ControlID, e.Severity, e.Status, e.Asset, e.Owner, e.DueDate, e.Description,
	)
	dialog.ShowInformation(fmt.Sprintf("POA&M Item — %s", e.ControlID), body, t.win)
}

func (t *POAMTab) exportCSV() {
	rows := t.visibleRows()
	if len(rows) == 0 {
		dialog.ShowInformation("Nothing to Export",
			"No POA&M items match the current filter.", t.win)
		return
	}
	var sb strings.Builder
	sb.WriteString(strings.Join(poamHeaders, ",") + "\n")
	for _, row := range rows {
		sb.WriteString(fmt.Sprintf("%q,%q,%q,%q,%q,%q,%q\n",
			row.ControlID, row.Severity, row.Title,
			row.Asset, row.Owner, row.DueDate, row.Status))
	}
	t.win.Clipboard().SetContent(sb.String())
	dialog.ShowInformation("Exported",
		fmt.Sprintf("%d POA&M items copied to clipboard as CSV.", len(rows)), t.win)
}

func (t *POAMTab) refresh() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pending, err := t.backend.GetPendingApprovals(ctx)
	if err != nil {
		fyne.Do(func() {
			t.statusLabel.Text = "Error loading POA&M: " + err.Error()
			t.statusLabel.Color = asaftheme.NodeRed
			t.statusLabel.Refresh()
		})
		return
	}

	entries := make([]poamEntry, 0, len(pending))
	for _, p := range pending {
		// Derive severity from staging result: failed staging → CAT I
		sev := "CAT II"
		if !p.StagedOK {
			sev = "CAT I"
		}
		dueDate := p.StagedAt.AddDate(0, 0, 90).Format("2006-01-02")
		title := p.ControlID + " — " + p.Hostname
		entries = append(entries, poamEntry{
			ID:          p.ID,
			ControlID:   p.ControlID,
			Title:       title,
			Severity:    sev,
			Status:      "Open",
			Asset:       p.Hostname,
			DueDate:     dueDate,
			Owner:       "ISSO",
			Description: p.StagedDiff,
		})
	}

	sort.Slice(entries, func(i, j int) bool {
		si := sevOrder(entries[i].Severity)
		sj := sevOrder(entries[j].Severity)
		if si != sj {
			return si < sj
		}
		return entries[i].ControlID < entries[j].ControlID
	})

	fyne.Do(func() {
		t.entries = entries
		t.statusLabel.Text = fmt.Sprintf(
			"%d open POA&M items  |  Updated %s",
			len(entries), time.Now().Format("15:04:05"),
		)
		t.statusLabel.Color = asaftheme.TextMuted
		t.statusLabel.Refresh()
		t.table.Refresh()
	})
}

func sevOrder(sev string) int {
	switch sev {
	case "CAT I":
		return 0
	case "CAT II":
		return 1
	default:
		return 2
	}
}
