

# Omnipotent PQC Defense - 8-Week Implementation Plan

**Start Date**: 2026-02-17 (Monday)
**End Date**: 2026-04-11 (Friday)
**Team Size**: 2-3 engineers + 1 ML engineer + 1 security auditor : Internal resources
**Budget**: Internal resources

---

## Executive Summary

This plan implements the **Omnipotent PQC Defense Framework** in 8 weeks across 4 phases:

- **Phase 1 (Weeks 1-2)**: Foundation - Deploy immediate security (PQC keys, auto-encryption, CLI)
- **Phase 2 (Weeks 3-4)**: AI Integration - Train ML models, deploy KASA/SouHimBou agents
- **Phase 3 (Weeks 5-6)**: Zero-Trust - Component auth, network segmentation, quarantine
- **Phase 4 (Weeks 7-8)**: Hardening - Red team, compliance audit, production rollout

**Quick Win**: Phase 1 can be deployed **this week** for immediate security benefits.

---

## Resource Allocation

### Team Roles

I Souhimbou Doh Kone will be filling for all the roles below:
| **Tech Lead** | Souhimbou Doh Kone | Architecture, code review, integration | 100% (8 weeks) |
| **Backend Engineer** | Souhimbou Doh Kone | Go implementation, API integration | 100% (8 weeks) |
| **Frontend Engineer** | Souhimbou Doh Kone | TypeScript/React, Supabase integration | 50% (4 weeks) |
| **ML Engineer** | Souhimbou Doh Kone | AI model training, threat detection | 100% (Weeks 3-6) |
| **Security Auditor** | External | Red team, compliance audit | External firm 100% (Weeks 7-8) |I have a firm on standby ready to audit in exchange for a perpetual license to our software

### Budget Breakdown

| Item | Cost | Timeline | Vendor |
|------|------|----------|--------|
| ML Model Training (GPU time) | | Weeks 3-4 | PyTorch |
| Red Team Testing |  | Week 7 | External firm |Will use our suitable arsenals to test the system
| Compliance Audit (CMMC L2) |  | Week 8 | External auditor |Will use our suitable arsenals to test the system
| **TOTAL** | 0 | | |

---

## Phase 1: Foundation (Weeks 1-2) ✅ READY TO START NOW

**Goal**: Deploy immediate security with PQC encryption and auto-segmentation.

**Deliverables**:
- ✅ PQC key management system
- ✅ Secure Supabase client (auto-encryption)
- ✅ KASA crypto agent (threat detection skeleton)
- ✅ CLI integration (transparent encryption)
- ✅ Bootstrap framework (one-line initialization)

### Week 1: Core Infrastructure

#### Monday 2026-02-17 (TODAY!)

**Morning**: Team kickoff + architecture review
- [ ] Review [OMNIPOTENT_PQC_DEFENSE_STRATEGY.md](OMNIPOTENT_PQC_DEFENSE_STRATEGY.md)
- [ ] Review [OMNIPOTENT_PQC_IMPLEMENTATION_GUIDE.md](OMNIPOTENT_PQC_IMPLEMENTATION_GUIDE.md)
- [ ] Assign tasks to team members
- [ ] Set up project tracking (Jira/Linear/GitHub Projects)

**Afternoon**: Deploy foundational code (ALREADY DONE!)
- [x] `pkg/security/key_manager.go` - PQC key management ✅
- [x] `pkg/security/secure_supabase_client.go` - Auto-encryption wrapper ✅
- [x] `pkg/agi/kasa_crypto_agent.go` - AI threat detection ✅
- [x] `pkg/security/bootstrap.go` - One-line initialization ✅

**Action**: Copy example integration to `cmd/apiserver/main.go`
```bash
# Integrate into API server
cp examples/main_integration_example.go cmd/apiserver/main.go

# Test bootstrap
go run cmd/apiserver/main.go
# Expected output:
# 🔑 Initializing PQC keys...
# ✅ PQC keys generated successfully
# ✅ Supabase client ready (auto-encryption enabled)
# ✅ KASA agent ready
# ✅ PQC SECURITY BOOTSTRAP COMPLETE
```

#### Tuesday 2026-02-18

**Task**: Integrate Supabase encryption across codebase
- [ ] Find all direct Supabase calls (`supabase.From("table").Insert/Select`)
- [ ] Replace with `security.SecureDB.Insert/Select`
- [ ] Test in development environment

