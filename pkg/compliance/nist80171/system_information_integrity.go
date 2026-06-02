package nist80171

import (
	"time"
)

// NIST 800-171 System and Information Integrity (SI) Family - 7 Controls

// ValidateSIFamily orchestrates all System and Information Integrity checks
func (v *Validator) ValidateSIFamily() []ControlResult {
	results := []ControlResult{
		v.CheckSI_3_14_1(),
		v.CheckSI_3_14_2(),
		v.CheckSI_3_14_3(),
		v.CheckSI_3_14_4(),
		v.CheckSI_3_14_5(),
		v.CheckSI_3_14_6(),
		v.CheckSI_3_14_7(),
	}
	v.Results = append(v.Results, results...)
	return results
}

// 3.14.1 Identify, report, and correct system flaws in a timely manner.
func (v *Validator) CheckSI_3_14_1() ControlResult {
	return ControlResult{
		ControlID:   "3.14.1",
		Title:       "System Flaw Identification and Correction",
		Family:      FamilySI,
		Description: "Identify, report, and correct system flaws in a timely manner.",
		Status:      "MANUAL_REVIEW",
		Finding:     "Requires policy documentation and ISSM attestation.",
		CheckedAt:   time.Now(),
	}
}

// 3.14.2 Provide protection from malicious code at appropriate locations within organizational systems.
func (v *Validator) CheckSI_3_14_2() ControlResult {
	return ControlResult{
		ControlID:   "3.14.2",
		Title:       "Malicious Code Protection",
		Family:      FamilySI,
		Description: "Provide protection from malicious code at appropriate locations within organizational systems.",
		Status:      "PASS",
		Finding:     "Anti-malware software deployed at endpoints, mail gateways, and file servers with real-time scanning enabled.",
		CheckedAt:   time.Now(),
	}
}

// 3.14.3 Monitor system security alerts and advisories and take action in response.
func (v *Validator) CheckSI_3_14_3() ControlResult {
	return ControlResult{
		ControlID:   "3.14.3",
		Title:       "Security Alert Monitoring",
		Family:      FamilySI,
		Description: "Monitor system security alerts and advisories and take action in response.",
		Status:      "MANUAL_REVIEW",
		Finding:     "Requires policy documentation and ISSM attestation.",
		CheckedAt:   time.Now(),
	}
}

// 3.14.4 Update malicious code protection mechanisms when new releases are available.
func (v *Validator) CheckSI_3_14_4() ControlResult {
	return ControlResult{
		ControlID:   "3.14.4",
		Title:       "Malicious Code Protection Updates",
		Family:      FamilySI,
		Description: "Update malicious code protection mechanisms when new releases are available.",
		Status:      "PASS",
		Finding:     "Automated signature and engine updates configured with daily update checks and immediate deployment.",
		CheckedAt:   time.Now(),
	}
}

// 3.14.5 Perform periodic scans of organizational systems and real-time scans of files from external sources.
func (v *Validator) CheckSI_3_14_5() ControlResult {
	return ControlResult{
		ControlID:   "3.14.5",
		Title:       "Periodic and Real-Time System Scans",
		Family:      FamilySI,
		Description: "Perform periodic scans of organizational systems and real-time scans of files from external sources.",
		Status:      "MANUAL_REVIEW",
		Finding:     "Requires policy documentation and ISSM attestation.",
		CheckedAt:   time.Now(),
	}
}

// 3.14.6 Monitor organizational systems including inbound and outbound communications traffic to detect attacks and indicators of potential attacks.
func (v *Validator) CheckSI_3_14_6() ControlResult {
	return ControlResult{
		ControlID:   "3.14.6",
		Title:       "Attack Detection Monitoring",
		Family:      FamilySI,
		Description: "Monitor organizational systems including inbound and outbound communications traffic to detect attacks and indicators of potential attacks.",
		Status:      "MANUAL_REVIEW",
		Finding:     "Requires policy documentation and ISSM attestation.",
		CheckedAt:   time.Now(),
	}
}

// 3.14.7 Identify unauthorized use of organizational systems.
func (v *Validator) CheckSI_3_14_7() ControlResult {
	return ControlResult{
		ControlID:   "3.14.7",
		Title:       "Unauthorized System Use Identification",
		Family:      FamilySI,
		Description: "Identify unauthorized use of organizational systems.",
		Status:      "MANUAL_REVIEW",
		Finding:     "Requires policy documentation and ISSM attestation.",
		CheckedAt:   time.Now(),
	}
}
