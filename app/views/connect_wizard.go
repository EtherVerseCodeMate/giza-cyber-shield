// Package views — Connect Wizard: 4-mode fleet enrollment dialog.
//
// Mode A: Subnet Discovery — CIDR range scan via SubnetConnector, streaming results.
// Mode B: CSV Import       — file picker + auto column map + preview + bulk enroll.
// Mode C: Cloud Assets     — reserved (future release, rendered as informational card).
// Mode D: Manual Add       — single-host SSH or WinRM with Test Connection gate.
//
// §10 rule: NO Sephirot/Merkaba/Hypercube vocabulary in any user-visible string.
// All Backend calls are signed by the Backend implementation (ML-DSA-65).
//
// Copyright: SOUHIMBOU DOH KONE LLC — exclusively licensed to SecRed Knowledge Inc.
// Patent Pending: USPTO #73565085
package views

import (
	"context"
	"fmt"
	"strings"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/canvas"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/dialog"
	"fyne.io/fyne/v2/storage"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"

	asaftheme "github.com/EtherVerseCodeMate/giza-cyber-shield/app/theme"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/asaf/connector"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/asaf/hub"
)

// ShowConnectWizard opens the fleet enrollment wizard as a new modal window.
// onEnrolled is called (from the UI goroutine) whenever one or more assets are
// successfully enrolled so the Fleet Manager tree can refresh.
func ShowConnectWizard(parent fyne.Window, backend hub.Backend, onEnrolled func()) {
	w := fyne.CurrentApp().NewWindow("Connect Assets — Enrollment Wizard")
	w.Resize(fyne.NewSize(820, 580))
	w.CenterOnScreen()

	cw := &connectWizard{
		win:        w,
		parent:     parent,
		backend:    backend,
		onEnrolled: onEnrolled,
	}

	// Load enclaves for target-enclave selects (background; non-fatal on failure).
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		enclaves, err := backend.GetEnclaves(ctx)
		if err != nil || len(enclaves) == 0 {
			return
		}
		fyne.Do(func() {
			cw.enclaves = enclaves
			cw.rebuildEnclaveSelects()
		})
	}()

	tabs := container.NewAppTabs(
		container.NewTabItemWithIcon("Mode A — Subnet", theme.SearchIcon(), cw.buildModeA()),
		container.NewTabItemWithIcon("Mode B — CSV", theme.DocumentIcon(), cw.buildModeB()),
		container.NewTabItemWithIcon("Mode C — Cloud", theme.ComputerIcon(), cw.buildModeC()),
		container.NewTabItemWithIcon("Mode D — Manual", theme.ContentAddIcon(), cw.buildModeD()),
	)
	tabs.SetTabLocation(container.TabLocationTop)

	patent := canvas.NewText("USPTO #73565085 | SecRed Knowledge Inc.", asaftheme.TextMuted)
	patent.TextSize = 10
	patent.Alignment = fyne.TextAlignCenter

	w.SetContent(container.NewBorder(
		nil,
		container.NewVBox(widget.NewSeparator(), patent),
		nil, nil,
		tabs,
	))
	w.Show()
}

// ── wizard state ──────────────────────────────────────────────────────────────

type connectWizard struct {
	win     fyne.Window
	parent  fyne.Window
	backend hub.Backend
	onEnrolled func()

	enclaves       []hub.Enclave
	enclaveNamesA  []string // for Mode A select
	enclaveNamesD  []string // for Mode D select
	enclaveSelectA *widget.Select
	enclaveSelectD *widget.Select

	// Mode A state
	modeACancelFn  context.CancelFunc
	modeADiscovered []hub.DiscoveredHost
	modeASelected  map[string]bool // key = IP
	modeATable     *widget.Table
	modeAStatus    *widget.Label
	modeAEnrollBtn *widget.Button

	// Mode B state
	modeBHeaders  []string
	modeBRawRows  [][]string
	modeBTable    *widget.Table
	modeBStatus   *widget.Label
	modeBImportBtn *widget.Button

	// Mode D state
	modeDResult *hub.TestResult
}


