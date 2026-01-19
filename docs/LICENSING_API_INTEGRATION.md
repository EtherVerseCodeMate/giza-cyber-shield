# Licensing API Integration with Scarab/Motherboard API Server

## Overview

The Khepra security attestation system now includes a comprehensive REST API for license management. This integration combines the **Merkaba Egyptian licensing system** (Khepri → Ra → Atum → Osiris tiers) with the **Scarab/Motherboard API server** to provide enterprise-grade license administration.

## Architecture

The licensing API is built on the Scarab/Motherboard API server (Gin-based) and integrates with the license.Manager component:

- **API Server**: Port 45444 (production) or 8080 (development)
- **Routes**: `/api/v1/license/*` (requires authentication)
- **Adapters**: `LicenseManagerAdapter` bridges license.Manager to API server
- **Telemetry**: Cloudflare telemetry server integration for enrollment and heartbeats

## Egyptian Tier System

The Merkaba licensing framework uses Egyptian solar deities to represent license tiers:

| Tier | Deity | Alias | Monthly Price | Node Quota | Features |
|------|-------|-------|---------------|-----------:|----------|
| **Khepri** | Scarab (Morning Sun) | Scout | $50 | 1 | Basic scan, Community PQC, Limited dashboard |
| **Ra** | Sun (Midday) | Hunter | $500 | 3 | DAG mutations, STIG validation, PQC signatures |
| **Atum** | Creator (Evening Sun) | Hive | $2,000 | 10 | Multi-tenant, White-box crypto, AI summaries |
| **Osiris** | Pharaoh (Eternal) | Pharaoh | Custom | ∞ | Air-gapped, Custom security requirements |

## REST API Endpoints

### License Management

#### 1. Create License
**Endpoint:** `POST /api/v1/license/create`

Create a new license at a specified Egyptian tier.

**Request Body:**
```json
{
  "tier": "khepri|ra|atum|osiris",
  "customer": "Acme Corp",
  "duration_days": 365
}
```

**Response (201 Created):**
```json
{
  "license_id": "ra-d1e2f3g4h5i6j7k8l9m0",
  "tier": "ra",
  "tier_name": "Hunter",
  "customer": "Acme Corp",
  "created_at": "2025-01-19T10:30:00Z",
  "expires_at": "2026-01-19T10:30:00Z",
  "node_quota": 3,
  "duration_days": 365,
  "features": ["basic-scan", "stig-validation", "pqc-signatures"]
}
```

#### 2. Get License
**Endpoint:** `GET /api/v1/license/:license_id`

Retrieve license details by ID.

**Response (200 OK):**
```json
{
  "license_id": "ra-d1e2f3g4h5i6j7k8l9m0",
  "tier": "ra",
  "created_at": "2025-01-19T10:30:00Z",
  "expires_at": "2026-01-19T10:30:00Z",
  "node_quota": 3,
  "node_count": 1,
  "valid": true
}
```

#### 3. Upgrade License
**Endpoint:** `POST /api/v1/license/:license_id/upgrade`

Upgrade a license to a higher tier.

**Request Body:**
```json
{
  "new_tier": "atum"
}
```

**Response (200 OK):**
```json
{
  "license_id": "ra-d1e2f3g4h5i6j7k8l9m0",
  "new_tier": "atum",
  "tier_name": "Hive",
  "node_quota": 10,
  "features": ["basic-scan", "stig-validation", "pqc-signatures", "multi-tenant", "white-box-crypto"],
  "message": "Successfully upgraded to atum tier"
}
```

#### 4. Get License Usage
**Endpoint:** `GET /api/v1/license/:license_id/usage`

Track current usage statistics.

**Response (200 OK):**
```json
{
  "license_id": "ra-d1e2f3g4h5i6j7k8l9m0",
  "tier": "ra",
  "node_quota": 3,
  "nodes_created": 2,
  "nodes_remaining": 1,
  "percent_used": "66.7%"
}
```

#### 5. List Licenses (Admin)
**Endpoint:** `GET /api/v1/license/admin/list`

Retrieve all licenses (admin endpoint).

**Response (200 OK):**
```json
{
  "count": 5,
  "licenses": [
    {
      "license_id": "khepri-...",
      "tier": "khepri",
      "customer": "Startup Inc",
      "expires_at": "2025-06-19T10:30:00Z"
    }
  ]
}
```

### Telemetry Integration

#### 1. Enroll with Telemetry Server
**Endpoint:** `POST /api/v1/license/telemetry/enroll`

Auto-enroll machine with Cloudflare telemetry server using enrollment token.

**Request Body:**
```json
{
  "enrollment_token": "KHEPRA_ENROLL_XXXXXXXXXXXXXXXX",
  "customer_name": "Acme Corp",
  "tier": "ra"
}
```

**Response (201 Created):**
```json
{
  "license_id": "ra-auto-generated-id",
  "tier": "ra",
  "customer": "Acme Corp",
  "expires_at": "2026-01-19T10:30:00Z",
  "message": "Successfully enrolled with Cloudflare telemetry server"
}
```

#### 2. Send Heartbeat
**Endpoint:** `POST /api/v1/license/telemetry/heartbeat`

