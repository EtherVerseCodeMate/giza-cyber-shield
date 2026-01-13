# Cloudflare Deployment Guide
**AdinKhepra Telemetry + License Server**

**Date**: 2026-01-13
**Status**: Ready for Deployment
**Domain**: `telemetry.souhimbou.org`

---

## DEPLOYMENT CHECKLIST

### Phase 1: Database Setup ✅ (10 minutes)

#### 1.1 Create D1 Database Schemas

```bash
cd adinkhepra-telemetry-server

# Apply telemetry schema
wrangler d1 execute adinkhepra-telemetry --file=./schema.sql

# Apply license schema
wrangler d1 execute adinkhepra-telemetry --file=./schema-license.sql

# Apply admin authentication schema
wrangler d1 execute adinkhepra-telemetry --file=./schema-admin.sql
```

**Verify schemas**:
```bash
wrangler d1 execute adinkhepra-telemetry --command="SELECT name FROM sqlite_master WHERE type='table'"
```

**Expected tables**:
- `beacons` (telemetry data)
- `daily_stats`, `version_stats`, `country_stats`, `anomalies`
- `licenses`, `license_validations`, `license_heartbeats`, `license_audit_log`
- `admin_users`, `admin_sessions`

---

### Phase 2: Install Dependencies (5 minutes)

```bash
cd adinkhepra-telemetry-server

# Install npm packages
npm install

# This will install:
# - @noble/post-quantum@^0.2.0 (ML-DSA-65 signature verification)
# - bcryptjs@^2.4.3 (password hashing)
```

---

### Phase 3: Configure Secrets (5 minutes)

#### 3.1 Generate JWT Secret

```bash
# Generate strong random secret (256 bits)
openssl rand -hex 32
```

**Output** (example):
```
a3f8c2e1d9b4f7e8c1a2b3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4
```

#### 3.2 Set Wrangler Secrets

```bash
# JWT secret (CRITICAL - never commit to git)
wrangler secret put JWT_SECRET
# Paste the hex string from above when prompted

# Emergency admin API key (for emergency revocations)
wrangler secret put ADMIN_API_KEY
# Use a strong random key (e.g., openssl rand -hex 32)
```

**Security Note**: These secrets are stored securely in Cloudflare and **never** exposed in `wrangler.toml`.

---

### Phase 4: Deploy Worker (2 minutes)

```bash
cd adinkhepra-telemetry-server

# Deploy to Cloudflare
npm run deploy

# OR

wrangler deploy
```

**Expected output**:
```
Total Upload: XX.XX KiB / gzip: XX.XX KiB
Uploaded adinkhepra-telemetry (X.XX sec)
Published adinkhepra-telemetry (X.XX sec)
  https://adinkhepra-telemetry.cybersouhimbou.workers.dev
  telemetry.souhimbou.org/*
Current Deployment ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

---

### Phase 5: Verify Deployment (5 minutes)

#### 5.1 Health Check

```bash
curl https://telemetry.souhimbou.org/health
```

**Expected response**:
```json
{
  "status": "ok",
  "timestamp": 1736765400000,
  "service": "khepra-telemetry",
  "database": "connected",
  "version": "1.0.0"
}
```

#### 5.2 Admin Login Test

```bash
# Login with default admin (CHANGE PASSWORD IMMEDIATELY!)
curl -X POST https://telemetry.souhimbou.org/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "Change1234!"}'
```

**Expected response**:
```json
{
  "token": "eyJhbGci...long-jwt-token",
  "expires_at": "2026-01-14T10:30:00.000Z",
  "admin": {
    "username": "admin",
    "role": "super_admin"
  },
  "warning": "WARNING: You are using the default password. Change it immediately!"
}
```

#### 5.3 Change Default Password (CRITICAL!)

```bash
# Save JWT token from login response
JWT="eyJhbGci...your-jwt-token"

# Change password
curl -X POST https://telemetry.souhimbou.org/admin/change-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT" \
  -d '{
    "old_password": "Change1234!",
    "new_password": "YourSecurePassword123!@#"
  }'
```

**Expected response**:
```json
{
  "message": "Password changed successfully. Please log in again."
}
```

---

## API ENDPOINTS REFERENCE

### Public Endpoints (No Auth Required)

#### Telemetry
- `POST /beacon` - Receive telemetry beacon (requires ML-DSA-65 signature)
- `GET /stats` - Get telemetry statistics
- `GET /analytics` - Get Dark Crypto Database analytics
- `GET /health` - Health check

#### License Management
- `POST /license/validate` - Validate license (requires ML-DSA-65 signature)
- `POST /license/heartbeat` - Send license heartbeat (requires ML-DSA-65 signature)

### Admin Endpoints (JWT Auth Required)

#### Authentication
- `POST /admin/login` - Login (returns JWT token)
- `POST /admin/logout` - Logout (revokes JWT token)
- `POST /admin/change-password` - Change password

#### License Administration
- `POST /license/issue` - Issue new license (requires JWT)
- `DELETE /license/revoke/:machine_id` - Revoke license (requires JWT)

---

## SECURITY CONFIGURATION

### Environment Variables (in `wrangler.toml`)

```toml
[vars]
MAX_BEACON_SIZE = "10240"
RATE_LIMIT_PER_HOUR = "100"
TELEMETRY_PUBLIC_KEY = "7f7d947e..." # ML-DSA-65 public key (1952 bytes)
```

### Secrets (via `wrangler secret`)

- `JWT_SECRET` - HMAC-SHA256 secret for JWT signing (256 bits recommended)
- `ADMIN_API_KEY` - Emergency API key for critical operations (optional fallback)

---

## ADMIN USAGE EXAMPLES

### 1. Issue License for DoD Unit

```bash
# Login first
JWT=$(curl -X POST https://telemetry.souhimbou.org/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "YourPassword"}' \
  | jq -r '.token')

