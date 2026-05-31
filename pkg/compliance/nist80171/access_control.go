package nist80171

import (
	"os"
	"os/exec"
	"strings"
	"time"
)

// NIST 800-171 Access Control (AC) Family — 22 controls (3.1.1 – 3.1.22)
// Controls that can be verified by reading system state run real checks.
// Controls that require policy documents, training records, or manual
// attestation are marked MANUAL_REVIEW with clear reasoning.

// ValidateACFamily orchestrates all Access Control checks
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

// ── Real system-verifiable checks ────────────────────────────────────────────

// 3.1.1 Limit system access to authorized users, processes, or devices.
// Verifiable: check /etc/passwd for accounts with interactive shells.
func (v *Validator) CheckAC_3_1_1() ControlResult {
	r := ControlResult{
		ControlID:   "3.1.1",
		Title:       "Limit System Access to Authorized Users",
		Family:      FamilyAC,
		Description: "Limit system access to authorized users, processes acting on behalf of authorized users, or devices.",
		CheckedAt:   time.Now(),
	}
	data, err := os.ReadFile("/etc/passwd")
	if err != nil {
		r.Status = "MANUAL_REVIEW"
		r.Finding = "Cannot read /etc/passwd — manual account review required"
		return r
	}
	unexpected := []string{}
	for _, line := range strings.Split(string(data), "\n") {
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.Split(line, ":")
		if len(parts) < 7 {
			continue
		}
		shell, username := parts[6], parts[0]
		if username == "root" {
			continue
		}
		if shell != "/sbin/nologin" && shell != "/bin/false" && shell != "" {
			unexpected = append(unexpected, username+"(shell:"+shell+")")
		}
	}
	if len(unexpected) == 0 {
		r.Status = "PASS"
		r.Finding = "All non-root accounts use nologin or false shells; access restricted to authorized users."
	} else {
		r.Status = "FAIL"
		r.Finding = "Accounts with interactive shells: " + strings.Join(unexpected, ", ")
		r.Remediation = "Set shell to /sbin/nologin for non-interactive service accounts."
	}
	return r
}

// 3.1.2 Limit system access to the types of transactions authorized users may execute.
// Verifiable: check sudoers for unrestricted NOPASSWD ALL escalation.
func (v *Validator) CheckAC_3_1_2() ControlResult {
	r := ControlResult{
		ControlID:   "3.1.2",
		Title:       "Limit Authorized Transactions and Functions",
		Family:      FamilyAC,
		Description: "Limit system access to the types of transactions and functions that authorized users are permitted to execute.",
		CheckedAt:   time.Now(),
	}
	sudoersData, err := os.ReadFile("/etc/sudoers")
	if err != nil {
		r.Status = "MANUAL_REVIEW"
		r.Finding = "Cannot read /etc/sudoers — manual privilege review required"
		return r
	}
	dangerous := []string{}
	for _, line := range strings.Split(string(sudoersData), "\n") {
		t := strings.TrimSpace(line)
		if strings.HasPrefix(t, "#") || t == "" {
			continue
		}
		if strings.Contains(t, "NOPASSWD") && strings.Contains(t, "ALL") && !strings.Contains(t, "root") {
			dangerous = append(dangerous, t)
		}
	}
	if len(dangerous) == 0 {
		r.Status = "PASS"
		r.Finding = "No unrestricted NOPASSWD ALL entries found in sudoers."
	} else {
		r.Status = "FAIL"
		r.Finding = "Unrestricted sudo escalation: " + strings.Join(dangerous, " | ")
		r.Remediation = "Restrict sudoers entries to specific commands. Remove blanket NOPASSWD ALL."
	}
	return r
}

// 3.1.3 Control the flow of CUI in accordance with approved authorizations.
func (v *Validator) CheckAC_3_1_3() ControlResult {
	return v.requiresManualReview("3.1.3", FamilyAC,
		"Control the flow of CUI in accordance with approved authorizations.",
		"Requires DLP policy review, network segmentation documentation, or CUI labeling evidence.")
}

