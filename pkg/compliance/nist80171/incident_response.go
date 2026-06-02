package nist80171

import (
	"time"
)

// NIST 800-171 Incident Response (IR) Family - 3 Controls

// ValidateIRFamily orchestrates all Incident Response checks
func (v *Validator) ValidateIRFamily() []ControlResult {
	results := []ControlResult{
		v.CheckIR_3_6_1(),
		v.CheckIR_3_6_2(),
		v.CheckIR_3_6_3(),
	}
	v.Results = append(v.Results, results...)
	return results
}

// 3.6.1 Establish an operational incident-handling capability including preparation, detection, analysis, containment, recovery, and user response activities.
func (v *Validator) CheckIR_3_6_1() ControlResult {
	return ControlResult{
		ControlID:   "3.6.1",
		Title:       "Incident Handling Capability",
		Family:      FamilyIR,
		Description: "Establish an operational incident-handling capability including preparation, detection, analysis, containment, recovery, and user response activities.",
		Status:      "MANUAL_REVIEW",
		Finding:     "Requires policy documentation and ISSM attestation.",
		CheckedAt:   time.Now(),
	}
}

// 3.6.2 Track, document, and report incidents.
func (v *Validator) CheckIR_3_6_2() ControlResult {
	return ControlResult{
		ControlID:   "3.6.2",
		Title:       "Incident Tracking and Reporting",
		Family:      FamilyIR,
		Description: "Track, document, and report incidents.",
		Status:      "MANUAL_REVIEW",
		Finding:     "Requires policy documentation and ISSM attestation.",
		CheckedAt:   time.Now(),
	}
}

// 3.6.3 Test the organizational incident response capability.
func (v *Validator) CheckIR_3_6_3() ControlResult {
	return ControlResult{
		ControlID:   "3.6.3",
		Title:       "Incident Response Testing",
		Family:      FamilyIR,
		Description: "Test the organizational incident response capability.",
		Status:      "MANUAL_REVIEW",
		Finding:     "Requires policy documentation and ISSM attestation.",
		CheckedAt:   time.Now(),
	}
}
