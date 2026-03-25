# Copilot Instructions for Khepra Protocol

**Project:** ADINKHEPRA (Agentic Security Attestation Framework) — Post-Quantum Security Attestation Engine  
**Repository:** `EtherVerseCodeMate/giza-cyber-shield`  
**Architecture:** Go backend + Next.js frontend + Python orchestration

---

## 1. Big Picture Architecture

**Core Philosophy:** Move security from "compliance theater" (checklists) to "causal reality" (cryptographic proof via DAGs).

### Key Components
- **Agent** (`cmd/agent/`) — REST API server (port 45444) for attestations, DAG mutations, risk scoring
- **CLI Tool** (`cmd/adinkhepra/`) — Attestation engine with PQC key generation, encryption, STIG validation
- **DAG Store** (`pkg/dag/`) — Immutable directed acyclic graph (cryptographically-bound node chain) tracking security events
- **ERT Engine** (`pkg/ert/`) — Executive Risk Tailoring: causal chains, readiness scoring, business impact analysis
- **Compliance** (`pkg/stig/`) — STIG checks, NIST 800-53/171, CIS mapping, cross-framework reconciliation
- **Attestation** (`pkg/attest/`) — Risk attestations with PQC signatures (Dilithium) and lifecycle management
- **Frontend** (Next.js, Tailwind, Radix UI) — DAG visualization, risk dashboards, compliance reports

### Critical Data Structures
- **Node** (`pkg/dag/dag.go`) — Immutable graph vertex: `ID` (content hash), `Parents`, `Action`, `Symbol`, `Signature`
- **RiskAttestation** (`pkg/attest/attest.go`) — Target-specific risk snapshot with PQC signature, score (0–100), findings
- **Snapshot** (`pkg/types/snapshot.go`) — Full system state: network, services, processes, software inventory

---

## 2. Build & Run Workflows

### Development Build
```bash
make build              # Compiles: adinkhepra, agent, gateway
make run-agent          # Starts agent on port 45444
python adinkhepra.py validate  # Run unit tests + PQC CLI test + API smoke tests
```

### Security-Hardened Builds
```bash
make secure-build       # Strips symbols, disables CGO (no libc dependency)
make fips-build         # GODEBUG=fips140=on (Go 1.24+ native FIPS)
make fips-boring-build  # BoringCrypto for DoD Iron Bank (Linux/amd64 only)
```

### Python Orchestration
The `adinkhepra.py` runner (lines 1–286) wraps builds with environment injection:
- Detects Windows/Linux and adds `.exe` suffix appropriately
- Injects `GOEXPERIMENT=boringcrypto` + `CGO_ENABLED=1` for FIPS modes
- Provides `validate()` for full smoke tests: unit tests → PQC key generation → API health checks

**Key Env Variables** (set before build):
- `ADINKHEPRA_AGENT_PORT` — Agent listen port (default: 45444)
- `ADINKHEPRA_EXTERNAL_IP` — Public IP (for license/telemetry)
- `ADINKHEPRA_STORAGE_PATH` — Data persistence (K8s: `/var/lib/adinkhepra/data`, dev: `./data`)
- `GODEBUG=fips140=on` — Enable native FIPS validation at runtime

---

## 3. Project Conventions

### Go Code Organization
- **`cmd/`** — Entry points: binary has one main per component (agent, CLI, gateway)
- **`pkg/`** — Shared libraries organized by domain (dag, attest, crypto, stig, ert, intel)
- **Immutability emphasis** — DAG nodes are computed-hash-identified and never mutated; mutations only via new nodes
- **Interface-driven** — `Store` interface (`pkg/dag/`) allows pluggable backends (Memory, persistent, etc.)

### Adinkra Symbols & Naming
Project uses West African Adinkra symbols as organizational metaphors:
- `Eban` — Wall/Boundary (perimeter security symbol)
- `Symbol` fields in DAG nodes map to compliance frameworks (STIG, NIST, CIS)
- Convention: Use consistent symbol names in attestations for cross-framework coherence

### Configuration Pattern
All runtime config via environment variables (`pkg/config/config.go`):
```go
func Load() Config {
    ExternalIP: getenv("ADINKHEPRA_EXTERNAL_IP", "127.0.0.1"),
    // ... etc
}
```
**Do not** hardcode secrets; use env vars + secure storage (sealed artifacts under `keys/`, `telemetry-keys/`).

### PQC Cryptography
- **Primary:** Dilithium (NIST-standardized signature)
- **Hybrid:** Kyber (key encapsulation)
- **Provider:** Cloudflare CIRCL (`github.com/cloudflare/circl`)
- **Triple-layering pattern:** Dilithium + legacy crypto for backward compatibility
- **Signature format:** Base64-encoded, stored in DAG nodes and attestations

---

## 4. Integration Points

### Agent API (`cmd/agent/main.go`, port 45444)
Key endpoints:
- `GET /healthz` — Server alive check
- `POST /attest/new` — Create new risk attestation
- `POST /dag/add` — Append node to DAG (`{"action":"...", "symbol":"..."}`)
- `GET /dag/state` — Fetch all DAG nodes (immutable history)

