// Package mcp — Khepra MCP Tool Definitions
//
// This file registers all built-in MCP tools exposed by the Khepra server.
// Each tool maps to a capability of the platform:
//
//	QUADRANT 1 - DISCOVER
//	  - khepra_discover_endpoints    Discover network endpoints
//
//	QUADRANT 2 - ASSESS
//	  - khepra_run_compliance_scan   Trigger a STIG/CMMC compliance scan
//	  - khepra_query_stig            Query a STIG rule with full audit trail
//	  - khepra_get_anomaly_score     Get ML-powered threat score from SouHimBou
//
//	QUADRANT 3 - ROLLBACK
//	  - khepra_get_snapshot          Retrieve a compliance state snapshot
//	  - khepra_rollback_to_snapshot  Rollback system config to prior snapshot
//
//	QUADRANT 4 - PROVE
//	  - khepra_export_attestation    Export PQC-signed audit artifact for C3PAO
//	  - khepra_get_dag_chain         Get tamper-evident DAG audit chain
//	  - khepra_get_compliance_score  Get current compliance score with attestation
//
//	INTELLIGENCE
//	  - khepra_query_threat_intel    Query threat intelligence database
//	  - khepra_list_vulnerabilities  List active vulnerabilities for an endpoint
package mcp

// KhepraTools returns the built-in tool definitions for the Khepra MCP server.
// Handlers are wired in cmd/khepra-mcp/main.go using actual service calls.
func KhepraTools() []Tool {
	return []Tool{
		// ── DISCOVER ────────────────────────────────────────────────────────────

		{
			Name:        "khepra_discover_endpoints",
			Description: "Discover and inventory network endpoints, cloud assets, and infrastructure components. Returns asset list with OS, services, and initial risk profile.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"target": map[string]interface{}{
						"type":        "string",
						"description": "Target CIDR range, hostname, or cloud provider tag (e.g. '192.168.1.0/24', 'aws:tag:env=prod')",
					},
					"scan_depth": map[string]interface{}{
						"type":        "string",
						"enum":        []string{"surface", "standard", "deep"},
						"description": "Scan depth: surface (ping+port), standard (service detection), deep (OS fingerprint + vuln)",
						"default":     "standard",
					},
					"org_id": map[string]interface{}{
						"type":        "string",
						"description": "Organization ID for multi-tenant isolation",
					},
				},
				"required": []string{"target"},
			},
		},

		// ── ASSESS ──────────────────────────────────────────────────────────────

		{
			Name:        "khepra_run_compliance_scan",
			Description: "Trigger a CMMC/STIG compliance scan against discovered endpoints. Returns scan ID for async result polling. Each scan is cryptographically anchored in the DAG audit chain.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"scan_target": map[string]interface{}{
						"type":        "string",
						"description": "Endpoint ID or hostname to scan",
					},
					"framework": map[string]interface{}{
						"type":        "string",
						"enum":        []string{"CMMC_L1", "CMMC_L2", "CMMC_L3", "STIG_RHEL8", "STIG_WIN10", "NIST_800_171"},
						"description": "Compliance framework to scan against",
						"default":     "CMMC_L2",
					},
					"priority_controls": map[string]interface{}{
						"type":        "array",
						"items":       map[string]interface{}{"type": "string"},
						"description": "Optional list of specific control IDs to prioritize (e.g. ['AC.L2-3.1.1', 'SC.L2-3.13.10'])",
					},
				},
				"required": []string{"scan_target", "framework"},
			},
		},

		{
			Name:        "khepra_query_stig",
			Description: "Query a STIG rule by ID. Returns decomposed atomic requirements, severity, remediation steps, and compliance status. Response is PQC-signed and logged to the DAG audit chain.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"stig_id": map[string]interface{}{
						"type":        "string",
						"description": "STIG rule identifier (e.g. 'RHEL-08-010010', 'WN10-CC-000010')",
					},
					"include_remediation": map[string]interface{}{
						"type":        "boolean",
						"description": "Include step-by-step remediation instructions",
						"default":     true,
					},
					"include_process_timeline": map[string]interface{}{
						"type":        "boolean",
						"description": "Include Process Behavior Timeline for runtime verification (admin role required)",
						"default":     false,
					},
				},
				"required": []string{"stig_id"},
			},
		},

		{
			Name:        "khepra_get_anomaly_score",
			Description: "Query the SouHimBou ML service for an AI-powered anomaly/threat score for a given endpoint or event. Returns anomaly score, archetype influence breakdown, and recommended response.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"target_id": map[string]interface{}{
						"type":        "string",
						"description": "Endpoint ID or event ID to score",
					},
					"features": map[string]interface{}{
						"type":        "object",
						"description": "Optional feature overrides for the ML model (network flow stats, process events, etc.)",
					},
				},
				"required": []string{"target_id"},
			},
		},

		// ── ROLLBACK ─────────────────────────────────────────────────────────────

		{
			Name:        "khepra_get_snapshot",
			Description: "Retrieve a compliance state snapshot for an endpoint. Snapshots are created before every remediation action and cryptographically sealed in the DAG.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"endpoint_id": map[string]interface{}{
						"type":        "string",
						"description": "Endpoint to retrieve snapshot for",
					},
					"snapshot_id": map[string]interface{}{
						"type":        "string",
						"description": "Specific snapshot ID (omit for latest)",
					},
				},
				"required": []string{"endpoint_id"},
			},
		},

		// ── PROVE ────────────────────────────────────────────────────────────────

		{
			Name:        "khepra_export_attestation",
			Description: "Export a PQC-signed audit artifact for C3PAO/auditor review. Generates a tamper-evident package containing compliance evidence, DAG proof chain, and Dilithium-3 digital signature. Designed to satisfy CMMC AC.L2-3.1.1 and related controls.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"org_id": map[string]interface{}{
						"type":        "string",
						"description": "Organization ID",
					},
					"framework": map[string]interface{}{
						"type":        "string",
						"enum":        []string{"CMMC_L2", "CMMC_L3", "NIST_800_171"},
						"description": "Framework to generate attestation for",
					},
					"controls": map[string]interface{}{
						"type":        "array",
						"items":       map[string]interface{}{"type": "string"},
						"description": "Specific controls to include (omit for all assessed controls)",
					},
					"format": map[string]interface{}{
						"type":        "string",
						"enum":        []string{"json", "pdf", "eMASS"},
						"description": "Output format",
						"default":     "json",
					},
				},
				"required": []string{"org_id", "framework"},
			},
		},

		{
			Name:        "khepra_get_dag_chain",
			Description: "Retrieve the immutable DAG audit chain for an entity. Returns cryptographically-linked nodes proving an unbroken chain of custody for compliance evidence.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"entity_id": map[string]interface{}{
						"type":        "string",
						"description": "Entity ID (endpoint, scan, user) to retrieve chain for",
					},
					"limit": map[string]interface{}{
						"type":        "integer",
						"description": "Maximum number of nodes to return (default: 50)",
						"default":     50,
					},
				},
				"required": []string{"entity_id"},
			},
		},

		{
			Name:        "khepra_get_compliance_score",
			Description: "Get the current compliance score for an organization with PQC-signed attestation. Returns overall score, per-domain breakdown, and critical gaps.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"org_id": map[string]interface{}{
						"type":        "string",
						"description": "Organization ID",
					},
					"framework": map[string]interface{}{
						"type":    "string",
						"enum":    []string{"CMMC_L1", "CMMC_L2", "CMMC_L3", "NIST_800_171"},
						"default": "CMMC_L2",
					},
				},
				"required": []string{"org_id"},
			},
		},

		// ── CMMC AUTOPILOT ───────────────────────────────────────────────────────
		// Phase 00-06 workflow tools. BoundaryGuard enforces scope on Phase 03+ calls.

		{
			Name:        "khepra_seed_engagement",
			Description: "Phase 00: Create a new CMMC assessment engagement from a CAGE code and seed networks. Validates CAGE code format, sets cmmc_level_target, and returns an engagement_id for use in subsequent phases.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"cage_code": map[string]interface{}{
						"type":        "string",
						"description": "Five-character CAGE code from SAM.gov (e.g. '7AB12')",
						"pattern":     "^[A-Z0-9]{5}$",
					},
					"cmmc_level": map[string]interface{}{
						"type":        "integer",
						"enum":        []int{1, 2, 3},
						"description": "Target CMMC level (1=FAR, 2=NIST 800-171, 3=NIST 800-172)",
						"default":     2,
					},
					"target_type": map[string]interface{}{
						"type": "string",
						"enum": []string{
							"prime_contractor", "subcontractor",
							"dib_contractor", "cloud_service_provider",
						},
					},
					"seed_networks": map[string]interface{}{
						"type":        "array",
						"items":       map[string]interface{}{"type": "string"},
						"description": "CIDR ranges, hostnames, or cloud tags for Phase 01 discovery seed (e.g. ['10.0.0.0/8', 'aws:tag:env=prod'])",
					},
					"contract_number": map[string]interface{}{
						"type":        "string",
						"description": "Optional DoD contract number (e.g. 'FA8750-23-C-0001')",
					},
				},
				"required": []string{"cage_code", "cmmc_level", "target_type", "seed_networks"},
			},
		},

		{
			Name:        "khepra_propose_boundary",
			Description: "Phase 02: Submit the agent's discovery output as a BoundaryProposal for COMPLIANCE_OFFICER (Dwennimmen) review. The proposal lists all discovered assets with per-asset scope recommendations and reasoning. Returns proposal_id.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"engagement_id": map[string]interface{}{
						"type":        "string",
						"description": "Engagement UUID from khepra_seed_engagement",
					},
					"discovery_dag_node": map[string]interface{}{
						"type":        "string",
						"description": "SHA-256 DAG node ID of the discovery run that produced this proposal",
					},
					"proposed_assets": map[string]interface{}{
						"type":        "array",
						"description": "Array of discovered assets with per-asset scope recommendation and reasoning",
						"items": map[string]interface{}{
							"type": "object",
							"required": []string{"asset_type", "cmmc_scope", "agent_reasoning"},
							"properties": map[string]interface{}{
								"hostname":       map[string]interface{}{"type": "string"},
								"ip_addresses":   map[string]interface{}{"type": "array", "items": map[string]interface{}{"type": "string"}},
								"asset_type":     map[string]interface{}{"type": "string"},
								"platform":       map[string]interface{}{"type": "string"},
								"os":             map[string]interface{}{"type": "string"},
								"cmmc_scope":     map[string]interface{}{"type": "boolean", "description": "Agent recommends in-scope (true) or out-of-scope"},
								"agent_reasoning": map[string]interface{}{"type": "string"},
							},
						},
					},
					"agent_confidence": map[string]interface{}{
						"type":        "number",
						"minimum":     0,
						"maximum":     1,
						"description": "Agent's confidence in the proposed boundary (0.0-1.0)",
					},
					"agent_justification": map[string]interface{}{
						"type":        "string",
						"description": "Natural language justification for the overall boundary recommendation",
					},
				},
				"required": []string{"engagement_id", "discovery_dag_node", "proposed_assets", "agent_confidence", "agent_justification"},
			},
		},

		{
			Name:        "khepra_approve_boundary",
			Description: "Phase 02 governance gate: COMPLIANCE_OFFICER (Dwennimmen role required) signs the BoundaryProposal with ML-DSA-65. Returns a BoundaryApproval with PQC signature that unlocks Phase 03. ONLY callers with SMARTRole=Dwennimmen may call this.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"engagement_id": map[string]interface{}{
						"type":        "string",
						"description": "Engagement UUID",
					},
					"boundary_proposal_id": map[string]interface{}{
						"type":        "string",
						"description": "Proposal UUID from khepra_propose_boundary",
					},
					"asset_decisions": map[string]interface{}{
						"type":        "array",
						"description": "Per-asset human governance decisions",
						"items": map[string]interface{}{
							"type": "object",
							"required": []string{"asset_index", "decision"},
							"properties": map[string]interface{}{
								"asset_index": map[string]interface{}{"type": "integer", "description": "Index into proposed_assets array"},
								"decision":    map[string]interface{}{"type": "string", "enum": []string{"include", "exclude", "defer"}},
								"rationale":   map[string]interface{}{"type": "string"},
							},
						},
					},
					"reviewer_notes": map[string]interface{}{
						"type":        "string",
						"description": "Optional overall notes on the boundary review",
					},
				},
				"required": []string{"engagement_id", "boundary_proposal_id", "asset_decisions"},
			},
		},

		{
			Name:        "khepra_export_audit_package",
			Description: "Phase 06: Generate and PQC-sign a CMMC audit package in the requested format. The package includes the full evidence chain (DAG root → leaf), all findings, and a POAM. Returns a .khepra manifest and download path.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"engagement_id": map[string]interface{}{
						"type":        "string",
						"description": "Engagement UUID",
					},
					"format": map[string]interface{}{
						"type":        "string",
						"enum":        []string{"oscal_1_1_2", "emass", "c3pao_pdf", "khepra_bundle"},
						"description": "Export format: oscal_1_1_2 for C3PAO submission, emass for DoD system import, c3pao_pdf for human review",
						"default":     "oscal_1_1_2",
					},
					"include_poam": map[string]interface{}{
						"type":        "boolean",
						"description": "Include the Plan of Action & Milestones in the package (required for C3PAO submission)",
						"default":     true,
					},
				},
				"required": []string{"engagement_id", "format"},
			},
		},

		// ── INTELLIGENCE ──────────────────────────────────────────────────────────

		{
			Name:        "khepra_query_threat_intel",
			Description: "Query the Khepra threat intelligence database for IOCs, TTPs, and threat actor profiles. Integrates with STIX/TAXII feeds via the SouHimBou threat engine.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"query": map[string]interface{}{
						"type":        "string",
						"description": "Threat indicator to look up (IP, domain, hash, CVE, MITRE ATT&CK ID)",
					},
					"sources": map[string]interface{}{
						"type":        "array",
						"items":       map[string]interface{}{"type": "string"},
						"description": "Optional: limit to specific intel sources (e.g. ['cisa', 'nvd', 'mitre'])",
					},
				},
				"required": []string{"query"},
			},
		},
	}
}
