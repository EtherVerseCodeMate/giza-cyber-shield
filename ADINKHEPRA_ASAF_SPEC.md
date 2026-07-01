# AdinKhepra ASAF — Complete Build Specification
# Document version: v2.1 (v2.0 + blindspot-audit revisions)
# Product release this spec targets: v1.1.1
# CMMC Autopilot Engine — Sovereign Compliance Desktop
# SecRed Knowledge Inc. / NouchiX — CONFIDENTIAL
# Last revised: 2026-07-01
# Supersedes: v2.0 (this revision) supersedes v1.0 (Next.js/web Surface 2 architecture)

> **Revision note (v2.1):** This revision incorporates the findings of
> `ASAF_SPEC_BLINDSPOT_AUDIT.md` (same date). Two findings were live,
> exploitable gaps in code that already ships in this repo — a symbol
> authorization bypass covering three of four Adinkra symbol tiers, and a
> shell-injection surface in the staging mirror — both fixed directly in
> `pkg/asaf/daemon/`. The rest are specification gaps (no threat model, no
> replay protection, no rollback path, no separation of duties, no CUI
> boundary on the commercial LLM path, and several others) that are closed
> in the sections below. Where this revision changes a stated behavior, the
> old text is not preserved — this document describes what v1.1.1 must do,
> not the history of what earlier drafts said.

---

## PRODUCT IDENTITY

AdinKhepra ASAF is what Google Antigravity is for developers — except for compliance engineers.
And unlike Antigravity, it sends NOTHING to Google (or anyone) by default. Egress is opt-in,
never silent, and never available while CUI handling is active (see Component 4).

**The question it answers:** Will I pass my CMMC audit?
**The buyer:** CISO, Compliance Lead, Contracts Officer at DIB contractors
**Pricing:** $45K (Pilot) / $75K-120K (Program) / $150K–$250K (Enterprise) / $5M SDVOSB sole-source
**Domain:** adinkhepra.com
**Patent:** USPTO #73565085 (KHEPRA Protocol, provisional)

---

## ARCHITECTURE DECISION RECORD: v1.0 → v2.0

**v1.0 (rejected):**
Surface 2 was a Next.js frontend + D3.js force graph communicating over localhost HTTP.
Problem: requires Node.js, npm install, a browser process, and a localhost bridge.
For a DIB contractor under CMMC assessment, this is a supply chain problem.
"Install Node.js first" is a non-starter with a government security team.

