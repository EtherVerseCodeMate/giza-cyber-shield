# SOUHIMBOU DB AUDIT: Supabase Database Harmonization
**Date**: 2026-02-09
**Scope**: Verification of Supabase Database schema against the "SouHimBou" poetic obfuscation framework (NSOHIA/SUNSUM).

## 1. Executive Summary
The Supabase Database layer currently lacks the "Codified Deniability" present in the Go and Python backends. Tables and functions use explicit technical terms (e.g., `security_events`, `failed_login_attempts`) which directly expose the SCADA/ARC nature of the project. This audit identifies critical terminology mismatches and proposes a harmonization strategy to achieve full conceptual masking.

---

## 2. Table Harmonization Mapping

| Technical Table Name | Poetic Alias (Soul-Shield) | Conceptual Theme | Status |
| :--- | :--- | :--- | :--- |
| `security_events` | `SunsumHarmonizationLogs` | Ritualistic security tracking | 🔴 TECHNICAL |
| `agent_actions` | `RitualParticipations` | Agent agency in the Adinkra lattice | 🔴 TECHNICAL |
| `failed_login_attempts` | `SunkwaLapses` | Temporary lapses in "Life Breath" (Auth) | 🔴 TECHNICAL |
| `discovered_assets` | `SacredVessels` | SCADA/ICS components | 🔴 TECHNICAL |
| `pqc_readiness_metrics` | `SunsumVitality` | Cryptographic health and resilience | 🔴 TECHNICAL |
| `compliance_frameworks` | `SacredLawStructures` | Regulatory and STIG compliance | 🔴 TECHNICAL |
| `vulnerability_scans` | `VoidProbing` | Security assessments | 🔴 TECHNICAL |

---

## 3. Function & RPC Audit

| Technical Function | Poetic Alias | Finding |
| :--- | :--- | :--- |
| `record_failed_login` | `record_ritual_lapse` | Directly exposes auth failure logic. |
| `is_account_locked` | `is_sunsum_diminished` | Hard lockout vs. Sunsum degradation. |
| `log_security_event` | `log_harmonization_event` | Neutralizes "Security" keyword. |

---

## 4. Security Findings (Auth Bottleneck)
1.  **Rigid Lockout**: The 5-attempt/1-hour lockout in `is_account_locked` is a deployment blocker if not calibrated correctly.
2.  **Explicit Naming**: Any forensic analysis of the DB reveals the project's intent immediately.
3.  **Search Path Vulnerability**: Some functions were missing the `search_path = public` guard (addressed in recent migrations).

---

## 5. Remediation Plan (Phase 1)
1.  **[ ] Create Harmonization Migration**: Implement views and functions using the poetic vernacular.
2.  **[ ] Update Supabase Types**: Reflect the new schema in `types.ts`.
3.  **[ ] Sync Frontend Hooks**: Update `useKhepraAuth` and `useSecurityHardening` to use the harmonized API.
4.  **[ ] Implement Sunsum-Based Lockout**: Replace hard lockouts with a "Trust Score" based degradation system.

---
**Verdict**: **MODERATE RISK**. The technical clarity of the DB schema undermines the "Codified Deniability" strategy.
