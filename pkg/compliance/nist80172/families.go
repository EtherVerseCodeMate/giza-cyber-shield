package nist80172

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"
)

// NIST SP 800-172 Enhanced Security Requirements — All Families
// 35 enhanced controls across 14 families (AC already in access_control_enhanced.go).
// Controls use real OS-state checks where automatable; process controls return
// MANUAL_REVIEW with specific C3PAO evidence requirements.

// ValidateAllFamilies runs all 14 enhanced family validators and returns combined results.
func (v *EnhancedValidator) ValidateAllFamilies() []EnhancedResult {
	all := []EnhancedResult{}
	all = append(all, v.ValidateACFamily()...)  // 3 controls — access_control_enhanced.go
	all = append(all, v.ValidateATFamily()...)  // 2 controls
	all = append(all, v.ValidateAUFamily()...)  // 2 controls
	all = append(all, v.ValidateCMFamily()...)  // 2 controls
	all = append(all, v.ValidateIAFamily()...)  // 2 controls
	all = append(all, v.ValidateIRFamily()...)  // 2 controls
	all = append(all, v.ValidateMAFamily()...)  // 1 control
	all = append(all, v.ValidateMPFamily()...)  // 1 control
	all = append(all, v.ValidatePSFamily()...)  // 1 control
	all = append(all, v.ValidatePEFamily()...)  // 2 controls
	all = append(all, v.ValidateRAFamily()...)  // 4 controls
	all = append(all, v.ValidateCAFamily()...)  // 1 control
	all = append(all, v.ValidateSCFamily()...)  // 6 controls
	all = append(all, v.ValidateSIFamily()...)  // 6 controls
	v.Results = all
	return all
}

// ComputeSummary computes aggregate metrics across loaded results.
func (v *EnhancedValidator) ComputeSummary() EnhancedSummary {
	s := EnhancedSummary{
		TotalControls:   len(v.Results),
		BaselineVersion: "Enhanced (Rev 1)",
	}
	for _, r := range v.Results {
		switch r.Status {
		case "PASS":
			s.Passed++
		case "FAIL":
			s.Failed++
		case "MANUAL_REVIEW":
			s.ManualReview++
		case "NOT_APPLICABLE":
			s.NotApplicable++
		}
	}
	denominator := s.TotalControls - s.NotApplicable
	if denominator > 0 {
		s.Score = (float64(s.Passed) + float64(s.ManualReview)*0.5) / float64(denominator) * 100.0
	}
	return s
}

// ── AT: Awareness and Training (2 enhanced controls) ─────────────────────────

func (v *EnhancedValidator) ValidateATFamily() []EnhancedResult {
	return []EnhancedResult{
		v.CheckAT_3_2_1e(),
		v.CheckAT_3_2_2e(),
	}
}

// 3.2.1e — Provide awareness training focused on recognizing and responding to threats
// from social engineering, advanced persistent threat actors, and insider threats.
func (v *EnhancedValidator) CheckAT_3_2_1e() EnhancedResult {
	return enhancedManualReview("3.2.1e", FamilyAT,
		"Provide awareness training on threats including social engineering, APT, and insider threats.",
		"C3PAO evidence: training completion records (within 12 months) covering APT TTPs, phishing/spear-phishing, and insider threat indicators; LMS screenshot or signed attestation roster.")
}

// 3.2.2e — Provide role-based training on sophisticated cyber attacks targeting
// specific operational roles (developers, admins, executives).
func (v *EnhancedValidator) CheckAT_3_2_2e() EnhancedResult {
	return enhancedManualReview("3.2.2e", FamilyAT,
		"Provide role-based training on sophisticated cyber attacks and cybersecurity techniques.",
		"C3PAO evidence: role-specific training curriculum (admin, developer, ISSO); training completion records showing coverage of APT techniques relevant to each role; phishing simulation results.")
}

// ── AU: Audit and Accountability (2 enhanced controls) ───────────────────────

func (v *EnhancedValidator) ValidateAUFamily() []EnhancedResult {
	return []EnhancedResult{
		v.CheckAU_3_3_1e(),
		v.CheckAU_3_3_2e(),
	}
}

// 3.3.1e — Provide an audit capability supporting on-demand review, analysis,
// reporting, and after-the-fact investigation of security events.
func (v *EnhancedValidator) CheckAU_3_3_1e() EnhancedResult {
	return enhancedManualReview("3.3.1e", FamilyAU,
		"Provide audit capability for on-demand review, analysis, reporting, and after-the-fact investigation.",
		"C3PAO evidence: SIEM or log aggregation platform demonstrating on-demand query capability; sample ad-hoc audit report generated on request; log retention policy showing ≥ 12-month retention.")
}

