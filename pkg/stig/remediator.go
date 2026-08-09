package stig

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/asaf/client"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/asaf/daemon"
)

// ExecutionLink defines the interface for running commands across the DEMARC
type ExecutionLink interface {
	Execute(command string, args []string) (string, error)
	GetContext() string // "local", "agent:<machine_id>"
}

// LocalLink implements direct execution on the current machine
type LocalLink struct{}

func (l *LocalLink) Execute(command string, args []string) (string, error) {
	cmd := exec.Command(command, args...)
	out, err := cmd.CombinedOutput()
	return string(out), err
}

func (l *LocalLink) GetContext() string { return "local" }

// DEMARCLink implements command execution via the Khepra Secure Gateway (DEMARC)
type DEMARCLink struct {
	MachineID string
	Manager   interface {
		ExecuteOnAgent(machineID string, command string, args []string) (string, error)
	}
}

func (d *DEMARCLink) Execute(command string, args []string) (string, error) {
	return d.Manager.ExecuteOnAgent(d.MachineID, command, args)
}

func (d *DEMARCLink) GetContext() string { return "agent:" + d.MachineID }

// DaemonLink routes privileged commands through the asaf-daemon ChangeRequest
// pipeline (ML-DSA-65 signed, staged, approved, DAG-attested).
// This is the production ExecutionLink — no direct sudo, no shell metacharacters.
type DaemonLink struct {
	client    *client.Client
	controlID string // STIG/CMMC control being remediated; populated per-call by Remediate
	dagParent string // parent DAG node for attestation chain
}

// NewDaemonLink constructs a DaemonLink.  controlID and dagParent are overwritten
// per-call; supply empty strings here and set them via WithControl before each
// Remediate call if needed.
func NewDaemonLink(c *client.Client) *DaemonLink {
	return &DaemonLink{client: c}
}

// WithControl returns a shallow copy of the link with controlID and dagParent set.
// Used by Remediate to stamp each ChangeRequest with the STIG rule being fixed.
func (d *DaemonLink) WithControl(controlID, dagParent string) *DaemonLink {
	cp := *d
	cp.controlID = controlID
	cp.dagParent = dagParent
	return &cp
}