# Issue license
curl -X POST https://telemetry.souhimbou.org/license/issue \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT" \
  -d '{
    "machine_id": "khepra-abc123def456",
    "organization": "US Air Force Cyber Command",
    "license_tier": "dod_premium",
    "features": ["premium_pqc", "white_box_crypto", "hsm_integration"],
    "expires_in_days": 365,
    "max_devices": 10
  }'
```

**Response**:
```json
{
  "status": "issued",
  "machine_id": "khepra-abc123def456",
  "organization": "US Air Force Cyber Command",
  "features": ["premium_pqc", "white_box_crypto", "hsm_integration"],
  "issued_at": "2026-01-13T10:30:00.000Z",
  "expires_at": "2027-01-13T10:30:00.000Z",
  "validation_url": "https://telemetry.souhimbou.org/license/validate"
}
```

### 2. Emergency Revocation (Compromised License)

```bash
# Revoke compromised license
curl -X DELETE https://telemetry.souhimbou.org/license/revoke/khepra-abc123def456 \
  -H "Authorization: Bearer $JWT"
```

**Response**:
```json
{
  "status": "revoked",
  "machine_id": "khepra-abc123def456",
  "timestamp": 1736765400000
}
```

### 3. Create Additional Admin User

```sql
-- Connect to D1 database
wrangler d1 execute adinkhepra-telemetry --command="
INSERT INTO admin_users (username, password_hash, role, created_by)
VALUES (
  'john.doe',
  '\$2a\$10\$...',  -- bcrypt hash of password
  'admin',
  'admin'
)"
```

**Note**: Use bcrypt to hash passwords (cost=10). Never store plaintext passwords.

---

## AUDIT & MONITORING

### View Admin Activity

```bash
# Query admin audit log
wrangler d1 execute adinkhepra-telemetry --command="
SELECT
  au.username,
  au.role,
  COUNT(la.action) as total_actions,
  MAX(datetime(la.timestamp, 'unixepoch')) as last_action
FROM admin_users au
LEFT JOIN license_audit_log la ON au.username = la.admin_user
GROUP BY au.username, au.role
ORDER BY last_action DESC
"
```

### View License Activity

```bash
# Recent license operations
wrangler d1 execute adinkhepra-telemetry --command="
SELECT
  machine_id,
  action,
  datetime(timestamp, 'unixepoch') as action_time,
  admin_user,
  details
FROM license_audit_log
ORDER BY timestamp DESC
LIMIT 20
"
```

### View Active Sessions

```bash
# Check active admin sessions
wrangler d1 execute adinkhepra-telemetry --command="
SELECT
  au.username,
  COUNT(CASE WHEN s.revoked = 0 THEN 1 END) as active_sessions,
  MAX(datetime(s.issued_at, 'unixepoch')) as last_login
FROM admin_users au
LEFT JOIN admin_sessions s ON au.id = s.admin_id
WHERE au.active = 1
GROUP BY au.username
"
```

---

## TROUBLESHOOTING

### Issue: "Unauthorized" on Admin Endpoints

**Solution**: Check JWT token expiration (24 hours). Re-login:
```bash
curl -X POST https://telemetry.souhimbou.org/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "YourPassword"}'
```

### Issue: "Database unavailable" in /health

**Solution**: Check D1 binding in `wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "adinkhepra-telemetry"
database_id = "e8ef77ce-5203-4b78-8969-9ee2dc74a7b6"
```

### Issue: "Invalid JWT signature"

**Solution**: JWT_SECRET may have changed. All users must re-login.

### Issue: "Invalid ML-DSA-65 signature"

**Solution**:
1. Check TELEMETRY_PUBLIC_KEY in `wrangler.toml` (must be 2624 hex chars)
2. Ensure Go client is using matching private key
3. Verify signature is sent in `X-Khepra-Signature` header

---

## BACKUP & RECOVERY

### Backup D1 Database

```bash
# Export all tables
wrangler d1 export adinkhepra-telemetry --output=backup-$(date +%Y%m%d).sql
```

### Restore from Backup

```bash
wrangler d1 execute adinkhepra-telemetry --file=backup-20260113.sql
```

---

## NEXT STEPS

1. ✅ Deploy Worker to Cloudflare
2. ✅ Change default admin password
3. ⏳ Implement Go license client (`pkg/license/`)
4. ⏳ Test end-to-end license flow
5. ⏳ Configure Cloudflare Access for additional security (optional)
6. ⏳ Set up monitoring/alerting (Cloudflare Analytics + Logs)

---

## EMERGENCY PROCEDURES

### Emergency License Revocation (Using API Key)

If JWT system is unavailable, use emergency API key:

```bash
# Use ADMIN_API_KEY directly (no JWT)
curl -X DELETE https://telemetry.souhimbou.org/license/revoke/khepra-COMPROMISED \
  -H "Authorization: Bearer $ADMIN_API_KEY"
```

### Reset Admin Password (Database Access)

If locked out of admin account:

```bash
# Generate new bcrypt hash for new password
# Use: https://bcrypt-generator.com/ (cost=10)

# Update password directly in database
wrangler d1 execute adinkhepra-telemetry --command="
UPDATE admin_users
SET password_hash = '\$2a\$10\$newHashHere...'
WHERE username = 'admin'
"
```

---

**Deployment Complete!**
**Khepra Protocol**: Transforming License Enforcement into Immutable Reality
**Integration Level**: CLOUDFLARE INFRASTRUCTURE DEPLOYED ✅
**Date**: 2026-01-13
