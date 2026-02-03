# CMMC Level 1 Self-Assessment
## Khepra Protocol - Giza Cyber Shield

---

| Field | Value |
|-------|-------|
| **Organization** | EtherVerseCodeMate / UrGenCyX |
| **System Name** | Khepra Protected Enclave |
| **Assessment Date** | 2026-02-03 |
| **Assessment Type** | CMMC Level 1 Self-Assessment (FAR 52.204-21) |
| **Assessor** | Internal Security Team |
| **System Description** | Post-Quantum Cryptographic security platform providing compliance scanning, attestation, vulnerability detection, and secure communications for DoD and enterprise environments |
| **Deployment Models** | Edge (standalone), Hybrid (cloud+local), Sovereign (air-gapped) |
| **Cloud Infrastructure** | AWS GovCloud (FedRAMP High P-ATO inherited controls) |

---

## Assessment Summary

| # | Domain | Practice ID | Description | Status |
|---|--------|-------------|-------------|--------|
| 1 | AC | AC.L1-b.1.i | Limit system access to authorized users | **YES** |
| 2 | AC | AC.L1-b.1.ii | Limit access to transactions/functions | **YES** |
| 3 | AC | AC.L1-b.1.iii | Verify/control external connections | **YES** |
| 4 | AC | AC.L1-b.1.iv | Control publicly posted information | **YES** |
| 5 | IA | IA.L1-b.1.v | Identify users, processes, devices | **YES** |
| 6 | IA | IA.L1-b.1.vi | Authenticate identities before access | **YES** |
| 7 | MP | MP.L1-b.1.vii | Sanitize/destroy FCI media | **YES*** |
| 8 | PE | PE.L1-b.1.viii | Limit physical access | **N/A** |
| 9 | PE | PE.L1-b.1.ix | Escort visitors | **N/A** |
| 10 | PE | PE.L1-b.1.x | Maintain physical access audit logs | **YES** |
| 11 | PE | PE.L1-b.1.xi | Control physical access devices | **N/A** |
| 12 | SC | SC.L1-b.1.xii | Monitor/control boundary communications | **YES** |
| 13 | SC | SC.L1-b.1.xiii | Subnetworks for public components | **YES** |
| 14 | SI | SI.L1-b.1.xiv | Identify, report, correct flaws | **YES** |
| 15 | SI | SI.L1-b.1.xv | Malicious code protection | **YES** |
| 16 | SI | SI.L1-b.1.xvi | Update malicious code protection | **YES** |
| 17 | SI | SI.L1-b.1.xvii | Perform periodic scans | **YES** |

**Result: 14 MET / 3 N/A (inherited from AWS GovCloud FedRAMP)**

*\*MP.L1-b.1.vii: Digital sanitization implemented; physical media policy supplement recommended.*

---

## Domain 1: Access Control (AC)

### AC.L1-b.1.i - AUTHORIZED ACCESS CONTROL

**Requirement:** Limit information system access to authorized users, processes acting on behalf of authorized users, or devices (including other information systems).

**Status: YES - MET**

#### Sub-Question Responses

| Question | Answer | Evidence |
|----------|--------|----------|
| Authorized users are identified? | **Yes** | `pkg/auth/provider.go:22-34` - User struct with ID, Username, Email, Roles, Organizations. Six auth providers (Keycloak, Okta, CAC, Azure AD, Google, Local) at `pkg/auth/provider.go:10-20` |
| Processes acting on behalf of authorized users are identified? | **Yes** | `pkg/apiserver/service_auth.go:17-41` - Three named service accounts (cloudflare-telemetry, license-signer, master-console) with scoped permissions |
| Devices (and other systems) authorized to connect to the system are identified? | **Yes** | `pkg/fingerprint/device.go:19-75` - Hardware fingerprinting (MAC, CPU, disk serial, BIOS UUID, motherboard ID, TPM). `pkg/license/manager.go:24-25` - MachineID generation and binding |
| System access is limited to authorized users? | **Yes** | `pkg/apiserver/middleware.go:13-59` - AuthMiddleware rejects all requests without valid credentials (HTTP 401). `pkg/gateway/layer2_auth.go:232` - Returns error for unauthenticated requests |
| System access is limited to processes acting on behalf of authorized users? | **Yes** | `pkg/apiserver/service_auth.go:90-152` - HMAC-SHA256 signed tokens with 5-minute replay window. Constant-time comparison at line 147 |
| System access is limited to authorized devices (including other systems)? | **Yes** | `pkg/gateway/layer2_auth.go:84-126` - mTLS client certificate verification against CA pool. `pkg/gateway/agent_manager.go:36-41` - Agent registration with MachineID binding |

