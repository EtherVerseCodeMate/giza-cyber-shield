package souhimbou

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/dag"
)

// FlightRecorder wraps any AI agent and logs its actions to the DAG.
type FlightRecorder struct {
	agent *Agent
}

// NewFlightRecorder creates a new FlightRecorder bound to the core agent.
func NewFlightRecorder(agent *Agent) *FlightRecorder {
	return &FlightRecorder{
		agent: agent,
	}
}

// RecordToolCall logs a tool call made by a wrapped AI agent to the immutable DAG.
// This is the implementation of the 3-line SDK wrapper.
func (f *FlightRecorder) RecordToolCall(targetAgentID, toolName string, args map[string]interface{}) error {
	argsJSON, _ := json.Marshal(args)

	// Create DAG node payload
	payload := fmt.Sprintf(`{"target_agent": "%s", "tool": "%s", "args": %s}`, targetAgentID, toolName, argsJSON)

	// Sign the payload using the SouHimBou ML-DSA-65 identity
	signature, err := f.agent.KeyPair.SignArtifact([]byte(payload))
	if err != nil {
		return fmt.Errorf("failed to sign tool call: %w", err)
	}

	// Persist to DAG
	f.agent.Memory.Add(&dag.Node{
		Action: "AGENT_TOOL_CALL",
		Symbol: "Nkyinkyim",
		PQC: map[string]string{
			"payload":          payload,
			"signature_khepra": fmt.Sprintf("%x", signature.SignatureKhepra[:32]),
		},
		Time:   time.Now().Format(time.RFC3339),
	}, []string{})

	return nil
}
