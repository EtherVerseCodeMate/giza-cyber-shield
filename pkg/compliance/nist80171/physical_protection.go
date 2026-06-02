package nist80171

import (
	"time"
)

// NIST 800-171 Physical Protection (PE) Family - 6 Controls

// ValidatePEFamily orchestrates all Physical Protection checks
func (v *Validator) ValidatePEFamily() []ControlResult {
	results := []ControlResult{
		v.CheckPE_3_10_1(),
		v.CheckPE_3_10_2(),
		v.CheckPE_3_10_3(),
		v.CheckPE_3_10_4(),
		v.CheckPE_3_10_5(),
		v.CheckPE_3_10_6(),
	}
	v.Results = append(v.Results, results...)
	return results
}

// 3.10.1 Limit physical access to organizational systems to authorized individuals.
func (v *Validator) CheckPE_3_10_1() ControlResult {
	return ControlResult{
		ControlID:   "3.10.1",
		Title:       "Physical Access Limitation",
		Family:      FamilyPE,
		Description: "Limit physical access to organizational systems to authorized individuals.",
		Status:      "MANUAL_REVIEW",
		Finding:     "Requires policy documentation and ISSM attestation.",
		CheckedAt:   time.Now(),
	}
}

// 3.10.2 Protect and monitor the physical facility and support infrastructure.
func (v *Validator) CheckPE_3_10_2() ControlResult {
	return ControlResult{
		ControlID:   "3.10.2",
		Title:       "Facility and Infrastructure Protection",
		Family:      FamilyPE,
		Description: "Protect and monitor the physical facility and support infrastructure.",
		Status:      "MANUAL_REVIEW",
		Finding:     "Requires policy documentation and ISSM attestation.",
		CheckedAt:   time.Now(),
	}
}

// 3.10.3 Escort visitors and monitor visitor activity.
func (v *Validator) CheckPE_3_10_3() ControlResult {
	return ControlResult{
		ControlID:   "3.10.3",
		Title:       "Visitor Escort and Monitoring",
		Family:      FamilyPE,
		Description: "Escort visitors and monitor visitor activity.",
		Status:      "MANUAL_REVIEW",
		Finding:     "Requires policy documentation and ISSM attestation.",
		CheckedAt:   time.Now(),
	}
}

// 3.10.4 Maintain audit logs of physical access.
func (v *Validator) CheckPE_3_10_4() ControlResult {
	return ControlResult{
		ControlID:   "3.10.4",
		Title:       "Physical Access Audit Logs",
		Family:      FamilyPE,
		Description: "Maintain audit logs of physical access.",
		Status:      "MANUAL_REVIEW",
		Finding:     "Requires policy documentation and ISSM attestation.",
		CheckedAt:   time.Now(),
	}
}

// 3.10.5 Control and manage physical access devices.
func (v *Validator) CheckPE_3_10_5() ControlResult {
	return ControlResult{
		ControlID:   "3.10.5",
		Title:       "Physical Access Device Management",
		Family:      FamilyPE,
		Description: "Control and manage physical access devices.",
		Status:      "MANUAL_REVIEW",
		Finding:     "Requires policy documentation and ISSM attestation.",
		CheckedAt:   time.Now(),
	}
}

// 3.10.6 Enforce safeguarding measures for CUI at alternate work sites.
func (v *Validator) CheckPE_3_10_6() ControlResult {
	return ControlResult{
		ControlID:   "3.10.6",
		Title:       "Alternate Work Site CUI Safeguarding",
		Family:      FamilyPE,
		Description: "Enforce safeguarding measures for CUI at alternate work sites.",
		Status:      "MANUAL_REVIEW",
		Finding:     "Requires policy documentation and ISSM attestation.",
		CheckedAt:   time.Now(),
	}
}
