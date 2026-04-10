//go:build darwin

package agent

import "fmt"

// Run starts the ASAF agent. On macOS use launchd or run directly.
func Run(baseDir string) {
	fmt.Println("[agent] Run: use 'sudo launchctl load /Library/LaunchDaemons/com.nouchix.asaf.plist' on macOS.")
}

// InstallService installs the agent as a launchd daemon (not yet implemented).
func InstallService(exePath string) error {
	return fmt.Errorf("InstallService: macOS launchd integration not yet implemented — run 'asaf run' manually")
}

// RemoveService removes the launchd daemon (not yet implemented).
func RemoveService() error {
	return fmt.Errorf("RemoveService: macOS launchd integration not yet implemented")
}
