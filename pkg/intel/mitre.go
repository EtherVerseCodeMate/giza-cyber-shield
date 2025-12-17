package intel

import (
	"fmt"
	"log"
	"os"
)

// --- MITRE ATT&CK Structure ---

type Tactic struct {
	ID          string      `json:"id"`
	Name        string      `json:"name"`
	Description string      `json:"description"`
	Techniques  []Technique `json:"techniques"`
}

type Technique struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

// --- Multi-Source Vulnerability Database (MITRE-Cyber-Security-CVE-Database) ---

type Vulnerability struct {
	ID          string  `json:"cve_id"`
	Source      string  `json:"source"` // NVD, MITRE, CISA
	Severity    string  `json:"severity"`
	CVSS        float64 `json:"cvss,omitempty"`
	Description string  `json:"description"`
	IsExploited bool    `json:"is_exploited"` // From CISA KEV
}

// KnowledgeBase holds the loaded threat intelligence (Tactics + CVEs)
type KnowledgeBase struct {
	Tactics         []Tactic                 `json:"tactics"`
	Vulnerabilities map[string]Vulnerability `json:"vulnerabilities"`
}

// NewKnowledgeBase initializes the Intel Core with static ATT&CK data
// and prepares the Vulnerability map for dynamic ingestion.
func NewKnowledgeBase() *KnowledgeBase {
	kb := &KnowledgeBase{
		Vulnerabilities: make(map[string]Vulnerability),
		Tactics: []Tactic{
			{
				ID:          "TA0043",
				Name:        "Reconnaissance",
				Description: "The adversary is trying to gather information they can use to plan future operations.",
				Techniques: []Technique{
					{ID: "T1595", Name: "Active Scanning"},
					{ID: "T1592", Name: "Gather Victim Host Information"},
				},
			},
			{
				ID:          "TA0001",
				Name:        "Initial Access",
				Description: "The adversary is trying to get into your network.",
				Techniques: []Technique{
					{ID: "T1190", Name: "Exploit Public-Facing Application"},
					{ID: "T1078", Name: "Valid Accounts"},
				},
			},
			{
				ID:          "TA0002",
				Name:        "Execution",
				Description: "The adversary is trying to run malicious code.",
				Techniques: []Technique{
					{ID: "T1059", Name: "Command and Scripting Interpreter"},
					{ID: "T1204", Name: "User Execution"},
				},
			},
			{
				ID:          "TA0040",
				Name:        "Impact",
				Description: "The adversary is trying to manipulate, interrupt, or destroy your systems and data.",
				Techniques: []Technique{
					{ID: "T1485", Name: "Data Destruction"},
					{ID: "T1486", Name: "Data Encrypted for Impact"},
				},
			},
		},
	}

	// Attempt to load Enterprise CVE Database if present
	if err := kb.LoadExternalData("data/cve-database"); err != nil {
		// Non-fatal, just log that we are running without offline DB
		log.Printf("[INTEL] Enterprise CVE Database not found at data/cve-database. Running in online-only mode.")
	}

	return kb
}

// LoadExternalData ingests real vulnerability data from the local filesystem.
func (kb *KnowledgeBase) LoadExternalData(path string) error {
	info, err := os.Stat(path)
	if os.IsNotExist(err) {
		return err
	}
	if !info.IsDir() {
		return fmt.Errorf("path is not a directory: %s", path)
	}

	log.Printf("[INTEL] Ingesting Threat Intelligence from %s...", path)
	return kb.LoadExternalDataWalk(path)
}

// SearchVuln allows the AGI to query the database by CVE ID
func (kb *KnowledgeBase) SearchVuln(cveID string) *Vulnerability {
	if v, ok := kb.Vulnerabilities[cveID]; ok {
		return &v
	}
	return nil
}
