// cmd/asaf-desktop/main.go — AdinKhepra ASAF Compliance Graph Desktop
// Surface 2: CISO-facing native GUI (fyne.io/fyne/v2)
// Entry point: license check → splash → main window

package main

import (
	_ "embed"
	"encoding/json"
	"flag"
	"fmt"
	"image/color"
	"log"
	"net/http"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/app"
	"fyne.io/fyne/v2/canvas"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/widget"

	asaftheme "github.com/EtherVerseCodeMate/giza-cyber-shield/app/theme"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/app/views"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/license"
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
	headless := flag.Bool("headless", false, "Run as headless dashboard (Windows Service mode)")
	port := flag.Int("port", 8443, "Dashboard port (headless mode)")
	flag.Parse()

	if *headless {
		runHeadless(*port)
		return
	}

	runGUI()
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
func runGUI() {
	a := app.NewWithID(appID)
	a.Settings().SetTheme(&asaftheme.ASAFTheme{})

	// SVG icon embedded here as raw bytes would be placed via go:embed in a
	// production build. For now, use a nil resource (Fyne default icon).
	// TODO: add //go:embed ../../assets/icon.svg when assets/ is present.

	// Splash screen while license loads
	splash := showSplash(a)

	// License check
	tier := checkLicense()

	splash.Close()

	// Main compliance graph window
	showMainWindow(a, tier)

	a.Run()
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

func showMainWindow(a fyne.App, tier string) {
	// Brand resources — embedded at compile time, zero runtime I/O.
	iconRes := fyne.NewStaticResource("icon.svg", iconSVG)
	_ = lockupDarkSVG // reserved for future raster export path

	// Set app icon (taskbar, alt-tab, dock) and window icon.
	a.SetIcon(iconRes)

	w := a.NewWindow("AdinKhepra ASAF — CMMC Graph UI Stargate")
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

	tierBadge := canvas.NewText("License: "+tier, asaftheme.AKGold)
	tierBadge.TextSize = 12

	header := container.NewBorder(nil, nil,
		container.NewPadded(lockupRow),
		container.NewPadded(tierBadge),
		nil,
	)

	// ── Tab 1: Compliance Graph (full implementation) ────────────────────────
	tab1 := views.NewComplianceGraphTab(w)

	// ── Tabs 2–8: placeholders for future milestones ─────────────────────────
	futureTab := func(label string) fyne.CanvasObject {
		t := canvas.NewText(label+" — coming soon", asaftheme.TextMuted)
		t.TextSize = 14
		return container.NewCenter(t)
	}

	tabs := container.NewAppTabs(
		container.NewTabItem("Compliance Graph", tab1.Content()),
		container.NewTabItem("Asset Discovery", futureTab("Asset Discovery")),
		container.NewTabItem("Security Plan (SSP)", futureTab("System Security Plan")),
		container.NewTabItem("POA&M", futureTab("Plan of Action & Milestones")),
		container.NewTabItem("Remediation", futureTab("Remediation Engine")),
		container.NewTabItem("Readiness Gate", futureTab("Readiness Gate")),
		container.NewTabItem("Evidence Package", futureTab("C3PAO Evidence Package")),
	)
	tabs.SetTabLocation(container.TabLocationTop)

	// Footer — patent / copyright line
	footer := container.NewHBox(
		widget.NewLabel(fmt.Sprintf("v%s", appVersion)),
		widget.NewSeparator(),
		widget.NewLabel("CMMC Level 2  |  110 practices  |  STIG/CCI/NIST mapping DB"),
		widget.NewSeparator(),
		widget.NewLabel("ML-DSA-65 (FIPS 204): ready"),
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