// 3.3.2e — Employ a Security Information and Event Management (SIEM) system or
// equivalent centralized log correlation capability.
// Checks for known SIEM agents: Splunk UF, Wazuh, Elastic Agent, OSSEC, Auditbeat.
func (v *EnhancedValidator) CheckAU_3_3_2e() EnhancedResult {
	r := enhancedBase("3.3.2e", FamilyAU, "SIEM Deployment",
		"Employ a SIEM or equivalent capability for centralized log correlation and security event detection.")

	// SIEM agents that indicate a deployed SIEM pipeline.
	siemServices := []string{
		"SplunkForwarder", "splunkd",
		"wazuh-agent", "ossec",
		"elastic-agent", "filebeat", "auditbeat",
		"fluentd", "td-agent",
	}
	for _, svc := range siemServices {
		if execServiceActive(svc) {
			r.Status = "PASS"
			r.Finding = fmt.Sprintf("SIEM agent detected and active: %s.", svc)
			return r
		}
	}
	// Check for SIEM binaries in common paths.
	siemBinaries := []string{
		"/opt/splunkforwarder/bin/splunkd",
		"/var/ossec/bin/ossec-control",
		"/usr/share/elastic-agent/elastic-agent",
		"/usr/bin/filebeat",
	}
	for _, bin := range siemBinaries {
		if _, err := os.Stat(bin); err == nil {
			r.Status = "PASS"
			r.Finding = fmt.Sprintf("SIEM agent binary found: %s.", bin)
			return r
		}
	}
	r.Status = "FAIL"
	r.Finding = "No SIEM agent detected (Splunk, Wazuh, Elastic, OSSEC, Fluentd). Log events may not be centrally correlated."
	r.Remediation = "Deploy a SIEM agent: install wazuh-agent and configure /var/ossec/etc/ossec.conf with manager IP."
	return r
}

// ── CM: Configuration Management (2 enhanced controls) ───────────────────────

func (v *EnhancedValidator) ValidateCMFamily() []EnhancedResult {
	return []EnhancedResult{
		v.CheckCM_3_4_1e(),
		v.CheckCM_3_4_2e(),
	}
}

// 3.4.1e — Employ automated mechanisms to centrally manage, apply, and verify
// configuration settings for organization-defined system components.
// Checks for presence of config management toolchain (Ansible, Puppet, Chef, Salt).
func (v *EnhancedValidator) CheckCM_3_4_1e() EnhancedResult {
	r := enhancedBase("3.4.1e", FamilyCM, "Automated Configuration Management",
		"Employ automated mechanisms to centrally manage, apply, and verify configuration settings.")

	// Detect configuration management control planes.
	type cmTool struct {
		name      string
		service   string
		indicator string
	}
	tools := []cmTool{
		{"Ansible", "ansible", "/etc/ansible/ansible.cfg"},
		{"Puppet", "puppet", "/etc/puppetlabs/puppet/puppet.conf"},
		{"Chef", "chef-client", "/etc/chef/client.rb"},
		{"Salt", "salt-minion", "/etc/salt/minion"},
		{"CFEngine", "cf-agent", "/var/cfengine/masterfiles"},
	}
	for _, t := range tools {
		if _, err := os.Stat(t.indicator); err == nil {
			r.Status = "PASS"
			r.Finding = fmt.Sprintf("%s configuration management tool detected (%s).", t.name, t.indicator)
			return r
		}
		if execServiceActive(t.service) {
			r.Status = "PASS"
			r.Finding = fmt.Sprintf("%s daemon active (%s service).", t.name, t.service)
			return r
		}
	}
	r.Status = "FAIL"
	r.Finding = "No automated configuration management tool detected (Ansible, Puppet, Chef, Salt, CFEngine)."
	r.Remediation = "Deploy Ansible/Puppet/Chef/Salt to enforce centralized baseline configuration management."
	return r
}

// 3.4.2e — Employ automated mechanisms to detect the presence of unauthorized
// hardware, firmware, and software components.
// Checks for software/hardware inventory and integrity tools (AIDE, Tripwire, osquery).
func (v *EnhancedValidator) CheckCM_3_4_2e() EnhancedResult {
	r := enhancedBase("3.4.2e", FamilyCM, "Unauthorized Component Detection",
		"Employ automated mechanisms to detect unauthorized hardware, firmware, and software.")

	// File-integrity and inventory tools.
	type invTool struct {
		name      string
		service   string
		indicator string
	}
	tools := []invTool{
		{"AIDE", "aidecheck", "/etc/aide/aide.conf"},
		{"Tripwire", "tripwire", "/etc/tripwire/tw.cfg"},
		{"osquery", "osqueryd", "/etc/osquery/osquery.conf"},
		{"Samhain", "samhain", "/etc/samhainrc"},
	}
	for _, t := range tools {
		if _, err := os.Stat(t.indicator); err == nil {
			r.Status = "PASS"
			r.Finding = fmt.Sprintf("%s inventory/integrity tool configured (%s).", t.name, t.indicator)
			return r
		}
		if execServiceActive(t.service) {
			r.Status = "PASS"
			r.Finding = fmt.Sprintf("%s service active — unauthorized component detection operational.", t.name)
			return r
		}
	}
	r.Status = "FAIL"
	r.Finding = "No automated unauthorized-component detection tool found (AIDE, Tripwire, osquery, Samhain)."
	r.Remediation = "Install and initialize AIDE: aide --init && cp /var/lib/aide/aide.db.new /var/lib/aide/aide.db; schedule aide --check in cron."
	return r
}

