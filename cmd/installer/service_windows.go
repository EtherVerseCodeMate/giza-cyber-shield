//go:build windows

package main

import (
	"fmt"

	"golang.org/x/sys/windows/svc/mgr"
)

// registerServices installs both Windows services using the Service Control Manager.
//
//   AdinKhepraASAF       → adinkhepra-desktop.exe --headless --port 8443
//   AdinKhepraASAFDaemon → asaf-daemon.exe --pipe \\.\pipe\asaf-daemon
//
// If either service already exists it is updated in-place (start type, description).
func registerServices(cfg *InstallConfig, desktopExe, daemonExe, keyDir, dagDir string) error {
	m, err := mgr.Connect()
	if err != nil {
		return fmt.Errorf("connect to SCM: %w", err)
	}
	defer m.Disconnect()

	var startType uint32 = mgr.StartManual
	if cfg.Components.AutoStart {
		startType = mgr.StartAutomatic
	}

	// ── Dashboard service (headless desktop → port 8443) ──────────────────────
	if cfg.Components.Desktop {
		svcName := "AdinKhepraASAF"
		if err := installOrUpdateService(m, svcName, desktopExe,
			mgr.Config{
				DisplayName:  "AdinKhepra ASAF",
				Description:  "AdinKhepra ASAF Compliance Graph — headless dashboard on 127.0.0.1:8443",
				StartType:    startType,
				ServiceType:  0x10, // SERVICE_WIN32_OWN_PROCESS
			},
			"--headless", "--port", "8443",
		); err != nil {
			return fmt.Errorf("service %s: %w", svcName, err)
		}
	}

	// ── Daemon service (privileged execution layer) ────────────────────────────
	if cfg.Components.Daemon {
		svcName := "AdinKhepraASAFDaemon"
		agentPubKey := keyDir + `\instance.pub`
		dagPath := dagDir
		keyPath := keyDir + `\daemon.key`

		if err := installOrUpdateService(m, svcName, daemonExe,
			mgr.Config{
				DisplayName:  "AdinKhepra ASAF Daemon",
				Description:  "ASAF privileged compliance execution daemon — ML-DSA-65 gated",
				StartType:    startType,
				ServiceType:  0x10,
			},
			"--pipe", `\\.\pipe\asaf-daemon`,
			"--dag-path", dagPath,
			"--key-path", keyPath,
			"--agent-pubkey", agentPubKey,
		); err != nil {
			return fmt.Errorf("service %s: %w", svcName, err)
		}
	}

	return nil
}

// installOrUpdateService creates or reconfigures a service in the SCM.
func installOrUpdateService(m *mgr.Mgr, name, exePath string, config mgr.Config, args ...string) error {
	s, err := m.OpenService(name)
	if err == nil {
		// Service exists — update config
		defer s.Close()
		if err := s.UpdateConfig(config); err != nil {
			return fmt.Errorf("update config: %w", err)
		}
		return nil
	}

	// Create new service
	s, err = m.CreateService(name, exePath, config, args...)
	if err != nil {
		return fmt.Errorf("create service: %w", err)
	}
	defer s.Close()
	return nil
}
