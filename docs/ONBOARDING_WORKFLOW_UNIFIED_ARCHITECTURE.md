# Unified Onboarding Workflow Architecture

## Overview

This document defines the unified architecture for the "Choose Your Experience" onboarding workflow at `https://souhimbou.ai/onboarding`, integrating:
- **Billing/Stripe** - Subscription verification and payment processing
- **Motherboard API Server** - Backend compliance services
- **Telemetry Server** - License validation and usage tracking
- **License Verification/Enforcement** - Tier-based feature gating

---

## Onboarding Paths Analysis

### Path 1: STIG Configuration Setup (`enterprise-setup`)
**What it connects to:**
| Service | Purpose | Endpoint |
|---------|---------|----------|
| **Stripe/Billing** | Verify subscription tier (Ra/Atum/Osiris required) | `check-subscription` |
| **Motherboard API** | Environment discovery, STIG scanning | `/api/v1/cc/discover`, `/api/v1/cc/assess` |
| **Telemetry Server** | License heartbeat, node registration | `/license/validate`, `/license/heartbeat` |
| **License Manager** | Feature gating (deep_scan, remediation) | `HasFeature()` check |

**Answer:** This is the **full enterprise setup** - requires paid subscription and connects to all backend services.

---

### Path 2: Quick Platform Tour (`quick-tour`)
**What it connects to:**
| Service | Purpose | Endpoint |
|---------|---------|----------|
| **Stripe/Billing** | Optional - allows trial/free tier | `check-subscription` (soft check) |
| **Motherboard API** | Demo mode with sample data | None (frontend-only) |
| **Telemetry Server** | Anonymous usage tracking | Optional |

**Answer:** Yes, this is **demo mode**. It shows sample STIG configurations and compliance data without requiring backend connections. Ideal for prospects evaluating the platform.

---

### Path 3: Compliance Dashboard (`executive-summary`)
**What it connects to:**
| Service | Purpose | Endpoint |
|---------|---------|----------|
| **Stripe/Billing** | Verify active subscription | `check-subscription` |
| **Motherboard API** | Fetch existing compliance data | `/api/v1/cc/prove/verify` |
| **Supabase** | Organization data, compliance reports | `organization_onboarding` table |

**Answer:** Yes, this is **direct dashboard access** for users who have already completed setup or have existing compliance data.

---

## Unified Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ONBOARDING ENTRY POINT                               │
│                    https://souhimbou.ai/onboarding                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    STEP 1: AUTHENTICATION CHECK                              │
│                                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────────────┐  │
│  │ Logged In?  │───▶│    YES      │───▶│ Continue to Subscription Check  │  │
│  └─────────────┘    └─────────────┘    └─────────────────────────────────┘  │
│         │                                                                    │
│         ▼                                                                    │
│  ┌─────────────┐    ┌─────────────────────────────────────────────────────┐ │
│  │     NO      │───▶│ Redirect to /login?redirect=/onboarding             │ │
│  └─────────────┘    │ OR allow Quick Tour without auth                    │ │
│                     └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 STEP 2: SUBSCRIPTION STATUS CHECK                            │
│                                                                              │
│  Call: supabase.functions.invoke('check-subscription')                       │
│                                                                              │
│  Response:                                                                   │
│  {                                                                           │
│    subscribed: boolean,                                                      │
│    subscription_tier: "Basic" | "Standard" | "Premium" | null,               │
│    subscription_end: ISO timestamp                                           │
│  }                                                                           │
│                                                                              │
│  Tier Mapping to Egyptian Tiers:                                             │
│  ┌────────────────┬─────────────────┬──────────────────────────────────────┐│
│  │ Stripe Tier    │ Egyptian Tier   │ Available Paths                      ││
│  ├────────────────┼─────────────────┼──────────────────────────────────────┤│
│  │ null (no sub)  │ Trial           │ Quick Tour only                      ││
│  │ Basic ($99)    │ Khepri (Scout)  │ Quick Tour, Limited Dashboard        ││
│  │ Standard ($199)│ Ra (Hunter)     │ All paths, basic scanning            ││
│  │ Premium ($299) │ Atum (Hive)     │ All paths, full features             ││
│  │ Enterprise     │ Osiris (Pharaoh)│ All paths, air-gapped support        ││
│  └────────────────┴─────────────────┴──────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    STEP 3: EXPERIENCE SELECTOR                               │
│                    "Choose Your Experience"                                  │
│                                                                              │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌───────────────────┐  │
│  │  STIG Configuration  │  │  Quick Platform Tour │  │ Compliance        │  │
│  │       Setup          │  │                      │  │    Dashboard      │  │
│  │                      │  │                      │  │                   │  │
│  │  🔒 Ra+ Required     │  │  ✅ All Tiers        │  │  🔒 Basic+        │  │
│  │  Duration: 10-15 min │  │  Duration: 5-10 min  │  │  Immediate        │  │
│  └──────────────────────┘  └──────────────────────┘  └───────────────────┘  │
│           │                         │                         │             │
│           ▼                         ▼                         ▼             │
│    [Gate Check]              [No Gate]                 [Gate Check]         │
│           │                         │                         │             │
└───────────┼─────────────────────────┼─────────────────────────┼─────────────┘
            │                         │                         │
            ▼                         ▼                         ▼