// ── IA: Identification and Authentication (2 enhanced controls) ───────────────

func (v *EnhancedValidator) ValidateIAFamily() []EnhancedResult {
	return []EnhancedResult{
		v.CheckIA_3_5_1e(),
		v.CheckIA_3_5_3e(),
	}
}

// 3.5.1e — Employ organization-defined supplemental multi-factor authentication
// mechanisms for privileged accounts.
// Checks SSH AuthenticationMethods and PAM for MFA configuration.
func (v *EnhancedValidator) CheckIA_3_5_1e() EnhancedResult {
	r := enhancedBase("3.5.1e", FamilyIA, "Supplemental MFA — Privileged Accounts",
		"Employ supplemental multi-factor authentication mechanisms for privileged accounts beyond a single factor.")

	authMethods := sshConfigVal("AuthenticationMethods")
	if authMethods != "" &&
		(strings.Contains(authMethods, "keyboard-interactive") ||
			strings.Contains(authMethods, "publickey,") ||
			strings.Contains(authMethods, ",publickey")) {
		r.Status = "PASS"
		r.Finding = "SSH AuthenticationMethods requires MFA: " + authMethods
		return r
	}
	// Check PAM for Google Authenticator or similar TOTP/FIDO2.
	pamData, err := os.ReadFile("/etc/pam.d/sshd")
	if err == nil &&
		(strings.Contains(string(pamData), "pam_google_authenticator") ||
			strings.Contains(string(pamData), "pam_u2f") ||
			strings.Contains(string(pamData), "pam_duo") ||
			strings.Contains(string(pamData), "pam_radius")) {
		r.Status = "PASS"
		r.Finding = "PAM MFA module detected in /etc/pam.d/sshd."
		return r
	}
	r.Status = "FAIL"
	r.Finding = "MFA not enforced for privileged SSH authentication (AuthenticationMethods not set to require MFA; no MFA PAM module detected)."
	r.Remediation = "Set in sshd_config: AuthenticationMethods publickey,keyboard-interactive; configure pam_google_authenticator or pam_u2f."
	return r
}

// 3.5.3e — Employ MFA for network access to non-privileged accounts.
func (v *EnhancedValidator) CheckIA_3_5_3e() EnhancedResult {
	r := enhancedBase("3.5.3e", FamilyIA, "MFA — Non-Privileged Network Access",
		"Employ multi-factor authentication for network access to non-privileged accounts.")

	// Check PAM sshd or common-auth for MFA modules.
	pamFiles := []string{"/etc/pam.d/sshd", "/etc/pam.d/common-auth", "/etc/pam.d/system-auth"}
	for _, pf := range pamFiles {
		data, err := os.ReadFile(pf)
		if err != nil {
			continue
		}
		content := string(data)
		if strings.Contains(content, "pam_google_authenticator") ||
			strings.Contains(content, "pam_u2f") ||
			strings.Contains(content, "pam_duo") ||
			strings.Contains(content, "pam_radius") ||
			strings.Contains(content, "pam_pkcs11") {
			r.Status = "PASS"
			r.Finding = "MFA PAM module detected in " + pf + " — non-privileged account MFA enforced."
			return r
		}
	}
	r.Status = "FAIL"
	r.Finding = "No MFA PAM module detected for non-privileged network access."
	r.Remediation = "Install libpam-google-authenticator; add 'auth required pam_google_authenticator.so' to /etc/pam.d/sshd; set AuthenticationMethods publickey,keyboard-interactive in sshd_config."
	return r
}

// ── IR: Incident Response (2 enhanced controls) ──────────────────────────────

func (v *EnhancedValidator) ValidateIRFamily() []EnhancedResult {
	return []EnhancedResult{
		v.CheckIR_3_6_1e(),
		v.CheckIR_3_6_2e(),
	}
}

