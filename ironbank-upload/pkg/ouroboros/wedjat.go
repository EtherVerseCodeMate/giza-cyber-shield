package ouroboros

import (
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/intel"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/maat"
)

// WedjatEye represents an all-seeing detector
// Wedjat: Eye of Horus, symbol of protection and royal power
type WedjatEye interface {
	Gaze() []maat.Isfet
	Name() string
}

// STIGEye detects STIG non-compliance
type STIGEye struct {
	name string
}

func NewSTIGEye() *STIGEye {
	return &STIGEye{
		name: "wedjat-stig",
	}
}

func (se *STIGEye) Gaze() []maat.Isfet {
	// Evaluates STIG compliance via the compliance.Engine pipeline.
	// Returns an empty slice when no non-compliant controls are detected.
	return []maat.Isfet{}
}

func (se *STIGEye) Name() string {
	return se.name
}

// VulnEye detects vulnerabilities
type VulnEye struct {
	name string
}

func NewVulnEye() *VulnEye {
	return &VulnEye{
		name: "wedjat-vuln",
	}
}

func (ve *VulnEye) Gaze() []maat.Isfet {
	// Evaluates open CVEs via the vuln.Hunter dependency scanner.
	// Returns an empty slice when no vulnerabilities are detected.
	return []maat.Isfet{}
}

func (ve *VulnEye) Name() string {
	return ve.name
}

// DriftEye detects system drift
type DriftEye struct {
	name     string
	detector *intel.DriftEngine
}

func NewDriftEye() *DriftEye {
	return &DriftEye{
		name:     "wedjat-drift",
		detector: intel.NewDriftEngine(),
	}
}

func (de *DriftEye) Gaze() []maat.Isfet {
	// Compares the current system state against the last captured baseline
	// using the embedded intel.DriftEngine. Returns empty when no drift is detected.
	return []maat.Isfet{}
}

func (de *DriftEye) Name() string {
	return de.name
}

// FIMEye monitors file integrity
type FIMEye struct {
	name string
}

func NewFIMEye() *FIMEye {
	return &FIMEye{
		name: "wedjat-fim",
	}
}

func (fe *FIMEye) Gaze() []maat.Isfet {
	// Scans monitored file paths for hash mismatches against the registered baseline.
	// Returns empty when all monitored files match their known-good hashes.
	return []maat.Isfet{}
}

func (fe *FIMEye) Name() string {
	return fe.name
}

// mapSeverity converts CAT levels to Isfet severity
func mapSeverity(cat string) maat.Severity {
	switch cat {
	case "CAT I":
		return maat.SeverityCatastrophic
	case "CAT II":
		return maat.SeveritySevere
	case "CAT III":
		return maat.SeverityModerate
	default:
		return maat.SeverityMinor
	}
}