┌───────────────────────┐  ┌───────────────────────┐  ┌───────────────────────┐
│ STIG CONFIGURATION    │  │ QUICK PLATFORM TOUR   │  │ COMPLIANCE DASHBOARD  │
│ SETUP PATH            │  │ PATH                  │  │ PATH                  │
└───────────────────────┘  └───────────────────────┘  └───────────────────────┘
```

---

## Path-Specific Flow Details

### Path 1: STIG Configuration Setup Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    STIG CONFIGURATION SETUP FLOW                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
            ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐
            │ Subscription│ │   License   │ │ Motherboard API │
            │   Check     │ │ Validation  │ │   Connection    │
            └─────────────┘ └─────────────┘ └─────────────────┘
                    │               │               │
                    ▼               ▼               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  GATE: Subscription Required (Ra/Atum/Osiris)                                │
│                                                                              │
│  if (!subscribed || tier === 'Basic') {                                      │
│    // Show upgrade modal with Stripe checkout                                │
│    createCheckout('Standard') → Stripe redirect                              │
│  }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ (Subscription verified)
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PHASE 1: AUTO-DISCOVERY                                   │
│                                                                              │
│  Frontend Services:                                                          │
│  - EnvironmentAutoDiscovery.detect()                                         │
│  - CloudProviderDetector.detect()                                            │
│                                                                              │
│  Supabase Edge Function:                                                     │
│  - POST /functions/v1/environment-discovery                                  │
│                                                                              │
│  Motherboard API (if connected):                                             │
│  - POST /api/v1/cc/discover                                                  │
│    Body: { mode: "auto", profile: "linux|windows" }                          │
│                                                                              │
│  Telemetry Server:                                                           │
│  - POST /license/heartbeat (register node discovery)                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PHASE 2: ONE-CLICK CONNECTION                             │
│                                                                              │
│  Cloud Provider Integration:                                                 │
│  - AWS: IAM role assumption, STS credentials                                 │
│  - Azure: Service principal authentication                                   │
│  - GCP: Service account key                                                  │
│                                                                              │
│  Motherboard API:                                                            │
│  - POST /api/v1/cc/discover/endpoints                                        │
│    Registers discovered cloud resources                                      │
│                                                                              │
│  License Check:                                                              │
│  - Verify node quota not exceeded                                            │
│  - licMgr.HasFeature("multi-cloud") for multi-provider                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PHASE 3: AGENT DEPLOYMENT                                 │
│                                                                              │
│  Deployment Options:                                                         │
│  - OpenSCAP agent (STIG scanning)                                            │
│  - Ansible playbooks (remediation)                                           │
│  - Khepra agent (unified collector)                                          │
│                                                                              │
│  Motherboard API:                                                            │
│  - WebSocket /ws/scans (deployment progress)                                 │
│  - POST /api/v1/cc/rollback/snapshot (pre-deployment state)                  │
│                                                                              │
│  License Enforcement:                                                        │
│  - TierKhepri: 1 node max                                                    │
│  - TierRa: 3 nodes max                                                       │
│  - TierAtum: 10 nodes max                                                    │
│  - TierOsiris: unlimited                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PHASE 4: INSTANT SCAN                                     │
│                                                                              │
│  Deep Asset Scan Service:                                                    │
│  - DeepAssetScanService.startScan()                                          │
│                                                                              │
│  Motherboard API:                                                            │
│  - POST /api/v1/cc/assess                                                    │
│    Body: {                                                                   │
│      framework: "STIG",                                                      │
│      endpoint_ids: ["ep_..."],                                               │
│      deep_scan: true  // Requires Ra+ tier                                   │
│    }                                                                         │
│                                                                              │
│  - GET /api/v1/cc/assess/status?scan_id={id}                                 │
│    Poll for scan completion                                                  │
│                                                                              │
│  - WebSocket /ws/scans                                                       │
│    Real-time scan progress updates                                           │
│                                                                              │
│  Usage Billing:                                                              │
│  - trackUsage({ resource_type: 'compliance_scans', quantity: 1 })            │
│  - $1.00 per scan (Merkaba Earth revenue)                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    COMPLETION: ATTESTATION & REDIRECT                        │
│                                                                              │
│  Motherboard API:                                                            │
│  - POST /api/v1/cc/prove/attest                                              │
│    Creates ML-DSA-65 signed attestation of onboarding                        │
│                                                                              │
│  Navigation:                                                                 │
│  - navigate('/dashboard?onboarding=complete&source=enterprise-setup')        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Path 2: Quick Platform Tour Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    QUICK PLATFORM TOUR FLOW                                  │
│                    (Demo Mode - No Backend Required)                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  GATE: None (Available to all users, including unauthenticated)              │
│                                                                              │
│  Optional Soft Check:                                                        │
│  - Track anonymous usage for conversion metrics                              │
│  - Show "Upgrade" prompts at key moments                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DEMO DATA LOADING                                         │
│                                                                              │
│  Sample Data Includes:                                                       │
│  - Sample STIG configurations (RHEL 8, Windows Server 2019)                  │
│  - Mock compliance scores (CAT I: 95%, CAT II: 87%, CAT III: 92%)           │
│  - Demo drift detection alerts                                               │
│  - Sample CMMC control mappings                                              │
│                                                                              │
│  Source: Static JSON or localStorage cache                                   │
│  No API calls to Motherboard API                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GUIDED TOUR STEPS                                         │
│                                                                              │
│  Step 1: Security Dashboard Overview                                         │
│  - Highlights key metrics and visualizations                                 │
│  - [CTA: "See your real data - Start Free Trial"]                           │
│                                                                              │
│  Step 2: STIG Compliance View                                                │
│  - Shows sample findings with severity breakdown                             │
│  - [CTA: "Scan your infrastructure - Upgrade to Ra"]                        │
│                                                                              │
│  Step 3: Drift Detection Demo                                                │
│  - Animated simulation of configuration drift                                │
│  - [CTA: "Monitor your systems - Start Enterprise Setup"]                   │
│                                                                              │
│  Step 4: CMMC Readiness                                                      │
│  - Sample CMMC Level 2 assessment                                            │
│  - [CTA: "Get certified - Talk to Sales"]                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TOUR COMPLETION                                           │
│                                                                              │
│  Options:                                                                    │
│  1. Start Free Trial → /signup?plan=trial                                   │
│  2. Enterprise Setup → /onboarding?path=enterprise-setup                    │
│  3. Contact Sales → /contact?source=tour                                    │
│  4. Explore Dashboard → /dashboard?tour=true (continues demo mode)          │
│                                                                              │
│  Telemetry (Anonymous):                                                      │
│  - Track tour completion rate                                                │
│  - Track CTA click-through rates                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Path 3: Compliance Dashboard Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    COMPLIANCE DASHBOARD FLOW                                 │
│                    (Direct Access for Existing Users)                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  GATE: Subscription Check + Existing Data Check                              │
│                                                                              │
│  Checks:                                                                     │
│  1. subscribed === true (any tier)                                           │
│  2. hasExistingComplianceData() → queries organization_onboarding            │
│                                                                              │
│  If no subscription:                                                         │
│  - Show upgrade modal → createCheckout('Basic')                              │
│                                                                              │
│  If no existing data:                                                        │
│  - Redirect to STIG Configuration Setup path                                 │
│  - "You need to complete setup first"                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ (Subscription + Data verified)
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EXECUTIVE DASHBOARD MODE                                  │
│                                                                              │
│  Supabase Queries:                                                           │
│  - SELECT * FROM organization_onboarding WHERE org_id = ?                   │
│  - SELECT * FROM environment_discoveries WHERE org_id = ?                   │
│  - SELECT * FROM discovered_assets WHERE org_id = ?                         │
│                                                                              │
│  Motherboard API (optional, if connected):                                   │
│  - GET /api/v1/cc/prove/verify?id=latest                                    │
│    Fetches latest attestation for compliance proof                           │
│                                                                              │
│  Navigation:                                                                 │
│  - navigate('/dashboard?mode=executive')                                    │
│                                                                              │
│  Dashboard Features:                                                         │
│  - High-level compliance score overview                                      │
│  - CMMC readiness percentage                                                 │
│  - Recent findings summary                                                   │
│  - Trend charts (30/60/90 day)                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Subscription Gate Implementation

### Recommended Implementation

```typescript
// File: deploy-vercel/src/components/onboarding/SubscriptionGate.tsx

