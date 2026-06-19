package nist80171

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

// NIST SP 800-171 Rev 2 — Access Control (AC) Family, 22 controls: 3.1.1 – 3.1.22

// ValidateACFamily runs all 22 Access Control requirement checks.
func (v *Validator) ValidateACFamily() []ControlResult {
	results := []ControlResult{
		v.CheckAC_3_1_1(),
		v.CheckAC_3_1_2(),
		v.CheckAC_3_1_3(),
		v.CheckAC_3_1_4(),
		v.CheckAC_3_1_5(),
		v.CheckAC_3_1_6(),
		v.CheckAC_3_1_7(),
		v.CheckAC_3_1_8(),
		v.CheckAC_3_1_9(),
		v.CheckAC_3_1_10(),
		v.CheckAC_3_1_11(),
		v.CheckAC_3_1_12(),
		v.CheckAC_3_1_13(),
		v.CheckAC_3_1_14(),
		v.CheckAC_3_1_15(),
		v.CheckAC_3_1_16(),
		v.CheckAC_3_1_17(),
		v.CheckAC_3_1_18(),
		v.CheckAC_3_1_19(),
		v.CheckAC_3_1_20(),
		v.CheckAC_3_1_21(),
		v.CheckAC_3_1_22(),
	}
	v.Results = append(v.Results, results...)
	return results
}

// 3.1.1 — Limit system access to authorized users, processes, and devices.
// Checks /etc/passwd for extra UID-0 accounts and service accounts with interactive shells.
func (v *Validator) CheckAC_3_1_1() ControlResult {
	r := acBase("3.1.1", "Authorized User Access",
		"Limit system access to authorized users, processes acting on behalf of authorized users, and devices (including other systems).")

	data, err := os.ReadFile("/etc/passwd")
	if err != nil {
		return manualReview(r, "Cannot read /etc/passwd — manual user inventory review required.")
	}

	interactiveShells := map[string]bool{
		"/bin/bash": true, "/bin/sh": true, "/bin/zsh": true, "/bin/fish": true,
		"/usr/bin/bash": true, "/usr/bin/zsh": true, "/usr/bin/fish": true,
	}
	// System/service accounts that must NOT have interactive login shells.
	serviceAccounts := map[string]bool{
		"daemon": true, "bin": true, "sys": true, "sync": true, "games": true,
		"man": true, "lp": true, "mail": true, "news": true, "uucp": true,
		"proxy": true, "www-data": true, "backup": true, "list": true,
		"irc": true, "gnats": true, "nobody": true, "systemd-network": true,
		"systemd-resolve": true, "messagebus": true, "syslog": true, "avahi": true,
		"postfix": true, "sshd": true, "ntp": true, "mysql": true,
		"postgres": true, "redis": true, "nginx": true, "apache": true, "httpd": true,
	}

	var issues []string
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.Split(line, ":")
		if len(parts) < 7 {
			continue
		}
		user, uid, shell := parts[0], parts[2], parts[6]
		if uid == "0" && user != "root" {
			issues = append(issues, "extra UID-0: "+user)
		}
		if serviceAccounts[user] && interactiveShells[shell] {
			issues = append(issues, fmt.Sprintf("service account %q has login shell %s", user, shell))
		}
	}
	if len(issues) == 0 {
		return pass(r, "No extra UID-0 accounts; service accounts lack interactive login shells.")
	}
	r.Status = "FAIL"
	r.Finding = "Unauthorized access vectors detected: " + strings.Join(issues, "; ")
	r.Remediation = "Remove shell: usermod -s /sbin/nologin <svc>; remove extra UID-0: userdel -f <user>"
	return r
}

