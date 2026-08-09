package views

import (
	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/canvas"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/widget"

	asaftheme "github.com/EtherVerseCodeMate/giza-cyber-shield/app/theme"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/auth"
)

// ShowAuthScreen displays the lock screen and blocks until successfully authenticated.
// returns the decrypted ML-DSA-65 private key on success.
func ShowAuthScreen(a fyne.App, encryptedKey []byte, onUnlock func(decryptedKey []byte)) fyne.Window {
	w := a.NewWindow("STARGATE Auth")
	w.SetFixedSize(true)
	w.Resize(fyne.NewSize(480, 350))
	w.CenterOnScreen()

	isSetup := len(encryptedKey) == 0

	titleText := "Unlock ASAF"
	subText := "Enter your passphrase to decrypt identity"
	if isSetup {
		titleText = "Setup Identity"
		subText = "Create a master passphrase to secure your agent key"
	}

	title := canvas.NewText(titleText, asaftheme.NXBlue)
	title.TextSize = 28
	title.TextStyle = fyne.TextStyle{Bold: true}

	sub := canvas.NewText(subText, asaftheme.TextMuted)
	sub.TextSize = 12

	passInput := widget.NewPasswordEntry()
	passInput.PlaceHolder = "Passphrase..."

	errorLabel := canvas.NewText("", asaftheme.NodeRed)
	errorLabel.TextSize = 12
	errorLabel.Hide()

	var submitBtn *widget.Button
	submitBtn = widget.NewButton("Unlock", func() {
		pass := passInput.Text
		if len(pass) < 6 {
			errorLabel.Text = "Passphrase too short"
			errorLabel.Show()
			return
		}

		if isSetup {
			// In setup mode, we don't have an encrypted key yet. 
			// We pass the raw passphrase back so main.go can use it during generation.
			w.Close()
			onUnlock([]byte(pass)) // Overloading onUnlock to pass the new passphrase back
			return
		}

		// Decrypt existing
		submitBtn.Disable()
		errorLabel.Hide()
		
		decrypted, err := auth.DecryptKey(encryptedKey, pass)
		if err != nil {
			errorLabel.Text = err.Error()
			errorLabel.Show()
			submitBtn.Enable()
			return
		}

		w.Close()
		onUnlock(decrypted)
	})

	if isSetup {
		submitBtn.SetText("Encrypt & Continue")
	}

	// Allow enter key to trigger unlock
	passInput.OnSubmitted = func(_ string) {
		submitBtn.Tapped(&fyne.PointEvent{})
	}

	content := container.NewVBox(
		container.NewCenter(title),
		container.NewCenter(sub),
		widget.NewSeparator(),
		container.NewPadded(passInput),
		container.NewCenter(errorLabel),
		container.NewPadded(submitBtn),
	)

	w.SetContent(container.NewPadded(content))
	w.Show()
	return w
}