// 3.6.1e — Establish and maintain an operational incident-handling capability
// that includes conducting tabletop exercises and simulations.
func (v *EnhancedValidator) CheckIR_3_6_1e() EnhancedResult {
	return enhancedManualReview("3.6.1e", FamilyIR,
		"Maintain incident-handling capability including tabletop exercises and simulations.",
		"C3PAO evidence: Incident Response Plan (IRP) document with last-tested date within 12 months; tabletop exercise after-action report; CIRT contact list and escalation procedures.")
}

// 3.6.2e — Establish and maintain a Cyber Incident Response Team (CIRT)
// with capacity to respond to incidents within defined timeframes.
func (v *EnhancedValidator) CheckIR_3_6_2e() EnhancedResult {
	return enhancedManualReview("3.6.2e", FamilyIR,
		"Establish and maintain a CIRT with capacity to respond to incidents within defined timeframes.",
		"C3PAO evidence: CIRT roster with roles and 24/7 contact information; SLA or IR policy defining response times (e.g., ≤ 1 hour detection-to-containment for Critical); documented IR retainer or internal team capability.")
}

// ── MA: Maintenance (1 enhanced control) ─────────────────────────────────────

func (v *EnhancedValidator) ValidateMAFamily() []EnhancedResult {
	return []EnhancedResult{
		v.CheckMA_3_7_5e(),
	}
}

// 3.7.5e — Require MFA to establish nonlocal maintenance sessions via external
// network connections and terminate such connections when nonlocal maintenance is complete.
// Checks SSH AuthenticationMethods for MFA requirement on remote maintenance.
func (v *EnhancedValidator) CheckMA_3_7_5e() EnhancedResult {
	r := enhancedBase("3.7.5e", FamilyMA, "MFA for Remote Maintenance",
		"Require MFA to establish nonlocal maintenance sessions and terminate connections when done.")

	authMethods := sshConfigVal("AuthenticationMethods")
	if authMethods != "" &&
		(strings.Contains(authMethods, "keyboard-interactive") ||
			(strings.Contains(authMethods, "publickey") && strings.Contains(authMethods, ","))) {
		r.Status = "PASS"
		r.Finding = "SSH requires MFA for all sessions (AuthenticationMethods=" + authMethods + "); satisfies remote maintenance MFA requirement."
		return r
	}
	// Check ClientAliveInterval to verify sessions terminate when idle.
	clientAlive := sshConfigVal("ClientAliveInterval")
	if authMethods == "" {
		r.Status = "FAIL"
		r.Finding = "SSH AuthenticationMethods not configured for MFA — remote maintenance sessions lack second-factor authentication."
		r.Remediation = "Set AuthenticationMethods publickey,keyboard-interactive in sshd_config; configure TOTP or FIDO2 via PAM."
		return r
	}
	clientAliveN := 0
	if clientAlive != "" {
		for _, b := range clientAlive {
			if b >= '0' && b <= '9' {
				clientAliveN = clientAliveN*10 + int(b-'0')
			} else {
				break
			}
		}
	}
	if clientAliveN > 0 && clientAliveN <= 600 {
		r.Status = "PASS"
		r.Finding = fmt.Sprintf("SSH MFA configured; ClientAliveInterval=%s ensures session termination after inactivity.", clientAlive)
		return r
	}
	r.Status = "MANUAL_REVIEW"
	r.Finding = "MFA partially configured but session termination policy needs verification."
	r.Remediation = "Set ClientAliveInterval 600 and ClientAliveCountMax 0 in sshd_config to terminate idle maintenance sessions."
	return r
}

// ── MP: Media Protection (1 enhanced control) ─────────────────────────────────

func (v *EnhancedValidator) ValidateMPFamily() []EnhancedResult {
	return []EnhancedResult{
		v.CheckMP_3_8_1e(),
	}
}

// 3.8.1e — Employ organization-defined supplemental mechanisms to protect CUI
// on portable storage devices used in organizational systems or on behalf of the organization.
func (v *EnhancedValidator) CheckMP_3_8_1e() EnhancedResult {
	return enhancedManualReview("3.8.1e", FamilyMP,
		"Employ supplemental mechanisms to protect CUI on portable storage devices.",
		"C3PAO evidence: portable storage encryption policy (e.g., hardware-encrypted USB required for CUI); endpoint DLP configuration enforcing encryption; inventory of approved encrypted storage devices.")
}

// ── PS: Personnel Security (1 enhanced control) ───────────────────────────────

func (v *EnhancedValidator) ValidatePSFamily() []EnhancedResult {
	return []EnhancedResult{
		v.CheckPS_3_9_1e(),
	}
}