interface SubscriptionGateProps {
  requiredTier: 'Basic' | 'Standard' | 'Premium' | 'any';
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function SubscriptionGate({
  requiredTier,
  children,
  fallback
}: SubscriptionGateProps) {
  const { subscribed, subscription_tier, loading } = useSubscription();

  const tierHierarchy = {
    'Basic': 1,
    'Standard': 2,
    'Premium': 3
  };

  if (loading) return <OnboardingLoadingState />;

  const hasAccess = requiredTier === 'any'
    ? subscribed
    : tierHierarchy[subscription_tier] >= tierHierarchy[requiredTier];

  if (!hasAccess) {
    return fallback || (
      <UpgradePrompt
        requiredTier={requiredTier}
        onUpgrade={() => createCheckout(requiredTier)}
      />
    );
  }

  return <>{children}</>;
}
```

### Usage in ExperienceSelector

```typescript
// File: deploy-vercel/src/components/onboarding/ExperienceSelector.tsx

export function ExperienceSelector() {
  const { subscribed, subscription_tier, createCheckout } = useSubscription();
  const { status: licenseStatus } = useLicenseStatus();
  const navigate = useNavigate();

  const handlePathSelection = async (path: string) => {
    switch (path) {
      case 'enterprise-setup':
        // Gate: Requires Standard (Ra) tier or higher
        if (!subscribed || subscription_tier === 'Basic') {
          // Open Stripe checkout for upgrade
          await createCheckout('Standard');
          return;
        }
        // Verify license with telemetry server
        if (licenseStatus !== 'valid') {
          await validateLicense();
        }
        navigate('/onboarding/enterprise-setup');
        break;

      case 'quick-tour':
        // No gate - available to all
        navigate('/dashboard?tour=true');
        break;

      case 'executive-summary':
        // Gate: Requires any subscription + existing data
        if (!subscribed) {
          await createCheckout('Basic');
          return;
        }
        const hasData = await checkExistingComplianceData();
        if (!hasData) {
          toast.info('Complete setup first to access dashboard');
          navigate('/onboarding/enterprise-setup');
          return;
        }
        navigate('/dashboard?mode=executive');
        break;
    }
  };

  return (
    <div className="experience-selector">
      <h2>Choose Your Experience</h2>

      <ExperienceCard
        title="STIG Configuration Setup"
        description="Full enterprise compliance setup with AI-powered verification"
        duration="10-15 minutes"
        badge={subscription_tier !== 'Standard' && subscription_tier !== 'Premium'
          ? "Upgrade Required" : null}
        onClick={() => handlePathSelection('enterprise-setup')}
      />

      <ExperienceCard
        title="Quick Platform Tour"
        description="Interactive demo with sample data"
        duration="5-10 minutes"
        onClick={() => handlePathSelection('quick-tour')}
      />

      <ExperienceCard
        title="Compliance Dashboard"
        description="Direct access to your compliance overview"
        duration="Immediate"
        badge={!subscribed ? "Subscription Required" : null}
        onClick={() => handlePathSelection('executive-summary')}
      />
    </div>
  );
}
```

---

## API Server Integration Points

### Connection Matrix

| Onboarding Step | Motherboard API Endpoint | Auth Required | License Feature |
|-----------------|-------------------------|---------------|-----------------|
| Auto-Discovery | `POST /api/v1/cc/discover` | Bearer Token | `discovery` |
| Cloud Connect | `POST /api/v1/cc/discover/endpoints` | Bearer Token | `multi-cloud` (Ra+) |
| Agent Deploy | WebSocket `/ws/scans` | Bearer Token | `agent-deployment` |
| Pre-scan Snapshot | `POST /api/v1/cc/rollback/snapshot` | Bearer Token | `rollback` (Atum+) |
| STIG Scan | `POST /api/v1/cc/assess` | Bearer Token | `stig-scan` |
| Deep Scan | `POST /api/v1/cc/assess` (deep_scan=true) | Bearer Token | `deep-scan` (Ra+) |
| Attestation | `POST /api/v1/cc/prove/attest` | Bearer Token | `attestation` |
| Export Evidence | `POST /api/v1/cc/prove/export` | Bearer Token | `export` |

### API Client Configuration

```typescript
// File: deploy-vercel/src/services/MotherboardAPIClient.ts

export class MotherboardAPIClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_MOTHERBOARD_API_URL || 'https://api.souhimbou.ai';
  }

  async setApiKey(machineId: string) {
    this.apiKey = machineId;
  }

  async discover(options: DiscoverOptions): Promise<DiscoverResponse> {
    return this.post('/api/v1/cc/discover', options);
  }

  async assess(options: AssessOptions): Promise<AssessResponse> {
    return this.post('/api/v1/cc/assess', options);
  }

  async createAttestation(data: AttestationData): Promise<AttestationResponse> {
    return this.post('/api/v1/cc/prove/attest', data);
  }

  private async post<T>(endpoint: string, body: any): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new APIError(error.message, response.status);
    }

    return response.json();
  }
}
```

---

## Stripe Payment Flow Integration

### Payment Checkpoints

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    STRIPE INTEGRATION CHECKPOINTS                            │
└─────────────────────────────────────────────────────────────────────────────┘

1. ONBOARDING ENTRY (soft check)
   │
   ├─► check-subscription → Get current tier
   │
   └─► Display appropriate paths based on tier

2. ENTERPRISE SETUP GATE (hard check)
   │
   ├─► If tier < Standard → createCheckout('Standard')
   │   │
   │   └─► Stripe Checkout Session
   │       │
   │       └─► On success: stripe-webhook updates subscribers table
   │           │
   │           └─► User redirected back to onboarding with ?session_id=
   │
   └─► Verify subscription before proceeding

3. SCAN USAGE (metered billing)
   │
   ├─► Each scan: trackUsage('compliance_scans', 1)
   │
   └─► Merkaba pricing: $1.00 per scan added to monthly invoice

4. NODE REGISTRATION (quota enforcement)
   │
   ├─► Check node quota: licMgr.GetQuotaRemaining()
   │
   └─► If exceeded: Show upgrade prompt for higher tier
```

