// Package stig — check_gen.go
//
// GenerateCheckTable converts parsed XCCDF STIGRule records into CheckSpec
// rows suitable for the table-driven check engine.  It is a BUILD-TIME
// utility called by cmd/stig-updater --gen-go; it is never compiled into
// the asaf-desktop binary.
//
// Classification heuristic:
//   The DISA STIG CheckText follows very regular patterns (grep sshd_config,
//   sysctl, rpm -q, systemctl is-active, etc.).  We match these patterns in
//   priority order and fall back to CheckManual for anything ambiguous.  A
//   rule classified as CheckManual is still present in the output table so
//   the scan pipeline returns "Manual Review Required" for it rather than
//   silently skipping the control.
package stig

import (
	"fmt"
	"os"
	"regexp"
	"sort"
	"strings"
	"text/template"
	"time"
)

// ── Classification patterns ───────────────────────────────────────────────────

var (
	// SSH: grep PermitRootLogin /etc/ssh/sshd_config
	reSSHParam = regexp.MustCompile(
		`(?i)grep\s+(?:-i\s+)?(?:-E\s+)?"?(\w[\w-]*)"?\s+/etc/ssh/sshd_config`)

	// sshd -T output check: sshd -T | grep permitrootlogin
	reSSHdT = regexp.MustCompile(
		`(?i)sshd\s+-T\b.*\|\s*grep\s+(-E\s+)?"?(\w[\w-]*)"?`)

	// sysctl key = value
	reSysctl = regexp.MustCompile(
		`(?i)sysctl\s+(net\.\S+|kernel\.\S+|vm\.\S+|fs\.\S+)`)

	// sysctl -a | grep key = value
	reSysctlA = regexp.MustCompile(
		`(?i)sysctl\s+-a\b.*\|\s*grep\s+"?([\w.]+)"?`)

	// rpm -q package or dnf list package
	rePackage = regexp.MustCompile(
		`(?i)rpm\s+-q\s+([\w.+-]+)`)
	rePackageDnf = regexp.MustCompile(
		`(?i)dnf\s+list\s+([\w.+-]+)`)

	// systemctl is-active service
	reServiceActive = regexp.MustCompile(
		`(?i)systemctl\s+is-active\s+([\w.@-]+)`)

	// systemctl is-enabled service
	reServiceEnabled = regexp.MustCompile(
		`(?i)systemctl\s+is-enabled\s+([\w.@-]+)`)

	// modprobe --showconfig | grep install <module>
	reModuleDisabled = regexp.MustCompile(
		`(?i)modprobe\s+--showconfig\b.*install\s+([\w-]+)`)
	// lsmod | grep <module> (blacklist check variant)
	reLsmod = regexp.MustCompile(
		`(?i)(?:modprobe\s+-n\b|lsmod\b).*\b([\w-]+)(?:\s+module|\s+kernel)?`)

	// /proc/cmdline
	reProcCmdline = regexp.MustCompile(
		`(?i)/proc/cmdline\b`)
	// grep argument /proc/cmdline → extract arg name
	reCmdlineArg = regexp.MustCompile(
		`(?i)grep\s+(?:-[a-zA-Z]+\s+)?['""]?([\w.=-]+)['""]?\s+/proc/cmdline`)

	// auditctl -l
	reAuditctl = regexp.MustCompile(`(?i)auditctl\s+-l\b`)
	// Pattern of the rule being checked
	reAuditRule = regexp.MustCompile(
		`(?i)grep\s+(?:-[a-zA-Z]+\s+)?"([^"]+)"\s+/etc/audit`)

	// PAM config: grep module /etc/pam.d/filename
	rePAMConfig = regexp.MustCompile(
		`(?i)grep\s+(?:-[a-zA-Z]+\s+)?"?([^"\s/]+)"?\s+(/etc/pam\.d/[\w.-]+)`)

	// mount | grep /mountpoint
	reMountPoint = regexp.MustCompile(
		`(?i)(?:mount\b.*\|\s*grep\b|/proc/mounts\b.*grep\b|grep\s+\S+\s+/proc/mounts)\s+"?(/[\w/]+)"?`)

	// stat --format "%a" /path
	reFileStat = regexp.MustCompile(
		`(?i)stat\s+(?:--format[= ]['""]%a['""]|-c\s+['""]?%a['""]?)\s+([\w/.-]+)`)

	// ls -l /path (followed by expected mode)
	reLsL = regexp.MustCompile(
		`(?i)ls\s+-[la]+\s+([\w/.-]+)`)

	// test -e /path or [ -f /path ] or [ -d /path ]
	reFileExists = regexp.MustCompile(
		`(?i)(?:test\s+-[efd]\b|if\s*\[\s*-[efd])\s+['""]?([\w/.-]+)['""]?`)

	// grep pattern /etc/path (for file-contains checks)
	reFileContains = regexp.MustCompile(
		`(?i)grep\s+(?:-[a-zA-Z]+\s+)?"?([^"\s]+)"?\s+(/etc/[\w/.-]+|/var/[\w/.-]+|/usr/[\w/.-]+)`)

	// FixText patterns for argv extraction
	reFixSystemctl = regexp.MustCompile(
		`(?i)systemctl\s+(enable|disable|start|stop|restart|enable\s+--now|mask)\s+([\w.@-]+)`)
	reFixDnf = regexp.MustCompile(
		`(?i)dnf\s+(install|remove)\s+([\w.+:-]+)`)
	reFixSysctl = regexp.MustCompile(
		`(?i)sysctl\s+-w\s+([\w.]+)=(\S+)`)
	reFixGrubUpdate = regexp.MustCompile(
		`(?i)grub2-mkconfig`)
	reFixSELinux = regexp.MustCompile(
		`(?i)setenforce\s+1`)
	reFixFIPS = regexp.MustCompile(
		`(?i)fips-mode-setup\s+--enable`)
)