### License Manager
- Singleton initialized in agent startup
- Env: `KHEPRA_LICENSE_SERVER` (default: `https://telemetry.souhimbou.org`)
- Enrollment token via `KHEPRA_ENROLLMENT_TOKEN` auto-registers on first boot
- Machine ID: `./bin/adinkhepra --machine-id` for manual registration

### LLM Integration (`pkg/llm/`)
- **Provider:** Configurable (default: Ollama)
- **Env:** `ADINKHEPRA_LLM_PROVIDER`, `ADINKHEPRA_LLM_MODEL` (default: `phi4`), `ADINKHEPRA_LLM_URL`
- **Use:** ERT engine uses LLM for narrative risk summaries and recommendations

### STIG Compliance Adapter
- Central cross-framework mapper: `pkg/stigs/adapter.go`
- Translates STIG checks → NIST 800-53 → CIS → custom frameworks
- Symbol-based matching ensures consistency across frameworks

### External Threat Intel
- CISA KEV (Known Exploited Vulnerabilities)
- MITRE ATT&CK framework correlation
- Shodan/Censys asset discovery
- Data stored under `data/cve-database/` (fetch via `make fetch-cve`)

---

## 5. Testing & Validation

### Unit Tests
```bash
go test -count=1 ./...           # Full test suite (deterministic, no cache)
go test -count=1 ./pkg/dag/...   # DAG logic tests
go test -count=1 ./pkg/stig/...  # STIG validation tests
```

### Smoke Tests
```bash
python adinkhepra.py validate    # Full validation suite
```
Validates: unit tests → PQC key generation → API healthcheck + attestation creation.

### Manual API Testing
```bash
# Start agent
make run-agent

# In another terminal
curl -s http://127.0.0.1:45444/healthz | jq
curl -s -X POST http://127.0.0.1:45444/dag/add \
  -H "Content-Type: application/json" \
  -d '{"action":"Initialize perimeter","symbol":"Eban"}' | jq
```

---

## 6. Key Files to Know

| File | Purpose |
|------|---------|
| `Makefile` | Build targets: `build`, `fips-build`, `test`, `ci-test` |
| `cmd/agent/main.go` | Agent server; license + DAG + LLM initialization |
| `cmd/adinkhepra/main.go` | CLI: 1100+ lines; keygen, crack, encryption (ogya/nsuo), STIG tests |
| `pkg/dag/dag.go` | DAG core: `Node`, `Store` interface, hash computation |
| `pkg/attest/attest.go` | Attestation types: `RiskAttestation`, `Assertion` |
| `pkg/stig/` | STIG validator, NIST 800-171, CIS, PDF export |
| `pkg/ert/` | Executive readiness: causal chains, business impact scoring |
| `pkg/config/config.go` | Config loader (env vars → struct) |
| `adinkhepra.py` | Python wrapper: build orchestration, FIPS injection, validation |
| `.github/thedependabot.yml` | Dependabot config (minimal; vendor mod preferred) |

---

## 7. Common Patterns & Gotchas

### DAG Immutability
**Pattern:** Never modify a `Node` after creation. New mutations → new `Node` with parent link.
```go
newNode := &dag.Node{
    Action: "Apply patch",
    Symbol: "Nkyinkyim",
    Parents: []string{parentNode.ID},
}
store.Add(newNode, newNode.Parents)
```

### Singleton Global DAG
**Pattern:** All components write to `dag.GlobalDAG()` (not individual instances). Ensures consistency.
```go
store := dag.GlobalDAG()  // in agent, CLI, ERT — all reference same graph
```

### Config-Driven Behavior
**Avoid:** Hardcoded IPs, ports, paths.  
**Do:** Read from config: `cfg := config.Load()` then `cfg.AgentListenPort`, `cfg.StoragePath`, etc.

### Cross-Framework Mapping
**Pattern:** Symbol-based (not direct STIG ID) to allow multiple frameworks without conflict.
```go
// STIG check "SV-257023r867622_rule" → Symbol "Eban" → applicable to NIST, CIS
```

### Testing with Vendor Mode
**Important:** CI uses `-mod=vendor` to avoid network fetches. Use `go mod tidy` before commits.
```bash
go test -count=1 -mod=vendor ./...  # CI test target
```

---

## 8. Known Limitations & Workarounds

- **FIPS BoringCrypto:** Linux/amd64 only; requires `gcc` for CGO. Use native FIPS (`make fips-build`) for cross-platform.
- **LLM Default:** Ollama (local). Requires external Ollama server; fallback to text summaries if unavailable.
- **CVE Database:** Requires `make fetch-cve` on first run; ~1GB download.
- **Windows:** Bash tests may require WSL or Git Bash; PowerShell scripts preferred for Windows-native paths.

---

## 9. Running the Demo

Pre-built demo materials under `demo/` and `docs/consulting/`:
```bash
# Generate DAG visualization
curl -s http://127.0.0.1:45444/dag/state | jq . > dag-snapshot.json

# View in browser (if served)
open dag-visualization.html

# Generate executive summary
./bin/adinkhepra report --format=pdf > executive-summary.pdf
```

---

**Questions?** Review `docs/architecture/CAUSAL_REALITY_ANALYSIS.md` and `IMPLEMENTATION_GUIDE.md` for deeper dives.
