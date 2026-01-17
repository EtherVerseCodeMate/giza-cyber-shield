package license

import (
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"
)

// Manager handles license validation lifecycle
type Manager struct {
	client           *LicenseClient
	cachedValidation *ValidateResponse
	lastValidated    time.Time
	validationMu     sync.RWMutex
	heartbeatStopCh  chan struct{}
	enrollmentToken  string // Optional enrollment token for auto-registration
}

// NewManager creates license manager
func NewManager(serverURL string) (*Manager, error) {
	// Generate or retrieve the hardware-bound Machine ID
	machineID := GenerateMachineID()

	// TODO: Retrieve persisted private key or generate one if strictly transient.
	// For production, this PrivateKey should be loaded from secure storage (e.g., encoded file on disk)
	// associated with this Machine ID, or generated once and saved.
	// For this implementation, we will assume it's passed via ENV or config,
	// OR we generate a temporary one if signing is part of the handshake (but we need it for subsequent reqs).
	// Since the user spec says "privateKeyHex", we'll leave it empty here to be set by the caller or loaded.

	client := &LicenseClient{
		ServerURL:  serverURL,
		MachineID:  machineID,
		HTTPClient: &http.Client{Timeout: 10 * time.Second},
	}

	return &Manager{
		client: client,
	}, nil
}

// SetPrivateKey allows setting the Dilithium key for signing requests
func (m *Manager) SetPrivateKey(privateKey string) {
	m.client.PrivateKey = privateKey
}

// SetEnrollmentToken sets the enrollment token for auto-registration
func (m *Manager) SetEnrollmentToken(token string) {
	m.enrollmentToken = token
}

// GetMachineID returns the machine ID
func (m *Manager) GetMachineID() string {
	return m.client.MachineID
}

// Initialize validates license and starts heartbeat daemon
func (m *Manager) Initialize() error {
	// Initial validation
	resp, err := m.client.Validate()
	if err != nil {
		log.Printf("[LICENSE] Initial validation failed: %v", err)

		// If we have an enrollment token, attempt auto-registration
		if m.enrollmentToken != "" {
			log.Printf("[LICENSE] Attempting auto-registration with enrollment token...")
			regResp, regErr := m.client.Register(m.enrollmentToken)
			if regErr != nil {
				log.Printf("[LICENSE] Auto-registration failed: %v", regErr)
			} else if regResp.Status == "registered" || regResp.Status == "already_registered" {
				log.Printf("[LICENSE] ✅ Auto-registration successful: %s", regResp.Organization)
				log.Printf("[LICENSE] License tier: %s, Expires: %s", regResp.LicenseTier, regResp.ExpiresAt)
				log.Printf("[LICENSE] %s", regResp.Message)

				// Re-attempt validation after registration
				resp, err = m.client.Validate()
				if err != nil {
					log.Printf("[LICENSE] Post-registration validation failed: %v", err)
					return fmt.Errorf("license validation failed after registration: %w", err)
				}
			} else {
				log.Printf("[LICENSE] Registration response: %s - %s", regResp.Status, regResp.Error)
			}
		}

		// If still failing, check grace period
		if err != nil {
			log.Printf("[LICENSE] Checking for cached grace period...")
			// Logic for Grace Period Check (Mocked for now as we don't have disk persistence yet)
			// If persisted validation exists and is < 30 days old, return nil (success)
			// For now, we fallback to community edition if online validation fails.
			return fmt.Errorf("license validation failed: %w", err)
		}
	}

	m.validationMu.Lock()
	m.cachedValidation = resp
	m.lastValidated = time.Now()
	m.validationMu.Unlock()

	if !resp.Valid {
		log.Printf("[LICENSE] License invalid: %s", resp.Error)
		if resp.FallbackAvailable {
			log.Printf("[LICENSE] Falling back to community edition")
			// We don't error here, we just run in community mode
			return nil
		}
		return fmt.Errorf("license invalid: %s", resp.Error)
	}

	log.Printf("[LICENSE] ✅ License validated: %s (%s)",
		resp.Organization, resp.LicenseTier)
	// log.Printf("[LICENSE] Features: %v", resp.Features)
	log.Printf("[LICENSE] Expires: %s", resp.ExpiresAt)

	// Start heartbeat daemon
	m.heartbeatStopCh = make(chan struct{})
	m.client.StartHeartbeatDaemon(m.heartbeatStopCh)

	return nil
}

// HasFeature checks if license includes specific feature
func (m *Manager) HasFeature(feature string) bool {
	m.validationMu.RLock()
	defer m.validationMu.RUnlock()

	// Grace Period Check: If cached validation is expired > 30 days, force fail
	if time.Since(m.lastValidated) > 30*24*time.Hour {
		return false
	}

	if m.cachedValidation == nil || !m.cachedValidation.Valid {
		return false // Community edition
	}

	for _, f := range m.cachedValidation.Features {
		if f == feature {
			return true
		}
	}

	return false
}

// GetTier returns license tier
func (m *Manager) GetTier() string {
	m.validationMu.RLock()
	defer m.validationMu.RUnlock()

	// Grace Period Check
	if time.Since(m.lastValidated) > 30*24*time.Hour {
		return "community" // Expired grace period
	}

	if m.cachedValidation == nil || !m.cachedValidation.Valid {
		return "community"
	}

	return m.cachedValidation.LicenseTier
}

// Stop stops heartbeat daemon
func (m *Manager) Stop() {
	if m.heartbeatStopCh != nil {
		close(m.heartbeatStopCh)
	}
}