// 3.1.2 — Limit system access to the types of transactions and functions authorized users may execute.
// Scans /etc/sudoers and /etc/sudoers.d/* for unbounded ALL=(ALL) ALL grants to individual accounts.
func (v *Validator) CheckAC_3_1_2() ControlResult {
	r := acBase("3.1.2", "Transaction and Function Limits",
		"Limit system access to the types of transactions and functions that authorized users are permitted to execute.")

	var flagged []string
	checkFile := func(path string) {
		data, err := os.ReadFile(path)
		if err != nil {
			return
		}
		for i, line := range strings.Split(string(data), "\n") {
			t := strings.TrimSpace(line)
			if t == "" || strings.HasPrefix(t, "#") || strings.HasPrefix(t, "Defaults") {
				continue
			}
			// Non-group principals (%group is fine) with blanket unrestricted sudo.
			if !strings.HasPrefix(t, "%") &&
				(strings.Contains(t, "ALL=(ALL) ALL") || strings.Contains(t, "ALL=(ALL:ALL) ALL")) {
				flagged = append(flagged, fmt.Sprintf("%s:%d", path, i+1))
			}
		}
	}
	checkFile("/etc/sudoers")
	if entries, err := os.ReadDir("/etc/sudoers.d"); err == nil {
		for _, e := range entries {
			if !e.IsDir() {
				checkFile("/etc/sudoers.d/" + e.Name())
			}
		}
	}
	if len(flagged) == 0 {
		return pass(r, "No unbounded ALL=(ALL) ALL sudoers grants for individual accounts detected.")
	}
	r.Status = "FAIL"
	r.Finding = "Individual accounts with unrestricted sudo at: " + strings.Join(flagged, ", ")
	r.Remediation = "Replace blanket ALL with specific CMND_ALIAS entries in sudoers: visudo"
	return r
}

// 3.1.3 — Control the flow of CUI in accordance with approved authorizations.
// Validates SELinux enforcing mode or AppArmor enforce profiles for mandatory access control.
func (v *Validator) CheckAC_3_1_3() ControlResult {
	r := acBase("3.1.3", "CUI Flow Control",
		"Control the flow of CUI in accordance with approved authorizations.")

	enforceBytes, err := os.ReadFile("/sys/fs/selinux/enforce")
	if err == nil {
		if strings.TrimSpace(string(enforceBytes)) == "1" {
			return pass(r, "SELinux enforcing mode active — mandatory CUI flow control enforced.")
		}
		r.Status = "FAIL"
		r.Finding = "SELinux is permissive or disabled — mandatory flow control not enforced."
		r.Remediation = "setenforce 1; set SELINUX=enforcing in /etc/selinux/config"
		return r
	}
	// AppArmor fallback (Debian/Ubuntu)
	out, err := exec.Command("aa-status", "--json").Output()
	if err == nil && strings.Contains(string(out), `"enforce"`) {
		return pass(r, "AppArmor enforce profiles active — mandatory access control enforced.")
	}
	return manualReview(r, "Neither SELinux nor AppArmor enforcing mode detected — CUI flow control requires manual review. Install selinux-policy-targeted and setenforce 1.")
}

// 3.1.4 — Separate the duties of individuals to reduce the risk of malevolent activity.
func (v *Validator) CheckAC_3_1_4() ControlResult {
	return v.requiresManualReview("3.1.4", FamilyAC,
		"Separate the duties of individuals to reduce the risk of malevolent activity without collusion.",
		"C3PAO evidence: SoD policy matrix showing role separation; RBAC configuration showing no single user holds conflicting roles (e.g., developer AND approver).")
}

// 3.1.5 — Employ the principle of least privilege.
// Enumerates SUID binaries and flags any outside the known-safe baseline set.
func (v *Validator) CheckAC_3_1_5() ControlResult {
	r := acBase("3.1.5", "Least Privilege",
		"Employ the principle of least privilege, including for specific security functions and privileged accounts.")

	knownSafe := map[string]bool{
		"/usr/bin/passwd": true, "/usr/bin/sudo": true, "/usr/bin/su": true,
		"/usr/bin/newgrp": true, "/usr/bin/chage": true, "/usr/bin/gpasswd": true,
		"/usr/bin/mount": true, "/usr/bin/umount": true, "/usr/bin/pkexec": true,
		"/usr/bin/ping": true, "/bin/ping": true, "/usr/bin/crontab": true,
		"/usr/bin/at": true, "/usr/bin/write": true, "/usr/bin/wall": true,
		"/usr/sbin/pam_timestamp_check": true, "/usr/sbin/unix_chkpwd": true,
		"/usr/lib/openssh/ssh-keysign": true,
		"/usr/libexec/openssh/ssh-keysign": true,
		"/usr/bin/ssh-agent": true, "/usr/bin/screen": true,
	}
	out, err := exec.Command("find", "/usr", "/bin", "/sbin", "-perm", "/4000", "-type", "f").Output()
	if err != nil {
		return manualReview(r, "Cannot enumerate SUID binaries (find failed) — manual least-privilege review required.")
	}
	var unexpected []string
	for _, path := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if path != "" && !knownSafe[path] {
			unexpected = append(unexpected, path)
		}
	}
	if len(unexpected) == 0 {
		return pass(r, "All discovered SUID binaries are within the known-safe allowlist.")
	}
	r.Status = "FAIL"
	r.Finding = "Unexpected SUID binaries (not in allowlist): " + strings.Join(unexpected, ", ")
	r.Remediation = "Remove SUID bit where not required: chmod u-s <path>"
	return r
}

