package cmmc

// CMMCControl is a single practice in the CMMC control catalog.
// Used by the Phase 03 assessment engine to generate per-control AssessmentFindings.
type CMMCControl struct {
	ID          string    // e.g. "AC.L2-3.1.1"
	Family      string    // e.g. "AC"
	Level       CMMCLevel // 1 or 2 (Level 3 builds on top of Level 2)
	Title       string
	Description string
	NIST171Ref  string // e.g. "3.1.1"
	NIST53Refs  []string
}

// L1Controls returns the 17 CMMC Level 1 practices (FAR 52.204-21 basic safeguarding).
func L1Controls() []CMMCControl {
	return l1Controls
}

// L2Controls returns all 110 CMMC Level 2 practices (NIST SP 800-171 r2).
func L2Controls() []CMMCControl {
	return l2Controls
}

// ControlByID returns a control by its full ID (e.g. "AC.L2-3.1.1").
// Returns the zero value and false if not found.
func ControlByID(id string) (CMMCControl, bool) {
	c, ok := controlIndex[id]
	return c, ok
}

// ControlsForFamily returns all controls for a given family (e.g. "AC").
// Level 0 means all levels.
func ControlsForFamily(family string, level CMMCLevel) []CMMCControl {
	var out []CMMCControl
	for _, c := range l2Controls {
		if c.Family == family && (level == 0 || c.Level <= level) {
			out = append(out, c)
		}
	}
	return out
}

var controlIndex map[string]CMMCControl

func init() {
	controlIndex = make(map[string]CMMCControl, len(l2Controls))
	for _, c := range l2Controls {
		controlIndex[c.ID] = c
	}
}

// =============================================================================
// LEVEL 1 — 17 practices (FAR 52.204-21 basic safeguarding of FCI)
// =============================================================================

var l1Controls = []CMMCControl{
	{ID: "AC.L1-3.1.1", Family: "AC", Level: 1, NIST171Ref: "3.1.1", Title: "Authorized Access Control",
		Description: "Limit information system access to authorized users, processes acting on behalf of authorized users, and devices (including other information systems)."},
	{ID: "AC.L1-3.1.2", Family: "AC", Level: 1, NIST171Ref: "3.1.2", Title: "Transaction and Function Control",
		Description: "Limit information system access to the types of transactions and functions that authorized users are permitted to execute."},
	{ID: "AC.L1-3.1.20", Family: "AC", Level: 1, NIST171Ref: "3.1.20", Title: "External Connections",
		Description: "Verify and control/limit connections to external information systems."},
	{ID: "AC.L1-3.1.22", Family: "AC", Level: 1, NIST171Ref: "3.1.22", Title: "Control Public Information",
		Description: "Control information posted or processed on publicly accessible information systems."},
	{ID: "IA.L1-3.5.1", Family: "IA", Level: 1, NIST171Ref: "3.5.1", Title: "Identification",
		Description: "Identify information system users, processes acting on behalf of users, and devices."},
	{ID: "IA.L1-3.5.2", Family: "IA", Level: 1, NIST171Ref: "3.5.2", Title: "Authentication",
		Description: "Authenticate (or verify) the identities of users, processes, or devices before allowing access."},
	{ID: "MP.L1-3.8.3", Family: "MP", Level: 1, NIST171Ref: "3.8.3", Title: "Media Disposal",
		Description: "Sanitize or destroy information system media containing Federal Contract Information before disposal or reuse."},
	{ID: "PE.L1-3.10.1", Family: "PE", Level: 1, NIST171Ref: "3.10.1", Title: "Limit Physical Access",
		Description: "Limit physical access to organizational information systems, equipment, and the respective operating environments to authorized individuals."},
	{ID: "PE.L1-3.10.3", Family: "PE", Level: 1, NIST171Ref: "3.10.3", Title: "Escort Visitors",
		Description: "Escort visitors and monitor visitor activity."},
	{ID: "PE.L1-3.10.4", Family: "PE", Level: 1, NIST171Ref: "3.10.4", Title: "Audit Physical Access Logs",
		Description: "Maintain audit logs of physical access."},
	{ID: "PE.L1-3.10.5", Family: "PE", Level: 1, NIST171Ref: "3.10.5", Title: "Manage Physical Access Devices",
		Description: "Control and manage physical access devices."},
	{ID: "SC.L1-3.13.1", Family: "SC", Level: 1, NIST171Ref: "3.13.1", Title: "Boundary Protection",
		Description: "Monitor, control, and protect organizational communications at the external boundaries and key internal boundaries of the information system."},
	{ID: "SC.L1-3.13.5", Family: "SC", Level: 1, NIST171Ref: "3.13.5", Title: "Public-Access System Separation",
		Description: "Implement subnetworks for publicly accessible system components that are physically or logically separated from internal networks."},
	{ID: "SI.L1-3.14.1", Family: "SI", Level: 1, NIST171Ref: "3.14.1", Title: "Flaw Remediation",
		Description: "Identify, report, and correct information and information system flaws in a timely manner."},
	{ID: "SI.L1-3.14.2", Family: "SI", Level: 1, NIST171Ref: "3.14.2", Title: "Malicious Code Protection",
		Description: "Provide protection from malicious code at appropriate locations within organizational information systems."},
	{ID: "SI.L1-3.14.4", Family: "SI", Level: 1, NIST171Ref: "3.14.4", Title: "Update Malicious Code Protection",
		Description: "Update malicious code protection mechanisms when new releases are available."},
	{ID: "SI.L1-3.14.5", Family: "SI", Level: 1, NIST171Ref: "3.14.5", Title: "System and File Scanning",
		Description: "Perform periodic scans of the information system and real-time scans of files from external sources as files are downloaded, opened, or executed."},
}