// ── enclave helpers ───────────────────────────────────────────────────────────

func (cw *connectWizard) enclaveNames() []string {
	if len(cw.enclaves) == 0 {
		return []string{"Local Enclave"}
	}
	names := make([]string, len(cw.enclaves))
	for i, e := range cw.enclaves {
		names[i] = e.Name
	}
	return names
}

func (cw *connectWizard) enclaveIDByName(name string) string {
	for _, e := range cw.enclaves {
		if e.Name == name {
			return e.ID
		}
	}
	return "local"
}

func (cw *connectWizard) rebuildEnclaveSelects() {
	names := cw.enclaveNames()
	if cw.enclaveSelectA != nil {
		cw.enclaveSelectA.Options = names
		if cw.enclaveSelectA.Selected == "" && len(names) > 0 {
			cw.enclaveSelectA.SetSelected(names[0])
		}
		cw.enclaveSelectA.Refresh()
	}
	if cw.enclaveSelectD != nil {
		cw.enclaveSelectD.Options = names
		if cw.enclaveSelectD.Selected == "" && len(names) > 0 {
			cw.enclaveSelectD.SetSelected(names[0])
		}
		cw.enclaveSelectD.Refresh()
	}
}

// ── Mode A — Subnet Discovery ─────────────────────────────────────────────────

