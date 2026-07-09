// Package models holds the CMMC compliance graph data model.
//
// INTERNAL NAMING CONVENTION (§10 rule):
//   Internal type names and constants follow the Sacred Geometry DAG node schema
//   (docs/intel-cuops/SACRED_GEOMETRY_NODE_SCHEMA.md). These names appear only in
//   Go identifiers and code comments — NEVER in strings rendered to the user.
//   Every user-facing string MUST use NodeKind.UILabel() or an explicit §10 label.
package models

import (
	"fmt"
	"math"
	"strings"
	"sync"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/stig"
)

// NodeKind is the internal Sephirot-based node type classification.
// Constant names use the Sacred Geometry vocabulary (Keter, Chokmah, …) because
// that is the backend schema — see SACRED_GEOMETRY_NODE_SCHEMA.md §1.
// Call UILabel() for every user-facing string.
type NodeKind uint8

const (
	// NodeKeter — internal: meta_governance  — UI §10: "Governance Root"
	NodeKeter NodeKind = iota
	// NodeChokmah — internal: strategic_control — UI §10: "Domain (Control Family)"
	NodeChokmah
	// NodeBinah — internal: tactical_control — UI §10: "Practice"
	NodeBinah
	// NodeChesed — internal: asset — UI §10: "Asset"
	NodeChesed
	// NodeGeburah — internal: threat — UI §10: "Threat / Vulnerability"
	NodeGeburah
	// NodeTiphereth — internal: finding — UI §10: "Finding"
	NodeTiphereth
	// NodeNetzach — internal: remediation — UI §10: "Remediation"
	NodeNetzach
	// NodeHod — internal: attestation — UI §10: "Verification / Proof"
	NodeHod
	// NodeYesod — internal: agent_action — UI §10: "System Action"
	NodeYesod
	// NodeMalkuth — internal: raw_event — UI §10: "Event Log"
	NodeMalkuth
)

// UILabel returns the §10 Presentation Layer Translation Table label for this node kind.
// This is the ONLY string that should appear in any rendered UI surface for node types.
func (k NodeKind) UILabel() string {
	switch k {
	case NodeKeter:
		return "Governance Root"
	case NodeChokmah:
		return "Domain"
	case NodeBinah:
		return "Practice"
	case NodeChesed:
		return "Asset"
	case NodeGeburah:
		return "Threat / Vulnerability"
	case NodeTiphereth:
		return "Finding"
	case NodeNetzach:
		return "Remediation"
	case NodeHod:
		return "Verification / Proof"
	case NodeYesod:
		return "System Action"
	case NodeMalkuth:
		return "Event Log"
	}
	return "Node"
}

// merkabaPolar is the internal polarity classification (Sun/Earth/Seed).
// Never exposed in UI — governs edge color semantics and physics attraction.
type merkabaPolar uint8

const (
	polarSun   merkabaPolar = iota // threats, findings — active/dangerous
	polarEarth                     // assets, controls, remediations — protective
	polarSeed                      // governance, attestations, events — neutral
)

// HypercubeState encodes the 4-bit Hypercube vertex per SACRED_GEOMETRY_NODE_SCHEMA §3.
// Bits: [3]=Severity [2]=Verified [1]=Status [0]=Lifecycle
type HypercubeState struct {
	Severity  bool // bit 3: false=Low, true=High
	Verified  bool // bit 2: false=No,  true=Yes
	Status    bool // bit 1: false=Fixed, true=Open
	Lifecycle bool // bit 0: false=Archived, true=Live
}

// StateCode returns the 4-bit integer representation (0–15).
// This integer is NEVER displayed directly to users per §10.
func (s HypercubeState) StateCode() uint8 {
	var c uint8
	if s.Severity {
		c |= 0x08
	}
	if s.Verified {
		c |= 0x04
	}
	if s.Status {
		c |= 0x02
	}
	if s.Lifecycle {
		c |= 0x01
	}
	return c
}

// FindingStatus per §0.5 canonical data model in CMMC_Quran_v2.md
type FindingStatus string

const (
	StatusMet           FindingStatus = "met"
	StatusNotMet        FindingStatus = "not_met"
	StatusNotApplicable FindingStatus = "not_applicable"
	StatusNotReviewed   FindingStatus = "not_reviewed"
	StatusUnknown       FindingStatus = ""
)

