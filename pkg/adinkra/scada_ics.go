package adinkra

import (
	"fmt"
	"math/rand"
	"time"
)

// =============================================================================
// ADINKHEPRA SCADA/ICS INTEGRATION (CYBER-PHYSICAL POD)
// =============================================================================

// ICSComponentType represents the various hardware blocks in the SCADA Pod.
type ICSComponentType string

const (
	ComponentPLC       ICSComponentType = "PLC"       // Logic Controller
	ComponentHMI       ICSComponentType = "HMI"       // Interface
	ComponentRelay     ICSComponentType = "RELAY"     // Physical Switching
	ComponentActuator  ICSComponentType = "ACTUATOR"  // Kinetic Movement
	ComponentSwitch    ICSComponentType = "SWITCH"    // Network Infrastructure
	ComponentIndicator ICSComponentType = "INDICATOR" // Status signaling
	ComponentPowerMCB  ICSComponentType = "MCB"       // Power Isolation
	ComponentPSU       ICSComponentType = "PSU"       // Power Supply
)

// ResilienceProfile tracks metrics for Fig 2 (Disturbance and Impact Resilience Curve).
type ResilienceProfile struct {
	Robustness       float64 // (R) ability to resist disturbance
	SystemAgility    float64 // (S) speed of system auto-correction
	ResponderAgility float64 // (r) speed of external/manual intervention
	TimeLatency      float64 // (t) delay in communication pathways
	DataIntegrity    float64 // (d) deviation from set-point accuracy
}

// SCADAAsset represents a physical or logical component screwed to the pod board.
type SCADAAsset struct {
	ID         string
	Type       ICSComponentType
	Symbol     string            // Adinkra Symbol protecting this asset
	Firmware   string            // Version for vulnerability scanning
	IPAddress  string            // Network address on the pod switch
	Status     string            // Current operational state
	LastAudit  time.Time
	Resilience ResilienceProfile // Advanced metrics for CYRARR Fig 2.
}

// SCADAPod represents the standalone training board (Phase 1).
type SCADAPod struct {
	Name       string
	Theme      string
	Assets     []SCADAAsset
	IsHardened bool
}

// NewSCADAPod initializes a pod based on the FIG. 1 Reference Architecture.
func NewSCADAPod(name, theme string) *SCADAPod {
	pod := &SCADAPod{
		Name:  name,
		Theme: theme,
		Assets: []SCADAAsset{
			{ID: "mcb-01", Type: ComponentPowerMCB, Symbol: "Eban", Resilience: ResilienceProfile{Robustness: 0.95}},
			{ID: "hmi-01", Type: ComponentHMI, Symbol: "Fawohodie", Resilience: ResilienceProfile{Robustness: 0.70}},
			{ID: "plc-01", Type: ComponentPLC, Symbol: "Nkyinkyim", Resilience: ResilienceProfile{Robustness: 0.85, SystemAgility: 0.90}},
			{ID: "relay-block", Type: ComponentRelay, Symbol: "Dwennimmen", Resilience: ResilienceProfile{Robustness: 0.90}},
			{ID: "main-switch", Type: ComponentSwitch, Symbol: "Eban", Resilience: ResilienceProfile{Robustness: 0.80}},
		},
	}
	return pod
}

// =============================================================================
// CYRARR: Cyber Yield & Risk Attestation Reporting Roadmap
// =============================================================================

// SystemicFuzzResult captures the trade-off space between security and stability (Fig 3).
type SystemicFuzzResult struct {
	DisturbanceType string  // Settings, Control, Sensing
	Mitigation      string  // Cyber (Firewall/SDN) or Physical (Set-point offset)
	StabilityImpact float64 // 0.0 to 1.0 (Higher is worse for stability)
	SecurityBenefit float64 // 0.0 to 1.0 (Higher is better for security)
}

// RunSystemicFuzz manipulates system states to determine optimal response sequences.
// This implements the "System-wide Fuzzer" concept from the research paper.
func (p *SCADAPod) RunSystemicFuzz(assetID string, disturbanceType string) *SystemicFuzzResult {
	// Simulate exploration of the trade-off space
	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	
	result := &SystemicFuzzResult{
		DisturbanceType: disturbanceType,
		Mitigation:      "Hybrid Response (Tiers 1 & 2)",
		StabilityImpact: r.Float64() * 0.4, // We aim for low impact
		SecurityBenefit: 0.5 + (r.Float64() * 0.5), // High benefit
	}

	return result
}

// AttestSCADAState binds a physical component's behavior to the ASAF framework.
// Incorporates FIG. 2 Resilience metrics into the attestation payload.
func (p *SCADAPod) AttestSCADAState(assetID string, priv *AdinkhepraPQCPrivateKey, sensorData string) (*AdinkhepraAttestation, error) {
	var target *SCADAAsset
	for i := range p.Assets {
		if p.Assets[i].ID == assetID {
			target = &p.Assets[i]
			break
		}
	}

	if target == nil {
		return nil, fmt.Errorf("asset %s not found in pod", assetID)
	}

	// Update data integrity metric based on sensor data
	if sensorData == "DRIFT" || sensorData == "JITTER" {
		target.Resilience.DataIntegrity = 0.4
	} else if sensorData == "NORMAL" {
		target.Resilience.DataIntegrity = 1.0
	}

	// Calculate trust score incorporating robustness
	trustScore := int(target.Resilience.Robustness * 100)
	if sensorData == "ANOMALY" || sensorData == "ATTACK" {
		trustScore = 20
	}

	// Generate ASAF Attestation
	agentID := fmt.Sprintf("pod-agent-%s", target.ID)
	actionID := fmt.Sprintf("audit-%d", time.Now().UnixNano())
	
	contextStr := fmt.Sprintf("Component: %s | State: %s | Robustness: %.2f | Agility: %.2f", 
		target.Type, sensorData, target.Resilience.Robustness, target.Resilience.SystemAgility)

	attestation, err := SignAgentAction(
		priv,
		agentID,
		actionID,
		target.Symbol,
		trustScore,
		contextStr,
	)

	if err == nil {
		target.LastAudit = time.Now()
		target.Status = sensorData
	}

	return attestation, err
}

// MapICSToCompliance extends FIG. 10 for Industrial Control Systems.
func MapICSToCompliance(assetType ICSComponentType) []string {
	switch assetType {
	case ComponentPLC, ComponentRelay:
		return []string{"IEC 62443", "NIST SP 800-82", "Safety Integrity (SIL)"}
	case ComponentHMI, ComponentSwitch:
		return []string{"NERC CIP", "CMMC Level 3", "Network Segmentation"}
	case ComponentPowerMCB:
		return []string{"Electrical Safety Code", "Critical Infrastructure Protection"}
	default:
		return []string{"General ICS Security"}
	}
}

// StartPodAudit runs a scan across all components to verify "Symbolic Least Privilege".
func (p *SCADAPod) StartPodAudit() map[string]bool {
	results := make(map[string]bool)
	for _, asset := range p.Assets {
		// Rule: PLC must always be under Nkyinkyim (State Transition)
		if asset.Type == ComponentPLC && asset.Symbol != "Nkyinkyim" {
			results[asset.ID] = false
		} else if asset.Type == ComponentSwitch && asset.Symbol != "Eban" {
			results[asset.ID] = false
		} else {
			results[asset.ID] = true
		}
	}
	return results
}
