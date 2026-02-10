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
    2.  Checks `signature.length`.
    3.  **TODO**: The code has a `TODO: Verify Dilithium3 signature`.
    4.  **Critical Finding**: While `index.js` (Telemetry Beacon) *has* real PQC verification implemented, `license.js` (Validation) currently has a placeholder check (`signature.length > 100`).
    5.  **Database**: Queries D1 `licenses` table.

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
*   **Crypto Integrity**: **PARTIAL FAIL**.
    *   **Issue**: Telemetry Beacons are cryptographically verified (High Integrity).
    *   **Issue**: License Validation Endpoint (`/license/validate`) in the Worker needs the real PQC verification logic ported from `index.js`.
    *   **Risk**: A spoofed license request might bypass validation if it just sends a long string as a signature.

## Remediation Plan
1.  Copy the `ml_dsa65.verify` logic from `index.js` to `license.js`.
2.  Ensure the `TELEMETRY_PUBLIC_KEY` is accessible to the `handleLicenseValidate` function.
