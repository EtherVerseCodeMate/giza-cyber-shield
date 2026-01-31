SAAS TERMS & AUTHORIZED USE
================================================================================

**Effective Date**: January 31, 2026  
**Last Updated**: January 31, 2026  
**Agreement Type**: Software as a Service (SaaS) Terms  
**Classification**: CUI // NOFORN

These SaaS Terms govern your use of the SouHimBou.AI platform and Khepra Protocol software delivered as a cloud service. These terms supplement the Khepra Master License Agreement (v3.0).

================================================================================
1. SERVICE DESCRIPTION
================================================================================

1.1 **SOUHIMBOU.AI PLATFORM**

A web-based compliance automation platform providing:
- STIG-first compliance scanning and remediation
- CMMC assessment and gap analysis
- Evidence collection and audit trail management
- Automated compliance reporting
- Integration with Khepra Protocol for cryptographic validation

1.2 **KHEPRA PROTOCOL DEPLOYMENT MODELS**

**Khepra-Edge** (Air-Gapped):
- Deployment on air-gapped systems (SCIF, classified networks)
- No internet connectivity required
- Offline license validation via cryptographically signed license files
- Annual manual compliance audits required

**Khepra-Hybrid** (Corporate Networks):
- Deployment on corporate networks for internal auditing
- Online license validation via telemetry beacons
- Periodic connectivity to telemetry.souhimbou.org required
- Suitable for unclassified and CUI environments

**Khepra-Sovereign** (Dedicated VPC):
- Deployment within a dedicated Virtual Private Cloud (VPC)
- Customer-controlled infrastructure (AWS GovCloud, Azure Government)
- Dedicated telemetry endpoint (customer-hosted)
- Suitable for FedRAMP and DoD IL4/IL5 environments

================================================================================
2. SERVICE AVAILABILITY & UPTIME
================================================================================

2.1 **SERVICE LEVEL AGREEMENT (SLA)**

We commit to the following uptime targets:

| Service Tier | Uptime Target | Downtime/Month | Support Response |
|--------------|---------------|----------------|------------------|
| **Community** | 95% | ~36 hours | Best effort |
| **Professional** | 99% | ~7.2 hours | 24 hours |
| **Enterprise** | 99.9% | ~43 minutes | 4 hours |
| **Government** | 99.95% | ~21 minutes | 1 hour |

2.2 **SCHEDULED MAINTENANCE**

We perform scheduled maintenance during the following windows:
- **Standard**: Sundays 02:00-06:00 UTC
- **Emergency**: As needed with 24-hour notice (when possible)

Scheduled maintenance does not count against uptime SLA.

2.3 **SERVICE CREDITS**

If we fail to meet the uptime SLA, you may be eligible for service credits:
- 99.0-99.9%: 10% credit
- 95.0-98.9%: 25% credit
- <95.0%: 50% credit

Service credits are your sole remedy for SLA violations.

================================================================================
3. DATA STORAGE & BACKUP
================================================================================

3.1 **DATA RESIDENCY**

Your data is stored in the following regions:
- **US Government**: AWS GovCloud (US-East, US-West)
- **Commercial**: AWS US-East-1, US-West-2
- **European Union**: AWS EU-Central-1 (Frankfurt) - upon request

3.2 **BACKUP & DISASTER RECOVERY**

We maintain the following backup schedule:
- **Database**: Continuous replication with 35-day point-in-time recovery
- **File Storage**: Daily snapshots with 90-day retention
- **Compliance Reports**: Immutable storage with 7-year retention (DoD requirement)

**Recovery Time Objective (RTO)**: 4 hours  
**Recovery Point Objective (RPO)**: 1 hour

3.3 **DATA ENCRYPTION**

All data is encrypted at rest and in transit:
- **At Rest**: AES-256 encryption with customer-managed keys (optional)
- **In Transit**: TLS 1.3 with post-quantum key exchange (Kyber-1024)
- **Database**: Transparent Data Encryption (TDE)

================================================================================
4. AUTHORIZED USE & RESTRICTIONS
================================================================================

4.1 **PERMITTED USES**

You may use the Service for the following purposes:
- Compliance scanning and STIG validation
- CMMC assessment and certification preparation
- Evidence collection for audits and assessments
- Automated compliance reporting
- Integration with existing security tools (SIEM, ticketing, etc.)

4.2 **PROHIBITED USES**

You SHALL NOT use the Service for:
- Illegal activities or violation of applicable laws
- Unauthorized access to third-party systems
- Malware distribution or malicious scanning
- Competitive intelligence gathering
- Resale or sublicensing without authorization
- Circumvention of license validation or telemetry mechanisms
- Reverse engineering or extraction of proprietary algorithms

4.3 **USAGE LIMITS**

The following usage limits apply based on your subscription tier:

| Resource | Community | Professional | Enterprise | Government |
|----------|-----------|--------------|------------|------------|
| **Users** | 3 | 25 | Unlimited | Unlimited |
| **Assets** | 50 | 500 | 5,000 | Unlimited |
| **Scans/Month** | 100 | 1,000 | 10,000 | Unlimited |
| **API Calls/Day** | 1,000 | 10,000 | 100,000 | Unlimited |
| **Storage** | 10 GB | 100 GB | 1 TB | Unlimited |

