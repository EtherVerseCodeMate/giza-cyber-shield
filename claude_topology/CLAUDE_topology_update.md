# CLAUDE.md — Topology Update
# Replace the "Repository structure" section with this accurate version
# The previous version didn't reflect the actual five-unit deployment topology

## Actual deployment units (five, not one)

This repo contains FIVE deployable units sharing one git root.
After the monorepo migration, they live in apps/ and packages/.

### Unit 1: Dashboard (apps/dashboard/)
- Source: src/ (Next.js 14, TypeScript)
- Deploy target: **Vercel** (PRIMARY — do not use fly.dashboard.toml)
- Config: apps/dashboard/vercel.json
- URL: adinkhepra.com
- Why Vercel: faster CDN, zero-config Next.js, SOC2 compliant

### Unit 2: AI Agent (apps/agent/)
- Source: root Dockerfile (Python + compiled Go binaries in one container)
- Deploy target: **Fly.io** (app: souhimbou-ai)
- Config: fly.toml
- URL: souhimbou-ai.fly.dev
- Exposed routes: /api/v1/mcp/ask, /api/v1/license/validate, /api/v1/scan/*

### Unit 3: Khepra Go Core (packages/khepra/)
- Source: pkg/ + cmd/
- Deploy target: **Bundled in apps/agent container** + distributed as CLI binary
- Also deployed to **VPS** as the standalone adinkhepra binary
- Build: GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w"

### Unit 4: Telemetry Server (apps/telemetry/)
- Source: adinkhepra-telemetry-server/ (Go)
- Deploy target: **VPS (Hostinger) — NOT Cloudflare Workers**
  - Cloudflare Workers is NOT FedRAMP authorized → unacceptable for DoD customers
  - VPS is sovereign infrastructure under your control
- URL: telemetry.souhimbou.org → A record → 187.124.225.91
- Config: /opt/adinkhepra-telemetry/config.json on VPS

### Unit 5: DELETED
- souhimbou_ai/SouHimBou.AI/ (Vite/React) — DELETED
- Had no active deploy target
- Diverged from src/ every commit
- Zero production traffic

## Traffic topology

```
User browser
    │
    ▼
adinkhepra.com (Vercel — primary frontend)
    │
    │  /api/v1/* → rewrites in next.config.mjs
    ▼
souhimbou-ai.fly.dev (Fly.io — Python agent + Go binaries)
    │
    ├── /api/v1/mcp/ask        (G0DM0D3 chat)
    ├── /api/v1/license/validate  (auth)
    └── /api/v1/scan/*         (ASAF scanner)

CLI (installed adinkhepra binary)
    │
    └── anonymous beacons → telemetry.souhimbou.org (VPS — sovereign)
                          → /crl (license revocation list)

DoD / Air-gap mode:
    └── adinkhepra binary → localhost only, no external calls
```

## Environment variables — where they live

| Variable | Vercel | Fly.io | VPS |
|---|---|---|---|
| ANTHROPIC_API_KEY | ✅ | ✅ | ✅ |
| NEXT_PUBLIC_API_URL | ✅ | — | — |
| SUPABASE_URL | ✅ | ✅ | — |
| FLY_API_TOKEN | — | internal | — |
| DILITHIUM_MASTER_KEY | ❌ never | ✅ sealed | ✅ ~/.asaf/keys/ |

## What NOT to do

- Do NOT add env vars to both vercel.json AND fly.toml for the same app
- Do NOT deploy the dashboard to Fly.io (fly.dashboard.toml is deleted)
- Do NOT use Cloudflare Workers for any new telemetry endpoints (not FedRAMP)
- Do NOT put the Dilithium master private key in any cloud env var store
- Do NOT edit souhimbou_ai/SouHimBou.AI/ — it is deleted

## Monorepo tooling

Turborepo manages build/test/deploy pipelines across all packages.
Run from repo root:

```bash
npm run build           # builds all packages in dependency order
npm run deploy:dashboard  # Vercel deploy
npm run deploy:agent      # Fly.io deploy
npm run deploy:vps        # VPS deploy (Go binary)
turbo build --filter=khepra  # only build the Go package
turbo build --filter=dashboard  # only build the frontend
```

Change detection in CI: if only apps/dashboard/ changed,
only Vercel redeploys. Fly.io and VPS are untouched.
This is the fix for "every push rebuilds everything."

## Azure Government note

AWS GovCloud requires FedRAMP Moderate authorization as a vendor.
Azure Government is the alternative for DoD cloud:
- Azure already has IL2/IL4/IL5 authorizations
- Easier for SDVOSB to navigate than AWS GovCloud contracting
- When the GovCloud path is ready: Dockerfile.fips → Azure Container Apps
