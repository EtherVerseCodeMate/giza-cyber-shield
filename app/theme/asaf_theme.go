package theme

import (
	"image/color"

	"fyne.io/fyne/v2"
	fy "fyne.io/fyne/v2/theme"
)

// Palette — AdinKhepra ASAF sovereign dark visual identity.
var (
	NXNavy       = color.NRGBA{R: 0x05, G: 0x0c, B: 0x16, A: 0xff} // primary bg
	NXBlue       = color.NRGBA{R: 0x1a, G: 0x9f, B: 0xe8, A: 0xff} // brand blue
	AKGold       = color.NRGBA{R: 0xe5, G: 0xa5, B: 0x4b, A: 0xff} // tier / score
	SBCyan       = color.NRGBA{R: 0x06, G: 0xb6, B: 0xd4, A: 0xff} // live indicator
	NodeRed      = color.NRGBA{R: 0xcc, G: 0x2a, B: 0x36, A: 0xff} // CAT I failures
	NodeOrange   = color.NRGBA{R: 0xf9, G: 0x73, B: 0x16, A: 0xff} // at-risk
	NodeYellow   = color.NRGBA{R: 0xea, G: 0xb3, B: 0x08, A: 0xff} // staging
	NodeGreen    = color.NRGBA{R: 0x22, G: 0xc5, B: 0x5e, A: 0xff} // passing
	NodeGray     = color.NRGBA{R: 0x3d, G: 0x5a, B: 0x78, A: 0xff} // not scanned
	NXNavyMid    = color.NRGBA{R: 0x0c, G: 0x17, B: 0x26, A: 0xff} // card surface
	NXNavyBorder = color.NRGBA{R: 0x1a, G: 0x2e, B: 0x46, A: 0xff} // borders
	TextPrimary  = color.NRGBA{R: 0xe8, G: 0xf0, B: 0xf8, A: 0xff} // body text
	TextMuted    = color.NRGBA{R: 0x6b, G: 0x82, B: 0x9a, A: 0xff} // muted text
	PanelBG      = color.NRGBA{R: 0x08, G: 0x12, B: 0x1e, A: 0xee} // panel card, 93% opaque
)

// ASAFTheme implements fyne.Theme with the AdinKhepra ASAF sovereign dark palette.
// Apply via: app.Settings().SetTheme(&theme.ASAFTheme{})
type ASAFTheme struct{}

var _ fyne.Theme = (*ASAFTheme)(nil)

func (t *ASAFTheme) Color(name fyne.ThemeColorName, variant fyne.ThemeVariant) color.Color {
	switch name {
	case fy.ColorNameBackground:
		return NXNavy
	case fy.ColorNameButton:
		return NXBlue
	case fy.ColorNameDisabledButton:
		return NXNavyMid
	case fy.ColorNamePrimary:
		return NXBlue
	case fy.ColorNameForeground:
		return TextPrimary
	case fy.ColorNameDisabled:
		return TextMuted
	case fy.ColorNameInputBackground:
		return NXNavyMid
	case fy.ColorNamePlaceHolder:
		return TextMuted
	case fy.ColorNameHover:
		return color.NRGBA{R: 0x1a, G: 0x9f, B: 0xe8, A: 0x28}
	case fy.ColorNameFocus:
		return NXBlue
	case fy.ColorNameScrollBar:
		return NXNavyBorder
	case fy.ColorNameShadow:
		return color.NRGBA{A: 0x80}
	case fy.ColorNameSelection:
		return color.NRGBA{R: 0x1a, G: 0x9f, B: 0xe8, A: 0x3c}
	case fy.ColorNameSeparator:
		return NXNavyBorder
	case fy.ColorNameError:
		return NodeRed
	case fy.ColorNameSuccess:
		return NodeGreen
	case fy.ColorNameWarning:
		return AKGold
	case fy.ColorNameHeaderBackground:
		return NXNavyMid
	case fy.ColorNameMenuBackground:
		return NXNavyMid
	case fy.ColorNameOverlayBackground:
		return NXNavy
	}
	return fy.DefaultTheme().Color(name, variant)
}

func (t *ASAFTheme) Font(style fyne.TextStyle) fyne.Resource {
	if style.Monospace && monoFont != nil {
		return monoFont
	}
	if !style.Monospace && headingFont != nil {
		return headingFont
	}
	return fy.DefaultTheme().Font(style)
}

func (t *ASAFTheme) Icon(name fyne.ThemeIconName) fyne.Resource {
	return fy.DefaultTheme().Icon(name)
}

func (t *ASAFTheme) Size(name fyne.ThemeSizeName) float32 {
	switch name {
	case fy.SizeNameText:
		return 14
	case fy.SizeNameHeadingText:
		return 22
	case fy.SizeNameSubHeadingText:
		return 16
	case fy.SizeNameCaptionText:
		return 11
	case fy.SizeNameInlineIcon:
		return 20
	case fy.SizeNamePadding:
		return 6
	case fy.SizeNameInnerPadding:
		return 8
	case fy.SizeNameLineSpacing:
		return 4
	case fy.SizeNameScrollBar:
		return 6
	case fy.SizeNameScrollBarSmall:
		return 3
	case fy.SizeNameSeparatorThickness:
		return 1
	case fy.SizeNameInputBorder:
		return 1
	case fy.SizeNameInputRadius:
		return 4
	case fy.SizeNameSelectionRadius:
		return 4
	}
	return fy.DefaultTheme().Size(name)
}
