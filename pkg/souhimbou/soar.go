package souhimbou

import (
	"errors"
	"fmt"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/dag"
)

// SOAREngine handles Secure Orchestration, Automation, and Response.
type SOAREngine struct {
	agent *Agent
}

// Playbook represents a signed, versioned SOAR playbook.
type Playbook struct {
	Name             string   `yaml:"name"`
	Version          string   `yaml:"version"`
	Symbol           string   `yaml:"symbol"` // e.g., Eban (defensive)
	RequiresApproval bool     `yaml:"requires_approval"`
	TierMinimum      string   `yaml:"tier_minimum"`
	Triggers         []string `yaml:"triggers"`
	Actions          struct {
		Staging    []string `yaml:"staging"`
		Production []string `yaml:"production"`
	} `yaml:"actions"`
	Signature []byte `yaml:"signature"`
}

// NewSOAREngine creates a new SOAREngine bound to the core agent.
func NewSOAREngine(agent *Agent) *SOAREngine {
	return &SOAREngine{
		agent: agent,
	}
}

// ExecutePlaybook runs a playbook in the specified environment (staging or production).
func (s *SOAREngine) ExecutePlaybook(playbook *Playbook, environment string, approved bool) error {
	if environment == "production" && playbook.RequiresApproval && !approved {
		return errors.New("human approval required for production execution")
	}

	// Attest execution start to DAG
	s.agent.Memory.Add(&dag.Node{
		Action: "SOAR_PLAYBOOK_STARTED",
		Symbol: playbook.Symbol,
		PQC: map[string]string{
			"payload": fmt.Sprintf(`{"playbook": "%s", "version": "%s", "environment": "%s"}`, playbook.Name, playbook.Version, environment),
		},
		Time:   time.Now().Format(time.RFC3339),
	}, []string{})

	var actionsToRun []string
	if environment == "staging" {
		actionsToRun = playbook.Actions.Staging
	} else if environment == "production" {
		actionsToRun = playbook.Actions.Production
	} else {
		return errors.New("invalid environment: must be staging or production")
	}

	for _, action := range actionsToRun {
		// Simulate action execution for now
		fmt.Printf("[SOAR] Executing %s action: %s\n", environment, action)
	}

	// Attest execution completion to DAG
	// Use HybridKeyPair to sign the completion node
	signature, err := s.agent.KeyPair.SignArtifact([]byte("SOAR_PLAYBOOK_COMPLETED"))
	if err != nil {
		return fmt.Errorf("failed to sign DAG node: %w", err)
	}

	s.agent.Memory.Add(&dag.Node{
		Action: "SOAR_PLAYBOOK_COMPLETED",
		Symbol: playbook.Symbol,
		PQC: map[string]string{
			"status": "success",
			"signature": fmt.Sprintf("%x", signature.SignatureKhepra[:16]),
		},
		Time:   time.Now().Format(time.RFC3339),
	}, []string{})

	return nil
}