// GlowKind maps to the §10 / CMMC Quran "Node Glow Semantics" section.
// Used by the widget layer to pick animation style; never shown as text.
type GlowKind uint8

const (
	GlowRedFast    GlowKind = iota // CAT I / SPRS weight 5 — fast red pulse, blocking
	GlowOrangeSlow                 // CAT II / SPRS weight 3 — slow orange pulse
	GlowYellow                     // Contractor Risk Managed — yellow static
	GlowGreen                      // MET — green static
	GlowWhite                      // Attestation — white indicator
	GlowBlueOutline                // Security Protection Asset — blue outline
	GlowGray                       // Not yet scanned
	GlowRoot                       // Governance Root — NXBlue
)

// GraphNode is one vertex in the CMMC compliance graph.
type GraphNode struct {
	ID    string
	Kind  NodeKind
	polar merkabaPolar
	State HypercubeState

	// Physics state (force-directed layout, graph-space units)
	X, Y   float32
	VX, VY float32
	Pinned bool // if true, physics does not move this node

	// User-facing label (§10-compliant; never contains Sephirot vocabulary)
	Label string

	// CMMC compliance fields
	DomainCode string        // "AC", "AT", …
	PracticeID string        // "AC.L2-3.1.1"
	SPRSWeight int           // 1, 3, or 5
	Status     FindingStatus // StatusMet / StatusNotMet / …
	References []string      // cross-refs from the 25,185-mapping DB

	// Finding-specific fields
	FindingID   string
	SeverityRaw string // "CAT I", "CAT II", "CAT III" — raw stig.Severity value
	Description string
	Remediation string
	CheckedAt   time.Time

	// Asset-specific fields
	Hostname  string
	IPAddress string
	OS        string

	// FixArgv is the remediation command matrix from the STIG check table.
	// Each inner slice is one argv-safe command (no shell; no metacharacters).
	// nil means no automated fix is available — manual remediation required.
	// Populated by ingestReport from stig.GetFixArgv(FindingID).
	FixArgv [][]string

	// STIGFamily is the STIG_File value for Tier 4 aggregate nodes created by
	// LoadNotAssessedBaseline.  Empty for all other node kinds.
	STIGFamily string

	// Visual glow hint (computed, never displayed as text)
	Glow GlowKind

	// NodeRadius in graph-space units
	Radius float32
}

// computeGlow derives the node's glow kind from its status and weight.
func (n *GraphNode) computeGlow() GlowKind {
	switch n.Kind {
	case NodeKeter:
		return GlowRoot
	case NodeHod:
		return GlowWhite
	case NodeChesed:
		return GlowBlueOutline
	}
	switch n.Status {
	case StatusMet:
		return GlowGreen
	case StatusNotApplicable:
		return GlowGray
	case StatusNotMet:
		switch n.SPRSWeight {
		case 5:
			return GlowRedFast
		case 3:
			return GlowOrangeSlow
		default:
			return GlowYellow
		}
	}
	return GlowGray
}

// graphEdge is a directed edge in the compliance graph.
// edgeType uses Sacred Geometry vocabulary (backend only).
type graphEdge struct {
	FromID   string
	ToID     string
	edgeType string  // "derives_from", "violates", "mitigates", "implements", …
	Strength float32 // 0.0–1.0, governs spring rest-length scaling
}

// ComplianceGraphModel holds the live state of the CMMC compliance graph.
// All mutations must happen under the embedded RWMutex.
type ComplianceGraphModel struct {
	mu sync.RWMutex

	Nodes    []*GraphNode
	Edges    []*graphEdge
	nodeByID map[string]*GraphNode

	// SPRS accounting
	SPRSScore        int
	countedPractices map[string]bool // dedup: only deduct once per CMMC practice

	// Scan metadata
	LastScanTime time.Time
	LastScanHost string
	ScanRunning  bool

	// Assessment target
	AssessmentTarget time.Time

	// Phase (§0.6 state machine, 0 = pre-scope, 8 = evidence)
	CurrentPhase int

	// Coverage disclaimers per §4 Phase 4 error state (framework → human-readable coverage)
	FrameworkCoverage map[string]string

	// familyTotalRules stores STIG_File → total rule count from the DB, set by
	// LoadNotAssessedBaseline.  Used by ResetFindings to restore node descriptions.
	familyTotalRules map[string]int
}

