# 🛰️ CTO Decision — ASAF Sovereignty Boundary to TRL 10

**Date**: 2026-07-02
**Decision owner**: CTO (acting)
**Question on the table**: *"Should `asaf-desktop --hub https://asaf.company.com:8443` point at THE PQC-Khepra-MCP at `https://mcp.souhimbou.ai` on our Hostinger VPS?"*
**Decision**: **NO.** Ruled below with source evidence, plus the enforceable controls that hold the line at TRL 10.
**TRL bar**: TRL 10 = *proven through operations*. A boundary that is only asserted in comments is TRL 7. This document moves it to enforced.

---

## 1. The ruling (one paragraph)

`asaf.company.com:8443` is a **placeholder for the customer's own on-prem Hub**, not a URL we host. Pointing every customer's `--hub` at `mcp.souhimbou.ai` on the Hostinger VPS would (1) put customer CUI compliance data on a commercial, non-FedRAMP VPS — a DFARS 252.204-7012 violation that fails the exact audit ASAF sells; (2) destroy the sovereignty value prop that justifies the $25K–250K/yr price; and (3) collapse three separate product boundaries (SOC-SaaS, agent channel, sovereign Hub) into one vendor URL. Our **own `deploy-vps.sh` already says so**: the VPS is `❌ NOT: public ASAF API server (that runs on customer machines)` and `❌ NOT: multi-tenant SaaS`.

## 2. What is actually bound today (verified from source, not assumed)

| Surface | Bound to | Service (evidence) | Plane | Carries customer CUI? |
|---|---|---|---|---|
| **Customer Hub** `:8443` | customer infra (per tenant) | placeholder `asaf.company.com` in arch docs; **no vendor default in Go** (`cmd/asaf-desktop/main.go` `--port` only) | data plane | on customer infra — ✅ correct |
| `telemetry.souhimbou.ai` | VPS | license validate + heartbeat (`cmd/sonar/license.go:52`, `cmd/agent/main.go:109`) | control plane | no (license metadata) |
| `get.nouchix.com` | VPS | installer + checksums + docs (`deploy-vps.sh`) | control plane | no |
| `webhook.nouchix.com` | VPS | Stripe webhook (stateless) | control plane | no |
| `mcp.souhimbou.ai` | VPS (Caddy → `khepra-mcp:8080`) | public MCP tool endpoint; `KHEPRA_NETWORK_POLICY=wan`, `KHEPRA_DAG_SEED_DEMO=true`, persistent `khepra-data` vol (`deploy/docker-compose.vps.yml:39-63`) | demo/discovery | **must be SYNTHETIC only** |
| `gateway.souhimbou.ai` | VPS (Caddy → `sekhem-gateway:9090`) | `POST /api/v1/scan/agent`, `ASAF_ALLOW_EVAL_WITHOUT_LICENSE=true`, Supabase **service-role** key, shares `khepra-data` DAG vol (`docker-compose.vps.yml:71-91`) | demo/discovery | **must be SYNTHETIC only** |
| `souhimbou.ai` / `staging.` | Vercel/VPS | SouHimBou AI SaaS + Flight Recorder dashboard (Product C); ZAP DAST target | separate product | its own boundary |

**Key positive**: the client boundary is intact. The desktop and reporter do **not** compile in a vendor Hub default — the only vendor defaults in Go are `telemetry.souhimbou.ai` (licensing). The sovereignty of the *customer data plane* is not currently breached by any shipped client.

## 3. The real risk — demo scan surfaces are asserted-safe, not enforced-safe

The live, marketed endpoints are a genuine product asset (zero-install "try it in 30s"), but today they are a boundary hazard because nothing enforces "synthetic only":

