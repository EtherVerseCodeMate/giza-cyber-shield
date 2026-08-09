package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	"fyne.io/fyne/v2"
)

// InstallConfig holds all choices made through the wizard pages.
type InstallConfig struct {
	Version     string
	InstallDir  string
	DataDir     string
	LicenseJSON string
	Components  ComponentFlags
	LaunchAfter bool
}

// ComponentFlags mirrors the page 5 checkboxes.
type ComponentFlags struct {
	Desktop         bool
	CLI             bool
	Daemon          bool
	AutoStart       bool
	StartMenu       bool
	DesktopShortcut bool
	AddToPath       bool
}

func defaultInstallConfig() *InstallConfig {
	programFiles := os.Getenv("ProgramFiles")
	if programFiles == "" {
		programFiles = `C:\Program Files`
	}
	programData := os.Getenv("ProgramData")
	if programData == "" {
		programData = `C:\ProgramData`
	}
	return &InstallConfig{
		Version:    AppVersion,
		InstallDir: filepath.Join(programFiles, "AdinKhepra ASAF"),
		DataDir:    filepath.Join(programData, "AdinKhepra ASAF"),
		Components: ComponentFlags{
			Desktop:         true,
			CLI:             true,
			Daemon:          true,
			AutoStart:       true,
			StartMenu:       true,
			DesktopShortcut: true,
			AddToPath:       false,
		},
		LaunchAfter: true,
	}
}

// installProgress is sent on the channel from the install goroutine to the UI goroutine.
type installProgress struct {
	value   float64 // 0.0–1.0
	message string
	err     error // non-nil = fatal, halt install
}

// isStubBinary returns true if the binary looks like a placeholder (< 10 KB or no MZ header).
func isStubBinary(data []byte) bool {
	return len(data) < 10240 || len(data) < 2 || data[0] != 'M' || data[1] != 'Z'
}

