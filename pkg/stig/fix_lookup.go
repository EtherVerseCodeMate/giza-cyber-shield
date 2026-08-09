package stig

import "sync"

// fixIndex maps STIG RuleID → *CheckSpec for fast lookup by the remediation
// pipeline.  Built once at first use from all 14 platform check tables.
var (
	fixIndexOnce sync.Once
	fixIndex     map[string]*CheckSpec
)

// allTables is the flat list of every platform STIG table in the package.
// Keeping them here (not in stig_test.go) avoids duplicating the list and
// lets production code and tests both use GetCheckSpec.
var allTables = [][]CheckSpec{
	rhel09STIG,
	rhel08STIG,
	rhel07STIG,
	oracleLinux8STIG,
	ubuntu1804STIG,
	win10STIG,
	win11STIG,
	winSrv2016STIG,
	winSrv2019STIG,
	winSrv2022STIG,
	macos13STIG,
	macos14STIG,
	macos15STIG,
	k8sStig,
}

// buildFixIndex constructs the RuleID → CheckSpec map from all tables.
// Duplicate RuleIDs across tables (same STIG applied to multiple OS versions)
// are all stored — the first entry wins in GetCheckSpec.
func buildFixIndex() {
	fixIndex = make(map[string]*CheckSpec, 4096)
	for t := range allTables {
		for i := range allTables[t] {
			spec := &allTables[t][i]
			if _, exists := fixIndex[spec.RuleID]; !exists {
				fixIndex[spec.RuleID] = spec
			}
		}
	}
}

// GetCheckSpec returns the CheckSpec for the given STIG RuleID, or nil if not
// found across the 14 platform tables.  Safe for concurrent use.
func GetCheckSpec(ruleID string) *CheckSpec {
	fixIndexOnce.Do(buildFixIndex)
	return fixIndex[ruleID]
}

// GetFixArgv returns the remediation command argv matrix for a STIG rule, or
// nil if the rule has no automated fix (manual-only or rule not found).
// Each inner slice is one atomic command (no shell; no metacharacters).
func GetFixArgv(ruleID string) [][]string {
	spec := GetCheckSpec(ruleID)
	if spec == nil || spec.Fix == nil {
		return nil
	}
	return spec.Fix.Argv
}
