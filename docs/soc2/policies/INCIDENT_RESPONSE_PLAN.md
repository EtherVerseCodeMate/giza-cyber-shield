# Incident Response Plan

**Organisation**: NouchiX SecRed Knowledge Inc.  
**Document ID**: IRP-001  
**Version**: 1.0  
**Effective Date**: 2026-06-01  
**Review Cycle**: Annual + post-incident  
**Owner**: ISSO  
**SOC 2 Criteria**: CC7.3, CC7.4, CC7.5

---

## 1. Purpose

This plan defines the process for detecting, analysing, containing, eradicating, and recovering from security incidents affecting the KHEPRA platform, its data, and its customers.

---

## 2. Incident Classification

| Severity | Definition | Examples | Response SLA |
|----------|-----------|---------|-------------|
| **P1 — Critical** | Active breach, data exfiltration, ransomware | RCE in production, confirmed data leak | 1-hour response, 4-hour contain |
| **P2 — High** | Significant threat, customer impact likely | Compromised admin account, service outage | 4-hour response, 24-hour contain |
| **P3 — Medium** | Limited impact, no customer data affected | Failed brute-force, malware on endpoint | 24-hour response, 72-hour contain |
| **P4 — Low** | Potential threat, minimal impact | Phishing attempt, anomalous login | 72-hour response |

---

## 3. Incident Response Team

| Role | Name | Contact | Backup |
|------|------|---------|--------|
| Incident Commander | ISSO | security@souhimbou.ai | CISO |
| Technical Lead | Engineering Lead | On-call rotation | N/A |
| Communications Lead | CISO | support@souhimbou.ai | ISSO |
| Legal / Privacy | Legal Team | legal@souhimbou.ai | N/A |

---

## 4. Incident Response Lifecycle

### Phase 1 — Detection and Reporting
1. Incident detected via KHEPRA Sonar agent, SIEM alert, or employee report.
2. Reporter notifies ISSO via **security@souhimbou.ai** or the #security-incidents Slack channel.
3. ISSO creates an incident ticket within **1 hour** of notification.
4. Incident is logged in the DAG-based tamper-evident audit trail (`pkg/audit`).

### Phase 2 — Analysis
1. Technical Lead assesses the scope, affected systems, and data.
2. Severity is assigned using the classification table above.
3. ISSO notifies stakeholders based on severity (P1: all executives immediately).
4. Initial indicators of compromise (IOCs) are documented.

### Phase 3 — Containment
1. Affected systems are isolated from the network if necessary.
2. Compromised credentials are revoked immediately.
3. Firewall rules / Cloudflare WAF rules are updated to block attacker IPs.
4. Evidence is preserved before remediation.

### Phase 4 — Eradication
1. Root cause is identified and documented.
2. Malware or attacker persistence mechanisms are removed.
3. Affected systems are patched or rebuilt from known-good images.
4. Cryptographic verification (PQC signatures) confirms system integrity.

### Phase 5 — Recovery
1. Systems are restored from verified, clean backups.
2. Monitoring is increased for 30 days post-incident.
3. Stakeholders are notified of resolution.

### Phase 6 — Post-Incident Review
1. Post-incident report (PIR) is completed within **5 business days** of closure.
2. PIR includes timeline, root cause, remediation, and lessons learned.
3. Policy and control updates are made where gaps are identified.
4. PIR is retained for **5 years**.

---

## 5. Customer and Regulatory Notification

| Trigger | Notification Target | Deadline |
|---------|-------------------|---------|
| Personal data breach (EU residents) | Supervisory Authority (GDPR Art. 33) | 72 hours |
| Personal data breach (US, state laws) | Affected individuals | Per state law |
| Customer data impacted | Affected customers | 72 hours |
| DoD/Federal system impact | Contracting Officer | Per contract terms |

---

## 6. KHEPRA-Specific Playbooks

### 6.1 Compromised API Key / License Token
1. Revoke token immediately via `khepra-client revoke --token <ID>`.
2. Issue replacement token to affected customer.
3. Review DAG log for anomalous activity from the compromised token.
4. Notify affected customer and document in incident record.

### 6.2 PQC Key Compromise
1. Rotate affected Kyber / Dilithium key pair immediately.
2. Re-sign all affected assets with the new key.
3. Notify all nodes in the affected trust chain.
4. Update `khepra_master.pub` and push signed update.

### 6.3 Data Exfiltration
1. Engage legal counsel immediately.
2. Preserve all logs in immutable storage.
3. Engage forensic investigator if required.
4. Follow notification timelines above.

---

## 7. Testing

The IRP must be tested at least **annually** via a tabletop exercise. Results must be documented and used to update this plan.

---

**Approved by**: _____________________________ Date: ______________