#### Evidence

| File | Lines | Description |
|------|-------|-------------|
| `pkg/auth/provider.go` | 10-20 | Six authentication providers: Keycloak, Okta, DoD CAC, Azure AD, Google, Local |
| `pkg/auth/provider.go` | 48-88 | AuthProvider interface requiring Authenticate() for all access |
| `pkg/auth/provider.go` | 90-148 | AuthManager enforcing provider-based authentication |
| `pkg/gateway/layer2_auth.go` | 84-256 | Zero-trust 4-priority authentication chain (mTLS > API Key > JWT > Enrollment) |
| `pkg/apiserver/middleware.go` | 13-59 | AuthMiddleware rejecting unauthenticated requests with HTTP 401 |
| `pkg/fingerprint/device.go` | 19-75 | Hardware fingerprinting: MAC, CPU, Disk, BIOS, Motherboard, TPM |
| `pkg/gateway/agent_manager.go` | 36-41 | Agent registration with MachineID binding |
| `pkg/compliance/nist80171/access_control.go` | 30-39 | NIST 800-171 3.1.1 control check |

#### Narrative

The system enforces authentication at multiple layers. All API access requires valid credentials through the gateway's zero-trust authentication chain. Device identity is established through hardware fingerprinting (MAC, CPU, BIOS, TPM). Service-to-service communication requires HMAC-SHA256 signed tokens. No anonymous access is permitted to any system function. The AuthMiddleware at the API server level rejects any request lacking valid authorization with HTTP 401.

---

### AC.L1-b.1.ii - TRANSACTION & FUNCTION CONTROL

**Requirement:** Limit information system access to the types of transactions and functions that authorized users are permitted to execute.

**Status: YES - MET**

#### Evidence

| File | Lines | Description |
|------|-------|-------------|
| `pkg/auth/provider.go` | 186-199 | Permission struct: Resource + Action pairs |
| `pkg/auth/provider.go` | 193-197 | Role struct with Name, Description, Permissions array |
| `pkg/auth/provider.go` | 200-243 | PermissionEvaluator with wildcard support |
| `pkg/auth/provider.go` | 249-299 | 5 predefined roles: Admin, Compliance Officer, Security Engineer, Operator, Viewer |
| `pkg/apiserver/service_auth.go` | 17-41 | Service account scoped permissions (e.g., telemetry:read/write only) |
| `pkg/apiserver/service_auth.go` | 202-234 | RequirePermission() middleware enforcing function-level authorization (HTTP 403) |
| `pkg/compliance/nist80171/access_control.go` | 43-52 | NIST 800-171 3.1.2 control check |

#### Role Definitions

| Role | Permissions |
|------|-------------|
| **Admin** | `{Resource: "*", Action: "*"}` - Full access |
| **Compliance Officer** | attest (read/write), stig (read), compliance (read/write), report (read) |
| **Security Engineer** | scan (read/write), vuln (read), dag (read), remediation (write) |
| **Operator** | dag (read), scan (read), attest (read), report (read) |
| **Viewer** | dag (read), attest (read), report (read) - Read-only |

#### Narrative