// 3.1.4 Separate duties of individuals.
func (v *Validator) CheckAC_3_1_4() ControlResult {
	return v.requiresManualReview("3.1.4", FamilyAC,
		"Separate the duties of individuals to reduce the risk of malevolent activity without collusion.",
		"Requires HR policy, role matrix, or access review documentation.")
}

// 3.1.5 Employ the principle of least privilege.
// Partially verifiable: enumerate sudo/wheel group members for analyst review.
func (v *Validator) CheckAC_3_1_5() ControlResult {
	r := ControlResult{
		ControlID:   "3.1.5",
		Title:       "Least Privilege",
		Family:      FamilyAC,
		Description: "Employ the principle of least privilege, including for specific security functions and privileged accounts.",
		CheckedAt:   time.Now(),
	}
	out, err := exec.Command("getent", "group", "sudo").Output()
	if err != nil {
		out, err = exec.Command("getent", "group", "wheel").Output()
	}
	if err != nil {
		r.Status = "MANUAL_REVIEW"
		r.Finding = "Cannot query privilege groups — manual sudo/wheel membership review required"
		return r
	}
	parts := strings.Split(strings.TrimSpace(string(out)), ":")
	if len(parts) < 4 || parts[3] == "" {
		r.Status = "PASS"
		r.Finding = "No non-root members in sudo/wheel group."
		return r
	}
	members := strings.Split(parts[3], ",")
	r.Status = "PASS"
	r.Finding = "Privileged group members: " + strings.Join(members, ", ") + " — verify each is operationally required."
	return r
}

// 3.1.6 Use non-privileged accounts for non-privileged activities.
func (v *Validator) CheckAC_3_1_6() ControlResult {
	return v.requiresManualReview("3.1.6", FamilyAC,
		"Use non-privileged accounts or roles when accessing non-security functions.",
		"Requires PAM policy review or privileged access management tool attestation.")
}

// 3.1.7 Prevent non-privileged users from executing privileged functions.
// Verifiable: check SELinux enforcement state.
func (v *Validator) CheckAC_3_1_7() ControlResult {
	r := ControlResult{
		ControlID:   "3.1.7",
		Title:       "Prevent Privileged Function Execution by Non-Privileged Users",
		Family:      FamilyAC,
		Description: "Prevent non-privileged users from executing privileged functions and capture the execution of such functions in audit logs.",
		CheckedAt:   time.Now(),
	}
	out, err := exec.Command("getenforce").Output()
	if err != nil {
		r.Status = "MANUAL_REVIEW"
		r.Finding = "Cannot query SELinux state — manual MAC policy review required"
		return r
	}
	mode := strings.TrimSpace(string(out))
	if mode == "Enforcing" {
		r.Status = "PASS"
		r.Finding = "SELinux in Enforcing mode — mandatory access control prevents privilege escalation."
	} else {
		r.Status = "FAIL"
		r.Finding = "SELinux mode: " + mode + " — mandatory access control not enforced."
		r.Remediation = "Set SELINUX=enforcing in /etc/selinux/config and reboot."
	}
	return r
}

// 3.1.8 Limit unsuccessful logon attempts.
// Verifiable: check faillock.conf for deny parameter.
func (v *Validator) CheckAC_3_1_8() ControlResult {
	r := ControlResult{
		ControlID:   "3.1.8",
		Title:       "Limit Unsuccessful Logon Attempts",
		Family:      FamilyAC,
		Description: "Limit unsuccessful logon attempts.",
		CheckedAt:   time.Now(),
	}
	data, err := os.ReadFile("/etc/security/faillock.conf")
	if err != nil {
		r.Status = "MANUAL_REVIEW"
		r.Finding = "/etc/security/faillock.conf not found — manual PAM/faillock review required"
		return r
	}
	for _, line := range strings.Split(string(data), "\n") {
		t := strings.TrimSpace(line)
		if strings.HasPrefix(t, "deny") && strings.Contains(t, "=") {
			r.Status = "PASS"
			r.Finding = "Account lockout configured: " + t
			return r
		}
	}
	r.Status = "FAIL"
	r.Finding = "faillock.conf exists but 'deny' parameter not set."
	r.Remediation = "Add 'deny = 3' to /etc/security/faillock.conf"
	return r
}

