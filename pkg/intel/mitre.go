package intel

// MITRE ATT&CK Data Structures

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

// KnowledgeBase holds the loaded threat intelligence
type KnowledgeBase struct {
	Tactics []Tactic `json:"tactics"`
}

// NewKnowledgeBase initializes the MITRE ATT&CK matrix (Subset for Khepra)
func NewKnowledgeBase() *KnowledgeBase {
	return &KnowledgeBase{
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
}
