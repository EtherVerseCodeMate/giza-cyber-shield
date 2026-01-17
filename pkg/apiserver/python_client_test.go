package apiserver

import (
	"fmt"
	"testing"
)

// TestPythonPing attempts to talk to the local python service
// Run this only when the service is up!
func TestPythonPing(t *testing.T) {
	client := NewPythonServiceClient("http://localhost:8000")

	// 1. Check Soul
	soul, err := client.GetSoulStatus()
	if err != nil {
		t.Fatalf("Failed to get soul status: %v", err)
	}
	fmt.Printf("Soul Status: %v\n", soul)

	// 2. Get Intuition (Mock Features)
	features := make([]float64, 32) // 32 dim zero vector
	prediction, err := client.GetIntuition(features, nil)
	if err != nil {
		t.Fatalf("Failed to get intuition: %v", err)
	}
	fmt.Printf("Intuition: Score=%.4f, Anomaly=%v, Trait=%v\n",
		prediction.AnomalyScore,
		prediction.IsAnomaly,
		prediction.ArchetypeInfluence)
}
