package main

import (
	"encoding/json"
	"fmt"
	"image/color"
	"os"
	"path/filepath"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/canvas"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/dialog"
	"fyne.io/fyne/v2/layout"
	"fyne.io/fyne/v2/widget"
)

// Brand colours used directly in canvas.Text (bypasses theme for accent text)
var (
	asafBlue = color.NRGBA{R: 0x1a, G: 0x9f, B: 0xe8, A: 0xff}
	asafGold = color.NRGBA{R: 0xe5, G: 0xa5, B: 0x4b, A: 0xff}
	asafRed  = color.NRGBA{R: 0xcc, G: 0x2a, B: 0x36, A: 0xff}
	asafGreen = color.NRGBA{R: 0x22, G: 0xc5, B: 0x5e, A: 0xff}
)

// buildPage dispatches to the appropriate page builder.
func (wiz *Wizard) buildPage(idx int) fyne.CanvasObject {
	switch idx {
	case 0:
		return wiz.makePage1Welcome()
	case 1:
		return wiz.makePage2EULA()
	case 2:
		return wiz.makePage3LicenseKey()
	case 3:
		return wiz.makePage4InstallDir()
	case 4:
		return wiz.makePage5Components()
	case 5:
		return wiz.makePage6Installing()
	case 6:
		return wiz.makePage7Finish()
	}
	return widget.NewLabel("Unknown page")
}

// --- Page 1: Welcome ----------------------------------------------------------

func (wiz *Wizard) makePage1Welcome() fyne.CanvasObject {
	iconRes := fyne.NewStaticResource("icon.svg", iconSVGBytes)
	icon := canvas.NewImageFromResource(iconRes)
	icon.SetMinSize(fyne.NewSize(96, 96))
	icon.FillMode = canvas.ImageFillContain

	productName := canvas.NewText("AdinKhepra ASAF", asafBlue)
	productName.TextSize = 28
	productName.TextStyle = fyne.TextStyle{Bold: true}

	subtitle := canvas.NewText("Agentic Security Attestation Framework", asafGold)
	subtitle.TextSize = 13

	version := widget.NewLabel("Version " + AppVersion + "  |  " + PatentRef)
	version.TextStyle = fyne.TextStyle{Italic: true}

	desc := widget.NewLabel(
		"This wizard will install AdinKhepra ASAF on your computer.\n\n" +
			"AdinKhepra ASAF is the sovereign CMMC autopilot engine for DIB contractors.\n" +
			"It answers the question: \"Will I pass my CMMC L2 audit?\" — offline, with\n" +
			"zero egress, post-quantum attested, in a single native binary.\n\n" +
			"Features:\n" +
			"  • 3D Compliance Graph Desktop (CISO-facing, native GUI)\n" +
			"  • 25,185-row (deduplicated) STIG/CCI/NIST/CMMC mapping database\n" +
			"  • ML-DSA-65 post-quantum attestation (patent pending)\n" +
			"  • Privileged remediation daemon with Adinkra symbol gate\n" +
			"  • Air-gap ready. No Node.js. No browser. No telemetry.\n\n" +
			"Click Next to continue.",
	)
	desc.Wrapping = fyne.TextWrapWord

	publisher := widget.NewLabel(Publisher + "  ·  https://adinkhepra.com")
	publisher.TextStyle = fyne.TextStyle{Italic: true}

	heroBox := container.NewVBox(
		container.NewCenter(icon),
		container.NewCenter(productName),
		container.NewCenter(subtitle),
		container.NewCenter(version),
	)

	return container.NewBorder(
		heroBox, container.NewCenter(publisher), nil, nil,
		container.NewPadded(desc),
	)
}

// --- Page 2: EULA -------------------------------------------------------------

func (wiz *Wizard) makePage2EULA() fyne.CanvasObject {
	eulaEntry := widget.NewMultiLineEntry()
	eulaEntry.SetText(eulaText)
	eulaEntry.Disable()
	eulaEntry.Wrapping = fyne.TextWrapWord

	eulaScroll := container.NewVScroll(eulaEntry)
	eulaScroll.SetMinSize(fyne.NewSize(600, 280))

	var radioGrp *widget.RadioGroup
	radioGrp = widget.NewRadioGroup(
		[]string{
			"I accept the terms of this License Agreement",
			"I do not accept the terms of this License Agreement",
		},
		func(selected string) {
			wiz.eulaAccepted = (selected == "I accept the terms of this License Agreement")
			if wiz.eulaAccepted {
				wiz.btnNext.Enable()
			} else {
				wiz.btnNext.Disable()
			}
		},
	)
	radioGrp.Required = true

	return container.NewBorder(
		nil,
		container.NewPadded(radioGrp),
		nil, nil,
		eulaScroll,
	)
}

// --- Page 3: License Key ------------------------------------------------------

