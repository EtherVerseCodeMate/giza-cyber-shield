#!/bin/bash
# repo_cleanup.sh — Execute the deployment consolidation
# Run from repo root: bash scripts/repo_cleanup.sh
# Reviews each step and asks for confirmation before destructive actions.

set -euo pipefail
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

echo "╔══════════════════════════════════════════════════╗"
echo "║  AdinKhepra Repo Consolidation                   ║"
echo "║  Five units → clean monorepo                     ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

confirm() {
  read -rp "→ $1 [y/N]: " ans
  [[ "$ans" =~ ^[Yy]$ ]]
}

# ── STEP 1: Delete the Vite orphan ───────────────────────
echo "STEP 1: Delete souhimbou_ai/SouHimBou.AI/ (Vite orphan)"
echo "  This directory has no active deploy target."
echo "  It diverges from src/ every commit."
echo "  Nothing in the production flow references it."
echo ""
ls souhimbou_ai/SouHimBou.AI/ 2>/dev/null && echo "  (directory exists)" || echo "  (already gone)"

if confirm "Delete souhimbou_ai/SouHimBou.AI/?"; then
  git rm -rf souhimbou_ai/SouHimBou.AI/
  echo "  ✅ Deleted"
else
  echo "  Skipped"
fi

echo ""

# ── STEP 2: Pick ONE frontend deploy target ───────────────
echo "STEP 2: Remove fly.dashboard.toml — Vercel is the primary frontend"
echo "  vercel.json deploys src/ to Vercel (faster CDN, zero config)"
echo "  fly.dashboard.toml also deploys src/ to Fly.io"
echo "  Two targets for the same app = two env var stores to keep in sync"
echo "  Fly.io stays for the BACKEND (souhimbou-ai app)"
echo ""

if [ -f "fly.dashboard.toml" ]; then
  echo "  fly.dashboard.toml exists"
  if confirm "Remove fly.dashboard.toml (keep fly.toml for the agent)?"; then
    git rm fly.dashboard.toml
    echo "  ✅ Removed"
  else
    echo "  Skipped"
  fi
else
  echo "  fly.dashboard.toml not found — already clean"
fi

echo ""

# ── STEP 3: Fix CSP header conflict ──────────────────────
echo "STEP 3: Reconcile CSP headers"
echo "  vercel.json headers block OVERRIDES next.config.mjs headers() for Vercel"
echo "  The fix: move the canonical CSP to vercel.json only (Vercel reads it first)"
echo "  next.config.mjs headers() will apply only to Fly.io and VPS (nginx)"
echo ""
echo "  Required vercel.json headers to add/verify:"
cat << 'HEADERS'
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://api.anthropic.com https://srv1494994.hstgr.cloud wss://srv1494994.hstgr.cloud; frame-ancestors 'none'"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=63072000; includeSubDomains; preload"
        }
      ]
    }
  ]
}
HEADERS
echo ""
echo "  Add the above headers array to vercel.json manually."
echo "  (Not auto-applied by this script — review before committing)"

echo ""

# ── STEP 4: Move telemetry off Cloudflare Workers ────────
echo "STEP 4: Migrate telemetry from Cloudflare Workers → VPS"
echo "  telemetry.souhimbou.ai on Cloudflare Workers + D1:"
echo "    ❌ Not FedRAMP authorized"
echo "    ❌ Cloudflare can inspect traffic"
echo "    ❌ External dependency you don't control"
echo ""
echo "  VPS (187.124.225.91) + Go telemetry server:"
echo "    ✅ Sovereign infrastructure"
echo "    ✅ No FedRAMP blocker for DoD customers"  
echo "    ✅ BadgerDB embedded — no external DB"
echo "    ✅ Dilithium3-signed beacons (already designed)"
echo ""
echo "  Migration steps:"
echo "  1. Build telemetry Go binary: cd adinkhepra-telemetry-server && go build -o bin/telemetry-server"
echo "  2. Deploy to VPS: see scripts/deploy-telemetry-vps.sh"
echo "  3. Update DNS: telemetry.souhimbou.ai → A record → 187.124.225.91"
echo "  4. Decommission wrangler.toml / CF Worker after DNS propagation"
echo ""
echo "  ⚠ Do NOT delete wrangler.toml until VPS telemetry is confirmed live"

echo ""

