package souhimbou

import (
	"fmt"
	"time"
)

// =============================================================================
// LEGACY ROLES (preserved for backwards compatibility)
// =============================================================================

// Role is the original three-tier role hierarchy.
type Role string

const (
	RoleViewer   Role = "viewer"
	RoleOperator Role = "operator"
	RoleAdmin    Role = "admin"
)

// User represents an authenticated entity in SouHimBou
type User struct {
	ID    string
	Email string
	Role  Role

	// SMARTRole is the CMMC Autopilot Workbench role (SMART-on-KHEPRA).
	// Set alongside the legacy Role for workbench sessions.
	SMARTRole SMARTKhepraRole
}

// Command represents an action requested by a user
type Command struct {
	Action       string
	Target       string
	RequiredRole Role
}

// AuthorizationError indicates a permission failure
type AuthorizationError struct {
	User     string
	Role     Role
	Required Role
}

func (e *AuthorizationError) Error() string {
	return fmt.Sprintf("access denied for user %s (role: %s): requires %s", e.User, e.Role, e.Required)
}

// Authorize verifies if a user has sufficient permissions for a command
func Authorize(user *User, cmd *Command) error {
	if !hasPermission(user.Role, cmd.RequiredRole) {
		return &AuthorizationError{
			User:     user.Email,
			Role:     user.Role,
			Required: cmd.RequiredRole,
		}
	}
	return nil
}

// hasPermission checks role hierarchy (Admin > Operator > Viewer)
func hasPermission(userRole, requiredRole Role) bool {
	if userRole == RoleAdmin {
		return true
	}
	if userRole == RoleOperator && (requiredRole == RoleOperator || requiredRole == RoleViewer) {
		return true
	}
	if userRole == RoleViewer && requiredRole == RoleViewer {
		return true
	}
	return false
}

// AuditLogEntry represents a recorded action
type AuditLogEntry struct {
	Timestamp time.Time
	UserEmail string
	Action    string
	Success   bool
}

// =============================================================================
// SMART-ON-KHEPRA ROLES (CMMC Autopilot Workbench)
// =============================================================================

// SMARTKhepraRole is an Adinkra symbol encoding a CMMC workbench authorization scope.
// Modeled after SMART-on-FHIR launch context scopes.
//
// Mapping to the legacy Role hierarchy for mixed-mode deployments:
//   Chokmah    → maps to RoleOperator (can trigger discovery)
//   Eban       → maps to RoleViewer   (read-only)
//   Nkyinkyim  → maps to RoleOperator (executes remediation)
//   Dwennimmen → maps to RoleAdmin    (governance gate; sole boundary signer)
//   Fawohodie  → maps to RoleOperator (implements controls)
type SMARTKhepraRole string

const (
	// SMARTChokmah — CONSULTANT. Initiates engagements, triggers Phase 00 seed intake
	// and Phase 01 discovery. Cannot sign boundary or approve findings.
	SMARTChokmah SMARTKhepraRole = "Chokmah"

	// SMARTEban — AUDITOR. Read-only observer across all seven phases.
	// Suitable for C3PAO reviewers granted access via c3pao_access_tokens.
	SMARTEban SMARTKhepraRole = "Eban"

	// SMARTNkyinkyim — OPERATOR. Executes approved remediation playbooks
	// in Phase 03-04. Cannot modify boundary or approve findings.
	SMARTNkyinkyim SMARTKhepraRole = "Nkyinkyim"

	// SMARTDwennimmen — COMPLIANCE_OFFICER. The sole role authorized to produce
	// a PQC-signed BoundaryApproval (Phase 02 governance gate). Without a
	// Dwennimmen signature, BoundaryGuard blocks all Phase 03+ MCP tool calls.
	SMARTDwennimmen SMARTKhepraRole = "Dwennimmen"

	// SMARTFawohodie — ENGINEER. Implements controls and collects evidence
	// during Phase 03-04. Can mark findings and update POAMs.
	SMARTFawohodie SMARTKhepraRole = "Fawohodie"
)

// SMARTRoleDisplayName returns the human-readable role name for UI display.
func SMARTRoleDisplayName(r SMARTKhepraRole) string {
	switch r {
	case SMARTChokmah:
		return "Consultant"
	case SMARTEban:
		return "Auditor"
	case SMARTNkyinkyim:
		return "Operator"
	case SMARTDwennimmen:
		return "Compliance Officer"
	case SMARTFawohodie:
		return "Engineer"
	}
	return "Unknown"
}

// ToLegacyRole maps a SMART-on-KHEPRA role to the nearest legacy Role
// for systems that have not yet been migrated to the workbench RBAC model.
func (r SMARTKhepraRole) ToLegacyRole() Role {
	switch r {
	case SMARTDwennimmen:
		return RoleAdmin
	case SMARTChokmah, SMARTNkyinkyim, SMARTFawohodie:
		return RoleOperator
	case SMARTEban:
		return RoleViewer
	}
	return RoleViewer
}

// CanSignBoundary returns true only for SMARTDwennimmen.
// This is the hard enforcement gate for the Phase 02 governance event.
func (r SMARTKhepraRole) CanSignBoundary() bool {
	return r == SMARTDwennimmen
}

// CanWrite returns true if the role may create or modify records in the given phase.
// Phase names match WorkflowPhase constants in pkg/cmmc/schema.go.
func (r SMARTKhepraRole) CanWrite(phase string) bool {
	switch r {
	case SMARTEban:
		return false
	case SMARTChokmah:
		return phase == "00_seed_intake" || phase == "01_discovery"
	case SMARTDwennimmen:
		return phase == "02_boundary_proposal" || phase == "06_audit_export"
	case SMARTNkyinkyim, SMARTFawohodie:
		return phase == "03_scoped_assessment" ||
			phase == "04_evidence_collection" ||
			phase == "05_findings_poam"
	}
	return false
}

// SMARTAuthorizationError indicates a SMART-on-KHEPRA permission failure.
type SMARTAuthorizationError struct {
	UserID       string
	Role         SMARTKhepraRole
	RequiredRole SMARTKhepraRole
	Action       string
}

func (e *SMARTAuthorizationError) Error() string {
	return fmt.Sprintf(
		"CMMC workbench access denied: user %s (role: %s) cannot perform %q — requires %s",
		e.UserID, e.Role, e.Action, e.RequiredRole,
	)
}

// AuthorizeSMART verifies a SMART-on-KHEPRA role against a required role.
func AuthorizeSMART(userID string, userRole SMARTKhepraRole, required SMARTKhepraRole, action string) error {
	if userRole == required || (required != SMARTDwennimmen && userRole == SMARTDwennimmen) {
		return nil
	}
	return &SMARTAuthorizationError{
		UserID:       userID,
		Role:         userRole,
		RequiredRole: required,
		Action:       action,
	}
}