// NewComplianceGraphModel creates an empty model seeded with the Governance Root
// and 14 CMMC L2 Domain nodes, ready to receive findings after a scan.
func NewComplianceGraphModel() *ComplianceGraphModel {
	m := &ComplianceGraphModel{
		SPRSScore:        110,
		countedPractices: make(map[string]bool),
		nodeByID:         make(map[string]*GraphNode),
		FrameworkCoverage: make(map[string]string),
		familyTotalRules:  make(map[string]int),
	}
	m.buildInitialGraph()
	return m
}

// buildInitialGraph seeds the Governance Root and 14 Domain nodes.
// Domain nodes are arranged in a circle; the root is pinned at origin.
func (m *ComplianceGraphModel) buildInitialGraph() {
	root := &GraphNode{
		ID:     "keter_root",
		Kind:   NodeKeter,
		polar:  polarSeed,
		Label:  "Governance Root", // §10
		Pinned: true,
		X:      0,
		Y:      0,
		Radius: 24,
		Glow:   GlowRoot,
		State:  HypercubeState{Lifecycle: true},
	}
	m.addNodeLocked(root)

	const domainRingRadius = float32(280)
	for i, d := range CMMCDomains {
		angle := float64(i) * 2 * math.Pi / float64(len(CMMCDomains))
		node := &GraphNode{
			ID:         "domain_" + d.Code,
			Kind:       NodeChokmah, // Chokmah = strategic_control = Domain
			polar:      polarEarth,
			Label:      d.Code + " — " + d.Name, // §10: never "Chokmah"
			DomainCode: d.Code,
			X:          domainRingRadius * float32(math.Cos(angle)),
			Y:          domainRingRadius * float32(math.Sin(angle)),
			Radius:     18,
			Glow:       GlowGray,
			State:      HypercubeState{Lifecycle: true},
		}
		m.addNodeLocked(node)
		m.addEdgeLocked(&graphEdge{
			FromID:   root.ID,
			ToID:     node.ID,
			edgeType: "derives_from",
			Strength: 0.9,
		})
	}
}

// FindingInput is the DTO used to add a finding from the STIG validator output.
type FindingInput struct {
	ID          string
	Title       string
	Description string
	SeverityRaw string // stig.Severity value: "CAT I", "CAT II", "CAT III", "Critical", …
	Status      FindingStatus
	DomainCode  string // extracted from CMMC cross-reference, e.g. "AC"
	PracticeID  string // e.g. "AC.L2-3.1.1"
	Remediation string
	References  []string
	CheckedAt   time.Time

	// SPRSPracticeWeight is the CMMC Appendix A practice weight (1, 3, or 5).
	// When non-zero it takes precedence over the CAT-severity heuristic in
	// sprsWeightFor().  The check engine and CKL/CKLB/OSCAL importers populate
	// this from db.GetCrossReferences (CCI → CMMC practice → Appendix A weight).
	// Zero means "not resolved from DB"; fall back to severity-based heuristic.
	SPRSPracticeWeight int

	// FixArgv is the remediation command matrix from the STIG check table.
	// Each inner slice is one argv-safe command (no shell; no metacharacters).
	// nil means no automated fix is available — manual remediation only.
	// Populated from stig.GetFixArgv(ID) by ingestReport and CKL/CKLB importers.
	FixArgv [][]string
}

// resolveWeight returns the SPRS deduction for a finding.
//
// Priority order (per CMMC Appendix A / §0.5):
//  1. f.SPRSPracticeWeight — populated by the check engine or importer from the
//     STIG→CCI→CMMC mapping DB.  This is the correct axis: CMMC practice weight
//     (1 = Level 1, 3 = most Level 2, 5 = high-value Level 2 practices).
//  2. sprsWeightFor(f.SeverityRaw) — STIG CAT heuristic fallback when no DB
//     cross-reference is available (e.g. manual review findings).
func resolveWeight(f FindingInput) int {
	if f.SPRSPracticeWeight > 0 {
		return f.SPRSPracticeWeight
	}
	return sprsWeightFor(f.SeverityRaw)
}

