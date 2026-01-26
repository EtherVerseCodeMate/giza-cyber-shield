# KHEPRA Telemetry & License Enforcement Architecture

## Overview

This document defines the mandatory telemetry data flow for KHEPRA Protocol license enforcement and Dark Crypto Database Moat aggregation, as required by **KHEPRA MASTER LICENSE AGREEMENT v3.0, Section 9**.

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              KHEPRA CLIENTS                                  │
│  (khepra.exe, sonar.exe, Adinkra PQC agents)                                │
│  - ML-DSA-65 signed telemetry beacons                                       │
│  - Heartbeat every 60 minutes                                               │
│  - Crypto inventory reports                                                 │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │ HTTPS (TLS 1.3)
                                 │ ML-DSA-65 Signed Payload
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│              TELEMETRY SERVER (Cloudflare Workers)                          │
│              telemetry.souhimbou.org                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  LAYER 1: Beacon Reception & Validation                                    │
│  - Signature verification (ML-DSA-65 public key)                           │
│  - Rate limiting (100 beacons/device/hour)                                 │
│  - Payload size validation (10KB max)                                      │
│  - Country-level geo (privacy preserving)                                  │
│                                                                             │
│  LAYER 2: License Enforcement                                              │
│  - License status validation                                               │
│  - Feature entitlement check                                               │
│  - Expiration monitoring                                                   │
│  - Revocation enforcement                                                  │
│                                                                             │
│  LAYER 3: Local Storage (D1 SQLite)                                        │
│  - beacons, licenses, license_validations                                  │
│  - enrollment_tokens, pilot_signups                                        │
│  - license_requests, admin_sessions                                        │
│                                                                             │
│  DATABASE: Cloudflare D1                                                   │
│  ID: e8ef77ce-5203-4b78-8969-9ee2dc74a7b6                                  │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │ Webhook/Queue
                                 │ (Aggregated Data)
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DEMARC SECURE API GATEWAY                                │
│                    gateway.souhimbou.org                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  LAYER 1: FIREWALL (layer1_firewall.go)                                    │
│  - IP/protocol filtering                                                   │
│  - DDoS protection                                                         │
│  - Geo-blocking (sanctioned countries)                                     │
│                                                                             │
│  LAYER 2: AUTHENTICATION (layer2_auth.go)                                  │
│  - mTLS certificate validation                                             │
│  - JWT token verification                                                  │
│  - API key authentication                                                  │
│  - Service-to-service auth                                                 │
│                                                                             │
│  LAYER 3: ANOMALY DETECTION (layer3_anomaly.go)                            │
│  - ML-based request scoring                                                │
│  - Behavioral analysis                                                     │
│  - Challenge mechanism                                                     │
│                                                                             │
│  LAYER 4: RATE LIMITING (layer4_control.go)                                │
│  - Per-IP rate limits                                                      │
│  - Burst protection                                                        │
│  - Quota enforcement                                                       │
│                                                                             │
│  METRICS: RequestsTotal, RequestsBlocked, AuthFailures,                    │
│           AnomaliesDetected, RateLimitHits                                 │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │ Authenticated Request
                                 │ (Service Account)
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SUPABASE (PostgreSQL + Auth)                             │
│                    [Production Database]                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  TABLES:                                                                   │
│                                                                             │
│  ┌─ crypto_inventory ─────────────────────────────────────────────────┐    │
│  │  - device_id (anonymized hash)                                     │    │
│  │  - organization_id                                                 │    │
│  │  - rsa_2048_count, rsa_3072_count, rsa_4096_count                 │    │
│  │  - ecc_p256_count, ecc_p384_count                                 │    │
│  │  - dilithium3_count, kyber1024_count                              │    │
│  │  - tls_config (JSON)                                              │    │
│  │  - pqc_readiness_score                                            │    │
│  │  - last_scan_at                                                   │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─ license_telemetry ────────────────────────────────────────────────┐    │
│  │  - license_id                                                      │    │
│  │  - organization_id                                                 │    │
│  │  - tier (pilot, pro, enterprise, government)                      │    │
│  │  - last_heartbeat_at                                              │    │
│  │  - validation_count                                               │    │
│  │  - features_used (JSON)                                           │    │
│  │  - compliance_status                                              │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─ security_events ──────────────────────────────────────────────────┐    │
│  │  - event_type (license_violation, anomaly, threat)                │    │
│  │  - severity (info, warning, critical)                             │    │
│  │  - source_device_id                                               │    │
│  │  - details (JSON)                                                 │    │
│  │  - resolved_at                                                    │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─ dark_crypto_moat ─────────────────────────────────────────────────┐    │
│  │  - algorithm_name                                                  │    │
│  │  - key_size                                                       │    │
│  │  - vulnerability_score (0-100)                                    │    │
│  │  - quantum_threat_level (none, low, medium, high, critical)       │    │
│  │  - recommended_replacement                                        │    │
│  │  - affected_device_count                                          │    │
│  │  - aggregate_exposure_value                                       │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  RLS: Row-Level Security per organization                                  │
│  AUTH: Supabase Auth with role-based access                                │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │ Real-time subscriptions
                                 │ PostgREST API
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│              MASTER OPERATOR CONSOLE                                        │
│              console.souhimbou.org (RESTRICTED ACCESS)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  ACCESS CONTROL:                                                           │
│  - Master Admin: SOUHIMBOU DOH KONE only (YubiKey + PIN)                  │
│  - No delegation of master access                                          │
│  - All actions audit logged                                                │
│                                                                             │
│  DASHBOARDS:                                                               │
│  ┌─ Global License Overview ──────────────────────────────────────────┐    │
│  │  - Total active licenses by tier                                   │    │
│  │  - Revenue metrics (Stripe integration)                           │    │
│  │  - Pilot conversion funnel                                        │    │
│  │  - Expiring licenses (30/14/7 day alerts)                         │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─ Dark Crypto Database ─────────────────────────────────────────────┐    │
│  │  - Global crypto inventory heatmap                                 │    │
│  │  - Vulnerable algorithm tracking                                  │    │
│  │  - PQC transition progress by organization                        │    │
│  │  - Quantum threat exposure score                                  │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─ Security Operations ──────────────────────────────────────────────┐    │
│  │  - License violation alerts                                       │    │
│  │  - Anomaly detection events                                       │    │
│  │  - Revocation queue                                               │    │
│  │  - Incident response playbooks                                    │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─ Compliance & Audit ───────────────────────────────────────────────┐    │
│  │  - DFARS 252.227-7014 compliance status                          │    │
│  │  - FedRAMP authorization tracking                                 │    │
│  │  - Offline audit report submissions                               │    │
│  │  - Annual compliance certifications                               │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ACTIONS:                                                                  │
│  - Issue/revoke licenses                                                   │
│  - Generate enrollment tokens                                              │
│  - Force license refresh                                                   │
│  - Emergency all-stop (revoke all)                                         │
│  - Export compliance reports                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Data Classification

