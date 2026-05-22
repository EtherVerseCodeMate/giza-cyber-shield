package soc2

import "time"

// CriteriaFamily represents a SOC 2 Trust Service Criteria family.
type CriteriaFamily string

const (
	FamilyCC CriteriaFamily = "CC" // Common Criteria (Security) — required
	FamilyA  CriteriaFamily = "A"  // Availability
	FamilyPI CriteriaFamily = "PI" // Processing Integrity
	FamilyC  CriteriaFamily = "C"  // Confidentiality
	FamilyP  CriteriaFamily = "P"  // Privacy
)

// ImplementationStatus tracks a control's implementation state.
type ImplementationStatus string

const (
	StatusImplemented    ImplementationStatus = "IMPLEMENTED"
	StatusPartial        ImplementationStatus = "PARTIAL"
	StatusPlanned        ImplementationStatus = "PLANNED"
	StatusNotApplicable  ImplementationStatus = "NOT_APPLICABLE"
	StatusNotImplemented ImplementationStatus = "NOT_IMPLEMENTED"
)

// Criterion is a single SOC 2 Trust Service Criterion.
type Criterion struct {
	ID          string         `json:"id"`           // e.g. "CC6.1"
	Family      CriteriaFamily `json:"family"`
	Title       string         `json:"title"`
	Description string         `json:"description"`
	// NISTMapping lists corresponding NIST 800-53 Rev 5 controls.
	NISTMapping []string `json:"nist_mapping"`
	// CMMCMapping lists corresponding CMMC 2.0 practices.
	CMMCMapping []string `json:"cmmc_mapping"`
}

// ControlImplementation records how the system satisfies a criterion.
type ControlImplementation struct {
	CriterionID string               `json:"criterion_id"`
	Status      ImplementationStatus `json:"status"`
	Narrative   string               `json:"narrative"`
	EvidenceIDs []string             `json:"evidence_ids"`
	Owner       string               `json:"owner"`
	LastReviewed time.Time           `json:"last_reviewed"`
	GapNotes    string               `json:"gap_notes,omitempty"`
}