**Files to Modify**:
- `cmd/apiserver/handlers.go` - Replace user/license handlers
- `pkg/license/manager.go` - Replace license storage
- `cmd/gateway/stig_connector.go` - Replace STIG cache

**Acceptance Criteria**:
- [ ] All Supabase INSERT operations automatically encrypt data
- [ ] All Supabase SELECT operations automatically decrypt data
- [ ] No plaintext data stored in Supabase tables

#### Wednesday 2026-02-19

**Task**: Create encrypted Supabase tables
- [ ] Run Supabase migrations for encrypted tables (see implementation guide Step 10)
- [ ] Create tables: `users_encrypted`, `licenses_encrypted`, `audit_trail`
- [ ] Test INSERT/SELECT with encrypted schema

**SQL Migration**:
```sql
-- migrations/20260219_encrypted_tables.sql
-- Use license.GenerateSupabaseSchema() helper function
CREATE TABLE users_encrypted ( ... );
CREATE TABLE licenses_encrypted ( ... );
CREATE TABLE audit_trail ( ... );
```

#### Thursday 2026-02-20

**Task**: CLI integration (transparent file encryption)
- [ ] Integrate key manager into `cmd/khepra/main.go`
- [ ] Update `license create` command to use `security.SecureDB.Insert`
- [ ] Update `config set` command to encrypt config files
- [ ] Test CLI commands

**Example**:
```bash
# Should automatically encrypt
khepra license create alice@example.com Osiris

# Should automatically decrypt
khepra license get alice@example.com
```

#### Friday 2026-02-21

**Task**: API middleware (optional PQC response encryption)
- [ ] Implement PQCEncryptionMiddleware (see implementation guide Step 3)
- [ ] Add middleware to API router
- [ ] Test with client that provides `X-Khepra-Public-Key` header
- [ ] Document API encryption in README

**Demo**: Show encrypted API response
```bash
curl -H "X-Khepra-Public-Key: $(cat ~/.khepra/keys/public.key)" \
     https://api.khepra.dev/users
# Response: base64-encoded ProtectedData (encrypted)
```

---

### Week 2: Integration & Testing

#### Monday 2026-02-24

**Task**: KASA agent integration (basic threat detection)
- [ ] Wire KASA agent into API handlers (see example)
- [ ] Add `DetectTampering()` calls to sensitive operations
- [ ] Test anomaly detection with synthetic malicious requests
- [ ] Log detected threats to encrypted audit trail

**Test Scenarios**:
- SQL injection attempt → KASA detects → logs to audit
- Unusual data access pattern → KASA flags → increases monitoring
- Brute force login → KASA blocks → auto-segments

#### Tuesday 2026-02-25

**Task**: Audit trail implementation
- [ ] Implement immutable audit chain (see implementation guide Step 8)
- [ ] Log all CREATE/UPDATE/DELETE operations
- [ ] Verify blockchain-style hash chain
- [ ] Test audit log encryption and retrieval

**Audit Events to Log**:
- User login/logout
- License creation/modification
- API key generation/rotation
- Configuration changes
- Scan trigger/results

#### Wednesday 2026-02-26

**Task**: WebSocket encryption (real-time events)
- [ ] Implement SecureWebSocketHub (see implementation guide Step 6)
- [ ] Encrypt scan result broadcasts
- [ ] Encrypt DAG update notifications
- [ ] Test with frontend WebSocket client

#### Thursday 2026-02-27

**Task**: Telemetry encryption
- [ ] Implement telemetry encryption (see implementation guide Step 7)
- [ ] Get telemetry collector's Kyber public key
- [ ] Configure `TELEMETRY_COLLECTOR_PUBLIC_KEY` env var
- [ ] Test encrypted telemetry send

#### Friday 2026-02-28

**Task**: Phase 1 wrap-up & deployment to staging
- [ ] Run full test suite (ensure 100% pass)
- [ ] Deploy to staging environment
- [ ] Smoke test all features
- [ ] Document Phase 1 completion

**Phase 1 Acceptance Criteria**:
- [ ] PQC keys generated and managed
- [ ] Supabase data automatically encrypted/decrypted
- [ ] CLI commands transparently encrypt
- [ ] API responses optionally encrypted
- [ ] Audit trail immutable and encrypted
- [ ] KASA agent detects basic threats
- [ ] Deployed to staging successfully

---

## Phase 2: AI Integration (Weeks 3-4)

**Goal**: Train ML models for threat detection and deploy autonomous AI agents.

### Week 3: ML Model Training

