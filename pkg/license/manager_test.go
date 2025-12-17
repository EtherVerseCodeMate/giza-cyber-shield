package license

import (
	"encoding/json"
	"os"
	"testing"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/adinkra"
)

func TestLicenseCycle(t *testing.T) {
	// 1. Generate Keys
	pub, priv, err := adinkra.GenerateDilithiumKey()
	if err != nil {
		t.Fatalf("Failed to generate keys: %v", err)
	}

	// 2. Generate License
	now := time.Now()
	claims := LicenseClaims{
		Tenant:       "TestTenant",
		HostID:       "*", // Floating license for test stability
		Expiry:       now.Add(24 * time.Hour),
		Capabilities: []string{"test"},
	}

	licFile, err := Generate(priv, claims)
	if err != nil {
		t.Fatalf("Failed to generate license: %v", err)
	}

	if len(licFile.Signature) == 0 {
		t.Error("Signature is empty")
	}

	// 3. Serialize to disk
	data, _ := json.Marshal(licFile)
	tmpfile, _ := os.CreateTemp("", "license_*.khepra")
	defer os.Remove(tmpfile.Name())
	tmpfile.Write(data)
	tmpfile.Close()

	// 4. Verify
	verifiedClaims, err := Verify(tmpfile.Name(), pub)
	if err != nil {
		t.Fatalf("Verify failed: %v", err)
	}

	if verifiedClaims.Tenant != "TestTenant" {
		t.Errorf("Expected tenant TestTenant, got %s", verifiedClaims.Tenant)
	}
}

func TestGetHostID(t *testing.T) {
	id, err := GetHostID()
	if err != nil {
		t.Fatalf("GetHostID failed: %v", err)
	}
	if len(id) == 0 {
		t.Error("Host ID is empty")
	}
}