// 3.1.6 — Use non-privileged accounts when accessing non-security functions.
func (v *Validator) CheckAC_3_1_6() ControlResult {
	return v.requiresManualReview("3.1.6", FamilyAC,
		"Use non-privileged accounts or roles when accessing non-security functions.",
		"C3PAO evidence: privileged-account usage policy; PAM/sudo configuration demonstrating admins have separate standard and privileged accounts; session recording logs for root sessions.")
}

// 3.1.7 — Prevent non-privileged users from executing privileged functions and audit those executions.
// Checks SELinux enforcing + auditd active + audit rules for privileged command execution.
func (v *Validator) CheckAC_3_1_7() ControlResult {
	r := acBase("3.1.7", "Privileged Function Audit",
		"Prevent non-privileged users from executing privileged functions and capture the execution of such functions in audit logs.")

	var failures []string
	if !isServiceActive("auditd") {
		failures = append(failures, "auditd not running — privileged executions not audited")
	}

	// Look for exec/sudo audit rules in known locations.
	var auditContent string
	for _, path := range []string{"/etc/audit/rules.d/audit.rules", "/etc/audit/audit.rules"} {
		if data, err := os.ReadFile(path); err == nil {
			auditContent = string(data)
			break
		}
	}
	// Check for elevated-command tracking rules.
	if auditContent == "" || (!strings.Contains(auditContent, "/usr/bin/sudo") &&
		!strings.Contains(auditContent, "execve") && !strings.Contains(auditContent, "privileged")) {
		failures = append(failures, "no audit rules for privileged command execution (sudo/execve)")
	}

	enforceBytes, _ := os.ReadFile("/sys/fs/selinux/enforce")
	if strings.TrimSpace(string(enforceBytes)) != "1" {
		failures = append(failures, "SELinux not enforcing — privilege-separation boundary weakened")
	}

	if len(failures) == 0 {
		return pass(r, "auditd active with privileged-execution rules; SELinux enforcing.")
	}
	r.Status = "FAIL"
	r.Finding = strings.Join(failures, "; ")
	r.Remediation = "Enable auditd; add audit rules: -a always,exit -F arch=b64 -S execve -F path=/usr/bin/sudo -k priv_cmd"
	return r
}

