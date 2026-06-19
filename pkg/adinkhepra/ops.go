package adinkhepra

// ops.go — remediation command map for all 145 CMMC controls.
// Each entry maps a NIST SP 800-171 Rev 2 or SP 800-172 control ID to a
// RemediationEntry that the adinkhepra-daemon executes after ML-DSA-65-signed
// staging-gate approval, or returns as a manual attestation requirement for
// the C3PAO evidence package.
//
// Adinkra symbols govern ChangeRequest authorization tier in the daemon:
//   eban         — security/protection ops (kernel, FIPS, modprobe)
//   fawohodie    — user account / identity management
//   nkyinkyim    — configuration adaptation (SSH, PAM, firewall rules)
//   dwennimmen   — audit and logging hardening
//   funtunfunefu — complex coordinated multi-step operations

const (
	commandTypeLocal  = "local"
	commandTypeManual = "manual_attestation"

	symbolEban         = "eban"
	symbolFawohodie    = "fawohodie"
	symbolNkyinkyim    = "nkyinkyim"
	symbolDwennimmen   = "dwennimmen"
	symbolFuntunfunefu = "funtunfunefu"

	riskLow    = "low"
	riskMedium = "medium"
	riskHigh   = "high"
)

// RemediationEntry describes how to remediate a failing CMMC control.
type RemediationEntry struct {
	Symbol      string   // Adinkra glyph — determines ML-DSA-65 authorization tier
	CommandType string   // "local" or "manual_attestation"
	Command     []string // Shell command argv for "local" type (Command[0] is the executable)
	Evidence    string   // For "manual_attestation": C3PAO evidence requirements
	RiskLevel   string   // Staging-gate risk tier: "low", "medium", "high"
}

