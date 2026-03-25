package maat

import (
	"fmt"
	"sort"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/agi"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/seshat"
)

// Guardian maintains Maat (cosmic order/balance)
// Maat (Egyptian): Truth, justice, harmony, balance
type Guardian struct {
	Realm     string
	Anubis    *AnubisWeigher
	Chronicle *seshat.Chronicle
	KASA      *agi.Engine
}

// NewGuardian creates a Maat Guardian for a realm
func NewGuardian(realm string, kasa *agi.Engine, chronicle *seshat.Chronicle) *Guardian {
	return &Guardian{
		Realm:     realm,
		Anubis:    NewAnubisWeigher(),
		Chronicle: chronicle,
		KASA:      kasa,
	}
}

// WeighAndDecide evaluates Isfet and determines Heka
func (g *Guardian) WeighAndDecide(isfet []Isfet) []Heka {
	heka := []Heka{}

	for _, chaos := range isfet {
		// 1. Anubis weighs the options
		options := g.Anubis.WeighHeart(chaos)

		// 2. Consult KASA for AI-powered recommendation
		kasaWisdom := g.consultKASA(chaos, options)

		// 3. Select best option
		selected := g.selectBestOption(options)

		// 4. Create Heka (restorative action)
		h := Heka{
			Isfet:      chaos,
			Action:     selected.Action,
			Potency:    selected.Potency,
			Autonomous: g.shouldAutomate(selected),
			Khopesh:    g.selectKhopesh(selected.Action),
			Wisdom:     kasaWisdom,
		}

		heka = append(heka, h)

		// 5. Transcribe to Seshat Chronicle
		if g.Chronicle != nil {
			g.Chronicle.Inscribe("maat-decision", map[string]any{
				"realm":       g.Realm,
				"isfet_id":    chaos.ID,
				"severity":    chaos.Severity,
				"action":      h.Action,
				"autonomous":  h.Autonomous,
				"kasa_wisdom": kasaWisdom,
			})
		}
	}

	return heka
}

// consultKASA asks the AGI engine for recommendations
func (g *Guardian) consultKASA(isfet Isfet, options []HeartOption) string {
	if g.KASA == nil {
		return "KASA unavailable"
	}

	// Format query for KASA
	query := fmt.Sprintf(
		"Isfet detected: %s (Severity: %s, Certainty: %.2f). Options: %v. Recommend best action.",
		isfet.ID, isfet.Severity, isfet.Certainty, options,
	)

	// KASA Chat provides AI-powered analysis
	wisdom := g.KASA.Chat(query)

	return wisdom
}

// selectBestOption chooses the option with highest potency
func (g *Guardian) selectBestOption(options []HeartOption) HeartOption {
	if len(options) == 0 {
		// Default to observe
		return HeartOption{
			Action:            ActionObserve,
			OperationalBurden: 0.0,
			RestorationPower:  0.1,
			Certainty:         1.0,
			Potency:           0.1,
		}
	}

	// Sort by potency (descending)
	sort.Slice(options, func(i, j int) bool {
		return options[i].Potency > options[j].Potency
	})

	return options[0]
}

// shouldAutomate determines if action should be automated
func (g *Guardian) shouldAutomate(option HeartOption) bool {
	// Automate if:
	// 1. High certainty (>= 0.8)
	// 2. Low operational burden (<= 0.3)
	// 3. Not a catastrophic action (seal/isolate)

	if option.Certainty >= 0.8 && option.OperationalBurden <= 0.3 {
		// Don't auto-execute seal/isolate (too disruptive)
		if option.Action == ActionSeal || option.Action == ActionIsolate {
			return false
		}
		return true
	}

	return false
}

// selectKhopesh determines which blade should execute the action
func (g *Guardian) selectKhopesh(action string) string {
	switch action {
	case ActionBanish:
		return "khopesh-firewall"
	case ActionSeal:
		return "khopesh-isolation"
	case ActionPurify:
		return "khopesh-remediation"
	case ActionIsolate:
		return "khopesh-network"
	case ActionObserve:
		return "khopesh-monitor"
	default:
		return "khopesh-unknown"
	}
}
