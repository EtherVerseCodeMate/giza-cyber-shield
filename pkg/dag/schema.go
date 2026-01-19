package dag

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"time"
)

// ============================================================================
// Node Type Definitions (Sephirot Hierarchy)
// ============================================================================

type NodeType string

const (
	NodeTypeMetaGovernance   NodeType = "meta_governance"    // Keter (10)    - Divine Will
	NodeTypeStrategicControl NodeType = "strategic_control"  // Chokmah (9)   - Wisdom
	NodeTypeTacticalControl  NodeType = "tactical_control"   // Binah (8)     - Understanding
	NodeTypeAsset            NodeType = "asset"              // Chesed (7)    - Mercy
	NodeTypeThreat           NodeType = "threat"             // Geburah (6)   - Severity
	NodeTypeFinding          NodeType = "finding"            // Tiphereth (5) - Balance
	NodeTypeRemediation      NodeType = "remediation"        // Netzach (4)   - Victory
	NodeTypeAttestation      NodeType = "attestation"        // Hod (3)       - Glory
	NodeTypeAgentAction      NodeType = "agent_action"       // Yesod (2)     - Foundation
	NodeTypeRawEvent         NodeType = "raw_event"          // Malkuth (1)   - Reality
)

type NodePolarity string

const (
	PolaritySun   NodePolarity = "sun"   // Active/Forward: Threats, Findings
	PolarityEarth NodePolarity = "earth" // Passive/Reverse: Assets, Controls
	PolaritySeed  NodePolarity = "seed"  // Neutral: Attestations, Logs
)

type SeverityLevel string

const (
	SeverityLow      SeverityLevel = "low"
	SeverityMedium   SeverityLevel = "medium"
	SeverityHigh     SeverityLevel = "high"
	SeverityCritical SeverityLevel = "critical"
)

type NodeStatus string

const (
	StatusOpen          NodeStatus = "open"
	StatusInProgress    NodeStatus = "in_progress"
	StatusRemediated    NodeStatus = "remediated"
	StatusAcceptedRisk  NodeStatus = "accepted_risk"
	StatusFalsePositive NodeStatus = "false_positive"
)

type NodeLifecycle string

const (
	LifecycleLive     NodeLifecycle = "live"
	LifecycleArchived NodeLifecycle = "archived"
	LifecycleExpired  NodeLifecycle = "expired"
)

type Sephira string

const (
	SephiraKeter     Sephira = "Keter"     // Crown (10)
	SephiraChokmah   Sephira = "Chokmah"   // Wisdom (9)
	SephiraBinah     Sephira = "Binah"     // Understanding (8)
	SephiraChesed    Sephira = "Chesed"    // Mercy (7)
	SephiraGeburah   Sephira = "Geburah"   // Severity (6)
	SephiraTiphereth Sephira = "Tiphereth" // Beauty (5)
	SephiraNetzach   Sephira = "Netzach"   // Victory (4)
	SephiraHod       Sephira = "Hod"       // Glory (3)
	SephiraYesod     Sephira = "Yesod"     // Foundation (2)
	SephiraMalkuth   Sephira = "Malkuth"   // Kingdom (1)
)

// ============================================================================
// Node State (Hypercube 16-vertex encoding)
// ============================================================================

type NodeState struct {
	Severity  SeverityLevel `json:"severity"`
	Verified  bool          `json:"verified"`
	Status    NodeStatus    `json:"status"`
	Lifecycle NodeLifecycle `json:"lifecycle"`
	StateCode *int          `json:"state_code,omitempty"` // 0-15 encoded
}

// EncodeHypercube returns 4-bit state encoding
func (s NodeState) EncodeHypercube() int {
	var code int
	if s.Severity == SeverityHigh || s.Severity == SeverityCritical {
		code |= 0b1000 // Bit 3
	}
	if s.Verified {
		code |= 0b0100 // Bit 2
	}
	if s.Status == StatusOpen || s.Status == StatusInProgress {
		code |= 0b0010 // Bit 1
	}
	if s.Lifecycle == LifecycleLive {
		code |= 0b0001 // Bit 0
	}
	return code
}

