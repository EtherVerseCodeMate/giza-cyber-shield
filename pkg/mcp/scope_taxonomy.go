// Package mcp — domain-specific scope parameter allow-list (injection resistance).
//
// NSA "MCP Security Design Considerations" flags tool parameter injection as an
// active threat vector. This file embeds the canonical taxonomy of permitted values
// for domain-specific parameters and enforces allow-list membership before dispatch.
package mcp

import "fmt"

var knownOSTargets = map[string]bool{
	"RHEL-9": true, "RHEL-9-V1R3": true, "RHEL-9-V1R2": true,
	"RHEL-8": true, "RHEL-8-V1R14": true, "RHEL-8-V1R13": true,
	"RHEL-7": true, "RHEL-7-V3R15": true,
	"Ubuntu-22.04": true, "Ubuntu-22.04-LTS": true,
	"Ubuntu-20.04": true, "Ubuntu-20.04-LTS": true, "Ubuntu-18.04": true,
	"Windows-Server-2022": true, "Windows-Server-2022-V1R4": true,
	"Windows-Server-2019": true, "Windows-Server-2019-V2R9": true,
	"Windows-Server-2016": true,
	"Kubernetes-STIG": true, "Kubernetes-V1R12": true, "Docker-CE-STIG": true,
	"Cisco-IOS-XE": true, "Cisco-NX-OS": true, "Palo-Alto-PAN-OS": true,
	"linux": true, "windows": true, "macos": true, "container": true,
	"local": true, ".": true,
}

var knownFrameworks = map[string]bool{
	"NIST-800-53": true, "NIST-800-53-Rev5": true, "NIST-800-53-Rev4": true,
	"NIST-800-171": true, "NIST-800-171-Rev2": true, "NIST-800-171-Rev3": true,
	"NIST-800-172": true,
	"CMMC-L1": true, "CMMC-L2": true, "CMMC-L3": true,
	"CMMC-2.0-L1": true, "CMMC-2.0-L2": true, "CMMC-2.0-L3": true,
	"STIG-RHEL-9": true, "STIG-RHEL-8": true, "STIG-RHEL-7": true,
	"STIG-Ubuntu-22": true, "STIG-Ubuntu-20": true,
	"STIG-Windows-Server-2022": true, "STIG-Windows-Server-2019": true,
	"STIG-Kubernetes": true, "STIG-Docker": true,
	"CIS-RHEL-9-L1": true, "CIS-RHEL-9-L2": true,
	"CIS-Ubuntu-22-L1": true, "CIS-Ubuntu-22-L2": true,
	"CIS-Kubernetes-L1": true, "CIS-Kubernetes-L2": true,
	"FedRAMP-HIGH": true, "FedRAMP-MODERATE": true, "FedRAMP-LOW": true,
	"DoD-IL2": true, "DoD-IL4": true, "DoD-IL5": true, "DoD-IL6": true,
	"NIST-PQC-FIPS203": true, "NIST-PQC-FIPS204": true, "NIST-PQC-FIPS205": true,
	"NSM-10": true, "CISA-PQC": true,
	"all": true, "auto": true,
}

var knownScanLanes = map[string]bool{
	"sast": true, "dast": true, "sca": true, "secrets": true,
	"container": true, "iac": true, "sbom": true, "pqc": true,
	"stig": true, "network": true, "compliance": true,
	"vuln": true, "forensics": true,
}

type scopedField struct {
	allowList map[string]bool
	paramName string
}

var scopedFieldMap = map[string]scopedField{
	"target":    {allowList: knownOSTargets, paramName: "target OS/profile"},
	"scope":     {allowList: knownFrameworks, paramName: "compliance framework scope"},
	"framework": {allowList: knownFrameworks, paramName: "compliance framework"},
	"profile":   {allowList: knownFrameworks, paramName: "scan profile"},
	"baseline":  {allowList: knownFrameworks, paramName: "STIG baseline"},
}

func ValidateScopedToolArgs(args map[string]any, toolName string) *ValidationError {
	for fieldKey, fieldMeta := range scopedFieldMap {
		val, ok := args[fieldKey]
		if !ok {
			continue
		}
		strVal, ok := val.(string)
		if !ok || strVal == "" {
			continue
		}
		if !fieldMeta.allowList[strVal] {
			return &ValidationError{
				Code:    ErrCodeInvalidArg,
				Field:   fieldKey,
				Message: fmt.Sprintf("tool %q: %s value %q is not in the permitted taxonomy", toolName, fieldMeta.paramName, strVal),
			}
		}
	}
	if lanesVal, ok := args["lanes"]; ok {
		if lanes, ok := lanesVal.([]any); ok {
			for i, l := range lanes {
				if s, ok := l.(string); ok && s != "" && !knownScanLanes[s] {
					return &ValidationError{
						Code:    ErrCodeInvalidArg,
						Field:   fmt.Sprintf("lanes[%d]", i),
						Message: fmt.Sprintf("tool %q: scan lane %q is not in the permitted taxonomy", toolName, s),
					}
				}
			}
		}
	}
	return nil
}

func IsPermittedTarget(target string) bool    { return knownOSTargets[target] }
func IsPermittedFramework(framework string) bool { return knownFrameworks[framework] }

func RegisterCustomTarget(target string)       { knownOSTargets[target] = true }
func RegisterCustomFramework(framework string) { knownFrameworks[framework] = true }
