// Package stig — check_engine.go
//
// Table-driven STIG check engine.  A CheckSpec row fully describes one STIG
// rule: how to detect the configuration state (CheckType + Target + Expected)
// and how to remediate it (FixSpec.Argv — a shell-free argv array routed
// through the daemon's ops_catalog).
//
// Call RunCheck to execute one spec against the live system:
//
//	finding := RunCheck(spec, checker, db)
//
// All Finding metadata (title, severity, CCI/NIST/CMMC references) is
// resolved from the embedded compliance database — never duplicated in the
// table rows.  This keeps the data tables auditable side-by-side with the
// DISA XCCDF benchmarks.
package stig

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"
)

// ── Types ─────────────────────────────────────────────────────────────────────

// CheckType identifies which detection primitive the engine should invoke.
type CheckType string

const (
	// CheckSSHConfig reads a parameter from /etc/ssh/sshd_config.
	// Target = parameter name (e.g. "PermitRootLogin"), Expected = required value.
	CheckSSHConfig CheckType = "ssh_config"

	// CheckSysctl reads a sysctl kernel parameter.
	// Target = parameter key (e.g. "net.ipv4.conf.all.send_redirects"), Expected = "0".
	CheckSysctl CheckType = "sysctl"

	// CheckPackage asserts a package is installed.
	// Target = package name (e.g. "aide"), Expected = "" (any version passes).
	CheckPackage CheckType = "package_installed"

	// CheckServiceActive asserts a systemd service is active (running).
	// Target = service name (e.g. "firewalld").
	CheckServiceActive CheckType = "service_active"

	// CheckServiceEnabled asserts a systemd service is enabled (starts on boot).
	// Target = service name.
	CheckServiceEnabled CheckType = "service_enabled"

	// CheckFileContains asserts a file exists and contains a specific substring.
	// Target = absolute path, Expected = substring that must appear.
	CheckFileContains CheckType = "file_contains"

	// CheckFileExists asserts a file or directory exists (or must NOT exist when
	// Expected = "absent").
	CheckFileExists CheckType = "file_exists"

	// CheckFileMode asserts a file's Unix permission bits.
	// Target = absolute path, Expected = octal mode string (e.g. "0600").
	CheckFileMode CheckType = "file_mode"

	// CheckModuleDisabled asserts a kernel module is install-blocked.
	// Target = module name (e.g. "usb-storage").
	// Pass when modprobe --showconfig shows "install <module> /bin/true".
	CheckModuleDisabled CheckType = "module_disabled"

	// CheckGrubArg asserts a kernel command-line argument is present in /proc/cmdline.
	// Target = argument (e.g. "audit=1"), Expected = "" (presence) or value after "=".
	CheckGrubArg CheckType = "grub_arg"

	// CheckAuditRule asserts an auditctl rule is active.
	// Target = substring that must appear in `auditctl -l` output.
	CheckAuditRule CheckType = "audit_rule"

	// CheckPAMConfig asserts a PAM configuration line exists in a module file.
	// Target = PAM config file (e.g. "/etc/pam.d/system-auth"),
	// Expected = substring that must appear (e.g. "pam_pwquality.so").
	CheckPAMConfig CheckType = "pam_config"

	// CheckMountOption asserts a filesystem is mounted with a required option.
	// Target = mount point (e.g. "/tmp"), Expected = option (e.g. "noexec").
	CheckMountOption CheckType = "mount_option"

	// CheckManual always produces ManualReviewRequired.
	// Used for controls that require human judgment or site-specific configuration.
	CheckManual CheckType = "manual"
)

// FixSpec describes the automated remediation for a CheckSpec.
// Argv contains one or more argv arrays (each is one command, no shell).
// Symbol is auto-derived from Argv[0] via the daemon's symbolRequirements map;
// never set it manually — the daemon derives it.
type FixSpec struct {
	Argv   [][]string // Each inner slice is one command: {"systemctl","enable","firewalld"}
	Reboot bool       // True when a reboot is required after the fix
}