// ============================================================================
// Sephirot Metadata (Tree of Life position)
// ============================================================================

type SephirotMetadata struct {
	Sephira     Sephira  `json:"sephira"`
	Level       int      `json:"level"` // 1-10
	PathToKeter []string `json:"path_to_keter,omitempty"`
}

var SephirotLevels = map[Sephira]int{
	SephiraKeter:     10,
	SephiraChokmah:   9,
	SephiraBinah:     8,
	SephiraChesed:    7,
	SephiraGeburah:   6,
	SephiraTiphereth: 5,
	SephiraNetzach:   4,
	SephiraHod:       3,
	SephiraYesod:     2,
	SephiraMalkuth:   1,
}

var NodeTypeToSephira = map[NodeType]Sephira{
	NodeTypeMetaGovernance:   SephiraKeter,
	NodeTypeStrategicControl: SephiraChokmah,
	NodeTypeTacticalControl:  SephiraBinah,
	NodeTypeAsset:            SephiraChesed,
	NodeTypeThreat:           SephiraGeburah,
	NodeTypeFinding:          SephiraTiphereth,
	NodeTypeRemediation:      SephiraNetzach,
	NodeTypeAttestation:      SephiraHod,
	NodeTypeAgentAction:      SephiraYesod,
	NodeTypeRawEvent:         SephiraMalkuth,
}

var NodeTypeToPolarity = map[NodeType]NodePolarity{
	NodeTypeMetaGovernance:   PolaritySeed,
	NodeTypeStrategicControl: PolarityEarth,
	NodeTypeTacticalControl:  PolarityEarth,
	NodeTypeAsset:            PolarityEarth,
	NodeTypeThreat:           PolaritySun,
	NodeTypeFinding:          PolaritySun,
	NodeTypeRemediation:      PolarityEarth,
	NodeTypeAttestation:      PolaritySeed,
	NodeTypeAgentAction:      PolaritySeed,
	NodeTypeRawEvent:         PolaritySeed,
}

// ============================================================================
// Type-Specific Attributes
// ============================================================================

type AssetAttributes struct {
	Hostname       *string `json:"hostname,omitempty"`
	IPAddress      *string `json:"ip_address,omitempty"`
	AssetType      *string `json:"asset_type,omitempty"`      // host, container, vm, service
	Classification *string `json:"classification,omitempty"` // unclassified, cui, secret, top_secret
}

type ThreatAttributes struct {
	CVEID        *string  `json:"cve_id,omitempty"`
	CVSSScore    *float64 `json:"cvss_score,omitempty"`
	ThreatActor  *string  `json:"threat_actor,omitempty"`
	AttackVector *string  `json:"attack_vector,omitempty"`
}

type FindingAttributes struct {
	STIGID           *string `json:"stig_id,omitempty"`
	RuleID           *string `json:"rule_id,omitempty"`
	CheckContent     *string `json:"check_content,omitempty"`
	FixText          *string `json:"fix_text,omitempty"`
	SeverityOverride *string `json:"severity_override,omitempty"`
}

type ControlAttributes struct {
	ControlID            *string `json:"control_id,omitempty"`
	Framework            *string `json:"framework,omitempty"` // NIST_800-53, STIG, CIS, DISA
	ImplementationStatus *string `json:"implementation_status,omitempty"`
}

type AgentAttributes struct {
	AgentID         *string  `json:"agent_id,omitempty"`
	AgentType       *string  `json:"agent_type,omitempty"`
	TrustScore      *float64 `json:"trust_score,omitempty"`      // 0.0 - 1.0
	CulturalContext *string  `json:"cultural_context,omitempty"`
}