// Catalog is the full SOC 2 TSC catalog mapped to NIST / CMMC controls.
var Catalog = []Criterion{
	// ── CC1: Control Environment ────────────────────────────────────────────
	{
		ID: "CC1.1", Family: FamilyCC,
		Title:       "Commitment to Integrity and Ethical Values",
		Description: "Management demonstrates a commitment to integrity and ethical values.",
		NISTMapping: []string{"AT-1", "PL-1", "PS-6"},
		CMMCMapping: []string{"AT.L2-3.2.1"},
	},
	{
		ID: "CC1.2", Family: FamilyCC,
		Title:       "Board Independence and Oversight",
		Description: "The board of directors demonstrates independence from management and oversight of the system of internal controls.",
		NISTMapping: []string{"PM-1", "PM-2"},
		CMMCMapping: []string{},
	},
	{
		ID: "CC1.3", Family: FamilyCC,
		Title:       "Organizational Structure and Authority",
		Description: "Management establishes structures, reporting lines, and authorities to pursue objectives.",
		NISTMapping: []string{"PM-2", "PS-2"},
		CMMCMapping: []string{"AC.L2-3.1.1"},
	},
	{
		ID: "CC1.4", Family: FamilyCC,
		Title:       "Commitment to Competence",
		Description: "The organization demonstrates a commitment to attract, develop, and retain competent individuals.",
		NISTMapping: []string{"AT-2", "AT-3", "PS-3"},
		CMMCMapping: []string{"AT.L1-3.2.1", "AT.L1-3.2.2"},
	},
	{
		ID: "CC1.5", Family: FamilyCC,
		Title:       "Accountability for Internal Controls",
		Description: "Management holds individuals accountable for their internal control responsibilities.",
		NISTMapping: []string{"PM-1", "AU-2"},
		CMMCMapping: []string{"AU.L2-3.3.1"},
	},

	// ── CC2: Communication and Information ──────────────────────────────────
	{
		ID: "CC2.1", Family: FamilyCC,
		Title:       "Information Quality for Internal Control",
		Description: "The entity obtains or generates and uses relevant, quality information to support the functioning of internal control.",
		NISTMapping: []string{"AU-6", "SI-12"},
		CMMCMapping: []string{"AU.L2-3.3.2"},
	},
	{
		ID: "CC2.2", Family: FamilyCC,
		Title:       "Internal Communication of Objectives and Responsibilities",
		Description: "The entity internally communicates information, including objectives and responsibilities, necessary to support the functioning of internal control.",
		NISTMapping: []string{"AT-2", "PL-2"},
		CMMCMapping: []string{"AT.L1-3.2.1"},
	},
	{
		ID: "CC2.3", Family: FamilyCC,
		Title:       "External Communication of Relevant Information",
		Description: "The entity communicates with external parties regarding matters affecting the functioning of internal control.",
		NISTMapping: []string{"IR-6", "SA-9"},
		CMMCMapping: []string{"IR.L2-3.6.1"},
	},

	// ── CC3: Risk Assessment ─────────────────────────────────────────────────
	{
		ID: "CC3.1", Family: FamilyCC,
		Title:       "Specification of Objectives",
		Description: "The entity specifies objectives with sufficient clarity to enable the identification and assessment of risks.",
		NISTMapping: []string{"PM-9", "RA-2"},
		CMMCMapping: []string{"RA.L2-3.11.1"},
	},
	{
		ID: "CC3.2", Family: FamilyCC,
		Title:       "Risk Identification and Analysis",
		Description: "The entity identifies risks to the achievement of its objectives across the entity and analyzes risks as a basis for determining how the risks should be managed.",
		NISTMapping: []string{"RA-3", "RA-5", "PM-9"},
		CMMCMapping: []string{"RA.L2-3.11.1", "RA.L2-3.11.2"},
	},
	{
		ID: "CC3.3", Family: FamilyCC,
		Title:       "Fraud Risk Assessment",
		Description: "The entity considers the potential for fraud in assessing risks to the achievement of objectives.",
		NISTMapping: []string{"RA-3", "PM-9"},
		CMMCMapping: []string{"RA.L2-3.11.1"},
	},
	{
		ID: "CC3.4", Family: FamilyCC,
		Title:       "Changes Affecting Internal Control",
		Description: "The entity identifies and assesses changes that could significantly impact the system of internal controls.",
		NISTMapping: []string{"CM-3", "RA-3", "PM-9"},
		CMMCMapping: []string{"CM.L2-3.4.3"},
	},

	// ── CC4: Monitoring Activities ──────────────────────────────────────────
	{
		ID: "CC4.1", Family: FamilyCC,
		Title:       "Selection and Development of Ongoing Evaluations",
		Description: "The entity selects, develops, and performs ongoing and/or separate evaluations to ascertain whether the components of internal control are present and functioning.",
		NISTMapping: []string{"CA-7", "AU-6"},
		CMMCMapping: []string{"CA.L2-3.12.3"},
	},
	{
		ID: "CC4.2", Family: FamilyCC,
		Title:       "Evaluation and Communication of Deficiencies",
		Description: "The entity evaluates and communicates internal control deficiencies in a timely manner to those parties responsible for taking corrective action.",
		NISTMapping: []string{"CA-5", "IR-5", "SI-5"},
		CMMCMapping: []string{"CA.L2-3.12.2"},
	},

	// ── CC5: Control Activities ─────────────────────────────────────────────
	{
		ID: "CC5.1", Family: FamilyCC,
		Title:       "Selection and Development of Control Activities",
		Description: "The entity selects and develops control activities that contribute to the mitigation of risks to the achievement of objectives.",
		NISTMapping: []string{"SA-8", "SC-2", "PM-9"},
		CMMCMapping: []string{"CA.L2-3.12.1"},
	},
	{
		ID: "CC5.2", Family: FamilyCC,
		Title:       "Selection of Technology Controls",
		Description: "The entity selects and develops general control activities over technology to support the achievement of objectives.",
		NISTMapping: []string{"CM-6", "SC-28", "SI-7"},
		CMMCMapping: []string{"CM.L2-3.4.1"},
	},
	{
		ID: "CC5.3", Family: FamilyCC,
		Title:       "Deployment Through Policies and Procedures",
		Description: "The entity deploys control activities through policies that establish what is expected and in procedures that put policies into action.",
		NISTMapping: []string{"PL-4", "PM-1"},
		CMMCMapping: []string{"AC.L1-3.1.1"},
	},

	// ── CC6: Logical and Physical Access Controls ────────────────────────────
	{
		ID: "CC6.1", Family: FamilyCC,
		Title:       "Logical Access Security — Implementation",
		Description: "The entity implements logical access security software, infrastructure, and architectures over protected information assets.",
		NISTMapping: []string{"AC-2", "AC-3", "AC-17", "IA-2", "IA-5"},
		CMMCMapping: []string{"AC.L1-3.1.1", "AC.L2-3.1.5", "IA.L1-3.5.1"},
	},
	{
		ID: "CC6.2", Family: FamilyCC,
		Title:       "Logical Access Security — Prior to Access",
		Description: "Prior to issuing system credentials and granting system access, the entity registers and authorizes new internal and external users.",
		NISTMapping: []string{"AC-2", "IA-2", "IA-8", "PS-4"},
		CMMCMapping: []string{"AC.L1-3.1.1", "IA.L1-3.5.1"},
	},
	{
		ID: "CC6.3", Family: FamilyCC,
		Title:       "Logical Access Security — Role-Based Access",
		Description: "The entity authorizes, modifies, or removes access to data, software, functions, and other protected information assets based on approved and documented access-control rules.",
		NISTMapping: []string{"AC-2", "AC-3", "AC-6"},
		CMMCMapping: []string{"AC.L1-3.1.1", "AC.L2-3.1.3"},
	},
	{
		ID: "CC6.4", Family: FamilyCC,
		Title:       "Physical Access Restrictions",
		Description: "The entity restricts physical access to facilities and protected information assets to authorized personnel.",
		NISTMapping: []string{"PE-2", "PE-3", "PE-6"},
		CMMCMapping: []string{"PE.L1-3.10.1"},
	},
	{
		ID: "CC6.5", Family: FamilyCC,
		Title:       "Logical and Physical Access — Discontinuation",
		Description: "The entity discontinues logical and physical protections over physical assets only after the ability to read or recover data and software has been diminished.",
		NISTMapping: []string{"MP-6", "AC-2"},
		CMMCMapping: []string{"MP.L1-3.8.3"},
	},
	{
		ID: "CC6.6", Family: FamilyCC,
		Title:       "Logical Access Security — External Threats",
		Description: "The entity implements logical access security measures to protect against threats from sources outside its system boundaries.",
		NISTMapping: []string{"SC-7", "AC-17", "CA-3", "SI-3"},
		CMMCMapping: []string{"SC.L1-3.13.1", "SC.L2-3.13.6"},
	},
	{
		ID: "CC6.7", Family: FamilyCC,
		Title:       "Logical Access Security — Transmission and Movement",
		Description: "The entity restricts the transmission, movement, and removal of information to authorized internal and external users.",
		NISTMapping: []string{"SC-8", "SC-12", "SC-13", "MP-5"},
		CMMCMapping: []string{"SC.L2-3.13.8", "SC.L2-3.13.10"},
	},
	{
		ID: "CC6.8", Family: FamilyCC,
		Title:       "Logical Access Security — Malicious Software Prevention",
		Description: "The entity implements controls to prevent or detect and act upon the introduction of unauthorized or malicious software.",
		NISTMapping: []string{"SI-3", "SI-7", "CM-7"},
		CMMCMapping: []string{"SI.L1-3.14.1", "SI.L2-3.14.4"},
	},

	// ── CC7: System Operations ───────────────────────────────────────────────
	{
		ID: "CC7.1", Family: FamilyCC,
		Title:       "Configuration and Vulnerability Management",
		Description: "To meet its objectives, the entity uses detection and monitoring procedures to identify changes to configurations and vulnerabilities.",
		NISTMapping: []string{"CM-6", "RA-5", "SI-2", "CA-7"},
		CMMCMapping: []string{"CM.L2-3.4.1", "RA.L2-3.11.2", "SI.L1-3.14.1"},
	},
	{
		ID: "CC7.2", Family: FamilyCC,
		Title:       "Anomaly and Threat Detection",
		Description: "The entity monitors system components and the operation of those components for anomalies indicative of malicious acts, natural disasters, and errors.",
		NISTMapping: []string{"AU-6", "IR-4", "SI-4"},
		CMMCMapping: []string{"AU.L2-3.3.5", "IR.L2-3.6.1"},
	},
	{
		ID: "CC7.3", Family: FamilyCC,
		Title:       "Incident Evaluation and Escalation",
		Description: "The entity evaluates security events to determine whether they could or have resulted in a failure of the entity to meet its objectives.",
		NISTMapping: []string{"IR-4", "IR-5", "AU-6"},
		CMMCMapping: []string{"IR.L2-3.6.1", "IR.L2-3.6.2"},
	},
	{
		ID: "CC7.4", Family: FamilyCC,
		Title:       "Incident Response",
		Description: "The entity responds to identified security incidents by executing a defined incident-response program to understand, contain, remediate, and communicate security incidents.",
		NISTMapping: []string{"IR-4", "IR-5", "IR-6", "IR-8"},
		CMMCMapping: []string{"IR.L2-3.6.1", "IR.L2-3.6.2", "IR.L2-3.6.3"},
	},
	{
		ID: "CC7.5", Family: FamilyCC,
		Title:       "Post-Incident Recovery",
		Description: "The entity identifies, develops, and implements activities to recover from identified security incidents.",
		NISTMapping: []string{"CP-10", "IR-4", "IR-8"},
		CMMCMapping: []string{"RE.L2-3.9.1", "IR.L2-3.6.1"},
	},

	// ── CC8: Change Management ───────────────────────────────────────────────
	{
		ID: "CC8.1", Family: FamilyCC,
		Title:       "Change Management Process",
		Description: "The entity authorizes, designs, develops or acquires, configures, documents, tests, approves, and implements changes to infrastructure, data, software, and procedures.",
		NISTMapping: []string{"CM-3", "CM-4", "SA-10", "SI-2"},
		CMMCMapping: []string{"CM.L2-3.4.3", "CM.L2-3.4.4"},
	},

	// ── CC9: Risk Mitigation ─────────────────────────────────────────────────
	{
		ID: "CC9.1", Family: FamilyCC,
		Title:       "Risk Mitigation Activities",
		Description: "The entity identifies, selects, and develops risk mitigation activities for risks arising from potential business disruptions.",
		NISTMapping: []string{"CP-2", "CP-4", "RA-3"},
		CMMCMapping: []string{"RE.L2-3.9.1", "RA.L2-3.11.1"},
	},
	{
		ID: "CC9.2", Family: FamilyCC,
		Title:       "Vendor and Business Partner Risk Management",
		Description: "The entity assesses and manages risks associated with vendors and business partners.",
		NISTMapping: []string{"SA-9", "SR-3", "SR-5"},
		CMMCMapping: []string{"SR.L2-3.17.1", "SR.L2-3.17.2"},
	},

	// ── A (Availability) ─────────────────────────────────────────────────────
	{
		ID: "A1.1", Family: FamilyA,
		Title:       "Availability — Capacity Management",
		Description: "The entity maintains, monitors, and evaluates current processing capacity and use of system components including infrastructure, data, and software.",
		NISTMapping: []string{"CP-2", "SA-8"},
		CMMCMapping: []string{"RE.L2-3.9.1"},
	},
	{
		ID: "A1.2", Family: FamilyA,
		Title:       "Availability — Environmental Protections",
		Description: "The entity authorizes, designs, develops or acquires, implements, operates, approves, maintains, and monitors environmental protections, software, data back-up processes, and recovery infrastructure.",
		NISTMapping: []string{"CP-6", "CP-7", "PE-9", "PE-12"},
		CMMCMapping: []string{"RE.L2-3.9.1", "RE.L2-3.9.2"},
	},
	{
		ID: "A1.3", Family: FamilyA,
		Title:       "Availability — Recovery Plan Testing",
		Description: "The entity tests recovery plan procedures supporting system availability.",
		NISTMapping: []string{"CP-4", "CP-9"},
		CMMCMapping: []string{"RE.L2-3.9.2"},
	},

	// ── PI (Processing Integrity) ─────────────────────────────────────────────
	{
		ID: "PI1.1", Family: FamilyPI,
		Title:       "Processing Integrity — Complete and Accurate Processing",
		Description: "The entity obtains or generates, uses, and communicates relevant, quality information regarding the objectives related to processing.",
		NISTMapping: []string{"SI-10", "SI-12"},
		CMMCMapping: []string{"SI.L2-3.14.6"},
	},
	{
		ID: "PI1.2", Family: FamilyPI,
		Title:       "Processing Integrity — System Inputs",
		Description: "The entity implements policies and procedures over system inputs, including controls over completeness and accuracy.",
		NISTMapping: []string{"SI-10", "SA-8"},
		CMMCMapping: []string{"SI.L2-3.14.6"},
	},
	{
		ID: "PI1.3", Family: FamilyPI,
		Title:       "Processing Integrity — System Processing",
		Description: "The entity implements policies and procedures over system processing to result in products, services, and reporting to meet the entity's objectives.",
		NISTMapping: []string{"SI-7", "SA-8"},
		CMMCMapping: []string{"SI.L1-3.14.1"},
	},
	{
		ID: "PI1.4", Family: FamilyPI,
		Title:       "Processing Integrity — System Outputs",
		Description: "The entity implements policies and procedures to make available or deliver output completely, accurately, and timely.",
		NISTMapping: []string{"SI-12", "AU-9"},
		CMMCMapping: []string{},
	},
	{
		ID: "PI1.5", Family: FamilyPI,
		Title:       "Processing Integrity — Stored Items",
		Description: "The entity implements policies and procedures to store inputs, items in processing, and outputs completely, accurately, and timely.",
		NISTMapping: []string{"SI-12", "AU-9", "SC-28"},
		CMMCMapping: []string{"MP.L1-3.8.1"},
	},

	// ── C (Confidentiality) ───────────────────────────────────────────────────
	{
		ID: "C1.1", Family: FamilyC,
		Title:       "Confidentiality — Identification and Maintenance",
		Description: "The entity identifies and maintains confidential information to meet the entity's objectives related to confidentiality.",
		NISTMapping: []string{"RA-2", "SC-28", "MP-3"},
		CMMCMapping: []string{"MP.L1-3.8.1", "RA.L2-3.11.2"},
	},
	{
		ID: "C1.2", Family: FamilyC,
		Title:       "Confidentiality — Disposal",
		Description: "The entity disposes of confidential information to meet the entity's objectives related to confidentiality.",
		NISTMapping: []string{"MP-6", "SI-12"},
		CMMCMapping: []string{"MP.L1-3.8.3"},
	},
}