func (cw *connectWizard) buildModeA() fyne.CanvasObject {
	header := canvas.NewText("Subnet Discovery", asaftheme.TextPrimary)
	header.TextSize = 15
	header.TextStyle = fyne.TextStyle{Bold: true}

	desc := widget.NewLabel("Enter a CIDR range. ASAF will scan for live hosts and identify their OS and STIG profile.")
	desc.Wrapping = fyne.TextWrapWord

	cidrEntry := widget.NewEntry()
	cidrEntry.SetPlaceHolder("e.g. 192.168.1.0/24")

	cw.enclaveSelectA = widget.NewSelect(cw.enclaveNames(), nil)
	if len(cw.enclaves) > 0 {
		cw.enclaveSelectA.SetSelected(cw.enclaves[0].Name)
	}

	portPresets := []string{
		"Standard (22, 80, 443, 3389, 5985)",
		"Extended (adds 8080, 8443, 9443, 5986)",
		"SSH Only (22)",
		"WinRM Only (5985, 5986)",
	}
	portPreset := widget.NewSelect(portPresets, nil)
	portPreset.SetSelected(portPresets[0])

	cw.modeAStatus = widget.NewLabel("Ready.")
	cw.modeASelected = make(map[string]bool)
	cw.modeADiscovered = nil

	// Results table: IP | Hostname | OS | STIG Profile | Open Ports | ✓
	colHeaders := []string{"IP", "Hostname", "OS", "STIG Profile", "Ports", "Enroll?"}
	cw.modeATable = widget.NewTable(
		func() (int, int) { return len(cw.modeADiscovered) + 1, len(colHeaders) },
		func() fyne.CanvasObject {
			t := canvas.NewText("", asaftheme.TextPrimary)
			t.TextSize = 11
			return t
		},
		func(id widget.TableCellID, obj fyne.CanvasObject) {
			lbl := obj.(*canvas.Text)
			if id.Row == 0 {
				lbl.Text = colHeaders[id.Col]
				lbl.Color = asaftheme.NXBlue
				lbl.TextStyle = fyne.TextStyle{Bold: true}
				lbl.Refresh()
				return
			}
			row := id.Row - 1
			if row >= len(cw.modeADiscovered) {
				lbl.Text = ""
				lbl.Refresh()
				return
			}
			h := cw.modeADiscovered[row]
			selected := cw.modeASelected[h.IP]
			switch id.Col {
			case 0:
				lbl.Text = h.IP
				if selected {
					lbl.Color = asaftheme.NodeGreen
				} else {
					lbl.Color = asaftheme.TextPrimary
				}
			case 1:
				lbl.Text = h.Hostname
				lbl.Color = asaftheme.TextPrimary
			case 2:
				lbl.Text = h.OS
				lbl.Color = asaftheme.TextMuted
			case 3:
				lbl.Text = h.STIGProfile
				lbl.Color = asaftheme.TextMuted
			case 4:
				ports := make([]string, len(h.OpenPorts))
				for i, p := range h.OpenPorts {
					ports[i] = fmt.Sprintf("%d", p)
				}
				lbl.Text = strings.Join(ports, ", ")
				lbl.Color = asaftheme.TextMuted
			case 5:
				if selected {
					lbl.Text = "✓"
					lbl.Color = asaftheme.NodeGreen
				} else {
					lbl.Text = "○"
					lbl.Color = asaftheme.TextMuted
				}
			}
			lbl.Refresh()
		},
	)
	cw.modeATable.SetColumnWidth(0, 110)
	cw.modeATable.SetColumnWidth(1, 140)
	cw.modeATable.SetColumnWidth(2, 110)
	cw.modeATable.SetColumnWidth(3, 140)
	cw.modeATable.SetColumnWidth(4, 90)
	cw.modeATable.SetColumnWidth(5, 65)

	// Row click toggles selection (header row excluded).
	cw.modeATable.OnSelected = func(id widget.TableCellID) {
		if id.Row == 0 || id.Row-1 >= len(cw.modeADiscovered) {
			return
		}
		h := cw.modeADiscovered[id.Row-1]
		cw.modeASelected[h.IP] = !cw.modeASelected[h.IP]
		cw.modeATable.RefreshItem(id)
		// Refresh the checkmark cell too
		cw.modeATable.RefreshItem(widget.TableCellID{Row: id.Row, Col: 5})
		cw.updateModeAEnrollBtn()
	}

	selectAllBtn := widget.NewButton("Select All", func() {
		for _, h := range cw.modeADiscovered {
			cw.modeASelected[h.IP] = true
		}
		cw.modeATable.Refresh()
		cw.updateModeAEnrollBtn()
	})

	scanBtn := widget.NewButtonWithIcon("Scan Subnet", theme.SearchIcon(), nil)
	scanBtn.Importance = widget.HighImportance
	scanBtn.OnTapped = func() {
		cidr := strings.TrimSpace(cidrEntry.Text)
		if cidr == "" {
			dialog.ShowError(fmt.Errorf("CIDR range is required (e.g. 192.168.1.0/24)"), cw.win)
			return
		}
		cw.runModeAScan(cidr, portPreset.Selected, scanBtn)
	}

	stopBtn := widget.NewButtonWithIcon("Stop", theme.CancelIcon(), func() {
		if cw.modeACancelFn != nil {
			cw.modeACancelFn()
		}
	})
	stopBtn.Disable()

	cw.modeAEnrollBtn = widget.NewButtonWithIcon("Enroll Selected", theme.ConfirmIcon(), nil)
	cw.modeAEnrollBtn.Disable()
	cw.modeAEnrollBtn.OnTapped = func() {
		cw.enrollModeASelected(cw.enclaveSelectA.Selected)
	}

	form := widget.NewForm(
		widget.NewFormItem("CIDR Range", cidrEntry),
		widget.NewFormItem("Target Enclave", cw.enclaveSelectA),
		widget.NewFormItem("Port Profile", portPreset),
	)

	btnRow := container.NewHBox(scanBtn, stopBtn, widget.NewSeparator(), selectAllBtn, cw.modeAEnrollBtn)

	return container.NewBorder(
		container.NewVBox(header, desc, form, btnRow, cw.modeAStatus, widget.NewSeparator()),
		nil, nil, nil,
		container.NewPadded(cw.modeATable),
	)
}

func (cw *connectWizard) presetPorts(preset string) []int {
	switch {
	case strings.Contains(preset, "SSH Only"):
		return []int{22}
	case strings.Contains(preset, "WinRM Only"):
		return []int{5985, 5986}
	case strings.Contains(preset, "Extended"):
		return []int{22, 80, 443, 3389, 5985, 5986, 8080, 8443, 9443}
	default:
		return []int{22, 80, 443, 3389, 5985}
	}
}