The system implements granular role-based access control with five predefined roles, each with explicit permission sets mapping resources to allowed actions. Service accounts have scoped permissions enforced by middleware. The principle of least privilege is structurally enforced -- the Viewer role only permits read actions on three specific resources. Function-level authorization returns HTTP 403 for unauthorized operations.

---

### AC.L1-b.1.iii - EXTERNAL SYSTEM CONNECTIONS

**Requirement:** Verify and control/limit connections to and use of external information systems.

**Status: YES - MET**

#### Evidence

| File | Lines | Description |
|------|-------|-------------|
| `pkg/gateway/layer1_firewall.go` | 17-95 | Firewall: HTTPS enforcement, method whitelist, IP reputation, geo-blocking |
| `pkg/gateway/layer1_firewall.go` | 139-153 | Allow-only IP list for DoD environments |
| `pkg/gateway/config.go` | 41-62 | FirewallConfig: RequireHTTPS, MinTLSVersion 1.2, AllowOnlyCountries |
| `pkg/gateway/gateway.go` | 97-131 | TLS 1.2+ with AEAD-only cipher suites, mTLS option |
| `pkg/gateway/gateway.go` | 134-216 | 4-layer sequential security processing for all connections |
| `pkg/apiserver/service_auth.go` | 90-152 | Service-to-service HMAC tokens with 5-minute replay window |
| `deploy/govcloud/terraform/audit.tf` | 292-315 | VPC Flow Logs capturing all network traffic |

#### Narrative

External connections are controlled through the Khepra Secure Gateway's four-layer architecture. The firewall layer blocks unauthorized IPs, enforces HTTPS/TLS 1.2+, restricts HTTP methods, and supports geo-blocking (US-only for DoD). mTLS provides certificate-based verification of external systems. VPC Flow Logs monitor all network connections. Service-to-service authentication uses time-bounded HMAC tokens to prevent replay attacks.

---

### AC.L1-b.1.iv - PUBLIC INFORMATION CONTROL

**Requirement:** Control information posted or processed on publicly accessible information systems.

**Status: YES - MET**

#### Evidence

| File | Lines | Description |
|------|-------|-------------|
| `pkg/logging/dod_logger.go` | 17-21 | Architecture: No PQC keys or sensitive data on stdout (Low Side) |
| `pkg/logging/dod_logger.go` | 38-68 | Three redaction levels: None (dev), Sensitive (default), All (DoD) |
| `pkg/logging/dod_logger.go` | 53-68 | 18+ sensitive field patterns auto-redacted (private_key, password, token, ssn, etc.) |
| `pkg/config/secrets.go` | 13-80 | SecretBundle uses []byte for explicit memory wipe. Wipe() zeros all key material |
| `pkg/gateway/gateway.go` | 231-234 | Minimal error responses: no internal information leakage |
| `deploy/govcloud/terraform/audit.tf` | 86-93 | S3 public access completely blocked (all four settings true) |

#### Narrative

Information disclosure is controlled at multiple levels. The dual-pipeline logging architecture separates sensitive data (DAG-only, internal) from public-facing logs (stdout/EFK). A comprehensive redaction system prevents credentials, PQC keys, PII, and system internals from reaching public outputs. S3 buckets block all public access. Error responses are deliberately minimal to prevent information leakage.

---

## Domain 2: Identification and Authentication (IA)

### IA.L1-b.1.v - IDENTIFICATION

**Requirement:** Identify information system users, processes acting on behalf of users, and devices.

**Status: YES - MET**

#### Evidence

| File | Lines | Description |
|------|-------|-------------|
| `pkg/auth/provider.go` | 22-34 | User struct: ID, Username, Email, Organizations, Roles, Groups |
| `pkg/gateway/gateway.go` | 357-365 | Identity struct: ID, Type, Organization, TrustScore, Permissions |
| `pkg/fingerprint/device.go` | 19-75 | Device fingerprint: MAC, CPU, Disk, BIOS, Motherboard, TPM, composite hash |
| `pkg/license/manager.go` | 24-25 | GenerateMachineID() for hardware-bound device identification |
| `pkg/apiserver/service_auth.go` | 17-41 | Named service accounts: cloudflare-telemetry, license-signer, master-console |
| `pkg/agent/agent.go` | 21-24 | Agent service identified as "AdinKhepraSonarAgent" |
| `pkg/gateway/agent_manager.go` | 13-20 | Agent identified by ID, OrganizationID, MachineID |