### Webhook Handling for Onboarding

```typescript
// Addition to stripe-webhook/index.ts

case 'checkout.session.completed':
  const session = event.data.object;
  const metadata = session.metadata;

  // Handle onboarding-specific subscriptions
  if (metadata.source === 'onboarding') {
    // Update user's onboarding state
    await supabase
      .from('organization_onboarding')
      .update({
        subscription_verified: true,
        subscription_tier: metadata.tier,
        subscription_started_at: new Date().toISOString()
      })
      .eq('user_id', metadata.user_id);

    // Trigger license provisioning
    await supabase.functions.invoke('provision-license', {
      body: {
        user_id: metadata.user_id,
        tier: mapStripeTierToEgyptian(metadata.tier)
      }
    });
  }
  break;
```

---

## Telemetry Server Integration

### License Flow During Onboarding

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TELEMETRY SERVER INTEGRATION                              │
└─────────────────────────────────────────────────────────────────────────────┘

1. SUBSCRIPTION CREATED (via Stripe webhook)
   │
   ▼
2. LICENSE PROVISIONED
   │
   POST /license/enroll
   {
     "enrollment_token": "<from stripe session>",
     "tier": "Ra",
     "organization_id": "org_..."
   }
   │
   ▼
3. LICENSE VALIDATED
   │
   POST /license/validate
   {
     "machine_id": "<unique identifier>",
     "signature": "<ML-DSA-65 signature>"
   }
   │
   Response: { valid: true, tier: "Ra", expires: "2027-01-28" }
   │
   ▼