func (wiz *Wizard) makePage3LicenseKey() fyne.CanvasObject {
	note := widget.NewLabel(
		"Paste your AdinKhepra ASAF License Key below, or click Browse to load\n" +
			"a license.adinkhepra file. Leave blank to continue as Community edition.",
	)
	note.Wrapping = fyne.TextWrapWord

	keyEntry := widget.NewMultiLineEntry()
	keyEntry.SetPlaceHolder("Paste license JSON here…")
	if wiz.licenseJSON != "" {
		keyEntry.SetText(wiz.licenseJSON)
	}
	keyEntry.SetMinRowsVisible(6)

	tierLbl := canvas.NewText("Tier: "+wiz.tierDisplay, asafGold)
	tierLbl.TextSize = 14
	tierLbl.TextStyle = fyne.TextStyle{Bold: true}

	keyEntry.OnChanged = func(s string) {
		wiz.licenseJSON = s
		wiz.tierDisplay = parseLicenseTier(s)
		tierLbl.Text = "Tier: " + wiz.tierDisplay
		tierLbl.Refresh()
		// Copy JSON to InstallConfig so install.go can write it
		wiz.cfg.LicenseJSON = s
	}

	browseBtn := widget.NewButton("Browse for license.adinkhepra…", func() {
		dialog.ShowFileOpen(func(f fyne.URIReadCloser, err error) {
			if err != nil || f == nil {
				return
			}
			defer f.Close()
			data, err := os.ReadFile(f.URI().Path())
			if err != nil {
				dialog.ShowError(err, wiz.win)
				return
			}
			keyEntry.SetText(string(data))
		}, wiz.win)
	})

	return container.NewVBox(
		note,
		widget.NewSeparator(),
		container.NewVScroll(keyEntry),
		browseBtn,
		container.NewHBox(layout.NewSpacer(), tierLbl),
	)
}

// parseLicenseTier reads the "tier" field from a JSON license blob without
// verifying the signature. Signature verification happens at app runtime.
func parseLicenseTier(raw string) string {
	if raw == "" {
		return "Community"
	}
	var outer struct {
		License struct {
			Tier string `json:"tier"`
		} `json:"license"`
	}
	if err := json.Unmarshal([]byte(raw), &outer); err != nil {
		return "Community"
	}
	if outer.License.Tier == "" {
		return "Community"
	}
	switch outer.License.Tier {
	case "community":
		return "Community"
	case "pilot":
		return "Pilot ($25K)"
	case "enterprise":
		return "Enterprise"
	case "master":
		return "Master"
	}
	return outer.License.Tier
}

// --- Page 4: Install Directory ------------------------------------------------

func (wiz *Wizard) makePage4InstallDir() fyne.CanvasObject {
	note := widget.NewLabel("Choose where AdinKhepra ASAF will be installed.")

	dirEntry := widget.NewEntry()
	dirEntry.SetText(wiz.cfg.InstallDir)
	dirEntry.OnChanged = func(s string) { wiz.cfg.InstallDir = s }

	browseBtn := widget.NewButton("Browse…", func() {
		dialog.ShowFolderOpen(func(f fyne.ListableURI, err error) {
			if err != nil || f == nil {
				return
			}
			chosen := filepath.Join(f.Path(), "AdinKhepra ASAF")
			dirEntry.SetText(chosen)
			wiz.cfg.InstallDir = chosen
		}, wiz.win)
	})

	dirRow := container.NewBorder(nil, nil, nil, browseBtn, dirEntry)

	spaceReq := widget.NewLabel("Space required:  ~180 MB")
	spaceFree := widget.NewLabel(fmt.Sprintf("Space available: %s", freeSpaceString(wiz.cfg.InstallDir)))

	dataLabel := canvas.NewText("Data directory:", nil)
	dataLabel.TextStyle = fyne.TextStyle{Italic: true}
	dataEntry := widget.NewEntry()
	dataEntry.SetText(wiz.cfg.DataDir)
	dataEntry.OnChanged = func(s string) { wiz.cfg.DataDir = s }

	return container.NewVBox(
		note,
		widget.NewSeparator(),
		widget.NewLabel("Installation folder:"),
		dirRow,
		container.NewHBox(spaceReq, layout.NewSpacer(), spaceFree),
		widget.NewSeparator(),
		dataLabel,
		dataEntry,
		widget.NewLabel("(license key, DAG database, and generated keypairs are stored here)"),
	)
}

// --- Page 5: Components ------------------------------------------------------

