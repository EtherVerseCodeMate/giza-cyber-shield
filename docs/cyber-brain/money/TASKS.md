# AdinKhepra Sprint Kickoff — Current Tasks
# Drop this in project root as TASKS.md
# Claude Code / Cursor: start here when Cyber says "pick up where we left off"

## STATUS: IN SPRINT — NORTH STAR = FIRST SIGNED PILOT

---

## TASK 1 — ASAF MCP Wrapper [SHIP THIS FIRST]
**File to create:** `pkg/asaf/wrapper.go`
**File to create:** `pkg/asaf/recorder.go`
**File to create:** `pkg/asaf/drift.go`
**File to update:** `cmd/adinkhepra/main.go` (add `watch` command)

### What it does
Intercepts MCP calls from any AI agent (Claude Code, Copilot, Cursor, custom)
and writes a Dilithium3-signed DAG node for every action. Transparent to the
AI — it doesn't know it's being recorded.

### Minimum viable implementation

```go
// pkg/asaf/wrapper.go

package asaf

import (
    "time"
    "github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/dag"
    "github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/logging"
)

// MCPAction represents a single intercepted AI agent action
type MCPAction struct {
    AgentID     string            // e.g. "claude-code-session-abc123"
    AgentType   string            // "claude-code", "copilot", "cursor", "custom"
    Tool        string            // MCP tool name: "read_file", "write_file", etc.
    Parameters  map[string]string // Tool parameters (file paths, queries, etc.)
    Result      string            // Tool result (truncated if large)
    Timestamp   time.Time
    SessionID   string
}

// WrappedAgent is a live session being recorded
type WrappedAgent struct {
    AgentID    string
    AgentType  string
    SessionID  string
    StartedAt  time.Time
    BaselineID string // DAG node ID of first action (baseline for drift)
}

// ASAFWrapper is the security camera + flight recorder for one AI agent
type ASAFWrapper struct {
    dag    dag.Store
    logger *logging.DoDLogger
}

func NewASAFWrapper(store dag.Store, logger *logging.DoDLogger) *ASAFWrapper {
    return &ASAFWrapper{dag: store, logger: logger}
}

// WrapMCPAgent starts recording a new AI agent session
func (w *ASAFWrapper) WrapMCPAgent(agentID, agentType string) (*WrappedAgent, error) {
    // TODO: implement
    // 1. Create session ID
    // 2. Write genesis DAG node (session start)
    // 3. Return WrappedAgent
}

// RecordAction intercepts one MCP tool call and writes it to the DAG
func (w *ASAFWrapper) RecordAction(agent *WrappedAgent, action MCPAction) (*dag.Node, error) {
    // TODO: implement
    // 1. Build node payload (action details, truncated result)
    // 2. Write to dag.GlobalDAG() with Eban symbol
    // 3. Log to DoD logger
    // 4. Return node for caller to reference
}

// GetActionHistory returns all DAG nodes for a given agent session
func (w *ASAFWrapper) GetActionHistory(sessionID string) ([]*dag.Node, error) {
    // TODO: implement
    // Query DAG for nodes with sessionID in attributes
}

// DetectDrift compares current session behavior against signed baseline
func (w *ASAFWrapper) DetectDrift(agent *WrappedAgent) (*DriftReport, error) {
    // TODO: implement
    // Compare tool usage patterns against baseline session
}

type DriftReport struct {
    AgentID      string
    DriftDetected bool
    Score         float64  // 0.0 = identical to baseline, 1.0 = completely different
    Anomalies    []string  // Human-readable anomaly descriptions
    DAGNodeID    string    // ID of the drift event node
}
```

### New CLI command to add
```go
// cmd/adinkhepra/watch.go
// adinkhepra watch
// → starts ASAF wrapper listening on MCP port
// → starts FIM daemon  
// → opens dashboard at http://localhost:45444
// → prints signed action records in real time
```

### Definition of done
- `adinkhepra watch` starts without error
- Open Claude Code, make any file change
- Dashboard at :45444 shows the signed action record
- `adinkhepra report --session [ID]` exports evidence package

---

