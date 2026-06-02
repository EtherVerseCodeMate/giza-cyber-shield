package nist80171

import (
	"time"
)

// NIST 800-171 Security Assessment (CA) Family - 4 Controls

// ValidateCAFamily orchestrates all Security Assessment checks
func (v *Validator) ValidateCAFamily() []ControlResult {
	results := []ControlResult{
		v.CheckCA_3_12_1(),
		v.CheckCA_3_12_2(),
		v.CheckCA_3_12_3(),
		v.CheckCA_3_12_4(),
	}
	v.Results = append(v.Results, results...)
	return results
}

// 3.12.1 Periodically assess the security controls in organizational systems to determine if controls are effective.
func (v *Validator) CheckCA_3_12_1() ControlResult {
	return ControlResult{
		ControlID:   "3.12.1",
		Title:       "Security Control Assessment",
		Family:      FamilyCA,
		Description: "Periodically assess the security controls in organizational systems to determine if controls are effective.",
		Status:      "MANUAL_REVIEW",
		Finding:     "Requires policy documentation and ISSM attestation.",
		CheckedAt:   time.Now(),
	}
}

// 3.12.2 Develop and implement plans of action to correct deficiencies and reduce or eliminate vulnerabilities.
func (v *Validator) CheckCA_3_12_2() ControlResult {
	return ControlResult{
		ControlID:   "3.12.2",
		Title:       "Plans of Action and Milestones",
		Family:      FamilyCA,
		Description: "Develop and implement plans of action to correct deficiencies and reduce or eliminate vulnerabilities.",
		Status:      "MANUAL_REVIEW",
		Finding:     "Requires policy documentation and ISSM attestation.",
		CheckedAt:   time.Now(),
	}
}

// 3.12.3 Monitor security controls on an ongoing basis to ensure the continued effectiveness of the controls.
func (v *Validator) CheckCA_3_12_3() ControlResult {
	return ControlResult{
		ControlID:   "3.12.3",
		Title:       "Ongoing Security Control Monitoring",
		Family:      FamilyCA,
		Description: "Monitor security controls on an ongoing basis to ensure the continued effectiveness of the controls.",
		Status:      "MANUAL_REVIEW",
		Finding:     "Requires policy documentation and ISSM attestation.",
		CheckedAt:   time.Now(),
	}
}

// 3.12.4 Develop, document, and periodically update system security plans.
func (v *Validator) CheckCA_3_12_4() ControlResult {
	return ControlResult{
		ControlID:   "3.12.4",
		Title:       "System Security Plan",
		Family:      FamilyCA,
		Description: "Develop, document, and periodically update system security plans.",
		Status:      "MANUAL_REVIEW",
		Finding:     "Requires policy documentation and ISSM attestation.",
		CheckedAt:   time.Now(),
	}
}