#### Narrative

The system uniquely identifies three categories of principals: (1) **Users** via multi-provider authentication with rich profile data (ID, email, roles, organizations); (2) **Devices** via hardware fingerprinting using immutable identifiers (TPM, BIOS UUID, disk serials, MAC addresses, CPU signature); (3) **Processes/Services** via named service accounts with scoped permission sets and HMAC-signed tokens.

---

### IA.L1-b.1.vi - AUTHENTICATION

**Requirement:** Authenticate (or verify) the identities of those users, processes, or devices, as a prerequisite to allowing access to organizational information systems.

**Status: YES - MET**

#### Evidence

| File | Lines | Description |
|------|-------|-------------|
| `pkg/auth/provider.go` | 48-51 | AuthProvider interface requires Authenticate() for all access |
| `pkg/auth/provider.go` | 36-46 | Credentials: Username/Password, Token, ClientID/Secret, SAML, Certificate |
| `pkg/auth/providers.go` | 19-456 | Six providers: Keycloak, Okta, CAC, Azure AD, Google, Local |
| `pkg/gateway/layer2_auth.go` | 84-256 | 4-tier auth: mTLS (trust 1.0), API Key (0.7), JWT (0.8), Enrollment (0.3) |
| `pkg/gateway/layer2_auth.go` | 236-250 | PQC signature verification (ML-DSA-65) as additional factor |
| `pkg/apiserver/service_auth.go` | 90-152 | Service token HMAC-SHA256 verification with constant-time comparison |
| `pkg/apiserver/middleware.go` | 13-59 | Middleware blocks unauthenticated requests (HTTP 401) |
| `pkg/fingerprint/device.go` | 572-633 | Anti-spoofing: virtual MAC detection, missing identifier alerts |

#### Narrative

Authentication is mandatory for all system access and enforced at the gateway layer before any request reaches application logic. The system supports six identity providers and four authentication mechanisms (mTLS, API Key, JWT, Enrollment Token). Service processes authenticate via HMAC-SHA256 time-bounded tokens. Devices are verified through hardware fingerprinting with anti-spoofing detection. Post-quantum cryptographic signatures (ML-DSA-65) provide an additional verification layer.

---

## Domain 3: Media Protection (MP)

### MP.L1-b.1.vii - MEDIA SANITIZATION

**Requirement:** Sanitize or destroy information system media containing Federal Contract Information before disposal or release for reuse.

**Status: YES - MET** *(digital media; physical media policy supplement recommended)*

#### Evidence

| File | Lines | Description |
|------|-------|-------------|
| `pkg/adinkra/security_hardening.go` | 64-75 | SecureZeroMemory() - overwrites with zeros, compiler barrier |
| `pkg/adinkra/security_hardening.go` | 99-108 | SecureZeroInt64() - zeros int64 slices with KeepAlive |
| `pkg/adinkra/security_hardening.go` | 127-168 | SecureKey type with automatic zeroization via finalizer |
| `pkg/config/secrets.go` | 55-80 | Wipe() zeros all API keys. Uses []byte for explicit clearing |
| `deploy/govcloud/terraform/audit.tf` | 95-117 | S3 lifecycle: GLACIER at 365d, expiration at 2555d (7 years) |
| `deploy/govcloud/terraform/secrets.tf` | 8-12 | KMS keys with rotation and 30-day deletion window |

#### Narrative

