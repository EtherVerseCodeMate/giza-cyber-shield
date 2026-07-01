# AdinKhepra ASAF v2.0 Spec — Blindspot Audit

**Scope:** `ADINKHEPRA_ASAF_SPEC.md` (Complete Build Specification v2.0 — Fyne
desktop, ASAF System Daemon, APDL Policy Editor, Iron Bank submission).
**Method:** Read the spec against the code that already exists for it
(`pkg/asaf/daemon/*`, `pkg/asaf/client/*`, `cmd/asaf-daemon/*`,
`pkg/license/*`), not just the prose, so findings below are graded by
whether they're a documentation gap or a live code issue.
**Date:** 2026-07-01

---

## Findings

### 1. CRITICAL (code, fixed in this pass) — Symbol authorization only checked Eban, not the other three symbols

`pkg/asaf/daemon/ops_catalog.go` defines `symbolRequirements` mapping every
catalog command to one of four Adinkra symbols (Eban / Nkyinkyim /
Dwennimmen / Fawohodie), and a `requiredSymbol()` helper to look it up. But
`daemon.go Execute()` only ever called:

```go
if isKernelCommand(req.Command) && req.Symbol != "Eban" { ... }
```

`isKernelCommand` returns `true` only for the Eban-tier commands. For every
other cataloged command (`useradd`, `usermod`, `passwd`, `dnf`, `rpm`,
`systemctl`, `chmod`, `chown`, `certutil`, `firewall-cmd`, ...) this
condition evaluated to `false` regardless of `req.Symbol` — meaning **any
signed `ChangeRequest`, carrying any symbol string (including an empty
one), was authorized to run user-management or package-install operations**
as long as the command itself passed `validateCommand()`'s catalog check.
`requiredSymbol()` was defined and exported-within-package but never called
from the enforcement path — dead code sitting next to the vulnerability it
was clearly meant to close.

