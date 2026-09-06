//go:build !darwin
// +build !darwin
// TODO(cross-platform): darwin support requires Fyne CGO + OpenGL headers.
// See: cmd/asaf-desktop/main.go for tracking note.

package main

import (
	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/app"

	asaftheme "github.com/EtherVerseCodeMate/giza-cyber-shield/app/theme"
)

const (
	AppVersion = "1.1.1"
	AppName    = "AdinKhepra ASAF"
	Publisher  = "SecRed Knowledge Inc."
	AppID      = "com.secred.adinkhepra.asaf.setup"
	PatentRef  = "USPTO #73565085"
)

func main() {
	a := app.NewWithID(AppID)
	a.Settings().SetTheme(&asaftheme.ASAFTheme{})

	iconRes := fyne.NewStaticResource("icon.svg", iconSVGBytes)
	a.SetIcon(iconRes)

	w := a.NewWindow(AppName + " v" + AppVersion + " Setup")
	w.Resize(fyne.NewSize(660, 530))
	w.SetFixedSize(true)
	w.CenterOnScreen()
	w.SetIcon(iconRes)

	wiz := newWizard(a, w)
	wiz.show(0)

	w.ShowAndRun()
}
