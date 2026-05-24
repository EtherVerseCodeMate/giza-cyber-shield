---
name: Access Revocation (Offboarding)
about: Revoke access for departing or role-changing employee (SOC 2 CC6.2, CC6.5)
title: '[ACCESS-REVOCATION] <name> — <departure/role-change date>'
labels: access-revocation, offboarding, soc2-cc6.2
assignees: ''
---

## Employee Details
- **Name**:
- **Role**:
- **Last Day / Role Change Date**:
- **Reason**: [ ] Termination  [ ] Role change  [ ] Contractor end  [ ] Leave

## Systems — Revoke Within 24 Hours
| System | Account/Username | Revoked? | Revoked By | Timestamp |
|--------|-----------------|----------|-----------|----------|
| Cloudflare Access | | [ ] | | |
| Supabase Auth | | [ ] | | |
| GitHub | | [ ] | | |
| Fly.io | | [ ] | | |
| Tailscale | | [ ] | | |
| Vercel | | [ ] | | |
| SSH keys (all servers) | | [ ] | | |
| API keys / tokens | | [ ] | | |
| Any other systems | | [ ] | | |

## Additional Steps
- [ ] Company devices retrieved or remote-wiped
- [ [ ] VPN access revoked
- [ ] Shared passwords rotated (if any — document why shared passwords exist)
- [ ] Data returned or access to company data confirmed revoked
- [ ] Manager notified of completion
- [ ] HR notified of completion

## Data Handling
- [ ] Company data confirmed removed from personal devices
- [ ] Customer data: no local copies confirmed
- [ ] If vendor/contractor: written data deletion confirmation obtained

## ISSO Sign-Off
- [ ] ISSO confirms all access revoked within 24h SLA
- ISSO: ___________ Date: ___________

---
*SOC 2 CC6.2, CC6.5 — SLA: all access revoked within 24 hours of departure.*
*Retain this issue for minimum 3 years.*