// ── Public API ────────────────────────────────────────────────────────────────

// ClassifyRule converts one parsed STIGRule into a CheckSpec.
// Metadata (Title, Severity, CCIs) is intentionally NOT stored in the spec —
// it lives in the CSV database and is resolved at runtime via GetSTIGTitle etc.
func ClassifyRule(rule STIGRule) CheckSpec {
	checkText := rule.CheckText
	fixText := rule.FixText

	// Priority order: most-specific patterns first.
	if spec, ok := trySSHConfig(rule.ID, checkText, fixText); ok {
		return spec
	}
	if spec, ok := trySysctl(rule.ID, checkText, fixText); ok {
		return spec
	}
	if spec, ok := tryPackage(rule.ID, checkText, fixText); ok {
		return spec
	}
	if spec, ok := tryServiceActive(rule.ID, checkText, fixText); ok {
		return spec
	}
	if spec, ok := tryServiceEnabled(rule.ID, checkText, fixText); ok {
		return spec
	}
	if spec, ok := tryModuleDisabled(rule.ID, checkText, fixText); ok {
		return spec
	}
	if spec, ok := tryAuditRule(rule.ID, checkText, fixText); ok {
		return spec
	}
	if spec, ok := tryGrubArg(rule.ID, checkText, fixText); ok {
		return spec
	}
	if spec, ok := tryPAMConfig(rule.ID, checkText, fixText); ok {
		return spec
	}
	if spec, ok := tryMountOption(rule.ID, checkText, fixText); ok {
		return spec
	}
	if spec, ok := tryFileMode(rule.ID, checkText, fixText); ok {
		return spec
	}
	if spec, ok := tryFileContains(rule.ID, checkText, fixText); ok {
		return spec
	}
	// Fallback: manual review
	return CheckSpec{
		RuleID:    rule.ID,
		CheckType: CheckManual,
		Target:    "",
		Expected:  "",
	}
}

// GenerateCheckTableGo downloads/parses the given STIG (already parsed into
// rules), classifies each rule, then writes a Go source file at outPath
// containing a []CheckSpec var named varName in package pkgName.
//
// Use stigFamily to name the variable, e.g. "rhel09" → var rhel09STIG = []CheckSpec{...}
func GenerateCheckTableGo(rules []STIGRule, stigFamily, pkgName, varName, outPath string) error {
	// Classify all rules.
	specs := make([]CheckSpec, 0, len(rules))
	for _, r := range rules {
		specs = append(specs, ClassifyRule(r))
	}

	// Sort by RuleID for deterministic output (makes git diffs readable).
	sort.Slice(specs, func(i, j int) bool {
		return specs[i].RuleID < specs[j].RuleID
	})

	// Render Go source.
	f, err := os.Create(outPath)
	if err != nil {
		return fmt.Errorf("create %s: %w", outPath, err)
	}
	defer f.Close()

	data := checkTableTemplateData{
		Package:    pkgName,
		VarName:    varName,
		STIGFamily: stigFamily,
		RuleCount:  len(specs),
		Generated:  time.Now().UTC().Format(time.RFC3339),
		Specs:      specs,
	}
	return checkTableTpl.Execute(f, data)
}

