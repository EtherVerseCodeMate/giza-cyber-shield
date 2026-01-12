package telemetry

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/license"
	"github.com/cloudflare/circl/sign/mldsa/mldsa65"
)

// Beacon represents anonymous telemetry data
type Beacon struct {
	TelemetryVersion string          `json:"telemetry_version"`
	Timestamp        string          `json:"timestamp"`
	AnonymousID      string          `json:"anonymous_id"`
	ScanMetadata     ScanMetadata    `json:"scan_metadata"`
	CryptoInventory  CryptoInventory `json:"cryptographic_inventory"`
	GeographicHint   string          `json:"geographic_hint,omitempty"`

	// NEW: License information (for enterprise users)
	LicenseTier string `json:"license_tier,omitempty"` // 'community', 'dod_premium'
	LicenseHash string `json:"license_hash,omitempty"` // SHA256 of machine_id
}

// ScanMetadata contains information about the scan execution
type ScanMetadata struct {
	ScanDuration         int      `json:"scan_duration_seconds"`
	TargetsScanned       int      `json:"targets_scanned"`
	FindingsCount        int      `json:"findings_count"`
	ComplianceFrameworks []string `json:"compliance_frameworks"`
	ScannerVersion       string   `json:"scanner_version"`
	ContainerRuntime     string   `json:"container_runtime"`
	DeploymentEnv        string   `json:"deployment_environment"`
}

// CryptoInventory contains cryptographic asset counts (NOT actual keys)
type CryptoInventory struct {
	RSA2048Keys       int `json:"rsa_2048_keys"`
	RSA3072Keys       int `json:"rsa_3072_keys"`
	RSA4096Keys       int `json:"rsa_4096_keys"`
	ECCP256Keys       int `json:"ecc_p256_keys"`
	ECCP384Keys       int `json:"ecc_p384_keys"`
	Dilithium3Keys    int `json:"dilithium3_keys"`
	Kyber1024Keys     int `json:"kyber1024_keys"`
	TLSWeakConfigs    int `json:"tls_weak_configs"`
	DeprecatedCiphers int `json:"deprecated_ciphers"`
}

// GenerateAnonymousID creates a privacy-safe device identifier
// This allows counting unique installations without collecting PII
func GenerateAnonymousID() string {
	hostname, _ := os.Hostname()

	// Get primary MAC address (first non-loopback interface)
	mac := getMACAddress()

	// Static salt to prevent rainbow table attacks
	salt := "khepra-telemetry-v1-2026"

	// Hash: SHA256(MAC + hostname + salt)
	data := fmt.Sprintf("%s:%s:%s", mac, hostname, salt)
	hash := sha256.Sum256([]byte(data))

	return hex.EncodeToString(hash[:])
}

// getMACAddress retrieves the first non-loopback MAC address
func getMACAddress() string {
	// Simplified implementation - in production, use net.Interfaces()
	// For now, use hostname as fallback
	hostname, _ := os.Hostname()
	return hostname
}