// CheckSpec is one row in a STIG check table.
// All display metadata (title, severity, CCI/NIST refs) is resolved from the
// compliance database at runtime — keep this struct minimal.
type CheckSpec struct {
	RuleID    string    // STIG rule ID: "SV-XXXXXXXX_rule"
	CheckType CheckType // Which primitive to invoke
	Target    string    // File path, sysctl key, service name, package name, etc.
	Expected  string    // Required value or content substring
	Fix       *FixSpec  // nil = no automated fix; manual-only
}

// ── Engine ────────────────────────────────────────────────────────────────────

// RunCheck executes one CheckSpec against the live system and returns a fully
// populated Finding.  Metadata (title, severity, references) is resolved from
// the compliance database.  A nil db is tolerated — the finding will be missing
// metadata but the detection result is still accurate.
func RunCheck(spec CheckSpec, checker *SystemChecker, db *ComplianceDatabase) Finding {
	f := Finding{
		ID:        spec.RuleID,
		CheckedAt: time.Now(),
	}

	// Resolve metadata from embedded DB when available.
	if db != nil {
		f.Title = db.GetSTIGTitle(spec.RuleID)
		severityStr := db.GetSTIGSeverity(spec.RuleID)
		f.Severity = parseSeverity(severityStr)
		if refs, err := db.GetCrossReferences(spec.RuleID); err == nil {
			f.References = refs
		}
	}

	// Run the detection primitive.
	status, actual, err := runDetection(spec, checker)

	if err != nil {
		f.Status = "Manual Review Required"
		f.Actual = fmt.Sprintf("check error: %v", err)
		f.Description = fmt.Sprintf("Automated check for %s could not complete: %v", spec.RuleID, err)
		return f
	}

	f.Status = status
	f.Actual = actual
	f.Expected = spec.Expected
	f.Description = describeCheck(spec)
	return f
}

// runDetection dispatches to the correct primitive and returns (status, actual, err).
func runDetection(spec CheckSpec, checker *SystemChecker) (status, actual string, err error) {
	switch spec.CheckType {
	case CheckSSHConfig:
		return checkSSHConfig(spec, checker)
	case CheckSysctl:
		return checkSysctl(spec, checker)
	case CheckPackage:
		return checkPackage(spec, checker)
	case CheckServiceActive:
		return checkServiceActive(spec, checker)
	case CheckServiceEnabled:
		return checkServiceEnabled(spec, checker)
	case CheckFileContains:
		return checkFileContains(spec, checker)
	case CheckFileExists:
		return checkFileExists(spec, checker)
	case CheckFileMode:
		return checkFileMode(spec, checker)
	case CheckModuleDisabled:
		return checkModuleDisabled(spec)
	case CheckGrubArg:
		return checkGrubArg(spec)
	case CheckAuditRule:
		return checkAuditRule(spec)
	case CheckPAMConfig:
		return checkPAMConfig(spec, checker)
	case CheckMountOption:
		return checkMountOption(spec)
	case CheckManual:
		return "Manual Review Required", "requires human review", nil
	default:
		return "Manual Review Required", fmt.Sprintf("unknown check type: %s", spec.CheckType), nil
	}
}

// ── Primitive implementations ─────────────────────────────────────────────────

func checkSSHConfig(spec CheckSpec, checker *SystemChecker) (string, string, error) {
	actual, err := checker.CheckSSHConfig(spec.Target)
	if err != nil {
		return "", "", err
	}
	if strings.EqualFold(strings.TrimSpace(actual), strings.TrimSpace(spec.Expected)) {
		return "Pass", actual, nil
	}
	return "Fail", actual, nil
}

func checkSysctl(spec CheckSpec, checker *SystemChecker) (string, string, error) {
	actual, err := checker.CheckSysctlValue(spec.Target)
	if err != nil {
		return "", "", err
	}
	if strings.TrimSpace(actual) == strings.TrimSpace(spec.Expected) {
		return "Pass", actual, nil
	}
	return "Fail", actual, nil
}

func checkPackage(spec CheckSpec, checker *SystemChecker) (string, string, error) {
	installed, version, err := checker.CheckPackageInstalled(spec.Target)
	if err != nil {
		return "", "", err
	}
	if installed {
		return "Pass", version, nil
	}
	return "Fail", "not installed", nil
}

func checkServiceActive(spec CheckSpec, checker *SystemChecker) (string, string, error) {
	active, err := checker.CheckServiceActive(spec.Target)
	if err != nil {
		return "", "", err
	}
	if active {
		return "Pass", "active", nil
	}
	return "Fail", "not active", nil
}