// ── Classifiers ───────────────────────────────────────────────────────────────

func trySSHConfig(ruleID, checkText, fixText string) (CheckSpec, bool) {
	var param string

	// Pattern 1: grep ParameterName /etc/ssh/sshd_config
	if m := reSSHParam.FindStringSubmatch(checkText); m != nil {
		param = m[1]
	} else if m := reSSHdT.FindStringSubmatch(checkText); m != nil {
		param = m[2]
	}

	if param == "" {
		return CheckSpec{}, false
	}
	param = canonicalSSHParam(param)
	expected := inferSSHExpected(param, checkText)

	var fix *FixSpec
	if expected != "" {
		fix = &FixSpec{
			Argv: [][]string{
				{"asaf-confedit", "/etc/ssh/sshd_config", param, expected},
				{"systemctl", "restart", "sshd"},
			},
		}
	}
	return CheckSpec{
		RuleID:    ruleID,
		CheckType: CheckSSHConfig,
		Target:    param,
		Expected:  expected,
		Fix:       fix,
	}, true
}

func trySysctl(ruleID, checkText, fixText string) (CheckSpec, bool) {
	var key string
	if m := reSysctl.FindStringSubmatch(checkText); m != nil {
		key = strings.TrimRight(m[1], " =")
	} else if m := reSysctlA.FindStringSubmatch(checkText); m != nil {
		key = m[1]
	}
	if key == "" {
		return CheckSpec{}, false
	}

	expected := inferSysctlExpected(key, checkText)
	var fix *FixSpec
	if expected != "" {
		if m := reFixSysctl.FindStringSubmatch(fixText); m != nil {
			fix = &FixSpec{
				Argv: [][]string{
					{"sysctl", "-w", m[1] + "=" + m[2]},
				},
			}
		} else {
			fix = &FixSpec{
				Argv: [][]string{
					{"sysctl", "-w", key + "=" + expected},
				},
			}
		}
	}
	return CheckSpec{
		RuleID:    ruleID,
		CheckType: CheckSysctl,
		Target:    key,
		Expected:  expected,
		Fix:       fix,
	}, true
}

func tryPackage(ruleID, checkText, fixText string) (CheckSpec, bool) {
	var pkg string
	if m := rePackage.FindStringSubmatch(checkText); m != nil {
		pkg = m[1]
	} else if m := rePackageDnf.FindStringSubmatch(checkText); m != nil {
		pkg = m[1]
	}
	if pkg == "" {
		return CheckSpec{}, false
	}

	var fix *FixSpec
	if m := reFixDnf.FindStringSubmatch(fixText); m != nil {
		if strings.EqualFold(m[1], "install") {
			fix = &FixSpec{
				Argv: [][]string{{"dnf", "install", "-y", m[2]}},
			}
		} else {
			fix = &FixSpec{
				Argv: [][]string{{"dnf", "remove", "-y", m[2]}},
			}
		}
	} else {
		fix = &FixSpec{
			Argv: [][]string{{"dnf", "install", "-y", pkg}},
		}
	}
	return CheckSpec{
		RuleID:    ruleID,
		CheckType: CheckPackage,
		Target:    pkg,
		Expected:  "",
		Fix:       fix,
	}, true
}

func tryServiceActive(ruleID, checkText, fixText string) (CheckSpec, bool) {
	m := reServiceActive.FindStringSubmatch(checkText)
	if m == nil {
		return CheckSpec{}, false
	}
	svc := strings.TrimSuffix(m[1], ".service")
	fix := inferServiceFix(svc, fixText, "enable --now")
	return CheckSpec{
		RuleID:    ruleID,
		CheckType: CheckServiceActive,
		Target:    svc,
		Expected:  "",
		Fix:       fix,
	}, true
}

func tryServiceEnabled(ruleID, checkText, fixText string) (CheckSpec, bool) {
	m := reServiceEnabled.FindStringSubmatch(checkText)
	if m == nil {
		return CheckSpec{}, false
	}
	svc := strings.TrimSuffix(m[1], ".service")
	fix := inferServiceFix(svc, fixText, "enable")
	return CheckSpec{
		RuleID:    ruleID,
		CheckType: CheckServiceEnabled,
		Target:    svc,
		Expected:  "",
		Fix:       fix,
	}, true
}

