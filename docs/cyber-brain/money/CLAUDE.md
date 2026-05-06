# AdinKhepra ASAF Engine — Project Intelligence for Claude Code

## Who you are working with

You are assisting SGT Souhimbou "Cyber" Doh Kone, founder of SecRed Knowledge Inc.
(NouchiX), SDVOSB, Army Signal Corps 25S. He is a solo technical founder building
in sprint cycles with accelerator accountability. Be direct, concrete, and fast.
No preamble. No "great question!" No explaining what you're about to do — just do it.

When Cyber says "ship it" he means working, tested code now. When he says "clean it up"
he means remove dead code, not refactor architecture. When he says "make it simple" he
means fewer moving parts, not dumbed-down logic.

---

## What this product is — the two sentences that matter

**AdinKhepra is the security camera AND the flight recorder for AI agents.**

The security camera watches what your AI is doing in real time and alerts you.
The flight recorder keeps a permanent, tamper-proof record so you can prove
what happened after the fact. Same product. Both metaphors. Always together.

Never use "cryptographic attestation" in user-facing text without immediately
following it with the plain-English translation in parentheses.

---

## Product positioning — ingrain this deeply

### The one thing we sell
Proof of what AI agents did. Permanent. Tamper-proof. Auditor-ready.

### The two audiences and their trigger phrases

**DoD / DIB contractors:**
"Your AI tools and your upcoming CMMC audit — there's a gap nobody's
preparing for." The gap: no tamper-proof record of what AI tools did
in their CUI environment. DIBCAC assessors are starting to ask.

**Enterprise / Developer / DevSecOps:**
"Git blame for your AI agents." Every action signed, sequenced, and
impossible to deny. Works with Claude Code, Copilot, Cursor, anything
MCP-connected.

