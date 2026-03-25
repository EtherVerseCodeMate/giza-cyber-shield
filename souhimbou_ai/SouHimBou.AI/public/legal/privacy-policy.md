PRIVACY POLICY
================================================================================

**Effective Date**: January 31, 2026  
**Last Updated**: January 31, 2026  
**Classification**: CUI // NOFORN

SecRed Knowledge Inc. dba NouchiX ("we," "us," or "our") operates the SouHimBou.AI platform and Khepra Protocol software (collectively, the "Service"). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Service.

BY USING THE SERVICE, YOU CONSENT TO THE DATA PRACTICES DESCRIBED IN THIS POLICY.

================================================================================
1. INFORMATION WE COLLECT
================================================================================

1.1 **PERSONAL INFORMATION**

We collect the following personal information when you register for an account:
- Full name
- Email address
- Username
- Department/Organization
- Security clearance level (if applicable)
- IP address (for security and fraud prevention)
- User agent (browser and operating system information)

1.2 **TELEMETRY & LICENSE VALIDATION DATA**

**MANDATORY FOR PREMIUM EDITION**: The Khepra Protocol software transmits periodic anonymous telemetry beacons to our secure servers (telemetry.souhimbou.org) for license validation and cryptographic inventory monitoring.

**Data Transmitted**:
- License key hash (cryptographically anonymized, non-reversible)
- Software version and edition (Community vs. Premium)
- Machine ID (cryptographically derived, non-reversible, no hardware identifiers)
- Operating system and architecture (e.g., "Windows 11 x64", "Ubuntu 22.04 ARM64")
- Cryptographic algorithm usage statistics (aggregate counts, no sensitive data)
- Timestamp and beacon sequence number
- **NO personally identifiable information (PII)**
- **NO sensitive data, credentials, user content, or file names**

**Telemetry Frequency**:
- Online Mode: Every 24 hours
- Offline Mode (SCIF/Air-gapped): Annual manual audit via cryptographically signed compliance reports

**Telemetry Security**:
- Encrypted using TLS 1.3 with post-quantum key exchange (Kyber-1024)
- Signed using ML-DSA-65 (FIPS 204) to prevent tampering
- Transmitted to Licensor-controlled servers only (telemetry.souhimbou.org)
- Stored in compliance with SOC 2 Type II and FedRAMP Moderate controls

**Purpose of Telemetry**:
- License validation and feature entitlement verification
- Tamper detection and license circumvention prevention
- Cryptographic inventory monitoring for NSA CNSA 2.0 compliance
- Lattice integrity verification
- Anonymous usage analytics for product improvement

**Opt-Out**:
- Premium Edition: Telemetry is MANDATORY. Disabling telemetry will result in automatic fallback to Community Edition.
- Community Edition: Users may opt out of telemetry, but doing so may limit access to certain features, updates, or support services.

1.3 **USAGE DATA**

We automatically collect certain information when you access the Service:
- Pages visited and features used
- Time and date of access
- Compliance scan results and STIG findings (stored encrypted)
- API calls and integration activity
- Error logs and diagnostic information

1.4 **COOKIES & TRACKING TECHNOLOGIES**

We use cookies and similar tracking technologies to:
- Maintain user sessions
- Remember user preferences
- Analyze usage patterns
- Prevent fraud and abuse

You can control cookies through your browser settings, but disabling cookies may limit functionality.

================================================================================
2. HOW WE USE YOUR INFORMATION
================================================================================

We use the collected information for the following purposes:

2.1 **SERVICE DELIVERY**
- Create and manage user accounts
- Provide access to the SouHimBou.AI platform
- Process compliance scans and generate reports
- Deliver notifications and alerts
- Provide customer support

2.2 **LICENSE VALIDATION & ENFORCEMENT**
- Verify license status and feature entitlement
- Detect unauthorized use or license circumvention
- Monitor cryptographic inventory for compliance
- Enforce license terms and automatic fallback to Community Edition

2.3 **SECURITY & FRAUD PREVENTION**
- Detect and prevent unauthorized access
- Monitor for suspicious activity
- Investigate security incidents
- Comply with legal obligations

2.4 **PRODUCT IMPROVEMENT**
- Analyze usage patterns to improve features
- Identify and fix bugs
- Develop new features and enhancements
- Conduct research and development

2.5 **LEGAL COMPLIANCE**
- Comply with applicable laws and regulations
- Respond to legal requests and court orders
- Enforce our Terms of Service
- Protect our rights and property

================================================================================
3. HOW WE SHARE YOUR INFORMATION
================================================================================

We do NOT sell, rent, or trade your personal information to third parties. We may share your information in the following limited circumstances:

3.1 **SERVICE PROVIDERS**
We may share information with trusted third-party service providers who assist us in operating the Service:
- Cloud hosting providers (AWS GovCloud, Azure Government)
- Email delivery services (Supabase, Autosend)
- Analytics providers (self-hosted, privacy-focused)
- Payment processors (Stripe, for billing)

