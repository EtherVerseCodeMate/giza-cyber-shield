// Package views — Tab 8: Settings.
//
// Four-section layout:
//  1. Connection Manager — Hub URL, mode, health check
//  2. AI Provider        — Ollama URL, model selection, Ping AI button
//  3. Agent Identity     — agent ID, ML-DSA-65 key status
//  4. Diagnostics        — DAG history count, STIG mapping count, version info
//
// §10 rule: no Sephirot/Merkaba/Hypercube vocabulary in any user-visible string.
package views

import (
	"context"
	"fmt"
	"net/http"
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

// SettingsTab is Tab 8 — connection manager + AI provider + agent identity + diagnostics.
type SettingsTab struct {
	win     fyne.Window
	backend hub.Backend

	// Connection section
	modeLabel   *widget.Label
	hubURLLabel *canvas.Text
	pingStatus  *canvas.Text

	// AI Provider section
	ollamaURLEntry   *widget.Entry
	ollamaModelEntry *widget.Entry
	aiStatus         *canvas.Text

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
	go t.autoDetectOllama() // probe Ollama on startup
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
	t.hubURLLabel = canvas.NewText(hubURL, asaftheme.TextMuted)
	t.hubURLLabel.TextSize = 12

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
			return "Connected to remote Stargate hub. All compliance data flows through the Hub API."
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

	// ── Section 2: AI Provider (Ollama / Local LLM) ────────────────────────────
	aiTitle := canvas.NewText("2  AI Provider — Ask AI", asaftheme.NXBlue)
	aiTitle.TextSize = 13
	aiTitle.TextStyle = fyne.TextStyle{Bold: true}

	t.ollamaURLEntry = widget.NewEntry()
	t.ollamaURLEntry.SetPlaceHolder("http://localhost:11434")
	t.ollamaURLEntry.SetText("http://localhost:11434")

	t.ollamaModelEntry = widget.NewEntry()
	t.ollamaModelEntry.SetPlaceHolder("llama3.1:8b")
	t.ollamaModelEntry.SetText("llama3.1:8b")

	t.aiStatus = canvas.NewText("Checking…", asaftheme.TextMuted)
	t.aiStatus.TextSize = 11

	pingOllamaBtn := widget.NewButtonWithIcon("Ping AI", theme.SearchIcon(), func() {
		go t.pingOllama()
	})

	aiHelpText := widget.NewLabel(
		"In Standalone mode, Ask AI connects to a local Ollama instance.\n" +
			"Install Ollama: https://ollama.com — then run: ollama pull llama3.1:8b\n" +
			"When connected to a Stargate Hub, AI routes through the Hub's LLM provider.",
	)
	aiHelpText.Wrapping = fyne.TextWrapWord
	aiHelpText.TextStyle = fyne.TextStyle{Italic: true}

	aiForm := widget.NewForm(
		widget.NewFormItem("Ollama URL", t.ollamaURLEntry),
		widget.NewFormItem("Model", t.ollamaModelEntry),
		widget.NewFormItem("AI Status", t.aiStatus),
	)

	applyAIBtn := widget.NewButton("Apply & Save", func() {
		go t.applyOllamaSettings()
	})

	aiSection := container.NewVBox(
		aiTitle, widget.NewSeparator(),
		aiForm,
		container.NewPadded(aiHelpText),
		container.NewHBox(pingOllamaBtn, applyAIBtn),
	)

	// ── Section 3: Agent Identity ─────────────────────────────────────────────
	idTitle := canvas.NewText("3  Agent Identity", asaftheme.NXBlue)
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

	// ── Section 4: Diagnostics ────────────────────────────────────────────────
	diagTitle := canvas.NewText("4  Diagnostics", asaftheme.NXBlue)
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
				aiSection,
				widget.NewSeparator(),
				idSection,
				widget.NewSeparator(),
				diagSection,
			),
		)),
	)
}

// ── AI Provider ───────────────────────────────────────────────────────────────

// autoDetectOllama probes localhost:11434 at startup and updates the AI status label.
func (t *SettingsTab) autoDetectOllama() {
	url := "http://localhost:11434/api/tags"
	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get(url)
	fyne.Do(func() {
		if err != nil || resp == nil || resp.StatusCode != http.StatusOK {
			t.aiStatus.Text = "Ollama not detected — see instructions below"
			t.aiStatus.Color = asaftheme.TextMuted
		} else {
			resp.Body.Close()
			t.aiStatus.Text = "● Ollama running at localhost:11434 — Ask AI ready"
			t.aiStatus.Color = asaftheme.NodeGreen
		}
		t.aiStatus.Refresh()
	})
}

// pingOllama tests the configured Ollama URL on demand.
func (t *SettingsTab) pingOllama() {
	rawURL := strings.TrimRight(t.ollamaURLEntry.Text, "/")
	if rawURL == "" {
		rawURL = "http://localhost:11434"
	}
	url := rawURL + "/api/tags"

	fyne.Do(func() {
		t.aiStatus.Text = "Pinging Ollama…"
		t.aiStatus.Color = asaftheme.NXBlue
		t.aiStatus.Refresh()
	})

	client := &http.Client{Timeout: 5 * time.Second}
	start := time.Now()
	resp, err := client.Get(url)
	elapsed := time.Since(start)

	fyne.Do(func() {
		if err != nil {
			t.aiStatus.Text = "✗ Ollama not reachable: " + err.Error()
			t.aiStatus.Color = asaftheme.NodeRed
		} else {
			resp.Body.Close()
			t.aiStatus.Text = fmt.Sprintf("● Ollama OK — %dms — model: %s",
				elapsed.Milliseconds(), t.ollamaModelEntry.Text)
			t.aiStatus.Color = asaftheme.NodeGreen
		}
		t.aiStatus.Refresh()
	})
}

// applyOllamaSettings persists the Ollama URL/model to Fyne preferences
// so they survive restarts. The Backend picks them up on next Ask() call
// via the stored preference (see cmd/asaf-desktop/main.go buildBackend).
func (t *SettingsTab) applyOllamaSettings() {
	url := strings.TrimRight(t.ollamaURLEntry.Text, "/")
	model := strings.TrimSpace(t.ollamaModelEntry.Text)
	if url == "" {
		url = "http://localhost:11434"
	}
	if model == "" {
		model = "llama3.1:8b"
	}

	// Persist to Fyne app preferences (survives restarts).
	a := fyne.CurrentApp()
	if a != nil {
		a.Preferences().SetString("ollama_url", url)
		a.Preferences().SetString("ollama_model", model)
	}

	go t.pingOllama()

	fyne.Do(func() {
		dialog.ShowInformation("AI Provider Saved",
			fmt.Sprintf("Ollama URL: %s\nModel: %s\n\nRestart the app to activate the new AI provider.", url, model),
			t.win)
	})
}

// ── Hub ───────────────────────────────────────────────────────────────────────

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

// ── Diagnostics ───────────────────────────────────────────────────────────────

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
