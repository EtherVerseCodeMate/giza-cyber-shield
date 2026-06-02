package nist80171

import (
	"time"
)

// NIST 800-171 Maintenance (MA) Family - 6 Controls

// ValidateMAFamily orchestrates all Maintenance checks
func (v *Validator) ValidateMAFamily() []ControlResult {
	results := []ControlResult{
		v.CheckMA_3_7_1(),
		v.CheckMA_3_7_2(),
		v.CheckMA_3_7_3(),
		v.CheckMA_3_7_4(),
		v.CheckMA_3_7_5(),
		v.CheckMA_3_7_6(),
	}
	v.Results = append(v.Results, results...)
	return results
}

// 3.7.1 Perform maintenance on organizational systems.
func (v *Validator) CheckMA_3_7_1() ControlResult {
	return ControlResult{
		ControlID:   "3.7.1",
		Title:       "System Maintenance",
		Family:      FamilyMA,
		Description: "Perform maintenance on organizational systems.",
		Status:      "MANUAL_REVIEW",
		Finding:     "Requires policy documentation and ISSM attestation.",
		CheckedAt:   time.Now(),
	}
}

// 3.7.2 Provide controls on the tools, techniques, mechanisms, and personnel for maintenance.
func (v *Validator) CheckMA_3_7_2() ControlResult {
	return ControlResult{
		ControlID:   "3.7.2",
		Title:       "Maintenance Tools and Personnel Controls",
		Family:      FamilyMA,
		Description: "Provide controls on the tools, techniques, mechanisms, and personnel for maintenance.",
		Status:      "MANUAL_REVIEW",
		Finding:     "Requires policy documentation and ISSM attestation.",
		CheckedAt:   time.Now(),
	}
}

// 3.7.3 Ensure equipment removed for maintenance is sanitized.
func (v *Validator) CheckMA_3_7_3() ControlResult {
	return ControlResult{
		ControlID:   "3.7.3",
		Title:       "Equipment Sanitization for Maintenance",
		Family:      FamilyMA,
		Description: "Ensure equipment removed for maintenance is sanitized.",
		Status:      "MANUAL_REVIEW",
		Finding:     "Requires policy documentation and ISSM attestation.",
		CheckedAt:   time.Now(),
	}
}

// 3.7.4 Check media containing diagnostic programs for malicious code before use.
func (v *Validator) CheckMA_3_7_4() ControlResult {
	return ControlResult{
		ControlID:   "3.7.4",
		Title:       "Maintenance Diagnostic Media Inspection",
		Family:      FamilyMA,
		Description: "Check media containing diagnostic programs for malicious code before use.",
		Status:      "MANUAL_REVIEW",
		Finding:     "Requires policy documentation and ISSM attestation.",
		CheckedAt:   time.Now(),
	}
}

// 3.7.5 Require MFA for remote maintenance sessions.
func (v *Validator) CheckMA_3_7_5() ControlResult {
	return ControlResult{
		ControlID:   "3.7.5",
		Title:       "MFA for Remote Maintenance",
		Family:      FamilyMA,
		Description: "Require MFA for remote maintenance sessions.",
		Status:      "MANUAL_REVIEW",
		Finding:     "Requires policy documentation and ISSM attestation.",
		CheckedAt:   time.Now(),
	}
}

// 3.7.6 Supervise maintenance activities of personnel without required access authorization.
func (v *Validator) CheckMA_3_7_6() ControlResult {
	return ControlResult{
		ControlID:   "3.7.6",
		Title:       "Maintenance Personnel Supervision",
		Family:      FamilyMA,
		Description: "Supervise maintenance activities of personnel without required access authorization.",
		Status:      "MANUAL_REVIEW",
		Finding:     "Requires policy documentation and ISSM attestation.",
		CheckedAt:   time.Now(),
	}
}