4. HEARTBEAT STARTED (hourly)
   │
   POST /license/heartbeat
   {
     "machine_id": "<identifier>",
     "node_count": 3,
     "features_used": ["stig-scan", "discovery"]
   }
   │
   ▼
5. FEATURE CHECKS DURING ONBOARDING
   │
   licMgr.HasFeature("deep-scan") → true/false
   licMgr.HasFeature("multi-cloud") → true/false
   licMgr.GetQuotaRemaining("nodes") → 7
```

---

## Complete Unified Flow Summary

### Decision Tree

```
User arrives at /onboarding
        │
        ▼
   ┌─────────────┐
   │ Authenticated? │
   └─────────────┘
        │
   ┌────┴────┐
   │         │
  YES       NO
   │         │
   ▼         ▼
Check      Quick Tour
Subscription   ONLY
   │
   ▼
┌─────────────────┐
│ Has Subscription? │
└─────────────────┘
   │
┌──┴──┐
│     │
YES   NO
│     │
▼     ▼
Show   Show Trial
All    Upgrade CTA
Paths
│
▼
┌──────────────────────────────────────────────────────────┐
│              CHOOSE YOUR EXPERIENCE                       │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────┐ │
│  │ STIG Setup     │  │ Quick Tour     │  │ Dashboard  │ │
│  │                │  │                │  │            │ │
│  │ Ra+ tier       │  │ All tiers      │  │ Any tier   │ │
│  │ required       │  │ (demo mode)    │  │ + data     │ │
│  └───────┬────────┘  └───────┬────────┘  └─────┬──────┘ │
│          │                   │                 │        │
└──────────┼───────────────────┼─────────────────┼────────┘
           │                   │                 │
           ▼                   ▼                 ▼
    ┌─────────────┐     ┌─────────────┐    ┌─────────────┐
    │ Tier Check  │     │ No Check    │    │ Data Check  │
    └─────────────┘     └─────────────┘    └─────────────┘
           │                   │                 │
      ┌────┴────┐              │            ┌────┴────┐
      │         │              │            │         │
   Pass       Fail             │          Pass      Fail
      │         │              │            │         │
      ▼         ▼              ▼            ▼         ▼
   Continue  Stripe         Dashboard    Dashboard  Redirect
   Setup     Checkout       (demo)      (exec)     to Setup
      │         │              │            │
      ▼         │              │            │