// runInstallation executes on a goroutine, sending progress updates via the
// wizard's progressBar and logEntry. It calls wiz.show(6) when done (moves to page 7).
func (wiz *Wizard) runInstallation() {
	// Thread-safe UI helpers — all widget writes go through fyne.Do() since
	// runInstallation runs on a goroutine and SetContent/field writes are
	// not safe to call from off-thread in Fyne v2.
	var logLines []string

	appendLog := func(msg string) {
		logLines = append(logLines, msg)
		text := strings.Join(logLines, "\n")
		fyne.Do(func() { wiz.logEntry.SetText(text) })
	}
	progress := func(v float64, msg string) {
		line := fmt.Sprintf("[%.0f%%] %s", v*100, msg)
		logLines = append(logLines, line)
		text := strings.Join(logLines, "\n")
		fyne.Do(func() {
			wiz.progressBar.SetValue(v)
			wiz.logEntry.SetText(text)
		})
	}
	// done is called at the very end (success or fatal error) to unlock the
	// wizard on the main thread and move to the Finish page.
	done := func(installErr error, keyID string) {
		fyne.Do(func() {
			wiz.installErr = installErr
			wiz.enrolledKeyID = keyID
			wiz.btnNext.SetText("Next →")
			wiz.btnNext.Enable()
		})
	}

	// ── 1. Validate payload ────────────────────────────────────────────────────
	progress(0.02, "Validating installation payload…")
	stubBuild := isStubBinary(embeddedDesktop) || isStubBinary(embeddedCLI) || isStubBinary(embeddedDaemon)
	if stubBuild {
		appendLog("⚠ STUB BUILD — payload binaries are placeholders.")
		appendLog("  Run scripts/build-installer.ps1 to create a full installer.")
		appendLog("  Continuing in dry-run mode (no binaries will be written).")
	}

	// ── 2. Create directories ──────────────────────────────────────────────────
	progress(0.05, "Creating installation directories…")
	for _, d := range []string{
		wiz.cfg.InstallDir,
		wiz.cfg.DataDir,
		filepath.Join(wiz.cfg.DataDir, "keys"),
		filepath.Join(wiz.cfg.DataDir, "dag"),
		filepath.Join(wiz.cfg.DataDir, "mirror"),
		filepath.Join(wiz.cfg.InstallDir, "docs"),
	} {
		if err := os.MkdirAll(d, 0750); err != nil {
			done(fmt.Errorf("create directory %s: %w", d, err), "")
			return
		}
	}

	// ── 3. Extract binaries ────────────────────────────────────────────────────
	if !stubBuild {
		type binary struct {
			data []byte
			name string
			flag bool
		}
		for i, b := range []binary{
			{embeddedDesktop, "adinkhepra-desktop.exe", wiz.cfg.Components.Desktop},
			{embeddedCLI, "adinkhepra.exe", wiz.cfg.Components.CLI},
			{embeddedDaemon, "asaf-daemon.exe", wiz.cfg.Components.Daemon},
		} {
			if !b.flag {
				continue
			}
			progress(0.10+float64(i)*0.08, fmt.Sprintf("Extracting %s…", b.name))
			if err := os.WriteFile(filepath.Join(wiz.cfg.InstallDir, b.name), b.data, 0755); err != nil {
				done(fmt.Errorf("extract %s: %w", b.name, err), "")
				return
			}
		}
	}

	// ── 4. Write license ───────────────────────────────────────────────────────
	progress(0.35, "Installing license file…")
	if wiz.cfg.LicenseJSON != "" {
		licensePath := filepath.Join(wiz.cfg.DataDir, "license.adinkhepra")
		if err := os.WriteFile(licensePath, []byte(wiz.cfg.LicenseJSON), 0600); err != nil {
			appendLog(fmt.Sprintf("⚠ Could not write license: %v", err))
		} else {
			appendLog(fmt.Sprintf("  License written: %s", licensePath))
		}
	} else {
		appendLog("  No license key provided — Community edition.")
	}

	// ── 5. Generate ML-DSA-65 keypair + enroll ────────────────────────────────
	progress(0.45, "Generating ML-DSA-65 desktop instance keypair…")
	keyID, err := generateAndEnrollKey(wiz.cfg.DataDir, appendLog)
	if err != nil {
		appendLog(fmt.Sprintf("⚠ Key enrollment failed: %v", err))
		appendLog("  The daemon will require manual --agent-pubkey provisioning.")
		keyID = ""
	} else {
		appendLog(fmt.Sprintf("  Agent key enrolled: %s…", shortenKeyID(keyID)))
	}

	// ── 6. Register Windows services ──────────────────────────────────────────
	if wiz.cfg.Components.Daemon && !stubBuild {
		progress(0.60, "Registering AdinKhepra ASAF services…")
		desktopExe := filepath.Join(wiz.cfg.InstallDir, "adinkhepra-desktop.exe")
		daemonExe := filepath.Join(wiz.cfg.InstallDir, "asaf-daemon.exe")
		if err := registerServices(wiz.cfg, desktopExe, daemonExe,
			filepath.Join(wiz.cfg.DataDir, "keys"),
			filepath.Join(wiz.cfg.DataDir, "dag")); err != nil {
			appendLog(fmt.Sprintf("⚠ Service registration: %v", err))
		} else {
			appendLog("  Services registered: AdinKhepraASAF, AdinKhepraASAFDaemon")
		}
	}

	// ── 7. Registry (Add/Remove Programs) ─────────────────────────────────────
	progress(0.70, "Registering in Add/Remove Programs…")
	if err := registerUninstall(wiz.cfg); err != nil {
		appendLog(fmt.Sprintf("⚠ Registry write: %v", err))
	} else {
		appendLog("  Registered in Windows Add/Remove Programs.")
	}

	// ── 8. Shortcuts ──────────────────────────────────────────────────────────
	if wiz.cfg.Components.StartMenu || wiz.cfg.Components.DesktopShortcut {
		progress(0.80, "Creating shortcuts…")
		desktopExe := filepath.Join(wiz.cfg.InstallDir, "adinkhepra-desktop.exe")
		if err := createShortcuts(wiz.cfg, desktopExe); err != nil {
			appendLog(fmt.Sprintf("⚠ Shortcut creation: %v", err))
		} else {
			appendLog("  Start Menu and Desktop shortcuts created.")
		}
	}

	// ── 9. PATH (optional) ────────────────────────────────────────────────────
	if wiz.cfg.Components.AddToPath {
		progress(0.88, "Adding CLI to system PATH…")
		if err := addToSystemPath(wiz.cfg.InstallDir); err != nil {
			appendLog(fmt.Sprintf("⚠ PATH update: %v (add manually if needed)", err))
		} else {
			appendLog("  PATH updated. Restart your terminal to pick up the change.")
		}
	}

	// ── 10. Write docs/README ─────────────────────────────────────────────────
	progress(0.93, "Writing documentation…")
	writeReadme(wiz.cfg.InstallDir)

	// ── Done ──────────────────────────────────────────────────────────────────
	progress(1.0, "Installation complete.")
	appendLog("\n✅ AdinKhepra ASAF v" + AppVersion + " installed successfully.")
	appendLog("   Install dir: " + wiz.cfg.InstallDir)
	appendLog("   Data dir:    " + wiz.cfg.DataDir)
	appendLog("\n   Click Next → to finish.")
	done(nil, keyID)
}