func checkServiceEnabled(spec CheckSpec, checker *SystemChecker) (string, string, error) {
	enabled, err := checker.CheckServiceEnabled(spec.Target)
	if err != nil {
		return "", "", err
	}
	if enabled {
		return "Pass", "enabled", nil
	}
	return "Fail", "not enabled", nil
}

func checkFileContains(spec CheckSpec, checker *SystemChecker) (string, string, error) {
	found, err := checker.CheckFileContains(spec.Target, spec.Expected)
	if err != nil {
		if os.IsNotExist(err) {
			return "Fail", fmt.Sprintf("%s: file not found", spec.Target), nil
		}
		return "", "", err
	}
	if found {
		return "Pass", fmt.Sprintf("contains: %q", spec.Expected), nil
	}
	return "Fail", fmt.Sprintf("does not contain: %q", spec.Expected), nil
}

func checkFileExists(spec CheckSpec, checker *SystemChecker) (string, string, error) {
	mustAbsent := strings.EqualFold(spec.Expected, "absent")
	exists, err := checker.CheckFileExists(spec.Target)
	if err != nil {
		return "", "", err
	}
	if mustAbsent {
		if !exists {
			return "Pass", "absent (as required)", nil
		}
		return "Fail", "present (must be absent)", nil
	}
	if exists {
		return "Pass", "exists", nil
	}
	return "Fail", "not found", nil
}

func checkFileMode(spec CheckSpec, checker *SystemChecker) (string, string, error) {
	mode, err := checker.CheckFilePermissions(spec.Target)
	if err != nil {
		if os.IsNotExist(err) {
			return "Not Applicable", fmt.Sprintf("%s: file not found", spec.Target), nil
		}
		return "", "", err
	}
	actual := fmt.Sprintf("%04o", mode)
	if actual == spec.Expected {
		return "Pass", actual, nil
	}
	return "Fail", actual, nil
}

// checkModuleDisabled checks `modprobe --showconfig` for "install <module> /bin/true".
// This is the canonical STIG-approved way to disable a kernel module.
func checkModuleDisabled(spec CheckSpec) (string, string, error) {
	out, err := exec.Command("modprobe", "--showconfig").Output()
	if err != nil {
		return "", "", fmt.Errorf("modprobe --showconfig: %w", err)
	}

	needle := fmt.Sprintf("install %s /bin/true", spec.Target)
	for _, line := range strings.Split(string(out), "\n") {
		if strings.Contains(strings.TrimSpace(line), needle) {
			return "Pass", "install blocked (/bin/true)", nil
		}
	}
	return "Fail", "not blocked (no install /bin/true line)", nil
}

// checkGrubArg checks /proc/cmdline for the presence of a kernel argument.
// If Expected is empty, presence alone passes.  If Expected is non-empty, the
// argument must appear as either "Target" (flag) or "Target=Expected" (KV pair).
func checkGrubArg(spec CheckSpec) (string, string, error) {
	raw, err := os.ReadFile("/proc/cmdline")
	if err != nil {
		return "", "", fmt.Errorf("read /proc/cmdline: %w", err)
	}
	cmdline := strings.TrimSpace(string(raw))
	args := strings.Fields(cmdline)

	wantVal := spec.Expected
	for _, arg := range args {
		if wantVal == "" {
			// Presence check: "Target" or "Target=anything"
			if arg == spec.Target || strings.HasPrefix(arg, spec.Target+"=") {
				return "Pass", arg, nil
			}
		} else {
			// Key=value check
			if arg == spec.Target+"="+wantVal || arg == spec.Target && wantVal == "1" {
				return "Pass", arg, nil
			}
		}
	}
	return "Fail", cmdline, nil
}

// checkAuditRule checks `auditctl -l` output for the presence of Target substring.
func checkAuditRule(spec CheckSpec) (string, string, error) {
	out, err := exec.Command("auditctl", "-l").Output()
	if err != nil {
		return "", "", fmt.Errorf("auditctl -l: %w", err)
	}
	if strings.Contains(string(out), spec.Target) {
		return "Pass", strings.TrimSpace(spec.Target) + " rule present", nil
	}
	return "Fail", "rule not found in auditctl output", nil
}

