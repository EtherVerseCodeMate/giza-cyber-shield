# Customer Incident Notification Templates
**Document ID**: CNT-001 | **SOC 2**: CC2.3, CC7.4  
**Owner**: CISO | **Use**: During P1/P2 incident response

---

## Template 1 — Initial Notification (P1, within 72 hours)

**Subject**: [ACTION REQUIRED] Security Incident Notification — KHEPRA Platform

Dear [Customer Name],

We are writing to notify you of a security incident affecting the KHEPRA platform that may have impacted your account.

**What happened**: [Brief factual description — no speculation]

**When it occurred**: [Date and time UTC]

**What data may be affected**: [Specific data types — or "We have no evidence that your data was accessed"]

**What we have done**:
- [Action 1, e.g., "Contained the incident and revoked affected credentials"]
- [Action 2, e.g., "Engaged forensic investigators"]
- [Action 3, e.g., "Notified relevant regulators"]

**What you should do**:
- [Action 1, e.g., "Rotate your API keys immediately at [link]"]
- [Action 2, e.g., "Review your access logs for unusual activity"]

We take the security of your data seriously and sincerely apologise for this incident. We will provide a further update within [48/72] hours.

For questions, contact our security team at security@souhimbou.ai (PGP key available at /keys/security_contact.asc).

Sincerely,  
SGT Souhimbou Kone  
CISO, NouchiX SecRed Knowledge Inc.

---

## Template 2 — Resolution Notification

**Subject**: Security Incident Update — KHEPRA Platform [RESOLVED]

Dear [Customer Name],

We are writing to provide a final update on the security incident we notified you of on [date].

**Summary**: [2–3 sentence plain-language summary]

**Root cause**: [Factual, non-technical description]

**Remediation completed**:
- [Control 1 implemented]
- [Control 2 implemented]

**Evidence of data impact**: [Confirmed affected / No evidence of access / Specific scope]

**Your recommended actions**: [If any remain]

We have conducted a full post-incident review and implemented the following improvements to prevent recurrence: [list].

A full incident report is available upon request for enterprise customers.

Sincerely,  
SGT Souhimbou Kone  
CISO, NouchiX SecRed Knowledge Inc.

---

## Template 3 — Service Outage Notification (>1 hour)

**Subject**: Service Disruption — KHEPRA Platform

Dear [Customer Name],

We are currently experiencing a service disruption affecting [service name].

**Status**: [Investigating / Identified / Monitoring / Resolved]  
**Started**: [Time UTC]  
**Estimated resolution**: [Time UTC or "Under investigation"]  
**Impact**: [Which features/APIs are affected]

**Updates**: We will post updates every [30/60] minutes at [status page URL].

We apologise for the inconvenience.

NouchiX SecRed Knowledge Inc. — support@souhimbou.ai