// =============================================================================
// LEVEL 2 — 110 practices (NIST SP 800-171 r2 CUI protection)
// Includes all 17 Level 1 practices plus 93 additional.
// =============================================================================

var l2Controls = append(l1Controls, []CMMCControl{

	// AC — Access Control (22 practices)
	{ID: "AC.L2-3.1.3", Family: "AC", Level: 2, NIST171Ref: "3.1.3", Title: "Control CUI Flow",
		Description: "Control the flow of CUI in accordance with approved authorizations."},
	{ID: "AC.L2-3.1.4", Family: "AC", Level: 2, NIST171Ref: "3.1.4", Title: "Separation of Duties",
		Description: "Separate the duties of individuals to reduce the risk of malevolent activity."},
	{ID: "AC.L2-3.1.5", Family: "AC", Level: 2, NIST171Ref: "3.1.5", Title: "Least Privilege",
		Description: "Employ the principle of least privilege, including for specific security functions and privileged accounts."},
	{ID: "AC.L2-3.1.6", Family: "AC", Level: 2, NIST171Ref: "3.1.6", Title: "Non-Privileged Account Use",
		Description: "Use non-privileged accounts or roles when accessing non-security functions."},
	{ID: "AC.L2-3.1.7", Family: "AC", Level: 2, NIST171Ref: "3.1.7", Title: "Privileged Functions",
		Description: "Prevent non-privileged users from executing privileged functions and capture the execution of such functions in audit logs."},
	{ID: "AC.L2-3.1.8", Family: "AC", Level: 2, NIST171Ref: "3.1.8", Title: "Unsuccessful Logon Attempts",
		Description: "Limit unsuccessful logon attempts."},
	{ID: "AC.L2-3.1.9", Family: "AC", Level: 2, NIST171Ref: "3.1.9", Title: "Privacy and Security Notices",
		Description: "Provide privacy and security notices consistent with CUI rules."},
	{ID: "AC.L2-3.1.10", Family: "AC", Level: 2, NIST171Ref: "3.1.10", Title: "Session Lock",
		Description: "Use session lock with pattern-hiding displays after a period of inactivity."},
	{ID: "AC.L2-3.1.11", Family: "AC", Level: 2, NIST171Ref: "3.1.11", Title: "Session Termination",
		Description: "Terminate (automatically) user sessions after a defined condition."},
	{ID: "AC.L2-3.1.12", Family: "AC", Level: 2, NIST171Ref: "3.1.12", Title: "Control Remote Access",
		Description: "Monitor and control remote access sessions."},
	{ID: "AC.L2-3.1.13", Family: "AC", Level: 2, NIST171Ref: "3.1.13", Title: "Remote Access Confidentiality",
		Description: "Employ cryptographic mechanisms to protect the confidentiality of remote access sessions."},
	{ID: "AC.L2-3.1.14", Family: "AC", Level: 2, NIST171Ref: "3.1.14", Title: "Remote Access Routing",
		Description: "Route remote access via managed access control points."},
	{ID: "AC.L2-3.1.15", Family: "AC", Level: 2, NIST171Ref: "3.1.15", Title: "Privileged Remote Access",
		Description: "Authorize remote execution of privileged commands via remote access only for operational needs."},
	{ID: "AC.L2-3.1.16", Family: "AC", Level: 2, NIST171Ref: "3.1.16", Title: "Wireless Access Authorization",
		Description: "Authorize wireless access prior to allowing connections."},
	{ID: "AC.L2-3.1.17", Family: "AC", Level: 2, NIST171Ref: "3.1.17", Title: "Wireless Access Protection",
		Description: "Protect wireless access using authentication and encryption."},
	{ID: "AC.L2-3.1.18", Family: "AC", Level: 2, NIST171Ref: "3.1.18", Title: "Mobile Device Connection",
		Description: "Control connection of mobile devices."},
	{ID: "AC.L2-3.1.19", Family: "AC", Level: 2, NIST171Ref: "3.1.19", Title: "Encrypt CUI on Mobile",
		Description: "Encrypt CUI on mobile devices and mobile computing platforms."},
	{ID: "AC.L2-3.1.21", Family: "AC", Level: 2, NIST171Ref: "3.1.21", Title: "Portable Storage Use",
		Description: "Limit use of portable storage devices on external systems."},

	// AU — Audit and Accountability (9 practices)
	{ID: "AU.L2-3.3.1", Family: "AU", Level: 2, NIST171Ref: "3.3.1", Title: "System Auditing",
		Description: "Create and retain system audit logs and records to enable the monitoring, analysis, investigation, and reporting of unlawful or unauthorized activity."},
	{ID: "AU.L2-3.3.2", Family: "AU", Level: 2, NIST171Ref: "3.3.2", Title: "User Accountability",
		Description: "Ensure that the actions of individual users can be traced to those users so they can be held accountable for their actions."},
	{ID: "AU.L2-3.3.3", Family: "AU", Level: 2, NIST171Ref: "3.3.3", Title: "Event Review",
		Description: "Review and update logged events."},
	{ID: "AU.L2-3.3.4", Family: "AU", Level: 2, NIST171Ref: "3.3.4", Title: "Audit Failure Alerting",
		Description: "Alert in the event of an audit logging process failure."},
	{ID: "AU.L2-3.3.5", Family: "AU", Level: 2, NIST171Ref: "3.3.5", Title: "Audit Correlation",
		Description: "Correlate audit record review, analysis, and reporting processes for investigation and response to indications of unlawful, unauthorized, suspicious, or unusual activity."},
	{ID: "AU.L2-3.3.6", Family: "AU", Level: 2, NIST171Ref: "3.3.6", Title: "Reduction and Reporting",
		Description: "Provide audit record reduction and report generation to support on-demand analysis and reporting."},
	{ID: "AU.L2-3.3.7", Family: "AU", Level: 2, NIST171Ref: "3.3.7", Title: "Authoritative Time Source",
		Description: "Provide a system capability that compares and synchronizes internal clocks with an authoritative source."},
	{ID: "AU.L2-3.3.8", Family: "AU", Level: 2, NIST171Ref: "3.3.8", Title: "Audit Protection",
		Description: "Protect audit information and audit tools from unauthorized access, modification, and deletion."},
	{ID: "AU.L2-3.3.9", Family: "AU", Level: 2, NIST171Ref: "3.3.9", Title: "Audit Management",
		Description: "Limit management of audit logging to a subset of privileged users."},

	// CM — Configuration Management (9 practices)
	{ID: "CM.L2-3.4.1", Family: "CM", Level: 2, NIST171Ref: "3.4.1", Title: "System Baselining",
		Description: "Establish and maintain baseline configurations and inventories of organizational systems."},
	{ID: "CM.L2-3.4.2", Family: "CM", Level: 2, NIST171Ref: "3.4.2", Title: "Security Configuration Enforcement",
		Description: "Establish and enforce security configuration settings for information technology products employed in organizational systems."},
	{ID: "CM.L2-3.4.3", Family: "CM", Level: 2, NIST171Ref: "3.4.3", Title: "System Change Control",
		Description: "Track, review, approve/disapprove, and log changes to organizational systems."},
	{ID: "CM.L2-3.4.4", Family: "CM", Level: 2, NIST171Ref: "3.4.4", Title: "Security Impact Analysis",
		Description: "Analyze the security impact of changes prior to implementation."},
	{ID: "CM.L2-3.4.5", Family: "CM", Level: 2, NIST171Ref: "3.4.5", Title: "Access Restrictions for Change",
		Description: "Define, document, approve, and enforce physical and logical access restrictions associated with changes to organizational systems."},
	{ID: "CM.L2-3.4.6", Family: "CM", Level: 2, NIST171Ref: "3.4.6", Title: "Least Functionality",
		Description: "Employ the principle of least functionality by configuring organizational systems to provide only essential capabilities."},
	{ID: "CM.L2-3.4.7", Family: "CM", Level: 2, NIST171Ref: "3.4.7", Title: "Nonessential Functionality",
		Description: "Restrict, disable, or prevent the use of nonessential programs, functions, ports, protocols, and services."},
	{ID: "CM.L2-3.4.8", Family: "CM", Level: 2, NIST171Ref: "3.4.8", Title: "Application Execution Policy",
		Description: "Apply deny-by-exception policy to prevent use of unauthorized software."},
	{ID: "CM.L2-3.4.9", Family: "CM", Level: 2, NIST171Ref: "3.4.9", Title: "User-Installed Software",
		Description: "Control and monitor user-installed software."},

	// IA — Identification and Authentication (11 practices)
	{ID: "IA.L2-3.5.3", Family: "IA", Level: 2, NIST171Ref: "3.5.3", Title: "Multifactor Authentication",
		Description: "Use multifactor authentication for local and network access to privileged accounts and for network access to non-privileged accounts."},
	{ID: "IA.L2-3.5.4", Family: "IA", Level: 2, NIST171Ref: "3.5.4", Title: "Replay-Resistant Authentication",
		Description: "Employ replay-resistant authentication mechanisms for network access to privileged and non-privileged accounts."},
	{ID: "IA.L2-3.5.5", Family: "IA", Level: 2, NIST171Ref: "3.5.5", Title: "Identifier Reuse",
		Description: "Employ replay-resistant authentication mechanisms for network access to privileged and non-privileged accounts."},
	{ID: "IA.L2-3.5.6", Family: "IA", Level: 2, NIST171Ref: "3.5.6", Title: "Identifier Handling",
		Description: "Disable identifiers after a defined inactivity period."},
	{ID: "IA.L2-3.5.7", Family: "IA", Level: 2, NIST171Ref: "3.5.7", Title: "Password Complexity",
		Description: "Enforce a minimum password complexity and change of characters when new passwords are created."},
	{ID: "IA.L2-3.5.8", Family: "IA", Level: 2, NIST171Ref: "3.5.8", Title: "Password Reuse",
		Description: "Prohibit password reuse for a specified number of generations."},
	{ID: "IA.L2-3.5.9", Family: "IA", Level: 2, NIST171Ref: "3.5.9", Title: "Temporary Passwords",
		Description: "Allow temporary password use for system logons with an immediate change to a permanent password."},
	{ID: "IA.L2-3.5.10", Family: "IA", Level: 2, NIST171Ref: "3.5.10", Title: "Cryptographically-Protected Passwords",
		Description: "Store and transmit only cryptographically-protected passwords."},
	{ID: "IA.L2-3.5.11", Family: "IA", Level: 2, NIST171Ref: "3.5.11", Title: "Obscure Feedback",
		Description: "Obscure feedback of authentication information."},

	// IR — Incident Response (3 practices)
	{ID: "IR.L2-3.6.1", Family: "IR", Level: 2, NIST171Ref: "3.6.1", Title: "Incident Handling",
		Description: "Establish an operational incident-handling capability for organizational systems."},
	{ID: "IR.L2-3.6.2", Family: "IR", Level: 2, NIST171Ref: "3.6.2", Title: "Incident Reporting",
		Description: "Track, document, and report incidents to designated officials and/or authorities."},
	{ID: "IR.L2-3.6.3", Family: "IR", Level: 2, NIST171Ref: "3.6.3", Title: "Incident Response Testing",
		Description: "Test the organizational incident response capability."},

	// MA — Maintenance (6 practices)
	{ID: "MA.L2-3.7.1", Family: "MA", Level: 2, NIST171Ref: "3.7.1", Title: "Perform Maintenance",
		Description: "Perform maintenance on organizational systems."},
	{ID: "MA.L2-3.7.2", Family: "MA", Level: 2, NIST171Ref: "3.7.2", Title: "System Maintenance Control",
		Description: "Provide controls on the tools, techniques, mechanisms, and personnel that conduct system maintenance."},
	{ID: "MA.L2-3.7.3", Family: "MA", Level: 2, NIST171Ref: "3.7.3", Title: "Equipment Sanitization",
		Description: "Ensure equipment removed for off-site maintenance is sanitized of any CUI."},
	{ID: "MA.L2-3.7.4", Family: "MA", Level: 2, NIST171Ref: "3.7.4", Title: "Media Inspection",
		Description: "Check media containing diagnostic and test programs for malicious code before the media are used in organizational systems."},
	{ID: "MA.L2-3.7.5", Family: "MA", Level: 2, NIST171Ref: "3.7.5", Title: "Nonlocal Maintenance",
		Description: "Require MFA to establish nonlocal maintenance sessions via external networks and terminate such connections when nonlocal maintenance is complete."},
	{ID: "MA.L2-3.7.6", Family: "MA", Level: 2, NIST171Ref: "3.7.6", Title: "Maintenance Personnel",
		Description: "Supervise the maintenance activities of maintenance personnel without required access authorization."},

	// MP — Media Protection (9 practices)
	{ID: "MP.L2-3.8.1", Family: "MP", Level: 2, NIST171Ref: "3.8.1", Title: "Media Protection",
		Description: "Protect system media containing CUI, both paper and digital."},
	{ID: "MP.L2-3.8.2", Family: "MP", Level: 2, NIST171Ref: "3.8.2", Title: "Media Access",
		Description: "Limit access to CUI on system media to authorized users."},
	{ID: "MP.L2-3.8.4", Family: "MP", Level: 2, NIST171Ref: "3.8.4", Title: "Media Markings",
		Description: "Mark media with necessary CUI markings and distribution limitations."},
	{ID: "MP.L2-3.8.5", Family: "MP", Level: 2, NIST171Ref: "3.8.5", Title: "Media Accountability",
		Description: "Control access to media containing CUI and maintain accountability for media during transport."},
	{ID: "MP.L2-3.8.6", Family: "MP", Level: 2, NIST171Ref: "3.8.6", Title: "Portable Storage Encryption",
		Description: "Implement cryptographic mechanisms to protect the confidentiality of CUI during transport unless protected by alternative physical safeguards."},
	{ID: "MP.L2-3.8.7", Family: "MP", Level: 2, NIST171Ref: "3.8.7", Title: "Removable Media Control",
		Description: "Control the use of removable media on system components."},
	{ID: "MP.L2-3.8.8", Family: "MP", Level: 2, NIST171Ref: "3.8.8", Title: "Shared Media",
		Description: "Prohibit the use of portable storage devices when such devices have no identifiable owner."},
	{ID: "MP.L2-3.8.9", Family: "MP", Level: 2, NIST171Ref: "3.8.9", Title: "Protect Backups",
		Description: "Protect the confidentiality of backup CUI at storage locations."},

	// PS — Personnel Security (2 practices)
	{ID: "PS.L2-3.9.1", Family: "PS", Level: 2, NIST171Ref: "3.9.1", Title: "Screen Individuals",
		Description: "Screen individuals prior to authorizing access to organizational systems containing CUI."},
	{ID: "PS.L2-3.9.2", Family: "PS", Level: 2, NIST171Ref: "3.9.2", Title: "Termination and Transfer",
		Description: "Ensure that CUI and organizational systems are protected during and after personnel actions such as terminations and transfers."},

	// RA — Risk Assessment (3 practices)
	{ID: "RA.L2-3.11.1", Family: "RA", Level: 2, NIST171Ref: "3.11.1", Title: "Risk Assessment",
		Description: "Periodically assess the risk to organizational operations, assets, and individuals."},
	{ID: "RA.L2-3.11.2", Family: "RA", Level: 2, NIST171Ref: "3.11.2", Title: "Vulnerability Scan",
		Description: "Scan for vulnerabilities in organizational systems and applications periodically and when new vulnerabilities affecting those systems are identified."},
	{ID: "RA.L2-3.11.3", Family: "RA", Level: 2, NIST171Ref: "3.11.3", Title: "Vulnerability Remediation",
		Description: "Remediate vulnerabilities in accordance with risk assessments."},

	// CA — Security Assessment (4 practices)
	{ID: "CA.L2-3.12.1", Family: "CA", Level: 2, NIST171Ref: "3.12.1", Title: "Security Assessment",
		Description: "Periodically assess the security controls in organizational systems to determine if the controls are effective."},
	{ID: "CA.L2-3.12.2", Family: "CA", Level: 2, NIST171Ref: "3.12.2", Title: "Plan of Action",
		Description: "Develop and implement plans of action to correct deficiencies and reduce or eliminate vulnerabilities."},
	{ID: "CA.L2-3.12.3", Family: "CA", Level: 2, NIST171Ref: "3.12.3", Title: "Security Control Monitoring",
		Description: "Monitor security controls on an ongoing basis to ensure the continued effectiveness of the controls."},
	{ID: "CA.L2-3.12.4", Family: "CA", Level: 2, NIST171Ref: "3.12.4", Title: "System Security Plan",
		Description: "Develop, document, and periodically update system security plans that describe system boundaries, environments of operation, how security requirements are implemented, and the relationships with or connections to other systems."},

	// SC — System and Communications Protection (16 practices)
	{ID: "SC.L2-3.13.2", Family: "SC", Level: 2, NIST171Ref: "3.13.2", Title: "Security Engineering",
		Description: "Employ architectural designs, software development techniques, and systems engineering principles that promote effective information security within organizational systems."},
	{ID: "SC.L2-3.13.3", Family: "SC", Level: 2, NIST171Ref: "3.13.3", Title: "Role Separation",
		Description: "Separate user functionality from system management functionality."},
	{ID: "SC.L2-3.13.4", Family: "SC", Level: 2, NIST171Ref: "3.13.4", Title: "Shared Resource Control",
		Description: "Prevent unauthorized and unintended information transfer via shared system resources."},
	{ID: "SC.L2-3.13.6", Family: "SC", Level: 2, NIST171Ref: "3.13.6", Title: "Network Communication by Exception",
		Description: "Deny network communications traffic by default and allow network communications traffic by exception."},
	{ID: "SC.L2-3.13.7", Family: "SC", Level: 2, NIST171Ref: "3.13.7", Title: "Split Tunneling",
		Description: "Prevent remote devices from simultaneously establishing non-remote connections with the system and communicating via some other connection."},
	{ID: "SC.L2-3.13.8", Family: "SC", Level: 2, NIST171Ref: "3.13.8", Title: "Data in Transit",
		Description: "Implement cryptographic mechanisms to prevent unauthorized disclosure of CUI during transmission."},
	{ID: "SC.L2-3.13.9", Family: "SC", Level: 2, NIST171Ref: "3.13.9", Title: "Connections Termination",
		Description: "Terminate network connections after a defined period of inactivity."},
	{ID: "SC.L2-3.13.10", Family: "SC", Level: 2, NIST171Ref: "3.13.10", Title: "Key Management",
		Description: "Establish and manage cryptographic keys for cryptography employed in organizational systems."},
	{ID: "SC.L2-3.13.11", Family: "SC", Level: 2, NIST171Ref: "3.13.11", Title: "CUI Encryption",
		Description: "Employ FIPS-validated cryptography when used to protect the confidentiality of CUI."},
	{ID: "SC.L2-3.13.12", Family: "SC", Level: 2, NIST171Ref: "3.13.12", Title: "Collaborative Device Control",
		Description: "Prohibit remote activation of collaborative computing devices and provide indication of use to users present at the device."},
	{ID: "SC.L2-3.13.13", Family: "SC", Level: 2, NIST171Ref: "3.13.13", Title: "Mobile Code",
		Description: "Control and monitor the use of mobile code."},
	{ID: "SC.L2-3.13.14", Family: "SC", Level: 2, NIST171Ref: "3.13.14", Title: "VoIP",
		Description: "Control and monitor the use of VoIP technologies."},
	{ID: "SC.L2-3.13.15", Family: "SC", Level: 2, NIST171Ref: "3.13.15", Title: "Communications Authenticity",
		Description: "Protect the authenticity of communications sessions."},
	{ID: "SC.L2-3.13.16", Family: "SC", Level: 2, NIST171Ref: "3.13.16", Title: "Data at Rest",
		Description: "Protect the confidentiality of CUI at rest."},

	// SI — System and Information Integrity (7 practices)
	{ID: "SI.L2-3.14.3", Family: "SI", Level: 2, NIST171Ref: "3.14.3", Title: "Security Alerts",
		Description: "Monitor system security alerts and advisories and take action in response."},
	{ID: "SI.L2-3.14.6", Family: "SI", Level: 2, NIST171Ref: "3.14.6", Title: "Monitor Communications",
		Description: "Monitor organizational systems, including inbound and outbound communications traffic, to detect attacks and indicators of potential attacks."},
	{ID: "SI.L2-3.14.7", Family: "SI", Level: 2, NIST171Ref: "3.14.7", Title: "Identify Unauthorized Use",
		Description: "Identify unauthorized use of organizational systems."},
}...)
