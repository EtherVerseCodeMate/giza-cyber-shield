//go:build windows

package main

import (
	"fmt"

	"golang.org/x/sys/windows/registry"
)

const uninstallKey = `SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\AdinKhepraASAF`
const systemPathKey = `SYSTEM\CurrentControlSet\Control\Session Manager\Environment`

// registerUninstall writes AdinKhepra ASAF to the Windows Add/Remove Programs list.
func registerUninstall(cfg *InstallConfig) error {
	k, _, err := registry.CreateKey(registry.LOCAL_MACHINE, uninstallKey, registry.ALL_ACCESS)
	if err != nil {
		return fmt.Errorf("open uninstall registry key: %w", err)
	}
	defer k.Close()

	uninstallExe := cfg.InstallDir + `\Uninstall.exe`

	entries := map[string]string{
		"DisplayName":     AppName + " v" + AppVersion,
		"DisplayVersion":  AppVersion,
		"Publisher":       Publisher,
		"URLInfoAbout":    "https://adinkhepra.com",
		"URLUpdateInfo":   "https://adinkhepra.com/releases",
		"UninstallString": uninstallExe,
		"InstallLocation": cfg.InstallDir,
		"Comments":        "Sovereign CMMC Autopilot Engine — ML-DSA-65 attested compliance",
	}

	for name, val := range entries {
		if err := k.SetStringValue(name, val); err != nil {
			return fmt.Errorf("write %s: %w", name, err)
		}
	}

	// NoModify/NoRepair: 1 = no Modify/Repair buttons in Add/Remove Programs
	if err := k.SetDWordValue("NoModify", 1); err != nil {
		return fmt.Errorf("write NoModify: %w", err)
	}
	if err := k.SetDWordValue("NoRepair", 1); err != nil {
		return fmt.Errorf("write NoRepair: %w", err)
	}

	return nil
}

// appendToWindowsPath appends dir to the system PATH environment variable in the registry.
// A reboot or logoff/logon is required for the change to take effect in existing processes.
func appendToWindowsPath(dir string) error {
	k, err := registry.OpenKey(registry.LOCAL_MACHINE, systemPathKey, registry.QUERY_VALUE|registry.SET_VALUE)
	if err != nil {
		return fmt.Errorf("open PATH key: %w", err)
	}
	defer k.Close()

	current, _, err := k.GetStringValue("Path")
	if err != nil {
		return fmt.Errorf("read Path: %w", err)
	}

	// Avoid duplicates
	for _, part := range splitPath(current) {
		if normPath(part) == normPath(dir) {
			return nil // already present
		}
	}

	newPath := current + ";" + dir
	if err := k.SetExpandStringValue("Path", newPath); err != nil {
		return fmt.Errorf("set Path: %w", err)
	}
	return nil
}

func splitPath(p string) []string {
	var out []string
	for _, s := range splitBy(p, ';') {
		if s != "" {
			out = append(out, s)
		}
	}
	return out
}

func splitBy(s string, sep byte) []string {
	var parts []string
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == sep {
			parts = append(parts, s[start:i])
			start = i + 1
		}
	}
	return append(parts, s[start:])
}

func normPath(p string) string {
	// Simple lowercasing and trimming for dedup — not canonical but good enough
	out := []byte(p)
	for i, c := range out {
		if c >= 'A' && c <= 'Z' {
			out[i] = c + 32
		}
	}
	// Trim trailing backslash
	if len(out) > 0 && out[len(out)-1] == '\\' {
		out = out[:len(out)-1]
	}
	return string(out)
}
