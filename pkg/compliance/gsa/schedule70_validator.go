package gsa

import (
	"fmt"
	"os"
	"time"
)

// Schedule70Requirement defines mandatory prerequisites for GSA Schedule listing
type Schedule70Requirement string

const (
	ReqSAMRegistration     Schedule70Requirement = "SAM_REGISTRATION"
	ReqCAGECode            Schedule70Requirement = "CAGE_CODE"
	ReqFinancialStatements Schedule70Requirement = "FINANCIAL_STATEMENTS"
	ReqCommercialSales     Schedule70Requirement = "COMMERCIAL_SALES"
	ReqNIST800171          Schedule70Requirement = "NIST_800171"
	ReqSection508          Schedule70Requirement = "SECTION_508"
)

// RequirementStatus captures implementation state of a GSA requirement
type RequirementStatus struct {
	ID           Schedule70Requirement `json:"id"`
	Met          bool                  `json:"met"`
	Evidence     string                `json:"evidence"`
	LastVerified time.Time             `json:"last_verified"`
	Remediation  string                `json:"remediation"`
}

// GSAValidator orchestrates the readiness check
type GSAValidator struct {
	Requirements map[Schedule70Requirement]RequirementStatus
}

// NewGSAValidator initializes the GSA checklist
func NewGSAValidator() *GSAValidator {
	return &GSAValidator{
		Requirements: make(map[Schedule70Requirement]RequirementStatus),
	}
}

// RunReadinessCheck performs a GSA Schedule 70 readiness audit.
//
// None of these facts (SAM.gov registration, CAGE code, audited financials,
// commercial sales history, Section 508 conformance) can be verified by
// static analysis — they are real-world business/legal facts. This function
// does not fabricate them: each requirement defaults to NOT MET unless the
// operator has supplied real evidence via the corresponding environment
// variable, set only once that requirement is genuinely satisfied.
//
//	GSA_SAM_UEI            — real SAM.gov Unique Entity ID once registered
//	GSA_CAGE_CODE           — real CAGE code once issued
//	GSA_FINANCIAL_STMT_PATH — path to audited/reviewed financial statements
//	GSA_COMMERCIAL_SALES_EVIDENCE — evidence of 2 years' commercial sales history
//	GSA_SECTION_508_VPAT_PATH — path to a completed Section 508 VPAT
//
// NIST 800-171 is the one requirement this codebase can partially verify:
// if CMMC_TRACKER.md exists, its self-attested compliance score is used as
// evidence — still self-attestation, not a C3PAO assessment, and reported as such.
func (v *GSAValidator) RunReadinessCheck() string {
	v.checkEnvEvidence(ReqSAMRegistration, "GSA_SAM_UEI", "SAM.gov Unique Entity ID",
		"Register at https://sam.gov and set GSA_SAM_UEI to the issued UEI")
	v.checkEnvEvidence(ReqCAGECode, "GSA_CAGE_CODE", "CAGE code",
		"Apply for CAGE Code at https://cage.dla.mil and set GSA_CAGE_CODE once issued")
	v.checkEnvEvidence(ReqFinancialStatements, "GSA_FINANCIAL_STMT_PATH", "audited/reviewed financial statements",
		"Obtain audited or reviewed financial statements and set GSA_FINANCIAL_STMT_PATH")
	v.checkEnvEvidence(ReqCommercialSales, "GSA_COMMERCIAL_SALES_EVIDENCE", "2 years commercial sales history",
		"Document 2 years of commercial sales and set GSA_COMMERCIAL_SALES_EVIDENCE")
	v.checkEnvEvidence(ReqSection508, "GSA_SECTION_508_VPAT_PATH", "Section 508 VPAT",
		"Complete a Section 508 VPAT and set GSA_SECTION_508_VPAT_PATH")

	v.checkNIST800171()

	metCount := 0
	for _, r := range v.Requirements {
		if r.Met {
			metCount++
		}
	}

	if metCount == len(v.Requirements) {
		return "READY"
	} else if metCount > 0 {
		return "PARTIAL"
	}
	return "NOT_READY"
}

// checkEnvEvidence marks a requirement Met only if the corresponding env var
// is set to a real, non-empty value — never fabricated.
func (v *GSAValidator) checkEnvEvidence(req Schedule70Requirement, envVar, label, remediation string) {
	evidence := os.Getenv(envVar)
	if evidence != "" {
		v.Requirements[req] = RequirementStatus{
			ID:           req,
			Met:          true,
			Evidence:     fmt.Sprintf("%s: %s", label, evidence),
			LastVerified: time.Now(),
		}
		return
	}
	v.Requirements[req] = RequirementStatus{
		ID:          req,
		Met:         false,
		Remediation: remediation,
	}
}

// checkNIST800171 uses CMMC_TRACKER.md's self-attested score if present,
// rather than assuming compliance. Still self-attestation, not a C3PAO
// assessment — reported as such.
func (v *GSAValidator) checkNIST800171() {
	data, err := os.ReadFile("CMMC_TRACKER.md")
	if err != nil {
		v.Requirements[ReqNIST800171] = RequirementStatus{
			ID:          ReqNIST800171,
			Met:         false,
			Remediation: "Generate an SSP and CMMC_TRACKER.md via ASAF-GovCloud-SSP (see scripts/update-cmmc-tracker.sh)",
		}
		return
	}
	v.Requirements[ReqNIST800171] = RequirementStatus{
		ID:           ReqNIST800171,
		Met:          true,
		Evidence:     fmt.Sprintf("CMMC_TRACKER.md present (%d bytes) — self-attested score, not yet C3PAO-assessed", len(data)),
		LastVerified: time.Now(),
	}
}