// remediationMap maps every CMMC control ID to its RemediationEntry.
// Keys: NIST 800-171 format ("3.1.1") and NIST 800-172 format ("3.1.1e").
var remediationMap = map[string]RemediationEntry{

	// ── NIST SP 800-171 Rev 2 — Access Control (22 controls) ────────────────

	"3.1.1": {
		Symbol: symbolFawohodie, CommandType: commandTypeLocal, RiskLevel: riskMedium,
		Command: []string{"sh", "-c",
			"awk -F: '$3==0 && $1!=\"root\" {print $1}' /etc/passwd | xargs -r -I{} usermod -s /sbin/nologin {}; " +
				"for svc in daemon bin sys mail nobody www-data sshd ntp; do " +
				"  id \"$svc\" &>/dev/null && usermod -s /sbin/nologin \"$svc\" || true; done"},
	},
	"3.1.2": {
		Symbol: symbolNkyinkyim, CommandType: commandTypeManual, RiskLevel: riskHigh,
		Evidence: "C3PAO evidence: visudo review confirming no individual account holds ALL=(ALL) ALL grant; CMND_ALIAS restrictions documented in sudoers; screenshot of /etc/sudoers after audit.",
	},
	"3.1.3": {
		Symbol: symbolEban, CommandType: commandTypeLocal, RiskLevel: riskHigh,
		Command: []string{"sh", "-c",
			"setenforce 1; sed -i 's/^SELINUX=.*/SELINUX=enforcing/' /etc/selinux/config"},
	},
	"3.1.4": {
		Symbol: symbolFawohodie, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: Separation of Duties policy matrix; RBAC configuration showing no single account holds conflicting roles (developer + approver); signed management approval.",
	},
	"3.1.5": {
		Symbol: symbolEban, CommandType: commandTypeLocal, RiskLevel: riskMedium,
		Command: []string{"sh", "-c",
			"find /usr /bin /sbin -perm /4000 -type f | " +
				"grep -vE '^(/usr/bin/(passwd|sudo|su|newgrp|chage|gpasswd|mount|umount|pkexec|ping|crontab|at|write|wall|screen|ssh-agent)|" +
				"/usr/sbin/(pam_timestamp_check|unix_chkpwd)|" +
				"/usr/lib(exec)?/openssh/ssh-keysign|/bin/ping)$' | " +
				"xargs -r chmod u-s"},
	},
	"3.1.6": {
		Symbol: symbolFawohodie, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: privileged-account usage policy requiring admins to use separate standard accounts for non-security functions; PAM or sudo logs showing compliance; manager attestation.",
	},
	"3.1.7": {
		Symbol: symbolDwennimmen, CommandType: commandTypeLocal, RiskLevel: riskMedium,
		Command: []string{"sh", "-c",
			"systemctl enable --now auditd; " +
				"echo '-a always,exit -F arch=b64 -S execve -F path=/usr/bin/sudo -k priv_cmd' >> /etc/audit/rules.d/privileged.rules; " +
				"echo '-a always,exit -F arch=b64 -S execve -F path=/usr/bin/su -k priv_cmd' >> /etc/audit/rules.d/privileged.rules; " +
				"augenrules --load"},
	},
	"3.1.8": {
		Symbol: symbolNkyinkyim, CommandType: commandTypeLocal, RiskLevel: riskLow,
		Command: []string{"sh", "-c",
			"grep -q '^deny' /etc/security/faillock.conf && " +
				"  sed -i 's/^deny.*/deny = 5/' /etc/security/faillock.conf || " +
				"  echo 'deny = 5' >> /etc/security/faillock.conf; " +
				"grep -q '^unlock_time' /etc/security/faillock.conf && " +
				"  sed -i 's/^unlock_time.*/unlock_time = 900/' /etc/security/faillock.conf || " +
				"  echo 'unlock_time = 900' >> /etc/security/faillock.conf"},
	},
	"3.1.9": {
		Symbol: symbolNkyinkyim, CommandType: commandTypeLocal, RiskLevel: riskLow,
		Command: []string{"sh", "-c",
			`BANNER='You are accessing a U.S. Government information system, which includes (1) this computer, (2) this computer network, (3) all computers connected to this network, and (4) all devices and storage media attached to this network or to a computer on this network. This information system is provided for U.S. Government-authorized use only. Unauthorized or improper use of this system is prohibited and may result in disciplinary action and/or criminal and civil penalties. By using this information system, you understand and consent to the following: You have no reasonable expectation of privacy regarding any communications or data transiting this information system. At any time and for any lawful Government purpose, the Government may monitor, intercept, and search and seize any communication or data transiting this information system.'
printf '%s\n' "$BANNER" > /etc/issue
printf '%s\n' "$BANNER" > /etc/issue.net`},
	},
	"3.1.10": {
		Symbol: symbolNkyinkyim, CommandType: commandTypeLocal, RiskLevel: riskLow,
		Command: []string{"sh", "-c",
			"echo 'readonly TMOUT=900 && export TMOUT' > /etc/profile.d/tmout.sh; chmod 644 /etc/profile.d/tmout.sh"},
	},
	"3.1.11": {
		Symbol: symbolNkyinkyim, CommandType: commandTypeLocal, RiskLevel: riskLow,
		Command: []string{"sh", "-c",
			"grep -q '^ClientAliveInterval' /etc/ssh/sshd_config && " +
				"  sed -i 's/^ClientAliveInterval.*/ClientAliveInterval 600/' /etc/ssh/sshd_config || " +
				"  echo 'ClientAliveInterval 600' >> /etc/ssh/sshd_config; " +
				"grep -q '^ClientAliveCountMax' /etc/ssh/sshd_config && " +
				"  sed -i 's/^ClientAliveCountMax.*/ClientAliveCountMax 0/' /etc/ssh/sshd_config || " +
				"  echo 'ClientAliveCountMax 0' >> /etc/ssh/sshd_config; " +
				"systemctl restart sshd"},
	},
	"3.1.12": {
		Symbol: symbolDwennimmen, CommandType: commandTypeLocal, RiskLevel: riskLow,
		Command: []string{"sh", "-c",
			"systemctl enable --now auditd; " +
				"echo '-w /var/log/lastlog -p wa -k logins' >> /etc/audit/rules.d/session.rules; " +
				"echo '-w /var/run/utmp -p wa -k session' >> /etc/audit/rules.d/session.rules; " +
				"echo '-w /var/log/wtmp -p wa -k logins' >> /etc/audit/rules.d/session.rules; " +
				"echo '-w /var/log/btmp -p wa -k logins' >> /etc/audit/rules.d/session.rules; " +
				"augenrules --load"},
	},
	"3.1.13": {
		Symbol: symbolNkyinkyim, CommandType: commandTypeLocal, RiskLevel: riskMedium,
		Command: []string{"sh", "-c",
			"grep -q '^Ciphers' /etc/ssh/sshd_config && " +
				"  sed -i 's/^Ciphers.*/Ciphers aes256-gcm@openssh.com,aes128-gcm@openssh.com,chacha20-poly1305@openssh.com,aes256-ctr,aes192-ctr,aes128-ctr/' /etc/ssh/sshd_config || " +
				"  echo 'Ciphers aes256-gcm@openssh.com,aes128-gcm@openssh.com,chacha20-poly1305@openssh.com,aes256-ctr,aes192-ctr,aes128-ctr' >> /etc/ssh/sshd_config; " +
				"systemctl restart sshd"},
	},
	"3.1.14": {
		Symbol: symbolNkyinkyim, CommandType: commandTypeLocal, RiskLevel: riskMedium,
		Command: []string{"sh", "-c",
			"grep -q '^PermitRootLogin' /etc/ssh/sshd_config && " +
				"  sed -i 's/^PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config || " +
				"  echo 'PermitRootLogin no' >> /etc/ssh/sshd_config; " +
				"grep -q '^AllowGroups' /etc/ssh/sshd_config || echo 'AllowGroups wheel sshusers' >> /etc/ssh/sshd_config; " +
				"systemctl restart sshd"},
	},
	"3.1.15": {
		Symbol: symbolEban, CommandType: commandTypeLocal, RiskLevel: riskMedium,
		Command: []string{"sh", "-c",
			"for iface in $(ls /sys/class/net/); do " +
				"  if [ -d /sys/class/net/$iface/wireless ] || [ -d /sys/class/net/$iface/phy80211 ]; then " +
				"    ip link set $iface down || true; " +
				"  fi; " +
				"done; " +
				"echo 'Manual step required: configure wpa_supplicant.conf with WPA-EAP or disable wireless NIC in BIOS.'"},
	},
	"3.1.16": {
		Symbol: symbolNkyinkyim, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: wireless policy mandating WPA3-Enterprise (802.1X/EAP); RADIUS server configuration; network diagram showing wireless segregation from CUI-bearing network segments.",
	},
	"3.1.17": {
		Symbol: symbolEban, CommandType: commandTypeLocal, RiskLevel: riskLow,
		Command: []string{"sh", "-c", "systemctl enable --now firewalld || systemctl enable --now iptables"},
	},
	"3.1.18": {
		Symbol: symbolNkyinkyim, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: MDM platform enrollment report (Intune/JAMF) showing all mobile devices with CUI access enrolled and compliant; mobile device policy requiring enrollment before CUI access.",
	},
	"3.1.19": {
		Symbol: symbolEban, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: MDM compliance policy report showing full-disk encryption enforced on all mobile devices; screenshot of encryption enforcement policy from MDM console.",
	},
	"3.1.20": {
		Symbol: symbolNkyinkyim, CommandType: commandTypeLocal, RiskLevel: riskMedium,
		Command: []string{"sh", "-c",
			"firewall-cmd --set-default-zone=drop 2>/dev/null || " +
				"iptables -P OUTPUT DROP && " +
				"iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT && " +
				"iptables -A OUTPUT -p tcp --dport 443 -j ACCEPT && " +
				"iptables -A OUTPUT -p udp --dport 53 -j ACCEPT"},
	},
	"3.1.21": {
		Symbol: symbolEban, CommandType: commandTypeLocal, RiskLevel: riskLow,
		Command: []string{"sh", "-c",
			"echo 'install usb-storage /bin/false' > /etc/modprobe.d/usb-storage.conf; " +
				"echo 'blacklist usb-storage' >> /etc/modprobe.d/usb-storage.conf; " +
				"modprobe -r usb-storage 2>/dev/null || true; " +
				"echo 'USB storage module blacklisted.'"},
	},
	"3.1.22": {
		Symbol: symbolFuntunfunefu, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: data classification policy prohibiting CUI on public-facing systems; web application architecture diagram showing CUI processing occurs only on internal/restricted systems; DLP rule configuration.",
	},

	// ── NIST SP 800-171 Rev 2 — Audit and Accountability (9 controls) ────────

	"3.3.1": {
		Symbol: symbolDwennimmen, CommandType: commandTypeLocal, RiskLevel: riskLow,
		Command: []string{"sh", "-c", "systemctl enable --now auditd"},
	},
	"3.3.2": {
		Symbol: symbolDwennimmen, CommandType: commandTypeLocal, RiskLevel: riskLow,
		Command: []string{"sh", "-c", "systemctl enable auditd; systemctl enable --now auditd"},
	},
	"3.3.3": {
		Symbol: symbolDwennimmen, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: audit event catalog documenting logged event categories; policy defining review frequency; SIEM dashboard screenshot showing event classification.",
	},
	"3.3.4": {
		Symbol: symbolDwennimmen, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: SIEM alert configuration showing automated notification on auditd failure; monitoring dashboard screenshot; escalation procedure for log failure events.",
	},
	"3.3.5": {
		Symbol: symbolDwennimmen, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: SIEM correlation rules documentation; log aggregation platform configuration; analyst workflow for log review and incident triage.",
	},
	"3.3.6": {
		Symbol: symbolDwennimmen, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: log aggregation platform documentation (Splunk, ELK, Graylog); report generation capability demonstration; retention policy showing ≥ 12 months.",
	},
	"3.3.7": {
		Symbol: symbolNkyinkyim, CommandType: commandTypeLocal, RiskLevel: riskLow,
		Command: []string{"sh", "-c",
			"systemctl enable --now chronyd || systemctl enable --now ntpd; " +
				"chronyc tracking 2>/dev/null || ntpq -p 2>/dev/null"},
	},
	"3.3.8": {
		Symbol: symbolDwennimmen, CommandType: commandTypeLocal, RiskLevel: riskLow,
		Command: []string{"sh", "-c",
			"chmod 750 /var/log/audit 2>/dev/null || chmod o-w /var/log; " +
				"chown root:root /var/log/audit 2>/dev/null || true; " +
				"chmod 600 /var/log/audit/audit.log 2>/dev/null || true"},
	},
	"3.3.9": {
		Symbol: symbolDwennimmen, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: RBAC configuration showing audit log management restricted to ISSO/system admin roles; group membership documentation for audit administration.",
	},

	// ── NIST SP 800-171 Rev 2 — Awareness and Training (3 controls) ──────────

	"3.2.1": {
		Symbol: symbolFawohodie, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: security awareness training completion records (within 12 months) for all personnel with CUI access; training content covering social engineering, phishing, and insider threats; LMS screenshot.",
	},
	"3.2.2": {
		Symbol: symbolFawohodie, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: role-based training completion records; training curriculum showing role-specific content for admins, developers, and end users; signed training acknowledgment forms.",
	},
	"3.2.3": {
		Symbol: symbolFawohodie, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: security awareness training program documentation covering threat recognition and reporting procedures; phishing simulation results; incident reporting training content.",
	},

	// ── NIST SP 800-171 Rev 2 — Configuration Management (9 controls) ────────

	"3.4.1": {
		Symbol: symbolNkyinkyim, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: baseline configuration documentation (CMDB or git-managed configuration baseline); configuration comparison report showing current state vs baseline; change management records.",
	},
	"3.4.2": {
		Symbol: symbolNkyinkyim, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: SCAP/OpenSCAP scan results against DISA STIG or CIS benchmark; hardening guide applied with deviation documentation; automated compliance scan reports dated within 30 days.",
	},
	"3.4.3": {
		Symbol: symbolNkyinkyim, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: change management process documentation; change log from ticketing system (JIRA, ServiceNow) showing approval workflow; emergency change procedure.",
	},
	"3.4.4": {
		Symbol: symbolNkyinkyim, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: security impact analysis process documentation; change advisory board meeting minutes; security review checklist completed for significant changes.",
	},
	"3.4.5": {
		Symbol: symbolFawohodie, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: access control policy for configuration management; RBAC documentation showing only authorized personnel have configuration modification access; privileged access review records.",
	},
	"3.4.6": {
		Symbol: symbolEban, CommandType: commandTypeLocal, RiskLevel: riskLow,
		Command: []string{"sh", "-c",
			"systemctl enable --now firewalld; " +
				"firewall-cmd --set-default-zone=drop; " +
				"firewall-cmd --zone=drop --add-service=ssh --permanent; " +
				"firewall-cmd --reload"},
	},
	"3.4.7": {
		Symbol: symbolNkyinkyim, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: software allowlist/denylist policy; application control tool configuration (AppLocker, fapolicyd, SELinux application policy); unauthorized software detection procedure.",
	},
	"3.4.8": {
		Symbol: symbolNkyinkyim, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: deny-by-exception software policy documentation; application control tool (fapolicyd, SELinux, AppArmor) configuration showing default-deny posture for executables.",
	},
	"3.4.9": {
		Symbol: symbolNkyinkyim, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: user-installed software monitoring policy; endpoint software inventory showing no unauthorized applications; MDM or endpoint agent configuration blocking unapproved installs.",
	},

	// ── NIST SP 800-171 Rev 2 — Identification and Authentication (11 controls)

	"3.5.1": {
		Symbol: symbolFawohodie, CommandType: commandTypeLocal, RiskLevel: riskMedium,
		Command: []string{"sh", "-c",
			"awk -F: 'seen[$3]++ && $3!=0 {print $1}' /etc/passwd | " +
				"while read u; do " +
				"  maxuid=$(awk -F: '{print $3}' /etc/passwd | sort -n | tail -1); " +
				"  usermod -u $((maxuid + 1)) \"$u\"; " +
				"done"},
	},
	"3.5.2": {
		Symbol: symbolFawohodie, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: IdP configuration review (LDAP/AD/Okta) or PKI attestation; authentication architecture diagram; certificate authority documentation for device authentication.",
	},
	"3.5.3": {
		Symbol: symbolNkyinkyim, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: MFA configuration documentation (PIV, TOTP, FIDO2 key); screenshot of MFA enforcement policy in IdP; enrollment records for all privileged accounts.",
	},
	"3.5.4": {
		Symbol: symbolNkyinkyim, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: authentication protocol review confirming Kerberos, mutual TLS, or equivalent replay-resistant mechanism; protocol configuration documentation.",
	},
	"3.5.5": {
		Symbol: symbolFawohodie, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: account lifecycle management policy; IAM system configuration showing username reuse controls; account creation and deactivation records.",
	},
	"3.5.6": {
		Symbol: symbolFawohodie, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: credential lifecycle policy (max age, rotation schedule, complexity); password manager or IAM system configuration; expired credential remediation records.",
	},
	"3.5.7": {
		Symbol: symbolNkyinkyim, CommandType: commandTypeLocal, RiskLevel: riskLow,
		Command: []string{"sh", "-c",
			"cat > /etc/security/pwquality.conf << 'EOF'\n" +
				"minlen = 15\n" +
				"dcredit = -1\n" +
				"ucredit = -1\n" +
				"ocredit = -1\n" +
				"lcredit = -1\n" +
				"difok = 8\n" +
				"maxrepeat = 3\n" +
				"EOF"},
	},
	"3.5.8": {
		Symbol: symbolFawohodie, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: identity management system configuration prohibiting username reuse for a defined period; screenshot of IAM policy settings.",
	},
	"3.5.9": {
		Symbol: symbolNkyinkyim, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: IAM/LDAP configuration requiring immediate password change on first login; temporary credential issuance procedure; helpdesk password reset policy.",
	},
	"3.5.10": {
		Symbol: symbolEban, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: /etc/shadow algorithm review (must be SHA-512 or yescrypt); authentication backend configuration showing bcrypt/scrypt/Argon2 for web apps; TLS required for all authentication transport.",
	},
	"3.5.11": {
		Symbol: symbolNkyinkyim, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: terminal configuration review confirming password echo disabled; UI/web application configuration showing masked password entry fields; remote session configuration review.",
	},

	// ── NIST SP 800-171 Rev 2 — Incident Response (3 controls) ──────────────

	"3.6.1": {
		Symbol: symbolFuntunfunefu, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: Incident Response Plan (IRP) document with CISO signature and review date within 12 months; incident handling procedure covering detection, containment, eradication, recovery; contact roster.",
	},
	"3.6.2": {
		Symbol: symbolFuntunfunefu, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: incident tracking system records (JIRA, ServiceNow) with closed incidents; DIBNet/DCSA incident reporting procedure; sample incident report showing proper documentation.",
	},
	"3.6.3": {
		Symbol: symbolFuntunfunefu, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: tabletop exercise after-action report within 12 months; IR capability test results; lessons-learned documentation and plan updates.",
	},

	// ── NIST SP 800-171 Rev 2 — Maintenance (6 controls) ────────────────────

	"3.7.1": {
		Symbol: symbolNkyinkyim, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: maintenance schedule and completed maintenance logs; patch management records showing timely remediation; approved maintenance window documentation.",
	},
	"3.7.2": {
		Symbol: symbolNkyinkyim, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: maintenance tool inventory and authorization policy; access control records for maintenance tooling; tool sanitization procedure after use.",
	},
	"3.7.3": {
		Symbol: symbolEban, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: media sanitization policy (NIST SP 800-88 compliance); sanitization records for equipment removed for maintenance; certificate of sanitization or destruction.",
	},
	"3.7.4": {
		Symbol: symbolEban, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: malware scan records for diagnostic media prior to use; procedure for verifying integrity of maintenance tools; scan logs showing clean results.",
	},
	"3.7.5": {
		Symbol: symbolNkyinkyim, CommandType: commandTypeLocal, RiskLevel: riskMedium,
		Command: []string{"sh", "-c",
			"grep -q '^AuthenticationMethods' /etc/ssh/sshd_config && " +
				"  sed -i 's/^AuthenticationMethods.*/AuthenticationMethods publickey,keyboard-interactive/' /etc/ssh/sshd_config || " +
				"  echo 'AuthenticationMethods publickey,keyboard-interactive' >> /etc/ssh/sshd_config; " +
				"systemctl restart sshd; " +
				"echo 'Manual: configure pam_google_authenticator or pam_u2f for keyboard-interactive factor.'"},
	},
	"3.7.6": {
		Symbol: symbolFawohodie, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: visitor/contractor supervision policy; maintenance personnel access records showing escort requirement; signed maintenance agreements with access restrictions.",
	},

	// ── NIST SP 800-171 Rev 2 — Media Protection (9 controls) ───────────────

	"3.8.1": {
		Symbol: symbolEban, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: media inventory with CUI classification markings; physical and logical protection policy for media; evidence of media stored in locked, access-controlled location.",
	},
	"3.8.2": {
		Symbol: symbolFawohodie, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: media access control policy; access log for media storage; group membership records limiting CUI media access.",
	},
	"3.8.3": {
		Symbol: symbolEban, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: media sanitization procedure per NIST SP 800-88; sanitization completion records; certificates of destruction for physical media.",
	},
	"3.8.4": {
		Symbol: symbolNkyinkyim, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: media labeling policy; physical examples or photos of labeled CUI media; DLP policy for digital CUI labels.",
	},
	"3.8.5": {
		Symbol: symbolEban, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: physical media storage access log; locked cabinet/safe with combination or key control; camera footage access for media storage area.",
	},
	"3.8.6": {
		Symbol: symbolEban, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: removable media encryption policy; AES-256 encrypted USB drive inventory; screenshot of BitLocker/VeraCrypt policy enforcement.",
	},
	"3.8.7": {
		Symbol: symbolEban, CommandType: commandTypeLocal, RiskLevel: riskMedium,
		Command: []string{"sh", "-c",
			"echo 'install usb-storage /bin/false' > /etc/modprobe.d/usb-storage.conf; " +
				"echo 'blacklist usb-storage' >> /etc/modprobe.d/usb-storage.conf; " +
				"modprobe -r usb-storage 2>/dev/null || true"},
	},
	"3.8.8": {
		Symbol: symbolFawohodie, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: removable media registration policy and device inventory; endpoint DLP policy blocking unregistered USB storage; screenshot of endpoint policy enforcement.",
	},
	"3.8.9": {
		Symbol: symbolEban, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: backup encryption policy (AES-256 minimum); backup storage access controls; key management procedure for backup encryption keys.",
	},

	// ── NIST SP 800-171 Rev 2 — Personnel Security (2 controls) ─────────────

	"3.9.1": {
		Symbol: symbolFawohodie, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: background check policy and HR records for all CUI-access personnel; e-QIP or equivalent submission records; adjudication completion records.",
	},
	"3.9.2": {
		Symbol: symbolFawohodie, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: offboarding checklist with account termination verification; CUI return/destruction records; exit interview security reminder documentation.",
	},

	// ── NIST SP 800-171 Rev 2 — Physical Protection (6 controls) ────────────

	"3.10.1": {
		Symbol: symbolEban, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: physical access control system logs; badge reader configuration for CUI server rooms; escort policy for visitors in CUI areas.",
	},
	"3.10.2": {
		Symbol: symbolEban, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: CCTV system coverage map; alarm system configuration; 24/7 monitoring procedure or security guard logs.",
	},
	"3.10.3": {
		Symbol: symbolFawohodie, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: visitor log with escort records; visitor badge issuance procedure; visitor access restriction policy.",
	},
	"3.10.4": {
		Symbol: symbolDwennimmen, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: physical access control system audit log exports; badge reader event logs; annual physical access review records.",
	},
	"3.10.5": {
		Symbol: symbolEban, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: key/badge inventory with issuance and return records; lost/stolen badge procedure; access device lifecycle management policy.",
	},
	"3.10.6": {
		Symbol: symbolNkyinkyim, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: remote work/telework security policy signed by all remote workers; VPN required for CUI access; home office security checklist.",
	},

	// ── NIST SP 800-171 Rev 2 — Risk Assessment (3 controls) ─────────────────

	"3.11.1": {
		Symbol: symbolFuntunfunefu, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: formal risk assessment report dated within 12 months; risk register with CUI-related risks identified; management sign-off on risk acceptance.",
	},
	"3.11.2": {
		Symbol: symbolFuntunfunefu, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: vulnerability scanner output (Tenable, Qualys, OpenVAS) dated within 30 days; scan schedule showing regular cadence; CUI system coverage verification.",
	},
	"3.11.3": {
		Symbol: symbolFuntunfunefu, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: vulnerability remediation tracking records; patch management reports showing completion within SLA; risk-based prioritization justification for any deferred findings.",
	},

	// ── NIST SP 800-171 Rev 2 — Security Assessment (4 controls) ─────────────

	"3.12.1": {
		Symbol: symbolFuntunfunefu, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: security control assessment plan; assessment methodology documentation; assessment results (C3PAO letter or internal assessment report).",
	},
	"3.12.2": {
		Symbol: symbolFuntunfunefu, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: Plan of Action and Milestones (POA&M) document with control deficiencies, POC assignments, and milestone dates; management review records.",
	},
	"3.12.3": {
		Symbol: symbolFuntunfunefu, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: continuous monitoring plan; SIEM/monitoring dashboard screenshot showing ongoing control status; monthly security status reports.",
	},
	"3.12.4": {
		Symbol: symbolFuntunfunefu, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: System Security Plan (SSP) document with last-updated date within 12 months; ISSO signature; change history log showing SSP maintained with system changes.",
	},

	// ── NIST SP 800-171 Rev 2 — System and Communications Protection (16) ────

	"3.13.1": {
		Symbol: symbolEban, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: network architecture diagram showing external boundary protection; perimeter firewall configuration; IDS/IPS deployment at external boundaries.",
	},
	"3.13.2": {
		Symbol: symbolNkyinkyim, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: system architecture documentation showing security-focused design; network segmentation diagram; defense-in-depth layer documentation.",
	},
	"3.13.3": {
		Symbol: symbolNkyinkyim, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: VLAN/network segmentation documentation separating user traffic from system management; management network diagram; jump server or bastion host configuration.",
	},
	"3.13.4": {
		Symbol: symbolNkyinkyim, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: data flow diagram showing CUI flows are isolated and controlled; DLP policy configuration; network ACLs preventing unauthorized cross-segment transfers.",
	},
	"3.13.5": {
		Symbol: symbolEban, CommandType: commandTypeLocal, RiskLevel: riskMedium,
		Command: []string{"sh", "-c",
			"firewall-cmd --new-zone=cui --permanent 2>/dev/null || true; " +
				"firewall-cmd --zone=cui --set-target=DROP --permanent; " +
				"firewall-cmd --zone=public --set-target=DROP --permanent; " +
				"firewall-cmd --reload; " +
				"echo 'Manual step: assign interfaces and services to appropriate zones.'"},
	},
	"3.13.6": {
		Symbol: symbolEban, CommandType: commandTypeLocal, RiskLevel: riskMedium,
		Command: []string{"sh", "-c",
			"firewall-cmd --set-default-zone=drop --permanent; " +
				"firewall-cmd --zone=drop --add-service=ssh --permanent; " +
				"firewall-cmd --reload; " +
				"echo 'Default-deny firewall posture set. Explicitly allow required services.'"},
	},
	"3.13.7": {
		Symbol: symbolNkyinkyim, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: VPN configuration showing split tunneling disabled (all traffic routed through VPN); VPN policy documentation; network traffic capture confirming tunnel enforcement.",
	},
	"3.13.8": {
		Symbol: symbolEban, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: TLS configuration review showing TLS 1.2+ required and weak ciphers disabled; VPN cipher suite documentation; SSL Labs or testssl.sh scan results.",
	},
	"3.13.9": {
		Symbol: symbolNkyinkyim, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: firewall/load-balancer session timeout configuration review; idle timeout policy documentation; application session expiry configuration.",
	},
	"3.13.10": {
		Symbol: symbolEban, CommandType: commandTypeLocal, RiskLevel: riskHigh,
		Command: []string{"sh", "-c", "fips-mode-setup --enable; echo 'Reboot required to activate FIPS mode.'"},
	},
	"3.13.11": {
		Symbol: symbolEban, CommandType: commandTypeLocal, RiskLevel: riskHigh,
		Command: []string{"sh", "-c", "fips-mode-setup --enable; echo 'Reboot required to activate FIPS mode.'"},
	},
	"3.13.12": {
		Symbol: symbolNkyinkyim, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: video conferencing and collaboration tool policy prohibiting automatic camera/microphone activation; endpoint policy disabling webcam/microphone in CUI areas; configuration management record.",
	},
	"3.13.13": {
		Symbol: symbolNkyinkyim, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: mobile code policy (JavaScript, ActiveX, applets); browser security configuration disabling untrusted mobile code; content security policy headers on web applications.",
	},
	"3.13.14": {
		Symbol: symbolNkyinkyim, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: VoIP policy documentation; VoIP system configuration review; traffic isolation between VoIP and data network segments.",
	},
	"3.13.15": {
		Symbol: symbolEban, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: TLS mutual authentication configuration for web sessions; session token entropy and rotation policy; cookie security attributes (HttpOnly, Secure, SameSite) documentation.",
	},
	"3.13.16": {
		Symbol: symbolEban, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: full-disk encryption configuration (LUKS, BitLocker) on all CUI-bearing systems; database encryption configuration; key management procedure for encryption keys at rest.",
	},

	// ── NIST SP 800-171 Rev 2 — System and Information Integrity (7 controls) ─

	"3.14.1": {
		Symbol: symbolNkyinkyim, CommandType: commandTypeLocal, RiskLevel: riskLow,
		Command: []string{"sh", "-c",
			"dnf install -y dnf-automatic 2>/dev/null || apt-get install -y unattended-upgrades 2>/dev/null; " +
				"systemctl enable --now dnf-automatic.timer 2>/dev/null || " +
				"  dpkg-reconfigure --priority=low unattended-upgrades 2>/dev/null"},
	},
	"3.14.2": {
		Symbol: symbolEban, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: antimalware tool deployment records (ClamAV, CrowdStrike, Defender) on all CUI-processing endpoints; real-time protection enabled; scheduled scan configuration.",
	},
	"3.14.3": {
		Symbol: symbolFuntunfunefu, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: threat intelligence subscription records (CISA AIS, ISACs, commercial TI feed); SIEM integration showing automated IOC ingestion; alert response records.",
	},
	"3.14.4": {
		Symbol: symbolNkyinkyim, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: AV/EDR signature update policy and schedule; update logs showing current definitions; auto-update configuration screenshot.",
	},
	"3.14.5": {
		Symbol: symbolNkyinkyim, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: scheduled malware scan configuration; scan logs dated within 7 days; real-time file scan configuration on removable media insertion.",
	},
	"3.14.6": {
		Symbol: symbolFuntunfunefu, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: IDS/IPS or EDR deployment records; alert configuration covering common attack patterns; detection coverage map for CUI systems.",
	},
	"3.14.7": {
		Symbol: symbolFuntunfunefu, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "C3PAO evidence: UEBA or behavioral analytics platform deployment; baseline behavior documentation; anomaly alert records from past 30 days.",
	},

	// ── NIST SP 800-172 — Enhanced Security Requirements (35 controls) ────────

	// AC Enhanced
	"3.1.1e": {
		Symbol: symbolEban, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "Enhanced C3PAO evidence: dual-authorization policy for high-value assets (hardware token + PIN); crypto key access requiring two authorized individuals; PQC key ceremony records.",
	},
	"3.1.2e": {
		Symbol: symbolFawohodie, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "Enhanced C3PAO evidence: system identifier access restricted to privileged accounts in /etc/shadow; kernel keyring access controls; documentation showing no anonymous or shared credential access.",
	},
	"3.1.3e": {
		Symbol: symbolEban, CommandType: commandTypeLocal, RiskLevel: riskHigh,
		Command: []string{"sh", "-c",
			"setenforce 1; sed -i 's/^SELINUX=.*/SELINUX=enforcing/' /etc/selinux/config; " +
				"systemctl enable --now auditd; " +
				"echo 'SELinux enforcing + auditd active = security function isolation enforced.'"},
	},

	// AT Enhanced
	"3.2.1e": {
		Symbol: symbolFawohodie, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "Enhanced C3PAO evidence: APT-specific training content covering MITRE ATT&CK techniques; spear-phishing simulation results with ≥ 90% detection rate; insider threat awareness training completion records.",
	},
	"3.2.2e": {
		Symbol: symbolFawohodie, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "Enhanced C3PAO evidence: role-specific advanced training records (admin: AD attack paths, developer: secure coding against OWASP Top 10, executive: social engineering awareness); red team exercise debrief attendance records.",
	},

	// AU Enhanced
	"3.3.1e": {
		Symbol: symbolDwennimmen, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "Enhanced C3PAO evidence: on-demand query capability demonstration in SIEM; sample ad-hoc forensic investigation report; log retention and retrieval policy showing ≥ 12-month retention with sub-minute query response.",
	},
	"3.3.2e": {
		Symbol: symbolDwennimmen, CommandType: commandTypeLocal, RiskLevel: riskMedium,
		Command: []string{"sh", "-c",
			"curl -s https://packages.wazuh.com/key/GPG-KEY-WAZUH | gpg --dearmor -o /usr/share/keyrings/wazuh.gpg 2>/dev/null; " +
				"echo 'Manual: install and configure Wazuh agent against your Wazuh manager. See https://documentation.wazuh.com/current/installation-guide/'; " +
				"echo 'Staging gate: SIEM agent installation requires human approval before execution.'"},
	},

	// CM Enhanced
	"3.4.1e": {
		Symbol: symbolNkyinkyim, CommandType: commandTypeLocal, RiskLevel: riskMedium,
		Command: []string{"sh", "-c",
			"dnf install -y ansible-core 2>/dev/null || apt-get install -y ansible 2>/dev/null; " +
				"mkdir -p /etc/ansible; " +
				"echo '[defaults]' > /etc/ansible/ansible.cfg; " +
				"echo 'host_key_checking = True' >> /etc/ansible/ansible.cfg; " +
				"echo 'Ansible installed. Manual: configure playbooks and inventory for centralized config management.'"},
	},
	"3.4.2e": {
		Symbol: symbolDwennimmen, CommandType: commandTypeLocal, RiskLevel: riskLow,
		Command: []string{"sh", "-c",
			"dnf install -y aide 2>/dev/null || apt-get install -y aide 2>/dev/null; " +
				"aide --init; " +
				"cp /var/lib/aide/aide.db.new /var/lib/aide/aide.db; " +
				"echo '0 5 * * * root /usr/sbin/aide --check' > /etc/cron.d/aide; " +
				"echo 'AIDE initialized and scheduled for daily integrity checks.'"},
	},

	// IA Enhanced
	"3.5.1e": {
		Symbol: symbolNkyinkyim, CommandType: commandTypeLocal, RiskLevel: riskMedium,
		Command: []string{"sh", "-c",
			"grep -q '^AuthenticationMethods' /etc/ssh/sshd_config && " +
				"  sed -i 's/^AuthenticationMethods.*/AuthenticationMethods publickey,keyboard-interactive/' /etc/ssh/sshd_config || " +
				"  echo 'AuthenticationMethods publickey,keyboard-interactive' >> /etc/ssh/sshd_config; " +
				"systemctl restart sshd; " +
				"echo 'Manual: install and configure pam_google_authenticator or pam_u2f for keyboard-interactive factor.'"},
	},
	"3.5.3e": {
		Symbol: symbolNkyinkyim, CommandType: commandTypeLocal, RiskLevel: riskMedium,
		Command: []string{"sh", "-c",
			"grep -q '^AuthenticationMethods' /etc/ssh/sshd_config && " +
				"  sed -i 's/^AuthenticationMethods.*/AuthenticationMethods publickey,keyboard-interactive/' /etc/ssh/sshd_config || " +
				"  echo 'AuthenticationMethods publickey,keyboard-interactive' >> /etc/ssh/sshd_config; " +
				"systemctl restart sshd; " +
				"echo 'MFA required for all SSH. Manual: enroll non-privileged users in TOTP/FIDO2.'"},
	},

	// IR Enhanced
	"3.6.1e": {
		Symbol: symbolFuntunfunefu, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "Enhanced C3PAO evidence: CIRT charter; tabletop exercise report with APT scenario (within 12 months); IR drill completion records showing ≤ 4-hour containment capability.",
	},
	"3.6.2e": {
		Symbol: symbolFuntunfunefu, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "Enhanced C3PAO evidence: CIRT roster with 24/7 escalation path; CIRT retainer agreement (if outsourced) with ≤ 1-hour response SLA; documentation of last real incident response demonstrating CIRT capability.",
	},

	// MA Enhanced
	"3.7.5e": {
		Symbol: symbolNkyinkyim, CommandType: commandTypeLocal, RiskLevel: riskMedium,
		Command: []string{"sh", "-c",
			"grep -q '^AuthenticationMethods' /etc/ssh/sshd_config && " +
				"  sed -i 's/^AuthenticationMethods.*/AuthenticationMethods publickey,keyboard-interactive/' /etc/ssh/sshd_config || " +
				"  echo 'AuthenticationMethods publickey,keyboard-interactive' >> /etc/ssh/sshd_config; " +
				"grep -q '^ClientAliveInterval' /etc/ssh/sshd_config && " +
				"  sed -i 's/^ClientAliveInterval.*/ClientAliveInterval 600/' /etc/ssh/sshd_config || " +
				"  echo 'ClientAliveInterval 600' >> /etc/ssh/sshd_config; " +
				"grep -q '^ClientAliveCountMax' /etc/ssh/sshd_config && " +
				"  sed -i 's/^ClientAliveCountMax.*/ClientAliveCountMax 0/' /etc/ssh/sshd_config || " +
				"  echo 'ClientAliveCountMax 0' >> /etc/ssh/sshd_config; " +
				"systemctl restart sshd"},
	},

	// MP Enhanced
	"3.8.1e": {
		Symbol: symbolEban, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "Enhanced C3PAO evidence: hardware-encrypted USB device inventory (FIPS 140-2 Level 3 or higher); DLP policy blocking data transfer to non-approved devices; approved device registry with serial numbers.",
	},

	// PS Enhanced
	"3.9.1e": {
		Symbol: symbolFawohodie, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "Enhanced C3PAO evidence: enhanced background investigation records (Tier 3 or Tier 5 equivalent); periodic re-investigation schedule; insider threat program participation records for CUI-access personnel.",
	},

	// PE Enhanced
	"3.10.1e": {
		Symbol: symbolEban, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "Enhanced C3PAO evidence: two-factor physical access control (badge + biometric/PIN) for all CUI server rooms; mantraps/airlocks at high-security areas; physical penetration test results within 24 months.",
	},
	"3.10.2e": {
		Symbol: symbolEban, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "Enhanced C3PAO evidence: remote work security addendum requiring VPN + endpoint security check before CUI access; MDM compliance posture check at session initiation; signed telework security agreement.",
	},

	// RA Enhanced
	"3.11.1e": {
		Symbol: symbolFuntunfunefu, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "Enhanced C3PAO evidence: threat hunting program charter; hunt team activity logs showing proactive searches within 30 days; threat intelligence platform (MISP, ThreatConnect) integration evidence.",
	},
	"3.11.2e": {
		Symbol: symbolFuntunfunefu, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "Enhanced C3PAO evidence: ML/AI-based risk scoring platform deployment (e.g., Darktrace, Vectra, UEBA); automated risk trend report from past 30 days; documented risk prediction model and validation.",
	},
	"3.11.3e": {
		Symbol: symbolFuntunfunefu, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "Enhanced C3PAO evidence: penetration test report within 12 months conducted by independent third party; scope covering all CUI-processing systems; findings remediation tracking with closure evidence.",
	},
	"3.11.4e": {
		Symbol: symbolFuntunfunefu, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "Enhanced C3PAO evidence: EDR/XDR platform deployment (CrowdStrike, SentinelOne, Defender XDR) on all endpoints; APT threat intelligence integration; MITRE ATT&CK coverage mapping report.",
	},

	// CA Enhanced
	"3.12.1e": {
		Symbol: symbolFuntunfunefu, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "Enhanced C3PAO evidence: signed C3PAO engagement letter; independent assessor (not internal staff) conducting assessment review; assessment plan approved by third-party assessor.",
	},

	// SC Enhanced
	"3.13.1e": {
		Symbol: symbolEban, CommandType: commandTypeLocal, RiskLevel: riskHigh,
		Command: []string{"sh", "-c",
			"fips-mode-setup --enable; " +
				"setenforce 1; sed -i 's/^SELINUX=.*/SELINUX=enforcing/' /etc/selinux/config; " +
				"echo 'Reboot required for FIPS activation. SELinux enforcing enabled immediately.'"},
	},
	"3.13.2e": {
		Symbol: symbolEban, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "Enhanced C3PAO evidence: physical network diagram showing CUI systems on isolated physical segments or hypervisor-enforced partitions; cross-segment firewall rules; segmentation test results.",
	},
	"3.13.3e": {
		Symbol: symbolEban, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "Enhanced C3PAO evidence: security kernel documentation (SELinux policy enforcement as reference monitor, or hardware-based security kernel for specialized systems); formal security architecture document identifying trusted computing base.",
	},
	"3.13.4e": {
		Symbol: symbolEban, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "Enhanced C3PAO evidence: system design showing security functions (crypto, key management, authentication) isolated from application functions; HSM deployment records; container/VM isolation configuration.",
	},
	"3.13.5e": {
		Symbol: symbolEban, CommandType: commandTypeLocal, RiskLevel: riskMedium,
		Command: []string{"sh", "-c",
			"echo 'install usb-storage /bin/false' > /etc/modprobe.d/usb-storage.conf; " +
				"echo 'blacklist usb-storage' >> /etc/modprobe.d/usb-storage.conf; " +
				"modprobe -r usb-storage 2>/dev/null || true; " +
				"echo 'USB hardware restriction applied. Manual: document approved hardware allowlist.'"},
	},
	"3.13.6e": {
		Symbol: symbolEban, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "Enhanced C3PAO evidence: network architecture diagram showing ≥ 3 security zones (DMZ, internal, CUI enclave) with firewall enforcing all inter-zone transitions; zone-based policy documentation; micro-segmentation evidence.",
	},

	// SI Enhanced
	"3.14.1e": {
		Symbol: symbolEban, CommandType: commandTypeLocal, RiskLevel: riskHigh,
		Command: []string{"sh", "-c",
			"mokutil --sb-state 2>/dev/null; " +
				"echo 'UEFI Secure Boot must be enabled in firmware settings. If using custom kernel: mokutil --import ca.der to enroll CA.'; " +
				"echo 'Automatic Secure Boot enablement requires firmware-level change — manual UEFI configuration required.'"},
	},
	"3.14.2e": {
		Symbol: symbolDwennimmen, CommandType: commandTypeLocal, RiskLevel: riskLow,
		Command: []string{"sh", "-c",
			"dnf install -y aide 2>/dev/null || apt-get install -y aide 2>/dev/null; " +
				"aide --init 2>/dev/null; " +
				"cp /var/lib/aide/aide.db.new /var/lib/aide/aide.db 2>/dev/null; " +
				"echo '0 3 * * * root /usr/sbin/aide --check 2>&1 | logger -t aide' > /etc/cron.d/aide-check; " +
				"echo 'AIDE behavioral monitoring initialized with daily integrity checks.'"},
	},
	"3.14.3e": {
		Symbol: symbolFuntunfunefu, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "Enhanced C3PAO evidence: ML/AI-based EDR deployment (CrowdStrike Falcon ML, SentinelOne ActiveEDR, Defender Antivirus ML); behavioral detection alert reports from past 30 days; ML model update records.",
	},
	"3.14.4e": {
		Symbol: symbolFuntunfunefu, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "Enhanced C3PAO evidence: honeypot/honeytoken deployment documentation; canary token configuration records; deception technology alert logs showing active monitoring.",
	},
	"3.14.5e": {
		Symbol: symbolFuntunfunefu, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "Enhanced C3PAO evidence: UEBA platform deployment; user behavior baseline documentation; anomaly alert report from past 30 days showing detection of unusual access patterns.",
	},
	"3.14.6e": {
		Symbol: symbolFuntunfunefu, CommandType: commandTypeManual, RiskLevel: riskLow,
		Evidence: "Enhanced C3PAO evidence: SDN or microsegmentation platform documentation (VMware NSX-T, Cisco ACI, OpenDaylight); dynamic policy enforcement demonstration; network segmentation test results.",
	},
}