Digital media sanitization is implemented at the code level through explicit memory zeroing (`SecureZeroMemory`) using compiler barriers to prevent optimization removal. Cryptographic keys use `SecureKey` types with automatic zeroization on garbage collection. Secret bundles are explicitly wiped after use. Cloud storage uses KMS encryption with key rotation, providing cryptographic sanitization when keys are retired. Physical media destruction per NIST SP 800-88 should be documented in organizational policy.

---

## Domain 4: Physical Protection (PE)

### PE.L1-b.1.viii - LIMIT PHYSICAL ACCESS

**Status: NOT APPLICABLE** - Cloud-hosted on AWS GovCloud. Physical security inherited from AWS FedRAMP High P-ATO (SOC 2 Type II certified data centers).

### PE.L1-b.1.ix - ESCORT VISITORS

**Status: NOT APPLICABLE** - Cloud-hosted on AWS GovCloud. Visitor management inherited from AWS FedRAMP High P-ATO.

### PE.L1-b.1.x - PHYSICAL ACCESS AUDIT LOGS

**Status: YES - MET**

#### Evidence

| File | Lines | Description |
|------|-------|-------------|
| `deploy/govcloud/terraform/audit.tf` | 167-200 | CloudTrail: all API activity, log integrity validation, KMS encryption |
| `deploy/govcloud/terraform/audit.tf` | 487-502 | CloudWatch alarm: root account usage (NIST 800-171 3.1.1) |
| `deploy/govcloud/terraform/audit.tf` | 505-520 | CloudWatch alarm: unauthorized API calls (threshold 10 in 5min) |
| `deploy/govcloud/terraform/audit.tf` | 523-538 | CloudWatch alarm: console login without MFA (CMMC IA.L2-3.5.3) |
| `deploy/govcloud/terraform/audit.tf` | 544-578 | Metric filters for root usage, unauthorized calls, MFA-less login |

#### Narrative

Cloud infrastructure access is comprehensively logged via AWS CloudTrail with log file integrity validation and KMS encryption. CloudWatch alarms provide real-time alerting on root account usage, unauthorized API calls, and MFA-less console logins. For AWS GovCloud, physical facility access logging is inherited from AWS's FedRAMP High authorization.

### PE.L1-b.1.xi - CONTROL PHYSICAL ACCESS DEVICES

**Status: NOT APPLICABLE** - Cloud-hosted on AWS GovCloud. Physical access device management inherited from AWS FedRAMP High P-ATO. Digital credential management via IAM and KMS key policies in `deploy/govcloud/terraform/secrets.tf`.

---

## Domain 5: System and Communications Protection (SC)

### SC.L1-b.1.xii - BOUNDARY PROTECTION

**Requirement:** Monitor, control, and protect organizational communications at the external boundaries and key internal boundaries of the information systems.

**Status: YES - MET**

#### Evidence

| File | Lines | Description |
|------|-------|-------------|
| `pkg/gateway/gateway.go` | 17-35 | Gateway: explicit DEMARC point between customer and Khepra ecosystem |
| `pkg/gateway/gateway.go` | 97-131 | TLS 1.2+ with AEAD cipher suites (AES-256-GCM, CHACHA20-POLY1305) |
| `pkg/gateway/gateway.go` | 134-216 | 4-layer sequential security: firewall, auth, anomaly, rate-limit |
| `pkg/gateway/layer1_firewall.go` | 60-95 | Protocol enforcement, IP reputation, geo-blocking, WAF |
| `pkg/gateway/layer1_firewall.go` | 179-310 | WAF: 30+ patterns for SQLi, XSS, LFI, RCE detection |
| `pkg/gateway/config.go` | 95-119 | Anomaly detection: ML behavioral analysis, geo-velocity |
| `deploy/govcloud/terraform/audit.tf` | 292-360 | VPC Flow Logs capturing all network traffic |
| `deploy/govcloud/terraform/audit.tf` | 366-393 | GuardDuty: threat detection, malware scanning, 15-min publishing |
| `pkg/adinkra/hybrid_crypto.go` | 20-49 | Triple-layer PQC encryption for data in transit |