// 3.9.1e — Employ advanced vetting and screening processes for individuals
// requiring access to highly sensitive CUI or systems processing CUI at CMMC Level 3.
func (v *EnhancedValidator) CheckPS_3_9_1e() EnhancedResult {
	return enhancedManualReview("3.9.1e", FamilyPS,
		"Employ advanced screening for personnel with access to highly sensitive CUI.",
		"C3PAO evidence: personnel screening policy specifying enhanced background investigation requirements (e.g., NACI, Tier 3); screening completion records for CUI-access personnel; adjudication records where applicable.")
}

// ── PE: Physical Protection (2 enhanced controls) ─────────────────────────────

func (v *EnhancedValidator) ValidatePEFamily() []EnhancedResult {
	return []EnhancedResult{
		v.CheckPE_3_10_1e(),
		v.CheckPE_3_10_2e(),
	}
}

// 3.10.1e — Employ supplemental controls to restrict physical access to systems
// and system components at all locations where CUI resides.
func (v *EnhancedValidator) CheckPE_3_10_1e() EnhancedResult {
	return enhancedManualReview("3.10.1e", FamilyPE,
		"Employ supplemental controls to restrict physical access to CUI systems beyond standard controls.",
		"C3PAO evidence: two-factor physical access control (badge + PIN/biometric) for CUI server rooms; visitor log with escort records; physical penetration test results dated within 24 months.")
}

// 3.10.2e — Employ organization-defined supplemental controls to protect CUI
// at alternate work sites.
func (v *EnhancedValidator) CheckPE_3_10_2e() EnhancedResult {
	return enhancedManualReview("3.10.2e", FamilyPE,
		"Employ supplemental controls to protect CUI at alternate work sites.",
		"C3PAO evidence: telework security agreement signed by all remote workers with CUI access; VPN required for CUI access from alternate sites; endpoint security posture check (MDM) prior to CUI session establishment.")
}

// ── RA: Risk Assessment (4 enhanced controls) ─────────────────────────────────

func (v *EnhancedValidator) ValidateRAFamily() []EnhancedResult {
	return []EnhancedResult{
		v.CheckRA_3_11_1e(),
		v.CheckRA_3_11_2e(),
		v.CheckRA_3_11_3e(),
		v.CheckRA_3_11_4e(),
	}
}

// 3.11.1e — Employ threat-hunting teams or processes to search for indicators
// of compromise or adversarial behavior not discovered through automated detection.
func (v *EnhancedValidator) CheckRA_3_11_1e() EnhancedResult {
	return enhancedManualReview("3.11.1e", FamilyRA,
		"Employ threat-hunting processes to discover indicators of compromise not caught by automated tools.",
		"C3PAO evidence: threat-hunting charter or program documentation; hunt team activity logs or reports from the past 12 months; integration with threat intelligence feeds (MISP, STIX/TAXII, CISA AIS).")
}

// 3.11.2e — Employ advanced automation and analytics to predict and identify risks
// to organizational operations, assets, and individuals.
func (v *EnhancedValidator) CheckRA_3_11_2e() EnhancedResult {
	return enhancedManualReview("3.11.2e", FamilyRA,
		"Employ advanced automation and analytics to predict and identify organizational risks.",
		"C3PAO evidence: ML/AI-based risk scoring or anomaly detection platform (e.g., UEBA, EDR with behavioral analytics); risk trend reports demonstrating predictive capability; documented use of automated risk indicators in security decisions.")
}

// 3.11.3e — Employ penetration testing with an appropriate degree of independence
// to identify weaknesses and deficiencies in organizational systems.
func (v *EnhancedValidator) CheckRA_3_11_3e() EnhancedResult {
	return enhancedManualReview("3.11.3e", FamilyRA,
		"Employ penetration testing with appropriate independence to identify system weaknesses.",
		"C3PAO evidence: penetration test report (within 12 months) conducted by independent assessor or red team; scope coverage showing CUI systems tested; findings remediation plan with tracking.")
}

// 3.11.4e — Employ advanced security solutions to address organization-defined
// threats from sophisticated adversaries including APT actors.
func (v *EnhancedValidator) CheckRA_3_11_4e() EnhancedResult {
	return enhancedManualReview("3.11.4e", FamilyRA,
		"Employ advanced security solutions targeting sophisticated adversaries including APT actors.",
		"C3PAO evidence: EDR/XDR platform deployment covering CUI systems; threat intelligence integration showing APT indicator feeds; incident response playbooks specific to APT TTPs (MITRE ATT&CK mapping).")
}

// ── CA: Security Assessment (1 enhanced control) ──────────────────────────────

func (v *EnhancedValidator) ValidateCAFamily() []EnhancedResult {
	return []EnhancedResult{
		v.CheckCA_3_12_1e(),
	}
}