### What we are NOT
- Not a CMMC consulting firm
- Not an AI model or LLM
- Not dependent on Anthropic, OpenAI, or any AI provider
- Not a replacement for existing GRC tools (we sit underneath them)
- Not a DoD-only product (that's one market, not the identity)

### The supply chain rule
The ASAF engine, DAG, STIG scanner, and PQC layer make ZERO calls to
any external AI API. Never add a hard dependency on Anthropic, OpenAI,
or any LLM provider to the core engine. The AI conversational interface
(G0DM0D3) is always a pluggable optional layer. If you're writing code
that calls api.anthropic.com anywhere outside of pkg/g0dm0d3/, stop
and ask Cyber first.

---

## Repository structure

```
giza-cyber-shield/
├── cmd/
│   ├── adinkhepra/          ← Main CLI binary (primary user interface)
│   │   ├── main.go          ← Command dispatcher
│   │   ├── serve.go         ← Dashboard server + G0DM0D3
│   │   ├── scan.go          ← STIG + security scan
│   │   ├── ert.go           ← Executive Roundtable (4-package analysis)
│   │   └── validate.go      ← System health check
│   └── agent/               ← Agent server (port 45444)
│       └── main.go
│
├── pkg/
│   ├── adinkra/             ← 🔑 CORE: Adinkra PQC engine (PATENT PENDING)
│   │   ├── lattice.go       ← Merkaba white-box encryption
│   │   ├── khepra_pqc.go    ← Adinkhepra-PQC signatures + ASAF attestation
│   │   └── hybrid_crypto.go ← Hybrid classical+PQC
│   │
│   ├── dag/                 ← 🔑 CORE: Immutable DAG (the flight recorder)
│   │   ├── dag.go           ← DAG node structure + hashing
│   │   ├── global.go        ← Singleton instance
│   │   ├── persistence.go   ← Disk flush (RAM→disk every 5s)
│   │   ├── encryption.go    ← AES-256-GCM at rest
│   │   └── dod_logger.go    ← DoD-compliant audit logging
│   │
│   ├── stig/                ← 36,195 cross-framework compliance mappings
│   │   ├── database.go      ← Embedded CSV loader (STIG→CCI→NIST→CMMC)
│   │   ├── validator.go     ← Multi-framework orchestration
│   │   ├── syschecks.go     ← Real system validation (no mocks)
│   │   └── rhel09_stig.go   ← RHEL-09 STIG-V1R3 checks
│   │
│   ├── asaf/                ← 🆕 AI Agent wrapper (the security camera)
│   │   ├── wrapper.go       ← MCP interceptor for any AI agent
│   │   ├── recorder.go      ← Action→DAG node pipeline
│   │   └── drift.go         ← Behavioral baseline + anomaly detection
│   │
│   ├── ert/                 ← Executive Roundtable (4-package analysis)
│   │   ├── engine.go        ← Central coordinator
│   │   ├── cve_database.go  ← CISA KEV + NVD loader
│   │   ├── analysis.go      ← Real data analysis
│   │   └── godfather.go     ← Business impact synthesis
│   │
│   ├── license/             ← Khepra License system (offline-capable)
│   │   └── manager.go       ← Device fingerprint + Dilithium3 token
│   │
│   ├── fingerprint/         ← Hardware-bound device identification
│   │   └── device.go        ← MAC+CPU+TPM+disk fingerprint
│   │
│   ├── logging/             ← DoD-compliant dual-tap logging
│   │   └── dod_logger.go    ← Stdout JSON + internal DAG
│   │
│   ├── sonar/               ← Network intelligence + device fingerprinting
│   ├── webui/               ← DAG visualization server
│   ├── gateway/             ← Zero-trust auth layer
│   └── g0dm0d3/             ← Local AI brain (optional, pluggable)
│       └── server.go        ← Provider abstraction (Anthropic/OpenRouter/Offline)
│
├── data/
│   ├── cve-database/        ← Local CVE cache (air-gap capable)
│   └── known_exploited/     ← CISA KEV local copy
│
├── deploy/
│   ├── k8s/                 ← Kubernetes manifests
│   └── govcloud/            ← AWS GovCloud Terraform
│
├── docs/                    ← Architecture, patent, compliance docs
├── CLAUDE.md                ← This file
└── go.mod
```

---

## Tech stack — know this cold

| Layer | Technology | Why |
|---|---|---|
| Core language | Go 1.22+ | Single static binary, zero runtime deps |
| PQC crypto | Cloudflare CIRCL | FIPS 203/204 ML-KEM + ML-DSA |
| Classical crypto | golang.org/x/crypto | AES-256-GCM, Argon2id |
| Frontend | Next.js / TypeScript | Agent dashboard |
| Embedded DB | BadgerDB | Zero-dep persistent KV store |
| Visualization | D3.js | DAG force graph |
| Build | CGO_ENABLED=0 | Static binary, no C deps |

**Go version:** Always use `go build -ldflags="-s -w" -o bin/NAME ./cmd/NAME`
**Cross-compile for VPS:** `GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build ...`

---

## Build commands — use these exactly

```bash
# Development build (Windows)
go build -o bin/adinkhepra.exe ./cmd/adinkhepra

# Production build for Linux VPS
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 \
  go build -ldflags="-s -w" -o bin/adinkhepra-linux-amd64 ./cmd/adinkhepra

# Run agent server locally
go run ./cmd/agent

# Full validate
./bin/adinkhepra validate

# Deploy to VPS
scp bin/adinkhepra-linux-amd64 root@187.124.225.91:/opt/adinkhepra/bin/adinkhepra
ssh root@187.124.225.91 "systemctl restart adinkhepra"
```

---

## The DAG — understand this before touching anything

The DAG (Directed Acyclic Graph) is the flight recorder. Every security event,
AI agent action, STIG finding, and compliance check becomes a DAG node. Nodes
are content-addressed (SHA-256), Dilithium3-signed, and AES-256-GCM encrypted
at rest. They cannot be altered without detection. They do not get deleted.

**Rules:**
- Every significant operation MUST write a DAG node. No silent operations.
- DAG nodes go through `dag.GlobalDAG()` — never create a new Memory instance.
- Use the Adinkra symbol constants to classify nodes:
  - `"Eban"` = security/defense actions
  - `"Fawohodie"` = privilege/revocation events
  - `"Nkyinkyim"` = state transitions
  - `"Dwennimmen"` = high-assurance/Byzantine context
- Every DAG write must log to the DoD logger as well.

---

## The ASAF wrapper — what we're building right now

`pkg/asaf/` is the security camera layer. It intercepts AI agent actions via MCP
and writes signed records to the DAG. This is our primary competitive differentiator
and the feature that enables the new positioning.

When building ASAF components:
1. The wrapper must be transparent — the AI agent doesn't know it's being watched
2. Every intercepted action gets a DAG node within 100ms (performance SLA)
3. The wrapper works with ANY MCP-compatible tool without modification
4. Behavioral drift detection compares current session against signed baseline
5. No AI provider dependency — the wrapper works on the protocol, not the model

---

## Code style rules

**Go:**
- Error handling: always handle, never `_` on errors in production paths
- Logging: use `pkg/logging/dod_logger.go`, not `fmt.Println` or `log.Printf`
- Config: read from `~/.khepra/config.json` or env vars, never hardcode
- Secrets: never commit API keys, private keys, or passwords. Use env vars.
- Comments: write comments that explain WHY, not WHAT
- Function size: if a function is over 60 lines, split it

**Naming:**
- Public functions that write to DAG: prefix with `Record` (e.g., `RecordSTIGFinding`)
- Public functions that read from DAG: prefix with `Fetch` or `Query`
- ASAF wrappers: prefix with `Wrap` (e.g., `WrapMCPAgent`)
- Attestation functions: prefix with `Attest`

**Error messages:**
- Always include the function name: `fmt.Errorf("RecordSTIGFinding: %w", err)`
- DoD-facing errors must not expose internal paths or keys

**TypeScript (Next.js):**
- Use `const` over `let` always
- All API calls go through `lib/api.ts` — never fetch directly in components
- Components in `components/`, pages in `app/` (Next.js App Router)

---

## Security invariants — never violate these

1. **No CGO in production binaries.** Set `CGO_ENABLED=0` at build time.
2. **No external AI API calls in core engine.** Only in `pkg/g0dm0d3/`.
3. **No plaintext secrets on disk.** Everything sealed with AES-256-GCM.
4. **master_seed.sealed lives at `~/.asaf/keys/`.** Never in project root.
5. **No `log.Fatal` after init.** Graceful shutdown only.
6. **No `panic()` in production paths.** Return errors.
7. **Dilithium3 sign every DAG node.** No unsigned nodes in prod.
8. **FIPS 203/204/205 only for new crypto.** No RSA for new features.

---

## What to build — current sprint priorities

### Priority 1: ASAF MCP Wrapper (this week)
File: `pkg/asaf/wrapper.go`
Goal: Intercept MCP calls from any AI agent, create signed DAG node per action.
Demo target: wrap Claude Code, show signed action history in dashboard.

```go
// Minimum viable interface to implement:
type ASAFWrapper interface {
    WrapMCPAgent(agentID string, agentType string) (*WrappedAgent, error)
    RecordAction(agent *WrappedAgent, action MCPAction) (*dag.Node, error)
    GetActionHistory(agentID string) ([]*dag.Node, error)
    DetectDrift(agentID string) (*DriftReport, error)
}
```

### Priority 2: CLI simplification
Current: Too many fragmented subcommands.
Target surface:
```
adinkhepra scan        # STIG + AI agent + PQC — everything
adinkhepra watch       # Start ASAF wrapper + FIM daemon
adinkhepra report      # Generate evidence package
adinkhepra serve       # Dashboard + G0DM0D3 on :45444
adinkhepra license     # License management
```

### Priority 3: VPS deployment
Binary: `adinkhepra-linux-amd64`
Target: root@187.124.225.91
Config: /opt/adinkhepra/config/server.json
Service: /etc/systemd/system/adinkhepra.service

### Priority 4: G0DM0D3 provider abstraction
Make `pkg/g0dm0d3/server.go` use `NewBestAvailableProvider()`:
1. Check ANTHROPIC_API_KEY → use Anthropic
2. Check OPENROUTER_API_KEY → use OpenRouter  
3. Fallback → Offline rule-based mode
Zero Ollama requirement. Zero hard dependency.

---

## What NOT to build right now

- Phantom network / counter-surveillance features (separate private repo)
- Blockchain integration (IPFS/Arweave is for CRL distribution only)
- Multi-tenant SaaS infrastructure (single-tenant first)
- New frontend components until ASAF wrapper is working
- Any feature that requires a running LLM to function

---

## The demo that closes deals — build toward this

A prospect runs: `adinkhepra watch`

They open http://localhost:45444 in their browser.

They use Claude Code or Copilot for 5 minutes normally.

They click "Show AI Activity" in the dashboard.

They see: every file their AI read, every API it called, every suggestion
it made — with timestamps, signed hashes, and a green checkmark showing
the record hasn't been tampered with.

You say: "That's what an auditor sees. Can you do that today without us?"

Build toward that demo. Every sprint.

---

## Context about the founder

- Army Signal Corps Sergeant (25S SATCOM), active duty
- UAlbany Computer Science MS (NSA CAE-CDE program), graduating May 2026
- SDVOSB — sole source authority up to $5M for defense contracts
- Patent pending USPTO #73565085 (Adinkra-based PQC attestation)
- Active accelerator cohort — North Star: first signed pilot
- GitHub: EtherVerseCodeMate / repo: giza-cyber-shield
- VPS: root@187.124.225.91 (Hostinger, Ubuntu 24.04, 32GB RAM)
- Primary dev machine: Windows with WSL2

---

## Do not hallucinate these

- The patent number is **73565085**. Don't change it.
- The PQC algorithms are **Dilithium3** (signing) and **Kyber-1024** (KEM). Use these exact names in docs/comments.
- The compliance database has **36,195** mappings. Don't round it.
- The company is **SecRed Knowledge Inc. (NouchiX)**, not NouchiX Inc. or SecRed Inc.
- The product is **AdinKhepra** (one word, capital A and K). Not Adin-Khepra.
- The framework is **ASAF** (Agentic Security Attestation Framework). Not ASAF™ or ASAF™️.
- SDVOSB stands for Service-Disabled Veteran-Owned Small Business.
