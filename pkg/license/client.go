package license

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
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

// RegisterRequest sent to /license/register for auto-enrollment
type RegisterRequest struct {
	MachineID       string `json:"machine_id"`
	EnrollmentToken string `json:"enrollment_token"`
	Hostname        string `json:"hostname"`
	Platform        string `json:"platform"`
	AgentVersion    string `json:"agent_version"`
}

// RegisterResponse from /license/register
type RegisterResponse struct {
	Status        string   `json:"status"` // 'registered', 'already_registered', error
	MachineID     string   `json:"machine_id"`
	Organization  string   `json:"organization"`
	Features      []string `json:"features"`
	LicenseTier   string   `json:"license_tier"`
	IssuedAt      string   `json:"issued_at"`
	ExpiresAt     string   `json:"expires_at"`
	DaysRemaining int      `json:"days_remaining"`
	Message       string   `json:"message"`
	Error         string   `json:"error,omitempty"`
	Help          string   `json:"help,omitempty"`
}

// Register attempts to auto-register the agent using an enrollment token
// This is called on first boot when no license exists
func (lc *LicenseClient) Register(enrollmentToken string) (*RegisterResponse, error) {
	hostname, _ := os.Hostname()

	req := RegisterRequest{
		MachineID:       lc.MachineID,
		EnrollmentToken: enrollmentToken,
		Hostname:        hostname,
		Platform:        fmt.Sprintf("%s-%s", runtime.GOOS, runtime.GOARCH),
		AgentVersion:    "v1.0.0", // TODO: Get from build info
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
		lc.ServerURL+"/license/register",
		"application/json",
		bytes.NewBuffer(payload),
	)
	if err != nil {
		return nil, fmt.Errorf("registration server unreachable: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var registerResp RegisterResponse
	if err := json.Unmarshal(body, &registerResp); err != nil {
		return nil, err
	}

	// Check for error responses (non-2xx status codes)
	if resp.StatusCode >= 400 {
		if registerResp.Error != "" {
			return &registerResp, fmt.Errorf("registration failed: %s", registerResp.Error)
		}
		return nil, fmt.Errorf("registration failed with status: %d", resp.StatusCode)
	}

	return &registerResp, nil
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
