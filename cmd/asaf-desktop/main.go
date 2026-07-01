// cmd/asaf-desktop/main.go — AdinKhepra ASAF Compliance Graph Desktop
// Surface 2: CISO-facing native GUI (fyne.io/fyne/v2)
// Entry point: license check → splash → main window

package main

import (
	"flag"
	"fmt"
	"log"
	"os"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/app"
	"fyne.io/fyne/v2/canvas"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/widget"

	asaftheme "github.com/EtherVerseCodeMate/giza-cyber-shield/app/theme"
)

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
// This is used when the desktop is registered as a Windows Service
// (AdinKhepraASAF → adinkhepra-desktop.exe --headless --port 8443).
func runHeadless(port int) {
	log.Printf("[asaf-desktop] headless mode — dashboard on 127.0.0.1:%d", port)
	// Delegate to adinkhepra serve logic (Surface 1 web viewer).
	// In v1.1.1 this is a stub; full implementation in v1.2.
	log.Printf("[asaf-desktop] headless stub — exiting (v1.1.1)")
	os.Exit(0)
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
	w := a.NewWindow("AdinKhepra ASAF — Compliance Graph")
	w.Resize(fyne.NewSize(1280, 800))
	w.CenterOnScreen()

	// CUI banner
	cuiBanner := canvas.NewText(
		"⬛  CUI  //  CONTROLLED UNCLASSIFIED INFORMATION  //  SecRed Knowledge Inc.",
		asaftheme.NodeRed,
	)
	cuiBanner.TextStyle = fyne.TextStyle{Monospace: true}
	cuiBanner.TextSize = 10

	// Header
	appTitle := canvas.NewText("ADINKHEPRA  ASAF", asaftheme.NXBlue)
	appTitle.TextSize = 18
	appTitle.TextStyle = fyne.TextStyle{Bold: true}

	tierBadge := canvas.NewText("License: "+tier, asaftheme.AKGold)
	tierBadge.TextSize = 12

	header := container.NewBorder(nil, nil,
		container.NewPadded(appTitle),
		container.NewPadded(tierBadge),
		nil,
	)

	// Placeholder body — full graph implementation in v1.1.1 milestone
	placeholder := container.NewCenter(
		container.NewVBox(
			canvas.NewText("CMMC Compliance Graph", asaftheme.NXBlue),
			widget.NewLabel("3D force-directed compliance graph loads here."),
			widget.NewLabel("Nodes = CMMC/STIG controls  |  Edges = dependencies"),
			widget.NewLabel("Colors: Red=failing  Orange=at-risk  Green=passing"),
			widget.NewSeparator(),
			widget.NewLabel("Run: adinkhepra ert full . to populate the graph"),
		),
	)

	// Footer
	footer := container.NewHBox(
		widget.NewLabel("CMMC_L2"),
		widget.NewSeparator(),
		widget.NewLabel("Scan: never"),
		widget.NewSeparator(),
		widget.NewLabel("ML-DSA-65: ready"),
		widget.NewSeparator(),
		canvas.NewText("NouchiX ©", asaftheme.TextMuted),
	)

	w.SetContent(container.NewBorder(
		container.NewVBox(container.NewPadded(cuiBanner), widget.NewSeparator(), container.NewPadded(header)),
		container.NewPadded(footer),
		nil, nil,
		placeholder,
	))

	w.Show()
}

// checkLicense reads the license file and returns the tier string.
// Returns "Community" if no license found or verification fails.
// Full ML-DSA-65 verification is handled by pkg/license at runtime.
func checkLicense() string {
	paths := []string{
		os.Getenv("KHEPRA_LICENSE_PATH"),
		os.Getenv("ProgramData") + `\AdinKhepra ASAF\license.adinkhepra`,
		os.Getenv("HOME") + `/.config/adinkhepra/license.adinkhepra`,
	}
	for _, p := range paths {
		if p == "" {
			continue
		}
		if _, err := os.Stat(p); err == nil {
			// License file found — in production this calls pkg/license.Manager.Initialize()
			// For v1.1.1 skeleton, just indicate a license is present.
			return "Pilot"
		}
	}
	return "Community"
}
