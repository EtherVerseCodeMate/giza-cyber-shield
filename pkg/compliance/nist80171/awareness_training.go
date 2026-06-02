package nist80171

import (
	"time"
)

// NIST 800-171 Awareness and Training (AT) Family - 3 Controls

// ValidateATFamily orchestrates all Awareness and Training checks
func (v *Validator) ValidateATFamily() []ControlResult {
	results := []ControlResult{
		v.CheckAT_3_2_1(),
		v.CheckAT_3_2_2(),
		v.CheckAT_3_2_3(),
	}
	v.Results = append(v.Results, results...)
	return results
}

// 3.2.1 Ensure that managers, systems administrators, and users of organizational systems are made aware of the security risks associated with their activities.
func (v *Validator) CheckAT_3_2_1() ControlResult {
	return ControlResult{
		ControlID:   "3.2.1",
		Title:       "Security Risk Awareness",
		Family:      FamilyAT,
		Description: "Ensure that managers, systems administrators, and users of organizational systems are made aware of the security risks associated with their activities.",
		Status:      "MANUAL_REVIEW",
		Finding:     "Requires policy documentation and ISSM attestation.",
		CheckedAt:   time.Now(),
	}
}

// 3.2.2 Ensure that organizational personnel are trained to carry out their assigned information security responsibilities.
func (v *Validator) CheckAT_3_2_2() ControlResult {
	return ControlResult{
		ControlID:   "3.2.2",
		Title:       "Role-Based Security Training",
		Family:      FamilyAT,
		Description: "Ensure that organizational personnel are trained to carry out their assigned information security responsibilities.",
		Status:      "MANUAL_REVIEW",
		Finding:     "Requires policy documentation and ISSM attestation.",
		CheckedAt:   time.Now(),
	}
}

// 3.2.3 Provide security awareness training on recognizing and reporting potential threats.
func (v *Validator) CheckAT_3_2_3() ControlResult {
	return ControlResult{
		ControlID:   "3.2.3",
		Title:       "Threat Recognition and Reporting Training",
		Family:      FamilyAT,
		Description: "Provide security awareness training on recognizing and reporting potential threats.",
		Status:      "MANUAL_REVIEW",
		Finding:     "Requires policy documentation and ISSM attestation.",
		CheckedAt:   time.Now(),
	}
}
