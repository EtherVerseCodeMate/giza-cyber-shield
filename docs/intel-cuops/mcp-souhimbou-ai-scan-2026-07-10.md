# mcp.souhimbou.ai — ERT Scan Intel
# Captured: 2026-07-10T02:04 EDT | Scanner: KHEPRA ERT v2.0
# Scan ID: 7f9ef95f-6f3a-45a8-914e-5aeaf8e99536
# DAG attested, ML-DSA-65 signed

## Summary
- Findings: 32 | Total Exposure: $229,200 | Remediation Cost: $18,600 | ROI: 12x

## Critical Issues
| Severity | Finding |
|---|---|
| HIGH | Email authentication gap (DMARC/SPF/DKIM) — mcp.souhimbou.ai x3 |
| HIGH | ECDSA cert on :443 — 256-bit (pre-quantum, non-FIPS 204 compliant) |
| MEDIUM | 17 MCP tools flagged "destructive" (discover_assets, ert_scan, dag_write, etc.) |
| MEDIUM | DNSSEC not enabled for mcp.souhimbou.ai |
| MEDIUM | Open port 22/ssh exposed to public |
| MEDIUM | Open port 8080/unknown exposed to public |
| MEDIUM | ECDSA cert :443 — 384-bit (3 findings) |
| MEDIUM | Insufficient nameserver redundancy |
| LOW | No CAA record |

## Remediation Plan (before F6S pitch or next investor call)
1. DMARC/SPF/DKIM → add DNS records (30 min)
2. Replace ECDSA cert with ML-KEM-768 / ML-DSA-65 (Caddy CIRCL) → FIPS 204 compliant
3. CAA record → add to Hostinger DNS
4. DNSSEC → enable in Hostinger panel
5. Port 8080 → close or firewall unless actively needed
6. MCP tool classification → mark tool categories properly (not all are "destructive")
7. Nameserver redundancy → add secondary NS

## Notes for Demo Narrative
- mcp.souhimbou.ai itself would FAIL a CMMC audit on the crypto layer
- "Even our own infrastructure gets scanned — ASAF doesn't lie"
- This is the story of continuous monitoring: auto-flag when YOUR posture drifts