func (cw *connectWizard) runModeAScan(cidr, portPreset string, scanBtn *widget.Button) {
	if cw.modeACancelFn != nil {
		cw.modeACancelFn()
	}

	ctx, cancel := context.WithCancel(context.Background())
	cw.modeACancelFn = cancel

	cw.modeADiscovered = nil
	cw.modeASelected = make(map[string]bool)
	fyne.Do(func() {
		scanBtn.Disable()
		cw.modeATable.Refresh()
		cw.modeAStatus.SetText(fmt.Sprintf("Scanning %s …", cidr))
		cw.modeAEnrollBtn.Disable()
	})

	opts := hub.DiscoveryOptions{
		Ports:    cw.presetPorts(portPreset),
		MaxHosts: 250,
		Timeout:  10 * time.Second,
	}

	go func() {
		defer func() {
			fyne.Do(func() {
				scanBtn.Enable()
				n := len(cw.modeADiscovered)
				if n == 0 {
					cw.modeAStatus.SetText("Scan complete — no hosts found.")
				} else {
					cw.modeAStatus.SetText(fmt.Sprintf("Scan complete — %d host(s) found. Click rows to select, then [Enroll Selected].", n))
				}
			})
		}()

		ch, err := cw.backend.DiscoverSubnet(ctx, cidr, opts)
		if err != nil {
			fyne.Do(func() {
				cw.modeAStatus.SetText("Scan error: " + err.Error())
			})
			return
		}

		for h := range ch {
			h := h
			fyne.Do(func() {
				cw.modeADiscovered = append(cw.modeADiscovered, h)
				cw.modeAStatus.SetText(fmt.Sprintf("Discovered %d host(s) so far…", len(cw.modeADiscovered)))
				cw.modeATable.Refresh()
			})
		}
	}()
}

func (cw *connectWizard) updateModeAEnrollBtn() {
	count := 0
	for _, sel := range cw.modeASelected {
		if sel {
			count++
		}
	}
	if count == 0 {
		cw.modeAEnrollBtn.SetText("Enroll Selected")
		cw.modeAEnrollBtn.Disable()
	} else {
		cw.modeAEnrollBtn.SetText(fmt.Sprintf("Enroll %d Asset(s)", count))
		cw.modeAEnrollBtn.Enable()
	}
}

func (cw *connectWizard) enrollModeASelected(enclaveName string) {
	enclaveID := cw.enclaveIDByName(enclaveName)
	var toEnroll []hub.DiscoveredHost
	for _, h := range cw.modeADiscovered {
		if cw.modeASelected[h.IP] {
			toEnroll = append(toEnroll, h)
		}
	}
	if len(toEnroll) == 0 {
		return
	}

	cw.modeAEnrollBtn.Disable()
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 60 * time.Second)
		defer cancel()

		enrolled, errs := 0, 0
		for _, h := range toEnroll {
			hostname := h.Hostname
			if hostname == "" {
				hostname = h.IP
			}
			_, err := cw.backend.AddAsset(ctx, hub.AddAssetRequest{
				EnclaveID:   enclaveID,
				Hostname:    hostname,
				IPAddress:   h.IP,
				OS:          h.OS,
				STIGProfile: h.STIGProfile,
			})
			if err != nil {
				errs++
			} else {
				enrolled++
			}
		}

		fyne.Do(func() {
			cw.modeAEnrollBtn.Enable()
			msg := fmt.Sprintf("%d asset(s) enrolled", enrolled)
			if errs > 0 {
				msg += fmt.Sprintf(", %d error(s)", errs)
			}
			cw.modeAStatus.SetText("Done — " + msg)
			// Deselect enrolled hosts.
			for _, h := range toEnroll {
				delete(cw.modeASelected, h.IP)
			}
			cw.modeATable.Refresh()
			cw.updateModeAEnrollBtn()
			if enrolled > 0 && cw.onEnrolled != nil {
				cw.onEnrolled()
			}
		})
	}()
}

// ── Mode B — CSV Import ───────────────────────────────────────────────────────