// 3.1.8 — Limit unsuccessful logon attempts.
// Reads /etc/security/faillock.conf for deny ≤ 5 and unlock_time ≥ 900.
func (v *Validator) CheckAC_3_1_8() ControlResult {
	r := acBase("3.1.8", "Logon Attempt Limits",
		"Limit unsuccessful logon attempts.")

	data, err := os.ReadFile("/etc/security/faillock.conf")
	if err != nil {
		// Fall back: check PAM stack for pam_faillock presence.
		pamData, pamErr := os.ReadFile("/etc/pam.d/system-auth")
		if pamErr == nil && (strings.Contains(string(pamData), "pam_faillock") ||
			strings.Contains(string(pamData), "pam_tally2")) {
			return pass(r, "PAM faillock/tally2 module present in /etc/pam.d/system-auth.")
		}
		r.Status = "FAIL"
		r.Finding = "/etc/security/faillock.conf not found and pam_faillock not detected in PAM stack."
		r.Remediation = "authselect select sssd with-faillock; configure /etc/security/faillock.conf: deny=5 unlock_time=900"
		return r
	}

	deny, unlockTime := 0, 0
	for _, line := range strings.Split(string(data), "\n") {
		t := strings.TrimSpace(line)
		if strings.HasPrefix(t, "#") {
			continue
		}
		if strings.HasPrefix(t, "deny") && strings.Contains(t, "=") {
			deny = atoiSafe(parseKeyValue(t))
		}
		if strings.HasPrefix(t, "unlock_time") && strings.Contains(t, "=") {
			unlockTime = atoiSafe(parseKeyValue(t))
		}
	}

	var issues []string
	if deny == 0 || deny > 5 {
		issues = append(issues, fmt.Sprintf("deny=%d (must be 1–5)", deny))
	}
	if unlockTime > 0 && unlockTime < 900 {
		issues = append(issues, fmt.Sprintf("unlock_time=%d (must be ≥ 900 seconds)", unlockTime))
	}
	if len(issues) == 0 {
		return pass(r, fmt.Sprintf("faillock.conf: deny=%d, unlock_time=%d — compliant.", deny, unlockTime))
	}
	r.Status = "FAIL"
	r.Finding = "faillock.conf non-compliant: " + strings.Join(issues, "; ")
	r.Remediation = "Edit /etc/security/faillock.conf: set deny = 5 and unlock_time = 900"
	return r
}

// 3.1.9 — Provide privacy and security notices consistent with CUI rules.
// Verifies /etc/issue and /etc/issue.net contain required banner keywords.
func (v *Validator) CheckAC_3_1_9() ControlResult {
	r := acBase("3.1.9", "Privacy and Security Notices",
		"Provide privacy and security notices consistent with CUI rules.")

	requiredKeywords := []string{"authorized", "monitored", "consent"}
	checkBanner := func(path string) []string {
		data, err := os.ReadFile(path)
		if err != nil {
			return []string{"file not found"}
		}
		lowered := strings.ToLower(string(data))
		var missing []string
		for _, kw := range requiredKeywords {
			if !strings.Contains(lowered, kw) {
				missing = append(missing, kw)
			}
		}
		return missing
	}

	m1 := checkBanner("/etc/issue")
	m2 := checkBanner("/etc/issue.net")
	if len(m1) == 0 && len(m2) == 0 {
		return pass(r, "Login banners present on /etc/issue and /etc/issue.net with required keywords.")
	}
	r.Status = "FAIL"
	r.Finding = fmt.Sprintf("/etc/issue missing [%s]; /etc/issue.net missing [%s]",
		strings.Join(m1, ","), strings.Join(m2, ","))
	r.Remediation = "Add DoD consent banner containing: authorized, monitored, consent, criminal, civil penalties."
	return r
}

// 3.1.10 — Use session lock after a period of inactivity.
// Checks TMOUT (≤ 900 seconds) set as readonly in /etc/profile.d/*.sh.
func (v *Validator) CheckAC_3_1_10() ControlResult {
	r := acBase("3.1.10", "Session Lock",
		"Use session lock with pattern-hiding displays after a period of inactivity.")

	entries, err := os.ReadDir("/etc/profile.d")
	if err != nil {
		return manualReview(r, "Cannot read /etc/profile.d — manual TMOUT configuration review required.")
	}
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".sh") {
			continue
		}
		data, readErr := os.ReadFile("/etc/profile.d/" + e.Name())
		if readErr != nil {
			continue
		}
		for _, line := range strings.Split(string(data), "\n") {
			t := strings.TrimSpace(line)
			for _, prefix := range []string{"TMOUT=", "export TMOUT=", "readonly TMOUT="} {
				if strings.HasPrefix(t, prefix) {
					val := atoiSafe(strings.TrimPrefix(t, prefix))
					if val > 0 && val <= 900 {
						return pass(r, fmt.Sprintf("TMOUT=%d set in /etc/profile.d/%s.", val, e.Name()))
					}
					if val > 900 {
						r.Status = "FAIL"
						r.Finding = fmt.Sprintf("TMOUT=%d exceeds 900-second STIG maximum in /etc/profile.d/%s.", val, e.Name())
						r.Remediation = "Set readonly TMOUT=900 && export TMOUT in /etc/profile.d/tmout.sh"
						return r
					}
				}
			}
		}
	}
	r.Status = "FAIL"
	r.Finding = "TMOUT not configured in /etc/profile.d — sessions may be indefinitely active."
	r.Remediation = "Create /etc/profile.d/tmout.sh with: readonly TMOUT=900 && export TMOUT"
	return r
}