# ── STEP 5: Set up monorepo structure ─────────────────────
echo "STEP 5: Introduce Turborepo workspace structure"
echo ""
echo "  Target directory layout:"
cat << 'LAYOUT'
giza-cyber-shield/
├── apps/
│   ├── dashboard/       ← MOVE src/ here
│   ├── agent/           ← MOVE Python agent + root Dockerfile here
│   └── telemetry/       ← MOVE adinkhepra-telemetry-server/ here
├── packages/
│   ├── khepra/          ← MOVE pkg/ + cmd/ here (Go module)
│   └── asaf-mcp/        ← mcp-agent-bridge (new)
├── turbo.json           ← already created
├── package.json         ← workspace root (already created)
└── go.work              ← Go workspace file linking packages/khepra
LAYOUT
echo ""
echo "  Executing directory moves..."
echo ""

if confirm "Create apps/ and packages/ directories?"; then
  mkdir -p apps/dashboard apps/agent apps/telemetry
  mkdir -p packages/khepra packages/asaf-mcp
  echo "  ✅ Directories created"

  if confirm "Move src/ → apps/dashboard/?"; then
    git mv src apps/dashboard/src 2>/dev/null || cp -r src apps/dashboard/src
    [ -f "next.config.mjs" ] && git mv next.config.mjs apps/dashboard/
    [ -f "next.config.ts" ]  && git mv next.config.ts apps/dashboard/
    [ -f "vercel.json" ]     && git mv vercel.json apps/dashboard/
    [ -f "tailwind.config.ts" ] && git mv tailwind.config.ts apps/dashboard/
    [ -f "tsconfig.json" ]   && git mv tsconfig.json apps/dashboard/
    echo "  ✅ src/ → apps/dashboard/"
  fi

  if confirm "Move adinkhepra-telemetry-server/ → apps/telemetry/?"; then
    git mv adinkhepra-telemetry-server/* apps/telemetry/ 2>/dev/null || \
      cp -r adinkhepra-telemetry-server/* apps/telemetry/
    echo "  ✅ Telemetry server → apps/telemetry/"
  fi

  if confirm "Move pkg/ + cmd/ → packages/khepra/?"; then
    git mv pkg packages/khepra/
    git mv cmd packages/khepra/
    [ -f "go.mod" ] && git mv go.mod packages/khepra/
    [ -f "go.sum" ] && git mv go.sum packages/khepra/
    echo "  ✅ Go packages → packages/khepra/"
    echo "  Creating go.work at root..."
    cat > go.work << 'GOWORK'
go 1.22

use (
  ./packages/khepra
)
GOWORK
    echo "  ✅ go.work created"
  fi
else
  echo "  Skipped — run manually when ready"
fi

echo ""

# ── STEP 6: CI change detection ───────────────────────────
echo "STEP 6: GitHub Actions — change detection"
echo ""
echo "  After Turborepo setup, update CI to only deploy changed packages:"
cat << 'CI_EXAMPLE'
# .github/workflows/deploy.yml
- name: Determine what changed
  id: changes
  uses: dorny/paths-filter@v3
  with:
    filters: |
      dashboard:
        - 'apps/dashboard/**'
      agent:
        - 'apps/agent/**'
        - 'packages/khepra/**'
      telemetry:
        - 'apps/telemetry/**'

- name: Deploy dashboard
  if: steps.changes.outputs.dashboard == 'true'
  run: cd apps/dashboard && vercel deploy --prod

- name: Deploy agent
  if: steps.changes.outputs.agent == 'true'
  run: fly deploy --app souhimbou-ai --config apps/agent/fly.toml
CI_EXAMPLE
echo ""

# ── Summary ───────────────────────────────────────────────
echo "╔══════════════════════════════════════════════════╗"
echo "║  CLEANUP SUMMARY                                  ║"
echo "╠══════════════════════════════════════════════════╣"
echo "║  Immediate (today):                               ║"
echo "║    □ Delete souhimbou_ai/SouHimBou.AI/           ║"
echo "║    □ Remove fly.dashboard.toml                    ║"
echo "║    □ Fix CSP in vercel.json                       ║"
echo "║    □ git commit -m 'chore: consolidate frontends' ║"
echo "║                                                   ║"
echo "║  This sprint:                                     ║"
echo "║    □ Deploy telemetry server to VPS               ║"
echo "║    □ Update DNS telemetry.souhimbou.ai → VPS     ║"
echo "║    □ Decommission CF Worker                       ║"
echo "║                                                   ║"
echo "║  Next sprint:                                     ║"
echo "║    □ apps/ + packages/ directory migration        ║"
echo "║    □ Add go.work                                  ║"
echo "║    □ GitHub Actions change detection              ║"
echo "╚══════════════════════════════════════════════════╝"