func (cw *connectWizard) buildModeB() fyne.CanvasObject {
	header := canvas.NewText("CSV Bulk Import", asaftheme.TextPrimary)
	header.TextSize = 15
	header.TextStyle = fyne.TextStyle{Bold: true}

	desc := widget.NewLabel("Import a CSV file with asset inventory. Required: a hostname or IP column. Optional: os, enclave, stig_profile.")
	desc.Wrapping = fyne.TextWrapWord

	cw.modeBStatus = widget.NewLabel("No file selected.")
	cw.modeBImportBtn = widget.NewButtonWithIcon("Import Assets", theme.ConfirmIcon(), nil)
	cw.modeBImportBtn.Disable()
	cw.modeBImportBtn.Importance = widget.HighImportance

	// Preview table — shows first rows of parsed CSV.
	cw.modeBTable = widget.NewTable(
		func() (int, int) {
			if len(cw.modeBHeaders) == 0 {
				return 0, 0
			}
			rows := len(cw.modeBRawRows)
			if rows > 50 {
				rows = 50
			}
			return rows + 1, len(cw.modeBHeaders)
		},
		func() fyne.CanvasObject {
			t := canvas.NewText("", asaftheme.TextPrimary)
			t.TextSize = 11
			return t
		},
		func(id widget.TableCellID, obj fyne.CanvasObject) {
			lbl := obj.(*canvas.Text)
			if id.Row == 0 {
				if id.Col < len(cw.modeBHeaders) {
					lbl.Text = cw.modeBHeaders[id.Col]
					lbl.Color = asaftheme.NXBlue
					lbl.TextStyle = fyne.TextStyle{Bold: true}
				}
				lbl.Refresh()
				return
			}
			dataRow := id.Row - 1
			if dataRow < len(cw.modeBRawRows) && id.Col < len(cw.modeBRawRows[dataRow]) {
				lbl.Text = cw.modeBRawRows[dataRow][id.Col]
				lbl.Color = asaftheme.TextPrimary
				lbl.TextStyle = fyne.TextStyle{}
			} else {
				lbl.Text = ""
			}
			lbl.Refresh()
		},
	)

	importer := connector.NewCSVImporter("local")

	chooseBtn := widget.NewButtonWithIcon("Choose CSV File…", theme.FolderOpenIcon(), func() {
		fd := dialog.NewFileOpen(func(uc fyne.URIReadCloser, err error) {
			if err != nil || uc == nil {
				return
			}
			defer uc.Close()

			ctx, cancel := context.WithTimeout(context.Background(), 30 * time.Second)
			defer cancel()

			headers, rows, err := importer.ParseReader(ctx, uc)
			if err != nil {
				fyne.Do(func() { dialog.ShowError(err, cw.win) })
				return
			}

			cm, err := connector.AutoColumnMap(headers)
			if err != nil {
				fyne.Do(func() {
					cw.modeBStatus.SetText("Warning: " + err.Error() + " — check column mapping.")
					dialog.ShowError(err, cw.win)
				})
				return
			}
			_ = cm

			fyne.Do(func() {
				cw.modeBHeaders = headers
				cw.modeBRawRows = rows
				cw.modeBTable.Refresh()
				total := len(rows)
				shown := total
				if shown > 50 {
					shown = 50
				}
				cw.modeBStatus.SetText(fmt.Sprintf(
					"%d rows loaded (showing first %d). Headers: %s",
					total, shown, strings.Join(headers, ", ")))
				cw.modeBImportBtn.SetText(fmt.Sprintf("Import %d Asset(s)", total))
				cw.modeBImportBtn.Enable()
			})
		}, cw.win)
		fd.SetFilter(storage.NewExtensionFileFilter([]string{".csv"}))
		fd.Show()
	})

	cw.modeBImportBtn.OnTapped = func() {
		cw.runModeBImport(importer)
	}

	btnRow := container.NewHBox(chooseBtn, cw.modeBImportBtn)

	return container.NewBorder(
		container.NewVBox(header, desc, btnRow, cw.modeBStatus, widget.NewSeparator()),
		nil, nil, nil,
		container.NewPadded(cw.modeBTable),
	)
}

