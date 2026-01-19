/**
 * Khepra DAG Node/Edge TypeScript Types
 * Generated from Sacred Geometry JSON Schema
 *
 * Sephirot-aligned hierarchy with Merkaba polarity system
 */

// ============================================================================
// Node Type Definitions (Sephirot Hierarchy)
// ============================================================================

export type NodeType =
  | 'meta_governance'      // Keter (10)    - Divine Will: DoD Policies, NIST Framework
  | 'strategic_control'    // Chokmah (9)   - Wisdom: STIG Baselines, Frameworks
  | 'tactical_control'     // Binah (8)     - Understanding: Specific STIGs
  | 'asset'                // Chesed (7)    - Mercy: Hosts, Containers, Apps
  | 'threat'               // Geburah (6)   - Severity: CVEs, Vulns
  | 'finding'              // Tiphereth (5) - Balance: STIG findings
  | 'remediation'          // Netzach (4)   - Victory: Fixes, Patches
  | 'attestation'          // Hod (3)       - Glory: Audit logs, Proofs
  | 'agent_action'         // Yesod (2)     - Foundation: AI decisions
  | 'raw_event';           // Malkuth (1)   - Reality: FIM, Logs, Metrics

export type NodePolarity =
  | 'sun'    // Active/Forward Spin: Threats, Findings, Violations
  | 'earth'  // Passive/Reverse Spin: Assets, Controls, Remediations
  | 'seed';  // Neutral/Stillness: Attestations, Logs, Observations

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';
export type NodeStatus = 'open' | 'in_progress' | 'remediated' | 'accepted_risk' | 'false_positive';
export type NodeLifecycle = 'live' | 'archived' | 'expired';

export type Sephira =
  | 'Keter'      // Crown - Divine Will
  | 'Chokmah'    // Wisdom
  | 'Binah'      // Understanding
  | 'Chesed'     // Mercy
  | 'Geburah'    // Severity
  | 'Tiphereth'  // Beauty
  | 'Netzach'    // Victory
  | 'Hod'        // Glory
  | 'Yesod'      // Foundation
  | 'Malkuth';   // Kingdom

export type AssetType = 'host' | 'container' | 'vm' | 'service';
export type Classification = 'unclassified' | 'cui' | 'secret' | 'top_secret';
export type Framework = 'NIST_800-53' | 'STIG' | 'CIS' | 'DISA';

// ============================================================================
// Node State (Hypercube 16-vertex encoding)
// ============================================================================

export interface NodeState {
  severity: SeverityLevel;       // Hypercube bit 3
  verified: boolean;             // Hypercube bit 2
  status: NodeStatus;            // Hypercube bit 1
  lifecycle: NodeLifecycle;      // Hypercube bit 0
  state_code?: number;           // 0-15 encoded state
}

// ============================================================================
// Sephirot Metadata (Tree of Life position)
// ============================================================================

export interface SephirotMetadata {
  sephira: Sephira;
  level: number;                 // 1-10 (1=Malkuth/bottom, 10=Keter/top)
  path_to_keter?: string[];      // Upward path to root governance
}

// ============================================================================
// Type-Specific Attributes
// ============================================================================

export interface AssetAttributes {
  hostname?: string;
  ip_address?: string;
  asset_type?: AssetType;
  classification?: Classification;
}

export interface ThreatAttributes {
  cve_id?: string;
  cvss_score?: number;
  threat_actor?: string;
  attack_vector?: string;
}

export interface FindingAttributes {
  stig_id?: string;
  rule_id?: string;
  check_content?: string;
  fix_text?: string;
  severity_override?: string;
}

export interface ControlAttributes {
  control_id?: string;
  framework?: Framework;
  implementation_status?: string;
}

export interface AgentAttributes {
  agent_id?: string;
  agent_type?: string;
  trust_score?: number;          // 0.0 - 1.0
  cultural_context?: string;
}

export interface NodeAttributes {
  asset?: AssetAttributes;
  threat?: ThreatAttributes;
  finding?: FindingAttributes;
  control?: ControlAttributes;
  agent?: AgentAttributes;
}

// ============================================================================
// DAG Node (Complete)
// ============================================================================

export interface DAGNode {
  // Identity (Immutable Header)
  id: string;                    // Content hash (SHA-256) or Adinkra-encoded
  parents?: string[];            // Parent node IDs (DAG links)

  // Classification (Sacred Geometry)
  node_type: NodeType;
  polarity: NodePolarity;
  state: NodeState;
  sephirot: SephirotMetadata;

  // Core Properties
  action: string;                // Human-readable action
  symbol: string;                // Adinkra or Sacred Rune (Unicode)
  timestamp: string;             // ISO8601

  // Type-Specific Data
  attributes?: NodeAttributes;

  // Cryptography (Post-Quantum)
  pqc_metadata?: Record<string, any>;
  hash: string;                  // Content hash (immutability proof)
  signature?: string;            // Dilithium signature (base64)
}

// ============================================================================
// Edge Type Definitions
// ============================================================================

export type EdgeType =
  | 'causes'          // A causes B
  | 'enables'         // A enables B
  | 'requires'        // A requires B
  | 'mitigates'       // A mitigates B
  | 'remediates'      // A remediates B
  | 'attests'         // A attests B
  | 'derives_from'    // A derives from B
  | 'implements'      // A implements B
  | 'violates'        // A violates B
  | 'complies_with'   // A complies with B
  | 'spawns'          // A spawns B
  | 'supersedes';     // A supersedes B

export type EdgeDirectionality = 'forward' | 'backward' | 'bidirectional';