// addToSystemPath appends the given directory to the Windows system PATH registry key.
func addToSystemPath(dir string) error {
	if runtime.GOOS != "windows" {
		return nil
	}
	return appendToWindowsPath(dir)
}

// writeReadme drops a brief README in docs/.
func writeReadme(installDir string) {
	readme := `AdinKhepra ASAF v` + AppVersion + `
` + Publisher + `
https://adinkhepra.com

BINARIES
  adinkhepra-desktop.exe   Compliance Graph Desktop (launch from Start Menu)
  adinkhepra.exe           CLI: ert, validate, scan, serve
  asaf-daemon.exe          Privileged daemon (runs as Windows Service)

QUICK START
  1. Launch AdinKhepra Compliance Graph from the Start Menu
  2. The ASAF System Daemon starts automatically as a Windows Service
  3. Run a scan: adinkhepra ert full .

DOCUMENTATION
  https://adinkhepra.com/docs

SUPPORT
  creatinghappyhumans@gmail.com
`
	_ = os.WriteFile(filepath.Join(installDir, "docs", "README.txt"), []byte(readme), 0644)
}

// freeSpaceString returns human-readable free disk space for the volume containing path.
func freeSpaceString(path string) string {
	// Stub: would use syscall.StatFs on Linux or GetDiskFreeSpaceEx on Windows.
	// Return a placeholder for cross-platform compatibility.
	vol := filepath.VolumeName(path)
	if vol == "" {
		vol = "C:"
	}
	out, err := exec.Command("powershell", "-NoProfile", "-NonInteractive",
		"-Command",
		fmt.Sprintf(`(Get-PSDrive -Name '%s').Free`, strings.TrimSuffix(vol, ":")),
	).Output()
	if err != nil || len(out) == 0 {
		return "unknown"
	}
	var bytes int64
	fmt.Sscan(strings.TrimSpace(string(out)), &bytes)
	return humanBytes(bytes)
}

func humanBytes(b int64) string {
	const unit = 1024
	if b < unit {
		return fmt.Sprintf("%d B", b)
	}
	div, exp := int64(unit), 0
	for n := b / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(b)/float64(div), "KMGTPE"[exp])
}

// launchDesktop starts adinkhepra-desktop.exe after a successful install.
func launchDesktop(installDir string) {
	exe := filepath.Join(installDir, "adinkhepra-desktop.exe")
	if _, err := os.Stat(exe); err != nil {
		return
	}
	cmd := exec.Command(exe)
	cmd.Dir = installDir
	_ = cmd.Start()
}