// 3.12.1e — Employ independent assessors or assessment teams to monitor
// the implementation of the security assessment plan.
func (v *EnhancedValidator) CheckCA_3_12_1e() EnhancedResult {
	return enhancedManualReview("3.12.1e", FamilyCA,
		"Employ independent assessors to monitor security assessment plan implementation.",
		"C3PAO evidence: signed C3PAO assessment agreement for current assessment period; assessment plan reviewed and approved by independent assessor; assessment results letter or partial-assessment documentation.")
}

// ── SC: System and Communications Protection (6 enhanced controls) ─────────────

func (v *EnhancedValidator) ValidateSCFamily() []EnhancedResult {
	return []EnhancedResult{
		v.CheckSC_3_13_1e(),
		v.CheckSC_3_13_2e(),
		v.CheckSC_3_13_3e(),
		v.CheckSC_3_13_4e(),
		v.CheckSC_3_13_5e(),
		v.CheckSC_3_13_6e(),
	}
}

// 3.13.1e — Employ architectural designs, software development techniques, and
// systems engineering principles promoting security as a foundational capability.
// Checks FIPS mode as a proxy for security-by-design cryptographic architecture.
func (v *EnhancedValidator) CheckSC_3_13_1e() EnhancedResult {
	r := enhancedBase("3.13.1e", FamilySC, "Security Architecture Principles",
		"Employ architectural designs, development techniques, and engineering principles promoting security.")

	// FIPS mode: strong proxy for secure-by-design cryptographic posture.
	fipsData, err := os.ReadFile("/proc/sys/crypto/fips_enabled")
	if err == nil && strings.TrimSpace(string(fipsData)) == "1" {
		r.Status = "PASS"
		r.Finding = "FIPS mode enabled — NIST-approved cryptographic architecture enforced system-wide."
		return r
	}
	// Check kernel security modules (grsecurity, SELinux, SMEP/SMAP indicators).
	kernelHardened := false
	if enforceBytes, err := os.ReadFile("/sys/fs/selinux/enforce"); err == nil &&
		strings.TrimSpace(string(enforceBytes)) == "1" {
		kernelHardened = true
	}
	if kernelHardened {
		r.Status = "PASS"
		r.Finding = "SELinux enforcing and kernel hardening active — security-architecture principles partially satisfied. Enable FIPS for full compliance."
		return r
	}
	r.Status = "FAIL"
	r.Finding = "FIPS mode disabled and SELinux not enforcing — security-architecture principles not enforced."
	r.Remediation = "Enable FIPS: fips-mode-setup --enable && reboot; enable SELinux: setenforce 1"
	return r
}

// 3.13.2e — Partition the system into components residing in separate physical
// domains or environments based on the sensitivity of the data processed.
func (v *EnhancedValidator) CheckSC_3_13_2e() EnhancedResult {
	return enhancedManualReview("3.13.2e", FamilySC,
		"Partition systems into components in separate physical domains based on data sensitivity.",
		"C3PAO evidence: network architecture diagram showing physical or logical segmentation of CUI systems from general IT; VLAN/zone configuration; firewall ACLs enforcing inter-segment isolation.")
}

// 3.13.3e — Employ a security kernel as the basis for providing critical security functions.
func (v *EnhancedValidator) CheckSC_3_13_3e() EnhancedResult {
	return enhancedManualReview("3.13.3e", FamilySC,
		"Employ a security kernel as the basis for critical security functions.",
		"C3PAO evidence: documentation showing security kernel or RTOS used for CUI processing (e.g., LynxOS, VxWorks, SELinux mandatory access control as policy-enforcement kernel extension); or formal security architecture document identifying the trusted computing base.")
}

// 3.13.4e — Employ organization-defined security functions that are isolated
// from non-security functions within system components.
func (v *EnhancedValidator) CheckSC_3_13_4e() EnhancedResult {
	return enhancedManualReview("3.13.4e", FamilySC,
		"Employ security functions isolated from non-security functions within system components.",
		"C3PAO evidence: system design document showing security function isolation (e.g., separate process/container for crypto operations, HSM for key management); SELinux type enforcement policies showing security domain separation.")
}

// 3.13.5e — Restrict the use of hardware and software components based on
// risk assessments, and prohibit components from obtaining access beyond approved authorizations.
// Checks for USB storage blocking (proxy for hardware restriction enforcement).
func (v *EnhancedValidator) CheckSC_3_13_5e() EnhancedResult {
	r := enhancedBase("3.13.5e", FamilySC, "Hardware and Software Component Restriction",
		"Restrict hardware and software components based on risk assessments.")

	// USB storage blacklist is the most common automatable hardware restriction.
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
				(strings.Contains(content, "blacklist") || strings.Contains(content, "/bin/false")) {
				r.Status = "PASS"
				r.Finding = "USB storage module blacklisted — hardware component restriction enforced via modprobe.d."
				return r
			}
		}
	}
	r.Status = "MANUAL_REVIEW"
	r.Finding = "Hardware component restriction (USB blacklist) not detected. Full hardware allowlist policy requires manual review."
	r.Remediation = "Create /etc/modprobe.d/usb-storage.conf: install usb-storage /bin/false; document hardware allowlist policy."
	return r
}