func (wiz *Wizard) makePage5Components() fyne.CanvasObject {
	note := widget.NewLabel("Select the components to install:")

	chkDesktop := widget.NewCheck(
		"AdinKhepra Compliance Graph Desktop  [required]",
		func(b bool) { wiz.cfg.Components.Desktop = b },
	)
	chkDesktop.SetChecked(true)
	chkDesktop.Disable()

	chkCLI := widget.NewCheck(
		"AdinKhepra CLI  (adinkhepra.exe — ERT, scan, validate)",
		func(b bool) { wiz.cfg.Components.CLI = b },
	)
	chkCLI.SetChecked(wiz.cfg.Components.CLI)

	chkDaemon := widget.NewCheck(
		"ASAF System Daemon  (Windows Service — privileged execution layer)",
		func(b bool) { wiz.cfg.Components.Daemon = b },
	)
	chkDaemon.SetChecked(wiz.cfg.Components.Daemon)

	chkAutoStart := widget.NewCheck(
		"Start services automatically with Windows",
		func(b bool) { wiz.cfg.Components.AutoStart = b },
	)
	chkAutoStart.SetChecked(wiz.cfg.Components.AutoStart)

	chkStartMenu := widget.NewCheck(
		"Create Start Menu shortcuts",
		func(b bool) { wiz.cfg.Components.StartMenu = b },
	)
	chkStartMenu.SetChecked(wiz.cfg.Components.StartMenu)

	chkDesktopShortcut := widget.NewCheck(
		"Create Desktop shortcut",
		func(b bool) { wiz.cfg.Components.DesktopShortcut = b },
	)
	chkDesktopShortcut.SetChecked(wiz.cfg.Components.DesktopShortcut)

	chkPath := widget.NewCheck(
		"Add CLI directory to system PATH",
		func(b bool) { wiz.cfg.Components.AddToPath = b },
	)
	chkPath.SetChecked(wiz.cfg.Components.AddToPath)

	tierBadge := canvas.NewText("License: "+wiz.tierDisplay, asafGold)
	tierBadge.TextSize = 12

	return container.NewVBox(
		note,
		widget.NewSeparator(),
		chkDesktop,
		chkCLI,
		chkDaemon,
		chkAutoStart,
		widget.NewSeparator(),
		chkStartMenu,
		chkDesktopShortcut,
		chkPath,
		widget.NewSeparator(),
		container.NewHBox(layout.NewSpacer(), tierBadge),
	)
}

// --- Page 6: Installing -------------------------------------------------------

func (wiz *Wizard) makePage6Installing() fyne.CanvasObject {
	wiz.progressBar.SetValue(0)

	statusLbl := canvas.NewText("Preparing installation…", asafBlue)
	statusLbl.TextSize = 13

	wiz.logEntry.SetText("")

	logScroll := container.NewVScroll(wiz.logEntry)
	logScroll.SetMinSize(fyne.NewSize(600, 260))

	return container.NewVBox(
		statusLbl,
		wiz.progressBar,
		widget.NewSeparator(),
		logScroll,
	)
}

// --- Page 7: Finish -----------------------------------------------------------

func (wiz *Wizard) makePage7Finish() fyne.CanvasObject {
	var headline *canvas.Text
	var body *widget.Label

	if wiz.installErr != nil {
		headline = canvas.NewText("Installation Failed", asafRed)
		body = widget.NewLabel(fmt.Sprintf(
			"The installation encountered an error:\n\n%v\n\n"+
				"Check the installation log above for details.\n"+
				"Partial files may remain in %s.", wiz.installErr, wiz.cfg.InstallDir))
	} else {
		headline = canvas.NewText("Installation Complete!", asafGreen)
		body = widget.NewLabel(fmt.Sprintf(
			"AdinKhepra ASAF v%s has been installed successfully.\n\n"+
				"License tier: %s\n"+
				"Installed to: %s\n"+
				"Agent key ID: %s",
			AppVersion, wiz.tierDisplay, wiz.cfg.InstallDir,
			shortenKeyID(wiz.enrolledKeyID),
		))
	}

	headline.TextSize = 22
	headline.TextStyle = fyne.TextStyle{Bold: true}
	body.Wrapping = fyne.TextWrapWord

	launchChk := widget.NewCheck("Launch AdinKhepra Compliance Graph Desktop", func(b bool) {
		wiz.cfg.LaunchAfter = b
	})
	launchChk.SetChecked(wiz.cfg.LaunchAfter)
	if wiz.installErr != nil {
		launchChk.Disable()
	}

	patent := widget.NewLabel(PatentRef + "  |  " + Publisher)
	patent.TextStyle = fyne.TextStyle{Italic: true}

	return container.NewVBox(
		container.NewCenter(headline),
		widget.NewSeparator(),
		container.NewPadded(body),
		widget.NewSeparator(),
		container.NewPadded(launchChk),
		layout.NewSpacer(),
		container.NewCenter(patent),
	)
}

func shortenKeyID(id string) string {
	if len(id) <= 16 {
		return id
	}
	return id[:8] + "…" + id[len(id)-8:]
}
