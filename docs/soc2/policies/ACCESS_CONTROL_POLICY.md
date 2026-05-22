# Access Control Policy

**Organisation**: NouchiX SecRed Knowledge Inc.  
**Document ID**: ACP-001  
**Version**: 1.0  
**Effective Date**: 2026-06-01  
**Review Cycle**: Annual  
**Owner**: ISSO  
**SOC 2 Criteria**: CC6.1, CC6.2, CC6.3, CC6.5

---

## 1. Purpose

This policy defines the principles and procedures for controlling access to information systems and data, supporting the SOC 2 Logical and Physical Access Controls criteria (CC6).

---

## 2. Scope

All systems, applications, and data within the KHEPRA platform boundary, including cloud services, internal tools, and third-party SaaS platforms accessed by employees.

---

## 3. Access Request and Provisioning

1. All access requests must be submitted via the approved ticketing system.
2. Requests must be approved by the system owner and the employee's manager.
3. Access must be provisioned using the principle of least privilege.
4. Privileged access (admin, root, superuser) requires CISO approval.
5. Service accounts must be documented, owned by a named individual, and reviewed annually.

---

## 4. Authentication Requirements

| Account Type | MFA Required | Password Minimum | Token Expiry |
|-------------|-------------|-----------------|-------------|
| Standard user | Yes | 16 characters | 90 days |
| Privileged / admin | Yes (hardware key preferred) | 20 characters | 30 days |
| Service account | N/A (keys/tokens only) | N/A | 365 days (rotate) |
| External / vendor | Yes | 16 characters | Session-based |

---

## 5. Role-Based Access Control (RBAC)

Access is granted based on roles defined by the ISSO and Engineering Leads. Roles are:

| Role | Systems | Data Access |
|------|---------|------------|
| `read-only` | All in-scope | Read (no PII) |
| `developer` | Dev/Staging | Read/Write (no prod) |
| `operator` | All | Read/Write (no admin) |
| `admin` | All | Full (audited) |
| `security-auditor` | Audit logs, dashboards | Read (all) |

The KHEPRA `pkg/rbac` module enforces RBAC for all API and dashboard operations.

---

## 6. Access Reviews

- Access reviews must be conducted **quarterly** by system owners.
- Reviews must verify that all accounts are still required and appropriately privileged.
- Unnecessary access must be revoked within **5 business days** of the review.
- Results must be documented and retained for a minimum of **3 years**.

---

## 7. Account Termination

Upon employee termination or role change:

| Action | Timeline |
|--------|---------|
| Disable all accounts | Within **24 hours** |
| Revoke VPN / SSH keys | Within **24 hours** |
| Recover company devices | Within **5 business days** |
| Archive account access logs | Immediately |
| Complete formal offboarding checklist | Within **5 business days** |

---

## 8. Privileged Access Management (PAM)

- Privileged access must be used only for tasks that require elevated permissions.
- Privileged sessions must be logged and audited.
- Shared privileged accounts are prohibited.
- Privileged access must be reviewed monthly.

---

## 9. Remote Access

- Remote access to production systems requires VPN + MFA.
- SSH key-based authentication is required; password SSH is disabled.
- Jump hosts / bastion hosts must be used for access to internal systems.
- All remote sessions are logged in the DAG-based audit trail.

---

## 10. Physical Access

- Server infrastructure is hosted in SOC 2 Type 2 certified data centres (Cloudflare, AWS).
- Physical access logs for data centres must be reviewed annually.
- Employees must not store production data on personal portable media.

---

**Approved by**: _____________________________ Date: ______________
