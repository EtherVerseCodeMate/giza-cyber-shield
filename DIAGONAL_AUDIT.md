# Diagonal Audit: The Lifecycle of a License
**Definition**: Tracing the "License" feature/data diagonally through the stack to verify integration and data integrity.

## Trace Request: "Validate License"

### Step 1: Generation (Go Layer)
*   **Component**: `cmd/sonar/license.go` -> `generateMachineID()`
*   **Action**: Reads system hardware info (MAC, Disk ID).
*   **Crypto**: Signs the ID using `cloudflare/circl` (Dilithium3).
*   **Output**: `machine_id` + `signature`.

### Step 2: Transport (CLI -> API)
*   **Component**: `services/ml_anomaly/api.py` -> `/api/v1/license/status`
*   **Action**: Spawns `khepra license status --json`.
*   **Integrity**: The Python layer acts as a transparent proxy, parsing the JSON stdout. It does not modify the crypto data.

### Step 3: Verification (Infra/Network Layer)
*   **Component**: `adinkhepra-telemetry-server/src/license.js` -> `handleLicenseValidate`
*   **Action**:
    1.  Parses JSON body.
    2.  Verifies Dilithium3 (ML-DSA-65) signature using `@noble/post-quantum`.
    3.  **Status**: **REMEDIATED**. Real PQC verification is now active.
    4.  **Database**: Queries D1 `licenses` table via modular helper functions.

### Step 4: Storage (Data Layer)
*   **Component**: Cloudflare D1 -> `licenses` table.
*   **Schema**: Stores `features`, `expires_at`, `license_tier`.
*   **Observation**: The schema correctly separates `expires_at` (Unix) and `features` (JSON).

### Step 5: Consumpution (Frontend Layer)
*   **Component**: `useKhepraAPI.ts` -> `getLicenseStatus()`
*   **Component**: `KhepraStatus.tsx`
*   **Action**: React Query fetches status.
*   **Logic**: Calculates `usagePercentage` based on `node_count` vs `node_quota` returned by API.
*   **UI**: Displays "Stable" or "Error" badge.

## Systems Integrity Verdict
*   **Data Flow**: **PASS**. Data flows correctly from binary to UI.
*   **Crypto Integrity**: **PASS**.
    *   **Verification**: Both Telemetry Beacons and License Validations are now cryptographically verified using ML-DSA-65.
    *   **Security**: Spoofed license requests are now rejected at the Worker layer.

## Remediation Status
1.  **DONE**: Ported `ml_dsa65.verify` logic to `license.js`.
2.  **DONE**: Refactored `license.js` for better modularity and lower cognitive complexity.
3.  **DONE**: Addressed all linting issues in the telemetry server.
