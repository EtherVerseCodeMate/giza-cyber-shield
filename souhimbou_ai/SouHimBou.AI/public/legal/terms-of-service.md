ADINKHEPRA MASTER LICENSE AGREEMENT (v3.0)
================================================================================

**Effective Date**: January 31, 2026  
**Last Updated**: January 31, 2026  
**Agreement Type**: Commercial Software License  
**Classification**: CUI // NOFORN

This MASTER LICENSE AGREEMENT ("Agreement") is a binding legal contract between SecRed Knowledge Inc. dba NouchiX ("Licensor"), a Delaware Corporation, and the entity or individual accessing the Software ("Licensee").

**RELATIONSHIP TO GOVERNMENT CONTRACTS**:  
If Licensee is a United States Government entity or operating under a prime contract for the Government, SECTION 3 (U.S. GOVERNMENT RIGHTS) specifically supersedes any conflicting commercial terms, in accordance with DFARS 227.7202-3.

================================================================================
1. DEFINITIONS
================================================================================

1.1 **"Software"** means the KHEPRA protocol binaries, source code (where applicable), logic, and documentation, including but not limited to:
    (a) "Khepra Core" (adinkhepra.exe) - The cryptographic engine.
    (b) "Sonar Agent" (sonar.exe) - The diagnostic sensor.
    (c) "Adinkra PQC" - The underlying cryptographic libraries.
    (d) "SouHimBou.AI Platform" - The web-based compliance automation platform.
    (e) "Khepra-Edge": Deployment on air-gapped systems pursuant to a specific Purchase Order.
    (f) "Khepra-Hybrid": Deployment on corporate networks for internal auditing.
    (g) "Khepra-Sovereign": Deployment within a dedicated Virtual Private Cloud (VPC).
    (h) "SouHimBou.AI": Access via web browser for compliance automation and STIG management.
    (i) "IP & Proprietary Artifacts": Any other NouchiX owned creation.


1.2 **"Symbolic Attestation Logic"** means the proprietary algorithms, heuristic models, and risk scoring methodologies embedded within the Software. THIS LOGIC IS A TRADE SECRET OF LICENSOR.

1.3 **"Authorized Use"** means:
    (a) For "Khepra-Edge": Deployment on air-gapped systems pursuant to a specific Purchase Order.
    (b) For "Khepra-Hybrid": Deployment on corporate networks for internal auditing.
    (c) For "Khepra-Sovereign": Deployment within a dedicated Virtual Private Cloud (VPC).
    (d) For "SouHimBou.AI": Access via web browser for compliance automation and STIG management.

1.4 **"Community Edition"** means the Software version utilizing open-source cryptographic libraries (OpenSSL, LibreSSL) without proprietary post-quantum cryptography (PQC) features.

1.5 **"Premium Edition"** means the Software version utilizing proprietary AdinKhepra-PQC Lattice cryptography, requiring active license validation via telemetry.

1.6 **"Telemetry Beacon"** means the periodic anonymous data transmission to Licensor's secure servers (telemetry.souhimbou.org) for license validation, feature entitlement verification, and cryptographic inventory monitoring.

================================================================================
2. COMMERCIAL LICENSE GRANT
================================================================================

2.1 **LICENSE**. Subject to payment of applicable fees (if any), Licensor grants Licensee a non-exclusive, non-transferable, non-sublicensable, limited license to install and execute the Software solely for Licensee's Internal Business Purposes.

2.2 **COMMUNITY EDITION LICENSE**. The Community Edition is provided free of charge for evaluation, testing, and non-commercial use. Commercial use of the Community Edition requires a separate commercial license agreement.

2.3 **PREMIUM EDITION LICENSE**. The Premium Edition requires:
    (a) Active subscription or perpetual license with current maintenance
    (b) Valid license key cryptographically signed by Licensor
    (c) Periodic telemetry beacon validation (online or offline)
    (d) Compliance with all terms of this Agreement

2.4 **RESTRICTIONS**. Licensee SHALL NOT, and shall not permit any third party to:
    (a) Reverse engineer, decompile, disassemble, or derive source code from the Software, especially the "Symbolic Attestation Logic";
    (b) Modify, translate, or create derivative works of the Software;
    (c) Remove any proprietary notices, labels, or "Poetic Obfuscation" markers;
    (d) Publish benchmarks or performance analysis without prior written consent;
    (e) Use the Software to build a competitive product or service;
    (f) Circumvent any license keys, encryption, or "Tier 0" protections;
    (g) Disable, bypass, or interfere with telemetry beacons or license validation mechanisms;
    (h) Share, transfer, or sublicense the Software or license keys to unauthorized parties.

2.5 **RESERVATION OF RIGHTS**. The Software is licensed, not sold. Licensor retains all ownership, intellectual property rights, and title to the Software. All rights not expressly granted herein are reserved by Licensor.

