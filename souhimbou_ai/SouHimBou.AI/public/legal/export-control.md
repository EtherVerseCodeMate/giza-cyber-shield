EXPORT CONTROL COMPLIANCE (ECCN 5D992)
================================================================================

**Effective Date**: January 31, 2026  
**Last Updated**: January 31, 2026  
**Agreement Type**: Export Control and International Trade Compliance  
**Classification**: CUI // NOFORN  
**ECCN**: 5D992 (Mass Market Encryption Software)

This Export Control Compliance Agreement governs the export, re-export, and transfer of the Khepra Protocol software and SouHimBou.AI platform in compliance with U.S. export control laws and regulations.

BY ACCESSING OR USING THE SOFTWARE, YOU CERTIFY THAT YOU COMPLY WITH ALL APPLICABLE EXPORT CONTROL LAWS AND REGULATIONS.

================================================================================
1. EXPORT CONTROL CLASSIFICATION
================================================================================

1.1 **EXPORT CONTROL CLASSIFICATION NUMBER (ECCN)**

The Software is classified under the Export Administration Regulations (EAR) as:

**ECCN 5D992** - Information Security Software (Mass Market)

**Classification Rationale**:
- The Software uses encryption for authentication, digital signatures, and data protection
- The Software is publicly available or will be made publicly available
- The Software qualifies for "mass market" treatment under EAR 740.17(b)
- The Software does not require an export license for most destinations

1.2 **ENCRYPTION ALGORITHMS**

The Software uses the following encryption algorithms:

**Symmetric Encryption**:
- AES-256 (FIPS 197)
- ChaCha20-Poly1305 (RFC 8439)

**Asymmetric Encryption (Post-Quantum)**:
- Kyber-1024 (NIST FIPS 203) - Key Encapsulation Mechanism
- ML-DSA-65 (NIST FIPS 204) - Digital Signatures
- SLH-DSA (NIST FIPS 205) - Stateless Hash-Based Signatures

**Hash Functions**:
- SHA3-256, SHA3-512 (FIPS 202)
- BLAKE3

**Key Derivation**:
- HKDF (HMAC-based Key Derivation Function, RFC 5869)
- Argon2id (Password hashing)

1.3 **ENCRYPTION REGISTRATION**

Licensor has registered the Software's encryption capabilities with the Bureau of Industry and Security (BIS) in accordance with EAR 742.15(b).

**Registration Number**: [To be assigned by BIS]  
**Registration Date**: [Pending]

================================================================================
2. EXPORT RESTRICTIONS
================================================================================

2.1 **PROHIBITED DESTINATIONS**

You SHALL NOT export, re-export, or transfer the Software to the following countries subject to U.S. trade embargoes or sanctions:

