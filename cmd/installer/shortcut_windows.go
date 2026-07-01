//go:build windows

package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// createShortcuts creates Start Menu and Desktop shortcuts using PowerShell's
// WScript.Shell COM object — the most reliable pure-Go-invokable approach
// that works without additional packages.
func createShortcuts(cfg *InstallConfig, desktopExe string) error {
	var errs []string

	if cfg.Components.StartMenu {
		startMenu := startMenuDir()
		groupDir := filepath.Join(startMenu, "AdinKhepra ASAF")
		if err := os.MkdirAll(groupDir, 0755); err != nil {
			errs = append(errs, fmt.Sprintf("create Start Menu dir: %v", err))
		} else {
			links := []struct {
				target string
				args   string
				link   string
				desc   string
			}{
				{desktopExe, "", filepath.Join(groupDir, "AdinKhepra Compliance Graph.lnk"),
					"AdinKhepra ASAF — CMMC Compliance Graph Desktop"},
				{filepath.Join(cfg.InstallDir, "adinkhepra.exe"), "", filepath.Join(groupDir, "AdinKhepra CLI.lnk"),
					"AdinKhepra ASAF CLI — ERT, scan, validate"},
				{filepath.Join(cfg.InstallDir, "Uninstall.exe"), "", filepath.Join(groupDir, "Uninstall AdinKhepra ASAF.lnk"),
					"Uninstall AdinKhepra ASAF"},
			}
			for _, lnk := range links {
				if err := psCreateShortcut(lnk.target, lnk.args, lnk.link, lnk.desc, desktopExe); err != nil {
					errs = append(errs, fmt.Sprintf("%s: %v", filepath.Base(lnk.link), err))
				}
			}
		}
	}

	if cfg.Components.DesktopShortcut {
		userDesktop := desktopDir()
		lnkPath := filepath.Join(userDesktop, "AdinKhepra Compliance Graph.lnk")
		if err := psCreateShortcut(desktopExe, "", lnkPath,
			"AdinKhepra ASAF — CMMC Compliance Graph Desktop", desktopExe); err != nil {
			errs = append(errs, fmt.Sprintf("desktop shortcut: %v", err))
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("%s", strings.Join(errs, "; "))
	}
	return nil
}

// psCreateShortcut invokes PowerShell WScript.Shell to create a .lnk file.
func psCreateShortcut(target, args, linkPath, description, iconSource string) error {
	// Escape single quotes for PowerShell string embedding
	esc := func(s string) string { return strings.ReplaceAll(s, "'", "''") }

	script := fmt.Sprintf(`
$ws = New-Object -ComObject WScript.Shell
$s = $ws.CreateShortcut('%s')
$s.TargetPath = '%s'
$s.Arguments = '%s'
$s.Description = '%s'
$s.IconLocation = '%s,0'
$s.WorkingDirectory = '%s'
$s.Save()
`,
		esc(linkPath),
		esc(target),
		esc(args),
		esc(description),
		esc(iconSource),
		esc(filepath.Dir(target)),
	)

	cmd := exec.Command("powershell.exe",
		"-NoProfile", "-NonInteractive",
		"-Command", script)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("ps shortcut: %w — %s", err, strings.TrimSpace(string(out)))
	}
	return nil
}

// startMenuDir returns the All Users Start Menu Programs directory.
func startMenuDir() string {
	if p := os.Getenv("ALLUSERSPROFILE"); p != "" {
		candidate := filepath.Join(p, "Microsoft", "Windows", "Start Menu", "Programs")
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
	}
	return filepath.Join(os.Getenv("ProgramData"),
		"Microsoft", "Windows", "Start Menu", "Programs")
}

// desktopDir returns the current user's Desktop folder.
func desktopDir() string {
	if p := os.Getenv("USERPROFILE"); p != "" {
		return filepath.Join(p, "Desktop")
	}
	return filepath.Join(os.Getenv("HOMEDRIVE")+os.Getenv("HOMEPATH"), "Desktop")
}
