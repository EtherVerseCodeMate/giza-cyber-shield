# Business Continuity Plan & Disaster Recovery Plan
**Organisation**: NouchiX SecRed Knowledge Inc.  
**Document ID**: BCP-001 | **Version**: 1.0 | **SOC 2**: CC9.1, A1.2, A1.3, CC7.5  
**Owner**: CISO | **Effective**: 2026-06-01 | **Review**: Annual + post-incident

---

## 1. Purpose

This document defines recovery objectives and procedures for restoring KHEPRA platform services following a disaster, outage, or security incident.

---

## 2. Recovery Objectives

| System | RTO | RPO | Tier |
|--------|-----|-----|------|
| KHEPRA API (Fly.io) | 4 hours | 24 hours | Critical |
| Supabase DB (auth + data) | 4 hours | 24 hours | Critical |
| Dashboard (Vercel/Next.js) | 2 hours | N/A (stateless) | High |
| Cloudflare Workers (MCP) | 1 hour | N/A (stateless) | High |
| Telemetry / Prometheus | 24 hours | 24 hours | Medium |
| Build CI (GitHub Actions) | 8 hours | N/A | Medium |

---

## 3. Backup Architecture

| Data Store | Backup Tool | Frequency | Retention | Location | Encryption |
|-----------|------------|----------|----------|---------|-----------|
| Supabase DB | `pkg/drbc/supabase_storage_sync.go` | Daily | 90 days | Cloudflare R2 (geo-redundant) | AES-256-GCM |
| Fly.io persistent volume | `pkg/drbc/genesis.go` | Daily | 30 days | R2 + secondary S3 | AES-256-GCM |
| PQC key material | Manual + sealed | On rotation | Indefinite | Offline cold storage | HMAC-SHA512 + AES-256 |
| Source code | GitHub | Continuous (git) | Indefinite | GitHub + local mirrors | TLS |

**Backup verification**: Restore test run quarterly using `pkg/drbc/restore.go`. Results documented in `docs/soc2/evidence/A1.2/`.

---

## 4. Recovery Procedures

### 4.1 API Service Outage (Fly.io)

1. Check Fly.io status page and `fly status` output.
2. If machine crashed: `fly machine restart` — auto-restart usually resolves within 2 minutes.
3. If region failure: deploy to secondary region using `fly deploy --region lhr`.
4. If data corruption: restore from R2 backup using `pkg/drbc/restore.go`.
5. Verify service health: `curl https://api.khepra.io/health`.
6. Notify customers if downtime > 15 minutes (see §6).

### 4.2 Database Loss (Supabase)

1. Access Supabase dashboard → restore from latest daily backup (built-in point-in-time recovery).
2. If Supabase is unavailable: restore from `pkg/drbc/supabase_storage_sync.go` backup on R2.
   ```bash
   go run ./cmd/khepra-daemon/ --restore-db --source r2://khepra-backups/latest
   ```
3. Validate data integrity: run `go test ./pkg/drbc/...`.
4. Update DNS/connection strings if failover to alternate region.

### 4.3 PQC Key Compromise

1. Immediately rotate affected key pair (see IRP-001 §6.2).
2. Re-sign all assets with new key.
3. Invalidate all tokens signed with compromised key.
4. Issue incident notification to all customers.

### 4.4 Complete Platform Loss

1. Provision new Fly.io app from IaC (`fly launch` + `fly.toml`).
2. Restore Supabase project from R2 backup.
3. Restore Cloudflare Workers from wrangler config.
4. Restore PQC keys from cold storage.
5. Validate full platform integrity with `go test ./...`.
6. Update DNS. Estimated time: 4–8 hours.

---

## 5. Roles in a Disaster

| Role | Person | Responsibility |
|------|--------|---------------|
| Recovery Commander | ISSO | Declares disaster; coordinates recovery; updates stakeholders |
| Technical Lead | Engineering Lead | Executes recovery procedures |
| Communications | CISO | Notifies customers, vendors, regulators |

---

## 6. Customer Notification SLA

| Outage Duration | Action |
|----------------|--------|
| < 15 minutes | No notification required |
| 15 min – 1 hour | Status page update |
| > 1 hour | Email notification to affected customers |
| > 4 hours (P1) | Direct customer contact; regulatory notification if data affected |

---

## 7. Testing

| Test Type | Frequency | Last Tested | Next Due |
|-----------|----------|------------|---------|
| Backup restoration (`pkg/drbc/restore.go`) | Quarterly | ___________ | 2026-09-01 |
| Full tabletop exercise | Annual | ___________ | 2026-12-01 |
| Partial failover (Fly.io region switch) | Annual | ___________ | 2026-12-01 |

---

## 8. Lessons Learned Register

| Date | Incident / Test | Finding | Action Taken | Owner |
|------|----------------|---------|-------------|-------|
| | | | | |