type NodeAttributes struct {
	Asset   *AssetAttributes   `json:"asset,omitempty"`
	Threat  *ThreatAttributes  `json:"threat,omitempty"`
	Finding *FindingAttributes `json:"finding,omitempty"`
	Control *ControlAttributes `json:"control,omitempty"`
	Agent   *AgentAttributes   `json:"agent,omitempty"`
}

// ============================================================================
// DAG Node (Complete)
// ============================================================================

type SchemaNode struct {
	// Identity (Immutable Header)
	ID      string   `json:"id"`
	Parents []string `json:"parents,omitempty"`

	// Classification (Sacred Geometry)
	NodeType NodeType         `json:"node_type"`
	Polarity NodePolarity     `json:"polarity"`
	State    NodeState        `json:"state"`
	Sephirot SephirotMetadata `json:"sephirot"`

	// Core Properties
	Action    string    `json:"action"`
	Symbol    string    `json:"symbol"`
	Timestamp time.Time `json:"timestamp"`

	// Type-Specific Data
	Attributes *NodeAttributes `json:"attributes,omitempty"`

	// Cryptography (Post-Quantum)
	PQCMetadata map[string]interface{} `json:"pqc_metadata,omitempty"`
	Hash        string                 `json:"hash"`
	Signature   *string                `json:"signature,omitempty"`
}

// ComputeHash calculates content hash for the node
func (n *SchemaNode) ComputeHash() (string, error) {
	// Create canonical representation
	canonical := struct {
		NodeType  NodeType         `json:"node_type"`
		Polarity  NodePolarity     `json:"polarity"`
		State     NodeState        `json:"state"`
		Sephirot  SephirotMetadata `json:"sephirot"`
		Action    string           `json:"action"`
		Symbol    string           `json:"symbol"`
		Timestamp time.Time        `json:"timestamp"`
	}{
		NodeType:  n.NodeType,
		Polarity:  n.Polarity,
		State:     n.State,
		Sephirot:  n.Sephirot,
		Action:    n.Action,
		Symbol:    n.Symbol,
		Timestamp: n.Timestamp,
	}

	data, err := json.Marshal(canonical)
	if err != nil {
		return "", err
	}

	hash := sha256.Sum256(data)
	return fmt.Sprintf("%x", hash), nil
}

// ============================================================================
// Edge Type Definitions
// ============================================================================

type EdgeType string

const (
	EdgeTypeCauses       EdgeType = "causes"
	EdgeTypeEnables      EdgeType = "enables"
	EdgeTypeRequires     EdgeType = "requires"
	EdgeTypeMitigates    EdgeType = "mitigates"
	EdgeTypeRemediates   EdgeType = "remediates"
	EdgeTypeAttests      EdgeType = "attests"
	EdgeTypeDerivesFrom  EdgeType = "derives_from"
	EdgeTypeImplements   EdgeType = "implements"
	EdgeTypeViolates     EdgeType = "violates"
	EdgeTypeCompliesWith EdgeType = "complies_with"
	EdgeTypeSpawns       EdgeType = "spawns"
	EdgeTypeSupersedes   EdgeType = "supersedes"
)

type EdgeDirectionality string

const (
	DirectionalityForward       EdgeDirectionality = "forward"
	DirectionalityBackward      EdgeDirectionality = "backward"
	DirectionalityBidirectional EdgeDirectionality = "bidirectional"
)

type MerbakaFlow string

const (
	FlowSunToSun     MerbakaFlow = "sun_to_sun"
	FlowEarthToEarth MerbakaFlow = "earth_to_earth"
	FlowSunToEarth   MerbakaFlow = "sun_to_earth"
	FlowEarthToSun   MerbakaFlow = "earth_to_sun"
	FlowSeedToAny    MerbakaFlow = "seed_to_any"
	FlowAnyToSeed    MerbakaFlow = "any_to_seed"
)

// ============================================================================
// Edge Weight
// ============================================================================

type EdgeWeight struct {
	Strength   float64 `json:"strength"`             // 0.0 - 1.0
	Confidence float64 `json:"confidence"`           // 0.0 - 1.0
	Priority   *int    `json:"priority,omitempty"`   // 1-5
}