func (cw *connectWizard) runModeBImport(importer *connector.CSVImporter) {
	if len(cw.modeBHeaders) == 0 || len(cw.modeBRawRows) == 0 {
		return
	}
	cw.modeBImportBtn.Disable()
	cw.modeBStatus.SetText("Importing…")

	go func() {
		cm, err := connector.AutoColumnMap(cw.modeBHeaders)
		if err != nil {
			fyne.Do(func() {
				cw.modeBStatus.SetText("Column map error: " + err.Error())
				cw.modeBImportBtn.Enable()
			})
			return
		}

		rows, result, err := importer.Import(cw.modeBHeaders, cw.modeBRawRows, cm)
		if err != nil {
			fyne.Do(func() {
				cw.modeBStatus.SetText("Parse error: " + err.Error())
				cw.modeBImportBtn.Enable()
			})
			return
		}

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancel()

		importResult, err := cw.backend.ImportCSV(ctx, rows, "local")
		if err != nil {
			fyne.Do(func() {
				cw.modeBStatus.SetText("Import error: " + err.Error())
				cw.modeBImportBtn.Enable()
			})
			return
		}

		fyne.Do(func() {
			msg := fmt.Sprintf("Done — %d enrolled, %d skipped (of %d total)",
				importResult.Enrolled, importResult.Skipped, result.Total)
			if len(importResult.Errors) > 0 {
				msg += fmt.Sprintf(". %d error(s): %s",
					len(importResult.Errors),
					strings.Join(importResult.Errors[:min(3, len(importResult.Errors))], "; "))
			}
			cw.modeBStatus.SetText(msg)
			cw.modeBImportBtn.Enable()
			if importResult.Enrolled > 0 && cw.onEnrolled != nil {
				cw.onEnrolled()
			}
		})
	}()
}

// ── Mode C — Cloud Assets (Deferred) ─────────────────────────────────────────

func (cw *connectWizard) buildModeC() fyne.CanvasObject {
	header := canvas.NewText("Cloud Asset Discovery", asaftheme.TextPrimary)
	header.TextSize = 15
	header.TextStyle = fyne.TextStyle{Bold: true}

	badge := canvas.NewText("COMING IN FUTURE RELEASE", asaftheme.NodeOrange)
	badge.TextSize = 12
	badge.TextStyle = fyne.TextStyle{Bold: true}

	body := widget.NewRichTextFromMarkdown(`**AWS GovCloud** and **Azure Government** cloud asset discovery connectors are planned for the next release.

When available, this mode will:
- Pull EC2 instances from GovCloud via a read-only IAM role (no write permissions required)
- Pull Azure VMs from GovCloud tenants via a service principal with Reader role
- Auto-map instances to enclaves by VPC / resource group
- Auto-detect OS and assign STIG profiles

No data leaves your perimeter — the connector makes read-only API calls from your own machine to your own cloud tenant using your own credentials.

For now, enroll cloud assets using **Mode B (CSV Import)** with an exported asset inventory, or **Mode D (Manual)** for individual hosts.`)
	body.Wrapping = fyne.TextWrapWord

	awsCard := widget.NewCard("AWS GovCloud EC2", "IAM Role — Read Only",
		container.NewVBox(
			widget.NewLabel("Status: Not yet available"),
			widget.NewLabel("Auth: IAM instance role or access key (read-only)"),
		),
	)

	azureCard := widget.NewCard("Azure Government VMs", "Service Principal — Reader Role",
		container.NewVBox(
			widget.NewLabel("Status: Not yet available"),
			widget.NewLabel("Auth: Azure service principal (Reader role)"),
		),
	)

	return container.NewBorder(
		container.NewVBox(header, badge, widget.NewSeparator()),
		nil, nil, nil,
		container.NewPadded(container.NewVBox(body, awsCard, azureCard)),
	)
}

// ── Mode D — Manual SSH / WinRM ───────────────────────────────────────────────

