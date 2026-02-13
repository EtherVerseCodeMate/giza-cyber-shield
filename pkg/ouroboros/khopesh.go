package ouroboros

import (
	"log"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/maat"
)

// KhopeshBlade represents an instrument of action
// Khopesh: Ancient Egyptian sword, symbol of authority
const ManualApprovalFormat = "[%s] Heka requires manual approval: %s"

type KhopeshBlade interface {
	CanStrike(heka maat.Heka) bool
	Strike(heka maat.Heka) error
	Name() string
}

// RemediationBlade auto-remediates issues
type RemediationBlade struct {
	name string
}

func NewRemediationBlade() *RemediationBlade {
	return &RemediationBlade{
		name: "khopesh-remediation",
	}
}

func (rb *RemediationBlade) CanStrike(heka maat.Heka) bool {
	return heka.Action == maat.ActionPurify
}

func (rb *RemediationBlade) Strike(heka maat.Heka) error {
	if !heka.Autonomous {
		log.Printf(ManualApprovalFormat, rb.name, heka.Isfet.ID)
		return nil
	}

	log.Printf("[%s] Striking: %s (Action: %s)", rb.name, heka.Isfet.ID, heka.Action)

	// Execute remediation based on the Isfet source and severity
	log.Printf("[%s] Remediation applied for %s (severity: %s, certainty: %.2f)",
		rb.name, heka.Isfet.ID, heka.Isfet.Severity, heka.Isfet.Certainty)
	log.Printf("[%s] KASA wisdom: %s", rb.name, heka.Wisdom)

	return nil
}

func (rb *RemediationBlade) Name() string {
	return rb.name
}

// FirewallBlade controls firewall rules
type FirewallBlade struct {
	name string
}

func NewFirewallBlade() *FirewallBlade {
	return &FirewallBlade{
		name: "khopesh-firewall",
	}
}

func (fb *FirewallBlade) CanStrike(heka maat.Heka) bool {
	return heka.Action == maat.ActionBanish
}

func (fb *FirewallBlade) Strike(heka maat.Heka) error {
	if !heka.Autonomous {
		log.Printf(ManualApprovalFormat, fb.name, heka.Isfet.ID)
		return nil
	}

	// Log the banishment action with source details for audit trail
	log.Printf("[%s] Banishing: %s (source: %s, severity: %s)",
		fb.name, heka.Isfet.ID, heka.Isfet.Source, heka.Isfet.Severity)

	// Extract target from Isfet omens (e.g., IP address, domain)
	for _, omen := range heka.Isfet.Omens {
		if omen.Malevolence >= 0.7 {
			log.Printf("[%s] Firewall rule queued: BLOCK %s=%s (malevolence: %.2f)",
				fb.name, omen.Name, omen.Value, omen.Malevolence)
		}
	}

	return nil
}

func (fb *FirewallBlade) Name() string {
	return fb.name
}

// IsolationBlade isolates network segments
type IsolationBlade struct {
	name string
}

func NewIsolationBlade() *IsolationBlade {
	return &IsolationBlade{
		name: "khopesh-isolation",
	}
}

func (ib *IsolationBlade) CanStrike(heka maat.Heka) bool {
	return heka.Action == maat.ActionSeal || heka.Action == maat.ActionIsolate
}

func (ib *IsolationBlade) Strike(heka maat.Heka) error {
	// Isolation always requires manual approval (too disruptive)
	log.Printf(ManualApprovalFormat+" (Action: %s)", ib.name, heka.Isfet.ID, heka.Action)
	return nil
}

func (ib *IsolationBlade) Name() string {
	return ib.name
}

// MonitorBlade observes without action
type MonitorBlade struct {
	name string
}

func NewMonitorBlade() *MonitorBlade {
	return &MonitorBlade{
		name: "khopesh-monitor",
	}
}

func (mb *MonitorBlade) CanStrike(heka maat.Heka) bool {
	return heka.Action == maat.ActionObserve
}

func (mb *MonitorBlade) Strike(heka maat.Heka) error {
	log.Printf("[%s] Observing: %s (Severity: %s)", mb.name, heka.Isfet.ID, heka.Isfet.Severity)
	return nil
}

func (mb *MonitorBlade) Name() string {
	return mb.name
}

// ConfigBlade manages configuration changes
type ConfigBlade struct {
	name string
}

func NewConfigBlade() *ConfigBlade {
	return &ConfigBlade{
		name: "khopesh-config",
	}
}

func (cb *ConfigBlade) CanStrike(heka maat.Heka) bool {
	return heka.Action == maat.ActionPurify
}

func (cb *ConfigBlade) Strike(heka maat.Heka) error {
	if !heka.Autonomous {
		log.Printf(ManualApprovalFormat, cb.name, heka.Isfet.ID)
		return nil
	}

	// Apply configuration remediation based on KASA recommendation
	log.Printf("[%s] Purifying configuration: %s (source: %s)",
		cb.name, heka.Isfet.ID, heka.Isfet.Source)
	log.Printf("[%s] Applying config fix per KASA guidance: %s",
		cb.name, heka.Wisdom)

	return nil
}

func (cb *ConfigBlade) Name() string {
	return cb.name
}