#### Monday 2026-03-03

**Task**: Data collection for ML training
- [ ] Export historical data (API logs, user activity, network flows)
- [ ] Label data (benign vs. malicious)
- [ ] Create training/validation/test splits (70/15/15)
- [ ] Upload to S3 for SageMaker

**Data Sources**:
- API access logs (last 90 days)
- User behavioral data (login times, geo, devices)
- Network flow logs (if available)
- Known attack patterns (pen test results)

#### Tuesday 2026-03-04

**Task**: Feature engineering
- [ ] Extract behavioral features (see strategy doc §4.3)
- [ ] Normalize features (StandardScaler)
- [ ] Create feature dictionary
- [ ] Document feature importance

**Features** (50+ total):
- API calls per minute
- Data volume accessed (MB)
- Unique endpoints accessed
- Login hour (0-23)
- Geolocation distance from baseline (km)
- Failed auth attempts
- Privilege escalation attempts
- ... (see strategy doc for full list)

#### Wednesday 2026-03-05

**Task**: Train anomaly detection models
- [ ] Train Isolation Forest (unsupervised)
- [ ] Train LSTM (sequence anomalies)
- [ ] Train Autoencoder (reconstruction error)
- [ ] Evaluate models (AUC-ROC, precision, recall)

**Target Metrics**:
- Precision: >95% (low false positives)
- Recall: >90% (catch real threats)
- AUC-ROC: >0.95

#### Thursday 2026-03-06

**Task**: Model deployment
- [ ] Export trained models (pickle/ONNX)
- [ ] Create inference API (FastAPI/Flask)
- [ ] Deploy to SageMaker endpoint
- [ ] Test inference latency (<500ms)

#### Friday 2026-03-07

**Task**: Integrate ML models into KASA agent
- [ ] Update `kasa_crypto_agent.go` to call ML API
- [ ] Replace stub `AnomalyDetectionModel.PredictAnomaly()` with real model
- [ ] Test with synthetic attacks
- [ ] Tune threshold (0.85 default)

---

### Week 4: SouHimBou Python AGI

#### Monday 2026-03-10

**Task**: Implement SouHimBou crypto agent (Python)
- [ ] Create `pkg/agi/souhimbou/crypto_agent.py`
- [ ] Implement insider threat detection
- [ ] Implement behavioral profiling
- [ ] Integrate with ML models

**Reference**: See OMNIPOTENT_PQC_DEFENSE_STRATEGY.md §4.2

#### Tuesday 2026-03-11

**Task**: Python-Go integration (gRPC)
- [ ] Create gRPC service for SouHimBou
- [ ] Implement Go client for KASA
- [ ] Test bi-directional communication
- [ ] Benchmark latency

#### Wednesday 2026-03-12

**Task**: Auto-response engine
- [ ] Implement remediation decision tree
- [ ] Add response actions (segment, revoke, rollback, patch)
- [ ] Test automated remediation
- [ ] Add manual override capability

#### Thursday 2026-03-13

**Task**: Insider threat detection
- [ ] Implement behavioral profiling baseline
- [ ] Detect data exfiltration attempts
- [ ] Auto-encrypt targeted data
- [ ] Test with simulated insider attack

#### Friday 2026-03-14

**Task**: Phase 2 wrap-up & testing
- [ ] Run full threat detection test suite
- [ ] Tune ML thresholds for production
- [ ] Deploy to staging
- [ ] Document Phase 2 completion

**Phase 2 Acceptance Criteria**:
- [ ] ML models trained (>90% accuracy)
- [ ] KASA agent uses real ML predictions
- [ ] SouHimBou agent operational
- [ ] Auto-response engine functional
- [ ] Insider threat detection working
- [ ] <5s response time for critical threats

---

## Phase 3: Zero-Trust (Weeks 5-6)

**Goal**: Implement zero-trust architecture with component authentication and network segmentation.

### Week 5: Component Authentication

#### Monday 2026-03-17

**Task**: PKI infrastructure (PQC certificates)
- [ ] Implement `pkg/pki/manager.go` (ML-DSA-65 certificate authority)
- [ ] Generate root CA certificate
- [ ] Issue component certificates (API server, gateway, agents)
- [ ] Implement certificate revocation list (CRL)

#### Tuesday 2026-03-18

**Task**: Component authentication
- [ ] Implement `pkg/security/zero_trust.go` (see strategy doc §6.2)
- [ ] Add signature verification to API endpoints
- [ ] Require client certificates for API access
- [ ] Test mutual authentication