func (cw *connectWizard) buildModeD() fyne.CanvasObject {
	header := canvas.NewText("Manual Asset Add", asaftheme.TextPrimary)
	header.TextSize = 15
	header.TextStyle = fyne.TextStyle{Bold: true}

	desc := widget.NewLabel("Enter connection details for a single host. Use [Test Connection] to verify reachability before enrolling.")
	desc.Wrapping = fyne.TextWrapWord

	// Protocol selection.
	protoRadio := widget.NewRadioGroup([]string{"SSH (Linux / Unix)", "WinRM (Windows)"}, nil)
	protoRadio.SetSelected("SSH (Linux / Unix)")

	hostEntry := widget.NewEntry()
	hostEntry.SetPlaceHolder("hostname or IP address")

	portEntry := widget.NewEntry()
	portEntry.SetText("22")

	authSelect := widget.NewSelect([]string{"Password", "SSH Private Key"}, nil)
	authSelect.SetSelected("Password")

	usernameEntry := widget.NewEntry()
	usernameEntry.SetPlaceHolder("e.g. admin")

	secretEntry := widget.NewPasswordEntry()
	secretEntry.SetPlaceHolder("password or passphrase")

	keyPathEntry := widget.NewEntry()
	keyPathEntry.SetPlaceHolder("path to private key file (optional)")
	keyPathEntry.Hide()

	// Auto-switch port and auth options by protocol.
	protoRadio.OnChanged = func(proto string) {
		if strings.Contains(proto, "WinRM") {
			portEntry.SetText("5985")
			authSelect.Options = []string{"Password"}
			authSelect.SetSelected("Password")
			keyPathEntry.Hide()
		} else {
			portEntry.SetText("22")
			authSelect.Options = []string{"Password", "SSH Private Key"}
		}
	}

	authSelect.OnChanged = func(method string) {
		if method == "SSH Private Key" {
			secretEntry.SetPlaceHolder("key passphrase (leave blank if none)")
			keyPathEntry.Show()
		} else {
			secretEntry.SetPlaceHolder("password")
			keyPathEntry.Hide()
		}
	}

	cw.enclaveSelectD = widget.NewSelect(cw.enclaveNames(), nil)
	if len(cw.enclaves) > 0 {
		cw.enclaveSelectD.SetSelected(cw.enclaves[0].Name)
	}

	// Test result badge.
	testBadge := canvas.NewText("", asaftheme.TextMuted)
	testBadge.TextSize = 12
	testBadge.TextStyle = fyne.TextStyle{Bold: true}

	testDetails := widget.NewLabel("")
	testDetails.Wrapping = fyne.TextWrapWord

	testBtn := widget.NewButtonWithIcon("Test Connection", theme.MediaPlayIcon(), nil)
	testBtn.Importance = widget.MediumImportance

	enrollBtn := widget.NewButtonWithIcon("Enroll Asset", theme.ConfirmIcon(), nil)
	enrollBtn.Importance = widget.HighImportance
	enrollBtn.Disable()

	buildCred := func() *hub.ConnectorCred {
		cred := &hub.ConnectorCred{
			Username: usernameEntry.Text,
			Secret:   secretEntry.Text,
		}
		if authSelect.Selected == "SSH Private Key" {
			cred.AuthMethod = "ssh_key"
			cred.SSHKeyPath = keyPathEntry.Text
		} else {
			cred.AuthMethod = "password"
		}
		return cred
	}

	buildCfg := func() hub.ConnectorConfig {
		proto := connector.ProtoSSH
		if strings.Contains(protoRadio.Selected, "WinRM") {
			proto = connector.ProtoWinRM
		}
		port := 22
		fmt.Sscanf(portEntry.Text, "%d", &port)

		return hub.ConnectorConfig{
			Protocol:   proto,
			Host:       strings.TrimSpace(hostEntry.Text),
			Port:       port,
			Username:   usernameEntry.Text,
			AuthMethod: func() string {
				if authSelect.Selected == "SSH Private Key" {
					return "ssh_key"
				}
				return "password"
			}(),
			EnclaveID: cw.enclaveIDByName(cw.enclaveSelectD.Selected),
		}
	}

	testBtn.OnTapped = func() {
		host := strings.TrimSpace(hostEntry.Text)
		if host == "" {
			dialog.ShowError(fmt.Errorf("hostname or IP is required"), cw.win)
			return
		}
		testBtn.Disable()
		enrollBtn.Disable()
		testBadge.Text = "Testing…"
		testBadge.Color = asaftheme.TextMuted
		testBadge.Refresh()
		testDetails.SetText("")

		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 30 * time.Second)
			defer cancel()

			result, err := cw.backend.TestConnection(ctx, buildCfg(), buildCred())
			fyne.Do(func() {
				testBtn.Enable()
				if err != nil {
					testBadge.Text = "✗ Error"
					testBadge.Color = asaftheme.NodeRed
					testDetails.SetText(err.Error())
					testBadge.Refresh()
					return
				}
				if result.Success {
					testBadge.Text = "✓ Connected"
					testBadge.Color = asaftheme.NodeGreen
					detail := fmt.Sprintf("OS: %s  |  STIG Profile: %s  |  Latency: %dms",
						result.RemoteOS, result.STIGProfile, result.Latency.Milliseconds())
					if result.HostKey != "" {
						detail += "\nHost Key (SHA-256): " + result.HostKey
					}
					testDetails.SetText(detail)
					cw.modeDResult = result
					enrollBtn.Enable()
				} else {
					testBadge.Text = "✗ Failed"
					testBadge.Color = asaftheme.NodeRed
					testDetails.SetText(result.Message)
					cw.modeDResult = nil
				}
				testBadge.Refresh()
			})
		}()
	}

	enrollBtn.OnTapped = func() {
		host := strings.TrimSpace(hostEntry.Text)
		if host == "" {
			return
		}
		remoteOS, stigProfile := "", ""
		if cw.modeDResult != nil {
			remoteOS = cw.modeDResult.RemoteOS
			stigProfile = cw.modeDResult.STIGProfile
		}

		enrollBtn.Disable()
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 30 * time.Second)
			defer cancel()

			// Persist connector config so future scans can reuse it.
			cfg := buildCfg()
			cfg.Name = host
			_ = cw.backend.SaveConnector(ctx, cfg, buildCred())

			hostname := host
			ip := host

			_, err := cw.backend.AddAsset(ctx, hub.AddAssetRequest{
				EnclaveID:   cfg.EnclaveID,
				Hostname:    hostname,
				IPAddress:   ip,
				OS:          remoteOS,
				STIGProfile: stigProfile,
				ConnectorID: cfg.ID,
			})

			fyne.Do(func() {
				if err != nil {
					dialog.ShowError(fmt.Errorf("enroll failed: %w", err), cw.win)
					enrollBtn.Enable()
					return
				}
				testBadge.Text = "✓ Enrolled"
				testBadge.Color = asaftheme.AKGold
				testBadge.Refresh()
				testDetails.SetText(fmt.Sprintf("%s has been added to the fleet.", hostname))
				enrollBtn.Disable()
				if cw.onEnrolled != nil {
					cw.onEnrolled()
				}
			})
		}()
	}

	form := widget.NewForm(
		widget.NewFormItem("Protocol", protoRadio),
		widget.NewFormItem("Host / IP", hostEntry),
		widget.NewFormItem("Port", portEntry),
		widget.NewFormItem("Auth Method", authSelect),
		widget.NewFormItem("Username", usernameEntry),
		widget.NewFormItem("Password / Passphrase", secretEntry),
		widget.NewFormItem("SSH Key Path", keyPathEntry),
		widget.NewFormItem("Target Enclave", cw.enclaveSelectD),
	)

	btnRow := container.NewHBox(testBtn, enrollBtn)
	resultRow := container.NewVBox(testBadge, testDetails)

	return container.NewBorder(
		container.NewVBox(header, desc),
		nil, nil, nil,
		container.NewPadded(container.NewVBox(form, btnRow, widget.NewSeparator(), resultRow)),
	)
}

// ── package-level helpers ─────────────────────────────────────────────────────


func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
