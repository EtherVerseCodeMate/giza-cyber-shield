# Binary Consolidation & Installer Briefing

**Status:** For review — no code changed as a result of this document.
**Prepared:** 2026-06-26
**Trigger:** 17 binaries + 3 stray directories found loose in the repo root; user
reported the laptop experience of opening them all as "messy." This document is
the due-diligence pass requested before deciding on a binary-shape and installer
direction.

---

## 1. What's actually in the root directory

17 `.exe` files + 1 Linux ELF + 3 directories. Every one was traced to its
`cmd/*` source and read for its actual stated purpose (not inferred from the
filename). Findings below are evidence-backed — file paths and quoted doc
comments are given so you can re-verify any of this in under a minute.

### 1a. Pure debris (delete, no architecture decision needed)

| Item | Size | What it is |
|---|---|---|
| `apiserver_linux` | 47 MB | A stray Linux cross-build of `cmd/apiserver`, committed into the Windows dev tree. Should never have been here — it's a build *output*, not source. |
| `cmd` (empty dir) | — | Build-script debris. A `go build -o cmd...` invocation almost certainly mistyped a missing path separator (`cmd` + binary name concatenated, e.g. `cmdkhepra-pentest`, `cmdroot-keygen`) and created stray top-level dirs instead of writing into `cmd/khepra-pentest/`. |
| `cmdkhepra-pentest` (empty dir) | — | Same cause as above. |
| `cmdroot-keygen` (empty dir) | — | Same cause as above. |

**Action: delete all four. Zero risk, zero architecture impact.**

### 1b. The real 17 binaries, sorted by audience

This is the actual finding: the sprawl isn't 17 *peers*. It's three different
audiences that have never been physically or procedurally separated.

#### Bucket A — Ships to the customer's machine (the real installer surface)

| Binary | Size | Role | Evidence |
|---|---|---|---|
| `adinkhepra.exe` | 188 MB | Main CLI — `ert full`, `validate`, `serve`, `compliance scan` | Flagship entry point, `cmd/adinkhepra/main.go` |
| `khepra-mcp.exe` | 186 MB | MCP server — launched as a **subprocess** by Claude Desktop / Cursor / Windsurf over stdin/stdout JSON-RPC | `cmd/khepra-mcp/main.go`: *"runs as a subprocess launched by AI tools... via stdin/stdout JSON-RPC transport as defined by the MCP specification"* |
| `khepra-daemon.exe` | 10 MB | Background service — DAG/weave/attest, the "Father." Listens on **port 45444**. | `cmd/khepra-daemon/main.go`: *"KhepraDaemon is the 'Father' - the hidden protector for SouHimBou.AI"* |
| `mcp-runner.exe` | 4.6 MB | Sandboxed tool executor — but it runs **inside a Docker container that `khepra-mcp` itself spawns**, not standalone on the host | `cmd/mcp-runner/main.go`: *"runs inside the Phantom Docker container... entrypoint for sandboxed MCP tool execution"* |

This is the only bucket that needs a real installer. Everything else below is
either your own infrastructure or your own tooling — neither belongs on a
customer's laptop next to these four.

#### Bucket B — Your own server infrastructure (Fly.io / VPS — never ships to a customer)

| Binary | Role | Evidence |
|---|---|---|
| `apiserver.exe` | SaaS-mode "SEKHEM Gateway" — central hub wiring Go AGI + Python AGI + telemetry + client API | `cmd/apiserver/main.go`, build-tagged `//go:build saas` — **literally will not compile into a sovereign/customer build** |
| `gateway.exe` | "DEMARC" zero-trust perimeter between customer environments and the Khepra/SouHimBou ecosystem | `cmd/gateway/main.go`: *"the zero-trust perimeter defense between customer environments and the Khepra/SouHimBou.AI ecosystem"* |
| `telemetry-server.exe` | VPS-hosted telemetry receiver | `cmd/telemetry-server`, matches README's documented `telemetry.souhimbou.org` deploy |
| `webhook.exe` | Stripe webhook receiver | `cmd/webhook/main.go`: *"ASAF Stripe Webhook Receiver"* |

