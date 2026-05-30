# Khepra Protocol — Deployment Architecture

## Deployment Modes Overview

| Mode | Binary | Storage | Network | Use Case |
|---|---|---|---|---|
| `sovereign` (default) | `adinkhepra`, `khepra-mcp` | PersistentMemory → `~/.khepra/dag/` | LAN only (RFC 1918 + loopback) | Bare metal, DoD, air-gap |
| `ironbank` | `adinkhepra` (FIPS build) | PersistentMemory → `~/.khepra/dag/` | LAN only | DoD Iron Bank, FIPS 140-3 |
| `edge` | `ghcr.io/etherversecodemate/khepra-mcp` | Memory (in-process, per-call) | Unrestricted | SaaS Fly.io MCP |
| `hybrid` | Agent + MCP | Memory + Supabase | Unrestricted | SaaS with local cache |

Set the mode at runtime: `KHEPRA_MODE=sovereign` (default when unset).

---

## Storage Architecture

The DAG (compliance audit trail, attestation) and the application state (phantom-agi EA engine) use **different storage backends**. These are not interchangeable.

### DAG / Compliance Layer (`pkg/dag`)

| Deployment | Backend | Location | Who manages it |
|---|---|---|---|
| Sovereign binary (bare metal, no Docker) | `PersistentMemory` (JSON files) | `~/.khepra/dag/` or `$KHEPRA_DAG_PATH` | Go binary, auto-created |
| Sovereign container (Docker, isolated) | `PersistentMemory` | `/root/.khepra/dag/` (volume-mounted) | Go binary |
| SaaS MCP (Fly.io) | `dag.Memory` (in-process, ephemeral) | RAM only — per invocation | Go binary |
| SaaS agent | Supabase (`pkg/gateway`, `//go:build saas`) | Supabase PostgREST | Supabase project |

> **Why no SQLite?** `PersistentMemory` persists each DAG node as a JSON file with atomic writes and corruption quarantine. It requires zero external dependencies and works in air-gap environments. SQLite would require CGO. JSON files are forensically inspectable without any tooling.

### Application State (phantom-agi EA Engine)

| Deployment | Backend | Notes |
|---|---|---|
| `docker-compose.vps.yml` | PostgreSQL (bundled) | **Connected VPS** — pulls image from Docker Hub on first boot |
| `docker-compose.airgap.yml` | PostgreSQL (pre-loaded image) | **True air-gap** — images pre-loaded via `make airgap-prepare` |
| Bare metal binary | File-based (`ea_state.json`, `threat_memory.json`) | No database required |

> **The PostgreSQL in `docker-compose.vps.yml` is for the phantom-agi EA engine only, not for the DAG.** The DAG lives in `pkg/dag` and uses `PersistentMemory` regardless of whether Docker is running.

---

## MCP Client Configuration

Use the correct `.mcp.json` variant for your deployment:

| File | When to use |
|---|---|
| `.mcp.sovereign.json` | Bare metal / air-gap — no Supabase, `KHEPRA_MODE=sovereign` |
| `.mcp.saas.json` | SaaS Fly.io + Supabase — `KHEPRA_MODE=edge` |
| `.mcp.json` | Default (sovereign) — same as `.mcp.sovereign.json` |

Copy the appropriate file to `.mcp.json` in your project root (or reference it from your AI tool config).

---

## Network Policy

| Policy | What's reachable | When used |
|---|---|---|
| `local_only` | Loopback only (127.0.0.1, ::1) | Extra-paranoid sovereign |
| `lan` | RFC 1918 + loopback | Default for sovereign/ironbank |
| `unrestricted` | Any IP including internet | SaaS edge/hybrid |

Override: `KHEPRA_NETWORK_POLICY=local_only` (overrides the mode default).

LaneSonar enforces this at **scan time** — an attempt to scan `8.8.8.8` in `lan` or `local_only` mode returns an error before any network connection is made. Verify with:

```bash
go test ./tests/validation/... -run TestLaneSonar -v
```

---

## CVE Database (Air-Gap)

The CVE database is required for Horus vulnerability scanning. In sovereign mode:

```bash
# On a connected system — build the bundle
KHEPRA_MODE=connected make bundle-cve

# Transfer dist/cve-bundle-YYYYMMDD.tar.gz to sovereign system
# Verify: sha256sum -c dist/cve-bundle-YYYYMMDD.tar.gz.sha256

# On sovereign system — extract
tar -xzf cve-bundle-YYYYMMDD.tar.gz -C data/
```

`KHEPRA_MODE=sovereign make fetch-cve-quick` **hard-fails** — no silent internet calls.

---

## True Air-Gap Docker Deployment

```bash
# On connected system
make airgap-prepare
# Produces:
#   dist/airgap-images-YYYYMMDD.tar.gz  (Docker images)
#   dist/airgap-models-YYYYMMDD.tar.gz  (Ollama model)
#   dist/airgap-bundle-YYYYMMDD.sha256  (checksums)

# Transfer all dist/ files to sovereign system (USB, classified network)

# On sovereign system
docker load < dist/airgap-images-YYYYMMDD.tar.gz
tar -xzf dist/airgap-models-YYYYMMDD.tar.gz -C ~/.ollama/
docker compose -f docker-compose.airgap.yml up -d
```

---

## Credential Policy

Default passwords in any compose file will cause a **startup failure** — not a warning. The `credential-check` service runs before PostgreSQL and phantom-agi. If `POSTGRES_PASSWORD` matches the default value or is empty, the entire stack refuses to start.

Set credentials in `.env` (never commit this file):
```bash
POSTGRES_PASSWORD=<strong-random-password>
SUPABASE_PROJECT_REF=<your-project-ref>  # SaaS only
```