Exceeding usage limits may result in throttling, additional charges, or service suspension.

================================================================================
5. CUSTOMER RESPONSIBILITIES
================================================================================

5.1 **ACCOUNT SECURITY**

You are responsible for:
- Maintaining the confidentiality of your account credentials
- Implementing multi-factor authentication (MFA) for all users
- Monitoring account activity for unauthorized access
- Promptly notifying us of any security incidents

5.2 **DATA ACCURACY**

You are responsible for:
- Ensuring the accuracy of data uploaded to the Service
- Maintaining proper classification markings (CUI, FOUO, etc.)
- Not uploading classified information (Secret, Top Secret) to commercial cloud
- Complying with data handling requirements for your security clearance level

5.3 **COMPLIANCE WITH LAWS**

You are responsible for:
- Complying with all applicable laws and regulations
- Obtaining necessary approvals for use of the Service (ATO, IATT, etc.)
- Ensuring compliance with export control regulations
- Maintaining required security controls (NIST 800-171, CMMC, etc.)

================================================================================
6. SUPPORT & MAINTENANCE
================================================================================

6.1 **SUPPORT CHANNELS**

We provide support through the following channels:

| Channel | Community | Professional | Enterprise | Government |
|---------|-----------|--------------|------------|------------|
| **Email** | ✓ | ✓ | ✓ | ✓ |
| **Chat** | - | ✓ | ✓ | ✓ |
| **Phone** | - | Business hours | 24/7 | 24/7 |
| **Dedicated TAM** | - | - | ✓ | ✓ |

6.2 **SUPPORT RESPONSE TIMES**

| Priority | Community | Professional | Enterprise | Government |
|----------|-----------|--------------|------------|------------|
| **P1 (Critical)** | Best effort | 4 hours | 1 hour | 30 minutes |
| **P2 (High)** | Best effort | 8 hours | 4 hours | 2 hours |
| **P3 (Medium)** | Best effort | 24 hours | 12 hours | 8 hours |
| **P4 (Low)** | Best effort | 48 hours | 24 hours | 24 hours |

6.3 **SOFTWARE UPDATES**

We provide the following updates:
- **Security Patches**: Deployed within 24 hours of discovery
- **Bug Fixes**: Deployed weekly (Tuesdays)
- **Feature Updates**: Deployed monthly (first Tuesday)
- **Major Releases**: Deployed quarterly with 30-day notice

================================================================================
7. THIRD-PARTY INTEGRATIONS
================================================================================

7.1 **SUPPORTED INTEGRATIONS**

The Service integrates with the following third-party platforms:
- **SIEM**: Splunk, QRadar, ArcSight, Sentinel
- **Ticketing**: Jira, ServiceNow, Remedy
- **Cloud**: AWS, Azure, Google Cloud
- **Identity**: Active Directory, Okta, Azure AD, EVO Security
- **Vulnerability Scanners**: Tenable, Qualys, Rapid7

7.2 **THIRD-PARTY TERMS**

Use of third-party integrations is subject to the terms and conditions of the third-party provider. We are not responsible for third-party service availability or data handling.

================================================================================
8. PAYMENT & BILLING
================================================================================

8.1 **SUBSCRIPTION FEES**

Subscription fees are billed:
- **Monthly**: Due on the 1st of each month
- **Annual**: Due on the anniversary of your subscription start date
- **Government**: Net 30 payment terms (invoice)

8.2 **PRICE CHANGES**

We may change subscription prices with 30 days' notice. Price changes do not affect existing subscriptions until renewal.

8.3 **REFUND POLICY**

- **Monthly Subscriptions**: No refunds for partial months
- **Annual Subscriptions**: Pro-rated refund for unused months (minus 20% administrative fee)
- **Government Contracts**: Subject to contract terms and FAR regulations

================================================================================
9. TERMINATION & SUSPENSION
================================================================================

9.1 **TERMINATION BY CUSTOMER**

You may terminate your subscription at any time by:
- Canceling through your account settings
- Contacting support
- Providing written notice (government contracts)

9.2 **TERMINATION BY US**

We may terminate or suspend your access if:
- You breach these terms or the Master License Agreement
- Your account is inactive for 12 months
- You fail to pay subscription fees
- You engage in prohibited activities

9.3 **EFFECT OF TERMINATION**

Upon termination:
- Access to the Service is immediately revoked
- Data is retained for 90 days for retrieval
- After 90 days, data is securely deleted
- Compliance reports are retained for 7 years (DoD requirement)

================================================================================
10. CHANGES TO THESE TERMS
================================================================================

We may update these SaaS Terms from time to time. We will notify you of material changes by:
- Posting the updated terms on our website
- Sending an email notification
- Displaying a prominent notice in the Service

Your continued use of the Service after changes constitutes acceptance.

================================================================================
11. CONTACT US
================================================================================

**SecRed Knowledge Inc. dba NouchiX**  
401 New Karner Rd, Suite 301  
Albany, NY 12205  
Email: support@souhimbou.ai  
Phone: (518) 555-0100  
Website: https://souhimbou.ai

================================================================================

**Copyright Notice**:  
© 2024-2026 SecRed Knowledge Inc. All Rights Reserved.