// 3.1.11 — Terminate sessions after a defined inactivity condition.
// Checks SSH ClientAliveInterval (≤ 600) and ClientAliveCountMax (≤ 3).
func (v *Validator) CheckAC_3_1_11() ControlResult {
	r := acBase("3.1.11", "Session Termination",
		"Terminate (automatically) a user session after a defined condition.")

	interval := sshConfigValue("ClientAliveInterval")
	countMax := sshConfigValue("ClientAliveCountMax")
	intervalN := atoiSafe(interval)
	countMaxN := atoiSafe(countMax)

	var issues []string
	if interval == "" {
		issues = append(issues, "ClientAliveInterval not set")
	} else if intervalN > 600 {
		issues = append(issues, fmt.Sprintf("ClientAliveInterval=%d exceeds 600s limit", intervalN))
	}
	if countMax == "" {
		issues = append(issues, "ClientAliveCountMax not set")
	} else if countMaxN > 3 {
		issues = append(issues, fmt.Sprintf("ClientAliveCountMax=%d exceeds 3", countMaxN))
	}
	if len(issues) == 0 {
		return pass(r, fmt.Sprintf("SSH session timeout: ClientAliveInterval=%s, ClientAliveCountMax=%s.", interval, countMax))
	}
	r.Status = "FAIL"
	r.Finding = strings.Join(issues, "; ")
	r.Remediation = "Set in /etc/ssh/sshd_config: ClientAliveInterval 600 and ClientAliveCountMax 0; systemctl restart sshd"
	return r
}

// 3.1.12 — Monitor and control remote access sessions.
// Verifies auditd is active and audit rules track session/login events.
func (v *Validator) CheckAC_3_1_12() ControlResult {
	r := acBase("3.1.12", "Remote Access Session Monitoring",
		"Monitor and control remote access sessions.")

	var failures []string
	if !isServiceActive("auditd") {
		failures = append(failures, "auditd not active — remote sessions not audited")
	}

	var auditContent string
	for _, path := range []string{"/etc/audit/rules.d/audit.rules", "/etc/audit/audit.rules"} {
		if data, err := os.ReadFile(path); err == nil {
			auditContent = string(data)
			break
		}
	}
	hasSessionRules := auditContent != "" &&
		(strings.Contains(auditContent, "/var/log/lastlog") ||
			strings.Contains(auditContent, "/var/run/utmp") ||
			strings.Contains(auditContent, "/var/log/btmp"))
	if !hasSessionRules {
		failures = append(failures, "no audit rules for session tracking (lastlog/utmp/btmp)")
	}

	if len(failures) == 0 {
		return pass(r, "auditd active with remote session tracking rules (lastlog/utmp/btmp).")
	}
	r.Status = "FAIL"
	r.Finding = strings.Join(failures, "; ")
	r.Remediation = "Add to audit rules: -w /var/log/lastlog -p wa -k logins; -w /var/run/utmp -p wa -k session"
	return r
}