// sprsWeightFor converts a raw STIG/CMMC severity string to its SPRS weight.
// Only deducts CAT I (5), CAT II (3), CAT III (1). Unknown → 0.
func sprsWeightFor(severityRaw string) int {
	switch strings.ToLower(strings.TrimSpace(severityRaw)) {
	case "cat i", "cat1", "critical", "high":
		return 5
	case "cat ii", "cat2", "medium":
		return 3
	case "cat iii", "cat3", "low":
		return 1
	}
	return 1
}

// AddFinding adds a finding node to the graph and updates the SPRS score.
// Must be called with the mutex UNLOCKED (acquires lock internally).
func (m *ComplianceGraphModel) AddFinding(f FindingInput) {
	m.mu.Lock()
	defer m.mu.Unlock()

	sprs := resolveWeight(f)

	node := &GraphNode{
		ID:          "finding_" + f.ID,
		Kind:        NodeTiphereth, // Tiphereth = finding
		polar:       polarSun,
		Label:       f.Title, // §10: "Finding" node type label is separate from content
		FindingID:   f.ID,
		SeverityRaw: f.SeverityRaw,
		SPRSWeight:  sprs,
		Status:      f.Status,
		DomainCode:  f.DomainCode,
		PracticeID:  f.PracticeID,
		Description: f.Description,
		Remediation: f.Remediation,
		References:  f.References,
		CheckedAt:   f.CheckedAt,
		FixArgv:     f.FixArgv,
		Radius:      nodeRadiusForWeight(sprs),
		State: HypercubeState{
			Severity:  sprs >= 5,
			Verified:  true,
			Status:    f.Status == StatusNotMet,
			Lifecycle: true,
		},
	}
	node.Glow = node.computeGlow()

	// Seed position near the parent domain node
	if domainNode, ok := m.nodeByID["domain_"+f.DomainCode]; ok {
		// Offset so multiple findings scatter around the domain
		idx := float64(countFindingsForDomain(m.Nodes, f.DomainCode))
		offsetAngle := float64(idx) * (math.Pi / 4) // 45° apart
		node.X = domainNode.X + float32(math.Cos(offsetAngle)*80)
		node.Y = domainNode.Y + float32(math.Sin(offsetAngle)*80)
	}
	m.addNodeLocked(node)

	// Edge: finding violates its domain (Tiphereth → Chokmah)
	if f.DomainCode != "" {
		m.addEdgeLocked(&graphEdge{
			FromID:   node.ID,
			ToID:     "domain_" + f.DomainCode,
			edgeType: "violates",
			Strength: float32(sprs) / 5.0,
		})
	}

	// SPRS deduction — CMMC Appendix A canonical model (§0.5):
	// Deduct once per unique CMMC practice ID. When no practice is identified but
	// a domain is known, deduct once per domain (not per finding) to avoid
	// multiplying unmapped checks into an impossible negative score.
	// Findings with neither practice nor domain are not deducted (unscoped by CMMC).
	if f.Status == StatusNotMet {
		var deductKey string
		switch {
		case f.PracticeID != "":
			deductKey = "practice:" + f.PracticeID
		case f.DomainCode != "":
			// One deduction per domain for unmapped findings — conservative but bounded.
			deductKey = "domain:" + f.DomainCode
		}
		if deductKey != "" && !m.countedPractices[deductKey] {
			m.SPRSScore -= sprs
			m.countedPractices[deductKey] = true
		}
	}

	// Update domain node glow based on worst child finding
	if dn, ok := m.nodeByID["domain_"+f.DomainCode]; ok {
		if f.Status == StatusNotMet {
			if sprs >= 5 || dn.Glow == GlowGray {
				dn.Glow = GlowRedFast
			} else if sprs >= 3 && dn.Glow != GlowRedFast {
				dn.Glow = GlowOrangeSlow
			}
		} else if f.Status == StatusMet && dn.Glow == GlowGray {
			dn.Glow = GlowGreen
		}
	}
}