// Execute builds a signed, staged ChangeRequest for command+args and submits it
// to the daemon. The daemon validates the symbol, stages the change in a mirror
// container, and returns immediately with a StagingID — human approval is required
// before production execution (Staging=true, Approved=false).
func (d *DaemonLink) Execute(command string, args []string) (string, error) {
	fullCmd := append([]string{command}, args...)
	symbol := daemon.RequiredSymbol(fullCmd)
	if symbol == "" {
		return "", fmt.Errorf("command %q: not in authorized daemon catalog (deny-by-default)", command)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	result, err := d.client.Submit(ctx, d.controlID, symbol, fullCmd, d.dagParent, true, false)
	if err != nil {
		return "", fmt.Errorf("daemon submit %q: %w", command, err)
	}
	if !result.Success {
		return result.Stdout + result.Stderr, fmt.Errorf("daemon: %s", result.Error)
	}
	return result.Stdout, nil
}

func (d *DaemonLink) GetContext() string { return "daemon" }

// Remediator orchestrates automated security fixes with Failsafe protection
type Remediator struct {
	checker *SystemChecker
	link    ExecutionLink
	backups string
}

// NewRemediator creates a new remediator instance
func NewRemediator(checker *SystemChecker) *Remediator {
	backupPath := "/var/khepra/backups"
	if os.Getenv("OS") == "Windows_NT" {
		backupPath = filepath.Join(os.Getenv("APPDATA"), "khepra", "backups")
	}
	os.MkdirAll(backupPath, 0700)

	return &Remediator{
		checker: checker,
		link:    &LocalLink{}, // Default to local, can be swapped for DEMARCLink
		backups: backupPath,
	}
}

// SetLink swaps the execution link (e.g. to a remote Agent via DEMARC)
func (r *Remediator) SetLink(link ExecutionLink) {
	r.link = link
}

// Remediate executes the remediation for a specific finding
func (r *Remediator) Remediate(findingID string) (*RemediationResult, error) {
	result := &RemediationResult{
		FindingID:    findingID,
		RemediatedAt: time.Now(),
		Status:       "Failed",
	}

	// Dispatch to control-specific remediation logic
	switch findingID {
	case "SV-257778r925321_rule": // SCAP Security Guide
		return r.RemediatePackageInstall("scap-security-guide")
	case "SV-257779r925324_rule": // Firewalld
		return r.RemediateFirewalld()
	case "SV-258090r926289_rule": // FIPS Mode
		return r.RemediateFIPSMode()
	case "SV-257860r925564_rule": // Auditd
		return r.RemediateServiceEnable("auditd")
	case "SV-257872r925600_rule": // SSH PermitRootLogin
		return r.RemediateSSHConfig("PermitRootLogin", "no")
	default:
		result.Status = "Requires Manual Intervention"
		result.Output = fmt.Sprintf("No automated remediation script available for %s", findingID)
		return result, nil
	}
}

// RemediatePackageInstall installs a missing package
func (r *Remediator) RemediatePackageInstall(packageName string) (*RemediationResult, error) {
	res := &RemediationResult{FindingID: packageName, Command: "dnf install -y " + packageName, RemediatedAt: time.Now()}

	out, err := r.link.Execute("dnf", []string{"install", "-y", packageName})
	res.Output = out

	if err != nil {
		res.Status = "Failed"
		return res, fmt.Errorf("failed to install package %s: %w", packageName, err)
	}

	res.Status = "Success"
	return res, nil
}

// RemediateServiceEnable enables and starts a systemd service
func (r *Remediator) RemediateServiceEnable(serviceName string) (*RemediationResult, error) {
	res := &RemediationResult{FindingID: serviceName, Command: "systemctl enable --now " + serviceName, RemediatedAt: time.Now()}

	out, err := r.link.Execute("systemctl", []string{"enable", "--now", serviceName})
	res.Output = out

	if err != nil {
		res.Status = "Failed"
		return res, fmt.Errorf("failed to enable service %s: %w", serviceName, err)
	}

	res.Status = "Success"
	return res, nil
}

// RemediateFirewalld handles firewalld specific fix
func (r *Remediator) RemediateFirewalld() (*RemediationResult, error) {
	// First ensure it is installed
	installRes, err := r.RemediatePackageInstall("firewalld")
	if err != nil {
		return installRes, err
	}

	// Then enable it
	return r.RemediateServiceEnable("firewalld")
}

// RemediateFIPSMode enables FIPS mode
func (r *Remediator) RemediateFIPSMode() (*RemediationResult, error) {
	res := &RemediationResult{FindingID: "fips", Command: "fips-mode-setup --enable", RemediatedAt: time.Now()}

	out, err := r.link.Execute("fips-mode-setup", []string{"--enable"})
	res.Output = out

	if err != nil {
		res.Status = "Failed"
		return res, fmt.Errorf("failed to enable FIPS: %w", err)
	}

	res.Status = "Success"
	res.Output += " [REBOOT REQUIRED]"
	return res, nil
}

// RemediateSSHConfig updates sshd_config via the asaf-confedit helper.
// asaf-confedit is an idempotent key=value setter registered in the daemon's
// ops_catalog under Nkyinkyim — it never invokes a shell and supports
// snapshot+rollback internally. This replaces the former "sudo bash -c" path
// that bypassed the daemon's validateCommand / symbolRequirements gates.
func (r *Remediator) RemediateSSHConfig(param, value string) (*RemediationResult, error) {
	configPath := "/etc/ssh/sshd_config"
	res := &RemediationResult{
		FindingID:    "ssh_" + param,
		Command:      fmt.Sprintf("asaf-confedit %s %s %s", configPath, param, value),
		RemediatedAt: time.Now(),
	}

	// 1. Snapshot before mutation (Failsafe — daemon also snapshots internally,
	//    this gives a local rollback path if daemon is unavailable).
	backup, err := r.snapshotFile(configPath)
	if err != nil {
		res.Status = "Failed"
		res.Output = "Failsafe Error: Could not create backup before fix."
		return res, err
	}

	// 2. Invoke asaf-confedit directly (no shell, no metacharacter injection risk).
	//    argv: ["asaf-confedit", "/etc/ssh/sshd_config", "PermitRootLogin", "no"]
	out, err := r.link.Execute("asaf-confedit", []string{configPath, param, value})
	res.Output = out

	if err != nil {
		res.Status = "Failed"
		r.rollbackFile(configPath, backup)
		return res, fmt.Errorf("asaf-confedit %s %s %s: %w", configPath, param, value, err)
	}

	// 3. Reload sshd to apply the change.
	if _, err = r.link.Execute("systemctl", []string{"reload", "sshd"}); err != nil {
		res.Status = "Failed"
		res.Output += " [RELOAD FAILED - ROLLING BACK]"
		r.rollbackFile(configPath, backup)
		return res, fmt.Errorf("systemctl reload sshd: %w", err)
	}

	res.Status = "Success"
	return res, nil
}

// snapshotFile creates a timestamped backup of a configuration file
func (r *Remediator) snapshotFile(path string) (string, error) {
	if r.link.GetContext() != "local" {
		// Remote snapshots would be handled by the Agent locally
		return "remote_agent_snapshot", nil
	}

	backupName := fmt.Sprintf("%s.%d.bak", filepath.Base(path), time.Now().Unix())
	target := filepath.Join(r.backups, backupName)

	sourceFile, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer sourceFile.Close()

	destFile, err := os.Create(target)
	if err != nil {
		return "", err
	}
	defer destFile.Close()

	_, err = io.Copy(destFile, sourceFile)
	return target, err
}

// rollbackFile restores a file from a snapshot using pure Go I/O.
// Only runs on the local path — the daemon handles its own rollback on the
// daemon side, and DaemonLink sets GetContext() == "daemon".
func (r *Remediator) rollbackFile(path, backup string) error {
	if r.link.GetContext() != "local" {
		return nil
	}
	data, err := os.ReadFile(backup)
	if err != nil {
		return fmt.Errorf("rollback read %s: %w", backup, err)
	}
	// Preserve permissions of the original (write-only, no mode change).
	info, err := os.Stat(path)
	mode := os.FileMode(0600)
	if err == nil {
		mode = info.Mode()
	}
	return os.WriteFile(path, data, mode)
}
