# Unified Onboarding Workflow Architecture

**Version:** 1.0
**Date:** 2026-01-28
**Status:** PRODUCTION

---

## Executive Summary

The Unified Onboarding Workflow provides three paths for users to engage with the SouHimBou.AI STIG compliance platform:

1. **STIG Configuration Setup** - Full environment connection and compliance scanning
2. **Quick Platform Tour** - Demo mode with sample data (no auth required)
3. **Compliance Dashboard** - Direct access for users with existing compliance data

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SOUHIMBOU.AI (The Son)                            │
│                    Public-Facing Compliance Platform                        │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    UNIFIED ONBOARDING (/onboarding)                  │   │
│  │                                                                       │   │
│  │   ┌─────────────┐   ┌─────────────┐   ┌─────────────────────┐       │   │
│  │   │   STIG      │   │   Quick     │   │   Compliance        │       │   │
│  │   │   Config    │   │   Platform  │   │   Dashboard         │       │   │
│  │   │   Setup     │   │   Tour      │   │                     │       │   │
│  │   │             │   │             │   │                     │       │   │
│  │   │ Ra (Std)+   │   │ No Auth     │   │ Any Sub + Data      │       │   │
│  │   └──────┬──────┘   └──────┬──────┘   └──────────┬──────────┘       │   │
│  │          │                 │                      │                  │   │
│  │          ▼                 ▼                      ▼                  │   │
│  │   /enterprise-setup  /demo-tour            /dashboard               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                          │                                                  │
│                          │ API Calls                                       │
│                          ▼                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    MOTHERBOARD API SERVER                            │   │
│  │                    (Go Backend - Fly.dev)                            │   │
│  │                                                                       │   │
│  │   POST /api/v1/cc/discover    - Environment Discovery                │   │
│  │   POST /api/v1/cc/assess      - STIG Compliance Assessment           │   │
│  │   POST /api/v1/cc/prove/attest - Attestation/Proof Generation        │   │
│  │   WS   /ws/scans              - Real-time Scan Updates               │   │
│  │   POST /api/v1/cc/rollback/*  - Snapshot & Rollback                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Integration (localhost:45444)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         KHEPRA PROTOCOL (The Father)                        │
│                    Shadow Sentinel / Integrity Engine                       │
│                                                                             │
│   GET  /healthz           - Check if Father is watching                     │
│   POST /dag/add           - Log immutable event (Audit Trail)               │
│   POST /adinkra/weave     - PQC Encrypt/Obfuscate data                      │
│   POST /adinkra/unweave   - PQC Decrypt data                                │
│   POST /attest/verify     - Verify system integrity                         │
│                                                                             │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│   │ Immutable DAG   │  │ FIM (File       │  │ PQC Crypto      │            │
│   │ Audit Trail     │  │ Integrity)      │  │ ML-DSA/Kyber    │            │
│   └─────────────────┘  └─────────────────┘  └─────────────────┘            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Onboarding Paths

### Path 1: STIG Configuration Setup (`/onboarding/enterprise-setup`)

**Gate Type:** Hard Gate
**Required Tier:** Standard (Ra) or higher
**Authentication:** Required

**Flow:**
```
User → ExperienceSelector → SubscriptionGate Check
                                    │
                        ┌───────────┴───────────┐
                        │                       │
                   Has Ra+              Missing Ra+
                        │                       │
                        ▼                       ▼
                 EnterpriseSetup         Stripe Checkout
                        │                       │
                        ▼                       │
                 1. Connect                     │
                 2. Discover ───────────────────┘
                 3. Assess
                 4. Complete
```

**Backend Connections:**
- **Stripe/Billing:** Subscription gate verification
- **Motherboard API:** Discovery, Assessment, Attestation
- **Telemetry Server:** License validation, feature enforcement
- **Supabase:** `organization_onboarding`, `environment_discoveries` tables

**Component:** `src/views/EnterpriseSetup.tsx`

---

### Path 2: Quick Platform Tour (`/demo-tour`)

**Gate Type:** No Gate
**Required Tier:** None (accessible to all users including anonymous)
**Authentication:** Not required

**Flow:**
```
User → ExperienceSelector → DemoTour (immediate access)
```

**Features:**
- Interactive demo with sample STIG data
- No backend API calls required
- CTAs guide users to upgrade/start trial
- Shows platform capabilities without real data

**Component:** `src/views/DemoTour.tsx`

---

### Path 3: Compliance Dashboard (`/dashboard?mode=executive`)

**Gate Type:** Soft Gate
**Required Tier:** Any active subscription + existing compliance data
**Authentication:** Required

**Flow:**
```
User → ExperienceSelector → Auth Check → Subscription Check
                                              │
                        ┌─────────────────────┴─────────────────────┐
                        │                                           │
                   Has Sub + Data                          Missing Sub/Data
                        │                                           │
                        ▼                                           ▼
                   Dashboard                              Redirect to:
                                                          - Stripe Checkout (no sub)
                                                          - Enterprise Setup (no data)
```

**Requirements:**
- Active subscription (Basic or higher)
- Existing compliance data from prior STIG setup
- Redirects to Enterprise Setup if no data exists

---

## Subscription Tiers (Egyptian Naming)

| Stripe Plan | Egyptian Name | Level | Features |
|-------------|---------------|-------|----------|
| Basic | Khepri (Scout) | 1 | Dashboard access, limited scans |
| Standard | Ra (Hunter) | 2 | Full STIG scanning, 3 nodes, AI verification |
| Premium | Atum (Hive) | 3 | 10 nodes, deep scan, remediation |
| Enterprise | Osiris (Pharaoh) | 4 | Unlimited, air-gapped, custom STIGs |

---

## Component Architecture

### ExperienceSelector (`src/components/onboarding/ExperienceSelector.tsx`)

Entry point for unified onboarding. Handles:
- Path selection UI with feature cards
- Subscription tier checking via `useSubscription()` hook
- Navigation to appropriate destination
- Existing compliance data checking

### SubscriptionGate (`src/components/onboarding/SubscriptionGate.tsx`)

Wrapper component for tier-based access control:
- Checks user's subscription tier against requirements
- Shows upgrade prompt with tier benefits
- Integrates with Stripe checkout for upgrades

### EnterpriseSetup (`src/views/EnterpriseSetup.tsx`)

Multi-step setup wizard:
1. **Connect:** Configure cloud provider and target platform
2. **Discover:** Scan environment for endpoints
3. **Assess:** Run STIG compliance assessment
4. **Complete:** Show results and navigate to dashboard

### DemoTour (`src/views/DemoTour.tsx`)

Public demo page:
- Sample STIG compliance data
- Interactive tabs (Overview, Search, Drift, Baselines)
- CTA sections for signup

---

## API Integration

### MotherboardAPIClient (`src/services/MotherboardAPIClient.ts`)

Primary API client for backend services:

```typescript
// Initialize client
const client = getMotherboardClient();
client.setApiKey(machineId);

// Discovery
const discovery = await client.discover({
  mode: 'auto',
  profile: 'linux',
  cloud_provider: 'aws'
});

// Assessment
const assessment = await client.assess({
  framework: 'STIG',
  endpoint_ids: ['endpoint-1', 'endpoint-2'],
  deep_scan: true
});

// Real-time updates
const cleanup = client.connectToScanUpdates(scanId, (event) => {
  if (event.type === 'progress') {
    updateProgress(event.data.progress);
  }
});

// Attestation
const attestation = await client.createAttestation({
  scan_id: assessment.scan_id,
  organization_id: orgId,
  attester_id: userId,
  attestation_type: 'compliance_scan',
  evidence_hashes: hashes
});
```

---

## Supabase Tables

### organization_onboarding

Tracks onboarding progress:

```sql
CREATE TABLE organization_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  step TEXT NOT NULL DEFAULT 'started',
  discovery_data JSONB,
  assessment_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);
```

### environment_discoveries

Stores discovered endpoints:

```sql
CREATE TABLE environment_discoveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  discovery_id TEXT NOT NULL,
  endpoints JSONB NOT NULL,
  summary JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Stripe Integration

### Checkout Flow

```typescript
// In useSubscription hook
const createCheckout = async (tier: 'basic' | 'standard' | 'premium') => {
  const { data } = await supabase.functions.invoke('create-checkout', {
    body: { tier }
  });
  window.location.href = data.url;
};
```

### Webhook Handling

On `checkout.session.completed`:
1. Update `subscribers` table
2. Provision license via telemetry server
3. Enable tier-specific features

---

## Integration with Khepra Protocol

When the Khepra Agent (Father) is running locally on `localhost:45444`:

### Heartbeat Integration

```typescript
// SouHimBou "confesses" to Khepra on startup
await fetch('http://127.0.0.1:45444/dag/add', {
  method: 'POST',
  body: JSON.stringify({
    action: 'boot',
    symbol: 'SouHimBou-Core'
  })
});

// Every 30 seconds
setInterval(async () => {
  await fetch('http://127.0.0.1:45444/healthz');
}, 30000);
```

### PQC Data Weaving

Sensitive compliance data can be encrypted via Khepra:

```typescript
// Before saving to Supabase
const woven = await fetch('http://127.0.0.1:45444/adinkra/weave', {
  method: 'POST',
  body: JSON.stringify({ data: sensitiveFindings })
});

// Save only the woven (encrypted) data
await supabase.from('findings').insert({ data: woven.x_khepra_weave });
```

---

## File Structure

```
deploy-vercel/src/
├── views/
│   ├── Onboarding.tsx          # Entry point (renders OnboardingOrchestrator)
│   ├── EnterpriseSetup.tsx     # STIG Configuration Setup flow
│   └── DemoTour.tsx            # Public demo/tour page
│
├── components/onboarding/
│   ├── OnboardingOrchestrator.tsx  # Orchestrates path selection
│   ├── ExperienceSelector.tsx      # Path selection UI
│   └── SubscriptionGate.tsx        # Tier-based gating
│
├── services/
│   └── MotherboardAPIClient.ts     # Backend API client
│
└── hooks/
    ├── useSubscription.tsx         # Subscription state & checkout
    └── useAuth.tsx                 # Authentication state
```

---

## Routes

| Path | Component | Auth | Gate |
|------|-----------|------|------|
| `/onboarding` | Onboarding → ExperienceSelector | No | None |
| `/onboarding/enterprise-setup` | EnterpriseSetup | Yes | Standard+ |
| `/demo-tour` | DemoTour | No | None |
| `/dashboard` | STIGDashboard | Yes | Any Sub |

---

## Security Considerations

1. **Subscription Gate:** Enforced both client-side (UX) and server-side (API)
2. **API Authentication:** Bearer tokens with machine_id from license manager
3. **Data Protection:** Sensitive data woven through Khepra PQC (when available)
4. **Audit Trail:** All onboarding events logged to DAG via Khepra

---

## Future Enhancements

1. **Phase 2:** AWS Cognito GovCloud integration for federal customers
2. **Phase 3:** Azure AD integration for enterprise SSO
3. **Phase 4:** SAML 2.0 support for custom identity providers

---

**Document Maintained By:** Khepra Protocol Core Team
**Last Updated:** 2026-01-28