// 3.1.13 — Employ cryptographic mechanisms to protect remote access session confidentiality.
// Checks sshd_config Ciphers directive for weak algorithms (CBC, arcfour, 3DES, RC4, blowfish).
func (v *Validator) CheckAC_3_1_13() ControlResult {
	r := acBase("3.1.13", "Remote Session Cryptographic Protection",
		"Employ cryptographic mechanisms to protect the confidentiality of remote access sessions.")

	ciphers := sshConfigValue("Ciphers")
	if ciphers == "" {
		return pass(r, "SSH Ciphers not explicitly set; modern OpenSSH defaults exclude weak algorithms.")
	}
	weakPatterns := []string{"cbc", "arcfour", "3des", "rc4", "blowfish", "cast128"}
	var weak []string
	lowered := strings.ToLower(ciphers)
	for _, pat := range weakPatterns {
		if strings.Contains(lowered, pat) {
			weak = append(weak, pat)
		}
	}
	if len(weak) == 0 {
		return pass(r, "SSH Ciphers restricted to strong algorithms: "+ciphers)
	}
	r.Status = "FAIL"
	r.Finding = "Weak SSH cipher(s) enabled: " + strings.Join(weak, ", ")
	r.Remediation = "Set in sshd_config: Ciphers aes256-gcm@openssh.com,aes128-gcm@openssh.com,chacha20-poly1305@openssh.com"
	return r
}

// 3.1.14 — Route remote access via managed network access control points.
// Checks sshd_config for AllowUsers/AllowGroups and PermitRootLogin.
func (v *Validator) CheckAC_3_1_14() ControlResult {
	r := acBase("3.1.14", "Remote Access Routing",
		"Route remote access via managed network access control points.")

	var issues []string
	permitRoot := sshConfigValue("PermitRootLogin")
	if permitRoot == "" ||
		(strings.ToLower(permitRoot) != "no" && strings.ToLower(permitRoot) != "prohibit-password") {
		issues = append(issues, fmt.Sprintf("PermitRootLogin=%q (must be no or prohibit-password)", permitRoot))
	}
	allowUsers := sshConfigValue("AllowUsers")
	allowGroups := sshConfigValue("AllowGroups")
	if allowUsers == "" && allowGroups == "" {
		issues = append(issues, "neither AllowUsers nor AllowGroups set — any valid account can SSH")
	}
	if len(issues) == 0 {
		return pass(r, fmt.Sprintf("SSH access controlled: PermitRootLogin=%s; AllowUsers/Groups configured.", permitRoot))
	}
	r.Status = "FAIL"
	r.Finding = strings.Join(issues, "; ")
	r.Remediation = "Set in /etc/ssh/sshd_config: PermitRootLogin no and AllowGroups <approved-group>"
	return r
}

// 3.1.15 — Authorize wireless access prior to allowing connections.
// Detects wireless interfaces and verifies WPA-Enterprise (802.1X) authentication.
func (v *Validator) CheckAC_3_1_15() ControlResult {
	r := acBase("3.1.15", "Wireless Access Authorization",
		"Authorize wireless access prior to allowing such connections.")

	entries, err := os.ReadDir("/sys/class/net")
	if err != nil {
		return manualReview(r, "Cannot enumerate /sys/class/net — manual wireless interface review required.")
	}
	var wirelessIfaces []string
	for _, e := range entries {
		wPath := "/sys/class/net/" + e.Name() + "/wireless"
		pPath := "/sys/class/net/" + e.Name() + "/phy80211"
		if _, err := os.Stat(wPath); err == nil {
			wirelessIfaces = append(wirelessIfaces, e.Name())
		} else if _, err := os.Stat(pPath); err == nil {
			wirelessIfaces = append(wirelessIfaces, e.Name())
		}
	}
	if len(wirelessIfaces) == 0 {
		return pass(r, "No wireless interfaces detected — 3.1.15 not applicable.")
	}

	// Wireless present: require WPA-EAP (Enterprise) configuration.
	wpaConf, err := os.ReadFile("/etc/wpa_supplicant/wpa_supplicant.conf")
	if err == nil && (strings.Contains(string(wpaConf), "WPA-EAP") ||
		strings.Contains(string(wpaConf), "key_mgmt=WPA-EAP")) {
		return pass(r, fmt.Sprintf("Wireless %v: WPA-EAP (Enterprise/802.1X) configured.", wirelessIfaces))
	}
	r.Status = "FAIL"
	r.Finding = fmt.Sprintf("Wireless interfaces %v present but WPA-EAP not configured.", wirelessIfaces)
	r.Remediation = "Configure key_mgmt=WPA-EAP in /etc/wpa_supplicant/wpa_supplicant.conf or disable wireless NIC."
	return r
}