`build-release.sh` already proves this separation exists in your own release
pipeline — it builds `apiserver` and `webhook` **Linux-only**, explicitly
labeled for VPS, separately from the 5-platform CLI build. The infrastructure
already knows these aren't customer binaries. They're just not *physically*
separated from the ones that are.

#### Bucket C — Operator/key-ceremony tooling (you, never the customer)

| Binary | Role | Evidence |
|---|---|---|
| `root-ceremony` *(not built as .exe — `go run` only)* | One-time Shamir-sharded root key generation, AES-GCM + Argon2id encrypted shards | `cmd/root-ceremony`: *"each repo gets its OWN independent root key... Shamir shards of the private key (AES-GCM + Argon2id encrypted per shard)"* |
| `issue-license` *(not built as .exe — `go run` only)* | Issues device-bound customer licenses, requires `-threshold` of root-ceremony shards | `cmd/issue-license`: requires `keys/root-ceremony/shard-N-of-M.json` files |
| `root-keygen.exe` | **Superseded predecessor of root-ceremony** — flat Dilithium3 key pair, no sharding, no encryption | `root-ceremony`'s own doc comment explicitly frames itself as the fix for an "unpinned-verification bug" in the prior scheme |
| `keygen.exe` | Older/separate license generator (`license_gen.go`) | Unclear if superseded by `issue-license` or still load-bearing — needs a direct read before deletion |
| `service-token.exe` | HMAC service-to-service tokens, Cloudflare Worker ↔ DEMARC auth | `cmd/service-token/main.go`: *"Generates HMAC-signed service tokens for service-to-service authentication between CloudFlare Worker and DEMARC API server"* |

None of these should ship in a release build at all. `root-keygen.exe` being
present in the same `bin/` as customer binaries is a real exposure concern —
it's a stale tool for an admittedly-buggy key scheme sitting next to your
production signing keys' lineage.

#### Standalone / optional tools (not part of the sprawl problem — genuinely separate products)

| Binary | Role |
|---|---|
| `sonar.exe` | Network/OSINT scanner — dual-purpose: standalone CLI **and** consumed internally as `LaneSonar` by `pkg/ert/engine.go`. Not a duplicate. |
| `stig-test.exe` | STIG validation test harness |
| `khepra-pentest.exe` | Internal AGI-driven penetration test tool |
| `manifest-gen.exe` | Manifest signing for the MCP tool-schema pinning chain |
| `phantom-node.exe` | Network anonymization — Spectral Fingerprints + lattice signatures + Merkaba encryption. A genuinely distinct product, not compliance-related. |
| `khepra-client.exe` | Standalone local LLM/MCP chat demo UI, connects to `apiserver` + Ollama |
| `agent.exe` | **"AdinKhepra Protocol Sonar Agent"** — continuous-monitoring zero-trust engine, registers as Windows service `AdinKhepraSonarAgent` |

---

## 2. A landmine found during this audit — not cosmetic

`cmd/agent/main.go:410` binds **port 45444**:
```go
ln, _ := ts.Listen(context.Background(), ":45444")
```