// checkPAMConfig checks that a PAM configuration file contains the expected line.
func checkPAMConfig(spec CheckSpec, checker *SystemChecker) (string, string, error) {
	found, err := checker.CheckFileContains(spec.Target, spec.Expected)
	if err != nil {
		if os.IsNotExist(err) {
			return "Fail", fmt.Sprintf("%s: file not found", spec.Target), nil
		}
		return "", "", err
	}
	if found {
		return "Pass", fmt.Sprintf("contains: %q", spec.Expected), nil
	}
	return "Fail", fmt.Sprintf("does not contain: %q", spec.Expected), nil
}

// checkMountOption verifies that a filesystem is mounted with the required option.
// Reads /proc/mounts (authoritative runtime state) rather than /etc/fstab.
func checkMountOption(spec CheckSpec) (string, string, error) {
	raw, err := os.ReadFile("/proc/mounts")
	if err != nil {
		return "", "", fmt.Errorf("read /proc/mounts: %w", err)
	}
	for _, line := range strings.Split(string(raw), "\n") {
		fields := strings.Fields(line)
		if len(fields) < 4 {
			continue
		}
		mountPoint := fields[1]
		if mountPoint != spec.Target {
			continue
		}
		// fields[3] is the comma-separated options string
		for _, opt := range strings.Split(fields[3], ",") {
			if strings.TrimSpace(opt) == spec.Expected {
				return "Pass", fmt.Sprintf("%s mounted with %s", spec.Target, spec.Expected), nil
			}
		}
		return "Fail", fmt.Sprintf("%s lacks option %s (options: %s)", spec.Target, spec.Expected, fields[3]), nil
	}
	return "Not Applicable", fmt.Sprintf("%s not mounted", spec.Target), nil
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// parseSeverity converts a raw DB severity string to a Severity constant.
func parseSeverity(raw string) Severity {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "high", "cat i", "cat_i":
		return SeverityCAT1
	case "medium", "cat ii", "cat_ii":
		return SeverityCAT2
	case "low", "cat iii", "cat_iii":
		return SeverityCAT3
	}
	return SeverityCAT2
}

// describeCheck produces a one-sentence Description for a Finding.
func describeCheck(spec CheckSpec) string {
	switch spec.CheckType {
	case CheckSSHConfig:
		return fmt.Sprintf("sshd_config: %s must be %q", spec.Target, spec.Expected)
	case CheckSysctl:
		return fmt.Sprintf("sysctl %s must equal %q", spec.Target, spec.Expected)
	case CheckPackage:
		return fmt.Sprintf("package %q must be installed", spec.Target)
	case CheckServiceActive:
		return fmt.Sprintf("service %q must be active", spec.Target)
	case CheckServiceEnabled:
		return fmt.Sprintf("service %q must be enabled", spec.Target)
	case CheckFileContains:
		return fmt.Sprintf("%s must contain %q", spec.Target, spec.Expected)
	case CheckFileExists:
		if strings.EqualFold(spec.Expected, "absent") {
			return fmt.Sprintf("%s must not exist", spec.Target)
		}
		return fmt.Sprintf("%s must exist", spec.Target)
	case CheckFileMode:
		return fmt.Sprintf("%s must have permissions %s", spec.Target, spec.Expected)
	case CheckModuleDisabled:
		return fmt.Sprintf("kernel module %q must be install-blocked (/bin/true)", spec.Target)
	case CheckGrubArg:
		if spec.Expected == "" {
			return fmt.Sprintf("kernel command line must include %q", spec.Target)
		}
		return fmt.Sprintf("kernel command line must include %s=%s", spec.Target, spec.Expected)
	case CheckAuditRule:
		return fmt.Sprintf("auditctl must have rule matching %q", spec.Target)
	case CheckPAMConfig:
		return fmt.Sprintf("%s must contain %q", spec.Target, spec.Expected)
	case CheckMountOption:
		return fmt.Sprintf("%s must be mounted with option %q", spec.Target, spec.Expected)
	case CheckManual:
		return fmt.Sprintf("%s requires manual assessment", spec.Target)
	}
	return fmt.Sprintf("check %s on %s", spec.CheckType, spec.Target)
}