// AddAsset adds an asset node to the graph, linked to the governance root.
func (m *ComplianceGraphModel) AddAsset(hostname, ip, os string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	id := "asset_" + hostname
	if _, exists := m.nodeByID[id]; exists {
		return
	}

	idx := float64(countByKind(m.Nodes, NodeChesed))
	angle := idx * (math.Pi * 2 / 8) // up to 8 asset nodes in inner ring
	const assetRingRadius = float32(120)

	node := &GraphNode{
		ID:        id,
		Kind:      NodeChesed, // Chesed = asset
		polar:     polarEarth,
		Label:     hostname,
		Hostname:  hostname,
		IPAddress: ip,
		OS:        os,
		X:         assetRingRadius * float32(math.Cos(angle)),
		Y:         assetRingRadius * float32(math.Sin(angle)),
		Radius:    11,
		Glow:      GlowBlueOutline,
		State:     HypercubeState{Verified: true, Lifecycle: true},
	}
	m.addNodeLocked(node)
	m.addEdgeLocked(&graphEdge{
		FromID:   "keter_root",
		ToID:     id,
		edgeType: "requires",
		Strength: 0.6,
	})
}

// ResetFindings clears all finding and asset nodes, resets SPRS to 110.
// Called before re-running a scan to avoid duplicates.
func (m *ComplianceGraphModel) ResetFindings() {
	m.mu.Lock()
	defer m.mu.Unlock()

	kept := make([]*GraphNode, 0, 20)
	keptEdges := make([]*graphEdge, 0, 20)

	for _, n := range m.Nodes {
		if n.Kind == NodeKeter || n.Kind == NodeChokmah {
			n.Glow = GlowGray
			kept = append(kept, n)
		}
	}
	for _, e := range m.Edges {
		fromNode := m.nodeByID[e.FromID]
		toNode := m.nodeByID[e.ToID]
		if fromNode != nil && toNode != nil &&
			(fromNode.Kind == NodeKeter || fromNode.Kind == NodeChokmah) &&
			(toNode.Kind == NodeKeter || toNode.Kind == NodeChokmah) {
			keptEdges = append(keptEdges, e)
		}
	}

	m.Nodes = kept
	m.Edges = keptEdges
	m.nodeByID = make(map[string]*GraphNode, len(kept))
	for _, n := range kept {
		m.nodeByID[n.ID] = n
		// Restore "0 of N assessed" description on Tier 4 STIG family aggregate nodes.
		if n.STIGFamily != "" {
			if total, ok := m.familyTotalRules[n.STIGFamily]; ok && total > 0 {
				n.Description = fmt.Sprintf("0 of %d assessed", total)
			}
		}
	}
	m.SPRSScore = 110
	m.countedPractices = make(map[string]bool)
}

// LoadNotAssessedBaseline populates the graph with one aggregate NodeChokmah node
// per STIG benchmark family in the compliance database.  Each node shows the family
// name and "0 of N assessed" until findings arrive or a checklist is imported.
//
// Designed to satisfy spec §11 aggregated render mode: at startup the graph has only
// 1 root + 14 CMMC domain + ≤400 STIG family nodes — well below the 500-node threshold.
// Per-rule detail nodes are added only by AddFinding and the import parsers.
//
// Idempotent: families whose node already exists are skipped; safe to call multiple times.
func (m *ComplianceGraphModel) LoadNotAssessedBaseline() {
	families, err := stig.GetAllSTIGFamilies()
	if err != nil || len(families) == 0 {
		return
	}
	counts, err := stig.FamilyRuleCounts()
	if err != nil {
		counts = make(map[string]int)
	}

	// Golden-angle spiral gives even distribution for arbitrary node counts.
	// Nodes spiral outward from baseRadius to baseRadius+radiusSpan.
	const (
		goldenAngle = 2.39996322972865332 // math.Pi * (3 - math.Sqrt(5)), radians
		baseRadius  = float32(460)
		radiusSpan  = float32(440) // total spread: innermost at 460, outermost at 900
	)
	n := float64(len(families))

	m.mu.Lock()
	defer m.mu.Unlock()

	for i, family := range families {
		nodeID := "stig_fam_" + sanitizeFamilyID(family)
		if _, exists := m.nodeByID[nodeID]; exists {
			continue
		}

		ruleCount := counts[family]

		// Spiral position: radius grows linearly; angle advances by golden angle.
		t := float64(i) / n
		r := baseRadius + float32(t)*radiusSpan
		angle := float64(i) * goldenAngle

		desc := fmt.Sprintf("0 of %d assessed", ruleCount)
		if ruleCount == 0 {
			desc = "Not mapped in database"
		}

		node := &GraphNode{
			ID:          nodeID,
			Kind:        NodeChokmah,
			polar:       polarEarth,
			STIGFamily:  family,
			Label:       humanizeFamilyName(family),
			Description: desc,
			Status:      StatusNotReviewed,
			X:           r * float32(math.Cos(angle)),
			Y:           r * float32(math.Sin(angle)),
			Radius:      10,
			Glow:        GlowGray,
			State:       HypercubeState{Lifecycle: true},
		}
		m.addNodeLocked(node)
		m.addEdgeLocked(&graphEdge{
			FromID:   "keter_root",
			ToID:     nodeID,
			edgeType: "not_assessed",
			Strength: 0.2,
		})

		if ruleCount > 0 {
			m.familyTotalRules[family] = ruleCount
		}
	}
}

