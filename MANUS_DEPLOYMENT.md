# Manus AI — Giza Cyber Shield MVP Deployment Instructions

> **Scope**: Frontend (Vercel), Auth/MFA enforcement, UI/UX hardening, and related
> deployment concerns for the ASAF by NouchiX MVP.
>
> **Stack**: Next.js 16 · React 18 · React Router · Radix UI · Tailwind CSS
> · Go 1.25 backend (Fly.io) · Cloudflare Workers (telemetry) · Stripe billing

---

## Table of Contents

1. [Pre-deployment Checklist](#1-pre-deployment-checklist)
2. [Environment Variables](#2-environment-variables)
3. [Frontend — Vercel Deployment](#3-frontend--vercel-deployment)
4. [Backend — Fly.io Deployment](#4-backend--flyio-deployment)
5. [Cloudflare Worker — Telemetry](#5-cloudflare-worker--telemetry)
6. [Auth & MFA Enforcement](#6-auth--mfa-enforcement)
7. [UI/UX Production Hardening](#7-uiux-production-hardening)
8. [Security Headers & CSP](#8-security-headers--csp)
9. [Stripe Billing Integration](#9-stripe-billing-integration)
10. [Post-deployment Smoke Tests](#10-post-deployment-smoke-tests)
11. [Rollback Procedure](#11-rollback-procedure)

---

## 1. Pre-deployment Checklist

Complete every item before any environment receives traffic.

### Secrets & Keys
- [ ] `STRIPE_SECRET_KEY` rotated to live key (`sk_live_…`), test key removed
- [ ] `NEXT_PUBLIC_ASAF_API_KEY` set and never committed to VCS
- [ ] `STRIPE_WEBHOOK_SECRET` generated from Stripe dashboard and stored in Fly.io secrets
- [ ] `ASAF_ALLOW_EVAL_WITHOUT_LICENSE` set to `false` in production
- [ ] `VITE_ASAF_DEV` **not set** (absence disables dev bypass — see §6.1)
- [ ] No `.env.local` file in the Docker build context (add to `.dockerignore`)

### Code Quality Gates
- [ ] `npm run build` succeeds locally with zero critical TypeScript errors
- [ ] GitHub Actions CI passes: `run-validation-tests.yml`, `pre-commit-security.yml`
- [ ] No hardcoded secrets detected (hardcoded-key detection workflow green)
- [ ] SQL injection and command injection validators green

### DNS & Domains
- [ ] `adinkhepra.com` (or your production domain) points to Vercel
- [ ] `telemetry.souhimbou.org` CNAME to Cloudflare Workers route
- [ ] Fly.io app URL (`souhimbou-ai.fly.dev` or custom) resolves
- [ ] TLS certificates issued and auto-renewing on all three origins

---

## 2. Environment Variables

### 2.1 Vercel — Project Settings → Environment Variables

Set these for the **Production** environment. Never set `STRIPE_SECRET_KEY` here —
it belongs only on the server (Fly.io secrets or Vercel Server-side env, never
exposed to the browser).

```
# ASAF Backend
NEXT_PUBLIC_ASAF_API_URL=https://souhimbou-ai.fly.dev
NEXT_PUBLIC_ASAF_API_KEY=<your-production-api-key>
NEXT_PUBLIC_ASAF_SCAN_PROFILE=nemoclaw

# App URL (used for Stripe redirect_url)
NEXT_PUBLIC_APP_URL=https://adinkhepra.com

# Supabase (if the OTP password-reset flow is used)
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>

# Agent proxy target (server-side Next.js rewrite)
AGENT_URL=https://souhimbou-ai.fly.dev

# Feature flags — must be absent or '0' in production
# VITE_ASAF_DEV=          ← DO NOT SET
# ASAF_ALLOW_EVAL_WITHOUT_LICENSE=  ← DO NOT SET (defaults to false)
```

Add via Vercel CLI:
```bash
vercel env add NEXT_PUBLIC_ASAF_API_URL production
vercel env add NEXT_PUBLIC_ASAF_API_KEY production   # marks as secret
vercel env add NEXT_PUBLIC_APP_URL production
vercel env add AGENT_URL production
```

### 2.2 Fly.io — Server Secrets

```bash
fly secrets set \
  STRIPE_SECRET_KEY="sk_live_…" \
  STRIPE_PRICE_ID="price_…" \
  STRIPE_WEBHOOK_SECRET="whsec_…" \
  ASAF_API_KEY="<same key as NEXT_PUBLIC_ASAF_API_KEY>" \
  ASAF_ALLOW_EVAL_WITHOUT_LICENSE="false" \
  --app souhimbou-ai
```

### 2.3 Cloudflare Workers

Set via `wrangler secret put` or the dashboard:
```bash
wrangler secret put DILITHIUM3_PUBLIC_KEY   # paste the 1952-byte hex value
wrangler secret put BEACON_HMAC_SECRET
```

The D1 database binding and rate-limit config already live in `wrangler.toml`
and do not require secrets.

---

## 3. Frontend — Vercel Deployment

### 3.1 Connect Repository

1. Go to vercel.com → **Add New Project** → import `etherversecodemate/giza-cyber-shield`
2. Framework: **Next.js** (auto-detected from `vercel.json`)
3. Root directory: `.` (repo root — `package.json` is at the root)
4. Build command: `npm run build` (overrides any monorepo detection)
5. Output directory: `.next`
6. Install command: `npm install`

> Bun is listed as the package manager in `package.json` engines. Vercel's build
> environment defaults to npm/yarn. Either (a) keep `npm install` as the install
> command (already in `vercel.json`) or (b) add `BUN_VERSION=1.3.9` as an env
> var to enable the Bun runtime on Vercel.

### 3.2 Build Flags to Set

The current `next.config.mjs` silences TypeScript and ESLint errors during build.
This is intentional for CI speed but **requires** the CI jobs to be the real gate.
Confirm the following before go-live:

```js
// next.config.mjs — acceptable for production only when CI enforces type checking
typescript: { ignoreBuildErrors: true }   // type errors caught in CI workflow
eslint: { ignoreDuringBuilds: true }       // lint caught in pre-commit-security.yml
```

### 3.3 SSR / Dynamic Import Notes

`src/app/page.tsx` wraps `App.tsx` in a dynamic import with `ssr: false` to avoid
`BrowserRouter` SSR conflicts. This causes the entire SPA to be client-rendered.

**Important**: this means the **initial page paint is blank** until the JS bundle
hydrates. For production:

- Add a skeleton or branded loading screen inside `src/app/page.tsx` as the
  `loading` prop of `next/dynamic`:

  ```tsx
  // src/app/page.tsx
  const App = dynamic(() => import('../App'), {
    ssr: false,
    loading: () => (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a]">
        <img src="/logo.svg" alt="Loading…" className="h-12 animate-pulse" />
      </div>
    ),
  });
  ```

- Ensure `public/logo.svg` (or equivalent brand asset) exists so the loading
  state is not a white flash.

### 3.4 Standalone Output for Docker

`output: 'standalone'` in `next.config.mjs` generates a self-contained Node server
in `.next/standalone`. If you later containerize the frontend (e.g. for Fly.io
co-location), use:

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY .next/standalone ./
COPY .next/static ./.next/static
COPY public ./public
ENV PORT=3000
CMD ["node", "server.js"]
```

---

## 4. Backend — Fly.io Deployment

### 4.1 Initial App Creation

```bash
fly launch --name souhimbou-ai \
  --region iad \          # US East; add --region lhr for EU replica
  --dockerfile Dockerfile \
  --no-deploy             # configure secrets first
```

### 4.2 Dockerfile Notes

The multi-stage Dockerfile:
- **Stage 1** (`golang:1.25`): compiles all 8 NouchiX binaries
- **Stage 2** (`python:3.11-slim`): installs PyTorch CPU + ML anomaly service,
  copies binaries, runs as non-root `khepra` (UID 1000)

Ports exposed:
| Port | Service |
|------|---------|
| 8080 | SouHimBou AI (uvicorn FastAPI) — healthcheck target |
| 8443 | Khepra Gateway (TLS) |
| 45444 | ASAF Agent (license validation) |

Add to `fly.toml` (create if absent):
```toml
[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 1

[[services.ports]]
  port = 8443
  handlers = ["tls", "http"]

[checks]
  [checks.health]
    grace_period = "30s"
    interval = "15s"
    method = "GET"
    path = "/health"
    port = 8080
    timeout = "10s"
    type = "http"
```

### 4.3 Deploy

```bash
fly secrets set STRIPE_SECRET_KEY="sk_live_…" STRIPE_WEBHOOK_SECRET="whsec_…" \
  ASAF_API_KEY="…" ASAF_ALLOW_EVAL_WITHOUT_LICENSE="false" --app souhimbou-ai
fly deploy --app souhimbou-ai --remote-only
```

### 4.4 Agent Proxy Wiring

`next.config.mjs` rewrites `/api/agent/*` → `AGENT_URL`. Set `AGENT_URL` in
Vercel env to the Fly.io URL. The frontend never exposes the Fly.io origin to
end users — all calls are proxied through Next.js, which preserves the API key
in a server-only environment variable.

```
Browser → Vercel Edge → /api/agent/v1/license/validate
                      ↓  (server-side rewrite)
                Fly.io: souhimbou-ai.fly.dev/v1/license/validate
```

---

## 5. Cloudflare Worker — Telemetry

### 5.1 Deploy Worker

```bash
cd workers/mcp-server   # or wherever wrangler.toml lives
wrangler deploy
```

This binds the D1 database `adinkhepra-telemetry` and sets the custom domain
`telemetry.souhimbou.org`.

### 5.2 Rate Limiting

`wrangler.toml` caps at **100 beacons/hour per client** and **10 KB max beacon
size**. These defaults are reasonable for MVP. Tune them post-launch based on
actual telemetry volume.

### 5.3 Signature Verification

The worker verifies each beacon with the Dilithium3 public key stored in
`wrangler.toml`. Ensure the corresponding private key is available only to the
ASAF agent on Fly.io — never commit it, never set it as a Vercel env var.

---

## 6. Auth & MFA Enforcement

### 6.1 Close the Dev Bypass — CRITICAL

`src/contexts/AuthProvider.tsx` contains an offline dev bypass that accepts any
credentials when `VITE_ASAF_DEV=1` or `import.meta.env.DEV` is truthy.

**Action required** — add an explicit production guard so the check cannot fire
even if the env var leaks:

```tsx
// src/contexts/AuthProvider.tsx — replace the dev bypass block
if (
  (import.meta.env.VITE_ASAF_DEV === '1' || import.meta.env.DEV) &&
  import.meta.env.PROD !== true   // belt-and-suspenders: Next.js sets this
) {
  // dev bypass — only runs when explicitly opted in, never in production build
  …
}
```

Next.js sets `process.env.NODE_ENV=production` during `npm run build`, which
causes `import.meta.env.DEV` to be `false` at build time. The guard above adds
an extra layer in case the flag is passed via a custom env var.

### 6.2 TOTP / MFA Layer

The current auth flow is **license-key only** (single factor). For an MVP
targeting enterprise / compliance users, add TOTP as a second factor before the
session is established. Recommended implementation:

#### Backend (Go — `/pkg/auth/`)

Add a TOTP module using `github.com/pquerna/otp/totp`:

```go
// pkg/auth/totp.go
package auth

import (
    "github.com/pquerna/otp/totp"
    "time"
)

// GenerateTOTPSecret issues a new TOTP secret for a user.
// Store the secret encrypted in D1 or the agent's local store.
func GenerateTOTPSecret(issuer, accountName string) (*otp.Key, error) {
    return totp.Generate(totp.GenerateOpts{
        Issuer:      issuer,
        AccountName: accountName,
        Period:      30,
        Digits:      otp.DigitsSix,
        Algorithm:   otp.AlgorithmSHA256,
    })
}

// ValidateTOTP returns true if the user-supplied code is valid.
func ValidateTOTP(secret, code string) bool {
    return totp.Validate(code, secret)
}
```

Add a `/api/v1/mfa/enroll` and `/api/v1/mfa/verify` endpoint to the ASAF agent
(`cmd/agent/`). The license validate endpoint should return an intermediate state
(`mfa_required: true`) when MFA is enrolled, and the frontend must complete the
second-factor challenge before receiving a signed session token.

#### Frontend — MFA Challenge Screen

Add a `MFAChallenge` step between license validation and session creation in
`AuthProvider.signIn`:

```tsx
// src/contexts/AuthProvider.tsx — after the resp.ok block
if (resp.ok) {
  const claims = await resp.json();
  if (claims.mfa_required) {
    // Surface the MFA input — do NOT call handleValidLicense yet
    return { error: null, mfa_required: true, partial_token: claims.partial_token };
  }
  return handleValidLicense(rawKey, email, claims);
}
```

Create `src/components/auth/MFAChallenge.tsx`:

```tsx
import { useState } from 'react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Button } from '@/components/ui/button';

interface Props {
  partialToken: string;
  onSuccess: (claims: unknown) => void;
  onCancel: () => void;
}

export function MFAChallenge({ partialToken, onSuccess, onCancel }: Props) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const verify = async () => {
    setLoading(true);
    setError('');
    const resp = await fetch('/api/agent/v1/mfa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partial_token: partialToken, code }),
    });
    setLoading(false);
    if (resp.ok) {
      onSuccess(await resp.json());
    } else {
      setCode('');
      setError('Invalid code. Try again.');
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 p-8">
      <h2 className="text-xl font-semibold text-white">Two-Factor Authentication</h2>
      <p className="text-sm text-zinc-400 text-center max-w-xs">
        Enter the 6-digit code from your authenticator app.
      </p>
      <InputOTP maxLength={6} value={code} onChange={setCode}>
        <InputOTPGroup>
          {[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} />)}
        </InputOTPGroup>
      </InputOTP>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button onClick={verify} disabled={code.length < 6 || loading}>
          {loading ? 'Verifying…' : 'Verify'}
        </Button>
      </div>
    </div>
  );
}
```

The existing `input-otp` (v1.2.4) and `InputOTPSlot` primitives in
`src/components/ui/input-otp.tsx` are already in the codebase — no new
dependencies needed.

### 6.3 Session Security

| Concern | Current State | Required Action |
|---------|--------------|-----------------|
| Token storage | `localStorage` (plaintext license key) | Acceptable for MVP; for v1.1 migrate to `httpOnly` cookie via server-side session |
| Token expiry | No expiry enforced client-side | Add `expires_at` to the stored profile; force re-auth if expired |
| Logout on idle | Not implemented | Add an `InactivityTimer` hook (10-min idle) for compliance dashboards |
| Key derivation for ID | `btoa(email + key).slice(0,36)` | Replace with `crypto.subtle.digest('SHA-256', …)` — btoa is not a hash |

### 6.4 Protected Route Enforcement

Verify that every sensitive path listed in React Router is wrapped in
`<ProtectedRoute>`. Paths that **must** be protected:

```
/dashboard, /compliance, /onboarding, /billing,
/master-admin, /command-center, /enterprise/*,
/threat-hunting, /global-intel, /asset-scanning,
/stig-dashboard, /compliance-reports
```

Search for any route missing the guard:
```bash
grep -r 'path="/' src/App.tsx | grep -v 'ProtectedRoute\|Public\|/auth\|/blog\|/vdp\|/hall'
```

All unguarded private routes must be wrapped before go-live.

---

## 7. UI/UX Production Hardening

### 7.1 Loading State (Splash Screen)

Fix the blank-on-load issue (§3.3). The branded loading state ensures users see
a responsive interface instead of a white screen during JS hydration.

### 7.2 Error Boundaries

Add a top-level error boundary so a crash in one dashboard doesn't blank the
whole app:

```tsx
// src/components/ui/ErrorBoundary.tsx
import { Component, ReactNode } from 'react';

interface State { hasError: boolean; message: string }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(e: Error): State {
    return { hasError: true, message: e.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center text-white bg-[#0a0a0a]">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold">Something went wrong</h1>
            <p className="text-zinc-400 text-sm max-w-sm">{this.state.message}</p>
            <button
              className="px-4 py-2 bg-primary rounded text-sm"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
```

Wrap in `src/App.tsx`:
```tsx
<ErrorBoundary>
  <RouterProvider … />
</ErrorBoundary>
```

### 7.3 Toast Notifications for Auth Events

Use the existing `sonner` (v1.5.0) instance to surface auth events:

```tsx
import { toast } from 'sonner';

// In AuthProvider.signIn — after successful auth
toast.success('Signed in successfully');

// On error
toast.error(error.message, { duration: 6000 });

// On signOut
toast.info('Session ended');
```

Add `<Toaster position="top-right" richColors />` to the root layout if not
already present.

### 7.4 Accessibility (a11y) Minimums for MVP

- All interactive elements must have visible focus rings (Tailwind `focus-visible:ring-2`)
- Auth form inputs need `aria-label` or associated `<label>` elements
- Color-only state indicators (red = error) must have text/icon fallback
- Keyboard navigation through the MFA OTP slots must work (the Radix `InputOTP`
  primitive handles this automatically)

### 7.5 Mobile Responsiveness

The SCADA HMI page (`src/app/hmi/page.tsx`) is hardcoded to 800×480 for kiosk
use — this is intentional. All other pages must be responsive:

```bash
# Quick audit — find components with fixed pixel widths that could break mobile
grep -r 'w-\[[0-9]' src/components --include='*.tsx' | grep -v hmi | grep -v 'w-\[1\|w-\[2\|w-\[3\|w-\[4'
```

Fix any dashboard that breaks at <768 px viewport width before launch.

### 7.6 Onboarding Flow

The `/onboarding` route should:
1. Verify license key is valid (redirect to `/auth` if not)
2. Guide the user through MFA enrollment (§6.2) if MFA is enforced for their tier
3. Collect organization/tenant info (pre-filled from license claims)
4. Trigger the initial security scan via `/api/scan`

Ensure the onboarding wizard does not allow skipping MFA enrollment for
`enterprise` and `compliance` tier users.

---

## 8. Security Headers & CSP

`vercel.json` already sets X-Frame-Options, HSTS, XSS-Protection, and
Referrer-Policy. Add a **Content Security Policy** header — this is the most
impactful missing header for XSS prevention:

```json
// vercel.json — add inside the headers array
{
  "key": "Content-Security-Policy",
  "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://souhimbou-ai.fly.dev https://telemetry.souhimbou.org https://api.stripe.com wss:; frame-src https://js.stripe.com; font-src 'self' data:; object-src 'none'; base-uri 'self';"
}
```

> `'unsafe-inline'` and `'unsafe-eval'` are required by the current React
> bundler output. For v1.1, migrate to nonce-based CSP by switching to the
> Next.js middleware CSP approach.

Also add:
```json
{ "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
{ "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" }
```

---

## 9. Stripe Billing Integration

### 9.1 Checkout Flow

`src/app/api/checkout/route.ts` creates a Stripe Checkout session. Verify:

- `success_url` and `cancel_url` use `NEXT_PUBLIC_APP_URL` (already in env)
- `mode: 'subscription'` matches the `STRIPE_PRICE_ID` (recurring $99/mo)
- Customer email is pre-filled from the license key claims if available

### 9.2 Webhook Handler

Create `src/app/api/checkout/webhook/route.ts` to handle `checkout.session.completed`
and `customer.subscription.deleted` events. On completion, the webhook must:

1. Generate a license key in the ASAF format (`ASAF-XXXX-XXXX-XXXX-XXXX`)
2. POST to the ASAF agent to register the key
3. Send the license key to the customer email (via Resend / SendGrid)

```typescript
// src/app/api/checkout/webhook/route.ts
import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.CheckoutSession;
    await provisionLicense(session.customer_email!, session.id);
  }

  return NextResponse.json({ received: true });
}

async function provisionLicense(email: string, sessionId: string) {
  const key = generateLicenseKey(sessionId);
  await fetch(`${process.env.NEXT_PUBLIC_ASAF_API_URL}/api/v1/license/provision`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': process.env.ASAF_API_KEY!,
    },
    body: JSON.stringify({ email, license_key: key, tier: 'pro' }),
  });
  // TODO: send email with key via Resend/SendGrid
}

function generateLicenseKey(seed: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `ASAF-${seg()}-${seg()}-${seg()}-${seg()}`;
}
```

### 9.3 Register Webhook in Stripe Dashboard

```
Endpoint URL: https://adinkhepra.com/api/checkout/webhook
Events: checkout.session.completed, customer.subscription.deleted
```

---

## 10. Post-deployment Smoke Tests

Run these manually after every deployment before announcing availability.

### Frontend
```
[ ] / (homepage) loads without console errors
[ ] /auth renders the license-key login form
[ ] Valid ASAF license key → successful login → redirected to /dashboard
[ ] Invalid license key → error message displayed (no crash)
[ ] /auth → sign out → redirect to /
[ ] /dashboard without session → redirect to /auth (ProtectedRoute works)
[ ] /billing → Stripe checkout session opens in new tab
[ ] All navigation links resolve (no 404s in React Router)
[ ] No CORS errors in browser console for /api/agent/* calls
```

### Auth & MFA
```
[ ] Dev bypass is NOT active in production (try email=test@test.com, password=dev → rejected)
[ ] ASAF_ALLOW_EVAL_WITHOUT_LICENSE=false → eval users cannot access paid features
[ ] MFA enrollment flow completes (if implemented)
[ ] MFA code rejected for wrong input, accepted for correct TOTP
```

### Stripe
```
[ ] Stripe test card 4242 4242 4242 4242 completes checkout (staging only)
[ ] Webhook delivers to /api/checkout/webhook (check Stripe dashboard → Webhooks → logs)
[ ] License key received via email after purchase
```

### Security Headers
```bash
# Verify headers on production domain
curl -sI https://adinkhepra.com | grep -E 'strict-transport|x-frame|content-security|referrer'
```

---

## 11. Rollback Procedure

### Vercel (Frontend)
```bash
# List recent deployments
vercel ls

# Promote a previous deployment to production instantly
vercel promote <deployment-url>
```

### Fly.io (Backend)
```bash
# List releases
fly releases --app souhimbou-ai

# Roll back to previous release
fly deploy --image <previous-image-ref> --app souhimbou-ai
# or
fly scale release <version> --app souhimbou-ai
```

### Cloudflare Worker
```bash
# List worker versions
wrangler deployments list

# Roll back
wrangler rollback <deployment-id>
```

---

## Appendix A — Auth Architecture Diagram

```
Browser
  │
  ├─► POST /api/agent/v1/license/validate   (proxied through Next.js → Fly.io)
  │       │
  │       ├─ License valid + no MFA  →  return { claims }
  │       ├─ License valid + MFA enrolled  →  return { mfa_required, partial_token }
  │       └─ License invalid  →  401
  │
  ├─► POST /api/agent/v1/mfa/verify   (if mfa_required)
  │       │
  │       ├─ TOTP valid  →  return { claims, access_token }
  │       └─ TOTP invalid  →  401
  │
  └─► Session stored in localStorage { license_key, user_profile }
        │
        └─► AuthContext → ProtectedRoute → Dashboard
```

## Appendix B — Dependency Versions (Pinned for MVP)

| Package | Version | Notes |
|---------|---------|-------|
| next | 16.1.5 | App Router + standalone output |
| react | 18.3.1 | |
| @radix-ui/react-* | various | UI primitives |
| input-otp | 1.2.4 | MFA code input — already installed |
| framer-motion | 12.29.0 | Page transitions |
| sonner | 1.5.0 | Toast notifications |
| zod | 3.23.8 | Form validation |
| stripe | latest server | Install if not present: `npm install stripe` |
| pquerna/otp | go — add | TOTP for Go backend |

---

*Document prepared for Manus AI deployment of Giza Cyber Shield MVP.*
*Last updated: 2026-05-11.*