- **`POST /api/v1/scan/agent` (`pkg/apiserver/agent_scan_handlers.go:113`)** accepts a caller-supplied `Target`, `APIKey`, and `RepoPath` with `Tier` defaulting to `free`, under `ASAF_ALLOW_EVAL_WITHOUT_LICENSE=true`. Nothing stops a prospect from submitting a **real CUI host or a live credential**, which would then be processed on our commercial VPS.
- The `sekhem-gateway` holds a **Supabase service-role key** (full RLS bypass) and shares a **persistent DAG volume** with the demo MCP. Real eval-scan artifacts could co-mingle with the demo-seeded DAG on a vendor-held store.
- The marketing funnel scan path (`src/app/api/scan/route.ts`) forwards to `mcp.souhimbou.ai` with **no "do not submit CUI" notice**.

None of this is a CUI *breach* today (no evidence real CUI has been submitted), but "no evidence of misuse" is TRL 7, not TRL 10. TRL 10 requires the misuse be **impossible or gated**, and visibly classified.

## 4. TRL10 blockers (must close before this is "proven")

| ID | Blocker | Fix | Owner |
|---|---|---|---|
| **SB-01** | Public eval scan accepts arbitrary real targets/credentials | Input guard: reject non-public/private-range targets and any submitted `APIKey` on the free/unauthed tier; tier-gate authenticated scans behind login | MCP/apiserver |
| **SB-02** | No data-classification notice on demo scan | Add non-dismissible "DEMO — do not submit CUI" banner in funnel + API 200 response metadata `is_demo:true` | Web + apiserver |
| **SB-03** | Demo DAG + Supabase co-mingling | Isolate demo DAG volume from any customer artifact; scope the gateway to an anon Supabase key, not service-role, for eval | Platform |
| **SB-04** | Sprint-Zero Stargate Hub (`cmd/asaf-hub`, `pkg/asaf/hub`, `pkg/asaf/fleet`) **not present on this branch** despite "COMPLETE" claim | Reconcile: land the code or correct the status. A boundary can't be TRL10 on infra that isn't in source of truth | Eng lead |
| **SB-05** | `agent.souhimbou.ai` vs `agent.souhimbou.org` TLD split (`.env:39`) | Consolidate to one TLD to avoid an unmanaged surface | Platform |

## 5. Controls instituted in this change (enforcement, not just diagnosis)

1. **`scripts/sovereignty_boundary_guard.sh`** — pure-bash, deny-by-default guard. Fails CI if any shipped client defaults its Hub/upstream to a vendor host, or any Hub/Fleet/CUI data-plane service is bound to an **unreviewed** vendor host, or an eval-scan surface exists without a DEMO classification. Runs green today (client boundary intact); catches the regression the moment someone points a client at the vendor.
2. **`scripts/sovereignty_allowlist.txt`** — the reviewed exceptions (control-plane + demo), each with a data classification. A vendor surface not on this list with a data-plane binding hard-fails.
3. **`.github/workflows/sovereignty-boundary.yml`** — runs the guard on every PR. No Go/Node toolchain, so it is immune to the toolchain/dependency drift that is currently red-ing the other gates (see PR #240 CI diagnosis).
4. **MEMORY.md § Sovereignty Boundary Policy** — the permanent rule, control-plane vs data-plane table, and the "ask before you bind a URL" discipline.

**Action required in PQC-Khepra-MCP**: copy the guard + allowlist + workflow into that repo (the `gateway.souhimbou.ai` eval surface lives there), and close SB-01…SB-03.

## 6. Go / No-Go

- **Customer Hub as a vendor-hosted shared URL**: 🔴 **NO-GO — permanently.** Not a config toggle; a boundary invariant.
- **`mcp.souhimbou.ai` / `gateway.souhimbou.ai` as public demo/discovery**: 🟡 **GO, conditional** on SB-01…SB-03 (synthetic-only, gated, classified).
- **`telemetry.souhimbou.ai` licensing control plane**: 🟢 **GO** (keep offline-verification path for air-gap).
- **If a customer wants us to host their Hub**: that is a per-tenant **managed GovCloud** engagement (Azure Gov / AWS GovCloud, FedRAMP-aligned), never a shared subdomain.

---
*CTO decision record. Enforced by the Sovereignty Boundary Guard. Supersedes any doc implying the customer Hub may be a vendor-hosted URL.*