// sanitizeFamilyID converts a STIG_File value to a valid graph node ID fragment.
// Replaces any character that is not alphanumeric or underscore with '_'.
func sanitizeFamilyID(name string) string {
	var b strings.Builder
	b.Grow(len(name))
	for _, r := range name {
		if (r >= 'A' && r <= 'Z') || (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '_' {
			b.WriteRune(r)
		} else {
			b.WriteRune('_')
		}
	}
	return b.String()
}

// humanizeFamilyName strips the "U_" prefix, "_STIG" suffix, and version codes from
// a STIG_File value to produce a short human-readable label (§10 compliant).
// "U_RHEL_9_STIG_V1R3" → "RHEL 9"
func humanizeFamilyName(name string) string {
	s := strings.TrimPrefix(name, "U_")
	if idx := strings.Index(s, "_STIG"); idx > 0 {
		s = s[:idx]
	}
	// Strip trailing version fragment like "_V1R3" or "_V2R10"
	if idx := strings.LastIndex(s, "_V"); idx > 0 {
		tail := s[idx+1:]
		if len(tail) >= 2 && tail[0] == 'V' {
			s = s[:idx]
		}
	}
	return strings.TrimSpace(strings.ReplaceAll(s, "_", " "))
}

// SetFrameworkCoverage records how many findings were assessed for a framework.
// Called from the scan ingestion path after results are known.
// Example: SetFrameworkCoverage("RHEL-09-STIG-V1R3", 9, 291)
func (m *ComplianceGraphModel) SetFrameworkCoverage(framework string, assessed, total int) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if assessed == 0 {
		m.FrameworkCoverage[framework] = ""
		return
	}
	m.FrameworkCoverage[framework] = fmt.Sprintf("%d of %d %s controls assessed", assessed, total, framework)
}

// CoverageString returns the computed coverage disclaimer for the given framework,
// or "" if no scan data is available (which hides the disclaimer from the status bar).
func (m *ComplianceGraphModel) CoverageString(framework string) string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.FrameworkCoverage[framework]
}

// FinalizeScan records scan completion metadata under the write lock,
// preventing data races between the scan goroutine and the UI render thread.
func (m *ComplianceGraphModel) FinalizeScan(scanTime time.Time, hostname string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.ScanRunning = false
	if !scanTime.IsZero() {
		m.LastScanTime = scanTime
	}
	if hostname != "" {
		m.LastScanHost = hostname
	}
}

// RLock / RUnlock expose the read lock for the widget renderer.
func (m *ComplianceGraphModel) RLock()   { m.mu.RLock() }
func (m *ComplianceGraphModel) RUnlock() { m.mu.RUnlock() }

// SPRS returns the current SPRS score under a read lock.
// Safe to call from any goroutine, including the scan goroutine.
func (m *ComplianceGraphModel) SPRS() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.SPRSScore
}

// ScanTime returns the timestamp of the most recent completed scan.
func (m *ComplianceGraphModel) ScanTime() time.Time {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.LastScanTime
}

// SetScanStarted marks the scan as running and sets the current phase,
// all under a single write lock to prevent torn reads by the renderer.
func (m *ComplianceGraphModel) SetScanStarted(phase int) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.ScanRunning = true
	m.CurrentPhase = phase
}

// Phase returns the current §0.6 phase index under a read lock.
func (m *ComplianceGraphModel) Phase() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.CurrentPhase
}

// NodeByID returns the node with the given ID, nil if not found.
// Must be called under at least a read lock.
func (m *ComplianceGraphModel) NodeByID(id string) *GraphNode {
	return m.nodeByID[id]
}