// 3.1.16 — Protect wireless access using authentication and encryption.
func (v *Validator) CheckAC_3_1_16() ControlResult {
	return v.requiresManualReview("3.1.16", FamilyAC,
		"Protect wireless access using authentication and encryption.",
		"C3PAO evidence: wireless policy mandating WPA3-Enterprise (802.1X); RADIUS/EAP server configuration; network topology diagram showing wireless isolation from CUI systems.")
}

// 3.1.17 — Control connection of mobile devices.
// Verifies a host-based firewall is active to enforce network access policy.
func (v *Validator) CheckAC_3_1_17() ControlResult {
	r := acBase("3.1.17", "Mobile Device Network Control",
		"Control connection of mobile devices.")

	if isServiceActive("firewalld") || isServiceActive("iptables") || isServiceActive("nftables") {
		return pass(r, "Host-based firewall active (firewalld/iptables/nftables) — network access policy enforced.")
	}
	r.Status = "FAIL"
	r.Finding = "No host-based firewall active — network connections including mobile devices are unfiltered."
	r.Remediation = "Enable firewalld: systemctl enable --now firewalld"
	return r
}

// 3.1.18 — Encrypt CUI on mobile devices and mobile computing platforms.
func (v *Validator) CheckAC_3_1_18() ControlResult {
	return v.requiresManualReview("3.1.18", FamilyAC,
		"Encrypt CUI on mobile devices and mobile computing platforms.",
		"C3PAO evidence: MDM enrollment record (e.g., JAMF/Intune) showing full-disk encryption enforced on all mobile devices accessing CUI; screenshot of encryption compliance dashboard.")
}

// 3.1.19 — Control the use of removable media on system components.
func (v *Validator) CheckAC_3_1_19() ControlResult {
	return v.requiresManualReview("3.1.19", FamilyAC,
		"Control the use of removable media on system components.",
		"C3PAO evidence: MDM or endpoint policy showing removable media encryption enforced; screenshot of DLP rule or mobile device compliance report.")
}

// 3.1.20 — Verify and control/limit connections to external systems.
// Checks iptables/nftables OUTPUT chain for explicit outbound filtering rules.
func (v *Validator) CheckAC_3_1_20() ControlResult {
	r := acBase("3.1.20", "External System Connection Limits",
		"Verify and control/limit connections to external systems.")

	// Try iptables OUTPUT chain first.
	out, err := exec.Command("iptables", "-L", "OUTPUT", "-n", "--line-numbers").Output()
	if err == nil {
		lines := strings.Split(string(out), "\n")
		ruleCount := 0
		for _, line := range lines {
			if strings.Contains(line, "ACCEPT") || strings.Contains(line, "DROP") || strings.Contains(line, "REJECT") {
				ruleCount++
			}
		}
		if ruleCount > 1 {
			return pass(r, "iptables OUTPUT chain has explicit egress rules controlling external connections.")
		}
		return manualReview(r, "iptables OUTPUT is default-ACCEPT — document approved external connections in SSP or implement egress filtering.")
	}
	// nftables fallback.
	out2, err2 := exec.Command("nft", "list", "ruleset").Output()
	if err2 == nil && strings.Contains(string(out2), "output") {
		return pass(r, "nftables ruleset includes output chain — outbound connections managed.")
	}
	return manualReview(r, "Cannot query firewall egress rules — manual review of external system connection policy required.")
}

