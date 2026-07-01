package main

import (
	"fmt"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/canvas"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/layout"
	"fyne.io/fyne/v2/widget"
)

// Wizard orchestrates the 7-page AdinKhepra ASAF installer flow.
type Wizard struct {
	app fyne.App
	win fyne.Window
	cfg *InstallConfig

	current int // 0-indexed page

	// Persistent UI widgets kept across page transitions
	btnBack   *widget.Button
	btnNext   *widget.Button
	btnCancel *widget.Button
	stepLabel *widget.Label

	// Page-specific state written by page builders
	eulaAccepted bool
	licenseJSON  string
	tierDisplay  string // "Community" | "Pilot" | "Enterprise" | "Master"

	// Populated on page 6 (Installing)
	progressBar *widget.ProgressBar
	logEntry    *widget.Entry

	// Result written by enrollment
	enrolledKeyID string
	installErr    error
}

func newWizard(a fyne.App, w fyne.Window) *Wizard {
	wiz := &Wizard{
		app:         a,
		win:         w,
		cfg:         defaultInstallConfig(),
		tierDisplay: "Community",
	}

	wiz.btnBack   = widget.NewButton("← Back", wiz.goBack)
	wiz.btnNext   = widget.NewButton("Next →", wiz.goNext)
	wiz.btnCancel = widget.NewButton("Cancel", wiz.cancel)
	wiz.stepLabel = widget.NewLabel("Step 1 of 7")

	wiz.progressBar = widget.NewProgressBar()
	wiz.progressBar.Min = 0
	wiz.progressBar.Max = 1.0

	wiz.logEntry = widget.NewMultiLineEntry()
	wiz.logEntry.Wrapping = fyne.TextWrapWord
	wiz.logEntry.Disable() // append-only

	return wiz
}

// show navigates to page idx (0-based) and rebuilds the window content.
func (wiz *Wizard) show(idx int) {
	wiz.current = idx
	wiz.win.SetContent(wiz.buildLayout(idx))
	wiz.updateButtons(idx)
}

// buildLayout constructs the full window layout for a given page.
func (wiz *Wizard) buildLayout(idx int) fyne.CanvasObject {
	return container.NewBorder(
		wiz.buildHeader(idx),
		wiz.buildFooter(idx),
		nil, nil,
		container.NewPadded(wiz.buildPage(idx)),
	)
}

func (wiz *Wizard) buildHeader(idx int) fyne.CanvasObject {
	titles := []string{
		"Welcome",
		"License Agreement",
		"License Key",
		"Installation Folder",
		"Select Components",
		"Installing",
		"Installation Complete",
	}

	cui := canvas.NewText("⬛ CUI  //  CONTROLLED UNCLASSIFIED INFORMATION  //  SecRed Knowledge Inc.", nil)
	cui.Color = asafRed
	cui.TextSize = 10
	cui.TextStyle = fyne.TextStyle{Monospace: true}

	title := canvas.NewText(titles[idx], asafBlue)
	title.TextSize = 18
	title.TextStyle = fyne.TextStyle{Bold: true}

	wiz.stepLabel.SetText(fmt.Sprintf("Step %d of 7", idx+1))
	wiz.stepLabel.TextStyle = fyne.TextStyle{Italic: true}

	sep := widget.NewSeparator()

	return container.NewVBox(
		container.NewPadded(cui),
		container.NewBorder(nil, nil, nil, container.NewPadded(wiz.stepLabel),
			container.NewPadded(title),
		),
		sep,
	)
}

func (wiz *Wizard) buildFooter(idx int) fyne.CanvasObject {
	sep := widget.NewSeparator()

	btnRow := container.NewHBox(
		layout.NewSpacer(),
		wiz.btnBack,
		wiz.btnNext,
		wiz.btnCancel,
	)

	return container.NewVBox(sep, container.NewPadded(btnRow))
}

func (wiz *Wizard) updateButtons(idx int) {
	// Back visibility
	if idx == 0 || idx >= 5 { // page 6 (Installing) and 7 (Finish) lock nav
		wiz.btnBack.Disable()
	} else {
		wiz.btnBack.Enable()
	}

	// Next label
	switch idx {
	case 4:
		wiz.btnNext.SetText("Install")
	case 5:
		wiz.btnNext.SetText("Installing...")
		wiz.btnNext.Disable()
		wiz.btnCancel.Disable()
	case 6:
		wiz.btnNext.SetText("Finish")
		wiz.btnCancel.Disable()
	default:
		wiz.btnNext.SetText("Next →")
		wiz.btnNext.Enable()
		wiz.btnCancel.Enable()
	}

	// Gate Next on page 1 (EULA) until accepted
	if idx == 1 && !wiz.eulaAccepted {
		wiz.btnNext.Disable()
	}
}

func (wiz *Wizard) goNext() {
	switch wiz.current {
	case 4:
		wiz.show(5)
		go wiz.runInstallation()
		return
	case 6:
		wiz.finish()
		return
	}
	if wiz.current < 6 {
		wiz.show(wiz.current + 1)
	}
}

func (wiz *Wizard) goBack() {
	if wiz.current > 0 && wiz.current < 5 {
		wiz.show(wiz.current - 1)
	}
}

func (wiz *Wizard) cancel() {
	wiz.app.Quit()
}

func (wiz *Wizard) finish() {
	if wiz.cfg.LaunchAfter {
		launchDesktop(wiz.cfg.InstallDir)
	}
	wiz.app.Quit()
}
