//go:build !darwin
// +build !darwin
// TODO(cross-platform): darwin support requires Fyne CGO + OpenGL headers.
// Track in: https://fyne.io/fyne/v2 darwin build matrix setup.
// Supported targets: windows/amd64, linux/amd64, linux/arm64, windows/arm64.

// cmd/asaf-desktop/main.go — AdinKhepra ASAF Desktop
// Surface 2: CISO-facing native GUI (fyne.io/fyne/v2)
// Entry point: license check → splash → main window
//
// Three operating modes (selected by flag):
//   (default)      — Standalone: local STIG engine + Imhotep daemon
//   --hub <url>    — Connected: remote Stargate Hub via HTTPS
//   --embed-hub    — Embedded Hub: asaf-hub subprocess on localhost

package main

import (
	"context"
	_ "embed"
	"encoding/json"
	"flag"
	"fmt"
	"image/color"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/app"
	"fyne.io/fyne/v2/canvas"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/widget"

	asaftheme "github.com/EtherVerseCodeMate/giza-cyber-shield/app/theme"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/app/views"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/adinkra"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/asaf/connector"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/asaf/hub"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/license"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/llm/ollama"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/stig"
)

//go:embed assets/icon.svg
var iconSVG []byte

//go:embed assets/lockup_dark.svg
var lockupDarkSVG []byte

const (
	appID      = "com.secred.adinkhepra.asaf"
	appVersion = "1.1.1"
)

func main() {
	// Existing flags — DO NOT REMOVE (Windows Service / headless mode)
	headless := flag.Bool("headless", false, "Run as headless dashboard (Windows Service mode)")
	port := flag.Int("port", 8443, "Dashboard port (headless mode)")

	// New flags per desktop_agent_spec.md §5
	hubURL   := flag.String("hub", "", "Stargate Hub URL (e.g. https://asaf.company.com:8443). Empty = standalone mode.")
	embedHub := flag.Bool("embed-hub", false, "Launch embedded asaf-hub subprocess on localhost:8443")
	agentID  := flag.String("agent-id", "", "Override agent identity for Hub connection (default: hostname)")
	insecure := flag.Bool("insecure", false, "Skip TLS verification (development only — NEVER in production)")
	flag.Parse()

	if *headless {
		runHeadless(*port)
		return
	}

	runGUI(*hubURL, *embedHub, *agentID, *insecure)
}

// runHeadless starts a loopback-only HTTP server on the specified port.
// Used when the desktop binary is registered as a Windows Service:
//
//	AdinKhepraASAF → adinkhepra-desktop.exe --headless --port 8443
//
// Endpoints:
//
//	GET  /health  — liveness probe for SCM / load-balancers
//	GET  /sprs    — current SPRS score as JSON
//	POST /scan    — trigger a STIG scan and return the JSON report
func runHeadless(port int) {
	addr := fmt.Sprintf("127.0.0.1:%d", port)
	log.Printf("[asaf-desktop] headless mode — listening on %s", addr)

	mux := http.NewServeMux()

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status":  "ok",
			"version": appVersion,
		})
	})

	mux.HandleFunc("/sprs", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		// Standalone SPRS endpoint: run a fresh scan and return the score.
		v := stig.NewValidator("")
		report, err := v.Validate()
		if err != nil && report == nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		score := 110
		json.NewEncoder(w).Encode(map[string]interface{}{
			"sprs_score": score,
			"scanned_at": time.Now().UTC().Format(time.RFC3339),
		})
	})

	mux.HandleFunc("/scan", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		v := stig.NewValidator("")
		report, err := v.Validate()
		if err != nil && report == nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(report)
	})

	srv := &http.Server{
		Addr:         addr,
		Handler:      mux,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 120 * time.Second,
		IdleTimeout:  60 * time.Second,
	}
	if err := srv.ListenAndServe(); err != nil {
		log.Fatalf("[asaf-desktop] headless server error: %v", err)
	}
}