| Data Type | Classification | Retention | Access |
|-----------|---------------|-----------|--------|
| Device Telemetry | Unclassified | 2 years | Service accounts |
| License Status | Business Confidential | Indefinite | Admin only |
| Crypto Inventory | Sensitive | 7 years (DoD) | Master Admin |
| Security Events | Sensitive | 5 years | SOC Team |
| Audit Logs | Compliance | 7 years | Master Admin |

## DoD ESI Alignment

Per DoD Enterprise Software Initiative Best Value Toolkit:

### 1. Licensing Model
- **Subscription-based** with telemetry enforcement
- **Tier structure**: Pilot (30-day), Pro, Enterprise, Government
- **Offline capability**: SCIF deployments with signed license files

### 2. Security Requirements
- **FedRAMP High** baseline (targeting authorization)
- **STIG compliance** for all deployments
- **Zero Trust architecture** via DEMARC gateway
- **PQC-ready**: ML-DSA-65, Kyber-1024

### 3. Vendor Qualification
- **Small Business**: SDVOSB eligible
- **CAGE Code**: [Pending]
- **DUNS**: [Pending]
- **SAM.gov**: Registered

### 4. Technical Requirements
- **Air-gap support**: Offline license validation
- **Interoperability**: REST API, gRPC
- **Scalability**: Cloudflare Workers (edge compute)
- **Availability**: 99.9% SLA target

## Implementation Priority

### Phase 1: Telemetry-to-DEMARC Bridge (Week 1)
- Create Cloudflare Worker cron job for batch forwarding
- Implement DEMARC service account authentication
- Add telemetry aggregation endpoint to DEMARC

### Phase 2: DEMARC-to-Supabase Sync (Week 2)
- Create Supabase tables (crypto_inventory, license_telemetry, etc.)
- Implement real-time sync from DEMARC
- Configure RLS policies

### Phase 3: Master Operator Console (Week 3-4)
- Build restricted admin dashboard
- Implement Dark Crypto Database visualization
- Add compliance reporting

### Phase 4: DoD ESI Certification (Ongoing)
- Complete BPA application
- Submit for FedRAMP authorization
- Engage with ESI program office

---

*Document Version: 1.0*
*Author: KHEPRA Protocol Team*
*Classification: UNCLASSIFIED // FOUO*