func tryModuleDisabled(ruleID, checkText, fixText string) (CheckSpec, bool) {
	var module string
	if m := reModuleDisabled.FindStringSubmatch(checkText); m != nil {
		module = m[1]
	} else if m := reLsmod.FindStringSubmatch(checkText); m != nil {
		// only if the context is clearly a "disabled" check
		if strings.Contains(strings.ToLower(checkText), "disable") ||
			strings.Contains(strings.ToLower(checkText), "blacklist") ||
			strings.Contains(strings.ToLower(checkText), "install /bin/true") {
			module = m[1]
		}
	}
	if module == "" {
		return CheckSpec{}, false
	}
	confFile := fmt.Sprintf("/etc/modprobe.d/disable-%s.conf", module)
	fix := &FixSpec{
		Argv: [][]string{
			{"bash", "-c",
				fmt.Sprintf("echo 'install %s /bin/true' > %s && echo 'blacklist %s' >> %s",
					module, confFile, module, confFile)},
		},
		Reboot: true,
	}
	return CheckSpec{
		RuleID:    ruleID,
		CheckType: CheckModuleDisabled,
		Target:    module,
		Expected:  "",
		Fix:       fix,
	}, true
}

func tryAuditRule(ruleID, checkText, fixText string) (CheckSpec, bool) {
	if !reAuditctl.MatchString(checkText) {
		return CheckSpec{}, false
	}
	// Extract the audit rule pattern being looked for
	target := ""
	if m := reAuditRule.FindStringSubmatch(checkText); m != nil {
		target = m[1]
	}
	if target == "" {
		// Fallback: extract a recognizable audit keyword from the rule text
		target = inferAuditTarget(checkText, ruleID)
	}
	if target == "" {
		return CheckSpec{}, false
	}

	var fix *FixSpec
	auditRule := inferAuditFix(target, fixText)
	if auditRule != "" {
		fix = &FixSpec{
			Argv: [][]string{
				{"bash", "-c", fmt.Sprintf("echo '%s' >> /etc/audit/rules.d/audit.rules", auditRule)},
				{"augenrules", "--load"},
			},
		}
	}
	return CheckSpec{
		RuleID:    ruleID,
		CheckType: CheckAuditRule,
		Target:    target,
		Expected:  "",
		Fix:       fix,
	}, true
}

func tryGrubArg(ruleID, checkText, fixText string) (CheckSpec, bool) {
	if !reProcCmdline.MatchString(checkText) {
		return CheckSpec{}, false
	}
	var arg, expected string
	if m := reCmdlineArg.FindStringSubmatch(checkText); m != nil {
		kv := strings.SplitN(m[1], "=", 2)
		arg = kv[0]
		if len(kv) == 2 {
			expected = kv[1]
		}
	}
	if arg == "" {
		return CheckSpec{}, false
	}

	var fix *FixSpec
	if reFixGrubUpdate.MatchString(fixText) {
		kv := arg
		if expected != "" {
			kv = arg + "=" + expected
		}
		fix = &FixSpec{
			Argv: [][]string{
				{"grubby", "--update-kernel=ALL", "--args=" + kv},
			},
			Reboot: true,
		}
	}
	return CheckSpec{
		RuleID:    ruleID,
		CheckType: CheckGrubArg,
		Target:    arg,
		Expected:  expected,
		Fix:       fix,
	}, true
}

func tryPAMConfig(ruleID, checkText, fixText string) (CheckSpec, bool) {
	m := rePAMConfig.FindStringSubmatch(checkText)
	if m == nil {
		return CheckSpec{}, false
	}
	module := m[1]
	pamFile := m[2]
	if !strings.HasPrefix(pamFile, "/etc/pam.d/") {
		return CheckSpec{}, false
	}
	return CheckSpec{
		RuleID:    ruleID,
		CheckType: CheckPAMConfig,
		Target:    pamFile,
		Expected:  module,
	}, true
}

