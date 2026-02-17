package ouroboros

import (
	"crypto/sha256"
	"encoding/hex"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/audit"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/enumerate"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/intel"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/maat"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/scanners"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/stig"
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
	log.Printf("[%s] Scanning STIG compliance...", se.name)
	isfet := []maat.Isfet{}

	// Create real validator
	v := stig.NewValidator(".")
	v.EnableFramework("RHEL-09-STIG-V1R3")

	report, err := v.Validate()
	if err != nil {
		log.Printf("[%s] Scan failed: %v", se.name, err)
		return isfet
	}

	result, ok := report.Results["RHEL-09-STIG-V1R3"]
	if !ok {
		return isfet
	}

	for _, finding := range result.Findings {
		if finding.Status == "Fail" {
			chaos := maat.Isfet{
				ID:        finding.ID,
				Source:    se.name,
				Severity:  mapStigSeverity(finding.Severity),
				Certainty: 1.0,
				Omens: []maat.Omen{
					{Name: "Description", Value: finding.Description, Malevolence: 1.0},
					{Name: "Title", Value: finding.Title, Malevolence: 1.0},
				},
			}
			isfet = append(isfet, chaos)
		}
	}

	return isfet
}

func mapStigSeverity(s stig.Severity) maat.Severity {
	switch s {
	case "CAT1", "Critical":
		return maat.SeveritySevere
	case "CAT2", "High":
		return maat.SeverityModerate
	default:
		return maat.SeverityMinor
	}
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
	log.Printf("[%s] Scanning for vulnerabilities...", ve.name)
	isfet := []maat.Isfet{}

	findings, err := scanners.RunBuiltInVulnerabilityScan(".")
	if err != nil {
		log.Printf("[%s] Scan failed: %v", ve.name, err)
		return isfet
	}

	for _, v := range findings {
		chaos := maat.Isfet{
			ID:        v.ID,
			Source:    ve.name,
			Severity:  mapVulnSeverity(v.Severity),
			Certainty: 0.9,
			Omens: []maat.Omen{
				{Name: "Description", Value: v.Description, Malevolence: 1.0},
				{Name: "Package", Value: v.Package, Malevolence: 0.8},
				{Name: "Version", Value: v.Version, Malevolence: 0.5},
			},
		}
		isfet = append(isfet, chaos)
	}

	return isfet
}

func mapVulnSeverity(s string) maat.Severity {
	switch strings.ToUpper(s) {
	case "CRITICAL":
		return maat.SeverityCatastrophic
	case "HIGH":
		return maat.SeveritySevere
	case "MEDIUM":
		return maat.SeverityModerate
	default:
		return maat.SeverityMinor
	}
}

func (ve *VulnEye) Name() string {
	return ve.name
}

// DriftEye detects system drift
type DriftEye struct {
	name     string
	detector *intel.DriftEngine
	baseline *audit.AuditSnapshot
}

func NewDriftEye() *DriftEye {
	return &DriftEye{
		name:     "wedjat-drift",
		detector: intel.NewDriftEngine(),
	}
}

func (de *DriftEye) Gaze() []maat.Isfet {
	log.Printf("[%s] Checking for configuration drift...", de.name)
	isfet := []maat.Isfet{}

	// 1. Collect current state
	current := &audit.AuditSnapshot{}

	// Collect network info
	ni, _ := enumerate.CollectNetworkIntelligence()
	current.Network = ni

	// Collect system info
	si, _ := enumerate.CollectSystemIntelligence()
	current.System = si

	// 2. Establish baseline if none exists
	if de.baseline == nil {
		log.Printf("[%s] Establishing initial baseline...", de.name)
		de.baseline = current
		return isfet
	}

	// 3. Compare current state against baseline
	report := de.detector.Compare(de.baseline, current)
	if report.HasDrift {
		log.Printf("[%s] DISK/NETWORK DRIFT DETECTED!", de.name)

		// Map drift report to Isfet
		if len(report.AddedPorts) > 0 {
			isfet = append(isfet, maat.Isfet{
				ID:        "DRIFT-NET-PORT",
				Source:    de.name,
				Severity:  maat.SeveritySevere,
				Certainty: 1.0,
				Omens: []maat.Omen{
					{Name: "AddedPorts", Value: strings.Join(report.AddedPorts, ","), Malevolence: 0.9},
				},
			})
		}
		if len(report.AddedProcesses) > 0 {
			isfet = append(isfet, maat.Isfet{
				ID:        "DRIFT-PROC-NEW",
				Source:    de.name,
				Severity:  maat.SeveritySevere,
				Certainty: 1.0,
				Omens: []maat.Omen{
					{Name: "AddedProcesses", Value: strings.Join(report.AddedProcesses, ","), Malevolence: 0.9},
				},
			})
		}
	}

	return isfet
}

func (de *DriftEye) Name() string {
	return de.name
}

// FIMEye monitors file integrity
type FIMEye struct {
	name     string
	baseline string
}

func NewFIMEye() *FIMEye {
	return &FIMEye{
		name: "wedjat-fim",
	}
}

func (fe *FIMEye) Gaze() []maat.Isfet {
	log.Printf("[%s] Checking file integrity...", fe.name)
	isfet := []maat.Isfet{}

	// Calculate recursive hash of current directory
	currentHash, err := fe.calculateDirectoryHash(".")
	if err != nil {
		log.Printf("[%s] FIM failed: %v", fe.name, err)
		return isfet
	}

	// 2. Establish baseline if none exists
	if fe.baseline == "" {
		log.Printf("[%s] Establishing initial FIM baseline: %s", fe.name, currentHash)
		fe.baseline = currentHash
		return isfet
	}

	// 3. Compare current state against baseline
	if currentHash != fe.baseline {
		log.Printf("[%s] FILE INTEGRITY COMPROMISED! (Old: %s, New: %s)", fe.name, fe.baseline, currentHash)
		isfet = append(isfet, maat.Isfet{
			ID:        "FIM-TAMPER-DIR",
			Source:    fe.name,
			Severity:  maat.SeverityCatastrophic,
			Certainty: 1.0,
			Omens: []maat.Omen{
				{Name: "OldHash", Value: fe.baseline, Malevolence: 1.0},
				{Name: "NewHash", Value: currentHash, Malevolence: 1.0},
			},
		})
	}

	return isfet
}

func (fe *FIMEye) calculateDirectoryHash(root string) (string, error) {
	hasher := sha256.New()
	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.IsDir() || strings.Contains(path, ".git") || strings.Contains(path, "vendor") {
			return nil
		}

		// Add filename and hash to directory hash
		fileHash, _ := scanners.CalculateFileHash(path)
		hasher.Write([]byte(path))
		hasher.Write([]byte(fileHash))

		return nil
	})
	return hex.EncodeToString(hasher.Sum(nil)), err
}

func (fe *FIMEye) Name() string {
	return fe.name
}