export type MerbakaFlow =
  | 'sun_to_sun'      // Threat → Threat
  | 'earth_to_earth'  // Control → Control
  | 'sun_to_earth'    // Threat → Control (mitigation)
  | 'earth_to_sun'    // Control → Threat (prevention)
  | 'seed_to_any'     // Observation → Anything
  | 'any_to_seed';    // Anything → Observation

// ============================================================================
// Edge Weight
// ============================================================================

export interface EdgeWeight {
  strength: number;              // 0.0 - 1.0 (relationship strength)
  confidence: number;            // 0.0 - 1.0 (confidence level)
  priority?: number;             // 1-5 (processing priority)
}

// ============================================================================
// Sephirot Path (Tree of Life navigation)
// ============================================================================

export interface SephirotPath {
  from_level: number;            // 1-10
  to_level: number;              // 1-10
  ascends: boolean;              // True if moving toward Keter (up)
  crosses_pillar?: boolean;      // True if crossing Severity↔Mercy
}

// ============================================================================
// DAG Edge (Complete)
// ============================================================================

export interface DAGEdge {
  // Identity
  id: string;                    // Edge ID (hash of from+to+type)
  from: string;                  // Source node ID
  to: string;                    // Target node ID

  // Semantics
  edge_type: EdgeType;
  directionality?: EdgeDirectionality;

  // Weight/Priority
  weight: EdgeWeight;

  // Sacred Geometry Navigation
  merkaba_flow: MerbakaFlow;
  sephirot_path: SephirotPath;

  // Verification
  verified?: boolean;
  timestamp: string;             // ISO8601

  // Metadata
  metadata?: Record<string, any>;
}

// ============================================================================
// DAG Graph (Complete structure)
// ============================================================================

export interface DAGGraph {
  nodes: DAGNode[];
  edges: DAGEdge[];
  metadata?: {
    version?: string;
    created?: string;
    creator?: string;
    description?: string;
  };
}

// ============================================================================
// Utility Types for Filtering
// ============================================================================

export type NodeFilter = {
  node_types?: NodeType[];
  polarities?: NodePolarity[];
  severities?: SeverityLevel[];
  sephirot_levels?: number[];
  verified_only?: boolean;
  lifecycle?: NodeLifecycle[];
};

export type EdgeFilter = {
  edge_types?: EdgeType[];
  merkaba_flows?: MerbakaFlow[];
  min_strength?: number;
  verified_only?: boolean;
};

// ============================================================================
// Helper Functions
// ============================================================================

export const SEPHIROT_LEVELS: Record<Sephira, number> = {
  Keter: 10,
  Chokmah: 9,
  Binah: 8,
  Chesed: 7,
  Geburah: 6,
  Tiphereth: 5,
  Netzach: 4,
  Hod: 3,
  Yesod: 2,
  Malkuth: 1,
};

export const NODE_TYPE_TO_SEPHIRA: Record<NodeType, Sephira> = {
  meta_governance: 'Keter',
  strategic_control: 'Chokmah',
  tactical_control: 'Binah',
  asset: 'Chesed',
  threat: 'Geburah',
  finding: 'Tiphereth',
  remediation: 'Netzach',
  attestation: 'Hod',
  agent_action: 'Yesod',
  raw_event: 'Malkuth',
};

export const NODE_TYPE_TO_POLARITY: Record<NodeType, NodePolarity> = {
  meta_governance: 'seed',
  strategic_control: 'earth',
  tactical_control: 'earth',
  asset: 'earth',
  threat: 'sun',
  finding: 'sun',
  remediation: 'earth',
  attestation: 'seed',
  agent_action: 'seed',
  raw_event: 'seed',
};

export function encodeHypercubeState(state: NodeState): number {
  const severityBit = state.severity === 'high' || state.severity === 'critical' ? 1 : 0;
  const verifiedBit = state.verified ? 1 : 0;
  const statusBit = state.status === 'open' || state.status === 'in_progress' ? 1 : 0;
  const lifecycleBit = state.lifecycle === 'live' ? 1 : 0;

  return (severityBit << 3) | (verifiedBit << 2) | (statusBit << 1) | lifecycleBit;
}

export function decodeHypercubeState(stateCode: number): Partial<NodeState> {
  return {
    severity: (stateCode & 0b1000) ? 'high' : 'low',
    verified: Boolean(stateCode & 0b0100),
    status: (stateCode & 0b0010) ? 'open' : 'remediated',
    lifecycle: (stateCode & 0b0001) ? 'live' : 'archived',
    state_code: stateCode,
  };
}

export function createSephirotPath(fromNode: DAGNode, toNode: DAGNode): SephirotPath {
  return {
    from_level: fromNode.sephirot.level,
    to_level: toNode.sephirot.level,
    ascends: toNode.sephirot.level > fromNode.sephirot.level,
    crosses_pillar: checkPillarCrossing(fromNode.node_type, toNode.node_type),
  };
}

function checkPillarCrossing(fromType: NodeType, toType: NodeType): boolean {
  // Left Pillar (Severity): threat, finding
  // Right Pillar (Mercy): asset, remediation
  // Middle Pillar (Balance): all others
  const leftPillar = new Set<NodeType>(['threat', 'finding']);
  const rightPillar = new Set<NodeType>(['asset', 'remediation']);

  const fromLeft = leftPillar.has(fromType);
  const fromRight = rightPillar.has(fromType);
  const toLeft = leftPillar.has(toType);
  const toRight = rightPillar.has(toType);

  return (fromLeft && toRight) || (fromRight && toLeft);
}
