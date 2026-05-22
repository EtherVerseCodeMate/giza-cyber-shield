package soc2

// khepra_integration.go wires the SOC 2 engine into KHEPRA's proprietary
// compliance stack: the DAG tamper-evident ledger, the CMMC/NIST 800-53
// control catalogue, and the Motherboard attestation sync.

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/dag"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/lorentz"
)

// DAGLogger writes every SOC 2 control status change to the KHEPRA DAG so
// that evidence has a tamper-evident chain of custody (satisfies CC4.1, CC7.2).
type DAGLogger struct {
	store dag.Store
}

// NewDAGLogger creates a logger backed by the given DAG store.
func NewDAGLogger(store dag.Store) *DAGLogger {
	return &DAGLogger{store: store}
}

// LogImplementation records a control implementation update in the DAG.
func (l *DAGLogger) LogImplementation(impl ControlImplementation, privKey []byte) error {
	payload, err := json.Marshal(impl)
	if err != nil {
		return fmt.Errorf("soc2 dag log: marshal: %w", err)
	}

	h := sha256.Sum256(payload)
	node := dag.Node{
		Action: fmt.Sprintf("soc2:control-update:%s", impl.CriterionID),
		Symbol: "Eban", // Protection / fence — matches existing KHEPRA convention
		Time:   lorentz.StampNow(),
		PQC: map[string]string{
			"criterion_id": impl.CriterionID,
			"status":       string(impl.Status),
			"owner":        impl.Owner,
			"payload_hash": hex.EncodeToString(h[:]),
			"type":         "SOC2_CONTROL_UPDATE",
		},
	}

	if err := node.Sign(privKey); err != nil {
		return fmt.Errorf("soc2 dag log: sign: %w", err)
	}
	return l.store.Add(&node, []string{})
}

// LogEvidenceCollected records a new evidence item in the DAG.
func (l *DAGLogger) LogEvidenceCollected(ev Evidence, privKey []byte) error {
	node := dag.Node{
		Action: fmt.Sprintf("soc2:evidence-collected:%s", ev.CriterionID),
		Symbol: "Kete", // Knowledge/learning — used for evidence nodes
		Time:   lorentz.StampNow(),
		PQC: map[string]string{
			"evidence_id":  ev.ID,
			"criterion_id": ev.CriterionID,
			"type":         string(ev.Type),
			"hash":         ev.Hash,
			"collected_by": ev.CollectedBy,
		},
	}
	if err := node.Sign(privKey); err != nil {
		return fmt.Errorf("soc2 dag log: sign evidence: %w", err)
	}
	return l.store.Add(&node, []string{})
}

// LogReadinessReport records a snapshot of the readiness score in the DAG.
func (l *DAGLogger) LogReadinessReport(report *ReadinessReport, privKey []byte) error {
	node := dag.Node{
		Action: "soc2:readiness-report",
		Symbol: "Dwennimmen", // Humility / strength — used for assessment nodes
		Time:   lorentz.StampNow(),
		PQC: map[string]string{
			"system_name": report.SystemName,
			"score":       fmt.Sprintf("%.1f", report.Score),
			"level":       string(report.Level),
			"gap_count":   fmt.Sprintf("%d", len(report.Gaps)),
			"generated":   report.GeneratedAt.Format(time.RFC3339),
		},
	}
	if err := node.Sign(privKey); err != nil {
		return fmt.Errorf("soc2 dag log: sign report: %w", err)
	}
	return l.store.Add(&node, []string{})
}

// EngineWithDAG wraps Engine and automatically logs every control update
// and every generated report to the KHEPRA DAG.
type EngineWithDAG struct {
	*Engine
	logger  *DAGLogger
	privKey []byte
}

// NewEngineWithDAG returns an Engine that logs all activity to the DAG.
func NewEngineWithDAG(systemName, scopeNote string, store dag.Store, privKey []byte) *EngineWithDAG {
	return &EngineWithDAG{
		Engine:  NewEngine(systemName, scopeNote),
		logger:  NewDAGLogger(store),
		privKey: privKey,
	}
}

// SetImplementation sets a criterion implementation and logs it to the DAG.
func (e *EngineWithDAG) SetImplementation(impl ControlImplementation) error {
	e.Engine.Assessment.SetImplementation(impl)
	return e.logger.LogImplementation(impl, e.privKey)
}

// GenerateReport runs the assessment, logs the report to the DAG, and returns it.
func (e *EngineWithDAG) GenerateReport() (*ReadinessReport, error) {
	report := e.Assessment.Assess()
	if err := e.logger.LogReadinessReport(report, e.privKey); err != nil {
		return report, fmt.Errorf("dag logging: %w", err)
	}
	return report, nil
}

// AddEvidence records evidence in the collector and logs it to the DAG.
func (e *EngineWithDAG) AddEvidence(criterionID string, evType EvidenceType, title, description, collectedBy string, content []byte) (Evidence, error) {
	ev := e.Evidence.Add(criterionID, evType, title, description, collectedBy, content)
	err := e.logger.LogEvidenceCollected(ev, e.privKey)
	return ev, err
}

// SeedFromCMMCEngine reads implemented CMMC/NIST 800-53 control status from the
// existing KHEPRA compliance Manager (pkg/compliance.Manager) and auto-populates
// SOC 2 criterion implementations via the NIST mapping.
//
// controlStatuses should be a map[controlID]status where status is one of:
// "IMPLEMENTED", "PARTIAL", "PLANNED", "NOT_APPLICABLE", "FAILED_SCAN".
func (e *EngineWithDAG) SeedFromCMMCEngine(controlStatuses map[string]string) {
	e.Engine.SeedFromNISTMapping(controlStatuses)
}