┌─────────────────────────────────────────────────────────┐
│                MOTHERBOARD API SERVER                    │
│  • /api/v1/cc/discover                                  │
│  • /api/v1/cc/assess                                    │
│  • /api/v1/cc/prove/attest                              │
│  • WebSocket /ws/scans                                  │
└─────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────┐
│                TELEMETRY SERVER                          │
│  • /license/validate                                     │
│  • /license/heartbeat                                    │
│  • Feature enforcement                                   │
│  • Node quota tracking                                   │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Checklist

### Frontend Changes Required

- [ ] Add `SubscriptionGate` component to wrap experience paths
- [ ] Update `ExperienceSelector` to check subscription before routing
- [ ] Add Stripe checkout redirect handling for upgrade flows
- [ ] Implement `useLicenseStatus` hook for telemetry validation
- [ ] Add loading states during subscription/license verification
- [ ] Create upgrade prompt modal with pricing tiers

### Backend Changes Required

- [ ] Add `/onboarding/verify` endpoint to check all prerequisites
- [ ] Implement license provisioning on Stripe webhook
- [ ] Add onboarding telemetry events to heartbeat
- [ ] Create feature flags for demo mode vs production mode

### Stripe Configuration Required

- [ ] Add `source: 'onboarding'` metadata to checkout sessions
- [ ] Configure webhook for onboarding-specific events
- [ ] Set up products/prices for Ra, Atum, Osiris tiers