2.6 **AUTOMATIC FALLBACK**. If Premium Edition license validation fails (due to expired license, network connectivity issues, or license violation), the Software will automatically fallback to Community Edition functionality. This fallback is not a breach of contract but a license enforcement mechanism.

================================================================================
3. TELEMETRY & LICENSE ENFORCEMENT
================================================================================

3.1 **MANDATORY TELEMETRY BEACON**. Licensee acknowledges and agrees that the Software transmits periodic anonymous telemetry beacons ("Heartbeats") to Licensor's secure servers (telemetry.souhimbou.org) for the following purposes:

    (a) **License Validation**: Verifying license status, feature entitlement, and subscription validity.
    (b) **Tamper Detection**: Detecting unauthorized modification, license circumvention, or cryptographic integrity violations.
    (c) **Cryptographic Inventory**: Monitoring post-quantum cryptography (PQC) deployment for compliance with NSA CNSA 2.0 transition timelines.
    (d) **Lattice Integrity**: Ensuring the integrity of the AdinKhepra-PQC Lattice and detecting anomalous cryptographic behavior.
    (e) **Usage Analytics**: Collecting anonymous usage statistics for product improvement (no personally identifiable information is transmitted).

3.2 **DATA TRANSMITTED**. Telemetry beacons transmit the following data:
    - License key hash (cryptographically anonymized)
    - Software version and edition (Community vs. Premium)
    - Machine ID (cryptographically derived, non-reversible)
    - Operating system and architecture
    - Cryptographic algorithm usage statistics (aggregate, non-sensitive)
    - Timestamp and beacon sequence number
    - NO personally identifiable information (PII)
    - NO sensitive data, credentials, or user content

3.3 **TELEMETRY FREQUENCY**. Telemetry beacons are transmitted:
    - **Online Mode**: Every 24 hours (configurable by Licensor)
    - **Offline Mode**: Manual validation via cryptographically signed license files (annual audit required)

3.4 **AIR-GAPPED ENVIRONMENTS (SCIF)**. For deployments in Sensitive Compartmented Information Facilities (SCIF) or other air-gapped environments where online telemetry is prohibited:

    (a) Licensee must utilize the "Offline License Validation" mechanism via cryptographically signed license files.
    (b) Licensee agrees to perform manual periodic audits using the "Sonar" agent and submit cryptographically signed compliance reports to Licensor via secure offline channels (e.g., SIPRNET, JWICS, or physical media).
    (c) Failure to submit annual offline audit reports may result in termination of the license.

3.5 **TELEMETRY SECURITY**. All telemetry beacons are:
    - Encrypted using TLS 1.3 with post-quantum key exchange (Kyber-1024)
    - Signed using ML-DSA-65 (FIPS 204) to prevent tampering
    - Transmitted to Licensor-controlled servers only (telemetry.souhimbou.org)
    - Stored in compliance with SOC 2 Type II and FedRAMP Moderate controls

3.6 **NO OPT-OUT FOR PREMIUM EDITION**. Telemetry beacons are MANDATORY for Premium Edition functionality. Disabling, bypassing, or interfering with telemetry beacons constitutes a material breach of this Agreement and will result in automatic fallback to Community Edition.

3.7 **COMMUNITY EDITION TELEMETRY**. Community Edition users may opt out of telemetry beacons, but doing so may limit access to certain features, updates, or support services.

================================================================================
4. INTELLECTUAL PROPERTY & TRADE SECRETS
================================================================================

4.1 **PROPRIETARY ALGORITHMS**. The Software contains valuable Trade Secrets of the Licensor, including:
    - AdinKhepra-PQC Lattice reduction algorithms
    - Symbolic Attestation Logic for compliance risk scoring
    - Poetic Obfuscation techniques for white-box cryptography
    - Khepra-Sonar drift detection heuristics

4.2 **CONFIDENTIALITY OBLIGATIONS**. Licensee agrees to:
    (a) Hold all Confidential Information in strict confidence
    (b) Take all reasonable steps to prevent disclosure or distribution by employees or agents
    (c) Not disclose, publish, or share any reverse-engineered information
    (d) Limit access to the Software to authorized personnel only

4.3 **FEDERAL PROTECTION**. This software is protected under multiple Federal statutes:
    (a) **Economic Espionage Act (18 U.S.C. 1831-1839)**: Trade secret protection for proprietary lattice reduction algorithms. Violations carry penalties up to $5,000,000 fine and 10 years imprisonment.
    (b) **DMCA Anti-Circumvention (17 U.S.C. 1201)**: Prohibition on circumvention of license validation mechanisms.
    (c) **DoD FAR Supplement (DFARS 252.227-7013, 252.227-7015)**: Restricted rights in technical data and computer software.

================================================================================
5. WARRANTY DISCLAIMER & LIABILITY
================================================================================