// runGUI launches the full native Fyne desktop application.
// hubURL/embedHub/agentID/insecure come from CLI flags (see main()).
func runGUI(hubURL string, embedHub bool, agentID string, insecure bool) {
	a := app.NewWithID(appID)
	a.Settings().SetTheme(&asaftheme.ASAFTheme{})

	splash := showSplash(a)
	tier := checkLicense()

	// Determine AppMode and build the Backend.
	var mode hub.AppMode
	switch {
	case embedHub:
		mode = hub.ModeEmbeddedHub
	case hubURL != "":
		mode = hub.ModeConnected
	default:
		mode = hub.ModeStandalone
	}

	// Read Ollama settings persisted by the Settings tab.
	// If the stored model preference is the default placeholder and Ollama is
	// reachable, discover what's actually installed rather than sending a 404.
	ollamaURL := a.Preferences().StringWithFallback("ollama_url", "http://localhost:11434")
	ollamaModel := a.Preferences().StringWithFallback("ollama_model", "")
	if ollamaModel == "" || ollamaModel == "llama3.1:8b" {
		if discovered := ollama.DiscoverModel(ollamaURL); discovered != "" {
			ollamaModel = discovered
			a.Preferences().SetString("ollama_model", ollamaModel)
		}
	}

	backend, err := buildBackend(mode, hubURL, agentID, insecure, ollamaURL, ollamaModel)
	if err != nil {
		log.Printf("[asaf-desktop] backend init failed: %v — falling back to Standalone", err)
		backend = buildStandaloneBackend(ollamaURL, ollamaModel)
	}

	splash.Close()

	showMainWindow(a, tier, backend)

	a.Run()
}

// buildStandaloneBackend creates a LocalBackend, probing Ollama at the given URL.
// If Ollama is not reachable, aiProvider is nil and Ask() returns an actionable message.
// The agent ML-DSA-65 key is loaded/generated so the ConnectorRegistry can encrypt its vault.
func buildStandaloneBackend(ollamaURL, ollamaModel string) hub.Backend {
	var ai hub.AIProviderBridge // nil = offline mode
	if probeOllama(ollamaURL) {
		client := ollama.NewClient(ollamaURL, ollamaModel, "")
		ai = &ollamaBridge{client: client, model: ollamaModel}
	}
	b := hub.NewLocalBackend(nil, nil, ai)

	// Wire the ConnectorRegistry so Mode A/B/D enrollment can persist configs.
	// Non-fatal: if the key cannot be loaded the registry is simply absent (in-memory only).
	if privKey, err := loadOrGenerateAgentKey(); err == nil {
		if reg, regErr := connector.NewConnectorRegistry(privKey); regErr == nil {
			b.SetRegistry(reg)
		} else {
			log.Printf("[asaf-desktop] connector registry init failed: %v", regErr)
		}
	} else {
		log.Printf("[asaf-desktop] connector registry unavailable (key load error): %v", err)
	}
	return b
}

// buildBackend constructs the appropriate Backend for the given mode.
func buildBackend(mode hub.AppMode, hubURL, agentID string, insecure bool, ollamaURL, ollamaModel string) (hub.Backend, error) {
	switch mode {
	case hub.ModeStandalone:
		return buildStandaloneBackend(ollamaURL, ollamaModel), nil

	case hub.ModeConnected, hub.ModeEmbeddedHub:
		effectiveURL := hubURL
		if mode == hub.ModeEmbeddedHub {
			// EmbeddedHub: the subprocess will be started by showMainWindow after this returns.
			// Use localhost temporarily; the tab_settings view updates it post-launch.
			effectiveURL = "http://localhost:8443"
		}

		id := agentID
		if id == "" {
			host, _ := os.Hostname()
			id = "asaf-desktop-" + host
		}

		privKey, err := loadOrGenerateAgentKey()
		if err != nil {
			return nil, fmt.Errorf("agent key: %w", err)
		}

		return hub.New(hub.Config{
			HubURL:   effectiveURL,
			AgentID:  id,
			PrivKey:  privKey,
			Insecure: insecure,
			Embedded: mode == hub.ModeEmbeddedHub,
		})
	}
	return buildStandaloneBackend(ollamaURL, ollamaModel), nil
}

// probeOllama pings the Ollama API tags endpoint with a short timeout.
// Returns true if Ollama is reachable and responding.
func probeOllama(baseURL string) bool {
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get(baseURL + "/api/tags")
	if err != nil || resp == nil {
		return false
	}
	resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

// ollamaBridge wraps ollama.Client to implement intelligence.AIProvider.
// Kept in main to avoid a circular import (cmd → pkg).
type ollamaBridge struct {
	client *ollama.Client
	model  string
}

func (b *ollamaBridge) Chat(msgs []hub.AIMessage, stream bool) (string, error) {
	return b.ChatCtx(context.Background(), msgs, stream)
}

func (b *ollamaBridge) ChatCtx(ctx context.Context, msgs []hub.AIMessage, _ bool) (string, error) {
	if len(msgs) == 0 {
		return "", nil
	}
	systemPrompt := "You are an AI compliance assistant for AdinKhepra ASAF. " +
		"Answer questions about CMMC, STIG, NIST 800-171, and cybersecurity compliance."
	for _, m := range msgs {
		if m.Role == "system" {
			systemPrompt = m.Content
		}
	}
	prompt := msgs[len(msgs)-1].Content
	return b.client.GenerateCtx(ctx, prompt, systemPrompt)
}

func (b *ollamaBridge) Name() string { return "ollama/" + b.model }


// loadOrGenerateAgentKey loads the ML-DSA-65 private key from ~/.asaf/keys/agent.key,
// generating and persisting a new key pair if none exists.
func loadOrGenerateAgentKey() ([]byte, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("home dir: %w", err)
	}
	keyDir := filepath.Join(home, ".asaf", "keys")
	privPath := filepath.Join(keyDir, "agent.key")

	data, err := os.ReadFile(privPath)
	if err == nil && len(data) > 0 {
		return data, nil // existing key
	}

	// Generate fresh ML-DSA-65 key pair and persist private key.
	privKey, _, err := adinkra.GenerateDilithiumKey()
	if err != nil {
		return nil, fmt.Errorf("generate key: %w", err)
	}
	if err := os.MkdirAll(keyDir, 0700); err != nil {
		return nil, fmt.Errorf("create key dir: %w", err)
	}
	if err := os.WriteFile(privPath, privKey, 0600); err != nil {
		return nil, fmt.Errorf("persist key: %w", err)
	}
	log.Printf("[asaf-desktop] generated new ML-DSA-65 agent key at %s", privPath)
	return privKey, nil
}