// DomainStats returns per-domain compliance statistics for the sidebar.
func (m *ComplianceGraphModel) DomainStats(domainCode string) (met, notMet, notApplicable, total int, sprsDeduct int) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	for _, n := range m.Nodes {
		if n.Kind != NodeTiphereth || n.DomainCode != domainCode {
			continue
		}
		total++
		switch n.Status {
		case StatusMet:
			met++
		case StatusNotMet:
			notMet++
			sprsDeduct += n.SPRSWeight
		case StatusNotApplicable:
			notApplicable++
		}
	}
	return
}

// FindingsForDomain returns all finding nodes for a given domain code, sorted by severity.
func (m *ComplianceGraphModel) FindingsForDomain(domainCode string) []*GraphNode {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([]*GraphNode, 0, 16)
	for _, n := range m.Nodes {
		if n.Kind == NodeTiphereth && n.DomainCode == domainCode {
			out = append(out, n)
		}
	}
	// Sort: highest SPRS weight first
	for i := 0; i < len(out); i++ {
		for j := i + 1; j < len(out); j++ {
			if out[j].SPRSWeight > out[i].SPRSWeight {
				out[i], out[j] = out[j], out[i]
			}
		}
	}
	return out
}

// DaysToAssessment returns the number of days until the assessment target.
// Returns -1 if no target is set.
func (m *ComplianceGraphModel) DaysToAssessment() int {
	if m.AssessmentTarget.IsZero() {
		return -1
	}
	d := int(time.Until(m.AssessmentTarget).Hours() / 24)
	if d < 0 {
		return 0
	}
	return d
}

// SPRSThreshold returns the human-readable SPRS range label per Appendix B.
func SPRSThreshold(score int) string {
	switch {
	case score >= 110:
		return "Perfect (110/110)"
	case score >= 80:
		return "Strong — assessment likely"
	case score >= 50:
		return "Moderate — POA&M required"
	case score >= 0:
		return "Weak — significant remediation required"
	default:
		return "Critical — systemic failures"
	}
}

// addNodeLocked adds a node; caller must hold write lock.
func (m *ComplianceGraphModel) addNodeLocked(n *GraphNode) {
	m.Nodes = append(m.Nodes, n)
	m.nodeByID[n.ID] = n
}

// addEdgeLocked adds an edge; caller must hold write lock.
func (m *ComplianceGraphModel) addEdgeLocked(e *graphEdge) {
	m.Edges = append(m.Edges, e)
}

// PhysicsState is a copy of a single node's physics fields used by the
// force-directed layout engine in the widgets package.
// Using a separate struct avoids exposing GraphNode's sync primitives to
// the physics goroutine.
type PhysicsState struct {
	ID     string
	X, Y   float64
	VX, VY float64
	Pinned bool
}

// Snapshot returns a consistent view of node physics state and edge pairs
// under a single read-lock acquisition, preventing the double-lock deadlock
// that would occur if edges and nodes were read under separate locks.
func (m *ComplianceGraphModel) Snapshot() (nodes []PhysicsState, edges [][2]string) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	nodes = make([]PhysicsState, len(m.Nodes))
	for i, n := range m.Nodes {
		nodes[i] = PhysicsState{
			ID: n.ID, X: float64(n.X), Y: float64(n.Y),
			VX: float64(n.VX), VY: float64(n.VY), Pinned: n.Pinned,
		}
	}
	edges = make([][2]string, len(m.Edges))
	for i, e := range m.Edges {
		edges[i] = [2]string{e.FromID, e.ToID}
	}
	return
}

// EdgesSnapshot returns a read-only copy of edge pairs under a single read lock.
// For use by renderers that only need edge topology, not node physics state.
// IMPORTANT: do NOT call this while already holding the model read lock — the
// inner RLock can deadlock against a waiting writer (ApplyPhysics). Use
// RenderSnapshot instead when nodes and edges are needed together.
func (m *ComplianceGraphModel) EdgesSnapshot() [][2]string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([][2]string, len(m.Edges))
	for i, e := range m.Edges {
		out[i] = [2]string{e.FromID, e.ToID}
	}
	return out
}