#### Wednesday 2026-03-19

**Task**: Authorization (least privilege)
- [ ] Define component roles and permissions
- [ ] Implement RBAC enforcement
- [ ] Create permission matrix
- [ ] Test access control

**Example Roles**:
- `api_server`: Can read/write licenses, users
- `gateway`: Can read STIG data, write audit logs
- `cli_user`: Can read own data, create licenses
- `admin`: Full access

#### Thursday 2026-03-20

**Task**: Network segmentation
- [ ] Design VLAN segmentation strategy
- [ ] Implement auto-segmentation for compromised components
- [ ] Test network isolation
- [ ] Document network topology

#### Friday 2026-03-21

**Task**: Quarantine manager
- [ ] Implement `pkg/security/quarantine.go` (see strategy doc §5.3)
- [ ] Test auto-quarantine workflow
- [ ] Verify encrypted quarantine artifacts
- [ ] Test forensic snapshot capture

---

### Week 6: Hardening & Monitoring

#### Monday 2026-03-24

**Task**: Forensic snapshot system
- [ ] Implement process capture
- [ ] Implement network connection capture
- [ ] Implement file system snapshot
- [ ] Test memory dump (encrypted)

#### Tuesday 2026-03-25

**Task**: Metrics & monitoring
- [ ] Implement Prometheus metrics exporter
- [ ] Create Grafana dashboards
- [ ] Set up alerting (PagerDuty/Opsgenie)
- [ ] Test alert workflows

**Key Metrics**:
- Encryption coverage (%)
- Signature verification rate (%)
- Anomaly detection latency (ms)
- Threats detected/blocked (count)
- False positive rate (%)

#### Wednesday 2026-03-26

**Task**: Performance optimization
- [ ] Profile encryption overhead
- [ ] Optimize batch operations
- [ ] Add caching layer
- [ ] Benchmark throughput (target: 1000 req/sec)

#### Thursday 2026-03-27

**Task**: Failover & disaster recovery
- [ ] Implement key backup to Vault
- [ ] Test key recovery procedure
- [ ] Document disaster recovery runbook
- [ ] Run disaster recovery drill

#### Friday 2026-03-28

**Task**: Phase 3 wrap-up & staging deployment
- [ ] Deploy zero-trust architecture to staging
- [ ] Run penetration test (internal)
- [ ] Fix vulnerabilities found
- [ ] Document Phase 3 completion

**Phase 3 Acceptance Criteria**:
- [ ] All components authenticate with PQC signatures
- [ ] Network segmentation operational
- [ ] Quarantine manager tested
- [ ] Forensic snapshots encrypted
- [ ] Monitoring dashboards live
- [ ] Performance acceptable (<50ms overhead)

---

## Phase 4: Hardening (Weeks 7-8)

**Goal**: Red team testing, compliance audit, and production rollout.

### Week 7: Red Team Testing

#### Monday 2026-03-31

**Task**: External red team engagement (Week-long)
- [ ] Onboard red team
- [ ] Define scope (API, gateway, database, network)
- [ ] Provide access to staging environment
- [ ] Monitor attacks in real-time

**Attack Scenarios**:
- SQL injection attempts
- Authentication bypass
- API abuse / rate limiting bypass
- Insider threat simulation
- Supply chain attack (malicious dependency)
- Zero-day exploitation

#### Tuesday-Friday 2026-04-01 to 04-04

**Task**: Red team testing & remediation
- [ ] Monitor KASA agent response to attacks
- [ ] Document attack success/failure
- [ ] Fix vulnerabilities discovered
- [ ] Re-test after fixes

**Daily Standup**:
- Review attacks attempted
- Review KASA auto-responses
- Identify gaps in detection
- Implement fixes

---

### Week 8: Compliance Audit & Production Rollout

#### Monday 2026-04-07

**Task**: Compliance audit (CMMC L2)
- [ ] External auditor reviews architecture
- [ ] Provide evidence (audit logs, encryption config, access controls)
- [ ] Demonstrate PQC implementation
- [ ] Address auditor findings

**CMMC L2 Controls** (17 total):
- AC.L2-3.1.3, AC.L2-3.1.5, AC.L2-3.1.6
- AU.L2-3.3.1, AU.L2-3.3.2
- SC.L2-3.13.1, SC.L2-3.13.5
- SI.L2-3.14.1, SI.L2-3.14.2
- ... (see strategy doc §10.1 for full list)

