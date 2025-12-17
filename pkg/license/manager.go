package license

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net"
	"os"
	"runtime"
	"sort"
	"strings"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/adinkra"
)

// LicenseClaims represents the data signed by the Khepra Authority.
type LicenseClaims struct {
	Tenant       string    `json:"tenant"`
	HostID       string    `json:"host_id"` // Hardware Fingerprint
	Expiry       time.Time `json:"expiry"`
	Capabilities []string  `json:"capabilities"` // e.g. ["compliance", "audit"]
}

// LicenseFile is the artifact distributed to the client.
type LicenseFile struct {
	Claims    LicenseClaims `json:"claims"`
	Signature []byte        `json:"signature"` // Dilithium Signature
}

// GetHostID generates a unique fingerprint for the current machine.
// Strategy: Hash(Hostname + First Stable MAC Address + OS/Arch)
func GetHostID() (string, error) {
	hostname, err := os.Hostname()
	if err != nil {
		hostname = "unknown"
	}

	interfaces, _ := net.Interfaces()
	// Sort interfaces to ensure deterministic order so we always pick the same MAC
	sort.Slice(interfaces, func(i, j int) bool {
		return interfaces[i].Name < interfaces[j].Name
	})

	mac := ""
	for _, i := range interfaces {
		// specific flags might be needed (e.g. Up, Loopback)
		// For now, any non-empty MAC is better than random
		if len(i.HardwareAddr) > 0 {
			mac = i.HardwareAddr.String()
			break
		}
	}

	// Fallback if no MAC
	if mac == "" {
		mac = "00:00:00:00:00:00"
	}

	raw := fmt.Sprintf("%s|%s|%s|%s", hostname, mac, runtime.GOOS, runtime.GOARCH)
	hash := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(hash[:]), nil
}

// Verify checks if the license is valid for THIS machine.
// Takes the master public key (embedded in binary usually, or passed).
func Verify(path string, pubKey []byte) (*LicenseClaims, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("license file not found: %v", err)
	}

	var lic LicenseFile
	if err := json.Unmarshal(data, &lic); err != nil {
		return nil, fmt.Errorf("invalid license format")
	}

	// 1. Verify Expiry
	if time.Now().After(lic.Claims.Expiry) {
		return nil, fmt.Errorf("license expired on %s", lic.Claims.Expiry.Format("2006-01-02"))
	}

	// 2. Verify Host Binding (Anti-Copy)
	currentHostID, _ := GetHostID()

	// Normalize
	licHostID := strings.TrimSpace(lic.Claims.HostID)
	currHostID := strings.TrimSpace(currentHostID)

	// Skip check if HostID is "*" (Floating/Dev License)
	if licHostID != "*" && licHostID != currHostID {
		return nil, fmt.Errorf("license host mismatch. bound to '%s', running on '%s' (len: %d vs %d)", licHostID, currHostID, len(licHostID), len(currHostID))
	}

	// 3. Verify Cryptographic Signature (Dilithium)
	// Reconstruct the signed payload
	payload, _ := json.Marshal(lic.Claims)

	valid, err := adinkra.Verify(pubKey, payload, lic.Signature)
	if err != nil || !valid {
		return nil, fmt.Errorf("invalid signature (forged license)")
	}

	return &lic.Claims, nil
}

// Generate creates a signed license (For Khepra HQ use only).
func Generate(privKey []byte, claims LicenseClaims) (*LicenseFile, error) {
	payload, _ := json.Marshal(claims)
	sig, err := adinkra.Sign(privKey, payload)
	if err != nil {
		return nil, err
	}

	return &LicenseFile{
		Claims:    claims,
		Signature: sig,
	}, nil
}