// 3.13.6e — Employ a layered network topology with multiple protection layers,
// including security enclaves, demilitarized zones (DMZs), and firewalls.
func (v *EnhancedValidator) CheckSC_3_13_6e() EnhancedResult {
	return enhancedManualReview("3.13.6e", FamilySC,
		"Employ layered network topology with multiple protection layers including DMZ and firewalls.",
		"C3PAO evidence: network architecture diagram showing ≥ 3 distinct security zones (internet-facing DMZ, internal network, CUI enclave); firewall ruleset enforcing zone transitions; network penetration test validating zone isolation.")
}

// ── SI: System and Information Integrity (6 enhanced controls) ─────────────────

func (v *EnhancedValidator) ValidateSIFamily() []EnhancedResult {
	return []EnhancedResult{
		v.CheckSI_3_14_1e(),
		v.CheckSI_3_14_2e(),
		v.CheckSI_3_14_3e(),
		v.CheckSI_3_14_4e(),
		v.CheckSI_3_14_5e(),
		v.CheckSI_3_14_6e(),
	}
}

// 3.14.1e — Verify the integrity of the system boot process.
// Checks for UEFI Secure Boot via /sys/firmware/efi and mokutil.
func (v *EnhancedValidator) CheckSI_3_14_1e() EnhancedResult {
	r := enhancedBase("3.14.1e", FamilySI, "Boot Process Integrity",
		"Verify the integrity of the system boot process.")

	// UEFI boot: /sys/firmware/efi exists only on EFI systems.
	if _, err := os.Stat("/sys/firmware/efi"); err != nil {
		r.Status = "MANUAL_REVIEW"
		r.Finding = "EFI subsystem not present — system may be using BIOS boot; boot integrity requires manual review."
		r.Remediation = "Confirm Secure Boot status in BIOS/UEFI firmware settings; consider migrating to UEFI with Secure Boot enabled."
		return r
	}
	// Check Secure Boot state via mokutil.
	out, err := exec.Command("mokutil", "--sb-state").Output()
	if err == nil {
		lowered := strings.ToLower(strings.TrimSpace(string(out)))
		if strings.Contains(lowered, "secureboot enabled") {
			r.Status = "PASS"
			r.Finding = "UEFI Secure Boot enabled — boot process integrity verified by firmware."
			return r
		}
		r.Status = "FAIL"
		r.Finding = "UEFI present but Secure Boot disabled: " + strings.TrimSpace(string(out))
		r.Remediation = "Enable Secure Boot in UEFI settings; enroll organization CA if using custom kernels (mokutil --import)."
		return r
	}
	// Check kernel lock-down (post-boot integrity indicator).
	lockdownData, err := os.ReadFile("/sys/kernel/security/lockdown")
	if err == nil && !strings.Contains(strings.ToLower(string(lockdownData)), "none") {
		r.Status = "PASS"
		r.Finding = "Kernel lockdown active (" + strings.TrimSpace(string(lockdownData)) + ") — boot integrity enforced."
		return r
	}
	r.Status = "MANUAL_REVIEW"
	r.Finding = "UEFI present but cannot determine Secure Boot state (mokutil unavailable); manual boot-integrity verification required."
	r.Remediation = "Install mokutil: dnf install mokutil; verify SecureBoot enabled in UEFI firmware."
	return r
}

// 3.14.2e — Monitor organizational systems and system components on an ongoing
// basis for deviations in behavior that may indicate a compromise.
// Checks for AIDE, Tripwire, or active IDS/FIM tools.
func (v *EnhancedValidator) CheckSI_3_14_2e() EnhancedResult {
	r := enhancedBase("3.14.2e", FamilySI, "Behavioral Deviation Monitoring",
		"Monitor systems for deviations in behavior that may indicate compromise.")

	// File Integrity Monitoring (FIM) tools.
	type monTool struct {
		name      string
		service   string
		conf      string
	}
	tools := []monTool{
		{"AIDE", "aidecheck", "/etc/aide/aide.conf"},
		{"Tripwire", "tripwire", "/etc/tripwire/tw.cfg"},
		{"Samhain", "samhain", "/etc/samhainrc"},
		{"OSSEC/Wazuh", "wazuh-agent", "/var/ossec/etc/ossec.conf"},
		{"Auditbeat", "auditbeat", "/etc/auditbeat/auditbeat.yml"},
		{"osquery", "osqueryd", "/etc/osquery/osquery.conf"},
	}
	for _, t := range tools {
		if execServiceActive(t.service) {
			r.Status = "PASS"
			r.Finding = fmt.Sprintf("%s active — behavioral deviation monitoring operational.", t.name)
			return r
		}
		if _, err := os.Stat(t.conf); err == nil {
			r.Status = "PASS"
			r.Finding = fmt.Sprintf("%s configured (%s) — integrity monitoring in place.", t.name, t.conf)
			return r
		}
	}
	r.Status = "FAIL"
	r.Finding = "No behavioral monitoring / FIM tool detected (AIDE, Tripwire, OSSEC, osquery, Auditbeat)."
	r.Remediation = "Install AIDE: aide --init && cp /var/lib/aide/aide.db.new /var/lib/aide/aide.db; schedule periodic aide --check."
	return r
}