Practically: an agent identity provisioned only for `Nkyinkyim`-tier work
(service restarts, file permission fixes) could submit `Symbol: "Nkyinkyim"`
with `Command: ["useradd", "-o", "-u", "0", "backdoor"]` and the daemon would
execute it after a successful staging run and approval — the symbol tiering
that the spec calls a "hard constraint, not configurable" (Non-Negotiable
#6) was enforced for exactly one of its four tiers.

**Fixed:** `Execute()` now calls `requiredSymbol(req.Command)` for every
command and rejects on any mismatch, not just the Eban case. See
`pkg/asaf/daemon/daemon.go` and the now-removed dead `isKernelCommand`
helper. The spec's Component 3 section is updated below to describe the
check accurately (previously it described the *intended* behavior, which
didn't match what shipped).

### 2. HIGH (code, fixed in this pass) — Staging mirror re-introduced shell semantics `validateCommand()` doesn't fully account for

`pkg/asaf/daemon/staging.go` took the already-validated `[]string` command,
joined it into a single string with spaces, and ran it as `sh -c
"<joined>"` inside the mirror container. `validateCommand()`'s
`rejectShellMeta()` blocklist covers `; & | \` $ ( ) < >` and newlines, but
not quote characters, globs, or `#` — none of which are needed for the
production path (`privileged.go` calls `exec.CommandContext` directly, no
shell), so the staging path was carrying more shell-interpretation risk than
production for the same input. It also silently mis-split any argument
containing a literal space (a correctness bug, not just a security one —
diff/output shown to the human approver would not match what actually ran).

**Fixed:** the mirror container now receives the command as discrete argv
entries appended after the image name, with no `sh -c` in between —
matching the no-shell style already used for production execution. The
container's own isolation (`--cap-drop ALL`, `--network none`,
`--read-only`) remains the primary boundary; this removes the unnecessary
extra shell layer inside it.

### 3. HIGH (spec/architecture) — Staging mirror image pull contradicts "Zero egress" / "Air-gap ready"

`defaultMirrorImage = "ghcr.io/nouchix/asaf-mirror-rhel9:latest"`
(`staging.go`). On a host that doesn't already have this image cached,
`docker run` will attempt to pull it from GitHub Container Registry —
network egress, on the exact class of host (DIB/DoD production system) the
spec insists never leaves the air gap. There's no code path that verifies
the image is present before use, no digest pinning (`:latest` is mutable),
and no signature verification of the pulled image (contrast with the Iron
Bank container, which the spec explicitly cosign-signs).

**Recommendation for the spec:** the installer must ship the mirror image
as a pinned, cosign-verified digest (`asaf-mirror-rhel9@sha256:...`) loaded
via `docker load` from a bundled tarball, never pulled at runtime. Add an
explicit pre-flight check ("mirror image present and signature-verified")
that fails closed with a clear error rather than silently attempting a
network pull. This is now reflected in the revised Component 3 section.

### 4. MEDIUM (spec/architecture) — Docker as a production-host dependency conflicts with STIG-hardened bare metal and Non-Negotiable #3

Non-Negotiable #3 says "Single binary. Zero runtime dependencies." but the
staging gate requires a working, unprivileged-from-the-daemon's-perspective
Docker daemon on the *production* host — the same host the RPM spec and
systemd unit harden to the point of `CapabilityBoundingSet=` (empty) and
`NoNewPrivileges=yes`. Many STIG-baselined RHEL/Rocky images intentionally
exclude container runtimes, or mandate Podman over Docker. The spec doesn't
reconcile "the daemon needs Docker" with "the host is STIG-hardened and
container-runtime-averse."

**Recommendation:** document Podman (rootless, daemonless, drop-in CLI
compatible) as the supported/preferred runtime for the mirror, with Docker
as a fallback, and state explicitly that the mirror runtime is a documented
prerequisite the installer checks for — not an implicit assumption.

### 5. HIGH (spec/architecture) — No replay protection on signed `ChangeRequest`s

The `Timestamp` field is correctly included in the ML-DSA-65 signed
canonical bytes (good — the spec text describing the signature as covering
only "Command + timestamp" undersold what the code actually signs; the code
signs the whole struct minus `Signature`, which is the *right* design and
is now what the spec says). But nothing checks that `Timestamp` is recent.
A captured signed request — a `Staging:true` request an operator ran once,
or worse an `Approved:true` production request — remains valid to replay
indefinitely to anyone who can reach the Unix socket. The socket is
root-only (0600), which limits this to already-privileged local access, but
"already root can do more root things" is not a reason to skip freshness
checking on a signing scheme that clearly intends to bind requests to a
point in time.

**Recommendation:** reject requests whose `Timestamp` is more than N
minutes old (propose 5), and track recently-seen signatures in-memory to
reject exact replays inside that window. Added to the revised Component 3
section as a required gate.

### 6. MEDIUM (code observation, not fixed — out of scope for this pass) — mTLS listener is configured but never started

`cmd/asaf-daemon/main.go` accepts `--mtls`, `--mtls-addr`, `--mtls-cert`,
etc., stores them in `Config`, and prints `mtls: ENABLED → :8444` when the
flag is set. `ASAFDaemon.Run()` only ever calls `net.Listen("unix", ...)` —
there is no TLS listener anywhere in `daemon.go`. Setting `--mtls=true`
today changes a log line and nothing else; "remote management" described in
the spec's daemon architecture section doesn't exist yet.

**Recommendation:** either implement the listener or mark it clearly as
**Planned, not implemented** in the spec so a deploying engineer doesn't
assume remote management works. The revised spec below does the latter
until the listener ships.

### 7. HIGH (spec/product design) — No separation of duties between policy author and production approver

The APDL Policy Editor (Enterprise tier, Component 2) lets a user edit and
"Sign & Stage" a control in the same desktop session that later shows the
"Approve → Prod" button (Component 1 data flow, steps 7–10). Nothing in the
spec requires the approving identity to differ from the authoring identity
— the same desktop instance, the same signing key, can author, stage, and
approve a change end-to-end. NIST 800-53 AC-5 / CMMC separation-of-duties
is a control this product is sold to help customers pass; the product's own
privileged-change workflow doesn't implement it. A single compromised
CISO/Compliance-Lead workstation is a full production compromise path with
no second human in the loop.

**Recommendation:** require a second `AgentID`/key for the `Approved: true`
transition on non-staging requests — added to the revised Component 3
section as a v1.1.1 requirement, not a future nice-to-have, since the daemon
already has everything it needs (`AgentID`, `Signature`) to check this.

### 8. HIGH (spec/product design) — No rollback path for a production change that breaks the host

The Docker mirror validates a command *before* production, but once a
command executes on production (`privileged.go`), there is no described
snapshot/rollback mechanism. Several of the cataloged operations
(`setenforce`, `grubby`, `sysctl`, `authselect`) can break SSH, PAM auth, or
boot — exactly the kind of change where "diff was clean in staging" doesn't
guarantee "safe in production" (staging is a mirror image, not a byte-for-
byte clone of the actual host's current config). There is no described
pre-change state snapshot on the production host itself, nor an automatic
revert-on-failure path.

**Recommendation:** the daemon should capture the production host's
pre-change state for any `affectedFilesByCommand()` entry before executing,
store it alongside the DAG attestation node, and expose a `Rollback`
operation in the client/desktop UI. Added to the revised spec as a required
v1.1.1 capability.

### 9. HIGH (spec/compliance) — Commercial LLM path has no CUI boundary enforcement

Component 4's commercial chain (Claude/GPT-4o) is described as opt-in and
"blocked in air-gap mode," but every screen in the product displays the CUI
banner (Non-Negotiable #9) — meaning the product's default operating
context is a CUI environment. A user who toggles `KHEPRA_LLM_PROVIDER=
commercial` on a CUI-classified host (accidentally, or because their
network happens to have internet access even though the environment is CUI)
would send STIG finding details, control mappings, and possibly system
identifying information to a third-party API — a DFARS 252.204-7012 /
CMMC data-handling violation the tool exists to prevent, not cause. "Blocked
in air-gap mode" describes a network condition, not a classification
policy; the two are not the same thing (a CUI host can absolutely have
internet access).

**Recommendation:** gate the commercial LLM path on an explicit,
non-default "this instance does not process CUI" acknowledgment set during
installation (not just network reachability), and have every commercial
inference redact/hash control identifiers rather than sending raw finding
text where feasible. Added to the revised Component 4 section.

### 10. MEDIUM (spec/product design) — Headless service network exposure unspecified

The installer's Windows Services table lists
`AdinKhepraASAF adinkhepra-desktop.exe --headless --port 8443` — the same
port the CLI's `serve` command already exposes as a DAG viewer web UI
(README, Surface 1). Neither the original spec nor `pkg/webui` docs state
the bind address or authentication model for that port. `0.0.0.0:8443`
with no auth on a DoD host is a meaningfully worse posture than the "zero
egress" framing suggests — egress isn't the only exposure that matters for
a sovereign/air-gap pitch; unauthenticated ingress is arguably the bigger
risk for this buyer.

**Recommendation:** bind to `127.0.0.1` by default, require the same
ML-DSA-65 device-bound license/session material to authenticate any request
if it's ever exposed beyond loopback, and say so explicitly in the spec.

### 11. LOW (spec clarity) — Version numbering conflates document version and product version

The spec header says "Complete Build Specification v2.0" and "Supersedes
v1.0," but the body's scope table, binaries, and installer are all labeled
v1.1.1. A reader can't tell whether v2.0 is the *document's* revision or a
*product* release distinct from v1.1.1. Fixed in the revised header below
by naming the document version and product version separately.

### 12. LOW (spec honesty) — "COMPLETE — NO DEFERRALS" table includes three externally-blocked rows

The v1.1.1 scope table's header claims no deferrals, but three of its rows
(Windows Code Signing, macOS Notarization, Iron Bank Sponsor) are
explicitly described elsewhere in the same document as blocked on external
parties (CA vetting, Apple enrollment, a DoD co-signer) with no ETA the
team controls. That's a legitimate distinction (code-complete vs.
externally-gated for GA) but the table's own header claims something the
table's own rows contradict. Relabeled in the revision to separate
"engineering complete" from "external dependency outstanding."

### 13. LOW (spec gap) — No threat model / trust boundary section

For a document specifying a privileged local daemon with kernel-level
command execution, there's no explicit statement of what's trusted (the
signing key holder), what's the trust boundary (Unix socket + ML-DSA-65
signature), and what's out of scope (an attacker with root already, an
attacker who has stolen the desktop's private key). Findings #1, #5, and #7
above are all downstream of this gap — without a stated threat model, it's
easy to under-specify enforcement (as #1 shows happened in practice). Added
as a new section in the revision.

### 14. LOW (spec gap) — No key-enrollment/pairing step between desktop and daemon documented

The daemon trusts whatever `AgentPubKey` is loaded from
`--agent-pubkey`/`/etc/asaf/agent.pub`, and the client signs with whatever
`PrivKey` it's configured with — but the spec never describes how the
daemon's `agent.pub` gets populated with the *desktop instance's* public
key in the first place (installer step? manual admin action? auto-enrollment
on first connect?). Without this, "the daemon only accepts signed requests"
is true but incomplete — it says nothing about which desktop instances get
to be that signer. Added to the installer section in the revision.

### 15. LOW (spec gap) — No CPU/software-rendering fallback for the OpenGL graph on VDI

The desktop app requires OpenGL (go-gl) for the 3D force graph, and the
target buyer (CISO/Compliance Lead at a DIB contractor) is disproportionately
likely to be on a locked-down VDI/thin-client without GPU passthrough. The
spec doesn't mention a software-rendering fallback (e.g., Mesa llvmpipe),
so the primary UI could simply fail to launch in a common deployment
environment for this exact buyer. Added as a note in the revised Component 1
section.

---

## Disposition summary

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| 1 | Symbol enforcement bypass (3 of 4 tiers unenforced) | Critical | **Fixed in code** |
| 2 | Staging mirror shell re-injection surface | High | **Fixed in code** |
| 3 | Mirror image pulled from ghcr.io, contradicts air-gap | High | Spec revised |
| 4 | Docker dependency vs. STIG-hardened production hosts | Medium | Spec revised |
| 5 | No replay protection on signed ChangeRequests | High | Spec revised (daemon fix tracked separately) |
| 6 | mTLS flags accepted but listener never implemented | Medium | Spec revised (marked Planned) |
| 7 | No separation of duties for approval | High | Spec revised |
| 8 | No production rollback path | High | Spec revised |
| 9 | Commercial LLM path has no CUI boundary | High | Spec revised |
| 10 | Headless service bind/auth unspecified | Medium | Spec revised |
| 11 | Document vs. product version conflation | Low | Spec revised |
| 12 | "No deferrals" claim contradicted by its own rows | Low | Spec revised |
| 13 | No threat model section | Low | Spec revised (new section added) |
| 14 | No key enrollment/pairing process documented | Low | Spec revised |
| 15 | No software-rendering fallback for VDI | Low | Spec revised |

Findings #1 and #2 were live, exploitable issues in code that already ships
in this repo (`pkg/asaf/daemon/`), not just gaps in the spec prose — both
are fixed directly rather than only documented. Everything else is a spec
revision; see `ADINKHEPRA_ASAF_SPEC.md` for the updated text.