// 3.1.21 — Limit use of portable storage devices on external systems.
// Checks for USB storage kernel module blacklist or udev rules blocking removable storage.
func (v *Validator) CheckAC_3_1_21() ControlResult {
	r := acBase("3.1.21", "Portable Storage Restriction",
		"Limit the use of portable storage devices on external systems.")

	// Check modprobe.d for usb-storage blacklist or null-install.
	if entries, err := os.ReadDir("/etc/modprobe.d"); err == nil {
		for _, e := range entries {
			if e.IsDir() {
				continue
			}
			data, err := os.ReadFile("/etc/modprobe.d/" + e.Name())
			if err != nil {
				continue
			}
			content := string(data)
			if (strings.Contains(content, "usb-storage") || strings.Contains(content, "usb_storage")) &&
				(strings.Contains(content, "blacklist") ||
					strings.Contains(content, "/bin/false") ||
					strings.Contains(content, "/bin/true")) {
				return pass(r, "USB storage module blacklisted via /etc/modprobe.d/"+e.Name())
			}
		}
	}
	// Check udev rules for USB removable media blocking.
	for _, dir := range []string{"/etc/udev/rules.d", "/lib/udev/rules.d"} {
		udevEntries, err := os.ReadDir(dir)
		if err != nil {
			continue
		}
		for _, e := range udevEntries {
			if e.IsDir() {
				continue
			}
			data, err := os.ReadFile(dir + "/" + e.Name())
			if err != nil {
				continue
			}
			if strings.Contains(string(data), "usb") &&
				(strings.Contains(string(data), "ATTR{removable}") ||
					strings.Contains(string(data), "block") && strings.Contains(string(data), "REJECT")) {
				return pass(r, "udev rule for USB storage control found in "+dir+"/"+e.Name())
			}
		}
	}
	r.Status = "FAIL"
	r.Finding = "USB storage not restricted — no modprobe blacklist or blocking udev rule detected."
	r.Remediation = "Create /etc/modprobe.d/usb-storage.conf: install usb-storage /bin/false"
	return r
}

// 3.1.22 — Control CUI posted or processed on publicly accessible systems.
func (v *Validator) CheckAC_3_1_22() ControlResult {
	return v.requiresManualReview("3.1.22", FamilyAC,
		"Control CUI posted or processed on publicly accessible systems.",
		"C3PAO evidence: data classification policy prohibiting CUI on public systems; web application architecture diagram showing separation of public and CUI-processing tiers; DLP tool configuration screenshot.")
}

// ── Internal helpers (package-private) ───────────────────────────────────────

// acBase initializes a ControlResult for an AC-family control.
func acBase(id, title, description string) ControlResult {
	return ControlResult{
		ControlID:   id,
		Title:       title,
		Family:      FamilyAC,
		Description: description,
		CheckedAt:   time.Now(),
	}
}

// pass returns a PASS result.
func pass(r ControlResult, finding string) ControlResult {
	r.Status = "PASS"
	r.Finding = finding
	return r
}

// manualReview returns a MANUAL_REVIEW result without going through the method receiver.
func manualReview(r ControlResult, finding string) ControlResult {
	r.Status = "MANUAL_REVIEW"
	r.Finding = "MANUAL REVIEW REQUIRED — " + finding
	r.Remediation = finding
	return r
}

// requiresManualReview is the receiver method form used by families.go helpers.
func (v *Validator) requiresManualReview(id, family, description, evidenceRequired string) ControlResult {
	return ControlResult{
		ControlID:   id,
		Family:      family,
		Status:      "MANUAL_REVIEW",
		Description: description,
		Finding:     "MANUAL REVIEW REQUIRED — " + evidenceRequired,
		Remediation: evidenceRequired,
		CheckedAt:   time.Now(),
	}
}

// sshConfigValue reads a directive's value from /etc/ssh/sshd_config.
func sshConfigValue(directive string) string {
	data, err := os.ReadFile("/etc/ssh/sshd_config")
	if err != nil {
		return ""
	}
	lower := strings.ToLower(directive)
	scanner := bufio.NewScanner(strings.NewReader(string(data)))
	for scanner.Scan() {
		t := strings.TrimSpace(scanner.Text())
		if strings.HasPrefix(t, "#") {
			continue
		}
		parts := strings.Fields(t)
		if len(parts) >= 2 && strings.ToLower(parts[0]) == lower {
			return parts[1]
		}
	}
	return ""
}

// parseKeyValue extracts the value from "key = value" or "key=value".
func parseKeyValue(s string) string {
	if idx := strings.Index(s, "="); idx >= 0 {
		return strings.TrimSpace(s[idx+1:])
	}
	return ""
}

// atoiSafe converts a string to int, returning 0 on failure.
func atoiSafe(s string) int {
	n, _ := strconv.Atoi(strings.TrimSpace(s))
	return n
}