#### Narrative

The Khepra Secure Gateway serves as the explicit boundary DEMARC point. All communications pass through four sequential security layers: perimeter firewall (IP reputation, WAF, protocol enforcement), zero-trust authentication, ML-based anomaly detection, and rate limiting/logging. TLS 1.2+ with AEAD cipher suites protects all communications in transit. VPC Flow Logs and GuardDuty provide continuous network monitoring. Triple-layer post-quantum encryption (Khepra-PQC + CRYSTALS + ECDSA) protects sensitive data.

---

### SC.L1-b.1.xiii - PUBLIC ACCESS SUBNETWORKS

**Requirement:** Implement subnetworks for publicly accessible system components that are physically or logically separated from internal networks.

**Status: YES - MET**

#### Evidence

| File | Lines | Description |
|------|-------|-------------|
| `pkg/gateway/gateway.go` | 1-5 | Gateway is the architectural DEMARC separating external from internal |
| `pkg/gateway/config.go` | 13-15 | Gateway listens on :8443 (public-facing, TLS) |
| `deploy/govcloud/terraform/audit.tf` | 303-315 | VPC with flow logging (references aws_vpc.main) |
| `deploy/govcloud/terraform/main.tf` | 1-17 | AWS GovCloud with CUI data classification tags |
| `pkg/logging/dod_logger.go` | 17-21 | Dual-pipeline: Low Side (public EFK) vs High Side (internal DAG) |

#### Narrative

Network segmentation is implemented through AWS VPC architecture with the Khepra Secure Gateway serving as the DEMARC point between public-facing components and internal services. The dual-pipeline logging architecture explicitly separates "Low Side" (publicly accessible EFK stack) from "High Side" (internal DAG) data streams. All public access terminates at the gateway on port 8443; internal services are not directly accessible.

---

## Domain 6: System and Information Integrity (SI)

### SI.L1-b.1.xiv - FLAW REMEDIATION

**Requirement:** Identify, report, and correct information and information system flaws in a timely manner.

**Status: YES - MET**

#### Evidence

| File | Lines | Description |
|------|-------|-------------|
| `pkg/compliance/engine.go` | 10-92 | Compliance Engine: automated scanning, identifies FAILED_SCAN, auto-remediation |
| `pkg/compliance/engine.go` | 76-92 | AutoRemediate() fixes failed controls, updates to AUTO_REMEDIATED |
| `pkg/compliance/ssp.go` | 40-55 | Control status tracking: IMPLEMENTED, PLANNED, PARTIAL, FAILED_SCAN, AUTO_REMEDIATED |
| `pkg/agent/agent.go` | 57-113 | Continuous monitoring every 2 minutes with baseline drift detection |
| `pkg/arsenal/gitleaks.go` | - | Secret detection via Gitleaks integration |
| `pkg/arsenal/zap.go` | - | OWASP ZAP web vulnerability scanning |
| `deploy/govcloud/terraform/audit.tf` | 399-418 | Security Hub with NIST 800-171 and CIS standards |

#### Narrative

The system identifies flaws through multiple mechanisms: continuous compliance scanning with automated auditing, drift detection agent comparing against baselines every 2 minutes, secret detection (Gitleaks, detect-secrets), and web vulnerability scanning (OWASP ZAP). AWS Security Hub enforces NIST 800-171 and CIS benchmarks. Correction is automated where possible through the auto-remediation engine.

---

### SI.L1-b.1.xv - MALICIOUS CODE PROTECTION

**Requirement:** Provide protection from malicious code at appropriate locations within organizational information systems.

**Status: YES - MET**

#### Evidence