## TASK 2 — G0DM0D3 Provider Abstraction [NO OLLAMA REQUIRED]
**File to create:** `pkg/g0dm0d3/server.go` (overwrite existing)
**File to update:** `cmd/adinkhepra/serve.go`

### What it does
G0DM0D3 local brain works without Ollama. Priority order:
1. ANTHROPIC_API_KEY env var → use Anthropic claude-sonnet-4-6
2. OPENROUTER_API_KEY env var → use OpenRouter
3. License file contains api key → use Anthropic with license budget
4. Nothing → offline rule-based mode (still useful, no error)

### Key rule
The serve command must start successfully even with zero AI configuration.
Offline mode is a valid state, not an error state.

---

## TASK 3 — CLI Simplification [CLEAN UP THE INTERFACE]
**File to update:** `cmd/adinkhepra/main.go`

### Current problem
Too many top-level commands. Prospects see `--help` and get overwhelmed.

### Target command surface
```
adinkhepra scan      # Everything: STIG + AI agent audit + PQC inventory
adinkhepra watch     # Start live ASAF wrapper + FIM daemon (NEW)
adinkhepra report    # Generate evidence package (CMMC/NIST/STIG)
adinkhepra serve     # Dashboard + G0DM0D3 on :45444
adinkhepra harden    # Auto-remediate findings from last scan
adinkhepra license   # License management (status, request, install)
adinkhepra keygen    # Generate Dilithium3/Kyber keypair
```

Keep all existing commands working as aliases or subcommands.
`ert full` becomes `scan --ert` or just part of `scan`.

---

## TASK 4 — VPS DEPLOYMENT [SHIP TO PRODUCTION]

```bash
# Build
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 \
  go build -ldflags="-s -w" \
  -o bin/adinkhepra-linux-amd64 \
  ./cmd/adinkhepra

# Deploy
scp bin/adinkhepra-linux-amd64 \
  root@187.124.225.91:/opt/adinkhepra/bin/adinkhepra

ssh root@187.124.225.91 "
  chmod +x /opt/adinkhepra/bin/adinkhepra
  systemctl restart adinkhepra
  systemctl status adinkhepra
"

# Verify
curl https://srv1494994.hstgr.cloud/healthz
```

### Nginx is already configured on the VPS for:
- https://srv1494994.hstgr.cloud → proxy to :45444
- /api/* → AdinKhepra API
- /beacon → telemetry
- /crl → license revocation list

---

## TASK 5 — README UPDATE [MARKETING]
**File to update:** `README.md` in repo root

Replace entire README with contents of `/home/claude/assets/README_new.md`
(already drafted — just copy it in).

Key positioning changes:
- Hero: "Your AI agents are working right now. Do you know what they're doing?"
- Two metaphors: security camera (real-time) + flight recorder (permanent record)
- Lead with the problem, not the solution
- No "cryptographic attestation" without plain-English translation

---

## COMPLETED TASKS (reference)

- [x] ERT 360° ecosystem integration
- [x] DAG production-grade persistence + encryption
- [x] 36,195 compliance mappings embedded
- [x] STIG validation system (RHEL-09, CIS, NIST)
- [x] PQC stack (Dilithium3 + Kyber-1024 + AES-256-GCM)
- [x] Iron Bank hardening (ECR-01, ECR-02, ECR-03)
- [x] Living Trust Constellation DAG visualization
- [x] Nginx + systemd config for Hostinger VPS
- [x] Device fingerprint-based license system design
- [x] G0DM0D3 provider abstraction design

---

## HOW CYBER WORKS — respect this

- **Sprint rhythm:** accelerator cohort, weekly check-ins, deliverable-based
- **Ship signal:** "ship it" = working binary, on VPS, today
- **Demo signal:** "demo ready" = can show a prospect in 20 minutes without prep
- **Clean signal:** "clean this up" = remove dead code, not redesign
- **Context signal:** "pick up where we left off" = read TASKS.md + git log
- **Urgent signal:** "asap" or "right now" = drop everything else, do this first

When in doubt: build toward the demo. The demo closes deals. The demo is Task 1.