func tryMountOption(ruleID, checkText, fixText string) (CheckSpec, bool) {
	m := reMountPoint.FindStringSubmatch(checkText)
	if m == nil {
		return CheckSpec{}, false
	}
	mountPoint := m[1]
	option := inferMountOption(mountPoint, checkText)
	if option == "" {
		return CheckSpec{}, false
	}
	return CheckSpec{
		RuleID:    ruleID,
		CheckType: CheckMountOption,
		Target:    mountPoint,
		Expected:  option,
	}, true
}

func tryFileMode(ruleID, checkText, fixText string) (CheckSpec, bool) {
	var target string
	if m := reFileStat.FindStringSubmatch(checkText); m != nil {
		target = m[1]
	} else if m := reLsL.FindStringSubmatch(checkText); m != nil {
		target = m[1]
	}
	if target == "" || !strings.HasPrefix(target, "/") {
		return CheckSpec{}, false
	}
	expected := inferExpectedMode(target, checkText, fixText)
	if expected == "" {
		return CheckSpec{}, false
	}

	var fix *FixSpec
	octal := expected
	if len(octal) == 4 {
		octal = octal[1:] // strip leading zero for chmod
	}
	fix = &FixSpec{
		Argv: [][]string{
			{"chmod", octal, target},
		},
	}
	return CheckSpec{
		RuleID:    ruleID,
		CheckType: CheckFileMode,
		Target:    target,
		Expected:  expected,
		Fix:       fix,
	}, true
}

func tryFileContains(ruleID, checkText, fixText string) (CheckSpec, bool) {
	// Use file-contains for well-known config files with specific grep patterns.
	// Skip SSH/PAM (handled by dedicated classifiers above).
	m := reFileContains.FindStringSubmatch(checkText)
	if m == nil {
		return CheckSpec{}, false
	}
	needle := m[1]
	target := m[2]

	// Avoid capturing binary-like or too-short needles
	if len(needle) < 2 || strings.HasPrefix(needle, "-") {
		return CheckSpec{}, false
	}
	// Avoid re-capturing SSH config (already handled)
	if strings.HasSuffix(target, "sshd_config") {
		return CheckSpec{}, false
	}
	// Avoid re-capturing PAM
	if strings.Contains(target, "/pam.d/") {
		return CheckSpec{}, false
	}
	return CheckSpec{
		RuleID:    ruleID,
		CheckType: CheckFileContains,
		Target:    target,
		Expected:  needle,
	}, true
}

// ── Inference helpers ─────────────────────────────────────────────────────────

// canonicalSSHParam normalises capitalisation from check-text variations.
func canonicalSSHParam(s string) string {
	// DISA check text uses lowercase grep; SSH param names are CamelCase.
	table := map[string]string{
		"permitrootlogin":            "PermitRootLogin",
		"permitemptypasswords":       "PermitEmptyPasswords",
		"permituserenvironment":      "PermitUserEnvironment",
		"x11forwarding":              "X11Forwarding",
		"usepam":                     "UsePAM",
		"protocol":                   "Protocol",
		"banner":                     "Banner",
		"clientaliveinterval":        "ClientAliveInterval",
		"clientalivecountmax":        "ClientAliveCountMax",
		"logingracetime":             "LoginGraceTime",
		"maxauthtries":               "MaxAuthTries",
		"maxsessions":                "MaxSessions",
		"hostbasedauthentication":    "HostbasedAuthentication",
		"ignoreuserknownhosts":       "IgnoreUserKnownHosts",
		"kerberosauthentication":      "KerberosAuthentication",
		"gssapiauthentication":        "GSSAPIAuthentication",
		"strictmodes":                "StrictModes",
		"compression":                "Compression",
		"macs":                       "MACs",
		"ciphers":                    "Ciphers",
		"kexalgorithms":              "KexAlgorithms",
		"printlastlog":               "PrintLastLog",
		"rekeylimit":                 "RekeyLimit",
		"logintimeout":               "LoginGraceTime",
		"allowtcpforwarding":         "AllowTcpForwarding",
		"permittty":                  "PermitTTY",
		"printmotd":                  "PrintMotd",
		"subsystem":                  "Subsystem",
		"acceptenv":                  "AcceptEnv",
		"syslogfacility":             "SyslogFacility",
		"loglevel":                   "LogLevel",
		"addressfamily":              "AddressFamily",
		"challengeresponseauthentication": "ChallengeResponseAuthentication",
		"passwordauthentication":     "PasswordAuthentication",
		"pubkeyauthentication":       "PubkeyAuthentication",
	}
	if v, ok := table[strings.ToLower(s)]; ok {
		return v
	}
	// PascalCase pass-through if we don't know it
	return s
}

