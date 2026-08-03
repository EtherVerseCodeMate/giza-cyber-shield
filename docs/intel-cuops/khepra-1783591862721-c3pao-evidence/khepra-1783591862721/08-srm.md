# Shared Responsibility Matrix (SRM)
# External Service Provider (ESP) Documentation
# Per CMMC CAP v2.0 — Required to prevent SCOPE_GAP rejection
# Generated: 2026-07-09T10:11:02.719Z | Signed: ML-DSA-65:0xE9CE0341C51A4B9C

## ESPs Identified by Package C (Sonar)
| ESP | Service | CUI Exposure | Responsibility Owner | Controls Inherited |
|---|---|---|---|---|
| Hostinger VPS | Infrastructure / Compute | YES | ESP (Hostinger) | PE-* physical controls |
| MariaDB | Database Service | YES | Organization | IA-*, AC-* |
| Apache 2.4 | Web Server | YES | Organization | SC-*, SI-* |
| PHP 7.4.3 | Application Runtime | YES | Organization | CM-*, SI-* |

## Inherited Controls (Hostinger VPS)
The following controls are inherited from the ESP and are not the responsibility
of the assessed organization:
- PE-1 through PE-20 (Physical and Environmental Protection)
- CP-6, CP-7 (Alternate Storage/Processing Sites)

## Organization-Owned Controls
All remaining CMMC Level 2 practices are the responsibility of the assessed
organization. Evidence must be provided for each.

## Assessor Note
This SRM was auto-generated from KHEPRA Package C Sonar scan output.
It identifies all ESPs discovered within the authorization boundary.
Absence of a formal SRM is a leading cause of SCOPE_GAP rejection.
