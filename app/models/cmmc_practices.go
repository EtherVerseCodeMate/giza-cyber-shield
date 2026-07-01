package models

// CMMCDomain describes one of the 14 CMMC Level 2 control families.
type CMMCDomain struct {
	Code          string
	Name          string
	PracticeCount int
}

// CMMCDomains is the authoritative list of 14 CMMC L2 control families.
// Source: CMMC Assessment Guide Level 2 V2.0 FINAL / NIST SP 800-171r3.
// Practice counts per Appendix A of CMMC_Quran_v2.md.
var CMMCDomains = []CMMCDomain{
	{Code: "AC", Name: "Access Control", PracticeCount: 22},
	{Code: "AT", Name: "Awareness & Training", PracticeCount: 3},
	{Code: "AU", Name: "Audit & Accountability", PracticeCount: 9},
	{Code: "CM", Name: "Configuration Management", PracticeCount: 9},
	{Code: "IA", Name: "Identification & Authentication", PracticeCount: 11},
	{Code: "IR", Name: "Incident Response", PracticeCount: 3},
	{Code: "MA", Name: "Maintenance", PracticeCount: 6},
	{Code: "MP", Name: "Media Protection", PracticeCount: 9},
	{Code: "PE", Name: "Physical & Environmental Protection", PracticeCount: 6},
	{Code: "PS", Name: "Personnel Security", PracticeCount: 2},
	{Code: "RA", Name: "Risk Assessment", PracticeCount: 5},
	{Code: "CA", Name: "Security Assessment", PracticeCount: 4},
	{Code: "SC", Name: "System & Comms Protection", PracticeCount: 16},
	{Code: "SI", Name: "System & Info Integrity", PracticeCount: 7},
}

// CMMCPractice holds a single CMMC Level 2 practice definition.
// Total: 110 practices per NIST SP 800-171r3.
// SPRS weights: 5 = high-impact (AC, IA, SC, SI), 3 = moderate, 1 = low.
type CMMCPractice struct {
	ID          string // e.g. "AC.L2-3.1.1"
	DomainCode  string // e.g. "AC"
	Description string
	SPRSWeight  int
}