// inferSSHExpected extracts the required value for an SSH parameter from the
// check text context.  E.g. "PermitRootLogin no" → "no".
func inferSSHExpected(param, checkText string) string {
	// Look for "param value" or "param = value" in context
	re := regexp.MustCompile(
		`(?i)\b` + regexp.QuoteMeta(strings.ToLower(param)) + `\s*(?:=\s*)?(\S+)`)
	if m := re.FindStringSubmatch(strings.ToLower(checkText)); m != nil {
		v := m[1]
		// Strip quotes
		v = strings.Trim(v, `"'`)
		// Reject if it looks like a shell test operator or sentence punctuation
		if v == "is" || v == "must" || v == "should" || v == "not" || v == "be" ||
			v == "the" || v == "set" || v == "to" || v == "configured" {
			return ""
		}
		return v
	}
	// Fallback table for high-frequency params
	table := map[string]string{
		"PermitRootLogin":         "no",
		"PermitEmptyPasswords":    "no",
		"X11Forwarding":           "no",
		"IgnoreUserKnownHosts":    "yes",
		"HostbasedAuthentication": "no",
		"KerberosAuthentication":  "no",
		"GSSAPIAuthentication":    "no",
		"StrictModes":             "yes",
		"Compression":             "no",
		"PermitUserEnvironment":   "no",
		"PrintLastLog":            "yes",
		"UsePAM":                  "yes",
		"AllowTcpForwarding":      "no",
		"PasswordAuthentication":  "no",
		"PubkeyAuthentication":    "yes",
		"LoginGraceTime":          "30",
		"MaxAuthTries":            "4",
		"MaxSessions":             "10",
		"ClientAliveInterval":     "600",
		"ClientAliveCountMax":     "0",
		"Protocol":                "2",
		"LogLevel":                "VERBOSE",
		"SyslogFacility":          "AUTH",
		"Banner":                  "/etc/issue",
		"AddressFamily":           "inet",
		"ChallengeResponseAuthentication": "no",
	}
	if v, ok := table[param]; ok {
		return v
	}
	return ""
}

// inferSysctlExpected infers the required value for a sysctl key.
func inferSysctlExpected(key, checkText string) string {
	// Context: most network hardening params expect 0 or 1
	zeros := []string{
		"send_redirects", "accept_redirects", "secure_redirects",
		"accept_source_route", "accept_ra", "ip_forward",
	}
	ones := []string{
		"log_martians", "rp_filter", "tcp_syncookies",
		"icmp_echo_ignore_broadcasts", "icmp_ignore_bogus_error_responses",
		"dmesg_restrict", "kptr_restrict",
	}
	for _, z := range zeros {
		if strings.Contains(key, z) {
			return "0"
		}
	}
	for _, o := range ones {
		if strings.Contains(key, o) {
			return "1"
		}
	}
	// kernel.randomize_va_space
	if strings.Contains(key, "randomize_va_space") {
		return "2"
	}
	// Try to extract from check text: "= 0" or "= 1" near the key
	re := regexp.MustCompile(`(?i)` + regexp.QuoteMeta(key) + `\s*=\s*(\d+)`)
	if m := re.FindStringSubmatch(checkText); m != nil {
		return m[1]
	}
	return ""
}

func inferServiceFix(svc, fixText, action string) *FixSpec {
	// Prefer explicit systemctl command in fixText
	if m := reFixSystemctl.FindStringSubmatch(fixText); m != nil {
		args := strings.Fields("systemctl " + m[1] + " " + m[2])
		return &FixSpec{Argv: [][]string{args}}
	}
	// Generate reasonable default
	parts := append([]string{"systemctl"}, strings.Fields(action)...)
	parts = append(parts, svc)
	return &FixSpec{Argv: [][]string{parts}}
}

func inferAuditTarget(checkText, ruleID string) string {
	// Heuristic: extract the first file path or syscall name from checkText.
	reFile := regexp.MustCompile(`-w\s+([\w/.-]+)`)
	if m := reFile.FindStringSubmatch(checkText); m != nil {
		return m[1]
	}
	reSyscall := regexp.MustCompile(`-S\s+(\w+)`)
	if m := reSyscall.FindStringSubmatch(checkText); m != nil {
		return m[1]
	}
	return ""
}

