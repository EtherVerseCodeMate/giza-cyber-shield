// Package cmmc implements the Discovery-Driven CMMC Autopilot information model.
//
// FHIR R4 mapping:
//   Engagement        → ServiceRequest
//   GovernedAsset     → Device
//   BoundaryProposal  → DiagnosticReport (pre-approval)
//   BoundaryApproval  → Consent (PQC signed)
//   AssessmentFinding → Observation
//   POAMItem          → CarePlan.activity
//   AuditPackage      → Bundle (type: document)
//
// SMART-on-KHEPRA roles (Adinkra symbols as OAuth2 scope analogs):
//   Chokmah    → CONSULTANT        (Phase 00: seed intake, discovery trigger)
//   Eban       → AUDITOR           (read-only observer across all phases)
//   Nkyinkyim  → OPERATOR          (Phase 03-04: executes remediation)
//   Dwennimmen → COMPLIANCE_OFFICER (Phase 02: sole role that may sign boundary)
//   Fawohodie  → ENGINEER          (Phase 03-04: implements controls)
package cmmc

import (
	"time"
)

// =============================================================================
// CORE ENUMERATIONS
// =============================================================================

// CMMCLevel is the target maturity level for the assessment.
type CMMCLevel int

const (
	CMMCLevel1 CMMCLevel = 1 // 17 practices — FAR 52.204-21 (FCI)
	CMMCLevel2 CMMCLevel = 2 // 110 practices — NIST SP 800-171 r2 (CUI)
	CMMCLevel3 CMMCLevel = 3 // 110+ practices — NIST SP 800-172 (CUI Enhanced)
)

func (l CMMCLevel) String() string {
	switch l {
	case CMMCLevel1:
		return "CMMC Level 1"
	case CMMCLevel2:
		return "CMMC Level 2"
	case CMMCLevel3:
		return "CMMC Level 3"
	}
	return "Unknown"
}

// OrgTargetType classifies the contractor's position in the DIB supply chain.
type OrgTargetType string

const (
	OrgTypePrime    OrgTargetType = "prime_contractor"
	OrgTypeSub      OrgTargetType = "subcontractor"
	OrgTypeDIB      OrgTargetType = "dib_contractor"
	OrgTypeCloudCSP OrgTargetType = "cloud_service_provider"
)

// WorkflowPhase represents the current phase of the 7-phase autopilot workflow.
type WorkflowPhase string

const (
	Phase00SeedIntake       WorkflowPhase = "00_seed_intake"
	Phase01Discovery        WorkflowPhase = "01_discovery"
	Phase02BoundaryProposal WorkflowPhase = "02_boundary_proposal"
	Phase03ScopedAssessment WorkflowPhase = "03_scoped_assessment"
	Phase04Evidence         WorkflowPhase = "04_evidence_collection"
	Phase05Findings         WorkflowPhase = "05_findings_poam"
	Phase06Export           WorkflowPhase = "06_audit_export"
	PhaseDone               WorkflowPhase = "done"
)

// ProposalStatus tracks the human review state of a BoundaryProposal.
type ProposalStatus string

const (
	ProposalPending  ProposalStatus = "pending_review"
	ProposalApproved ProposalStatus = "approved"
	ProposalRejected ProposalStatus = "rejected"
	ProposalAmended  ProposalStatus = "amended"
)

// AssetType enumerates the supported asset categories.
type AssetType string

const (
	AssetWorkstation    AssetType = "workstation"
	AssetServer         AssetType = "server"
	AssetNetworkDevice  AssetType = "network_device"
	AssetCloudInstance  AssetType = "cloud_instance"
	AssetOTDevice       AssetType = "ot_device"
	AssetMobileDevice   AssetType = "mobile_device"
	AssetVM             AssetType = "virtual_machine"
	AssetContainer      AssetType = "container"
	AssetSaaSApp        AssetType = "saas_application"
	AssetExternalSvc    AssetType = "external_service"
)

// HumanDecisionValue is the outcome of a COMPLIANCE_OFFICER's asset review.
type HumanDecisionValue string

const (
	DecisionInclude HumanDecisionValue = "include"
	DecisionExclude HumanDecisionValue = "exclude"
	DecisionDefer   HumanDecisionValue = "defer"
)