// 3.1.9 Provide privacy and security notices consistent with CUI rules.
// Verifiable: check /etc/issue for DoD banner text.
func (v *Validator) CheckAC_3_1_9() ControlResult {
	r := ControlResult{
		ControlID:   "3.1.9",
		Title:       "Privacy and Security Notices",
		Family:      FamilyAC,
		Description: "Provide privacy and security notices consistent with CUI rules.",
		CheckedAt:   time.Now(),
	}
	data, err := os.ReadFile("/etc/issue")
	if err != nil {
		r.Status = "FAIL"
		r.Finding = "/etc/issue not found — DoD banner not configured."
		r.Remediation = "Create /etc/issue with Standard Mandatory DoD Notice and Consent Banner text."
		return r
	}
	content := string(data)
	missing := []string{}
	for _, phrase := range []string{"U.S. Government", "authorized"} {
		if !strings.Contains(content, phrase) {
			missing = append(missing, `"`+phrase+`"`)
		}
	}
	if len(missing) == 0 {
		r.Status = "PASS"
		r.Finding = "DoD banner present in /etc/issue with required text."
	} else {
		r.Status = "FAIL"
		r.Finding = "/etc/issue missing required phrases: " + strings.Join(missing, ", ")
		r.Remediation = "Update /etc/issue with Standard Mandatory DoD Notice and Consent Banner."
	}
	return r
}

// 3.1.10 Use session lock after inactivity.
func (v *Validator) CheckAC_3_1_10() ControlResult {
	return v.requiresManualReview("3.1.10", FamilyAC,
		"Use session lock with pattern-hiding displays after a period of inactivity.",
		"Requires TMOUT in /etc/profile.d/ or screen lock policy verification.")
}

// 3.1.11 Terminate sessions after defined conditions.
// Partially verifiable via SSH ClientAliveInterval.
func (v *Validator) CheckAC_3_1_11() ControlResult {
	r := ControlResult{
		ControlID:   "3.1.11",
		Title:       "Session Termination",
		Family:      FamilyAC,
		Description: "Terminate (automatically) a user session after a defined condition.",
		CheckedAt:   time.Now(),
	}
	val := readSSHConfigDirective("ClientAliveInterval")
	if val == "" {
		r.Status = "MANUAL_REVIEW"
		r.Finding = "Cannot determine SSH ClientAliveInterval — manual session timeout review required"
		return r
	}
	if val != "0" {
		r.Status = "PASS"
		r.Finding = "SSH ClientAliveInterval = " + val + " (session timeout active)"
	} else {
		r.Status = "FAIL"
		r.Finding = "SSH ClientAliveInterval = 0 — sessions may not timeout."
		r.Remediation = "Set ClientAliveInterval 600 and ClientAliveCountMax 0 in /etc/ssh/sshd_config"
	}
	return r
}

func (v *Validator) CheckAC_3_1_12() ControlResult {
	return v.requiresManualReview("3.1.12", FamilyAC,
		"Monitor and control remote access sessions.",
		"Requires audit log review, VPN policy documentation, or remote access monitoring tool attestation.")
}

// 3.1.13 Employ cryptographic mechanisms to protect remote access sessions.
// Verifiable: check sshd_config for weak ciphers.
func (v *Validator) CheckAC_3_1_13() ControlResult {
	r := ControlResult{
		ControlID:   "3.1.13",
		Title:       "Cryptographic Protection of Remote Access",
		Family:      FamilyAC,
		Description: "Employ cryptographic mechanisms to protect the confidentiality of remote access sessions.",
		CheckedAt:   time.Now(),
	}
	data, err := os.ReadFile("/etc/ssh/sshd_config")
	if err != nil {
		r.Status = "MANUAL_REVIEW"
		r.Finding = "Cannot read /etc/ssh/sshd_config — manual cipher review required"
		return r
	}
	weakCiphers := []string{"3des-cbc", "arcfour", "blowfish-cbc", "cast128-cbc"}
	found := []string{}
	content := string(data)
	for _, weak := range weakCiphers {
		if strings.Contains(content, weak) {
			found = append(found, weak)
		}
	}
	if len(found) == 0 {
		r.Status = "PASS"
		r.Finding = "No weak SSH ciphers found in sshd_config."
	} else {
		r.Status = "FAIL"
		r.Finding = "Weak ciphers in sshd_config: " + strings.Join(found, ", ")
		r.Remediation = "Remove weak ciphers from Ciphers directive in /etc/ssh/sshd_config; restart sshd."
	}
	return r
}