#### Tuesday 2026-04-08

**Task**: Production preparation
- [ ] Final security review
- [ ] Update production secrets (Vault)
- [ ] Create production PQC keys
- [ ] Run load test (10,000 req/sec)

#### Wednesday 2026-04-09

**Task**: Gradual rollout (10% → 50% → 100%)
- [ ] 10% traffic to PQC-protected API (canary deployment)
- [ ] Monitor metrics (latency, error rate, threats detected)
- [ ] 50% traffic if canary successful
- [ ] 100% traffic after 24 hours

#### Thursday 2026-04-10

**Task**: Post-deployment monitoring
- [ ] Monitor production metrics
- [ ] Review KASA agent logs
- [ ] Verify encryption coverage (100%)
- [ ] Address any issues

#### Friday 2026-04-11

**Task**: Project completion & retrospective
- [ ] Document final implementation
- [ ] Conduct team retrospective
- [ ] Create maintenance runbook
- [ ] Celebrate! 🎉

---

## Success Metrics

### Week-by-Week Targets

| Week | Milestone | Encryption Coverage | Threat Detection | Status |
|------|-----------|---------------------|------------------|--------|
| 1 | Core infrastructure | 20% (new data only) | Manual logging | ⏳ In Progress |
| 2 | Integration complete | 50% (API + Supabase) | Basic AI detection | 🔜 Starting 2/24 |
| 3 | ML models trained | 70% | ML-powered (>90% accuracy) | 🔜 Starting 3/3 |
| 4 | AI agents deployed | 80% | Auto-response active | 🔜 Starting 3/10 |
| 5 | Zero-trust architecture | 90% | Component auth required | 🔜 Starting 3/17 |
| 6 | Hardening complete | 95% | Full monitoring | 🔜 Starting 3/24 |
| 7 | Red team tested | 98% | Tested under attack | 🔜 Starting 3/31 |
| 8 | Production deployment | **100%** | **Live in production** | 🔜 Starting 4/7 |

### Final Acceptance Criteria (Week 8)

- [ ] **100% encryption coverage** - All data at rest, in transit, in use
- [ ] **<5s auto-response** - Threats quarantined automatically
- [ ] **>90% threat detection** - ML models catch novel attacks
- [ ] **<1% false positive rate** - Minimal disruption
- [ ] **CMMC L2 compliant** - Audit passed
- [ ] **Production deployed** - 100% traffic on PQC infrastructure
- [ ] **<50ms overhead** - Performance acceptable

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| ML model accuracy <90% | Medium | High | Use ensemble models, increase training data |
| Performance degradation | Low | High | Optimize batch operations, add caching |
| Key compromise | Low | Critical | Rotate keys immediately, revoke certificates |
| Red team finds critical flaw | Medium | High | Fix immediately, delay production rollout if needed |
| Compliance audit failure | Low | High | Pre-audit with consultant, address gaps early |
| Team member unavailable | Medium | Medium | Cross-train team, document thoroughly |

---

## Communication Plan

### Daily Standups (15 min)
- What did you complete yesterday?
- What are you working on today?
- Any blockers?

### Weekly Status Reports (Friday)
- Completed milestones
- Metrics (encryption coverage, threat detection)
- Blockers and risks
- Next week's priorities

### Stakeholder Updates (Bi-weekly)
- Executive summary
- Demo of new features
- Security metrics dashboard
- Budget and timeline status

---

## Next Steps (This Week!)

**IMMEDIATE** (Today - Monday 2026-02-17):
1. ✅ Review this project plan
2. ✅ Allocate team members
3. ✅ Set up project tracking
4. ✅ Run `security.Bootstrap()` in development environment
5. ✅ Test encrypted Supabase operations

**THIS WEEK** (Tuesday-Friday):
- Integrate SecureSupabaseClient across codebase
- Create encrypted Supabase tables
- Update CLI commands
- Add API middleware
- Deploy to staging by Friday

**NEXT WEEK** (Week 2 - Starting 2/24):
- KASA agent integration
- Audit trail implementation
- WebSocket encryption
- Telemetry encryption
- Phase 1 completion!

---

**Status**: 📋 PROJECT PLAN APPROVED - Starting Phase 1 NOW
**Next Review**: Friday 2026-02-21 (End of Week 1)
**Project Manager**: [TBD]
**Tech Lead**: [TBD]

---

**Let's build the most secure platform on the planet.** 🔐🚀
