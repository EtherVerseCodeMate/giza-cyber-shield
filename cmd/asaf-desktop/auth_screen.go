package main

import (
	"database/sql"
	"log"
	"path/filepath"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/dialog"
	"fyne.io/fyne/v2/layout"
	"fyne.io/fyne/v2/widget"
	
	_ "github.com/mattn/go-sqlite3"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/asaf/hub"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/auth"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/license"
)

// initAuthManager opens the local SQLite db for auth
func initAuthManager(a fyne.App) *auth.NativeAuthManager {
	dbPath := filepath.Join(a.Storage().RootURI().Path(), "auth.db")
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		log.Printf("[auth] failed to open db: %v", err)
		return nil
	}
	am, err := auth.NewNativeAuthManager(db)
	if err != nil {
		log.Printf("[auth] failed to init auth manager: %v", err)
		return nil
	}
	return am
}

// showAuthScreen blocks and forces login/signup before proceeding.
func showAuthScreen(a fyne.App, tier license.EgyptianTier, backend hub.Backend) {
	am := initAuthManager(a)
	if am == nil {
		// Fallback if sqlite fails (e.g. read-only filesystem)
		showMainWindow(a, tier, backend)
		return
	}

	// Check if already authenticated
	token := a.Preferences().String("session_token")
	if token != "" {
		_, err := am.ValidateSession(token)
		if err == nil {
			showMainWindow(a, tier, backend)
			return
		}
	}

	w := a.NewWindow("AdinKhepra - Login")
	w.Resize(fyne.NewSize(400, 300))
	w.SetFixedSize(true)
	w.CenterOnScreen()

	emailEntry := widget.NewEntry()
	emailEntry.SetPlaceHolder("operator@stargate.local")
	
	passEntry := widget.NewPasswordEntry()
	passEntry.SetPlaceHolder("••••••••")

	loginBtn := widget.NewButton("Login", func() {
		user, err := am.Authenticate(emailEntry.Text, passEntry.Text)
		if err != nil {
			dialog.ShowError(err, w)
			return
		}
		sess, err := am.CreateSession(user.ID)
		if err != nil {
			dialog.ShowError(err, w)
			return
		}
		a.Preferences().SetString("session_token", sess.ID)
		w.Close()
		showMainWindow(a, tier, backend)
	})
	loginBtn.Importance = widget.HighImportance

	signupBtn := widget.NewButton("Register Initial Operator", func() {
		if len(passEntry.Text) < 8 {
			dialog.ShowInformation("Error", "Password must be at least 8 characters", w)
			return
		}
		user, err := am.CreateUser(emailEntry.Text, passEntry.Text)
		if err != nil {
			dialog.ShowError(err, w)
			return
		}
		sess, err := am.CreateSession(user.ID)
		if err != nil {
			dialog.ShowError(err, w)
			return
		}
		dialog.ShowInformation("Success", "Operator registered successfully.", w)
		a.Preferences().SetString("session_token", sess.ID)
		w.Close()
		showMainWindow(a, tier, backend)
	})

	form := container.NewVBox(
		widget.NewLabelWithStyle("STARGATE Access", fyne.TextAlignCenter, fyne.TextStyle{Bold: true}),
		widget.NewLabel("Email Address:"),
		emailEntry,
		widget.NewLabel("Master Passphrase:"),
		passEntry,
		layout.NewSpacer(),
		loginBtn,
		signupBtn,
	)

	w.SetContent(container.NewPadded(form))
	w.Show()
}