func (v *Validator) CheckAC_3_1_14() ControlResult {
	return v.requiresManualReview("3.1.14", FamilyAC,
		"Route remote access via managed access control points.",
		"Requires network architecture documentation or firewall policy attestation.")
}

func (v *Validator) CheckAC_3_1_15() ControlResult {
	return v.requiresManualReview("3.1.15", FamilyAC,
		"Authorize remote execution of privileged commands only for documented operational needs.",
		"Requires privileged remote access policy documentation.")
}

func (v *Validator) CheckAC_3_1_16() ControlResult {
	return v.requiresManualReview("3.1.16", FamilyAC,
		"Authorize wireless access prior to allowing such connections.",
		"Requires wireless access policy and WLAN controller configuration review.")
}

func (v *Validator) CheckAC_3_1_17() ControlResult {
	return v.requiresManualReview("3.1.17", FamilyAC,
		"Protect wireless access using authentication and encryption.",
		"Requires WLAN security configuration review (WPA3, 802.1X, etc.).")
}

func (v *Validator) CheckAC_3_1_18() ControlResult {
	return v.requiresManualReview("3.1.18", FamilyAC,
		"Control connection of mobile devices.",
		"Requires MDM policy documentation or device management configuration review.")
}

func (v *Validator) CheckAC_3_1_19() ControlResult {
	return v.requiresManualReview("3.1.19", FamilyAC,
		"Encrypt CUI on mobile devices and mobile computing platforms.",
		"Requires device encryption policy or MDM attestation.")
}

func (v *Validator) CheckAC_3_1_20() ControlResult {
	return v.requiresManualReview("3.1.20", FamilyAC,
		"Verify and control/limit connections to external systems.",
		"Requires network egress policy review and external connection inventory.")
}

func (v *Validator) CheckAC_3_1_21() ControlResult {
	return v.requiresManualReview("3.1.21", FamilyAC,
		"Limit use of portable storage devices on external systems.",
		"Requires USB policy documentation or endpoint DLP configuration review.")
}

func (v *Validator) CheckAC_3_1_22() ControlResult {
	return v.requiresManualReview("3.1.22", FamilyAC,
		"Control CUI posted or processed on publicly accessible information systems.",
		"Requires public-facing system inventory and CUI posting policy review.")
}

// ── requiresManualReview ──────────────────────────────────────────────────────

// requiresManualReview returns a MANUAL_REVIEW result for controls that cannot
// be automated via filesystem/sysctl inspection — they need analyst attestation,
// policy documentation, or tooling outside KHEPRA's scope.
func (v *Validator) requiresManualReview(id, family, description, reasoning string) ControlResult {
	return ControlResult{
		ControlID:   id,
		Family:      family,
		Status:      "MANUAL_REVIEW",
		Description: description,
		Finding:     reasoning,
		CheckedAt:   time.Now(),
	}
}

// ── SSH helper ────────────────────────────────────────────────────────────────

// readSSHConfigDirective reads a single directive value from /etc/ssh/sshd_config.
func readSSHConfigDirective(directive string) string {
	data, err := os.ReadFile("/etc/ssh/sshd_config")
	if err != nil {
		return ""
	}
	for _, line := range strings.Split(string(data), "\n") {
		t := strings.TrimSpace(line)
		if strings.HasPrefix(t, "#") {
			continue
		}
		fields := strings.Fields(t)
		if len(fields) >= 2 && strings.EqualFold(fields[0], directive) {
			return fields[1]
		}
	}
	return ""
}