// RenderSnapshot returns the current node slice and edge pairs under a SINGLE
// read-lock acquisition. Use this from renderers that need both, to avoid the
// lock-inversion deadlock that occurs when EdgesSnapshot (which acquires its
// own RLock) is called while the caller already holds the model RLock.
func (m *ComplianceGraphModel) RenderSnapshot() (nodes []*GraphNode, edges [][2]string) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	nodes = m.Nodes
	edges = make([][2]string, len(m.Edges))
	for i, e := range m.Edges {
		edges[i] = [2]string{e.FromID, e.ToID}
	}
	return
}

// ApplyPhysics writes back updated physics positions to nodes under a write lock.
// Called by the force-directed layout engine after each integration step.
func (m *ComplianceGraphModel) ApplyPhysics(states []PhysicsState) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, s := range states {
		if n, ok := m.nodeByID[s.ID]; ok {
			n.X = float32(s.X)
			n.Y = float32(s.Y)
			n.VX = float32(s.VX)
			n.VY = float32(s.VY)
		}
	}
}

// helper functions

func nodeRadiusForWeight(sprs int) float32 {
	switch sprs {
	case 5:
		return 14
	case 3:
		return 11
	default:
		return 9
	}
}

func countFindingsForDomain(nodes []*GraphNode, domain string) int {
	c := 0
	for _, n := range nodes {
		if n.Kind == NodeTiphereth && n.DomainCode == domain {
			c++
		}
	}
	return c
}

func countByKind(nodes []*GraphNode, kind NodeKind) int {
	c := 0
	for _, n := range nodes {
		if n.Kind == kind {
			c++
		}
	}
	return c
}

// DomainCodeFromRefs extracts the CMMC domain code from a cross-reference list.
// Looks for strings like "CMMC:AC.L2-3.1.1" → "AC".
func DomainCodeFromRefs(refs []string) string {
	for _, r := range refs {
		if strings.HasPrefix(r, "CMMC:") {
			// "CMMC:AC.L2-3.1.1" → "AC"
			rest := strings.TrimPrefix(r, "CMMC:")
			dot := strings.Index(rest, ".")
			if dot > 0 {
				return rest[:dot]
			}
		}
	}
	return ""
}

// PracticeIDFromRefs extracts the CMMC practice ID from a cross-reference list.
// Example: "CMMC:AC.L2-3.1.1" → "AC.L2-3.1.1"
func PracticeIDFromRefs(refs []string) string {
	for _, r := range refs {
		if strings.HasPrefix(r, "CMMC:") {
			return strings.TrimPrefix(r, "CMMC:")
		}
	}
	return ""
}

// PracticeWeightFromID returns the CMMC Appendix A SPRS point value for a practice.
//
// Source: NIST SP 800-171 DoD Assessment Methodology, Appendix A.
// Weights: 1 for Level 1 practices, 5 for high-value Level 2 practices, 3 otherwise.
// The 110-practice total deduction universe sums to 110.
//
// Level 1 (L1) — 17 practices, 1 pt each.
// Level 2 (L2) — 110 total. The 14 listed below are 5 pts; remaining L2 are 3 pts.
// Returns 0 when practiceID is empty (caller falls back to severity heuristic).
func PracticeWeightFromID(practiceID string) int {
	if practiceID == "" {
		return 0
	}
	// Level 1 practices are worth 1 point each.
	if strings.Contains(practiceID, ".L1-") {
		return 1
	}
	// High-value Level 2 practices (5 points) per CMMC Appendix A.
	switch practiceID {
	case
		// Access Control — CUI flow enforcement
		"AC.L2-3.1.3",
		// Audit & Accountability — protected audit logs
		"AU.L2-3.3.1", "AU.L2-3.3.2",
		// Identification & Authentication — MFA
		"IA.L2-3.5.3", "IA.L2-3.5.4",
		// Incident Response
		"IR.L2-3.6.1", "IR.L2-3.6.2",
		// Risk Assessment — threat modeling
		"RA.L2-3.11.1", "RA.L2-3.11.2",
		// System & Communications — FIPS / key management
		"SC.L2-3.13.8", "SC.L2-3.13.10", "SC.L2-3.13.11",
		// System & Information Integrity — flaw remediation
		"SI.L2-3.14.1",
		// Configuration Management — security baseline
		"CM.L2-3.4.1":
		return 5
	}
	// All other Level 2 practices: 3 points.
	return 3
}