// FindingStatus maps to NIST OSCAL assessment result states.
type FindingStatus string

const (
	FindingCompliant    FindingStatus = "compliant"
	FindingNonCompliant FindingStatus = "non_compliant"
	FindingNA           FindingStatus = "not_applicable"
	FindingNotReviewed  FindingStatus = "not_reviewed"
)

// POAMStatus tracks remediation progress.
type POAMStatus string

const (
	POAMOpen         POAMStatus = "open"
	POAMInProgress   POAMStatus = "in_progress"
	POAMCompleted    POAMStatus = "completed"
	POAMDelayed      POAMStatus = "delayed"
	POAMRiskAccepted POAMStatus = "risk_accepted"
)

// AuditPackageFormat specifies the export format.
type AuditPackageFormat string

const (
	FormatOSCAL       AuditPackageFormat = "oscal_1_1_2"
	FormateMASS       AuditPackageFormat = "emass"
	FormatC3PAOPDF    AuditPackageFormat = "c3pao_pdf"
	FormatKheprBundle AuditPackageFormat = "khepra_bundle"
)

// =============================================================================
// SMART-ON-KHEPRA ROLE MODEL
// =============================================================================

// SMARTRole is an Adinkra symbol encoding an authorization scope.
// Models SMART-on-FHIR launch context scopes as Adinkra cultural symbols.
type SMARTRole string

const (
	// RoleChokmah — CONSULTANT. Triggers seed intake and discovery (Phase 00-01).
	RoleChokmah SMARTRole = "Chokmah"

	// RoleEban — AUDITOR. Read-only observer. Can view any phase but cannot write.
	RoleEban SMARTRole = "Eban"

	// RoleNkyinkyim — OPERATOR. Executes remediation playbooks (Phase 03-04).
	RoleNkyinkyim SMARTRole = "Nkyinkyim"

	// RoleDwennimmen — COMPLIANCE_OFFICER. The ONLY role that may sign a BoundaryApproval.
	// Represents humility and strength; the governance gatekeeper of Phase 02.
	RoleDwennimmen SMARTRole = "Dwennimmen"

	// RoleFawohodie — ENGINEER. Implements controls and collects evidence (Phase 03-04).
	RoleFawohodie SMARTRole = "Fawohodie"
)

// CanSignBoundary returns true only for Dwennimmen (COMPLIANCE_OFFICER).
// This is the hard enforcement gate: no other role produces a valid BoundaryApproval.
func (r SMARTRole) CanSignBoundary() bool {
	return r == RoleDwennimmen
}

// CanWrite returns true if the role may write any record in the given phase.
func (r SMARTRole) CanWrite(phase WorkflowPhase) bool {
	switch r {
	case RoleEban:
		return false // auditor is always read-only
	case RoleChokmah:
		return phase == Phase00SeedIntake || phase == Phase01Discovery
	case RoleDwennimmen:
		return phase == Phase02BoundaryProposal || phase == Phase06Export
	case RoleNkyinkyim, RoleFawohodie:
		return phase == Phase03ScopedAssessment ||
			phase == Phase04Evidence ||
			phase == Phase05Findings
	}
	return false
}

// =============================================================================
// ENGAGEMENT (FHIR: ServiceRequest)
// =============================================================================