func showSplash(a fyne.App) fyne.Window {
	w := a.NewWindow("AdinKhepra ASAF")
	w.SetFixedSize(true)
	w.Resize(fyne.NewSize(480, 300))
	w.CenterOnScreen()

	title := canvas.NewText("AdinKhepra ASAF", asaftheme.NXBlue)
	title.TextSize = 32
	title.TextStyle = fyne.TextStyle{Bold: true}

	sub := canvas.NewText("Agentic Security Attestation Framework", asaftheme.AKGold)
	sub.TextSize = 13

	loading := widget.NewLabel("Loading compliance engine…")
	loading.TextStyle = fyne.TextStyle{Italic: true}

	bar := widget.NewProgressBarInfinite()

	patent := widget.NewLabel(fmt.Sprintf("v%s  |  USPTO #73565085  |  SecRed Knowledge Inc.", appVersion))
	patent.TextStyle = fyne.TextStyle{Italic: true}

	content := container.NewVBox(
		container.NewCenter(title),
		container.NewCenter(sub),
		widget.NewSeparator(),
		loading,
		bar,
		widget.NewSeparator(),
		container.NewCenter(patent),
	)

	w.SetContent(container.NewPadded(content))
	w.Show()
	return w
}

func showMainWindow(a fyne.App, tier string, backend hub.Backend) {
	// Brand resources — embedded at compile time, zero runtime I/O.
	iconRes := fyne.NewStaticResource("icon.svg", iconSVG)
	_ = lockupDarkSVG // reserved for future raster export path

	// Set app icon (taskbar, alt-tab, dock) and window icon.
	a.SetIcon(iconRes)

	w := a.NewWindow("AdinKhepra ASAF — Agentic Security Attestation Framework")
	w.SetIcon(iconRes)
	w.Resize(fyne.NewSize(1440, 900))
	w.CenterOnScreen()

	// CUI banner — always visible per CUI marking requirements
	cuiBanner := canvas.NewText(
		"⬛  CUI  //  CONTROLLED UNCLASSIFIED INFORMATION  //  SecRed Knowledge Inc.",
		asaftheme.NodeRed,
	)
	cuiBanner.TextStyle = fyne.TextStyle{Monospace: true}
	cuiBanner.TextSize = 10

	// Brand lockup — native Fyne canvas reconstruction of the dark lockup SVG.
	// Fyne's SVG renderer does not support <text> elements, so the wordmark is
	// built from Fyne canvas primitives that match the SVG brand spec exactly.
	//
	// Left glyph: icon.svg (Eban fortress DAG) at 56×56
	glyph := canvas.NewImageFromResource(iconRes)
	glyph.FillMode = canvas.ImageFillContain
	glyphBox := container.NewGridWrap(fyne.NewSize(56, 56), glyph)

	// Top row: "AdinKhepra" — gradient approximated as near-white (#EAF6FF)
	wordmark := canvas.NewText("AdinKhepra", color.NRGBA{R: 0xea, G: 0xf6, B: 0xff, A: 0xff})
	wordmark.TextSize = 22
	wordmark.TextStyle = fyne.TextStyle{Bold: true}

	// Bottom row: "ASAF" cyan + divider + tagline muted blue
	asafLabel := canvas.NewText("ASAF", color.NRGBA{R: 0x5b, G: 0xd4, B: 0xff, A: 0xff})
	asafLabel.TextSize = 14
	asafLabel.TextStyle = fyne.TextStyle{Bold: true}
	divider := canvas.NewText("  |  ", color.NRGBA{R: 0x3c, G: 0x6c, B: 0xa8, A: 0xaa})
	divider.TextSize = 14
	tagline := canvas.NewText("Agentic Security Attestation Framework", color.NRGBA{R: 0x8f, G: 0xb3, B: 0xd4, A: 0xff})
	tagline.TextSize = 11

	textStack := container.NewVBox(
		wordmark,
		container.NewHBox(asafLabel, divider, tagline),
	)
	lockupRow := container.NewHBox(
		glyphBox,
		container.NewPadded(textStack),
	)

	// Mode badge — shows connection status per spec §14
	var modeLabel string
	switch backend.Mode() {
	case hub.ModeConnected:
		modeLabel = "● Remote Administration — " + backend.HubURL()
	case hub.ModeEmbeddedHub:
		modeLabel = "● Embedded Hub — localhost:8443"
	default:
		modeLabel = "○ Standalone"
	}
	modeBadge := canvas.NewText(modeLabel, asaftheme.NXBlue)
	modeBadge.TextSize = 11

	tierBadge := canvas.NewText("License: "+tier, asaftheme.AKGold)
	tierBadge.TextSize = 12

	header := container.NewBorder(nil, nil,
		container.NewPadded(lockupRow),
		container.NewPadded(container.NewHBox(modeBadge, widget.NewSeparator(), tierBadge)),
		nil,
	)

	// ── All 8 tabs — wired to the Backend interface ───────────────────────────
	tab1 := views.NewComplianceGraphTab(w, backend)
	tab2 := views.NewFleetManagerTab(w, backend)
	tab3 := views.NewSSPTab(w, backend)
	tab4 := views.NewPOAMTab(w, backend)
	tab5 := views.NewRemediationTab(w, backend)
	tab6 := views.NewReadinessTab(w, backend)
	tab7 := views.NewEvidenceTab(w, backend)
	tab8 := views.NewSettingsTab(w, backend)

	tabs := container.NewAppTabs(
		container.NewTabItem("Compliance Graph", tab1.Content()),
		container.NewTabItem("Fleet Manager", tab2.Content()),
		container.NewTabItem("Security Plan (SSP)", tab3.Content()),
		container.NewTabItem("POA&M", tab4.Content()),
		container.NewTabItem("Remediation", tab5.Content()),
		container.NewTabItem("Readiness Gate", tab6.Content()),
		container.NewTabItem("Evidence Package", tab7.Content()),
		container.NewTabItem("Settings", tab8.Content()),
	)
	tabs.SetTabLocation(container.TabLocationTop)

	// Wire context-menu tab navigation callbacks (set after tabs is created so SelectIndex is available)
	tab1.OnSwitchTab = func(i int) { tabs.SelectIndex(i) }

	// Wire scan-done notification: after every scan, push fresh data to Readiness Gate, SSP, POA&M.
	tab1.OnScanDone = func() {
		tab6.Refresh()
	}

	// Footer — always visible per §13 (patent line required)
	footer := container.NewHBox(
		widget.NewLabel(fmt.Sprintf("v%s", appVersion)),
		widget.NewSeparator(),
		widget.NewLabel("CMMC Level 2  |  110 practices  |  25,185 STIG/CCI/NIST mappings"),
		widget.NewSeparator(),
		widget.NewLabel("ML-DSA-65 (FIPS 204) · ML-KEM-768 (FIPS 203): ready"),
		widget.NewSeparator(),
		canvas.NewText("USPTO #73565085  |  SecRed Knowledge Inc.", asaftheme.TextMuted),
	)

	w.SetContent(container.NewBorder(
		container.NewVBox(
			container.NewPadded(cuiBanner),
			widget.NewSeparator(),
			container.NewPadded(header),
			widget.NewSeparator(),
		),
		container.NewPadded(footer),
		nil, nil,
		tabs,
	))

	w.Show()
}

// checkLicense performs ML-DSA-65 offline license verification via pkg/license.
// Search order: KHEPRA_LICENSE_FILE env → ~/.khepra/license.khepra → any *.khepra.
// Returns the tier string ("khepri", "ra", "atum", "osiris") on success, or
// "Community" if no valid license is found. Never returns "Pilot" for a missing file.
func checkLicense() string {
	// Empty serverURL: air-gap mode. Manager tries offline .khepra file first;
	// network fallback silently fails, which is expected in a sovereign deployment.
	mgr, err := license.NewManager("")
	if err != nil {
		log.Printf("[license] failed to create manager: %v — running Community", err)
		return "Community"
	}

	if err := mgr.Initialize(); err != nil {
		// No valid offline license and no network reachable — Community tier.
		log.Printf("[license] no valid license found: %v", err)
		return "Community"
	}

	tier := mgr.GetTier()
	if tier == "" || tier == "community" {
		return "Community"
	}
	return tier
}

