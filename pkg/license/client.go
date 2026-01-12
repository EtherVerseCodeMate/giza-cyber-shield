package license

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"runtime"
	"time"

	"github.com/cloudflare/circl/sign/mldsa/mldsa65"
)

// LicenseClient handles license validation with telemetry server
type LicenseClient struct {
	ServerURL  string
	MachineID  string
	PrivateKey string // Hex-encoded Dilithium3 private key
	HTTPClient *http.Client
}

// ValidateRequest sent to /license/validate
type ValidateRequest struct {
	MachineID      string `json:"machine_id"`
	Signature      string `json:"signature"` // Dilithium3 signature
	Version        string `json:"version"`
	InstallationID string `json:"installation_id"`
}

// ValidateResponse from /license/validate
type ValidateResponse struct {
	Valid             bool     `json:"valid"`
	Features          []string `json:"features"`
	LicenseTier       string   `json:"license_tier"`
	Organization      string   `json:"organization"`
	ExpiresAt         string   `json:"expires_at"`
	IssuedAt          string   `json:"issued_at"`
	ValidatedAt       string   `json:"validated_at"`
	Error             string   `json:"error,omitempty"`
	FallbackAvailable bool     `json:"fallback_available,omitempty"`
}

// HeartbeatRequest sent to /license/heartbeat
type HeartbeatRequest struct {
	MachineID  string                 `json:"machine_id"`
	Signature  string                 `json:"signature"`
	StatusData map[string]interface{} `json:"status_data"`
}

// HeartbeatResponse from /license/heartbeat
type HeartbeatResponse struct {
	Status          string `json:"status"` // 'active', 'revoked', 'expired'
	Action          string `json:"action,omitempty"`
	Message         string `json:"message,omitempty"`
	NextHeartbeatIn int    `json:"next_heartbeat_in"`
}

// Validate sends license validation request to telemetry server
func (lc *LicenseClient) Validate() (*ValidateResponse, error) {
	// Sign machine_id with Dilithium3
	signature, err := lc.signData([]byte(lc.MachineID))
	if err != nil {
		return nil, fmt.Errorf("failed to sign license request: %w", err)
	}

	req := ValidateRequest{
		MachineID:      lc.MachineID,
		Signature:      signature,
		Version:        "v1.0.0", // TODO: Get from build info
		InstallationID: lc.MachineID,
	}

	payload, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}

	// Use DefaultClient if HTTPClient is nil
	client := lc.HTTPClient
	if client == nil {
		client = http.DefaultClient
	}

	resp, err := client.Post(
		lc.ServerURL+"/license/validate",
		"application/json",
		bytes.NewBuffer(payload),
	)
	if err != nil {
		return nil, fmt.Errorf("license server unreachable: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("license server returned status: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var validateResp ValidateResponse
	if err := json.Unmarshal(body, &validateResp); err != nil {
		return nil, err
	}

	return &validateResp, nil
}

// SendHeartbeat sends periodic heartbeat to maintain license validity
func (lc *LicenseClient) SendHeartbeat(statusData map[string]interface{}) (*HeartbeatResponse, error) {
	signature, err := lc.signData([]byte(lc.MachineID))
	if err != nil {
		return nil, err
	}

	req := HeartbeatRequest{
		MachineID:  lc.MachineID,
		Signature:  signature,
		StatusData: statusData,
	}

	payload, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}

	client := lc.HTTPClient
	if client == nil {
		client = http.DefaultClient
	}

	resp, err := client.Post(
		lc.ServerURL+"/license/heartbeat",
		"application/json",
		bytes.NewBuffer(payload),
	)
	if err != nil {
		return nil, fmt.Errorf("heartbeat failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var heartbeatResp HeartbeatResponse
	if err := json.Unmarshal(body, &heartbeatResp); err != nil {
		return nil, err
	}

	return &heartbeatResp, nil
}

// startTime is captured at package initialization
var startTime = time.Now()

// StartHeartbeatDaemon starts background heartbeat (every hour)
func (lc *LicenseClient) StartHeartbeatDaemon(stopCh chan struct{}) {
	go func() {
		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				statusData := map[string]interface{}{
					"uptime_hours": time.Since(startTime).Hours(),
					"go_version":   runtime.Version(),
				}

				_, err := lc.SendHeartbeat(statusData)
				if err != nil {
					// Simply log error or retry, but don't crash
					// In a real app we might want to pass a logger or callback
					// fmt.Printf("[LICENSE] Heartbeat failed: %v\n", err)
					continue
				}

				// Handle response logic if needed (e.g. revocation) within the Manager,
				// but this client is lower level. The Manager normally wraps this.
			case <-stopCh:
				return
			}
		}
	}()
}

// signData signs data with ML-DSA-65 private key
func (lc *LicenseClient) signData(data []byte) (string, error) {
	if lc.PrivateKey == "" {
		return "", fmt.Errorf("no private key provided")
	}

	// Decode private key from hex
	keyBytes, err := hex.DecodeString(lc.PrivateKey)
	if err != nil {
		return "", fmt.Errorf("invalid private key hex: %w", err)
	}

	if len(keyBytes) != mldsa65.PrivateKeySize {
		return "", fmt.Errorf("invalid private key size: expected %d, got %d",
			mldsa65.PrivateKeySize, len(keyBytes))
	}

	var keyBuf [mldsa65.PrivateKeySize]byte
	copy(keyBuf[:], keyBytes)

	var privateKey mldsa65.PrivateKey
	privateKey.Unpack(&keyBuf)

	// ML-DSA-65 SignTo
	// func SignTo(sk *PrivateKey, msg, ctx []byte, randomized bool, sig []byte) error
	signature := make([]byte, mldsa65.SignatureSize)
	mldsa65.SignTo(&privateKey, data, nil, false, signature)

	return hex.EncodeToString(signature), nil
}
