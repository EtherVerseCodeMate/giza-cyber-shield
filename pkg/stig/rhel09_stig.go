package stig

import "fmt"

// validateRHEL09STIG runs all RHEL-09 STIG V1R3 checks using the table-driven
// engine.  The rhel09STIG check table is generated from the DISA XCCDF benchmark
// by cmd/stig-updater --gen-all and compiled into the binary.
func (v *Validator) validateRHEL09STIG(result *ValidationResult) error {
	result.Version = "V1R3"

	checker := NewSystemChecker()
	db, err := GetDatabase()
	if err != nil {
		return fmt.Errorf("load compliance database: %w", err)
	}

	for _, spec := range rhel09STIG {
		result.Findings = append(result.Findings, RunCheck(spec, checker, db))
	}
	return nil
}