| File | Lines | Description |
|------|-------|-------------|
| `pkg/gateway/layer1_firewall.go` | 179-310 | WAF: 30+ regex patterns for SQLi, XSS, LFI, RCE |
| `pkg/adinkra/security_hardening.go` | 176-208 | OWASP mitigations: Heartbleed, Bleichenbacher, Lucky13 |
| `pkg/adinkra/security_hardening.go` | 265-288 | SafeSliceBounds(), SafeCopy() - buffer overflow prevention |
| `pkg/adinkra/security_hardening.go` | 449-464 | ValidateResourceRequest() - DoS prevention |
| `deploy/govcloud/terraform/audit.tf` | 366-393 | GuardDuty: malware protection with EBS volume scanning |
| `pkg/gateway/config.go` | 303-311 | Fail-secure: MLServiceFallback "deny" |

#### Narrative

Protection from malicious code operates at multiple layers: the WAF engine blocks known attack patterns (SQLi, XSS, LFI, RCE); GuardDuty provides runtime malware scanning including EBS volume analysis; the security hardening module prevents exploitation of common vulnerability classes (buffer overflows, timing attacks, padding oracles). The system defaults to fail-secure (deny) when security components are unavailable.

---

### SI.L1-b.1.xvi - MALICIOUS CODE UPDATES

**Requirement:** Update malicious code protection mechanisms when new releases are available.

**Status: YES - MET**

#### Evidence

| File | Lines | Description |
|------|-------|-------------|
| `pkg/gateway/layer1_firewall.go` | 313-375 | Dynamic IP blocklist loading, AddBlockedIP(), UpdateTorExitNodes() |
| `pkg/gateway/config.go` | 58-61 | CustomRulesPath for loading updated WAF rules |
| `deploy/govcloud/terraform/audit.tf` | 366-393 | GuardDuty: 15-minute threat intel update frequency |
| `deploy/govcloud/terraform/secrets.tf` | 198-206 | Automated secret rotation via Lambda (90-day cycle) |
| `pkg/compliance/engine.go` | 26-29 | Dynamic platform check loading via loadPlatformChecks() |

#### Narrative

Protection mechanisms support runtime updates. The IP blocklist can be refreshed dynamically including Tor exit nodes. WAF rules are loadable from external files. GuardDuty consumes AWS-managed threat intelligence automatically at 15-minute intervals. Secrets are rotated on a 90-day cycle. Compliance checks are loaded dynamically per platform.

---

### SI.L1-b.1.xvii - SYSTEM SCANNING

**Requirement:** Perform periodic scans of the information system and real-time scans of files from external sources as files are downloaded, opened, or executed.

**Status: YES - MET**

#### Evidence

| File | Lines | Description |
|------|-------|-------------|
| `pkg/agent/agent.go` | 82-113 | Continuous 2-minute monitoring with baseline comparison |
| `pkg/compliance/engine.go` | 32-73 | EvaluateCompliance() scans across all SSP controls |
| `deploy/govcloud/terraform/audit.tf` | 366-393 | GuardDuty: continuous threat detection + malware scanning |
| `deploy/govcloud/terraform/audit.tf` | 399-418 | Security Hub: NIST 800-171 + CIS continuous scanning |
| `deploy/govcloud/terraform/audit.tf` | 424-470 | AWS Config: continuous resource configuration monitoring |
| `pkg/connectors/nessus.go` | - | Nessus vulnerability scanner connector |
| `pkg/connectors/kubebench.go` | - | Kubernetes CIS benchmark scanning |
| `pkg/connectors/xccdf.go` | - | XCCDF (STIG) checklist scanning |

#### Narrative

Periodic scanning is performed at multiple levels: the Sonar Agent runs continuous monitoring every 2 minutes with baseline comparison; the compliance engine performs STIG/CIS/NIST scans; AWS GuardDuty provides real-time threat detection and malware scanning; AWS Config records all resource changes; integration connectors exist for Nessus, XCCDF/STIG, CIS Kubernetes benchmarks, and SARIF-format static analysis results.

---

## Plan of Action and Milestones (POA&M)

