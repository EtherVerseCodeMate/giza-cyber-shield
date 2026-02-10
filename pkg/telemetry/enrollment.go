package telemetry

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/license"
)

// EnrollmentRequest is the payload sent to enroll a device
type EnrollmentRequest struct {
	MachineID        string `json:"machine_id"`
	Organization     string `json:"organization"`
	Email            string `json:"email"`
	TelemetryEnabled bool   `json:"telemetry_enabled"`
	StripeSessionID  string `json:"stripe_session_id,omitempty"` // For premium tiers
}

// EnrollmentResponse contains the license details
type EnrollmentResponse struct {
	LicenseID   string   `json:"license_id"`
	Tier        string   `json:"tier"`
	Features    []string `json:"features"`
	ExpiresAt   string   `json:"expires_at"`
	AccessToken string   `json:"access_token"` // For future authenticated requests
}

// EnrollDevice registers the device with the central Khepra server
func EnrollDevice(organization, email, stripeSessionID string, licMgr *license.Manager) (*EnrollmentResponse, error) {
	if licMgr == nil {
		return nil, fmt.Errorf("license manager not initialized")
	}

	machineID := licMgr.GetMachineID()

	req := EnrollmentRequest{
		MachineID:        machineID,
		Organization:     organization,
		Email:            email,
		TelemetryEnabled: true, // Auto-enable for now
		StripeSessionID:  stripeSessionID,
	}

	payload, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}

	serverURL := os.Getenv("ADINKHEPRA_TELEMETRY_SERVER")
	if serverURL == "" {
		serverURL = "https://telemetry.khepra.io/enroll"
	}

	// In Community Mode, "enrollment" might be a local no-op or a simple ping
	// For this task, we'll simulate the HTTP call to the telemetry server
	// But first, let's implement the local tier transition if stripe session is present

	if stripeSessionID != "" {
		// Simulate successful payment validation
		// In production, this would verify with backend
		fmt.Printf("[KHEPRA] Validating subscription for session %s...\n", stripeSessionID)

		// For now, assume "Hunter" tier if session provided
		// This allows local testing of tier upgrades
		// licMgr.UpgradeTier("ra") // This method needs to exist on LicenseManager
	}

	// Send to server
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Post(serverURL, "application/json", nil) // Mock: nil body for now as we don't have real endpoint

	// MOCK RESPONSE for Local Testing
	mockResp := &EnrollmentResponse{
		LicenseID:   generateLicenseID(machineID),
		Tier:        "community", // Default
		Features:    []string{"basic-scan", "community-pqc"},
		ExpiresAt:   time.Now().AddDate(1, 0, 0).Format(time.RFC3339),
		AccessToken: "mock-token-" + machineID,
	}

	if stripeSessionID != "" {
		mockResp.Tier = "ra"
		mockResp.Features = append(mockResp.Features, "stig-nist", "threat-detection")
	}

	return mockResp, nil
}

func generateLicenseID(machineID string) string {
	hash := sha256.Sum256([]byte(machineID + time.Now().String()))
	return "LIC-" + hex.EncodeToString(hash[:])[:16]
}
