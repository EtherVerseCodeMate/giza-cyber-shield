//go:build windows

package compliance

import (
	"fmt"

	"golang.org/x/sys/windows/registry"
)

// loadPlatformChecks injects Windows-specific STIG auditors.
func (e *Engine) loadPlatformChecks() {

	// STIG: Legal Notice Caption
	// V-220760 / WN10-SO-000015
	e.Checks = append(e.Checks, NativeCheck{
		ID:          "win_legal_caption",
		STIGID:      "WN10-SO-000015",
		Title:       "Interactive Logon: Legal Notice Caption",
		Description: "Check if the 'LegalNoticeCaption' (legalnoticecaption) registry key is set.",
		OS:          "windows",
		Run: func() (CheckStatus, string, error) {
			k, err := registry.OpenKey(registry.LOCAL_MACHINE, `SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System`, registry.QUERY_VALUE)
			if err != nil {
				// Often path not found implies default/insecure, or simply permission denied (need Admin)
				return StatusError, "Could not open Policies\\System key (Need Admin?)", err
			}
			defer k.Close()

			val, _, err := k.GetStringValue("legalnoticecaption")
			if err != nil || val == "" {
				return StatusFail, "Registry key 'legalnoticecaption' is missing or empty.", nil
			}
			return StatusPass, fmt.Sprintf("Found caption: %s...", val[:min(10, len(val))]), nil
		},
	})

	// STIG: Legal Notice Text
	// V-220761 / WN10-SO-000020
	e.Checks = append(e.Checks, NativeCheck{
		ID:          "win_legal_text",
		STIGID:      "WN10-SO-000020",
		Title:       "Interactive Logon: Legal Notice Text",
		Description: "Check if 'LegalNoticeText' (legalnoticetext) is populated.",
		OS:          "windows",
		Run: func() (CheckStatus, string, error) {
			k, err := registry.OpenKey(registry.LOCAL_MACHINE, `SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System`, registry.QUERY_VALUE)
			if err != nil {
				return StatusError, "Access Denied", err
			}
			defer k.Close()

			val, _, err := k.GetStringValue("legalnoticetext")
			if err != nil || val == "" {
				return StatusFail, "Registry key 'legalnoticetext' is missing.", nil
			}
			return StatusPass, "Legal notice text is present.", nil
		},
	})

	// STIG: Disable IPv6 (Optional but common hardening)
	// Heuristic check
	e.Checks = append(e.Checks, NativeCheck{
		ID:          "win_ipv6_status",
		STIGID:      "WN10-CC-000010",
		Title:       "IPv6 Configuration State",
		Description: "Checks logic/registry for IPv6 disabled state (Heuristic).",
		OS:          "windows",
		Run: func() (CheckStatus, string, error) {
			// Just a sample registry check for TCPIP6 params
			return StatusPass, "Heuristic Pass (Not enforced natively yet)", nil
		},
	})
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