| # | Practice | Gap | Planned Action | Target Date |
|---|----------|-----|----------------|-------------|
| 1 | MP.L1-b.1.vii | Physical media destruction policy | Create Media Sanitization Policy per NIST SP 800-88 | TBD |
| 2 | PE.L1-b.1.viii | Facility access control documentation | Document AWS GovCloud Shared Responsibility Matrix for PE controls | TBD |
| 3 | PE.L1-b.1.ix | Visitor policy | Document visitor escort procedures (if on-premise assets exist) | TBD |
| 4 | PE.L1-b.1.xi | Physical access device management | Document IAM credential and KMS key management as digital equivalent | TBD |
| 5 | SI.L1-b.1.xvi | WAF update cadence documentation | Formalize WAF rule and IP blocklist update schedule | TBD |

---

## Appendix: Evidence File Index

### Authentication & Authorization
| File | Purpose |
|------|---------|
| `pkg/auth/provider.go` | Core auth interfaces, RBAC, session management |
| `pkg/auth/providers.go` | Keycloak, Okta, CAC, Azure AD, Google, Local providers |
| `pkg/auth/auth_test.go` | Authentication test suite |

### Gateway Security
| File | Purpose |
|------|---------|
| `pkg/gateway/gateway.go` | DEMARC point, TLS config, 4-layer security |
| `pkg/gateway/layer1_firewall.go` | Firewall, WAF, IP reputation, geo-blocking |
| `pkg/gateway/layer2_auth.go` | Zero-trust auth: mTLS, API Key, JWT, PQC |
| `pkg/gateway/config.go` | Security layer configuration |
| `pkg/gateway/agent_manager.go` | Agent registration and management |

### API Server Security
| File | Purpose |
|------|---------|
| `pkg/apiserver/service_auth.go` | Service account HMAC auth, OWASP compliance |
| `pkg/apiserver/middleware.go` | Auth middleware, rate limiting, CORS |
| `pkg/apiserver/telemetry_handlers.go` | Telemetry with Dilithium signature verification |

### Cryptography
| File | Purpose |
|------|---------|
| `pkg/adinkra/hybrid_crypto.go` | Triple-layer PQC (Khepra + CRYSTALS + ECDSA) |
| `pkg/adinkra/security_hardening.go` | Memory sanitization, OWASP mitigations |
| `pkg/adinkra/security_validation.go` | Key pair and envelope integrity validation |

### Compliance
| File | Purpose |
|------|---------|
| `pkg/compliance/engine.go` | Compliance scanning and auto-remediation |
| `pkg/compliance/ssp.go` | System Security Plan with control tracking |
| `pkg/compliance/nist80171/access_control.go` | NIST 800-171 AC controls |
| `pkg/compliance/nist80172/access_control_enhanced.go` | NIST 800-172 enhanced AC |
| `pkg/stig/cmmc.go` | CMMC 3.0 Level 3 validation engine |

### Device & License
| File | Purpose |
|------|---------|
| `pkg/fingerprint/device.go` | Hardware fingerprinting with anti-spoofing |
| `pkg/license/manager.go` | License management with MachineID binding |
| `cmd/sonar/license.go` | License validation and enforcement |

### Logging & Monitoring
| File | Purpose |
|------|---------|
| `pkg/logging/dod_logger.go` | DoD dual-pipeline logging with redaction |
| `deploy/govcloud/terraform/audit.tf` | CloudTrail, GuardDuty, Security Hub, VPC Flow Logs |

### Agent & Scanning
| File | Purpose |
|------|---------|
| `pkg/agent/agent.go` | Continuous 2-minute monitoring agent |
| `pkg/connectors/nessus.go` | Nessus vulnerability scanner connector |
| `pkg/connectors/xccdf.go` | STIG checklist scanning |
| `pkg/arsenal/gitleaks.go` | Secret detection |
| `pkg/arsenal/zap.go` | Web vulnerability scanning |

---

*Document generated: 2026-02-03*
*System: Khepra Protocol - Giza Cyber Shield*
*Classification: CUI // SP-CMMC*