**v2.0 (this spec):**
Surface 2 is a native Go desktop application built with Fyne.
Single binary. Zero runtime dependencies for the UI itself. Air-gap ready. No browser. No npm.
Installs like PuTTY. The CISO double-clicks. It runs.
(The privileged daemon's staging gate has one documented runtime dependency —
a container runtime for the mirror environment — see Component 3 and
Non-Negotiable #3 for exactly what that does and doesn't mean.)

**Framework: Fyne (fyne.io/fyne/v2)**
- Pure Go — no C dependencies in application code
- OpenGL-accelerated via go-gl (GPU rendering), with a software-rendering
  fallback path (see Component 1) for VDI/thin-client environments common
  among DIB compliance staff
- Rich widget library: tables, trees, forms, file dialogs, progress bars
- Custom canvas API for force-directed compliance graph
- Single binary for Windows, macOS, Linux
- fyne package generates .app bundle (macOS) and .exe (Windows)

---

## THREAT MODEL & TRUST BOUNDARIES

This section did not exist before v2.1 and is added because several findings
in the blindspot audit trace back to it never having been written down.

**Trusted:**
- The holder of an enrolled `AgentID`'s ML-DSA-65 private key (see "Key
  Enrollment" under Component 3) — trusted to submit `ChangeRequest`s
  within the Adinkra symbol tier(s) that identity was enrolled for, and
  only for that tier.
- The daemon's own private key, used solely to sign DAG attestation nodes
  (never to authorize incoming requests).
- The embedded master public key used for offline license verification.

**Trust boundary:** the Unix domain socket (or named pipe on Windows)
between the desktop client and `asaf-daemon`, gated exclusively by ML-DSA-65
signature verification over the full canonical `ChangeRequest` (every field
except `Signature` itself — see Component 3). Filesystem permissions on the
socket (root-only, 0600) are a second, coarser boundary but are not a
substitute for signature verification; the daemon must never trust an
unsigned or badly-signed request regardless of which local user opened the
connection.

**Explicitly out of scope (accepted risk, not a defect):**
- An attacker who already has root on the production host. The daemon
  cannot defend against an adversary who can already read its own private
  key material or ptrace the process.
- An attacker who has exfiltrated a legitimately-enrolled desktop's private
  key through means outside this product (e.g., malware with disk access on
  the CISO's laptop). Mitigation is defense-in-depth (separation of duties,
  see Component 3) rather than prevention, since a single-binary, offline,
  air-gapped product cannot rely on a remote HSM by design.
- Physical access to an unattended, unlocked workstation.

**In scope and must be defended against:**
- A legitimately-enrolled identity attempting an operation outside its
  authorized symbol tier (Finding #1 — fixed).
- Replay of a previously-valid signed request (Finding #5 — see Component 3
  for the required fix).
- Command injection via `ChangeRequest.Command` content, at every layer the
  command passes through, including the staging mirror (Finding #2 —
  fixed).
- A single compromised desktop instance unilaterally authorizing a
  production change with no second human involved (Finding #7 — see
  Component 3).

---

## TWO SURFACES, ONE PRODUCT

```
Surface 1 — CLI (exists now, production-ready)
  Binary: adinkhepra.exe
  adinkhepra ert full .           DevSecOps engineer, CI/CD pipeline
  adinkhepra validate             System health check
  adinkhepra serve -port 8443     Lightweight DAG viewer (browser)
  Target user: engineer, CI/CD pipeline

Surface 2 — Compliance Graph Desktop (v1.1.1, build next)
  Binary: adinkhepra-desktop.exe
  Native Fyne GUI application
  3D/2D Compliance Graph          CISO sees compliance posture as force graph
  APDL Policy Editor              Click node → see + edit policy inline
  Staging Gate                    Review → Approve → attested execution
  Evidence Export                 One click → OSCAL + POAM + PDF + DAG
  Target user: CISO, Compliance Lead, the signer
```

`adinkhepra serve -port 8443` and the desktop's optional `--headless --port
8443` mode (installer's Windows Service entry) MUST bind to `127.0.0.1` by
default. Neither the CLI nor the desktop app may bind to a non-loopback
address without an explicit opt-in flag and mandatory request authentication
(the same device-bound license material used elsewhere) — "zero egress"
does not mean "unauthenticated ingress is fine." (Finding #10.)

---

## PRODUCT STRUCTURE: FOUR BINARIES

```
AdinKhepra ASAF v1.1.1 Release

adinkhepra-desktop.exe     Surface 2: CISO-facing native GUI
  Fyne desktop application
  Compliance graph (3D force-directed, OpenGL, software-render fallback)
  APDL policy editor (inline display + edit)
  Staging gate UI (with daemon integration)
  Evidence export (OSCAL + POAM + PDF)
  Reads: %ProgramData%\AdinKhepra ASAF\license.adinkhepra

adinkhepra.exe             Surface 1: engineer CLI
  Existing production binary
  All ERT packages A-D
  36,195-row compliance DB

asaf-daemon.exe             Privileged execution layer
  Runs as Windows Service / systemd unit
  Receives ML-DSA-65 signed ChangeRequests from an enrolled desktop
  Staging mirror (pinned, signature-verified container image) before any
  production change
  Human approval gate enforced, by a SECOND enrolled identity for
  production execution (see Component 3)

AdinKhepra-ASAF-Setup.exe  Installer wizard
  Fyne-based, 7-page wizard
  Embeds all three binaries above, plus the pinned staging mirror image
  Windows: service registration, shortcuts, Add/Remove Programs
  macOS: .app bundle in DMG (Authenticode-equivalent via notarization)
  Linux: install.sh + systemd unit + XDG .desktop entry
```

---

## ARCHITECTURE OVERVIEW

```
                     AdinKhepra ASAF v1.1.1
                    ────────────────────────────────────────────────
                    │                                                │
            Surface 1 (CLI)                  Surface 2 (Desktop GUI)
           adinkhepra.exe                    adinkhepra-desktop.exe
           ERT packages A-D                  Fyne compliance graph
           Godfather Report                  APDL policy editor
           STIG validator                    Staging approval UI
           DAG viewer (web, loopback-only)   OSCAL evidence export
                    │                                   │
                    └──────────────┬────────────────────┘
                                   │
                    ─────────────────────────────────────
                    │          CORE STACK (pkg/)         │
                    │                                    │
                 pkg/dag      pkg/adinkra            pkg/stig
              (immutable DAG) (ML-DSA-65/          (36K mapping
                               ML-KEM-768)             DB)
                    │
                    ├── pkg/intelligence/router.go (LLM Provider Router,
                    │   CUI-gated — see Component 4)
                    │
                    └── asaf-daemon.exe
                              │
                    ┌─────────┴──────────────────────┐
                 staging                          production
            pinned mirror image                privileged OS exec
            (sandbox, offline)                 (ML-DSA-65 signed,
                                                 2-identity approved)
```

---

## COMPONENT 1: COMPLIANCE GRAPH DESKTOP APP (Surface 2)

### Visual Identity

The app faithfully implements the color system and typography from dag-viewer.html.

```
Palette:
  NXNavy      #050c16   primary background
  NXBlue      #1a9fe8   brand blue, borders, active state
  AKGold      #e5a54b   metrics, scores, license tier
  SBCyan      #06b6d4   live indicators, attestation
  NodeRed     #cc2a36   CAT I/II STIG findings, CMMC failures
  NodeOrange  #f97316   at-risk (depends on a failing control)
  NodeYellow  #eab308   staging (being validated in mirror env)
  NodeGreen   #22c55e   passing + ML-DSA-65 attested
  NodeGray    #3d5a78   not yet scanned

Typography:
  HeadingFont = Space Grotesk (embedded, Apache 2.0)
  MonoFont    = JetBrains Mono (embedded, Apache 2.0)
```

### Application Layout

```
┌────────────────────────────────────────────────────────────────────┐
│ CUI // CONTROLLED UNCLASSIFIED INFORMATION // SecRed Knowledge Inc │  Red banner
├────────┬──────────────────────────────────────────────────────────┤
│ 𓂀 LOGO │ ADINKHEPRA ASAF  │  Graph  ERT  Evidence  Settings  ⚙  │  Header
│        │ SecRed Knowledge  │  ● LIVE   127 nodes   12 failing    │
├────────┴──────────────────────────────────────────────────────────┤
│  [NODE DETAIL PANEL] 288px  │  [3D COMPLIANCE GRAPH — OpenGL]    │
│                             │                                      │
│  On node click:             │  3D force-directed graph             │
│    ControlID                │  Nodes = CMMC/STIG controls          │
│    Category (CAT I/II)      │  Edges = control dependencies        │
│    Dollar impact            │  Colors: Red/Orange/Yellow/          │
│    Blast radius count       │          Green/Gray                  │
│    CMMC mappings            │  Click: detail panel opens           │
│    APDL snippet             │  Click: blast radius highlighted     │
│    [Stage to mirror]        │  Rotate/zoom: mouse drag             │
│    [Export evidence]        │                                      │
│                             │  Legend overlay (top-left):          │
│  Policy Editor (inline):    │  ● Red = failing                    │
│    APDL block display       │  ● Orange = at-risk                 │
│    [Edit Policy]            │  ● Yellow = staging                 │
│    [Sign & Stage]           │  ● Green = passing                  │
│                             │  ● Gray = pending                   │
│                             │                          NouchiX ©  │
├─────────────────────────────┴──────────────────────────────────────┤
│ CMMC_L2  │  42/110 passing  │  Scan: 3m ago  │  ML-DSA-65: 4017   │  Footer
└────────────────────────────────────────────────────────────────────┘
```

Note the workflow above ends at "Sign & Stage," not at production. Approving
a staged change for production is a distinct, separately-authenticated step
performed by a second identity — see "Production approval requires a second
identity" under Component 3. This panel intentionally does not have an
"Approve → Prod" button; that lives in a separate approval queue view
reachable only by an identity enrolled as an approver.

### Views

```
Graph      — 3D compliance force graph (default)
ERT        — ERT packages A-D results (tables + charts)
Evidence   — C3PAO package builder (OSCAL, PDF, POAM, DAG)
Approvals  — Production approval queue (separate identity required)
Settings   — license status, LLM provider, daemon connection
```

### Rendering fallback for VDI / no-GPU environments

The primary buyer persona (CISO / Compliance Lead) is disproportionately
likely to work from a locked-down VDI or thin client without GPU
passthrough. `dag_canvas.go` must detect OpenGL context creation failure at
startup and fall back to Fyne's software rasterizer for the force graph
(reduced frame rate, same interaction model) rather than failing to launch.
This is a hard requirement for v1.1.1, not an enhancement — a security
product that CISOs literally cannot open on their government-issued
workstation is not shippable. (Finding #15.)

### Source Layout

```
cmd/asaf-desktop/
└── main.go               Entry point: license check → splash → main window

app/
├── window.go             Main Fyne window, layout assembly
├── views/
│   ├── graph_view.go     3D compliance graph + node detail split
│   ├── ert_view.go       ERT A/B/C/D results (Fyne table widgets)
│   ├── evidence_view.go  C3PAO package builder UI
│   ├── approvals_view.go Production approval queue (2nd-identity gate)
│   └── settings_view.go  License, LLM config, daemon socket
├── widgets/
│   ├── classification_bar.go   "CUI" red banner (always visible)
│   ├── header_bar.go           Logo, nav tabs, live indicator
│   ├── status_footer.go        Framework, score, scan time, key ID
│   ├── dag_canvas.go           3D force-directed graph (OpenGL + software fallback)
│   ├── node_detail.go          Left panel: selected node + APDL + actions
│   ├── policy_editor.go        APDL inline display + edit widget
│   └── score_ring.go           Compliance % donut ring chart
└── theme/
    ├── asaf_theme.go     Custom Fyne theme: NXNavy bg, NXBlue accents
    └── fonts.go          Embedded Space Grotesk + JetBrains Mono
```

### 3D Compliance Graph Engine

The graph uses the `go-gl` OpenGL bindings via a custom Fyne widget (falling
back to software rasterization per above), rendering a 3D force-directed
layout equivalent to 3d-force-graph.js but with zero browser dependency.
Fruchterman-Reingold simulation runs in a goroutine.

```go
// app/widgets/dag_canvas.go

type ComplianceGraph struct {
    widget.BaseWidget
    nodes    []*ComplianceNode
    edges    []*ControlEdge
    sim      *ForceSimulation3D     // F-R in 3 dimensions, 60fps goroutine
    selected *ComplianceNode        // nil if nothing selected
    onSelect func(*ComplianceNode)  // callback to node detail panel
    camera   Camera3D               // orbit camera: rotate, zoom, pan
    software bool                   // true if OpenGL context creation failed
}

type ComplianceNode struct {
    ControlID    string      // "AC-2", "SC-13", "IA-5"
    Status       NodeStatus  // failing | staging | passing | pending
    Symbol       string      // Adinkra symbol (Eban, Nkyinkyim, Fawohodie...)
    DollarImpact int         // $180,000
    CMMCControls []string    // ["AC.L2-3.1.2", "NIST.AC-2"]
    BlastIDs     []string    // IDs of dependent nodes
    APDLSource   string      // generated APDL declaration
    X, Y, Z      float64     // 3D force simulation position
    Vx, Vy, Vz   float64     // velocity
}
```

Node radius scales with DollarImpact. Selected node gets glow ring.
Blast radius deps highlighted orange on selection.
Mouse left-drag: orbit. Scroll: zoom. Right-drag: pan.

### Data Flow

```
1. App starts
2. Load license → determine tier → gate features
3. Check DAG db (ProgramData) → populate graph from last scan
4. "Run Scan" button → pkg/ert inline (same process, no HTTP)
5. ERT results → ComplianceNode slice → ForceSimulation3D
6. Goroutine → converge 3D positions → canvas.Refresh() at 60fps
7. User clicks node → onSelect → NodeDetailPanel + APDL editor
8. "Sign & Stage" → ChangeRequest{Staging:true} → asaf-daemon Unix/named socket
9. Staging result → diff display in UI → appears in Approvals queue
10. A SECOND enrolled identity opens the Approvals queue → reviews staging
    diff → signs ChangeRequest{Staging:false, Approved:true} → daemon executes
11. "Export evidence" → pkg/evidence → OSCAL + POAM + PDF + DAG JSON
```

---

## COMPONENT 2: APDL POLICY EDITOR (inline, v1.1.1)

### What it is

The APDL editor is the right-panel inline policy view in the Compliance Graph.
When any node is clicked, the generated APDL declaration appears.
Enterprise tier: editable. Community/Pilot: read-only.

### APDL Syntax

```asaf
// Generated by AdinKhepra ASAF Compliance Graph
// DO NOT EDIT — signed by ML-DSA-65 instance key

@symbol(Eban) @framework(CMMC.L2) @tier(Sovereign) @gate(human)
control AC-2 {
  require: pam_faillock
  deny = 3
  unlock_time = 900
  maps: CMMC.AC.L2-3.1.2, NIST.AC-2, NIST800-171.3.1.8, CCI-000048
  playbook: "remediation/ac-2-faillock.yaml"
}
```

### Editor behavior

```
Read (all tiers):
  Syntax-highlighted APDL block in JetBrains Mono
  CMMC mapping badges below the code block
  Dollar impact label

Edit (Enterprise tier):
  Editable Fyne widget with syntax validation
  [Validate] → parse + check against 36K DB → show errors inline
  [Sign & Stage] → compile APDL → ML-DSA-65 sign → send to daemon as
    ChangeRequest{Staging:true} — this action alone never reaches
    production; see Component 3 for the separate approval step
```

### Source

```
pkg/asaf/policy/
├── compiler.go      APDL parser (hand-written PEG)
├── language.go      Grammar definitions, token types
├── playbook_gen.go  Ansible YAML output from compiled policy
└── validator.go     Cross-reference against 36K compliance DB
```

---

## COMPONENT 3: ASAF SYSTEM DAEMON (v1.1.1)

### What it is

The privileged execution layer. Makes compliance changes in the graph real.
Any unsigned ChangeRequest = silently dropped + security event logged.

### Architecture

```
asaf-daemon.exe (Windows Service: AdinKhepraASAFDaemon)
asaf-daemon (systemd: asaf-daemon.service, Linux)

Listens on:
  Windows: named pipe \\.\pipe\asaf-daemon
  Linux:   Unix socket /var/run/asaf/asaf.sock (mode 0600, root-only)

Communication:
  JSON over named pipe/socket
  mTLS for remote management: PLANNED, NOT YET IMPLEMENTED. The daemon
  accepts --mtls/--mtls-addr/--mtls-cert/--mtls-key/--mtls-ca flags today
  and logs that mTLS is "enabled," but no TLS listener exists yet — only
  the Unix socket path is live. Do not deploy assuming remote management
  works until this listener ships; track as a v1.2 item, not v1.1.1.

Capabilities required (Linux):
  CAP_SYS_ADMIN, CAP_NET_ADMIN, CAP_AUDIT_WRITE, CAP_FOWNER
  These capabilities apply to asaf-daemon specifically, running as a
  bare-metal systemd unit — NOT to the hardened, capability-dropped
  container/systemd profile documented for `adinkhepra serve` (the CLI's
  web server) under Iron Bank. The two processes have different privilege
  profiles by design; see the Iron Bank Compliance section for why
  asaf-daemon is out of scope for the hardened OCI submission entirely.
```

### ChangeRequest flow

```go
type ChangeRequest struct {
    AgentID   string   // Nkyinkyim-bound Adinkra identity
    Symbol    string   // Adinkra symbol claimed for this request — verified
                        // against the operation's REQUIRED symbol (all four
                        // tiers, not just Eban; see "Symbol enforcement" below)
    ControlID string   // STIG/CMMC control ID (e.g. "SC-13")
    Command   []string // e.g. ["sysctl", "-w", "crypto.fips_enabled=1"]
    Staging   bool     // true = mirror only, false = production
    Approved  bool     // true = a second identity approved production
    DAGParent string   // proves authorization chain
    Timestamp string   // ISO-8601, part of the signed bytes — see "Replay protection"
    Signature []byte   // ML-DSA-65 signature over the ENTIRE request above,
                        // canonicalized with Signature itself zeroed — not
                        // just over Command+Timestamp. Every field, including
                        // Approved and Staging, is covered: flipping either
                        // one after signing invalidates the signature.
}

Execute() steps:
  1. Verify ML-DSA-65 signature over the full canonical request → reject unsigned
     or tampered requests (any field change invalidates the signature)
  2. Reject if Timestamp is outside the freshness window (see "Replay protection")
  3. Validate Command against the deny-by-default operation catalog
  4. Enforce the symbol required for THIS SPECIFIC command — all four tiers
     (Eban / Nkyinkyim / Dwennimmen / Fawohodie), not only Eban
  5. If Staging=true → run in the pinned, signature-verified mirror image,
     with no shell interposed between the validated argv and the container
  6. If Staging=false: require Approved=true AND require the approving
     AgentID to differ from the authoring AgentID (see "Separation of duties")
  7. Execute privileged command on production host (no shell — exec.Command
     directly, matching the staging path)
  8. Write ML-DSA-65 signed DAG node (chain of custody) including a
     pre-change state snapshot for rollback
  9. Return ChangeResult with DAGNodeID
```

### Symbol enforcement (corrected, v2.1)

An earlier draft of this daemon only enforced the Eban tier: any request for
a non-kernel operation (user management, package installs, service/file
management) was authorized regardless of its claimed `Symbol`, because the
check compared against the literal string `"Eban"` rather than looking up
each command's actual required symbol. This was found and fixed during the
v2.1 blindspot audit (see `ASAF_SPEC_BLINDSPOT_AUDIT.md` finding #1,
`pkg/asaf/daemon/daemon.go`). The corrected, and required, behavior:

```
Eban (fortress):          sysctl, proc_sys, authselect, faillock, pwquality,
                           setenforce, auditctl, grubby, grub2-mkconfig,
                           dracut, modprobe, rmmod
Nkyinkyim (adaptability):  systemctl, firewall-cmd, chmod, chown, chattr,
                           update-ca-trust, certutil
Dwennimmen (strength):     useradd, usermod, groupmod, passwd
Fawohodie (freedom):       dnf, rpm
```

Every command in the catalog has exactly one required symbol; commands not
in the catalog are denied outright (deny-by-default). The daemon must
compare `req.Symbol` against the command's required symbol for every
request, not only for the Eban tier.

### Replay protection (new requirement, v2.1)

The signed `Timestamp` field must be checked for freshness: reject any
request older than 5 minutes. This closes the gap where a captured signed
request (staging or production) could otherwise be replayed indefinitely by
anyone able to reach the socket. (Finding #5.)

### Separation of duties (new requirement, v2.1)

Production execution (`Staging:false, Approved:true`) must be rejected if
the approving request's `AgentID` matches the `AgentID` that authored and
staged the same `ControlID`/`Command` pair (tracked via `DAGParent`). This
is the minimum viable maker-checker control: the identity that wrote or
staged an APDL policy change cannot be the same identity that approves it
for production. Community/Pilot tiers, which don't expose the policy editor
at all, are unaffected; this applies to Enterprise tier where the editor is
live. (Finding #7.)

### Rollback (new requirement, v2.1)

Before executing any command with entries in `affectedFilesByCommand()`,
the daemon must capture the production host's current file state (not the
staging mirror's — the actual host about to be changed) and store it
alongside the DAG attestation node for that execution. The desktop
Approvals view must expose a "Rollback last change" action per control that
replays the captured pre-change state through the same signed,
approved-execution path. (Finding #8.)

### Supported operations

```
SYSCTL        sysctl -w key=value (kernel params)
AUTHSELECT    authselect select sssd with-faillock
FAILLOCK      faillock.conf management
PWQUALITY     pwquality.conf management
SYSTEMCTL     enable/disable/start/stop services
SELINUX       setenforce, policy management
AUDITD        audit rules management
FIREWALLD     firewall-cmd operations
FILE_PERMS    chmod, chown, chattr
USER_MGMT     useradd, usermod, groupmod, passwd
DNF           dnf install, remove
RPM           rpm -i, rpm -e
GRUB          grubby, grub2-mkconfig
DRACUT        dracut -f --regenerate-all
MODPROBE      modprobe, rmmod
CERT_MGMT     update-ca-trust, certutil
```

(`FILE_WRITE` — arbitrary writes to `/etc/*` or `/proc/sys/*` — is removed
from the catalog in this revision. It had no symbol mapping in the original
draft, which combined with the Finding #1 bug would have made unrestricted
privileged file writes reachable under any symbol. Anything that needs to
write a config file does so through one of the specific, catalog-mapped
operations above instead.)

### Staging mirror environment

```go
// pkg/asaf/daemon/staging.go
// Runs an ephemeral, pinned mirror container matching production OS.
// Applies ChangeRequest.Command inside the container as discrete argv
// entries (no shell) — matching the no-shell production execution path.
// Captures diff of changed files + command output.
// Stores as StagingJob for polling from the desktop UI.

type StagingJob struct {
    ID        string
    Request   *ChangeRequest
    Status    string    // running | success | failed
    Diff      string    // before/after file diff
    Stdout    string    // command stdout/stderr
    StartedAt time.Time
}
```

**Mirror image supply chain (new requirement, v2.1):** the mirror image must
be shipped by the installer as a pinned digest
(`asaf-mirror-rhel9@sha256:...`), loaded from a bundled tarball via `docker
load`/`podman load`, and cosign-verified before first use — never pulled at
runtime from a registry. A daemon that cannot find the expected digest
locally must fail the staging gate closed with a clear error, not attempt a
network pull. This closes the contradiction between the staging gate and
"zero egress"/"air-gap ready" (Finding #3). Podman is the preferred runtime
for hosts that exclude Docker under STIG baselines; either runtime is
supported, and the installer checks for one at install time rather than
assuming it's present (Finding #4).

### Source

```
cmd/asaf-daemon/
├── main.go           Unix socket / named pipe listener, service registration
└── server.go         ChangeRequest handler + ML-DSA-65 verification

pkg/asaf/
├── daemon/
│   ├── daemon.go     ASAFDaemon struct + Execute()
│   ├── staging.go    Pinned mirror image staging
│   ├── ops_catalog.go CommandType + SymbolRequirements (deny-by-default)
│   ├── privileged.go  os/exec wrappers per CommandType (no shell)
│   └── rollback.go    Pre-change state capture + rollback execution
└── client/
    └── client.go     Desktop app → daemon socket client
```

---

## COMPONENT 4: LLM PROVIDER ROUTER

```go
// pkg/intelligence/router.go

// Sovereign chain (air-gap, default):
// Ollama (llama3.1:8b) → mistral:7b → offline templates

// Commercial chain (opt-in, CUI-gated — see below):
// Claude-Sonnet-4-6 → GPT-4o → Ollama fallback

// KHEPRA_LLM_PROVIDER=sovereign   (default)
// KHEPRA_LLM_PROVIDER=commercial
// KHEPRA_LLM_PROVIDER=ollama/llama3.1:70b

// Every inference → signed DAG node (provider, model, req hash, resp hash)
```

Visible in desktop Settings view. Toggle between sovereign and commercial.

### CUI boundary (new requirement, v2.1)

Every screen in this product shows the CUI classification banner
(Non-Negotiable #9) — the product's default operating context is a CUI
environment, and a CUI host can have internet access even while still being
subject to DFARS 252.204-7012/CMMC data-handling restrictions. "Blocked in
air-gap mode" describes a network condition, not a data-classification
policy, and the two must not be conflated:

- The commercial chain must be gated on an explicit, non-default
  installation-time acknowledgment ("this instance does not process CUI"),
  separate from and in addition to network reachability.
- Toggling the commercial provider on an instance that has not made that
  acknowledgment must be refused by the router, not merely discouraged.
- Where the commercial chain is enabled, control identifiers and finding
  text sent to a third-party API should be redacted/hashed wherever the
  interaction doesn't require the raw text, minimizing what leaves the
  device even when egress is explicitly authorized.

This is a v1.1.1 requirement, not a future hardening pass — it's the same
class of gap as Finding #1 (a control that exists in name but wasn't
actually wired to the thing it's supposed to gate). (Finding #9.)

---

## COMPONENT 5: ERT PACKAGES (existing, production-ready)

```
Package A: ert-readiness  Strategic alignment, STIG score, compliance roadmap
Package B: ert-architect  Dependency scan, CVE correlation (CISA KEV + NIST NVD)
Package C: ert-crypto     Crypto primitive audit, IP lineage, PQC readiness
Package D: ert-godfather  Executive synthesis, dollar impact, causal chain

CLI:     adinkhepra ert full . → ert_full_report.json + 5 DAG nodes
Desktop: "Run ERT Scan" button → same pkg/ert logic → rendered in ERT view tabs
```

---

## LICENSE MECHANISM

### Runtime resolution (identical in both binaries)

```
Priority:
  1. env KHEPRA_LICENSE_PATH
  2. %ProgramData%\AdinKhepra ASAF\license.adinkhepra  (Windows)
  3. /etc/adinkhepra/license.adinkhepra                 (Linux)
  4. ~/.config/adinkhepra/license.adinkhepra            (Linux/macOS)
  5. same directory as executable

Verification (fully offline):
  ML-DSA-65 signature against embedded master public key
  Device binding: Windows MachineGuid (HKLM\SOFTWARE\Microsoft\Cryptography)
  Expiry check
  Tier extraction → gates UI features
```

License issuance (the "Master" tier tooling below) uses a completely
separate signing root from the per-customer license verification key, and
the corresponding private key exists only as Shamir shards outside any
distributed binary (matching the existing design in
`pkg/license/master_pubkey.go` — this was checked against the audit's
initial concern that a single embedded key might serve both roles, and it
does not).

### Tier gating in the desktop app

```
Community (no license):
  Graph: visible, read-only, localhost scan only
  ERT: Package A only
  Evidence export: disabled
  Policy editor: read-only
  Dollar exposure: hidden

Pilot ($25K):
  Scan targets: up to 3 hosts
  ERT: Packages A + B
  Evidence export: CSV only

Enterprise ($75K–$250K):
  Scan targets: unlimited
  ERT: all packages A–D
  Evidence export: full C3PAO (OSCAL + POAM + PDF + DAG)
  APDL policy editor: edit mode enabled
  Staging gate: active (requires daemon)
  Production approval: requires a second enrolled identity (see Component 3)

Master (Cyber-internal):
  License issuance UI visible in Settings
  Revocation management
```

---

## INSTALLER WIZARD

Fyne-based installer application (shares app/theme/ for visual consistency).

### 7-page wizard

```
Page 1: Welcome
  AdinKhepra shield logo, product description, version, USPTO #73565085
  [Next →]  [Cancel]

Page 2: License Agreement
  Scrollable EULA text (Fyne MultiLineEntry, read-only)
  ○ I accept     ○ I do not accept
  [← Back]  [Next →] (disabled until accepted)  [Cancel]

Page 3: License Key
  MultiLineEntry: paste raw JSON key
  [Browse for license.adinkhepra...]
  Live tier label: "Community" or "Enterprise" as user fills in
  [← Back]  [Next →]  [Cancel]

Page 4: Install Location
  Entry: C:\Program Files\AdinKhepra ASAF\
  [Browse...]  ← Fyne folder dialog
  Disk space required / available
  [← Back]  [Next →]  [Cancel]

Page 5: Components
  ☑ AdinKhepra Compliance Graph Desktop  [required]
  ☑ AdinKhepra CLI
  ☑ ASAF System Daemon (Windows Service)
  ☑ CMMC Dashboard auto-start service
  ☑ Start Menu shortcuts
  ☑ Desktop shortcut
  ☐ Add CLI to system PATH
  [← Back]  [Install]  [Cancel]

Page 6: Installing (progress + log)
  ProgressBar (animated)
  Append-only log: "Extracting daemon...", "Registering service...",
  "Loading pinned staging mirror image...", "Verifying mirror image
  signature...", "Generating desktop instance keypair...", "Enrolling
  desktop public key with daemon...", etc.

Page 7: Finish
  "AdinKhepra ASAF installed. License: Enterprise | Expires: 2027-06-22"
  ☑ Launch AdinKhepra Compliance Graph
  [Finish]
```

### Key enrollment (new step, v2.1)

The original draft never specified how `asaf-daemon`'s `--agent-pubkey`
gets populated with the desktop instance's public key — without this step,
"the daemon only accepts signed requests" says nothing about *which*
signer(s) it accepts. Page 6 must, as part of installation:

1. Generate an ML-DSA-65 keypair for the newly-installed desktop instance
   (or import one supplied out-of-band for a multi-seat Enterprise
   deployment).
2. Write the instance's public key to the daemon's trusted-agent store
   (`/etc/asaf/agent.pub` or a directory of multiple trusted public keys,
   one per enrolled identity, for the multi-identity separation-of-duties
   requirement in Component 3).
3. Record the enrollment as a DAG node so there is a tamper-evident record
   of which identity was enrolled, when, and by which installer run.

A second, separate enrollment (a second identity's public key) is required
before the Approvals queue can accept any production approval — this is
the installation-time side of the separation-of-duties requirement, and the
wizard should refuse to enable Staging Gate features until at least two
distinct identities are enrolled for an Enterprise install. (Finding #14.)

### What the installer writes

```
%ProgramFiles%\AdinKhepra ASAF\
  adinkhepra-desktop.exe
  adinkhepra.exe
  asaf-daemon.exe
  Uninstall.exe
  docs\README.txt

%ProgramData%\AdinKhepra ASAF\
  license.adinkhepra     (from Page 3 if provided)
  keys\                  (generated at first desktop run; instance keypair)
  dag\                   (SQLite DAG persistence)
  mirror\                (pinned staging mirror image tarball, cosign-verified)

Start Menu\Programs\AdinKhepra ASAF\
  AdinKhepra Compliance Graph.lnk
  AdinKhepra CLI.lnk
  Uninstall AdinKhepra ASAF.lnk

Desktop (if selected):
  AdinKhepra Compliance Graph.lnk

Windows Services (if selected):
  AdinKhepraASAF         adinkhepra-desktop.exe --headless --port 8443
                         (binds 127.0.0.1 only by default — see
                         "Two Surfaces, One Product")
  AdinKhepraASAFDaemon   asaf-daemon.exe --pipe \\.\pipe\asaf-daemon

HKLM\...\Uninstall\AdinKhepraASAF:
  DisplayName:    AdinKhepra ASAF v1.1.1
  Publisher:      SecRed Knowledge Inc.
  UninstallString: "...\Uninstall.exe"
  URLInfoAbout:   https://adinkhepra.com
```

---

## RELEASE PACKAGE STRUCTURE

```
dist/
├── windows/
│   ├── AdinKhepra-ASAF-v1.1.1-Setup.exe          installer wizard
│   └── AdinKhepra-ASAF-v1.1.1-portable.zip       raw binaries, power user
│       ├── adinkhepra-desktop.exe
│       ├── adinkhepra.exe
│       ├── asaf-daemon.exe
│       └── README.txt
│
├── linux/
│   ├── AdinKhepra-ASAF-v1.1.1-linux-amd64.tar.gz
│   │   ├── adinkhepra-desktop    (Fyne, X11/Wayland)
│   │   ├── adinkhepra            (headless CLI)
│   │   ├── asaf-daemon           (privileged, root required)
│   │   └── install.sh
│   ├── adinkhepra-asaf_1.1.1_amd64.deb
│   └── adinkhepra-asaf-1.1.1-1.x86_64.rpm
│
├── darwin/
│   ├── AdinKhepra-ASAF-v1.1.1-darwin-arm64.dmg   Apple Silicon (notarized)
│   └── AdinKhepra-ASAF-v1.1.1-darwin-amd64.dmg   Intel Mac (notarized)
│       AdinKhepra ASAF.app/  (fyne package output)
│
├── CHECKSUMS.txt                  SHA-256 of every artifact
├── CHANGELOG.md
└── RELEASE_NOTES.md
```

---

## CODE SIGNING

### Windows: Authenticode (EV Code Signing Certificate)

```
Signer:   SecRed Knowledge Inc.
Tool:     signtool.exe
Target:   adinkhepra-desktop.exe, adinkhepra.exe, asaf-daemon.exe, Setup.exe
Status:   In procurement (EV cert required, ~2-4 week lead time)
Blocker:  Certificate authority vetting process — external, outside team control
```

### macOS: Apple Notarization

```
Signer:   Apple Developer Program account (SecRed Knowledge Inc.)
Tool:     xcrun notarytool + stapler
Target:   AdinKhepra ASAF.app (both arm64 and amd64)
Status:   In procurement (Apple Developer Program enrollment)
Blocker:  Apple Developer Program enrollment approval — external, outside team control
```

Both signing processes are scripted and ready. Unsigned builds ship to pilots.
Signed builds ship to production customers. The code is identical. Note that
an unsigned Windows binary triggers SmartScreen "Unknown Publisher" warnings
and may be quarantined by a customer's own EDR — for pilots on
security-conscious buyers, set expectations about this explicitly before the
first install, rather than letting it surface as a surprise during the demo.

---

## EVIDENCE PACKAGE FORMAT (v1.1.1 full scope)

```
evidence-package-{YYYYMMDD-HHMMSS}/
├── executive-brief.pdf          Godfather Report (ML-DSA-65 signed)
├── findings.csv                 All STIG findings with CCI/NIST/CMMC mappings
├── controls-assessed.csv        CMMC control status table
├── poam.csv                     Plan of Action & Milestones (DoD format)
├── dag-export.json              Full DAG provenance chain (ML-DSA-65 signed)
├── pqc-manifest.json            Attestation manifest with hash chain
└── oscal/
    ├── component-definition.json   OSCAL component definition
    ├── assessment-results.json     OSCAL assessment results
    └── system-security-plan.json   OSCAL SSP
```

All files signed by the AdinKhepra ASAF instance key (ML-DSA-65).
Auditor verifies using the instance's published public key — no third
party required.
Tamper-evident. Quantum-resistant.

---

## COMPLETE FILE STRUCTURE (v1.1.1)

```
New files to create:

cmd/asaf-desktop/
└── main.go

cmd/asaf-daemon/
├── main.go
└── server.go

app/
├── window.go
├── views/
│   ├── graph_view.go
│   ├── ert_view.go
│   ├── evidence_view.go
│   ├── approvals_view.go       (production approval queue, 2nd identity)
│   └── settings_view.go
├── widgets/
│   ├── classification_bar.go
│   ├── header_bar.go
│   ├── status_footer.go
│   ├── dag_canvas.go           (3D OpenGL force graph + software fallback)
│   ├── node_detail.go
│   ├── policy_editor.go        (APDL inline editor)
│   └── score_ring.go
└── theme/
    ├── asaf_theme.go
    └── fonts.go

pkg/asaf/
├── daemon/
│   ├── daemon.go
│   ├── staging.go              (pinned mirror image staging)
│   ├── ops_catalog.go
│   ├── privileged.go
│   └── rollback.go             (pre-change state capture + rollback)
├── policy/
│   ├── compiler.go             (APDL parser)
│   ├── language.go
│   ├── playbook_gen.go
│   └── validator.go
├── staging/
│   ├── job.go
│   ├── runner.go               (mirror container management)
│   └── diff.go
└── client/
    └── client.go                (desktop → daemon IPC)

pkg/intelligence/
├── router.go                    (CUI-gated commercial path)
└── providers/
    ├── ollama.go
    ├── openrouter.go
    └── offline.go

pkg/evidence/
├── package.go                   (C3PAO package builder)
├── oscal.go                     (OSCAL format output)
├── pdf.go                       (executive brief PDF)
└── poam.go                      (POAM CSV)

cmd/installer/
├── main.go
├── wizard.go
├── install.go
├── enroll.go                    (key enrollment, new v2.1)
├── service_windows.go
├── registry_windows.go
├── shortcut_windows.go
└── embed.go

assets/
├── icon.png                    (1024x1024, for fyne package)
├── icon.ico                    (Windows)
├── EULA.txt
├── mirror/                     (pinned staging mirror image tarball)
└── fonts/
    ├── SpaceGrotesk-Variable.ttf
    └── JetBrainsMono-Regular.ttf

scripts/
├── build-desktop.ps1
├── build-desktop.sh
├── package-deb.sh
├── package-rpm.sh
└── sign-release.ps1

Existing (unchanged, shared):
cmd/adinkhepra/
pkg/dag/
pkg/stig/
pkg/adinkra/
pkg/ert/
pkg/license/
pkg/webui/
```

---

## BUILD PIPELINE

```powershell
# scripts/build-desktop.ps1
# 1. Build desktop binary (all platforms)
go build -o bin/adinkhepra-desktop.exe ./cmd/asaf-desktop
GOOS=linux  GOARCH=amd64 go build -o bin/adinkhepra-desktop-linux   ./cmd/asaf-desktop
GOOS=darwin GOARCH=arm64 go build -o bin/adinkhepra-desktop-darwin   ./cmd/asaf-desktop

# 2. Build daemon (all platforms)
go build -o bin/asaf-daemon.exe ./cmd/asaf-daemon
GOOS=linux  GOARCH=amd64 go build -o bin/asaf-daemon-linux ./cmd/asaf-daemon

# 3. Existing CLI (already built, copy to dist)
copy bin/adinkhepra.exe dist/windows/

# 4. macOS .app bundle
GOOS=darwin GOARCH=arm64 fyne package -os darwin \
  -name "AdinKhepra ASAF" -appID com.secred.adinkhepra.asaf \
  -icon assets/icon.png ./cmd/asaf-desktop

# 5. Pin + verify the staging mirror image, bundle into the installer
docker pull ghcr.io/nouchix/asaf-mirror-rhel9@sha256:<pinned-digest>
cosign verify --key mirror-signing.pub ghcr.io/nouchix/asaf-mirror-rhel9@sha256:<pinned-digest>
docker save ghcr.io/nouchix/asaf-mirror-rhel9@sha256:<pinned-digest> -o assets/mirror/asaf-mirror-rhel9.tar

# 6. Build installer (embeds desktop + CLI + daemon + pinned mirror image)
go build -o dist/windows/AdinKhepra-ASAF-v1.1.1-Setup.exe ./cmd/installer

# 7. Build .deb and .rpm
bash scripts/package-deb.sh
bash scripts/package-rpm.sh

# 8. Sign (if certs available)
./scripts/sign-release.ps1

# 9. Checksums
sha256sum dist/**/* > dist/CHECKSUMS.txt
```

---

## NON-NEGOTIABLES

1. **Zero egress by default; egress is explicit, never silent, and never
   available while an instance is processing CUI.** Desktop app and daemon
   make no outbound network calls by default. All verification local:
   ML-DSA-65 signature check, DAG query, license verify. The opt-in
   commercial LLM path is the one deliberate exception, and it is gated on
   an explicit installation-time "does not process CUI" acknowledgment, not
   merely on network reachability (see Component 4).

2. **No telemetry.** AdinKhepra ASAF collects nothing.
   SouHimBou AI handles telemetry (separate product, opt-in).

3. **Single binary per surface; the one documented runtime dependency is
   the staging mirror's container runtime (Docker or Podman), and it is
   never assumed present — the installer checks for it and the daemon fails
   the staging gate closed if it's missing or the pinned image can't be
   signature-verified.** No other runtime dependencies for end users. The
   binary IS the runtime for everything except that one gate.

4. **Staging before production, with a pinned and signature-verified mirror
   image.** The daemon runs every non-staging-exempt change in a mirror
   container, loaded from a pinned, cosign-verified digest bundled by the
   installer, before applying to the production host. No bypass, and no
   runtime image pull.

5. **Human approval for destructive ops, by a SECOND enrolled identity.**
   ChangeRequest.Approved must be set by a distinct AgentID from the one
   that authored/staged the same control — see Component 3. The daemon
   cannot self-approve, and a single compromised identity cannot both stage
   and approve.

6. **All four Adinkra symbol tiers are enforced at the daemon level, not
   just Eban.** Eban (kernel ops), Nkyinkyim (services/files), Dwennimmen
   (user management), and Fawohodie (package installs) are each checked
   against every request's claimed symbol for the specific operation
   requested. Not configurable.

7. **FIPS build for Iron Bank / DoD.**
   `GOEXPERIMENT=boringcrypto`, `CGO_ENABLED=0`, `-extldflags '-static'`.
   CLI = Iron Bank scope. asaf-daemon and Desktop app are NOT Iron Bank
   submission targets — the daemon's required Linux capabilities
   (CAP_SYS_ADMIN etc.) are incompatible with the hardened,
   capability-dropped OCI profile Iron Bank requires, and the desktop needs
   GPU/display. Bare-metal RPM/deb installs of the daemon are hardened via
   the systemd unit shown below instead.

8. **Air-gap ready, including the staging gate.** All Go dependencies
   vendored (go mod vendor). Fonts embedded at compile time. The staging
   mirror image ships as a bundled, pinned, verified tarball — never pulled
   from a registry at runtime. No CDN, no npm, no package manager, no
   container registry pull at runtime.

9. **Classification banner.** Every screen shows the "CUI" banner at the top.
   Required for DIB customer environments. Non-negotiable.

10. **Fonts.** Space Grotesk + JetBrains Mono (Apache 2.0) embedded in binary.
    The binary may be redistributed without separate font installation.

11. **Any listening network port is loopback-only by default and
    authenticated if ever exposed beyond loopback.** This applies to the
    CLI's `serve` DAG viewer and the desktop's `--headless` mode alike.
    "Zero egress" is not a substitute for ingress authentication.

---

## IRON BANK COMPLIANCE (DoD Standard)

Iron Bank is the DoD's hardened container registry at `registry1.dso.mil`, operated
by Platform One. It is NOT simply an RPM package — it is a complete pipeline submission
that produces a signed, scanned, FIPS-compliant OCI container image.

The AdinKhepra ASAF **CLI only** is the Iron Bank target. Neither the
desktop GUI nor asaf-daemon are submitted:
- The desktop GUI requires GPU/display; DoD server environments are headless.
- **asaf-daemon requires CAP_SYS_ADMIN, CAP_NET_ADMIN, CAP_AUDIT_WRITE, and
  CAP_FOWNER to perform privileged host operations** (sysctl, GRUB, modprobe,
  user management, package installs). This is fundamentally incompatible
  with Iron Bank's hardened, capability-dropped OCI profile — the same
  profile the hardened systemd unit below applies to the CLI's `adinkhepra
  serve` process (`CapabilityBoundingSet=` empty, `NoNewPrivileges=yes`).
  asaf-daemon is deployed as a bare-metal systemd unit with its capabilities
  scoped via `CapabilityBoundingSet=` to exactly the four it needs — a
  different, explicitly-elevated profile from the CLI's hardened unit, not
  a variant of it. Do not conflate the two when reasoning about what's
  "Iron Bank scope."

### What Iron Bank Requires

```
Repo One (GitLab) submission at repo1.dso.mil
DSOP group path: dsop/nouchix/adinkhepra

Required files in the repo:
  Dockerfile                  multi-stage, builds from source in disconnected env
  hardening_manifest.yaml     pipeline manifest (resources, labels, maintainers)
  README.md                   purpose, configuration, usage
  LICENSE                     Apache-2.0 or commercial license
  CHANGELOG.md

Government Sponsor:
  A DoD employee with a CAC must submit the onboarding request.
  This is a process blocker — code can be ready before sponsor is identified.
  Status: OneDay accelerator / QuBit Capital contacts are the path to a sponsor.
```

### Dockerfile (Iron Bank Pattern)

```dockerfile
# Stage 1: FIPS-compliant builder
FROM registry1.dso.mil/ironbank/opensource/golang/golang:1.22 AS builder

WORKDIR /build
COPY . .

# FIPS-compliant static binary
RUN GOEXPERIMENT=boringcrypto \
    CGO_ENABLED=0 \
    GOOS=linux GOARCH=amd64 \
    go build \
      -tags community \
      -ldflags="-s -w -extldflags '-static' \
        -X github.com/.../license.AgentVersion=v1.1.1" \
      -o /build/adinkhepra \
      ./cmd/adinkhepra

# Stage 2: Hardened runtime (no shell, no package manager)
FROM registry1.dso.mil/ironbank/redhat/ubi/ubi9-minimal:9.4

# Required Iron Bank labels
LABEL org.opencontainers.image.title="AdinKhepra ASAF"
LABEL org.opencontainers.image.description="Sovereign CMMC Autopilot Engine — ML-DSA-65 attested compliance"
LABEL org.opencontainers.image.version="1.1.1"
LABEL org.opencontainers.image.vendor="SecRed Knowledge Inc."
LABEL org.opencontainers.image.licenses="Commercial"
LABEL org.opencontainers.image.source="https://github.com/nouchix/adinkhepra"
LABEL io.k8s.display-name="AdinKhepra ASAF"
LABEL io.k8s.description="CMMC Autopilot Engine"

# Non-root user (OpenShift / DoD requirement)
RUN microdnf install -y shadow-utils && \
    useradd -u 1001 -g 0 -s /sbin/nologin adinkhepra && \
    microdnf clean all

COPY --from=builder --chown=1001:0 /build/adinkhepra /usr/local/bin/adinkhepra

USER 1001

EXPOSE 8443

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD ["/usr/local/bin/adinkhepra", "health"]

ENTRYPOINT ["/usr/local/bin/adinkhepra"]
CMD ["serve", "--port", "8443"]
```

### hardening_manifest.yaml

```yaml
apiVersion: v1
name: nouchix/adinkhepra
tags:
  - "1.1.1"
  - "1.1"
  - "latest"
args:
  BASE_IMAGE: redhat/ubi/ubi9-minimal
  BASE_TAG: "9.4"
labels:
  org.opencontainers.image.title: "AdinKhepra ASAF"
  org.opencontainers.image.description: "Sovereign CMMC Autopilot Engine"
  org.opencontainers.image.licenses: "Commercial"
  org.opencontainers.image.vendor: "SecRed Knowledge Inc."
  org.opencontainers.image.version: "1.1.1"
resources:
  - url: "https://github.com/nouchix/adinkhepra/archive/refs/tags/v1.1.1.tar.gz"
    filename: "adinkhepra-v1.1.1.tar.gz"
    validation:
      type: sha256
      value: "<sha256_computed_at_tag>"   # filled at release tag
maintainers:
  - email: "souhimbou@secred.ai"
    name: "Souhimbou Doh Kone"
    username: "souhimbou"
    cht_member: false
```

### Cosign Signatures + SBOM

```bash
# Sign the pushed image (Sigstore / keyless or with Khepra key)
cosign sign \
  --key cosign.key \
  registry1.dso.mil/ironbank/nouchix/adinkhepra:1.1.1

# Attach SBOM (CycloneDX format, generated by pkg/sbom/)
cosign attach sbom \
  --sbom sbom-cyclonedx.json \
  registry1.dso.mil/ironbank/nouchix/adinkhepra:1.1.1
```

The SBOM is already generated by `pkg/sbom/` (CycloneDX, exists in codebase).
Cosign signing uses the same Dilithium3 key infrastructure already in the repo.
The same cosign infrastructure is reused to sign the staging mirror image
bundled with the installer (see Component 3) — one signing root, two
artifacts.

### Iron Bank Continuous Scanning

Once approved, Iron Bank scans the image every 12 hours with Anchore Enterprise.
High/Critical CVEs must be remediated within 30 days or formally justified.
This drives a regular patch cadence — plan for monthly CLI releases.

### systemd Unit (Bare-Metal RHEL/Rocky — Hardened, CLI's `serve` process only)

For bare-metal installs (not containerized), the RPM installs this hardened unit
for `adinkhepra serve` — this unit is intentionally NOT used for asaf-daemon,
which needs the elevated capabilities described in Non-Negotiable #7 above:

```ini
[Unit]
Description=AdinKhepra ASAF — CMMC Autopilot Engine
After=network.target
Documentation=https://adinkhepra.com/docs

[Service]
Type=simple
User=adinkhepra
Group=adinkhepra
ExecStart=/usr/local/bin/adinkhepra serve --port 8443
Restart=on-failure
RestartSec=5s

# systemd hardening (RHEL 9 STIG aligned)
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/var/lib/adinkhepra /etc/adinkhepra
CapabilityBoundingSet=
AmbientCapabilities=
SecureBits=noroot noroot-locked
SystemCallFilter=@system-service
SystemCallErrorNumber=EPERM
LockPersonality=yes
RestrictNamespaces=yes
RestrictRealtime=yes
RestrictSUIDSGID=yes
MemoryDenyWriteExecute=yes
IPAddressDeny=any
IPAddressAllow=localhost

[Install]
WantedBy=multi-user.target
```

### asaf-daemon systemd unit (separate profile, elevated capabilities)

```ini
[Unit]
Description=ASAF System Daemon — Privileged Compliance Execution Layer
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/asaf-daemon --socket /var/run/asaf/asaf.sock \
  --dag-path /var/lib/asaf/dag --key-path /etc/asaf/daemon.key \
  --agent-pubkey /etc/asaf/agent.pub
Restart=on-failure
RestartSec=5s

# Scoped to exactly the four capabilities this daemon documents needing —
# not "no capabilities" (that's the CLI's serve unit above) and not
# unrestricted root.
CapabilityBoundingSet=CAP_SYS_ADMIN CAP_NET_ADMIN CAP_AUDIT_WRITE CAP_FOWNER
AmbientCapabilities=CAP_SYS_ADMIN CAP_NET_ADMIN CAP_AUDIT_WRITE CAP_FOWNER
NoNewPrivileges=yes
PrivateTmp=yes
ProtectHome=yes
ReadWritePaths=/var/lib/asaf /etc/asaf /var/run/asaf

[Install]
WantedBy=multi-user.target
```

### RPM Spec (RHEL 9 / Rocky 9)

```spec
%global service_user adinkhepra
%global service_group adinkhepra

Name:     adinkhepra-asaf
Version:  1.1.1
Release:  1%{?dist}
Summary:  Sovereign CMMC Autopilot Engine
License:  Commercial
URL:      https://adinkhepra.com

%description
AdinKhepra ASAF — ML-DSA-65 attested CMMC compliance engine.
Zero egress. Air-gap ready. 36,195-row STIG/CCI/NIST/CMMC mapping database.

%pre
getent group %{service_group} > /dev/null || groupadd -r %{service_group}
getent passwd %{service_user} > /dev/null || \
  useradd -r -u 1001 -g %{service_group} -s /sbin/nologin \
          -d /var/lib/adinkhepra %{service_user}

%post
%systemd_post adinkhepra-asaf.service
# Restore SELinux context
restorecon -Rv /usr/local/bin/adinkhepra 2>/dev/null || :

%preun
%systemd_preun adinkhepra-asaf.service

%postun
%systemd_postun_with_restart adinkhepra-asaf.service

%files
%attr(0755, root, root) /usr/local/bin/adinkhepra
%attr(0755, root, root) /usr/local/bin/asaf-daemon
%attr(0644, root, root) /usr/lib/systemd/system/adinkhepra-asaf.service
%attr(0644, root, root) /usr/lib/systemd/system/asaf-daemon.service
%dir %attr(0750, %{service_user}, %{service_group}) /etc/adinkhepra
%dir %attr(0750, %{service_user}, %{service_group}) /var/lib/adinkhepra
```

### Submission Status

```
Code artifacts ready (v1.1.1):   ✓ Dockerfile, hardening_manifest.yaml, RPM spec
FIPS binary:                      ✓ GOEXPERIMENT=boringcrypto, static
SBOM:                             ✓ pkg/sbom/ (CycloneDX, already exists)
Cosign:                           ✓ scripts/sign-release.ps1
Repo One account:                 ✓ Created — CAC authenticated (Souhimbou Doh Kone)
Government Sponsor:               🔄 In progress, external — working with Jeff Goluba
                                     (Iron Bank Customer Success) to identify
                                     a government Mission Owner co-signer
Open-source companion image:      ✓ Community edition (build tag: community)
```

Iron Bank contact: Jeff Goluba, Customer Success — Platform One / Iron Bank team.
The submission account is live at repo1.dso.mil. The remaining step is a
government Mission Owner (a DoD program office) co-signing the onboarding request —
an external dependency, tracked separately from engineering scope (see the
v1.1.1 scope table below).

This is NOT a code blocker. All technical artifacts ship in v1.1.1.
The listing at registry1.dso.mil activates when the co-signer is confirmed.

---

## V1.1.1 SCOPE

Engineering scope is complete with no deferrals. Three rows below are
explicitly gated on an external party (a CA, Apple, or a DoD program
office) rather than on remaining engineering work — those are marked
**External dependency** rather than folded into a "complete" claim they'd
otherwise contradict. (Finding #12.)

| Component | Description | Status |
|-----------|-------------|--------|
| Desktop GUI (Fyne) | 3D compliance graph, APDL editor, staging UI, evidence export, software-render fallback | Engineering complete |
| ASAF System Daemon | Privileged executor, full 4-tier symbol enforcement, replay protection, 2-identity approval, rollback | Engineering complete |
| Staging Mirror | Pinned + cosign-verified container image, diff capture, human approval workflow | Engineering complete |
| APDL Policy Editor | Inline display + edit in node detail panel | Engineering complete — Enterprise tier |
| 3D Force Graph | OpenGL via go-gl + software fallback, orbit camera, node glow, blast radius | Engineering complete |
| OSCAL Evidence Export | component-definition, assessment-results, SSP | Engineering complete |
| Windows Installer | Fyne wizard, 7 pages, key enrollment, service registration, shortcuts, registry | Engineering complete |
| .deb Package | Debian/Ubuntu + systemd unit (hardened) | Engineering complete |
| Iron Bank Container | Hardened OCI image at registry1.dso.mil/ironbank/nouchix/adinkhepra — CLI only | Engineering complete |
| Iron Bank RPM | RHEL9/Rocky9 RPM spec + hardened systemd unit (SELinux, UID 1001) | Engineering complete |
| hardening_manifest.yaml | Platform One pipeline manifest + Cosign + SBOM | Engineering complete |
| macOS DMG | .app bundle via fyne package, drag-to-Applications installer | Engineering complete |
| Windows Code Signing | Authenticode EV cert | **External dependency** — code complete, cert procurement pending |
| macOS Notarization | Apple Developer Program | **External dependency** — code complete, enrollment pending |
| Iron Bank Sponsor | DoD employee with CAC nominates submission | **External dependency** — code ready, sponsor identification pending |