All service providers are contractually obligated to protect your information and use it only for the purposes we specify.

3.2 **GOVERNMENT ENTITIES**
If you are a U.S. Government employee or contractor, we may share information with your sponsoring agency for:
- License validation and compliance audits
- Security clearance verification
- Contract administration

3.3 **LEGAL REQUIREMENTS**
We may disclose information if required by law, court order, or government request:
- Subpoenas and court orders
- National security requests
- Law enforcement investigations
- Compliance with DoD regulations

3.4 **BUSINESS TRANSFERS**
If we are involved in a merger, acquisition, or sale of assets, your information may be transferred to the acquiring entity.

================================================================================
4. DATA RETENTION
================================================================================

We retain your information for as long as necessary to provide the Service and comply with legal obligations:

- **Account Data**: Retained for the duration of your account plus 7 years (DoD record retention requirement)
- **Telemetry Data**: Retained for 3 years for license validation and compliance audits
- **Compliance Scan Results**: Retained for 7 years (DoD audit requirement)
- **Audit Logs**: Retained for 7 years (DoD requirement)
- **Deleted Account Data**: Securely deleted within 90 days of account closure

================================================================================
5. DATA SECURITY
================================================================================

We implement industry-standard security measures to protect your information:

5.1 **ENCRYPTION**
- Data at rest: AES-256 encryption
- Data in transit: TLS 1.3 with post-quantum key exchange (Kyber-1024)
- Database encryption: Transparent Data Encryption (TDE)

5.2 **ACCESS CONTROLS**
- Role-based access control (RBAC)
- Multi-factor authentication (MFA) for admin accounts
- Principle of least privilege
- Regular access reviews

5.3 **MONITORING & INCIDENT RESPONSE**
- 24/7 security monitoring
- Intrusion detection and prevention systems (IDS/IPS)
- Incident response plan
- Regular security audits and penetration testing

5.4 **COMPLIANCE CERTIFICATIONS**
- SOC 2 Type II (in progress)
- FedRAMP Moderate (planned)
- CMMC Level 3 (planned)
- ISO 27001 (planned)

================================================================================
6. YOUR RIGHTS & CHOICES
================================================================================

6.1 **ACCESS & CORRECTION**
You have the right to access and correct your personal information. You can update your profile information through your account settings.

6.2 **DATA PORTABILITY**
You have the right to export your data in a machine-readable format (JSON, CSV).

6.3 **DELETION**
You have the right to request deletion of your account and personal information, subject to legal retention requirements.

6.4 **OPT-OUT**
- **Marketing Communications**: You can opt out of marketing emails by clicking the "unsubscribe" link.
- **Telemetry (Community Edition only)**: You can opt out of telemetry beacons, but this may limit functionality.
- **Telemetry (Premium Edition)**: Telemetry is MANDATORY and cannot be disabled.

6.5 **DO NOT TRACK**
We do not respond to "Do Not Track" signals because there is no industry standard for compliance.

================================================================================
7. CHILDREN'S PRIVACY
================================================================================

The Service is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you believe we have collected information from a child under 13, please contact us immediately.

================================================================================
8. INTERNATIONAL DATA TRANSFERS
================================================================================

Your information may be transferred to and processed in the United States. By using the Service, you consent to the transfer of your information to the United States.

For users in the European Union, we comply with the EU-U.S. Data Privacy Framework (if applicable).

================================================================================
9. CALIFORNIA PRIVACY RIGHTS (CCPA)
================================================================================

If you are a California resident, you have the following rights under the California Consumer Privacy Act (CCPA):

- **Right to Know**: Request disclosure of personal information collected
- **Right to Delete**: Request deletion of personal information
- **Right to Opt-Out**: Opt out of the sale of personal information (we do not sell personal information)
- **Right to Non-Discrimination**: Not be discriminated against for exercising your rights

To exercise these rights, contact us at privacy@souhimbou.ai.

================================================================================
10. CHANGES TO THIS PRIVACY POLICY
================================================================================

We may update this Privacy Policy from time to time. We will notify you of material changes by:
- Posting the updated policy on our website
- Sending an email notification to your registered email address
- Displaying a prominent notice in the Service

Your continued use of the Service after changes constitutes acceptance of the updated Privacy Policy.

================================================================================
11. CONTACT US
================================================================================

If you have questions about this Privacy Policy or our data practices, contact us:

**SecRed Knowledge Inc. dba NouchiX**  
401 New Karner Rd, Suite 301  
Albany, NY 12205  
Email: nouchix@souhimbou.ai  
Phone: (518) 528-4019  
Website: https://souhimbou.ai

**Data Protection Officer**:  
Email: ai-nativevc@souhimbou.ai

================================================================================

**Copyright Notice**:  
© 2024-2026 SecRed Knowledge Inc. All Rights Reserved.