// AllPractices is the complete, ordered list of 110 CMMC L2 practices with SPRS weights.
// Source: CMMC_Quran_v2.md Appendix A (independently verified against CMMC AG L2 V2.0 FINAL).
// SPRS score = 110 − Σ(weight × count_not_met_per_weight). See Appendix B.
var AllPractices = []CMMCPractice{
	// Access Control — 22 practices
	{ID: "AC.L2-3.1.1", DomainCode: "AC", Description: "Limit system access to authorized users", SPRSWeight: 5},
	{ID: "AC.L2-3.1.2", DomainCode: "AC", Description: "Limit system access to authorized transactions and functions", SPRSWeight: 5},
	{ID: "AC.L2-3.1.3", DomainCode: "AC", Description: "Control the flow of CUI per approved authorizations", SPRSWeight: 3},
	{ID: "AC.L2-3.1.4", DomainCode: "AC", Description: "Separate the duties of individuals to reduce risk of malevolent activity", SPRSWeight: 3},
	{ID: "AC.L2-3.1.5", DomainCode: "AC", Description: "Employ the principle of least privilege", SPRSWeight: 5},
	{ID: "AC.L2-3.1.6", DomainCode: "AC", Description: "Use non-privileged accounts for non-security functions", SPRSWeight: 1},
	{ID: "AC.L2-3.1.7", DomainCode: "AC", Description: "Prevent non-privileged users from executing privileged functions", SPRSWeight: 3},
	{ID: "AC.L2-3.1.8", DomainCode: "AC", Description: "Limit unsuccessful logon attempts", SPRSWeight: 3},
	{ID: "AC.L2-3.1.9", DomainCode: "AC", Description: "Provide privacy and security notices consistent with CUI rules", SPRSWeight: 1},
	{ID: "AC.L2-3.1.10", DomainCode: "AC", Description: "Use session lock with pattern-hiding displays after inactivity", SPRSWeight: 1},
	{ID: "AC.L2-3.1.11", DomainCode: "AC", Description: "Terminate sessions after defined conditions", SPRSWeight: 1},
	{ID: "AC.L2-3.1.12", DomainCode: "AC", Description: "Monitor and control remote access sessions", SPRSWeight: 3},
	{ID: "AC.L2-3.1.13", DomainCode: "AC", Description: "Employ cryptographic mechanisms to protect confidentiality of remote access sessions", SPRSWeight: 5},
	{ID: "AC.L2-3.1.14", DomainCode: "AC", Description: "Route remote access via managed access control points", SPRSWeight: 3},
	{ID: "AC.L2-3.1.15", DomainCode: "AC", Description: "Authorize remote execution of privileged commands via remote access only for operational needs", SPRSWeight: 3},
	{ID: "AC.L2-3.1.16", DomainCode: "AC", Description: "Authorize wireless access prior to allowing connections", SPRSWeight: 3},
	{ID: "AC.L2-3.1.17", DomainCode: "AC", Description: "Protect wireless access using authentication and encryption", SPRSWeight: 5},
	{ID: "AC.L2-3.1.18", DomainCode: "AC", Description: "Control connection of mobile devices", SPRSWeight: 3},
	{ID: "AC.L2-3.1.19", DomainCode: "AC", Description: "Encrypt CUI on mobile devices and mobile computing platforms", SPRSWeight: 5},
	{ID: "AC.L2-3.1.20", DomainCode: "AC", Description: "Verify and control connections to external systems", SPRSWeight: 3},
	{ID: "AC.L2-3.1.21", DomainCode: "AC", Description: "Limit use of portable storage devices on external systems", SPRSWeight: 1},
	{ID: "AC.L2-3.1.22", DomainCode: "AC", Description: "Control CUI posted or processed on publicly accessible systems", SPRSWeight: 3},

	// Awareness and Training — 3 practices
	{ID: "AT.L2-3.2.1", DomainCode: "AT", Description: "Ensure personnel are aware of security risks associated with their activities", SPRSWeight: 3},
	{ID: "AT.L2-3.2.2", DomainCode: "AT", Description: "Ensure personnel are trained to carry out assigned responsibilities", SPRSWeight: 3},
	{ID: "AT.L2-3.2.3", DomainCode: "AT", Description: "Provide security awareness training on recognizing and reporting threats", SPRSWeight: 3},

	// Audit and Accountability — 9 practices
	{ID: "AU.L2-3.3.1", DomainCode: "AU", Description: "Create and retain system audit logs to enable monitoring, analysis, investigation, and reporting", SPRSWeight: 5},
	{ID: "AU.L2-3.3.2", DomainCode: "AU", Description: "Ensure individual accountability through unique identification", SPRSWeight: 3},
	{ID: "AU.L2-3.3.3", DomainCode: "AU", Description: "Review and update logged events", SPRSWeight: 3},
	{ID: "AU.L2-3.3.4", DomainCode: "AU", Description: "Alert in the event of an audit logging process failure", SPRSWeight: 3},
	{ID: "AU.L2-3.3.5", DomainCode: "AU", Description: "Correlate audit record review, analysis, and reporting processes", SPRSWeight: 3},
	{ID: "AU.L2-3.3.6", DomainCode: "AU", Description: "Provide audit record reduction and report generation", SPRSWeight: 1},
	{ID: "AU.L2-3.3.7", DomainCode: "AU", Description: "Provide a system capability that compares and synchronizes time clocks", SPRSWeight: 1},
	{ID: "AU.L2-3.3.8", DomainCode: "AU", Description: "Protect audit information and tools from unauthorized access, modification, and deletion", SPRSWeight: 3},
	{ID: "AU.L2-3.3.9", DomainCode: "AU", Description: "Limit management of audit logging to a subset of privileged users", SPRSWeight: 1},

	// Configuration Management — 9 practices
	{ID: "CM.L2-3.4.1", DomainCode: "CM", Description: "Establish and maintain baseline configurations for organizational systems", SPRSWeight: 3},
	{ID: "CM.L2-3.4.2", DomainCode: "CM", Description: "Establish and enforce security configuration settings", SPRSWeight: 3},
	{ID: "CM.L2-3.4.3", DomainCode: "CM", Description: "Track, review, approve, and log changes to organizational systems", SPRSWeight: 3},
	{ID: "CM.L2-3.4.4", DomainCode: "CM", Description: "Analyze the security impact of changes prior to implementation", SPRSWeight: 3},
	{ID: "CM.L2-3.4.5", DomainCode: "CM", Description: "Define, document, approve, and enforce physical and logical access restrictions", SPRSWeight: 1},
	{ID: "CM.L2-3.4.6", DomainCode: "CM", Description: "Employ the principle of least functionality", SPRSWeight: 3},
	{ID: "CM.L2-3.4.7", DomainCode: "CM", Description: "Restrict, disable, or prevent the use of nonessential programs, functions, ports, protocols, and services", SPRSWeight: 3},
	{ID: "CM.L2-3.4.8", DomainCode: "CM", Description: "Apply deny-by-exception policy to prevent use of unauthorized software", SPRSWeight: 3},
	{ID: "CM.L2-3.4.9", DomainCode: "CM", Description: "Control and monitor user-installed software", SPRSWeight: 3},

	// Identification and Authentication — 11 practices
	{ID: "IA.L2-3.5.1", DomainCode: "IA", Description: "Identify system users, processes, and devices", SPRSWeight: 5},
	{ID: "IA.L2-3.5.2", DomainCode: "IA", Description: "Authenticate (or verify) the identities of users, processes, or devices", SPRSWeight: 5},
	{ID: "IA.L2-3.5.3", DomainCode: "IA", Description: "Use multifactor authentication for local, network, and remote access", SPRSWeight: 5},
	{ID: "IA.L2-3.5.4", DomainCode: "IA", Description: "Employ replay-resistant authentication mechanisms", SPRSWeight: 3},
	{ID: "IA.L2-3.5.5", DomainCode: "IA", Description: "Employ identifier management", SPRSWeight: 3},
	{ID: "IA.L2-3.5.6", DomainCode: "IA", Description: "Employ authenticator management", SPRSWeight: 3},
	{ID: "IA.L2-3.5.7", DomainCode: "IA", Description: "Enforce a minimum password complexity and change of characters", SPRSWeight: 3},
	{ID: "IA.L2-3.5.8", DomainCode: "IA", Description: "Prohibit password reuse for a specified number of generations", SPRSWeight: 1},
	{ID: "IA.L2-3.5.9", DomainCode: "IA", Description: "Allow temporary password use with an immediate change requirement", SPRSWeight: 1},
	{ID: "IA.L2-3.5.10", DomainCode: "IA", Description: "Store and transmit only cryptographically protected passwords", SPRSWeight: 5},
	{ID: "IA.L2-3.5.11", DomainCode: "IA", Description: "Obscure feedback of authentication information", SPRSWeight: 1},

	// Incident Response — 3 practices
	{ID: "IR.L2-3.6.1", DomainCode: "IR", Description: "Establish an operational incident-handling capability", SPRSWeight: 3},
	{ID: "IR.L2-3.6.2", DomainCode: "IR", Description: "Track, document, and report incidents to appropriate officials", SPRSWeight: 3},
	{ID: "IR.L2-3.6.3", DomainCode: "IR", Description: "Test the organizational incident response capability", SPRSWeight: 3},

	// Maintenance — 6 practices
	{ID: "MA.L2-3.7.1", DomainCode: "MA", Description: "Perform maintenance on organizational systems", SPRSWeight: 3},
	{ID: "MA.L2-3.7.2", DomainCode: "MA", Description: "Provide controls on tools, techniques, mechanisms, and personnel for maintenance", SPRSWeight: 3},
	{ID: "MA.L2-3.7.3", DomainCode: "MA", Description: "Ensure equipment removed for maintenance is sanitized", SPRSWeight: 3},
	{ID: "MA.L2-3.7.4", DomainCode: "MA", Description: "Check media containing diagnostic and test programs for malicious code", SPRSWeight: 3},
	{ID: "MA.L2-3.7.5", DomainCode: "MA", Description: "Require MFA for remote maintenance sessions", SPRSWeight: 3},
	{ID: "MA.L2-3.7.6", DomainCode: "MA", Description: "Supervise the maintenance activities of personnel without required access authorization", SPRSWeight: 3},

	// Media Protection — 9 practices
	{ID: "MP.L2-3.8.1", DomainCode: "MP", Description: "Protect system media containing CUI, both paper and digital", SPRSWeight: 3},
	{ID: "MP.L2-3.8.2", DomainCode: "MP", Description: "Limit access to CUI on system media to authorized users", SPRSWeight: 3},
	{ID: "MP.L2-3.8.3", DomainCode: "MP", Description: "Sanitize or destroy system media before disposal or reuse", SPRSWeight: 3},
	{ID: "MP.L2-3.8.4", DomainCode: "MP", Description: "Mark media with necessary CUI markings and distribution limitations", SPRSWeight: 1},
	{ID: "MP.L2-3.8.5", DomainCode: "MP", Description: "Control access to media containing CUI and maintain accountability", SPRSWeight: 1},
	{ID: "MP.L2-3.8.6", DomainCode: "MP", Description: "Implement cryptographic mechanisms to protect CUI during transport", SPRSWeight: 3},
	{ID: "MP.L2-3.8.7", DomainCode: "MP", Description: "Control the use of removable media on system components", SPRSWeight: 3},
	{ID: "MP.L2-3.8.8", DomainCode: "MP", Description: "Prohibit the use of portable storage devices when there is no identifiable owner", SPRSWeight: 1},
	{ID: "MP.L2-3.8.9", DomainCode: "MP", Description: "Protect the confidentiality of backup CUI at storage locations", SPRSWeight: 3},

	// Physical and Environmental Protection — 6 practices
	{ID: "PE.L2-3.10.1", DomainCode: "PE", Description: "Limit physical access to CUI systems to authorized individuals", SPRSWeight: 3},
	{ID: "PE.L2-3.10.2", DomainCode: "PE", Description: "Protect and monitor the physical facility and support infrastructure", SPRSWeight: 3},
	{ID: "PE.L2-3.10.3", DomainCode: "PE", Description: "Escort visitors and monitor visitor activity", SPRSWeight: 1},
	{ID: "PE.L2-3.10.4", DomainCode: "PE", Description: "Maintain audit logs of physical access", SPRSWeight: 1},
	{ID: "PE.L2-3.10.5", DomainCode: "PE", Description: "Control and manage physical access devices", SPRSWeight: 1},
	{ID: "PE.L2-3.10.6", DomainCode: "PE", Description: "Enforce safeguarding measures for CUI at alternate work sites", SPRSWeight: 3},

	// Personnel Security — 2 practices
	{ID: "PS.L2-3.9.1", DomainCode: "PS", Description: "Screen individuals prior to authorizing access to CUI", SPRSWeight: 3},
	{ID: "PS.L2-3.9.2", DomainCode: "PS", Description: "Ensure that CUI is protected during and after personnel actions", SPRSWeight: 3},

	// Risk Assessment — 5 practices
	{ID: "RA.L2-3.11.1", DomainCode: "RA", Description: "Periodically assess the risk to organizational operations and assets", SPRSWeight: 3},
	{ID: "RA.L2-3.11.2", DomainCode: "RA", Description: "Scan for vulnerabilities in organizational systems and applications periodically", SPRSWeight: 5},
	{ID: "RA.L2-3.11.3", DomainCode: "RA", Description: "Remediate vulnerabilities in accordance with risk assessments", SPRSWeight: 3},
	{ID: "RA.L2-3.11.4", DomainCode: "RA", Description: "Periodically assess the risk of supply chain threats", SPRSWeight: 3},
	{ID: "RA.L2-3.11.5", DomainCode: "RA", Description: "Update risk assessment findings when significant changes occur", SPRSWeight: 3},

	// Security Assessment — 4 practices
	{ID: "CA.L2-3.12.1", DomainCode: "CA", Description: "Periodically assess the security controls in organizational systems", SPRSWeight: 3},
	{ID: "CA.L2-3.12.2", DomainCode: "CA", Description: "Develop and implement plans of action designed to correct deficiencies", SPRSWeight: 3},
	{ID: "CA.L2-3.12.3", DomainCode: "CA", Description: "Monitor security controls on an ongoing basis", SPRSWeight: 3},
	{ID: "CA.L2-3.12.4", DomainCode: "CA", Description: "Develop, document, and periodically update system security plans", SPRSWeight: 3},

	// System and Communications Protection — 16 practices
	{ID: "SC.L2-3.13.1", DomainCode: "SC", Description: "Monitor, control, and protect communications at external boundaries and key internal boundaries", SPRSWeight: 5},
	{ID: "SC.L2-3.13.2", DomainCode: "SC", Description: "Employ architectural designs, software development techniques, and systems engineering principles", SPRSWeight: 3},
	{ID: "SC.L2-3.13.3", DomainCode: "SC", Description: "Separate user functionality from system management functionality", SPRSWeight: 3},
	{ID: "SC.L2-3.13.4", DomainCode: "SC", Description: "Prevent unauthorized and unintended information transfer", SPRSWeight: 3},
	{ID: "SC.L2-3.13.5", DomainCode: "SC", Description: "Implement subnetworks for publicly accessible system components", SPRSWeight: 5},
	{ID: "SC.L2-3.13.6", DomainCode: "SC", Description: "Deny network communications traffic by default and allow by exception", SPRSWeight: 5},
	{ID: "SC.L2-3.13.7", DomainCode: "SC", Description: "Prevent remote devices from simultaneously connecting to the system and other resources", SPRSWeight: 3},
	{ID: "SC.L2-3.13.8", DomainCode: "SC", Description: "Implement cryptographic mechanisms to prevent unauthorized disclosure of CUI during transmission", SPRSWeight: 5},
	{ID: "SC.L2-3.13.9", DomainCode: "SC", Description: "Terminate network connections after a defined period of inactivity", SPRSWeight: 3},
	{ID: "SC.L2-3.13.10", DomainCode: "SC", Description: "Establish and manage cryptographic keys for required cryptography", SPRSWeight: 3},
	{ID: "SC.L2-3.13.11", DomainCode: "SC", Description: "Employ FIPS-validated cryptography when used to protect CUI", SPRSWeight: 5},
	{ID: "SC.L2-3.13.12", DomainCode: "SC", Description: "Prohibit remote activation of collaborative computing devices and provide indication of use", SPRSWeight: 3},
	{ID: "SC.L2-3.13.13", DomainCode: "SC", Description: "Control and monitor the use of mobile code", SPRSWeight: 3},
	{ID: "SC.L2-3.13.14", DomainCode: "SC", Description: "Control and monitor the use of VoIP technologies", SPRSWeight: 1},
	{ID: "SC.L2-3.13.15", DomainCode: "SC", Description: "Protect the authenticity of communications sessions", SPRSWeight: 3},
	{ID: "SC.L2-3.13.16", DomainCode: "SC", Description: "Protect CUI at rest", SPRSWeight: 5},

	// System and Information Integrity — 7 practices
	{ID: "SI.L2-3.14.1", DomainCode: "SI", Description: "Identify, report, and correct system flaws in a timely manner", SPRSWeight: 3},
	{ID: "SI.L2-3.14.2", DomainCode: "SI", Description: "Provide protection from malicious code at appropriate locations within systems", SPRSWeight: 5},
	{ID: "SI.L2-3.14.3", DomainCode: "SI", Description: "Monitor system security alerts and advisories", SPRSWeight: 3},
	{ID: "SI.L2-3.14.4", DomainCode: "SI", Description: "Update malicious code protection mechanisms", SPRSWeight: 3},
	{ID: "SI.L2-3.14.5", DomainCode: "SI", Description: "Perform periodic scans of the system and real-time scans of files", SPRSWeight: 5},
	{ID: "SI.L2-3.14.6", DomainCode: "SI", Description: "Monitor organizational systems to detect attacks and indicators of potential attacks", SPRSWeight: 5},
	{ID: "SI.L2-3.14.7", DomainCode: "SI", Description: "Identify unauthorized use of organizational systems", SPRSWeight: 5},
}

// PracticeByID returns the practice definition for the given practice ID, or nil.
func PracticeByID(id string) *CMMCPractice {
	for i := range AllPractices {
		if AllPractices[i].ID == id {
			return &AllPractices[i]
		}
	}
	return nil
}

// DomainByCode returns the domain definition for the given two-letter code, or nil.
func DomainByCode(code string) *CMMCDomain {
	for i := range CMMCDomains {
		if CMMCDomains[i].Code == code {
			return &CMMCDomains[i]
		}
	}
	return nil
}
