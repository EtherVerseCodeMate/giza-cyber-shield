# KHEPRA C3PAO Evidence Package
# Package ID: khepra-1783591862721
# Generated: 2026-07-09T10:11:02.719Z
# Tool: KHEPRA ERT v2.0 - NouchiX / SecRed Knowledge Inc. | USPTO #73565085
# Algorithm: ML-DSA-65 / FIPS 204 (Cloudflare CIRCL)
# SDVOSB | adinkhepra.com

## Target
http://2.24.105.170:4280

## Assessment Framework
CMMC Level 2 (NIST SP 800-171 Rev2) | 110 practices

## Summary
- Total Findings: 12 (8 CAT I NON-POA&M, 4 CAT II POA&M-eligible)
- SPRS Score: 82 / 110 — BELOW THRESHOLD (requires 110 for CMMC L2)
- Total Exposure: $11 760 000 | Remediation Cost: $18 600 | ROI: 632x
- DAG Nodes: 22 | Flight Frames: 22 | PQC Signed: 22
- Manifest Signature: ML-DSA-65:0xA3574E93A70CDCC8

## C3PAO Package Contents (CMMC CAP v2.0)
| File | Artifact | C3PAO Method |
|---|---|---|
| 01-SSP.md | System Security Plan | Examine |
| 02-asset-inventory.csv | Asset Inventory (Sonar-discovered) | Examine + Test |
| 03-traceability-matrix.csv | Control-to-Evidence Traceability | Examine |
| 04-findings.json | ERT Findings (SPD) | Test |
| 05-dag-chain.json | Immutable DAG Export | Examine + Test |
| 06-spd-flight-log.ndjson | Security Protection Data / Audit Log | Test |
| 07-poam-analysis.md | POA&M Eligibility Analysis | Examine |
| 08-srm.md | Shared Responsibility Matrix | Examine |
| 09-sprs-score-report.md | SPRS Score Report | Examine + Test |
| 10-personnel-training.md | Personnel Training Records (AT controls) | Examine + Interview |
| 11-incident-response.md | IR Plan + Exercise Records | Examine + Test |
| 12-dag-viewer.html | Visual Signed DAG (HTML) | Examine |
| manifest.json | ML-DSA-65 Signed Manifest | Examine |

## Verification
Every artifact in this package is chain-linked to the immutable KHEPRA DAG.
Tampering with any artifact invalidates the manifest signature.
The chain of custody is cryptographically provable.
