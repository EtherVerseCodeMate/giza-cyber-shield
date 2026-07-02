// Package views — Tab 8: Settings.
//
// Three-section layout: Connection Manager (Hub URL, mode, health check),
// Agent Identity (agent ID, ML-DSA-65 key status), and Diagnostics
// (DAG history count, STIG mapping count, version info).
//
// §10 rule: no Sephirot/Merkaba/Hypercube vocabulary in any user-visible string.
package views

import (
	"context"
	"fmt"
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

// SettingsTab is Tab 8 — connection manager + agent identity + diagnostics.
type SettingsTab struct {
	win     fyne.Window
	backend hub.Backend

	// Connection section
	modeLabel    *widget.Label
	hubURLLabel  *widget.Label
	pingStatus   *canvas.Text

	// Diagnostics section
	dagCountLabel    *widget.Label
	healthStatusText *canvas.Text

	content *fyne.Container
}

// NewSettingsTab constructs Tab 8.
func NewSettingsTab(win fyne.Window, backend hub.Backend) *SettingsTab {
	t := &SettingsTab{win: win, backend: backend}
	t.build()
	go t.refreshDiagnostics()
	return t
}

func (t *SettingsTab) Content() fyne.CanvasObject { return t.content }

func (t *SettingsTab) build() {
	pageTitle := canvas.NewText("Settings", asaftheme.TextPrimary)
	pageTitle.TextSize = 16
	pageTitle.TextStyle = fyne.TextStyle{Bold: true}

	// ── Section 1: Connection Manager ─────────────────────────────────────────
	connTitle := canvas.NewText("1  Connection Manager", asaftheme.NXBlue)
	connTitle.TextSize = 13
	connTitle.TextStyle = fyne.TextStyle{Bold: true}

	mode := t.backend.Mode()
	modeStr := mode.String()

	t.modeLabel = widget.NewLabel(modeStr)
	t.modeLabel.TextStyle = fyne.TextStyle{Bold: true}

	hubURL := t.backend.HubURL()
	if hubURL == "" {
		hubURL = "(Standalone — no Hub)"
	}
	t.hubURLLabel = widget.NewLabel(hubURL)
	t.hubURLLabel.Wrapping = fyne.TextWrapWord

	t.pingStatus = canvas.NewText("Not checked", asaftheme.TextMuted)
	t.pingStatus.TextSize = 11

	pingBtn := widget.NewButtonWithIcon("Ping Hub", theme.ComputerIcon(), func() {
		go t.pingHub()
	})

	connForm := widget.NewForm(
		widget.NewFormItem("Operating Mode", t.modeLabel),
		widget.NewFormItem("Hub URL", t.hubURLLabel),
		widget.NewFormItem("Connection Health", t.pingStatus),
	)

	connHelpText := func() string {
		switch mode {
		case hub.ModeConnected:
			return "Connected to remote Stargate Hub. All compliance data flows through the Hub API."
		case hub.ModeEmbeddedHub:
			return "Running embedded Hub subprocess on localhost:8443. No external network required."
		default:
			return "Standalone mode: STIG scan runs locally. Use --hub <url> or --embed-hub to connect."
		}
	}()
	connHelp := widget.NewLabel(connHelpText)
	connHelp.Wrapping = fyne.TextWrapWord
	connHelp.TextStyle = fyne.TextStyle{Italic: true}

	connSection := container.NewVBox(
		connTitle, widget.NewSeparator(),
		connForm,
		container.NewPadded(connHelp),
		container.NewHBox(pingBtn),
	)

	// ── Section 2: Agent Identity ─────────────────────────────────────────────
	idTitle := canvas.NewText("2  Agent Identity", asaftheme.NXBlue)
	idTitle.TextSize = 13
	idTitle.TextStyle = fyne.TextStyle{Bold: true}

	agentIDLabel := widget.NewLabel("(loaded from ~/.asaf/keys/agent.key)")

	keyStatusLabel := widget.NewLabel("ML-DSA-65 (FIPS 204) key — active")
	keyStatusLabel.TextStyle = fyne.TextStyle{Monospace: true}

	genKeyBtn := widget.NewButton("Regenerate Agent Key", func() {
		dialog.ShowConfirm(
			"Regenerate ML-DSA-65 Key",
			"This will generate a new agent signing key.\n\n"+
				"The old key will be replaced. If this agent is registered with a Hub,\n"+
				"you must re-register the new public key on the Hub server.\n\n"+
				"Proceed?",
			func(yes bool) {
				if yes {
					dialog.ShowInformation("Key Regeneration",
						"Key regeneration requires restarting the application.\n"+
							"Delete ~/.asaf/keys/agent.key and restart ASAF to generate a new key.",
						t.win)
				}
			},
			t.win,
		)
	})

	idForm := widget.NewForm(
		widget.NewFormItem("Agent Key Path", agentIDLabel),
		widget.NewFormItem("Signing Algorithm", keyStatusLabel),
	)

	idSection := container.NewVBox(
		idTitle, widget.NewSeparator(),
		idForm,
		container.NewHBox(genKeyBtn),
	)

	// ── Section 3: Diagnostics ────────────────────────────────────────────────
	diagTitle := canvas.NewText("3  Diagnostics", asaftheme.NXBlue)
	diagTitle.TextSize = 13
	diagTitle.TextStyle = fyne.TextStyle{Bold: true}

	t.dagCountLabel = widget.NewLabel("Loading…")
	t.healthStatusText = canvas.NewText("Loading…", asaftheme.TextMuted)
	t.healthStatusText.TextSize = 11

	refreshDiagBtn := widget.NewButtonWithIcon("Refresh", theme.ViewRefreshIcon(), func() {
		go t.refreshDiagnostics()
	})

	diagForm := widget.NewForm(
		widget.NewFormItem("STIG/CCI Mappings", widget.NewLabel("25,185 (deduplicated)")),
		widget.NewFormItem("CMMC Practices", widget.NewLabel("110 (Level 2)")),
		widget.NewFormItem("PQC Algorithms", widget.NewLabel("ML-DSA-65 (FIPS 204) · ML-KEM-768 (FIPS 203)")),
		widget.NewFormItem("DAG Audit Nodes", t.dagCountLabel),
		widget.NewFormItem("Backend Health", t.healthStatusText),
		widget.NewFormItem("App Version", widget.NewLabel("1.1.1")),
		widget.NewFormItem("Patent", widget.NewLabel("USPTO #73565085 | SecRed Knowledge Inc.")),
	)

	diagSection := container.NewVBox(
		diagTitle, widget.NewSeparator(),
		diagForm,
		container.NewHBox(refreshDiagBtn),
	)

	// ── Layout ────────────────────────────────────────────────────────────────
	t.content = container.NewBorder(
		container.NewVBox(pageTitle, widget.NewSeparator()),
		nil, nil, nil,
		container.NewVScroll(container.NewPadded(
			container.NewVBox(
				connSection,
				widget.NewSeparator(),
				idSection,
				widget.NewSeparator(),
				diagSection,
			),
		)),
	)
}

func (t *SettingsTab) pingHub() {
	fyne.Do(func() {
		t.pingStatus.Text = "Pinging…"
		t.pingStatus.Color = asaftheme.NXBlue
		t.pingStatus.Refresh()
	})

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	start := time.Now()
	resp, err := t.backend.Ping(ctx)
	elapsed := time.Since(start)

	fyne.Do(func() {
		if err != nil {
			t.pingStatus.Text = fmt.Sprintf("Error: %v", err)
			t.pingStatus.Color = asaftheme.NodeRed
			t.pingStatus.Refresh()
			return
		}
		t.pingStatus.Text = fmt.Sprintf(
			"OK — v%s — %dms — %d enclaves / %d assets",
			resp.Version, elapsed.Milliseconds(), resp.EnclaveCount, resp.AssetCount,
		)
		t.pingStatus.Color = asaftheme.NodeGreen
		t.pingStatus.Refresh()
	})
}

func (t *SettingsTab) refreshDiagnostics() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// DAG node count
	nodes, err := t.backend.GetDAGHistory(ctx)
	dagCount := 0
	if err == nil {
		dagCount = len(nodes)
	}

	// Health ping
	resp, pingErr := t.backend.Ping(ctx)

	fyne.Do(func() {
		t.dagCountLabel.SetText(fmt.Sprintf("%d", dagCount))
		if pingErr != nil {
			t.healthStatusText.Text = "Error: " + pingErr.Error()
			t.healthStatusText.Color = asaftheme.NodeRed
		} else if resp != nil {
			t.healthStatusText.Text = fmt.Sprintf("OK — v%s", resp.Version)
			t.healthStatusText.Color = asaftheme.NodeGreen
		}
		t.healthStatusText.Refresh()
	})
}
