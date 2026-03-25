# NouchiX — Vulnerability Disclosure Program (VDP)

## 🛡️ Quick Summary

NouchiX welcomes responsible security research. If you find a vulnerability in our systems, please disclose it responsibly — we'll review and work to fix it, and we'll credit contributors publicly unless they ask us not to.

**For submissions, email:** security@secredknowledgeinc.tech or cybersouhimbou@secredknowledgeinc.tech

Thank you for helping make critical infrastructure safer.

---

## 🎯 Scope

### ✅ IN SCOPE (What You Can Test)

- Production web applications hosted under official domains (souhimbou.ai, secredknowledgeinc.tech)
- Public APIs used by SouHimBou / NouchiX demo and staging endpoints we explicitly publish
- Public GitHub repositories and open research repos we maintain and invite testing against (non-production)
- Open documentation, CI/CD pipeline metadata that is publicly exposed

### ❌ OUT OF SCOPE (Do Not Test)

- Social engineering or phishing aimed at real employees or customers
- Physical attacks on facilities or devices
- Denial of Service (DoS) / large-scale automated scanning that could disrupt services
- Attempts to access or exfiltrate customer data or third-party systems
- Any test on accounts, environments, or systems labelled "production" without prior written consent

---

## 🤝 Safe Harbor Statement

If you follow this VDP and make a good-faith effort to avoid privacy violation, data exfiltration, or service disruption, NouchiX will not pursue legal action against you for the disclosed activity. We do not authorize exploitation of customer data, privileged accounts, or destructive actions. This safe-harbor applies only to researchers acting in good faith and per our program rules.

---

## 📝 How to Report a Vulnerability

**Subject:** VDP Submission — [short title] — [Critical/High/Medium/Low] — [target host]

**Body (required):**

1. **Researcher name / handle** and contact email (or anonymous if preferred)
2. **Target** (domain, service, API, URL)
3. **Vulnerability type** (e.g., SQLi, XSS, misconfiguration)
4. **Steps to reproduce** (concise, numbered) — include commands, URLs, sample payloads
5. **Proof of concept (POC)** — screenshots, curl output, safe sample logs (redact sensitive data)
6. **Impact assessment** — your view of risk and who is affected
7. **Suggested remediation** (if any)
8. **Disclosure preference** — public credit / anonymous / private
9. **Optional:** PGP key or public SSH key for secure replies

**Attachments:** Single ZIP (password-protected) or PGP-signed message (recommended). If sending PoC, use an encrypted channel or upload to a trusted service and provide access.

---

## 🎖️ Recognition & Rewards (Non-Monetary)

We offer cost-free recognition for responsible researchers:

- **Hall of Fame** page on our website (credit as preferred)
- **GitHub contributor badge** or issue/PR credit in public repos
- **LinkedIn shoutout** / public thank-you tweet from SouHimBou account (if researcher opts in)
- **Early beta access** to non-production features (where safe)
- **Invite to community** (private research channel) for trusted researchers

---

## 📋 Operational Rules for Researchers

- ❌ Don't access or exfiltrate customer data
- ❌ Don't attempt privilege escalation on production accounts
- 🔒 Keep the PoC private until the issue is fixed or you have explicit permission to disclose
- 🤝 Follow coordinated disclosure: share details with us first — public disclosure only with mutual agreement
- 🔐 If your submission contains active exploit code, supply it only to the security email with encryption or password-protected attachment

---

## ⚡ Severity Levels

We triage based on impact:

- **Critical** — Remote code execution, credentials exfiltration, active compromise of customer data, control of OT/ICS components
- **High** — Auth bypass, privilege escalation, severe config flaw exposing sensitive data
- **Medium** — Information disclosure, cross-site scripting with limited impact, SSRF with mitigations
- **Low** — UI bugs, minor misconfigurations, best-practice issues

---

## 🔄 Our Process

1. **Acknowledge** receipt promptly
2. **Triage** severity and assign owner
3. **Patch / mitigate** (or create compensating control)
4. **Validate** fix with reporter (if they choose)
5. **Close** with public credit statement (if reporter opts in)

---

## 📞 Contact

**Primary:** security@secredknowledgeinc.tech  
**Alternate:** cybersouhimbou@secredknowledgeinc.tech  
**Website:** [https://souhimbou.ai](https://souhimbou.ai)

---

## 🏆 Hall of Fame

Visit our [Hall of Fame page](https://souhimbou.ai/hall-of-fame) to see researchers who have helped make NouchiX more secure.

---

*This program is part of our Building In Public commitment to transparency and community-driven security.*
