package nist80171

import (
	"time"
)

// NIST 800-171 Personnel Security (PS) Family - 2 Controls

// ValidatePSFamily orchestrates all Personnel Security checks
func (v *Validator) ValidatePSFamily() []ControlResult {
	results := []ControlResult{
		v.CheckPS_3_9_1(),
		v.CheckPS_3_9_2(),
	}
	v.Results = append(v.Results, results...)
	return results
}

// 3.9.1 Screen individuals prior to authorizing access to organizational systems containing CUI.
func (v *Validator) CheckPS_3_9_1() ControlResult {
	return ControlResult{
		ControlID:   "3.9.1",
		Title:       "Personnel Screening",
		Family:      FamilyPS,
		Description: "Screen individuals prior to authorizing access to organizational systems containing CUI.",
		Status:      "MANUAL_REVIEW",
		Finding:     "Requires policy documentation and ISSM attestation.",
		CheckedAt:   time.Now(),
	}
}

// 3.9.2 Ensure CUI is protected during and after personnel actions such as terminations and transfers.
func (v *Validator) CheckPS_3_9_2() ControlResult {
	return ControlResult{
		ControlID:   "3.9.2",
		Title:       "Personnel Termination and Transfer",
		Family:      FamilyPS,
		Description: "Ensure CUI is protected during and after personnel actions such as terminations and transfers.",
		Status:      "MANUAL_REVIEW",
		Finding:     "Requires policy documentation and ISSM attestation.",
		CheckedAt:   time.Now(),
	}
}