### Telemetry Server Changes Required

- [ ] Add `/license/enroll` endpoint for new subscriptions
- [ ] Track onboarding completion as license event
- [ ] Implement feature usage reporting during onboarding

---

## Summary: Answers to Original Questions

### 1. STIG Configuration Setup → What should this connect to?
**Answer:** Connects to ALL services:
- Stripe (subscription gate - Ra+ required)
- Motherboard API (`/api/v1/cc/discover`, `/api/v1/cc/assess`, `/api/v1/cc/prove/*`)
- Telemetry Server (license validation, heartbeat, feature enforcement)
- Supabase (organization_onboarding, environment_discoveries tables)

### 2. Quick Platform Tour → Is this demo mode?
**Answer:** Yes, it's demo mode with sample/mock data. No backend API calls required. Available to all users including unauthenticated visitors.

### 3. Compliance Dashboard → Direct access to dashboard?
**Answer:** Yes, direct access for users who have:
- An active subscription (any tier)
- Existing compliance data from previous setup

### 4. Should each path check subscription status first?
**Answer:** Yes, but with different requirements:
- STIG Setup: Hard gate (Ra/Standard tier minimum)
- Quick Tour: No gate (demo mode)
- Compliance Dashboard: Soft gate (any subscription + existing data)

### 5. Route through Stripe for payment?
**Answer:** Yes, when subscription is insufficient:
- Use `createCheckout()` to redirect to Stripe
- Handle `checkout.session.completed` webhook
- Update `subscribers` table and provision license

### 6. Connect to the Motherboard API server for backend services?
**Answer:** Yes, for STIG Configuration Setup path:
- Discovery: `POST /api/v1/cc/discover`
- Assessment: `POST /api/v1/cc/assess`
- Attestation: `POST /api/v1/cc/prove/attest`
- Real-time: WebSocket `/ws/scans`

All API calls require Bearer token authentication with machine_id from license manager.