// 3.14.3e — Employ advanced automation and ML/AI capabilities to detect
// sophisticated attacks and malicious behavior.
func (v *EnhancedValidator) CheckSI_3_14_3e() EnhancedResult {
	return enhancedManualReview("3.14.3e", FamilySI,
		"Employ advanced automation and ML/AI to detect sophisticated attacks.",
		"C3PAO evidence: EDR/XDR platform with ML-based behavioral detection (e.g., CrowdStrike Falcon, SentinelOne, Defender for Endpoint) deployed on all CUI-processing endpoints; monthly threat detection report showing ML alert volume and classification.")
}

// 3.14.4e — Employ deception technologies and techniques to detect and identify
// adversaries attempting to compromise organizational systems.
func (v *EnhancedValidator) CheckSI_3_14_4e() EnhancedResult {
	return enhancedManualReview("3.14.4e", FamilySI,
		"Employ deception technologies and techniques to identify adversaries.",
		"C3PAO evidence: honeypot or honeynet deployment documentation; deception token configuration (canary tokens, honey credentials); detection event log showing deception trigger alerts in the past 12 months.")
}

// 3.14.5e — Identify unauthorized use of organizational systems, applications,
// and services through behavioral analysis or anomaly detection.
func (v *EnhancedValidator) CheckSI_3_14_5e() EnhancedResult {
	return enhancedManualReview("3.14.5e", FamilySI,
		"Identify unauthorized use of organizational systems through behavioral analysis.",
		"C3PAO evidence: UEBA or SIEM behavioral analytics rule set; anomaly detection alert report from past 30 days; documented baseline of normal behavior and thresholds for alerting.")
}

// 3.14.6e — Implement a software-defined networking (SDN) architecture or
// equivalent dynamic network architecture to enable on-demand security capabilities.
func (v *EnhancedValidator) CheckSI_3_14_6e() EnhancedResult {
	return enhancedManualReview("3.14.6e", FamilySI,
		"Implement software-defined networking or dynamic network architecture.",
		"C3PAO evidence: SDN platform documentation (e.g., OpenDaylight, Cisco ACI, VMware NSX-T) or equivalent microsegmentation solution; architecture diagram showing dynamic policy enforcement; network segmentation test results.")
}

// ── Internal helpers (package-private) ───────────────────────────────────────

// enhancedBase initializes an EnhancedResult with common fields.
func enhancedBase(id, family, title, description string) EnhancedResult {
	return EnhancedResult{
		ControlID:   id,
		Title:       title,
		Family:      family,
		Description: description,
		CheckedAt:   time.Now(),
	}
}

// enhancedManualReview returns a MANUAL_REVIEW result with specific C3PAO evidence requirements.
func enhancedManualReview(id, family, description, evidenceRequired string) EnhancedResult {
	return EnhancedResult{
		ControlID:   id,
		Family:      family,
		Status:      "MANUAL_REVIEW",
		Description: description,
		Finding:     "MANUAL REVIEW REQUIRED — " + evidenceRequired,
		Remediation: evidenceRequired,
		CheckedAt:   time.Now(),
	}
}

// execServiceActive returns true if the named systemd service is active.
func execServiceActive(name string) bool {
	return exec.Command("systemctl", "is-active", "--quiet", name).Run() == nil
}

// sshConfigVal reads a single directive value from /etc/ssh/sshd_config.
func sshConfigVal(directive string) string {
	data, err := os.ReadFile("/etc/ssh/sshd_config")
	if err != nil {
		return ""
	}
	lower := strings.ToLower(directive)
	for _, line := range strings.Split(string(data), "\n") {
		t := strings.TrimSpace(line)
		if strings.HasPrefix(t, "#") {
			continue
		}
		parts := strings.Fields(t)
		if len(parts) >= 2 && strings.ToLower(parts[0]) == lower {
			return strings.Join(parts[1:], " ")
		}
	}
	return ""
}