5.1 **"AS IS" WARRANTY**. THE SOFTWARE IS PROVIDED "AS IS". LICENSOR DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE. NO WARRANTY IS MADE THAT THE SOFTWARE IS QUANTUM-PROOF IN PERPETUITY.

5.2 **BETA SOFTWARE**. Licensee acknowledges that the Software may be in beta, pre-release, or early access status. Beta software is provided for testing and evaluation purposes only and may contain bugs, errors, or incomplete features.

5.3 **LIMITATION OF LIABILITY**. IN NO EVENT SHALL LICENSOR BE LIABLE FOR ANY INDIRECT, SPECIAL, INCIDENTAL, OR CONSEQUENTIAL DAMAGES. LICENSOR'S TOTAL LIABILITY SHALL NOT EXCEED THE FEES PAID BY LICENSEE IN THE 12 MONTHS PRECEDING THE CLAIM.

5.4 **GOVERNMENT USE DISCLAIMER**. If Licensee is a U.S. Government entity, Licensor makes no warranties beyond those required by applicable Federal Acquisition Regulations (FAR).

================================================================================
6. TERM AND TERMINATION
================================================================================

6.1 **TERM**. This Agreement is effective until terminated.

6.2 **TERMINATION BY LICENSOR**. Licensor may terminate this Agreement immediately if Licensee:
    (a) Breaches any provision of this Agreement
    (b) Circumvents license validation or telemetry mechanisms
    (c) Reverse engineers or attempts to extract Trade Secrets
    (d) Uses the Software for unauthorized purposes

6.3 **TERMINATION BY LICENSEE**. Licensee may terminate this Agreement at any time by ceasing all use of the Software and destroying all copies.

6.4 **EFFECT OF TERMINATION**. Upon termination:
    (a) Licensee must immediately cease all use of the Software
    (b) Licensee must destroy all copies of the Software and confirm destruction in writing
    (c) All licenses granted herein are revoked
    (d) Sections 4 (Intellectual Property), 5 (Warranty Disclaimer), and 7 (Export Control) survive termination

================================================================================
7. EXPORT CONTROL
================================================================================

7.1 **EXPORT CONTROL CLASSIFICATION**. The Software is subject to the Export Administration Regulations (EAR) of the United States.

    **EXPORT CONTROL CLASSIFICATION NUMBER (ECCN)**: 5D992 (Mass Market / Anti-Terrorism)

7.2 **EXPORT RESTRICTIONS**. Licensee shall not export, re-export, or transfer the Software to:
    (a) Any country subject to U.S. trade embargoes or sanctions
    (b) Any country involved in the production of nuclear, chemical, or biological weapons
    (c) Any entity on the U.S. Treasury Department's Specially Designated Nationals (SDN) List
    (d) Any entity on the U.S. Commerce Department's Denied Persons List or Entity List

7.3 **END-USER CERTIFICATION**. Licensee certifies that it is not located in, under the control of, or a national or resident of any restricted country, and is not on any U.S. Government list of prohibited or restricted parties.

================================================================================
8. GOVERNING LAW & DISPUTE RESOLUTION
================================================================================

8.1 **GOVERNING LAW**. This Agreement shall be governed by the laws of the State of Delaware, without regard to its conflict of law provisions.

8.2 **JURISDICTION**. Any disputes arising under this Agreement shall be subject to the exclusive jurisdiction of the state and federal courts located in Delaware.

8.3 **GOVERNMENT CONTRACTS**. If Licensee is a U.S. Government entity, disputes shall be resolved in accordance with the Contract Disputes Act (41 U.S.C. 7101 et seq.).

================================================================================
9. ENTIRE AGREEMENT
================================================================================

This Agreement constitutes the entire agreement between the parties relative to the subject matter hereof and supersedes all prior or contemporaneous agreements, whether written or oral.

================================================================================
10. ACCEPTANCE
================================================================================

BY CLICKING "ACCEPT", INSTALLING, OR USING THE SOFTWARE, LICENSEE ACKNOWLEDGES THAT IT HAS READ, UNDERSTOOD, AND AGREES TO BE BOUND BY ALL TERMS AND CONDITIONS OF THIS AGREEMENT.

If you do not agree to these terms, DO NOT install, access, or use the Software.

================================================================================

**Licensor Contact Information**:  
SecRed Knowledge Inc. dba NouchiX  
401 New Karner Rd, Suite 301  
Albany, NY 12205  
Email: legal@souhimbou.ai  
Website: https://souhimbou.ai

**Copyright Notice**:  
© 2024-2026 SecRed Knowledge Inc. All Rights Reserved.

**Restricted Rights Legend**:  
Use, duplication, or disclosure by the Government is subject to restrictions as set forth in paragraph (b)(3) of the Rights in Noncommercial Computer Software and Noncommercial Computer Software Documentation clause at DFARS 252.227-7014.
