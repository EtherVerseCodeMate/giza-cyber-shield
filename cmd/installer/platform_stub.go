//go:build !windows

// platform_stub.go provides no-op implementations of the Windows-only
// installation operations so the installer compiles on Linux and macOS.
// On those platforms, installation is handled by install.sh / fyne package
// rather than this wizard — the wizard is Windows-only in practice.

package main

func registerServices(cfg *InstallConfig, desktopExe, daemonExe, keyDir, dagDir string) error {
	return nil
}

func registerUninstall(cfg *InstallConfig) error {
	return nil
}

func appendToWindowsPath(dir string) error {
	return nil
}

func createShortcuts(cfg *InstallConfig, desktopExe string) error {
	return nil
}