func inferAuditFix(target, fixText string) string {
	// Prefer an -a or -w rule from fixText
	re := regexp.MustCompile(`(?m)^(-[aw]\s+\S+.*)$`)
	if m := re.FindStringSubmatch(fixText); m != nil {
		return strings.TrimSpace(m[1])
	}
	return ""
}

func inferMountOption(mountPoint, checkText string) string {
	options := []string{"nodev", "nosuid", "noexec", "ro"}
	lower := strings.ToLower(checkText)
	for _, o := range options {
		if strings.Contains(lower, o) {
			return o
		}
	}
	return ""
}

func inferExpectedMode(target, checkText, fixText string) string {
	// Look for chmod NNNN or mode NNNN in fixText first
	reFix := regexp.MustCompile(`(?i)chmod\s+0?(\d{3,4})\s+` + regexp.QuoteMeta(target))
	if m := reFix.FindStringSubmatch(fixText); m != nil {
		return padMode(m[1])
	}
	// Fallback: well-known paths
	modeTable := map[string]string{
		"/etc/passwd":           "0644",
		"/etc/shadow":           "0000",
		"/etc/group":            "0644",
		"/etc/gshadow":          "0000",
		"/etc/ssh/sshd_config":  "0600",
		"/etc/crontab":          "0600",
		"/etc/cron.d":           "0700",
		"/etc/cron.hourly":      "0700",
		"/etc/cron.daily":       "0700",
		"/etc/cron.weekly":      "0700",
		"/etc/cron.monthly":     "0700",
		"/boot/grub2/grub.cfg":  "0600",
	}
	if v, ok := modeTable[target]; ok {
		return v
	}
	// Extract from check text: "N N N permissions" or "(N N N)"
	re := regexp.MustCompile(`\b0(\d{3})\b`)
	if m := re.FindStringSubmatch(checkText); m != nil {
		return "0" + m[1]
	}
	return ""
}

func padMode(s string) string {
	if len(s) == 3 {
		return "0" + s
	}
	return s
}

// ── Go source emitter ─────────────────────────────────────────────────────────

type checkTableTemplateData struct {
	Package    string
	VarName    string
	STIGFamily string
	RuleCount  int
	Generated  string
	Specs      []CheckSpec
}

var checkTableTpl = template.Must(template.New("checkTable").Funcs(template.FuncMap{
	"goStr": func(s string) string {
		s = strings.ReplaceAll(s, `\`, `\\`)
		s = strings.ReplaceAll(s, `"`, `\"`)
		return `"` + s + `"`
	},
	"goArgv": func(argv [][]string) string {
		if len(argv) == 0 {
			return "nil"
		}
		var parts []string
		for _, args := range argv {
			var innerParts []string
			for _, a := range args {
				a = strings.ReplaceAll(a, `\`, `\\`)
				a = strings.ReplaceAll(a, `"`, `\"`)
				innerParts = append(innerParts, `"`+a+`"`)
			}
			parts = append(parts, "{"+strings.Join(innerParts, ", ")+"}")
		}
		return "[][]string{" + strings.Join(parts, ", ") + "}"
	},
}).Parse(`// Code generated by stig-updater --gen-go on {{ .Generated }}.
// Source: DISA {{ .STIGFamily }} XCCDF benchmark — {{ .RuleCount }} rules.
// DO NOT EDIT MANUALLY. Re-generate with:
//   go run ./cmd/stig-updater --mode online --filter {{ .STIGFamily }} --gen-go
package {{ .Package }}

// {{ .VarName }} contains all CheckSpec rows derived from the DISA {{ .STIGFamily }}
// XCCDF benchmark.  Each row's metadata (Title, Severity, CCI refs) is resolved
// at runtime from the embedded STIG_CCI_Map.csv — it is not duplicated here.
var {{ .VarName }} = []CheckSpec{
{{- range .Specs }}
	{
		RuleID:    {{ goStr .RuleID }},
		CheckType: {{ printf "%q" .CheckType }},
		Target:    {{ goStr .Target }},
		Expected:  {{ goStr .Expected }},
{{- if .Fix }}
		Fix: &FixSpec{
			Argv:   {{ goArgv .Fix.Argv }},
			Reboot: {{ .Fix.Reboot }},
		},
{{- else }}
		Fix: nil,
{{- end }}
	},
{{- end }}
}
`))