Send usage metrics to telemetry server (called periodically by agent).

**Request Body:**
```json
{
  "license_id": "ra-d1e2f3g4h5i6j7k8l9m0",
  "nodes_created": 2,
  "node_quota_used": 2
}
```

**Response (200 OK):**
```json
{
  "license_id": "ra-d1e2f3g4h5i6j7k8l9m0",
  "nodes_created": 2,
  "node_quota_used": 2,
  "message": "Heartbeat received and queued"
}
```

#### 3. Telemetry Status
**Endpoint:** `GET /api/v1/license/telemetry/status`

Check telemetry server connectivity and capabilities.

**Response (200 OK):**
```json
{
  "status": "online",
  "telemetry_server": "https://telemetry.souhimbou.org",
  "supports_enroll": true,
  "supports_validate": true,
  "supports_heartbeat": true
}
```

## Integration with API Server

### Routes Registration (server.go)

The licensing endpoints are registered in the `setupRoutes()` method:

```go
v1 := s.router.Group("/api/v1")
v1.Use(s.AuthMiddleware())
{
    // License endpoints
    license := v1.Group("/license")
    {
        license.POST("/create", s.handleCreateLicense)
        license.GET("/:license_id", s.handleGetLicense)
        license.POST("/:license_id/upgrade", s.handleUpgradeLicense)
        license.GET("/:license_id/usage", s.handleGetLicenseUsage)
        license.GET("/admin/list", s.handleListLicenses)
        
        // Telemetry sub-group
        telemetry := license.Group("/telemetry")
        {
            telemetry.POST("/enroll", s.handleTelemetryEnroll)
            telemetry.POST("/heartbeat", s.handleTelemetryHeartbeat)
            telemetry.GET("/status", s.handleTelemetryStatus)
        }
    }
}
```

### LicenseManagerAdapter

The adapter bridges the `license.Manager` to the API server's `LicenseManager` interface:

```go
type LicenseManagerAdapter struct {
    mgr *license.Manager
}

func NewLicenseManagerAdapter(mgr *license.Manager) *LicenseManagerAdapter {
    return &LicenseManagerAdapter{mgr: mgr}
}
```

## Error Responses

All endpoints follow consistent error response format:

```json
{
  "error": "error_code",
  "message": "Human-readable error message",
  "code": 400
}
```

### Common Error Codes

| Code | Meaning |
|------|---------|
| `invalid_request` | Malformed request body |
| `invalid_tier` | Unknown tier value |
| `license_not_found` | License ID does not exist |
| `license_adapter_error` | License manager not initialized |
| `upgrade_failed` | Cannot downgrade or invalid upgrade |

## Implementation Files

- **Handler Functions:** `pkg/apiserver/licensing_handlers.go`
- **Integration Layer:** `pkg/apiserver/integration.go`
- **Server Setup:** `pkg/apiserver/server.go`
- **Example Usage:** `pkg/apiserver/example_usage.go`

## Usage Example

### Initialize API Server with Licensing

```go
package main

import (
    "log"
    "github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/apiserver"
    "github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/license"
    "github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/dag"
)

func main() {
    // Initialize DAG
    dagStore := dag.GlobalDAG()
    
    // Initialize License Manager
    licMgr, err := license.NewManager("https://telemetry.souhimbou.org")
    if err != nil {
        log.Fatalf("Failed to create license manager: %v", err)
    }
    
    if err := licMgr.Initialize(); err != nil {
        log.Printf("License validation failed: %v", err)
    }
    
    // Create adapters
    dagAdapter := apiserver.NewDAGStoreAdapter(dagStore)
    licAdapter := apiserver.NewLicenseManagerAdapter(licMgr)
    
    // Create and start server
    config := &apiserver.Config{
        Host: "0.0.0.0",
        Port: 8080,
        Debug: false,
    }
    
    server := apiserver.NewServer(config, dagAdapter, licAdapter)
    log.Fatal(server.Start())
}
```

### cURL Examples

**Create License:**
```bash
curl -X POST http://localhost:8080/api/v1/license/create \
  -H "Content-Type: application/json" \
  -d '{"tier":"khepri","customer":"Test Org","duration_days":365}'
```

**Get License:**
```bash
curl -X GET http://localhost:8080/api/v1/license/khepri-abc123
```

**Upgrade License:**
```bash
curl -X POST http://localhost:8080/api/v1/license/khepri-abc123/upgrade \
  -H "Content-Type: application/json" \
  -d '{"new_tier":"ra"}'
```

**Check Telemetry Status:**
```bash
curl -X GET http://localhost:8080/api/v1/license/telemetry/status
```

## Future Enhancements

1. **Database Persistence:** Store licenses in PostgreSQL/MongoDB with full CRUD
2. **License Validation:** Cryptographic validation using Dilithium signatures
3. **Quota Enforcement:** Enforce node quotas at DAG mutation time
4. **Audit Logging:** Track all license operations for compliance
5. **Usage Analytics:** Dashboard for license usage trends
6. **Billing Integration:** Stripe/Zuora integration for automated billing
7. **License Revocation:** Support license suspension/revocation
8. **Multi-Region:** Support distributed license validation across regions
