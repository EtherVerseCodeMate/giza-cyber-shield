package views

import (
	"net/url"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/widget"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/asaf/hub"
)

// BillingTab provides a view for managing Stripe subscriptions and billing.
type BillingTab struct {
	win     fyne.Window
	backend hub.Backend
}

// NewBillingTab constructs a BillingTab view.
func NewBillingTab(win fyne.Window, backend hub.Backend) *BillingTab {
	return &BillingTab{
		win:     win,
		backend: backend,
	}
}

// Content builds the UI for the Billing tab.
func (t *BillingTab) Content() fyne.CanvasObject {
	title := widget.NewLabelWithStyle("Subscription & Billing Management", fyne.TextAlignLeading, fyne.TextStyle{Bold: true})

	desc := widget.NewLabel("STARGATE uses Stripe for secure payment processing. Manage your active subscription, upgrade tiers, or update your payment methods via the Stripe Customer Portal.")
	desc.Wrapping = fyne.TextWrapWord

	manageBtn := widget.NewButton("Open Stripe Customer Portal", func() {
		u, _ := url.Parse("https://billing.stripe.com/p/login/test_placeholder") // In a real environment, this would dynamically hit the backend to get a short-lived portal URL
		fyne.CurrentApp().OpenURL(u)
	})
	manageBtn.Importance = widget.HighImportance

	card := widget.NewCard("Current Subscription", "Your current active tier", container.NewVBox(
		widget.NewLabel("Status: Active"),
		widget.NewLabel("Tier: STARGATE Standalone Edition"),
		widget.NewLabel("Billing Cycle: Monthly"),
	))

	content := container.NewVBox(
		title,
		desc,
		widget.NewSeparator(),
		card,
		container.NewPadded(manageBtn),
	)

	return container.NewPadded(content)
}