**Embargoed Countries** (as of January 2026):
- Cuba
- Iran
- North Korea (Democratic People's Republic of Korea)
- Syria
- Crimea region of Ukraine
- So-called Donetsk People's Republic (DNR)
- So-called Luhansk People's Republic (LNR)
- Russia
- China
- Belarus
- Venezuela
- Pending/Others/Ad Hoc

**Note**: This list is subject to change. Check the U.S. Treasury Department's Office of Foreign Assets Control (OFAC) website for current sanctions: https://www.treasury.gov/ofac

2.2 **PROHIBITED END-USERS**

You SHALL NOT export, re-export, or transfer the Software to:

**Denied Persons**:
- Entities on the U.S. Commerce Department's Denied Persons List
- Entities on the U.S. Commerce Department's Entity List
- Entities on the U.S. Treasury Department's Specially Designated Nationals (SDN) List
- Entities on the U.S. State Department's Debarred Parties List

**Weapons Proliferation**:
- Entities involved in the design, development, or production of nuclear weapons
- Entities involved in the design, development, or production of chemical weapons
- Entities involved in the design, development, or production of biological weapons
- Entities involved in missile technology proliferation

**Terrorism**:
- Foreign terrorist organizations (FTOs)
- State sponsors of terrorism
- Entities providing material support to terrorism
- Advanced Persistent Threats (APTs)
- Cyberterrorists
- Hacktivists
- Cybercriminals
- Related entities to the above groups

2.3 **PROHIBITED END-USES**

You SHALL NOT use the Software for:
- Development, production, or use of nuclear, chemical, or biological weapons
- Development, production, or use of missile technology
- Terrorism or support of terrorist activities
- Cyberterrorism
- Hacktivism
- Cybercrime
- Violation of human rights or international humanitarian law
- Circumvention of U.S. export controls

================================================================================
3. LICENSE EXCEPTIONS & AUTHORIZATIONS
================================================================================

3.1 **LICENSE EXCEPTION TSU (TECHNOLOGY AND SOFTWARE UNRESTRICTED)**

The Software may qualify for License Exception TSU under EAR 740.13(e) for:
- Publicly available encryption source code
- Mass market encryption software
- Encryption commodities and software with symmetric key length ≤ 512 bits

3.2 **LICENSE EXCEPTION ENC (ENCRYPTION COMMODITIES, SOFTWARE, AND TECHNOLOGY)**

The Software may qualify for License Exception ENC under EAR 740.17 for:
- Mass market encryption software
- Encryption software publicly available or will be made publicly available
- Encryption software with key length ≤ 512 bits (symmetric) or ≤ 15,360 bits (asymmetric)

**Note**: Post-quantum algorithms (Kyber-1024, ML-DSA-65) may require additional review.

3.3 **SELF-CLASSIFICATION**

Licensee is responsible for:
- Determining the appropriate export classification for their use case
- Obtaining necessary export licenses (if required)
- Complying with all applicable export control regulations
- Maintaining records of export transactions

================================================================================
4. END-USER CERTIFICATION
================================================================================

4.1 **CERTIFICATION REQUIREMENTS**

By using the Software, you certify that:

- [ ] You are NOT located in, under the control of, or a national or resident of any embargoed country
- [ ] You are NOT on any U.S. Government list of prohibited or restricted parties (Denied Persons List, Entity List, SDN List)
- [ ] You will NOT export, re-export, or transfer the Software to any prohibited destination or end-user
- [ ] You will NOT use the Software for any prohibited end-use (weapons proliferation, terrorism, etc.)
- [ ] You will comply with all applicable export control laws and regulations
- [ ] You will obtain necessary export licenses before exporting the Software
- [ ] You will not circumvent U.S. export controls

4.2 **FALSE CERTIFICATION**

Providing false certification is a violation of U.S. export control laws and may result in:
- Civil penalties up to $300,000 per violation
- Criminal penalties up to $1,000,000 per violation and 20 years imprisonment
- Denial of export privileges
- Debarment from U.S. Government contracts

================================================================================
5. DEEMED EXPORTS
================================================================================

5.1 **DEEMED EXPORT DEFINITION**

A "deemed export" occurs when:
- Technology or source code is released to a foreign national in the United States
- A foreign national has access to controlled technology or source code

5.2 **DEEMED EXPORT RESTRICTIONS**

If you employ foreign nationals who will have access to the Software's source code or technical data:
- You must determine the foreign national's country of citizenship
- You must verify that the deemed export is authorized under EAR
- You may need to obtain a deemed export license

5.3 **DEEMED EXPORT EXCEPTIONS**

Deemed exports may be authorized under:
- License Exception TSU (for publicly available source code)
- License Exception ENC (for mass market encryption software)
- General license for certain countries (Canada, UK, Australia, etc.)

================================================================================
6. RECORDKEEPING & REPORTING
================================================================================

6.1 **RECORDKEEPING REQUIREMENTS**

You must maintain records of:
- Export transactions (destination, end-user, end-use)
- Export licenses and authorizations
- End-user certifications and statements
- Compliance training and procedures

Records must be retained for 5 years from the date of export.

6.2 **REPORTING REQUIREMENTS**

You must report to Licensor:
- Any export to a country of concern (China, Russia, etc.)
- Any export to a government end-user
- Any suspected violations of export control laws
- Any requests for export licenses
- Any export to a foreign national in the United States
- Any export to a foreign national outside the United States
- Any breach of this agreement
- Any inquiry from a government agency regarding export controls
- Any suspected security breaches
- Any incident response activities, events, and/or related situations
- Any qualified incidents, events, occurrences, situation not explicitly excluded from the definition of a security incident in this Agreement.

6.3 **VOLUNTARY SELF-DISCLOSURE**

If you discover a potential export control violation, you should:
- Immediately cease the violating activity
- Conduct an internal investigation
- File a Voluntary Self-Disclosure (VSD) with BIS
- Notify Licensor of the violation

================================================================================
7. INTERNATIONAL TRAFFIC IN ARMS REGULATIONS (ITAR)
================================================================================

7.1 **ITAR APPLICABILITY**

The Software is NOT subject to the International Traffic in Arms Regulations (ITAR) because:
- The Software is not specifically designed or modified for military use
- The Software does not contain defense articles or defense services
- The Software is controlled under EAR, not ITAR

7.2 **ITAR TRANSITION**

If the Software is modified for military use or incorporated into a defense article:
- The modified software may become subject to ITAR
- You must notify Licensor of the ITAR transition
- You must obtain necessary ITAR licenses and authorizations

================================================================================
8. FOREIGN DIRECT PRODUCT RULE (FDPR)
================================================================================

8.1 **FDPR APPLICABILITY**

The Foreign Direct Product Rule (FDPr) may apply if:
- The Software is used to produce foreign-made items
- The foreign-made items are subject to EAR
- The foreign-made items are destined for prohibited end-users or end-uses

8.2 **FDPR COMPLIANCE**

If FDPR applies, you must:
- Determine if the foreign-made items require an export license
- Obtain necessary export licenses before exporting foreign-made items
- Comply with all applicable EAR restrictions

================================================================================
9. SANCTIONS & PENALTIES
================================================================================

9.1 **CIVIL PENALTIES**

Violations of export control laws may result in civil penalties:
- Up to $300,000 per violation (adjusted for inflation)
- Denial of export privileges
- Exclusion from U.S. Government contracts

9.2 **CRIMINAL PENALTIES**

Willful violations of export control laws may result in criminal penalties:
- Fines up to $1,000,000 per violation
- Imprisonment up to 20 years
- Forfeiture of property used in the violation

9.3 **ADMINISTRATIVE PENALTIES**

BIS may impose administrative penalties:
- Denial orders (prohibition on export privileges)
- Temporary denial orders (TDO)
- Entity List designation
- Unverified List designation

================================================================================
10. COMPLIANCE PROGRAM
================================================================================

10.1 **EXPORT COMPLIANCE PROGRAM ELEMENTS**

Licensee should implement an export compliance program including:
- Written export control policies and procedures
- Export control training for employees
- Screening of transactions against denied parties lists
- Recordkeeping and audit procedures
- Periodic compliance reviews and audits

10.2 **SCREENING TOOLS**

Licensee should use the following screening tools:
- BIS Denied Persons List: https://www.bis.doc.gov/dpl/default.shtm
- OFAC SDN List: https://www.treasury.gov/ofac/downloads/sdnlist.txt
- Consolidated Screening List: https://www.trade.gov/consolidated-screening-list
- Entity List: https://www.bis.doc.gov/index.php/policy-guidance/lists-of-parties-of-concern/entity-list
- Unverified List: https://www.bis.doc.gov/index.php/policy-guidance/lists-of-parties-of-concern/unverified-list
- Debarred Parties List: https://www.pmddtc.state.gov/compliance/debar_list.html
- ITAR Debarred Parties List: https://www.pmddtc.state.gov/compliance/debar_list.html
- ITAR Debarred Parties List: https://www.pmddtc.state.gov/compliance/debar_list.html
- FBI List of Parties of Concern: https://www.fbi.gov/services/intelligence/national-security-branch/counterintelligence-division/list-of-parties-of-concern


10.3 **COMPLIANCE TRAINING**

Licensor provides export compliance training resources:
- Export control overview and best practices
- ECCN classification and license determination
- Screening procedures and denied parties lists
- Recordkeeping and reporting requirements

================================================================================
11. CHANGES TO EXPORT CONTROL LAWS
================================================================================

11.1 **REGULATORY UPDATES**

Export control laws and regulations are subject to change. Licensee is responsible for:
- Monitoring changes to export control regulations
- Updating compliance procedures accordingly
- Obtaining necessary licenses for new restrictions

11.2 **NOTIFICATION OF CHANGES**

Licensor will notify Licensee of material changes to:
- ECCN classification
- Encryption algorithms or key lengths
- Export control restrictions

================================================================================
12. CONTACT INFORMATION
================================================================================

**Export Compliance Officer**:  
SecRed Knowledge Inc. dba NouchiX  
401 New Karner Rd, Suite 301  
Albany, NY 12205  
Email: support@souhimbou.ai  
Phone: (518) 528-4019

**U.S. Government Resources**:
- Bureau of Industry and Security (BIS): https://www.bis.doc.gov
- Office of Foreign Assets Control (OFAC): https://www.treasury.gov/ofac
- Directorate of Defense Trade Controls (DDTC): https://www.pmddtc.state.gov

================================================================================

**Copyright Notice**:  
© 2024-2026 SecRed Knowledge Inc. All Rights Reserved.

**EXPORT CONTROL NOTICE**:  
This software is subject to U.S. export control laws and regulations. Export, re-export, or transfer of this software to prohibited destinations or end-users is strictly prohibited.

**ECCN 5D992** - Mass Market Encryption Software