// Engagement is the top-level CMMC assessment record.
// Created at Phase 00 and updated as the workflow advances.
type Engagement struct {
	ID             string        `json:"id"`
	OrganizationID string        `json:"organization_id"`
	CAGECode       string        `json:"cage_code"`        // SAM.gov CAGE — immutable
	ContractNumber string        `json:"contract_number,omitempty"`
	CMMCLevel      CMMCLevel     `json:"cmmc_level_target"`
	TargetType     OrgTargetType `json:"target_type"`
	Phase          WorkflowPhase `json:"phase"`

	// Seed data (Phase 00)
	SeedNetworks      []string               `json:"seed_networks,omitempty"`
	SeedCloudAccounts map[string]string      `json:"seed_cloud_accounts,omitempty"`

	// C3PAO reviewer tokens (ML-DSA-65 signed access grants)
	C3PAOTokens []string `json:"c3pao_access_tokens,omitempty"`

	// Phase linkage
	DiscoveryDAGRoot   string `json:"discovery_dag_root,omitempty"`
	BoundaryApprovalID string `json:"boundary_approval_id,omitempty"`

	CreatedBy   string     `json:"created_by"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
}

// =============================================================================
// BOUNDARY PROPOSAL (FHIR: DiagnosticReport, pre-approval)
// =============================================================================

// BoundaryProposal is the agent's Phase 01 discovery output.
// It awaits a COMPLIANCE_OFFICER (Dwennimmen) review and PQC signature.
type BoundaryProposal struct {
	ID             string              `json:"id"`
	EngagementID   string              `json:"engagement_id"`
	DiscoveryDAGNode string            `json:"discovery_dag_node_id"`
	ScanSummary    map[string]any      `json:"scan_summary,omitempty"`
	ProposedAssets []GovernedAssetDraft `json:"proposed_assets"`
	AgentConfidence    float64         `json:"agent_confidence"` // 0.0..1.0
	AgentJustification string          `json:"agent_justification"`
	Status             ProposalStatus  `json:"status"`
	ReviewerNotes      string          `json:"reviewer_notes,omitempty"`
	CreatedAt          time.Time       `json:"created_at"`
	ReviewedAt         *time.Time      `json:"reviewed_at,omitempty"`
	ReviewedBy         string          `json:"reviewed_by,omitempty"` // MUST be Dwennimmen
}

// GovernedAssetDraft is a proposed asset before the human governance decision.
type GovernedAssetDraft struct {
	Hostname          string             `json:"hostname,omitempty"`
	IPAddresses       []string           `json:"ip_addresses,omitempty"`
	MACAddresses      []string           `json:"mac_addresses,omitempty"`
	AssetType         AssetType          `json:"asset_type"`
	Platform          string             `json:"platform,omitempty"`
	OperatingSystem   string             `json:"os,omitempty"`
	FQDN              string             `json:"fqdn,omitempty"`
	AgentRecommendation bool             `json:"cmmc_scope"` // true = agent says in-scope
	AgentReasoning    string             `json:"agent_reasoning"`
	HumanDecision     *HumanDecisionRecord `json:"human_decision,omitempty"` // nil until reviewed
}

// HumanDecisionRecord captures the governance action on a single asset.
type HumanDecisionRecord struct {
	Decision  HumanDecisionValue `json:"decision"`
	Rationale string             `json:"rationale,omitempty"`
	DecidedBy string             `json:"decided_by"` // user_id
	DecidedAt time.Time          `json:"decided_at"`
}

// =============================================================================
// GOVERNED ASSET (FHIR: Device)
// =============================================================================

// GovernedAsset is a confirmed in-scope asset after BoundaryApproval.
type GovernedAsset struct {
	ID                  string             `json:"id"`
	EngagementID        string             `json:"engagement_id"`
	BoundaryProposalID  string             `json:"boundary_proposal_id"`
	Hostname            string             `json:"hostname,omitempty"`
	IPAddresses         []string           `json:"ip_addresses,omitempty"`
	MACAddresses        []string           `json:"mac_addresses,omitempty"`
	AssetType           AssetType          `json:"asset_type"`
	Platform            string             `json:"platform,omitempty"`
	OperatingSystem     string             `json:"os,omitempty"`
	FQDN                string             `json:"fqdn,omitempty"`
	AgentRecommendation bool               `json:"agent_recommendation"`
	AgentReasoning      string             `json:"agent_reasoning"`
	HumanDecision       HumanDecisionValue `json:"human_decision"`
	HumanRationale      string             `json:"human_rationale,omitempty"`
	DecidedBy           string             `json:"decided_by"`
	DecidedAt           time.Time          `json:"decided_at"`
	InCMMCScope         bool               `json:"in_cmmc_scope"`
	DAGNodeID           string             `json:"dag_node_id,omitempty"`
	CreatedAt           time.Time          `json:"created_at"`
}

// =============================================================================
// BOUNDARY APPROVAL (FHIR: Consent with PQC digital signature)
// =============================================================================

// BoundaryApproval is the PQC-signed Phase 02 governance gate.
// BoundaryGuard checks this before passing any Phase 03+ MCP tool call.
// Only RoleDwennimmen (COMPLIANCE_OFFICER) may create a valid BoundaryApproval.
type BoundaryApproval struct {
	ID                 string         `json:"id"`
	EngagementID       string         `json:"engagement_id"`
	BoundaryProposalID string         `json:"boundary_proposal_id"`

	// Signer — enforced to be Dwennimmen at signing time
	ApprovedByRole   SMARTRole `json:"approved_by_role"`
	ApprovedByUserID string    `json:"approved_by_user_id"`

	// PQC attestation (ML-DSA-65 / NIST FIPS 204)
	PQCSignature      string `json:"pqc_signature"`      // base64url
	SignedPayloadHash string `json:"signed_payload_hash"` // SHA-256 hex

	// Immutable evidence chain
	DAGNodeID string `json:"dag_node_id"`

	// .khepra manifest
	KhepraManifest KhepraManifest `json:"khepra_manifest"`

	// Validity (90-day default)
	EffectiveAt time.Time  `json:"effective_at"`
	ExpiresAt   time.Time  `json:"expires_at"`

	// Revocation
	RevokedAt        *time.Time `json:"revoked_at,omitempty"`
	RevokedBy        string     `json:"revoked_by,omitempty"`
	RevocationReason string     `json:"revocation_reason,omitempty"`
}

// IsValid returns true if the approval is not revoked and not expired.
func (a *BoundaryApproval) IsValid(now time.Time) bool {
	return a.RevokedAt == nil && now.Before(a.ExpiresAt)
}

// =============================================================================
// .KHEPRA MANIFEST FORMAT
// =============================================================================

// KhepraManifest is the signed payload format shared by:
//   - license.khepra          (capabilities grant)
//   - boundary_approval.khepra (Phase 02 governance gate)
//   - audit_package.khepra    (Phase 06 export manifest)
//
// JSON structure: {"version":"1.0","type":"...","claims":{...},"signature":"<ML-DSA-65 base64>","issued_at":"..."}
type KhepraManifest struct {
	Version   string         `json:"version"`    // "1.0"
	Type      KhepraType     `json:"type"`
	Claims    map[string]any `json:"claims"`
	Signature string         `json:"signature"`  // ML-DSA-65 base64url
	IssuedAt  time.Time      `json:"issued_at"`
	ExpiresAt *time.Time     `json:"expires_at,omitempty"`
}

// KhepraType distinguishes the three manifest types.
type KhepraType string

const (
	KhepraTypeLicense          KhepraType = "license"
	KhepraTypeBoundaryApproval KhepraType = "boundary_approval"
	KhepraTypeAuditPackage     KhepraType = "audit_package"
)

// BoundaryApprovalClaims are the structured claims inside a boundary_approval.khepra.
type BoundaryApprovalClaims struct {
	EngagementID       string    `json:"engagement_id"`
	BoundaryProposalID string    `json:"boundary_proposal_id"`
	CAGECode           string    `json:"cage_code"`
	CMMCLevel          int       `json:"cmmc_level"`
	AssetCount         int       `json:"asset_count"`
	AssetIDsHash       string    `json:"asset_ids_hash"` // SHA-256 of sorted asset ID list
	ApprovedByRole     string    `json:"approved_by_role"`
	ApprovedByUserID   string    `json:"approved_by_user_id"`
	EffectiveAt        time.Time `json:"effective_at"`
	ExpiresAt          time.Time `json:"expires_at"`
	DAGNodeID          string    `json:"dag_node_id"`
}

// AuditPackageClaims are the structured claims inside an audit_package.khepra.
type AuditPackageClaims struct {
	EngagementID    string             `json:"engagement_id"`
	CAGECode        string             `json:"cage_code"`
	CMMCLevel       int                `json:"cmmc_level"`
	Format          AuditPackageFormat `json:"format"`
	PackageHash     string             `json:"package_hash"`  // SHA-256 of exported content
	DAGRootNode     string             `json:"dag_root_node"`
	DAGLeafNode     string             `json:"dag_leaf_node"`
	TotalControls   int                `json:"total_controls"`
	CompliantCount  int                `json:"compliant_count"`
	NonCompliant    int                `json:"non_compliant_count"`
	AssessmentDate  string             `json:"assessment_date"` // YYYY-MM-DD
	OSCAlUUID       string             `json:"oscal_uuid,omitempty"`
	GeneratedAt     time.Time          `json:"generated_at"`
}

// =============================================================================
// ASSESSMENT FINDING (FHIR: Observation)
// =============================================================================

// AssessmentFinding is the result of evaluating one CMMC control against one asset.
type AssessmentFinding struct {
	ID            string        `json:"id"`
	EngagementID  string        `json:"engagement_id"`
	AssetID       string        `json:"asset_id,omitempty"` // empty = engagement-level
	ControlFamily string        `json:"control_family"`     // AC, AU, CM, ...
	ControlID     string        `json:"control_id"`         // AC.L2-3.1.1
	ControlTitle  string        `json:"control_title,omitempty"`
	CMMCLevel     CMMCLevel     `json:"cmmc_level"`
	Status        FindingStatus `json:"status"`
	Score         float64       `json:"score,omitempty"` // 0..100
	FindingDetail string        `json:"finding_detail,omitempty"`
	EvidenceRefs  []string      `json:"evidence_refs,omitempty"` // DAG node IDs
	AssessedBy    string        `json:"assessed_by"`
	Method        string        `json:"assessment_method"` // automated|manual|interview|test
	DAGNodeID     string        `json:"dag_node_id,omitempty"`
	AssessedAt    time.Time     `json:"assessed_at"`
}

// =============================================================================
// POAM ITEM (FHIR: CarePlan.activity)
// =============================================================================

// POAMMilestone is a single milestone within a POAMItem.
type POAMMilestone struct {
	Description string     `json:"description"`
	DueDate     string     `json:"due_date"`     // YYYY-MM-DD
	CompletedAt *time.Time `json:"completed_at,omitempty"`
}

// POAMItem is a Plan of Action & Milestones entry for a non-compliant finding.
// Follows the DoD CMMC POAM template format.
type POAMItem struct {
	ID                      string          `json:"id"`
	EngagementID            string          `json:"engagement_id"`
	FindingID               string          `json:"finding_id"`
	WeaknessDescription     string          `json:"weakness_description"`
	ResponsibleParty        string          `json:"responsible_party"`
	ResourcesRequired       string          `json:"resources_required,omitempty"`
	Milestones              []POAMMilestone `json:"milestones"`
	ScheduledCompletion     string          `json:"scheduled_completion"` // YYYY-MM-DD
	Status                  POAMStatus      `json:"status"`
	CompletionDate          string          `json:"completion_date,omitempty"`
	RiskAccepted            bool            `json:"risk_accepted"`
	RiskAcceptanceRationale string          `json:"risk_acceptance_rationale,omitempty"`
	RiskAcceptedBy          string          `json:"risk_accepted_by,omitempty"`
	DAGNodeID               string          `json:"dag_node_id,omitempty"`
	CreatedAt               time.Time       `json:"created_at"`
	UpdatedAt               time.Time       `json:"updated_at"`
}

// =============================================================================
// AUDIT PACKAGE (FHIR: Bundle, type=document)
// =============================================================================

// AuditPackage is a versioned, PQC-signed evidence package (Phase 06 output).
type AuditPackage struct {
	ID           string             `json:"id"`
	EngagementID string             `json:"engagement_id"`
	Format       AuditPackageFormat `json:"format"`
	Version      int                `json:"version"`
	Title        string             `json:"title,omitempty"`

	// PQC attestation
	KhepraManifest KhepraManifest `json:"khepra_manifest"`
	PQCSignature   string         `json:"pqc_signature"`  // ML-DSA-65 base64url
	PackageHash    string         `json:"package_hash"`   // SHA-256

	// Evidence chain
	DAGRootNodeID string `json:"dag_root_node_id"`
	DAGLeafNodeID string `json:"dag_leaf_node_id"`

	// Storage
	StoragePath  string     `json:"storage_path,omitempty"`
	DownloadURL  string     `json:"download_url,omitempty"`
	URLExpiresAt *time.Time `json:"url_expires_at,omitempty"`

	// OSCAL
	OSCAlUUID      string `json:"oscal_uuid,omitempty"`
	AssessmentDate string `json:"assessment_date,omitempty"` // YYYY-MM-DD

	CreatedBy string     `json:"created_by"`
	CreatedAt time.Time  `json:"created_at"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
}