// SendBeacon transmits telemetry to collection server
func SendBeacon(beacon *Beacon, privateKeyHex string) error {
	// Check if telemetry is enabled (Option C: Hybrid approach)
	mode := os.Getenv("KHEPRA_MODE")
	if mode == "" {
		mode = "community" // Default from container ENV
	}

	telemetryEnv := os.Getenv("KHEPRA_TELEMETRY")

	if mode == "community" {
		// Community: Opt-IN required
		if telemetryEnv != "true" {
			return fmt.Errorf("telemetry disabled (community mode requires KHEPRA_TELEMETRY=true)")
		}
	} else {
		// Enterprise: Opt-OUT allowed
		if telemetryEnv == "false" {
			return fmt.Errorf("telemetry disabled by user")
		}
	}

	// Serialize beacon to JSON
	payload, err := json.Marshal(beacon)
	if err != nil {
		return fmt.Errorf("failed to marshal beacon: %w", err)
	}

	// Sign with Dilithium3 (anti-spoofing)
	signature, err := signWithDilithium(payload, privateKeyHex)
	if err != nil {
		return fmt.Errorf("failed to sign beacon: %w", err)
	}

	// Send to telemetry server
	serverURL := os.Getenv("ADINKHEPRA_TELEMETRY_SERVER")
	if serverURL == "" {
		serverURL = "https://telemetry.khepra.io/beacon"
	}

	req, err := http.NewRequest("POST", serverURL, bytes.NewBuffer(payload))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Khepra-Signature", hex.EncodeToString(signature))
	req.Header.Set("X-Khepra-Version", beacon.ScanMetadata.ScannerVersion)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		// Non-fatal: telemetry failure should not break scans
		return fmt.Errorf("failed to send beacon: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := ioutil.ReadAll(resp.Body)
		return fmt.Errorf("telemetry server returned %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// SendBeaconWithLicense sends a beacon with additional license context
func SendBeaconWithLicense(beacon *Beacon, privateKeyHex string, licMgr *license.Manager) error {
	// Add license context to beacon (optional, only for premium)
	if licMgr != nil {
		beacon.LicenseTier = licMgr.GetTier()
		beacon.LicenseHash = hashMachineID(licMgr.GetMachineID())
	}

	// Existing beacon send logic...
	return SendBeacon(beacon, privateKeyHex)
}

func hashMachineID(machineID string) string {
	hash := sha256.Sum256([]byte(machineID))
	return hex.EncodeToString(hash[:])
}

// signWithDilithium signs payload with embedded private key (ML-DSA-65)
func signWithDilithium(payload []byte, privateKeyHex string) ([]byte, error) {
	if privateKeyHex == "" {
		return nil, fmt.Errorf("no private key provided (telemetry signing disabled)")
	}

	// Decode private key from hex
	keyBytes, err := hex.DecodeString(privateKeyHex)
	if err != nil {
		return nil, fmt.Errorf("invalid private key hex: %w", err)
	}

	// Load into ML-DSA-65 private key
	if len(keyBytes) != mldsa65.PrivateKeySize {
		return nil, fmt.Errorf("invalid private key size: expected %d, got %d",
			mldsa65.PrivateKeySize, len(keyBytes))
	}

	var keyBuf [mldsa65.PrivateKeySize]byte
	copy(keyBuf[:], keyBytes)

	var privateKey mldsa65.PrivateKey
	privateKey.Unpack(&keyBuf)

	// Sign payload
	signature := make([]byte, mldsa65.SignatureSize)
	mldsa65.SignTo(&privateKey, payload, nil, false, signature)

	return signature, nil
}

// DetectContainerRuntime identifies the container environment
func DetectContainerRuntime() string {
	// Check for Docker
	if _, err := os.Stat("/.dockerenv"); err == nil {
		return "docker"
	}

	// Check for Podman
	if os.Getenv("container") == "podman" {
		return "podman"
	}

	// Check for Kubernetes
	if os.Getenv("KUBERNETES_SERVICE_HOST") != "" {
		return "kubernetes"
	}

	return "native"
}

// DetectGeographicHint attempts to identify deployment region (privacy-safe)
func DetectGeographicHint() string {
	// Try AWS metadata service (only works in EC2)
	client := &http.Client{Timeout: 2 * time.Second}

	resp, err := client.Get("http://169.254.169.254/latest/meta-data/placement/region")
	if err == nil {
		defer resp.Body.Close()
		body, _ := ioutil.ReadAll(resp.Body)
		region := string(body)
		if region != "" {
			return region // e.g., "us-gov-west-1"
		}
	}

	// Try Azure metadata service
	req, _ := http.NewRequest("GET", "http://169.254.169.254/metadata/instance/compute/location?api-version=2021-02-01&format=text", nil)
	req.Header.Set("Metadata", "true")
	resp, err = client.Do(req)
	if err == nil {
		defer resp.Body.Close()
		body, _ := ioutil.ReadAll(resp.Body)
		region := string(body)
		if region != "" {
			return region // e.g., "usgovvirginia"
		}
	}

	// Try GCP metadata service
	req, _ = http.NewRequest("GET", "http://metadata.google.internal/computeMetadata/v1/instance/zone", nil)
	req.Header.Set("Metadata-Flavor", "Google")
	resp, err = client.Do(req)
	if err == nil {
		defer resp.Body.Close()
		body, _ := ioutil.ReadAll(resp.Body)
		zone := string(body)
		if zone != "" {
			return zone // e.g., "us-central1-a"
		}
	}

	return "on-prem" // Cannot determine cloud region
}

// ExtractCryptoInventory analyzes snapshot for cryptographic asset counts
// NOTE: This does NOT extract actual keys, only counts by type
func ExtractCryptoInventory(snapshot interface{}) CryptoInventory {
	// Placeholder implementation
	// TODO: Parse snapshot data structures to count:
	// - RSA key sizes (from TLS certificates, SSH keys)
	// - ECC curve types (from TLS configs)
	// - PQC algorithm usage (Dilithium, Kyber)
	// - Weak TLS configurations (SSLv3, TLS 1.0/1.1)
	// - Deprecated ciphers (3DES, RC4, CBC mode)

	inventory := CryptoInventory{
		RSA2048Keys:       0,
		RSA3072Keys:       0,
		RSA4096Keys:       0,
		ECCP256Keys:       0,
		ECCP384Keys:       0,
		Dilithium3Keys:    0,
		Kyber1024Keys:     0,
		TLSWeakConfigs:    0,
		DeprecatedCiphers: 0,
	}

	// Future: Implement actual parsing logic based on snapshot schema
	// For now, return empty inventory (Phase 1)

	return inventory
}