`cmd/khepra-daemon` — the "Father" DAG daemon — **also owns port 45444** (confirmed
in two prior sessions' work against this exact daemon).

These are two unrelated binaries (`agent` = Sonar Agent / continuous monitoring;
`khepra-daemon` = DAG/weave/attest service) that will **fail to coexist on the
same host** if both are ever installed and started. This is exactly the kind
of thing that "looks fine until a customer's machine has both running." Whatever
direction you pick below, this collision needs a port reassignment before either
binary is part of a real installer.

---

## 3. What installer infrastructure already exists

**Partial — more than zero, less than usable.**

- `pkg/agent/service_windows.go` — real Windows service registration via
  `golang.org/x/sys/windows/svc` (`mgr.CreateService`), service name
  `AdinKhepraSonarAgent`. **This is for `cmd/agent`, not `khepra-daemon`.**
- `pkg/agent/service_darwin.go` — `InstallService`/`RemoveService` via launchd.
  Also `cmd/agent`-specific.
- `pkg/agent/service_linux.go` — **explicitly punts**: `"service installation
  not supported on Linux via this command. Use systemd."` No generated unit
  file, no `systemctl enable` wrapper.
- **No `.iss`, `.wxs`, `.nsi`, `.deb`, `.rpm`, `.service`, or `.plist` files
  exist anywhere in the repo.** Zero packaging artifacts. The service-install
  Go code above is the only piece of "installer" that exists, and it installs
  the wrong binary (`agent`, a Bucket-D/standalone tool) rather than the
  product surface (`khepra-daemon`).
- **Docker already works as a real single-command install path** for the MCP
  server specifically: `Dockerfile.mcp` builds a multi-target image already
  shipping to GHCR, AWS Marketplace GovCloud ECR, and Iron Bank. `.mcp.json`
  already has a working `khepra-mcp-docker` config entry pointing at
  `ghcr.io/etherversecodemate/khepra-mcp:latest`. **For non-air-gapped
  customers, the MCP-server distribution problem is already solved.** The gap
  is specifically: CLI + daemon, on bare metal, for SCIF/air-gap customers who
  can't or won't run Docker — which per your own pricing tier is exactly the
  Profile B / $25K–$250K buyer.

---

## 4. The MCP launch contract — why this matters for the binary-shape decision

`.mcp.json` proves the MCP launch contract is **just a command + args**:
```json
"khepra-mcp": {
  "command": "C:\\...\\bin\\khepra-mcp.exe",
  "args": []
}
```

Claude Desktop / Cursor / Windsurf don't care what the binary is named or
whether it's standalone — they invoke whatever `command`+`args` the config
says and talk stdin/stdout JSON-RPC to it. This means **collapsing
`khepra-mcp` into a subcommand of `adinkhepra` carries near-zero
launcher-compatibility risk** — the installer just needs to write
`"command": "adinkhepra.exe", "args": ["mcp", "serve"]` instead. The binary
*name* changing is not a breaking change to the MCP protocol contract at all.

This removes what would otherwise be the strongest argument for keeping
`khepra-mcp` as a separately-named binary.

---

## 5. Two real options for Bucket A (CLI + MCP server + daemon)

### Option 1 — Single binary, subcommands (`adinkhepra mcp serve`, `adinkhepra daemon start`, `adinkhepra daemon install`)

**Pros**
- One binary to sign, one version number, one thing in the installer
- `.mcp.json` only needs `command`/`args` changed — no protocol risk (§4)
- Matches the shape of `docker`/`git`/`kubectl` — a known-good pattern for
  exactly this kind of multi-mode tool
- `adinkhepra daemon install` can absorb the existing (working) Windows/macOS
  service code from `pkg/agent/service_{windows,darwin}.go`, fix the port
  45444 collision while doing it, and finally implement the Linux systemd
  path that currently just errors out
- Smaller total installer payload — no risk of `adinkhepra.exe` (188MB) and
  `khepra-mcp.exe` (186MB) both shipping when they likely share most of their
  374MB combined size in duplicated statically-linked dependencies

**Cons**
- Real Go refactor: `cmd/khepra-mcp/main.go` and `cmd/khepra-daemon/main.go`
  become subcommand packages under `cmd/adinkhepra/`, not independent `main`
  packages. Touches build scripts (`Makefile`, `build-release.sh`,
  `Dockerfile.mcp`), the `.mcp.json` Docker/dev entries, and any CI that
  references the old binary names.
- `Dockerfile.mcp` currently builds `khepra-mcp` as its own minimal image —
  that Docker distribution path (already live on GHCR/AWS Marketplace/Iron
  Bank) would need to build the unified binary instead and invoke
  `adinkhepra mcp serve` as the container entrypoint. Low risk but is a build
  pipeline change on infrastructure that's already in production channels.

### Option 2 — Keep 3 binaries, one installer places + registers them

**Pros**
- Zero Go refactor — today's `main` packages are untouched
- `Dockerfile.mcp`'s already-shipping image needs no changes at all
- Lower regression risk against existing AWS Marketplace / Iron Bank / GHCR
  channels in the next 30–60 days, which per your own sprint plan are the
  active revenue-closing priority

**Cons**
- Installer has to place 3 separate binaries + handle 3 separate version
  strings + register one of them (`khepra-daemon`) as a service while leaving
  the other two as plain executables on PATH
- Doesn't fix the underlying "which binary is which" confusion — just hides
  it behind an installer UI instead of a folder. The next time someone opens
  the install directory, it's still 3 things instead of 17, which is real
  progress, but the structural ambiguity (why are there 3?) persists.
- Still need to fix the port 45444 collision and the missing Linux
  systemd path regardless of which option you pick — this work is common to
  both.

---

## 6. Installer format options per OS (applies to either binary-shape choice)

| Platform | Recommended format | Why |
|---|---|---|
| Windows | Inno Setup (`.iss` → single `setup.exe`) | Free, scriptable, can register a Windows Service for the daemon via `sc create` or the existing `pkg/agent/service_windows.go` svc-mgr code, adds Start Menu/PATH entries. WiX/MSI is heavier-weight for marginal benefit here. |
| Linux | `.deb` + `.rpm` via `nfpm` (single YAML spec generates both) + a `systemd` unit file for the daemon | `nfpm` avoids hand-writing `debian/control` and `.spec` files separately; one config, two package formats. Closes the gap `service_linux.go` currently leaves open. |
| macOS | `.pkg` (via `pkgbuild`) + a `launchd` `.plist` for the daemon | `pkg/agent/service_darwin.go` already has working launchd install/remove logic to build on — just needs to target the right binary. |
| Cross-platform alternative | Docker (already solved for MCP server, not yet built for the CLI+daemon combo) | Doesn't satisfy SCIF/air-gap customers who are explicitly your Profile B target buyer — native installers are still required for that segment regardless of which option above you pick. |

---

## 7. Recommendation (not yet actioned)

Option 1 (single binary, subcommands) is the materially better long-term
shape — the MCP contract risk that would normally justify keeping
`khepra-mcp` separate doesn't actually exist (§4), and it's the only option
that forces the port-45444 collision and the missing-Linux-service-path
issues to get fixed as part of the same change rather than papered over.

The cost is real refactor time touching build scripts and one already-shipping
Docker pipeline. Given your sprint plan's stated priority (`"Every sprint that
produces code without a paying customer attached burns the window"`), the
honest tradeoff is: Option 1 is the right end state, but Option 2 ships an
installer this week with near-zero regression risk to channels already live
in front of paying-customer prospects (AWS Marketplace, Iron Bank, GHCR).

A reasonable sequencing: ship Option 2 now to get *an* installer in front of
QCL prospects, fix the port collision and Linux systemd gap as part of that
work since both binary shapes need them anyway, then do the Option 1 refactor
as a follow-on once revenue pressure eases — not as a blocker to the next
demo.

---

## 8. What this document does NOT cover

- `keygen.exe` vs `issue-license` — flagged as needing a direct read to
  confirm whether `keygen.exe` is dead code or still load-bearing. Not
  resolved here.
- Whether `phantom-node`, `khepra-client`, `khepra-pentest` should ship at all
  in a v1 installer, or be deferred as "advanced/optional" add-ons. Treated
  here as out-of-scope for Bucket A.
- Actual implementation of any of the above — this is the briefing only.
