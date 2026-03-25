"""
Compliance control id catalogue.

Every check in a validator can reference one or more control ids from this
catalogue.  The CLI ``--framework`` filter uses these mappings.

Control families
----------------
NIST 800-171 Rev.2     3.x.x
NIST 800-172           3.x.xe  (enhanced)
NIST 800-53 Rev.5      XX-nn   (FedRAMP baseline)
CMMC L2                XX.L2-3.x.x
CMMC L3                XX.L3-3.x.xe
SOC-2 Type II          CCx.x / Ax.x
ISO 27001:2022         A.x.x
DoD IL4/IL5            SRG-xxx
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# Control id constants (used in validators)
# ---------------------------------------------------------------------------

# Access Control
AC_L2_3_1_1 = "AC.L2-3.1.1"       # Authorized access control
AC_L2_3_1_2 = "AC.L2-3.1.2"       # Transaction & function control
AC_L2_3_1_5 = "AC.L2-3.1.5"       # Least privilege
AC_L2_3_1_7 = "AC.L2-3.1.7"       # Privileged functions
AC_2 = "AC-2"                       # Account management (FedRAMP)
AC_3 = "AC-3"                       # Access enforcement
AC_6 = "AC-6"                       # Least privilege
AC_17 = "AC-17"                     # Remote access

# Audit & Accountability
AU_L2_3_3_1 = "AU.L2-3.3.1"       # System auditing
AU_L2_3_3_2 = "AU.L2-3.3.2"       # User accountability
AU_2 = "AU-2"                       # Audit events
AU_3 = "AU-3"                       # Audit record content
AU_6 = "AU-6"                       # Audit review
AU_9 = "AU-9"                       # Protection of audit info
AU_11 = "AU-11"                     # Audit retention
AU_12 = "AU-12"                     # Audit generation

# Identification & Authentication
IA_L2_3_5_1 = "IA.L2-3.5.1"       # Identification
IA_L2_3_5_2 = "IA.L2-3.5.2"       # Authentication
IA_L2_3_5_3 = "IA.L2-3.5.3"       # MFA
IA_2 = "IA-2"                       # User identification & auth
IA_5 = "IA-5"                       # Authenticator management
IA_8 = "IA-8"                       # Non-org user identification

# System & Communications Protection
SC_L2_3_13_1 = "SC.L2-3.13.1"     # Boundary protection
SC_L2_3_13_8 = "SC.L2-3.13.8"     # CUI on public networks
SC_L2_3_13_11 = "SC.L2-3.13.11"   # CUI encryption
SC_7 = "SC-7"                       # Boundary protection
SC_8 = "SC-8"                       # Transmission confidentiality
SC_12 = "SC-12"                     # Key management
SC_13 = "SC-13"                     # Cryptographic protection
SC_28 = "SC-28"                     # Protection of info at rest

# System & Information Integrity
SI_L2_3_14_1 = "SI.L2-3.14.1"     # Flaw remediation
SI_L2_3_14_2 = "SI.L2-3.14.2"     # Malicious code protection
SI_L2_3_14_6 = "SI.L2-3.14.6"     # Security alerts
SI_2 = "SI-2"                       # Flaw remediation
SI_4 = "SI-4"                       # System monitoring
SI_7 = "SI-7"                       # Software integrity

# Configuration Management
CM_L2_3_4_1 = "CM.L2-3.4.1"       # System baselining
CM_L2_3_4_2 = "CM.L2-3.4.2"       # Security config enforcement
CM_2 = "CM-2"                       # Baseline configuration
CM_6 = "CM-6"                       # Configuration settings
CM_8 = "CM-8"                       # Component inventory

# Media Protection & Physical
MP_L2_3_8_6 = "MP.L2-3.8.6"       # CUI portability encryption
PE_L2_3_10_1 = "PE.L2-3.10.1"     # Physical access

# Incident Response
IR_L2_3_6_1 = "IR.L2-3.6.1"       # Incident handling
IR_4 = "IR-4"                       # Incident handling
IR_6 = "IR-6"                       # Incident reporting

# Risk Assessment
RA_L2_3_11_1 = "RA.L2-3.11.1"     # Risk assessments
RA_L2_3_11_2 = "RA.L2-3.11.2"     # Vulnerability scanning
RA_5 = "RA-5"                       # Vulnerability monitoring

# Personnel Security
PS_L2_3_9_2 = "PS.L2-3.9.2"       # CUI during personnel actions

# NIST 800-172 Enhanced (CMMC L3)
E_3_1_1e = "AC.L3-3.1.1e"          # Enhanced access control
E_3_1_2e = "AC.L3-3.1.2e"          # Dual authorization
E_3_4_1e = "CM.L3-3.4.1e"          # Enhanced config mgmt
E_3_5_1e = "IA.L3-3.5.1e"          # Enhanced identification
E_3_13_1e = "SC.L3-3.13.1e"        # Enhanced boundary protection
E_3_14_1e = "SI.L3-3.14.1e"        # Enhanced integrity

# SOC-2 Type II Trust Service Criteria
SOC2_CC6_1 = "CC6.1"    # Logical & physical access
SOC2_CC6_3 = "CC6.3"    # Role-based access
SOC2_CC6_6 = "CC6.6"    # Restrictions on external threats
SOC2_CC6_7 = "CC6.7"    # Restrict data movement
SOC2_CC7_1 = "CC7.1"    # Detect configuration changes
SOC2_CC7_2 = "CC7.2"    # Monitor for anomalies
SOC2_CC7_3 = "CC7.3"    # Evaluate security events
SOC2_CC7_4 = "CC7.4"    # Respond to incidents
SOC2_CC8_1 = "CC8.1"    # Change management
SOC2_A1_2 = "A1.2"      # Recovery mechanisms

# ISO 27001:2022 / 27003 Annex A
ISO_A5_2 = "A.5.2"       # Information security roles
ISO_A5_15 = "A.5.15"     # Access control
ISO_A5_23 = "A.5.23"     # Cloud service security
ISO_A5_28 = "A.5.28"     # Evidence collection
ISO_A8_1 = "A.8.1"       # User endpoint devices
ISO_A8_9 = "A.8.9"       # Configuration management
ISO_A8_10 = "A.8.10"     # Information deletion
ISO_A8_12 = "A.8.12"     # Data leakage prevention
ISO_A8_15 = "A.8.15"     # Logging
ISO_A8_20 = "A.8.20"     # Network security
ISO_A8_24 = "A.8.24"     # Use of cryptography
ISO_A8_25 = "A.8.25"     # Secure development lifecycle
ISO_A8_28 = "A.8.28"     # Secure coding

# DoD IL4/IL5 (CC SRG)
IL_SRG_APP_000001 = "SRG-APP-000001"    # Session management
IL_SRG_APP_000014 = "SRG-APP-000014"    # Audit content
IL_SRG_APP_000023 = "SRG-APP-000023"    # Encryption in transit
IL_SRG_APP_000033 = "SRG-APP-000033"    # Authentication
IL_SRG_APP_000148 = "SRG-APP-000148"    # Key management
IL_SRG_APP_000175 = "SRG-APP-000175"    # Flaw remediation
IL_SRG_APP_000231 = "SRG-APP-000231"    # Boundary protection
IL_SRG_APP_000516 = "SRG-APP-000516"    # Encryption at rest


# ---------------------------------------------------------------------------
# Framework filter — given a framework name return matching prefixes
# ---------------------------------------------------------------------------

FRAMEWORK_PREFIXES = {
    "cmmc-l2": ("AC.L2", "AU.L2", "IA.L2", "SC.L2", "SI.L2", "CM.L2",
                "MP.L2", "PE.L2", "IR.L2", "RA.L2", "PS.L2"),
    "cmmc-l3": ("AC.L3", "CM.L3", "IA.L3", "SC.L3", "SI.L3"),
    "fedramp-high": ("AC-", "AU-", "IA-", "SC-", "SI-", "CM-", "IR-", "RA-"),
    "nist-171": ("AC.L2-3.", "AU.L2-3.", "IA.L2-3.", "SC.L2-3.",
                 "SI.L2-3.", "CM.L2-3.", "MP.L2-3.", "PE.L2-3.",
                 "IR.L2-3.", "RA.L2-3.", "PS.L2-3."),
    "nist-172": ("AC.L3-3.", "CM.L3-3.", "IA.L3-3.", "SC.L3-3.",
                 "SI.L3-3."),
    "soc2": ("CC", "A1."),
    "iso-27001": ("A.",),
    "il4": ("SRG-",),
    "il5": ("SRG-",),
}


def controls_for_framework(framework: str, controls: list[str]) -> list[str]:
    """Filter a list of control ids to those matching *framework*."""
    prefixes = FRAMEWORK_PREFIXES.get(framework.lower(), ())
    if not prefixes:
        return controls  # unknown framework — return all
    return [c for c in controls if any(c.startswith(p) for p in prefixes)]