// ============================================================================
// Sephirot Path (Tree of Life navigation)
// ============================================================================

type SephirotPath struct {
	FromLevel     int   `json:"from_level"`
	ToLevel       int   `json:"to_level"`
	Ascends       bool  `json:"ascends"`
	CrossesPillar *bool `json:"crosses_pillar,omitempty"`
}

// ============================================================================
// DAG Edge (Complete)
// ============================================================================

type SchemaEdge struct {
	// Identity
	ID   string `json:"id"`
	From string `json:"from"`
	To   string `json:"to"`

	// Semantics
	EdgeType       EdgeType            `json:"edge_type"`
	Directionality *EdgeDirectionality `json:"directionality,omitempty"`

	// Weight/Priority
	Weight EdgeWeight `json:"weight"`

	// Sacred Geometry Navigation
	MerbakaFlow  MerbakaFlow  `json:"merkaba_flow"`
	SephirotPath SephirotPath `json:"sephirot_path"`

	// Verification
	Verified  *bool     `json:"verified,omitempty"`
	Timestamp time.Time `json:"timestamp"`

	// Metadata
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// ComputeEdgeID calculates deterministic edge ID
func ComputeEdgeID(from, to string, edgeType EdgeType) string {
	data := fmt.Sprintf("%s:%s:%s", from, to, edgeType)
	hash := sha256.Sum256([]byte(data))
	return fmt.Sprintf("%x", hash)
}

// ============================================================================
// DAG Graph (Complete structure)
// ============================================================================

type DAGGraph struct {
	Nodes    []SchemaNode           `json:"nodes"`
	Edges    []SchemaEdge           `json:"edges"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// ============================================================================
// Helper Functions
// ============================================================================

// NewSchemaNode creates a properly initialized DAG node
func NewSchemaNode(nodeType NodeType, action, symbol string) *SchemaNode {
	sephira := NodeTypeToSephira[nodeType]
	polarity := NodeTypeToPolarity[nodeType]

	node := &SchemaNode{
		NodeType:  nodeType,
		Polarity:  polarity,
		Action:    action,
		Symbol:    symbol,
		Timestamp: time.Now(),
		State: NodeState{
			Severity:  SeverityLow,
			Verified:  false,
			Status:    StatusOpen,
			Lifecycle: LifecycleLive,
		},
		Sephirot: SephirotMetadata{
			Sephira: sephira,
			Level:   SephirotLevels[sephira],
		},
		PQCMetadata: make(map[string]interface{}),
	}

	// Compute hash
	hash, _ := node.ComputeHash()
	node.Hash = hash
	node.ID = hash

	// Encode state
	stateCode := node.State.EncodeHypercube()
	node.State.StateCode = &stateCode

	return node
}

// CreateSephirotPath computes path between two nodes
func CreateSephirotPath(fromNode, toNode *SchemaNode) SephirotPath {
	return SephirotPath{
		FromLevel: fromNode.Sephirot.Level,
		ToLevel:   toNode.Sephirot.Level,
		Ascends:   toNode.Sephirot.Level > fromNode.Sephirot.Level,
	}
}

// DetermineMerbakaFlow calculates Merkaba flow between nodes
func DetermineMerbakaFlow(fromPolarity, toPolarity NodePolarity) MerbakaFlow {
	switch {
	case fromPolarity == PolaritySun && toPolarity == PolaritySun:
		return FlowSunToSun
	case fromPolarity == PolarityEarth && toPolarity == PolarityEarth:
		return FlowEarthToEarth
	case fromPolarity == PolaritySun && toPolarity == PolarityEarth:
		return FlowSunToEarth
	case fromPolarity == PolarityEarth && toPolarity == PolaritySun:
		return FlowEarthToSun
	case fromPolarity == PolaritySeed:
		return FlowSeedToAny
	default:
		return FlowAnyToSeed
	}
}
